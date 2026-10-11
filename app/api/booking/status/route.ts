// GET /api/booking/status?session_id=cs_... (plan 04-04, PAY-09): what Stripe says about a Checkout Session, for the page
// that just took the payment. A paid session is recorded here through the same idempotent fulfilment the webhook uses, so
// the guest sees "paid" before the webhook lands (Stripe recommends both). The answer is one word, `paid`, `open`,
// `expired`, `unknown` or `unavailable`: never a name, an email or an amount. A session id that is not a Checkout
// Session id is 400 before anything else. Nothing is logged.
import { checkSession, isCheckoutSessionId } from "../../../../lib/stripe/pay";
import { stripeServer } from "../../../../lib/stripe/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

export async function GET(request: Request): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!isCheckoutSessionId(sessionId)) return reply({ status: "invalid" }, 400);
  const stripe = stripeServer();
  const admin = createSupabaseAdmin();
  if (!stripe || !admin) return reply({ status: "unavailable" }, 503);
  try {
    const answer = await checkSession({ db: admin, stripe }, sessionId);
    return reply(answer.body, answer.status);
  } catch {
    return reply({ status: "unavailable" }, 503);
  }
}
