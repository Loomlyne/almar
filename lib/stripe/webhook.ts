// What the Stripe webhook does with a verified event (plan 04-04). The route verifies the signature on the raw body and
// then calls `deliverStripeEvent`, which claims the event id (`claim_stripe_event`: a duplicate or an event in progress
// is answered 200 and not handled again), runs `handleStripeEvent`, and finishes the claim (`finish_stripe_event`) or,
// when the handler failed, drops it (`drop_stripe_event`) so Stripe's retry runs again. The webhook is the source of
// truth for payments (PAY-09): the paid session is recorded here, idempotently, however often it arrives.
// No environment and no Stripe import at run time (types only): fakes stand in for both in the tests.
import type Stripe from "stripe";
import { callRpc, fulfillSession, idOf, type FulfillResult, type StripeDb, type StripeReader } from "./fulfill";

export type WebhookDeps = { db: StripeDb; stripe: StripeReader; now: () => Date };
export type HandledEvent = { handled: boolean; fulfilled?: FulfillResult };

const MAX_REFUND_PAGES = 10;

/** Every refund of a charge: the ones the event carries, or Stripe's own list when it carries a partial page or none. */
async function refundsOf(charge: Stripe.Charge, stripe: StripeReader): Promise<{ id: string; amount: number; status: string | null }[]> {
  const inline = charge.refunds;
  if (inline && !inline.has_more) return inline.data.map((r) => ({ id: r.id, amount: r.amount, status: r.status ?? null }));
  const all: { id: string; amount: number; status: string | null }[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_REFUND_PAGES; page += 1) {
    const list = await stripe.refunds.list({ charge: charge.id, limit: 100, ...(after ? { starting_after: after } : {}) });
    for (const r of list.data) all.push({ id: r.id, amount: r.amount, status: r.status ?? null });
    const last = list.data.at(-1);
    if (!list.has_more || !last) return all;
    after = last.id;
  }
  throw new Error("refund list too long");
}

/** Dispatch one verified event. Throws when Stripe should retry (an unknown payment, a database error). */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<HandledEvent> {
  const actor = `stripe:${event.id}`;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "paid") return { handled: false };
      return { handled: true, fulfilled: await fulfillSession(deps.db, deps.stripe, session, actor) };
    }
    case "checkout.session.expired": {
      await callRpc(deps.db, "mark_session_expired", { p_session: event.data.object.id, p_actor: actor });
      return { handled: true };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const intent = idOf(charge.payment_intent);
      for (const refund of await refundsOf(charge, deps.stripe)) {
        const answer = await callRpc(deps.db, "record_refund", {
          p_refund_id: refund.id,
          p_charge: charge.id,
          p_payment_intent: intent,
          p_amount_fils: refund.amount,
          p_status: refund.status,
          p_actor: actor,
        });
        if (answer !== "ok") throw new Error(`record_refund: ${typeof answer === "string" ? answer : "unreadable"}`);
      }
      return { handled: true };
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const dispute = event.data.object;
      const answer = await callRpc(deps.db, "record_dispute", {
        p_dispute_id: dispute.id,
        p_charge: idOf(dispute.charge),
        p_payment_intent: idOf(dispute.payment_intent),
        p_amount_fils: dispute.amount,
        p_reason: typeof dispute.reason === "string" ? dispute.reason : null,
        p_status: dispute.status,
        p_actor: actor,
      });
      if (answer !== "ok") throw new Error(`record_dispute: ${typeof answer === "string" ? answer : "unreadable"}`);
      return { handled: true };
    }
    default:
      return { handled: false };
  }
}

/**
 * Claim, handle, finish. 200 for a handled, ignored or duplicate event; 500 when Stripe should send it again (nothing
 * about the event is logged). A failing `finish_stripe_event` does not undo a handled event: the claim would be taken
 * over after two minutes and the idempotent handlers would run again harmlessly.
 */
export async function deliverStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<{ status: 200 | 500; duplicate: boolean }> {
  let claimed: unknown;
  try {
    claimed = await callRpc(deps.db, "claim_stripe_event", { p_id: event.id, p_type: event.type });
  } catch {
    return { status: 500, duplicate: false };
  }
  if (typeof claimed !== "boolean") return { status: 500, duplicate: false };
  if (!claimed) return { status: 200, duplicate: true };

  try {
    await handleStripeEvent(event, deps);
  } catch {
    try {
      await callRpc(deps.db, "drop_stripe_event", { p_id: event.id });
    } catch {
      // The claim stays; it is taken over after two minutes.
    }
    return { status: 500, duplicate: false };
  }
  try {
    await callRpc(deps.db, "finish_stripe_event", { p_id: event.id });
  } catch {
    // See above.
  }
  return { status: 200, duplicate: false };
}

