// POST /api/booking/hold: the guest's 30-minute hold and the Checkout Session for its first payment (plans 04-02, 04-04).
// The server prices the stay again and stores that price; the browser's numbers are not read. 200 with the booking
// reference, the hold's end, a signed link token and `checkout` (the client secret, the publishable key and the session
// id for the Payment Element); 409 with the reasons when the stay cannot be booked as asked; 429 when the guest has
// asked too often; 400 for a body that is not a hold request; 403 for a foreign origin; 502 when the payment session
// could not be opened (the hold is dropped at once); 503 when the server, the link secret, Stripe or live payments are
// not ready (a live Stripe key stays closed while the booking terms are the placeholder, B-13). Nothing is logged: no
// body, no email, no phone. The booking id never leaves the server.
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { readJsonBody } from "../../../../lib/booking/http";
import { bookingOrigin, isAllowedPostOrigin } from "../../../../lib/booking/origin";
import { createWebHold } from "../../../../lib/booking/server";
import { parseHoldRequest } from "../../../../lib/booking/validate";
import { limiterHash, visitorIpKey } from "../../../../lib/auth/limit";
import { holdWithCheckout } from "../../../../lib/stripe/pay";
import { paymentsOpen, stripeMode, stripeServer } from "../../../../lib/stripe/server";
import { authSigningKey, createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 32 * 1024;

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const unavailable = { ok: false, reasons: [{ code: "unavailable" }] };

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parseHoldRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  // No Stripe, or a live key while the terms are still the placeholder (B-13): nothing is held.
  const mode = stripeMode();
  const stripe = stripeServer();
  const admin = createSupabaseAdmin();
  const limitKey = authSigningKey("limit");
  if (!stripe || !paymentsOpen(mode) || !admin || !limitKey || !bookingLinkConfigured()) return reply(unavailable, 503);

  try {
    const answer = await holdWithCheckout({
      db: admin,
      stripe,
      createHold: () =>
        createWebHold(admin, parsed.value, {
          ipHash: limiterHash(limitKey, "ip", visitorIpKey(request.headers.get("x-forwarded-for"))),
          emailHash: (email) => limiterHash(limitKey, "email", email),
          isTest: mode !== "live",
        }),
      origin: bookingOrigin(request.headers.get("host"), process.env.NODE_ENV),
      locale: parsed.value.locale,
      plan: parsed.value.plan,
    });
    return reply(answer.body, answer.status);
  } catch {
    return reply(unavailable, 503);
  }
}
