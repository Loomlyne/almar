// The payment flows behind the booking routes (plan 04-04): the hold with its Checkout Session, the pay endpoint (a
// balance, or the first payment of a hand-made booking, PAY-10 and O-02), the status check, and the release that also
// closes the guest's session at Stripe. Plain functions over `{ db, stripe }` (anything with `.rpc` and the Stripe
// client), each answering `{ status, body }`, so the routes only wire the environment and the tests pass fakes.
// No environment is read here. Nothing is logged, and no answer carries a name, an email or the booking id.
import type Stripe from "stripe";
import { authorizeBookingAccess } from "../booking/access";
import { verifyBookingLink } from "../booking/link";
import { isBookingRef } from "../booking/ref";
import { bookingByRef, holdStatus, releaseWebHold, type BookingDb, type BookingRow, type HoldOutcome } from "../booking/server";
import { BOOKING_TERMS_VERSION } from "../booking/terms";
import type { BookingReason } from "../booking/types";
import {
  expireCheckoutSessions, openCheckout, type CheckoutApi, type OpenCheckoutResult, type PaymentKind,
} from "./checkout";
import { callRpc, fulfillSession, isObj, type StripeDb, type StripeReader } from "./fulfill";
import { stripePublishableKey } from "./server";

type Locale = "en" | "ar" | "es";
export type FlowAnswer = { status: number; body: unknown };

const UNAVAILABLE = { ok: false, reasons: [{ code: "unavailable" }] } as const;

// ---------------------------------------------------------------- the hold with its Checkout Session

export type HoldWithCheckoutDeps = {
  db: StripeDb;
  stripe: CheckoutApi;
  /** The 04-02 hold (`createWebHold` with the visitor's limiter hashes), run first. */
  createHold: () => Promise<HoldOutcome>;
  origin: string;
  locale: Locale;
  plan: "deposit" | "full";
  now?: Date;
};

/**
 * The guest's hold, then the session for its first payment. A refused hold is answered as 04-02 answers it. When the
 * session cannot be opened for any reason the hold is dropped at once (the nights are free again, any session already
 * made is closed) and the guest gets 502 `unavailable`: nobody keeps nights they cannot pay for. Success adds
 * `checkout` (client secret, publishable key, session id) to the hold's answer; the booking id never leaves the server.
 */
export async function holdWithCheckout(deps: HoldWithCheckoutDeps): Promise<FlowAnswer> {
  const outcome = await deps.createHold();
  const response = outcome.response;
  if (!response.ok) return { status: holdStatus(response), body: response };
  if (!outcome.bookingId) return { status: 503, body: UNAVAILABLE };

  let opened: OpenCheckoutResult | null = null;
  try {
    opened = await openCheckout(deps.db, deps.stripe, {
      bookingId: outcome.bookingId,
      kind: deps.plan,
      status: "held",
      origin: deps.origin,
      locale: deps.locale,
      linkToken: response.linkToken,
      now: deps.now,
    });
  } catch {
    opened = null;
  }
  if (!opened || !opened.ok) {
    await dropFailedHold(deps.db, deps.stripe, outcome.bookingId);
    return { status: 502, body: UNAVAILABLE };
  }
  return {
    status: 200,
    body: { ...response, checkout: { clientSecret: opened.clientSecret, publishableKey: opened.publishableKey, sessionId: opened.sessionId } },
  };
}

async function dropFailedHold(db: StripeDb, stripe: CheckoutApi, bookingId: string): Promise<void> {
  try {
    const dropped = await callRpc(db, "booking_drop_hold", { p_booking: bookingId, p_actor: "system" });
    const sessions = isObj(dropped) && Array.isArray(dropped.closed_sessions) ? dropped.closed_sessions.filter((s): s is string => typeof s === "string") : [];
    if (sessions.length > 0) await expireCheckoutSessions(stripe, sessions).catch(() => undefined);
  } catch {
    // The hold lapses on its own after 30 minutes (lazy sweep); the guest was already told it did not work.
  }
}

