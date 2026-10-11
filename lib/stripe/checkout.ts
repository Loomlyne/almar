// The Checkout Session behind a hold, a hand-made booking's first payment or a balance (plan 04-04, PAY-07, PAY-08,
// PAY-10, B-03, B-07, B-08, B-20). Elements mode: the form is on our page, never a Stripe-hosted page. AED, card only
// (Apple Pay is the card's wallet), Adaptive Pricing on so Stripe can show the guest's own currency, no saved cards.
//
// The amount is never the caller's: `open_payment` reads it from the stored booking snapshot. Every Stripe POST carries
// an idempotency key built from our own ids (`cs-create:<payment id>`, `cs-expire:<session id>`), and `open_payment`
// closes any earlier open payment first, so one booking has at most one open session and a refresh or a second tab
// never makes a second charge. Errors name nothing the guest sent.
import type Stripe from "stripe";
import { localePath } from "../locale-path";
import type { BookingReason } from "../booking/types";
import { callRpc, isObj, type StripeDb } from "./fulfill";
import { stripePublishableKey } from "./server";

export type PaymentKind = "deposit" | "full" | "balance";
export type CheckoutApi = Pick<Stripe, "checkout">;

const MINUTE = 60_000;
/** Stripe's limits for `expires_at`: 30 minutes to 24 hours from now. */
const SESSION_MIN = 30 * MINUTE;
const SESSION_MAX = 24 * 60 * MINUTE;
/** The Checkout Session outlasts a web hold by a minute (the hold's nights outlast it by the same minute, 04-02). */
const WEB_MARGIN = MINUTE;
const BALANCE_LIFETIME = 60 * MINUTE;

export type CheckoutParamsInput = {
  booking: { id: string; ref: string; email: string };
  payment: { id: string; kind: PaymentKind; amountFils: number };
  expiresAt: Date;
  returnUrl: string;
  stayTitleEn: string;
};

/**
 * The create parameters. No redirect URLs but `return_url` (elements mode takes no others), no `locale` (the enum has no Arabic), no
 * `customer_creation` and no saved-card option. The metadata is ids and the reference only: no email, no name. The amount also rides in the intent's
 * metadata so the first fulfilment can check Stripe took exactly what the payment row asked for (research A2).
 */
export function checkoutParams({ booking, payment, expiresAt, returnUrl, stayTitleEn }: CheckoutParamsInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    ui_mode: "elements",
    currency: "aed",
    payment_method_types: ["card"],
    adaptive_pricing: { enabled: true },
    customer_email: booking.email,
    client_reference_id: booking.id,
    metadata: { booking_id: booking.id, ref: booking.ref, kind: payment.kind, payment_id: payment.id },
    payment_intent_data: {
      description: `${booking.ref} ${payment.kind}`,
      metadata: { booking_id: booking.id, payment_id: payment.id, amount_fils: String(payment.amountFils) },
    },
    line_items: [
      { quantity: 1, price_data: { currency: "aed", unit_amount: payment.amountFils, product_data: { name: `${booking.ref} · ${stayTitleEn}`.slice(0, 250) } } },
    ],
    expires_at: Math.ceil(expiresAt.getTime() / 1000),
    return_url: returnUrl,
  };
}

export type ExpiryResult = { ok: true; expiresAt: Date } | { ok: false; reason: "hold_ending" };

/**
 * When the session ends. First payment of a web hold: a minute after the hold. A hand-made booking (`awaiting_payment`):
 * its hold, at most 24 hours out. A balance: an hour from now. Stripe wants 30 minutes to 24 hours ahead, so a session
 * that would last under 30 minutes is `hold_ending` (research Pitfall 4) and nothing is created.
 */
export function sessionExpiry(input: { kind: PaymentKind; status: string; holdExpiresAt: string | null; now: Date }): ExpiryResult {
  const now = input.now.getTime();
  let at: number;
  if (input.kind === "balance") {
    at = now + BALANCE_LIFETIME;
  } else {
    const hold = input.holdExpiresAt === null ? Number.NaN : Date.parse(input.holdExpiresAt);
    if (!Number.isFinite(hold)) return { ok: false, reason: "hold_ending" };
    at = Math.min(input.status === "awaiting_payment" ? hold : hold + WEB_MARGIN, now + SESSION_MAX);
  }
  if (at < now + SESSION_MIN) return { ok: false, reason: "hold_ending" };
  return { ok: true, expiresAt: new Date(at) };
}

/** A Stripe error that only says the session is already expired, complete or gone: not a failure of ours. */
export function isSessionClosedError(error: unknown): boolean {
  if (!isObj(error)) return false;
  return error.type === "StripeInvalidRequestError" || error.rawType === "invalid_request_error" || error.statusCode === 400 || error.code === "resource_missing";
}

export class CheckoutExpireError extends Error {
  /** The session ids Stripe did not close. */
  failed: string[];
  constructor(failed: string[]) {
    super("checkout sessions could not be expired");
    this.failed = failed;
  }
}

/**
 * Ends open sessions at Stripe, each with its own idempotency key. A session that is already expired or complete is
 * fine; any other failure is thrown after every session was tried (CheckoutExpireError.failed), so the caller can decide
 * whether it matters (a release: no; 05-01's Cancel: it warns the owner).
 */
