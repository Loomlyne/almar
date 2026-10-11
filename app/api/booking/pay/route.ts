// POST /api/booking/pay { ref, t?, termsAccepted? } (plan 04-04, PAY-10, O-02): a Checkout Session for the next payment of
// a booking: the first payment of a hand-made booking, or the balance of a deposit_paid or confirmed one. The amount and
// the kind come from the database, never from the browser. The signed link token, or a signed-in guest with the
// booking's email, is the only key; a wrong token, an unknown reference and no session all answer 404 with the same
// body. 400 for a body that is not a pay request or terms still to accept; 403 for a foreign origin; 409 with the
// reason when the booking cannot be paid now; 503 when the server, the link secret, Stripe or live payments are not
// ready (B-13). Nothing is logged.
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { readJsonBody } from "../../../../lib/booking/http";
import { bookingOrigin, isAllowedPostOrigin } from "../../../../lib/booking/origin";
import { parsePayRequest, startPayment } from "../../../../lib/stripe/pay";
import { paymentsOpen, stripeMode, stripeServer } from "../../../../lib/stripe/server";
import { createSupabaseAdmin, readSessionProfile } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 4 * 1024;

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const unavailable = { ok: false, reasons: [{ code: "unavailable" }] };

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parsePayRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const stripe = stripeServer();
  const admin = createSupabaseAdmin();
  if (!stripe || !paymentsOpen(stripeMode()) || !admin || !bookingLinkConfigured()) return reply(unavailable, 503);

  try {
    const answer = await startPayment(
      {
        db: admin,
        stripe,
        origin: bookingOrigin(request.headers.get("host"), process.env.NODE_ENV),
        readSession: async () => {
          const profile = await readSessionProfile();
          return profile ? { email: profile.email } : null;
        },
        findOpenSession: async (bookingId) => {
          const { data, error } = await admin.from("booking_payments").select("checkout_session_id").eq("booking_id", bookingId).eq("status", "open").maybeSingle();
          if (error) throw new Error("open payment lookup failed");
          return typeof data?.checkout_session_id === "string" ? data.checkout_session_id : null;
        },
      },
      parsed.value,
    );
    return reply(answer.body, answer.status);
  } catch {
    return reply(unavailable, 503);
  }
}