// ---------------------------------------------------------------- the pay endpoint

export type PayRequest = { ref: string; t: string | undefined; termsAccepted: boolean };
const PAY_KEYS = ["ref", "t", "termsAccepted"];
const LINK_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

/** `{ ref, t?, termsAccepted? }` and nothing else: the amount and the kind are never the browser's to say. */
export function parsePayRequest(body: unknown): { ok: true; value: PayRequest } | { ok: false; reasons: BookingReason[] } {
  const refuse = (field: string) => ({ ok: false as const, reasons: [{ code: "invalid" as const, field }] });
  if (typeof body !== "object" || body === null || Array.isArray(body)) return refuse("body");
  const rec = body as Record<string, unknown>;
  for (const key of Object.keys(rec)) if (!PAY_KEYS.includes(key)) return refuse(key);
  if (!isBookingRef(rec.ref)) return refuse("ref");
  let t: string | undefined;
  if (rec.t !== undefined) {
    if (typeof rec.t !== "string" || !LINK_TOKEN.test(rec.t)) return refuse("t");
    t = rec.t;
  }
  if (rec.termsAccepted !== undefined && typeof rec.termsAccepted !== "boolean") return refuse("termsAccepted");
  return { ok: true, value: { ref: rec.ref, t, termsAccepted: rec.termsAccepted === true } };
}

export type PayDeps = {
  db: BookingDb & StripeDb;
  stripe: CheckoutApi;
  origin: string;
  now?: Date;
  /** The signed-in guest's email, when there is a session (the second door, B-16). */
  readSession: () => Promise<{ email: string } | null>;
  /** The Checkout Session id of the booking's open payment, or null. */
  findOpenSession: (bookingId: string) => Promise<string | null>;
};

const FIRST_PAYMENT_STATUSES = ["held", "awaiting_payment"];
const BALANCE_STATUSES = ["deposit_paid", "confirmed"];

function refusal(reasons: BookingReason[]): FlowAnswer {
  const code = reasons[0]?.code;
  return { status: code === "terms_required" ? 400 : code === "unavailable" ? 503 : 409, body: { ok: false, reasons } };
}

/**
 * A held web booking whose session Stripe still reports `open` with a client secret: that session again (a refresh must
 * not cost the guest a new session, and with under 30 minutes of hold left a new one is not even allowed). Research A5.
 */
async function reusableSession(deps: PayDeps, bookingId: string): Promise<Extract<OpenCheckoutResult, { ok: true }> | null> {
  const publishableKey = stripePublishableKey();
  if (!publishableKey) return null;
  try {
    const sessionId = await deps.findOpenSession(bookingId);
    if (!sessionId) return null;
    const session = await deps.stripe.checkout.sessions.retrieve(sessionId);
    const kind = session.metadata?.kind;
    if (
      session.status !== "open" || typeof session.client_secret !== "string" || session.client_secret === "" ||
      (kind !== "deposit" && kind !== "full") || !Number.isSafeInteger(session.amount_total)
    ) {
      return null;
    }
    return { ok: true, clientSecret: session.client_secret, publishableKey, sessionId, amountFils: session.amount_total as number, kind };
  } catch {
    return null;
  }
}

/**
 * POST /api/booking/pay. Access first (the signed link, or the signed-in guest's email; anything else is a plain 404 that
 * says nothing). Then the booking's status chooses the payment: a held or awaiting booking pays its first payment (its
 * plan decides deposit or full: `open_payment` accepts only the plan's kind), a deposit_paid or confirmed one its
 * balance; every other status is 409 `not_payable`. The amount is SQL's.
 */
