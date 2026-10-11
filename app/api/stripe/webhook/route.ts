// POST /api/stripe/webhook (plan 04-04): Stripe tells us a payment happened, expired, was refunded or was disputed. The
// webhook is the source of truth for payments (PAY-09).
//
// The raw body is read once, as text, and checked against Stripe's signature with constructEventAsync and
// SubtleCrypto (the synchronous constructEvent throws with SubtleCrypto); a changed byte, a missing header, a wrong
// secret or a header older than five minutes is 400. It is never parsed or re-serialized first, and never logged.
// Unavailable (no signing secret, no Stripe key, no database) is 503 so Stripe retries. deliverStripeEvent
// (lib/stripe/webhook.ts) claims the event id in claim_stripe_event so a duplicate is 200 and not handled again, runs
// the handler, then finish_stripe_event, or drop_stripe_event and 500 so Stripe's retry runs it again. The one file
// that names the signing secret (tests/secrets.test.mjs).
import Stripe from "stripe";
import { deliverStripeEvent } from "../../../../lib/stripe/webhook";
import { stripeServer } from "../../../../lib/stripe/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const text = (body: string, status: number) => new Response(body, { status, headers: NO_STORE });

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return text("bad request", 400);
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripe = stripeServer();
  if (!secret || !stripe) return text("unavailable", 503);

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return text("bad request", 400);
  }

  const admin = createSupabaseAdmin();
  if (!admin) return text("unavailable", 503);
  const delivery = await deliverStripeEvent(event, { db: admin, stripe, now: () => new Date() });
  return delivery.status === 200 ? Response.json({ received: true }, { headers: NO_STORE }) : text("retry", 500);
}
