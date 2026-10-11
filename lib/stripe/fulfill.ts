// Fulfilment of a paid Checkout Session (plan 04-04, PAY-09). One function, called by the webhook and by
// /api/booking/status, safe to call any number of times for the same session: `record_payment` is idempotent in SQL
// (one row lock per booking), so only the call that records the payment (`first_time`) stores the card details.
// No environment and no Stripe import at run time (types only): the callers pass the database (anything with
// `.rpc(name, args)`) and the Stripe client, and tests pass fakes. Errors carry the function name only, never a session,
// a payment or an amount.
import type Stripe from "stripe";

export type StripeDb = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/** The two Stripe resources fulfilment and the webhook read. */
export type StripeReader = Pick<Stripe, "paymentIntents" | "refunds">;

/** What `fulfillSession` needs of a Checkout Session. */
export type PaidSession = Pick<Stripe.Checkout.Session, "id" | "payment_status" | "payment_intent" | "amount_total" | "currency">;

/** `record_payment`'s answer as SQL gives it (snake_case), passed through unchanged; 04-05 reads `first_time` etc. */
export type FulfillResult = {
  found: boolean;
  first_time: boolean;
  reason?: string;
  booking_id?: string;
  payment_id?: string;
  kind?: string;
  status?: string;
  needs_attention?: boolean;
  closed_sessions?: string[];
};

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The id of a Stripe field that is either an id or the expanded object. */
export function idOf(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (isObj(value) && typeof value.id === "string" && value.id !== "") return value.id;
  return null;
}

/** One RPC; a database error throws with the function name only. */
export async function callRpc(db: StripeDb, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`rpc ${name} failed`);
  return data;
}

const WALLETS = new Set(["apple_pay", "google_pay", "samsung_pay"]);

/**
 * Record the payment of a paid session and, on the first time only, the card's brand and last four digits (PAY-06;
 * never a full number), the wallet, and what the guest saw in their own currency. A session that is not paid is not
 * recorded. A session we have no payment for throws (the webhook answers 500 and Stripe retries). The card lookup is
 * best effort: a Stripe or database failure there leaves the recorded payment standing.
 */
export async function fulfillSession(db: StripeDb, stripe: StripeReader, session: PaidSession, actor: string): Promise<FulfillResult> {
  if (session.payment_status !== "paid") return { found: false, first_time: false, reason: "not_paid" };

  const intentId = idOf(session.payment_intent);
  const data = await callRpc(db, "record_payment", { p_session: session.id, p_payment_intent: intentId, p_actor: actor });
  if (!isObj(data) || typeof data.found !== "boolean" || typeof data.first_time !== "boolean") throw new Error("rpc record_payment: unreadable answer");
  if (!data.found) throw new Error(`record_payment: ${typeof data.reason === "string" ? data.reason : "payment_unknown"}`);

  if (data.first_time && intentId) {
    try {
      await storeCard(db, stripe, session, intentId, data as FulfillResult, actor);
    } catch {
      // The money is recorded; the card line on the booking is a convenience and is not worth a second charge attempt.
    }
  }
  return data as FulfillResult;
}

async function storeCard(db: StripeDb, stripe: StripeReader, session: PaidSession, intentId: string, result: FulfillResult, actor: string): Promise<void> {
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });

  // Research A2: the amount Stripe took must be what our payment row asked for. The expected amount travels in the
  // intent's own metadata (written by checkoutParams); a difference is written to the booking's history, never dropped.
  const expected = Number(intent.metadata?.amount_fils);
  if (Number.isSafeInteger(expected) && result.booking_id) {
    const off = session.amount_total !== expected || intent.amount !== expected || session.currency !== "aed" || intent.currency !== "aed";
    if (off) {
      await callRpc(db, "log_booking_event", {
        p_booking: result.booking_id,
        p_actor: actor,
        p_action: "payment",
        p_detail: {
          mismatch: true,
          payment_id: result.payment_id ?? null,
          expected_fils: expected,
          session_amount: session.amount_total,
          intent_amount: intent.amount,
          session_currency: session.currency,
          intent_currency: intent.currency,
        },
      });
    }
  }

  const charge = intent.latest_charge;
  if (!isObj(charge) || !result.payment_id) return;
  const card = (charge as { payment_method_details?: { card?: { brand?: string | null; last4?: string | null; wallet?: { type?: string } | null } | null } | null }).payment_method_details?.card;
  const last4 = typeof card?.last4 === "string" && /^[0-9]{4}$/.test(card.last4) ? card.last4 : null;
  const wallet = typeof card?.wallet?.type === "string" && WALLETS.has(card.wallet.type) ? card.wallet.type : null;
  const presentment = intent.presentment_details;
  await callRpc(db, "set_payment_card", {
    p_payment: result.payment_id,
    p_charge: idOf(charge),
    p_brand: typeof card?.brand === "string" ? card.brand : null,
    p_last4: last4,
    p_wallet: wallet,
    p_presentment_amount: presentment && Number.isSafeInteger(presentment.presentment_amount) ? presentment.presentment_amount : null,
    p_presentment_currency: presentment && typeof presentment.presentment_currency === "string" ? presentment.presentment_currency : null,
  });
}