export async function expireCheckoutSessions(stripe: CheckoutApi, ids: readonly string[]): Promise<void> {
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await stripe.checkout.sessions.expire(id, {}, { idempotencyKey: "cs-expire:" + id });
    } catch (error) {
      if (!isSessionClosedError(error)) failed.push(id);
    }
  }
  if (failed.length > 0) throw new CheckoutExpireError(failed);
}

export type OpenCheckoutInput = {
  bookingId: string;
  kind: PaymentKind;
  /** The booking's status now: a hand-made booking (`awaiting_payment`) keeps its session to its own hold, a web hold to the hold plus a minute. */
  status: string;
  /** Sent for a booking that has no accepted terms yet (hand-made); the SQL ignores it for one that has. */
  termsVersion?: string;
  /** The booking origin of the request's host (lib/booking/origin.ts): where Stripe sends the guest after a redirect. */
  origin: string;
  /** The page's language. Without it the booking's own language is used (the pay endpoint has no page language). */
  locale?: "en" | "ar" | "es";
  /** The signed link token for the return address; empty for a signed-in guest, whose session is the second door. */
  linkToken: string;
  now?: Date;
};

export type OpenCheckoutResult =
  | { ok: true; clientSecret: string; publishableKey: string; sessionId: string; amountFils: number; kind: PaymentKind }
  | { ok: false; reasons: BookingReason[] };

const OPEN_PAYMENT_REFUSALS = ["not_payable", "hold_ended", "nothing_due", "below_minimum_charge", "terms_required"] as const;
const UNAVAILABLE: OpenCheckoutResult = { ok: false, reasons: [{ code: "unavailable" }] };

/**
 * One open payment and its session. `open_payment` (SQL) decides what may be paid and how much, closes any open payment
 * of the booking and hands back that payment's session so it is expired before the new one exists; then the session is
 * created with the payment id as its idempotency key and attached. A refusal is `{ ok: false, reasons }`; a failure at
 * Stripe or the database throws (the hold route then drops the hold).
 */
export async function openCheckout(db: StripeDb, stripe: CheckoutApi, input: OpenCheckoutInput): Promise<OpenCheckoutResult> {
  // Without the publishable key the browser could not use the session: open nothing, make no payment row.
  const publishableKey = stripePublishableKey();
  if (!publishableKey) return UNAVAILABLE;

  const opened = await callRpc(db, "open_payment", { p_booking: input.bookingId, p_kind: input.kind, p_terms_version: input.termsVersion ?? null });
  if (!isObj(opened)) throw new Error("rpc open_payment: unreadable answer");
  if (opened.ok !== true) {
    const reason = (OPEN_PAYMENT_REFUSALS as readonly unknown[]).includes(opened.reason) ? (opened.reason as (typeof OPEN_PAYMENT_REFUSALS)[number]) : "unavailable";
    return { ok: false, reasons: [{ code: reason }] };
  }

  const booking = opened.booking;
  const paymentId = opened.payment_id;
  const amount = opened.amount_fils;
  if (
    !isObj(booking) || typeof booking.id !== "string" || typeof booking.ref !== "string" || typeof booking.email !== "string" ||
    typeof paymentId !== "string" || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0
  ) {
    throw new Error("rpc open_payment: unreadable answer");
  }

  const previous = opened.previous_session_id;
  if (typeof previous === "string" && previous !== "") await expireCheckoutSessions(stripe, [previous]);

  const expiry = sessionExpiry({
    kind: input.kind,
    status: input.status,
    holdExpiresAt: typeof opened.hold_expires_at === "string" ? opened.hold_expires_at : null,
    now: input.now ?? new Date(),
  });
  // The payment row stays open without a session; it carries no money and the next open_payment closes it.
  if (!expiry.ok) return { ok: false, reasons: [{ code: expiry.reason }] };

  const locale = input.locale ?? (booking.locale === "ar" || booking.locale === "es" ? booking.locale : "en");
  const token = input.linkToken === "" ? "" : `&t=${encodeURIComponent(input.linkToken)}`;
  const returnUrl = `${input.origin}${localePath(locale, "/bookings/trip")}?ref=${encodeURIComponent(booking.ref)}${token}&session_id={CHECKOUT_SESSION_ID}`;
  const params = checkoutParams({
    booking: { id: booking.id, ref: booking.ref, email: booking.email },
    payment: { id: paymentId, kind: input.kind, amountFils: amount },
    expiresAt: expiry.expiresAt,
    returnUrl,
    stayTitleEn: typeof booking.stay_title_en === "string" ? booking.stay_title_en : booking.ref,
  });
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey: "cs-create:" + paymentId });
  if (typeof session.id !== "string" || typeof session.client_secret !== "string" || session.client_secret === "") {
    if (typeof session.id === "string") await expireCheckoutSessions(stripe, [session.id]).catch(() => undefined);
    throw new Error("checkout session without a client secret");
  }

  try {
    await callRpc(db, "attach_checkout_session", { p_payment: paymentId, p_session: session.id });
  } catch (error) {
    await expireCheckoutSessions(stripe, [session.id]).catch(() => undefined);
    throw error;
  }
  return { ok: true, clientSecret: session.client_secret, publishableKey, sessionId: session.id, amountFils: amount, kind: input.kind };
}
