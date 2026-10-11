// POST /api/stripe/webhook: minimal verifier first (plan 04-04, research Pitfall 1). Reads the raw body once and checks
// Stripe's signature with SubtleCrypto. The handlers follow in the same plan.
import Stripe from "stripe";
import { stripeServer } from "../../../../lib/stripe/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("bad request", { status: 400 });
  const stripe = stripeServer();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return new Response("unavailable", { status: 503 });
  const body = await request.text();
  try {
    await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return new Response("bad request", { status: 400 });
  }
  return new Response("unavailable", { status: 503 });
}