export async function startPayment(deps: PayDeps, input: PayRequest): Promise<FlowAnswer> {
  try {
    let found: BookingRow | null = null;
    const access = await authorizeBookingAccess(input, {
      findByRef: async (ref) => {
        found = await bookingByRef(deps.db, ref);
        return found ? { id: found.id, email: found.email, linkVersion: found.linkVersion } : null;
      },
      verify: (id, version, token) => verifyBookingLink(id, version, token),
      readSession: deps.readSession,
    });
    const booking = found as BookingRow | null;
    if (!access.ok || !booking) return { status: 404, body: { ok: false } };

    const first = FIRST_PAYMENT_STATUSES.includes(booking.status);
    const balance = BALANCE_STATUSES.includes(booking.status);
    if (!first && !balance) return refusal([{ code: "not_payable" }]);

    if (booking.status === "held") {
      const kept = await reusableSession(deps, booking.id);
      if (kept) return { status: 200, body: kept };
    }

    const kinds: PaymentKind[] = first ? ["deposit", "full"] : ["balance"];
    let last: OpenCheckoutResult | null = null;
    for (const kind of kinds) {
      last = await openCheckout(deps.db, deps.stripe, {
        bookingId: booking.id,
        kind,
        status: booking.status,
        termsVersion: input.termsAccepted ? BOOKING_TERMS_VERSION : undefined,
        origin: deps.origin,
        linkToken: input.t ?? "",
        now: deps.now,
      });
      if (last.ok) return { status: 200, body: last };
      // The plan decides which of the two first payments is open: the other answers not_payable, changing nothing.
      if (last.reasons[0]?.code === "not_payable" && kind !== kinds[kinds.length - 1]) continue;
      return refusal(last.reasons);
    }
    return refusal(last && !last.ok ? last.reasons : [{ code: "not_payable" }]);
  } catch {
    return { status: 503, body: UNAVAILABLE };
  }
}

// ---------------------------------------------------------------- the status check

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID.test(value);
}

export type StatusDeps = { db: StripeDb; stripe: Pick<Stripe, "checkout" | "paymentIntents" | "refunds"> & StripeReader };

/**
 * GET /api/booking/status?session_id=. What Stripe says about the session; a paid one is recorded through the same
 * idempotent fulfilment the webhook uses (so the guest sees "paid" before the webhook lands). The answer is the word
 * `paid`, `open`, `expired`, `unknown` or `unavailable` and nothing else: no name, email or amount.
 */
export async function checkSession(deps: StatusDeps, sessionId: unknown): Promise<FlowAnswer> {
  if (!isCheckoutSessionId(sessionId)) return { status: 400, body: { status: "invalid" } };
  let session: Stripe.Checkout.Session;
  try {
    session = await deps.stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    const missing = isObj(error) && (error.code === "resource_missing" || error.statusCode === 404);
    return missing ? { status: 404, body: { status: "unknown" } } : { status: 503, body: { status: "unavailable" } };
  }
  if (session.payment_status === "paid") {
    try {
      await fulfillSession(deps.db, deps.stripe, session, "guest");
      return { status: 200, body: { status: "paid" } };
    } catch (error) {
      return error instanceof Error && error.message === "record_payment: payment_unknown"
        ? { status: 404, body: { status: "unknown" } }
        : { status: 503, body: { status: "unavailable" } };
    }
  }
  return { status: 200, body: { status: session.status === "expired" ? "expired" : "open" } };
}

// ---------------------------------------------------------------- the release

/**
 * 04-02's release (the guest drops their own hold), then the sessions it closed are expired at Stripe. A Stripe failure
 * changes nothing for the guest: the payment rows are already closed and a payment that still lands is flagged by
 * `record_payment`. Without a Stripe client the release stands too.
 */
export async function releaseAndExpire(db: BookingDb & StripeDb, stripe: CheckoutApi | null, input: { ref: unknown; t?: unknown }): Promise<{ ok: boolean }> {
  const released = await releaseWebHold(db, input);
  if (!released.ok) return { ok: false };
  if (stripe && released.sessionIds.length > 0) {
    try {
      await expireCheckoutSessions(stripe, released.sessionIds);
    } catch {
      // See above.
    }
  }
  return { ok: true };
}
