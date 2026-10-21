// POST /api/booking/hold: the guest's 30-minute hold (plan 04-02). The server prices the stay again and stores that
// price; the browser's numbers are not read. 200 with the booking reference, the hold's end, a signed link token and the
// transfer window the request will get (plan 04-08); 409 with the reasons when the stay cannot be booked as asked; 429
// when the guest has asked too often; 400 for a body that is not a hold request; 403 for a foreign origin; 503 when the
// server or the link secret is not ready, and 503 requests_closed while the request gate is closed (before any write).
// TEST comes from the Host header, never from the body. Nothing is logged: no body, no email, no phone. The booking id
// never leaves the server.
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { readJsonBody } from "../../../../lib/booking/http";
import { isAllowedPostOrigin } from "../../../../lib/booking/origin";
import { currentRequestGate } from "../../../../lib/booking/gate-server";
import { createWebHold, holdStatus } from "../../../../lib/booking/server";
import { parseHoldRequest } from "../../../../lib/booking/validate";
import { limiterHash, visitorIpKey } from "../../../../lib/auth/limit";
import { authSigningKey, createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 32 * 1024;

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const unavailable = { ok: false, reasons: [{ code: "unavailable" }] };
const requestsClosed = { ok: false, reasons: [{ code: "requests_closed" }] };

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parseHoldRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  const limitKey = authSigningKey("limit");
  if (!admin || !limitKey || !bookingLinkConfigured()) return reply(unavailable, 503);

  try {
    // The request gate (plan 04-08), before the quote and the limiter: a closed gate writes nothing.
    const gate = await currentRequestGate(admin, request.headers.get("host"));
    if (!gate.open) return reply(requestsClosed, 503);
    const outcome = await createWebHold(admin, parsed.value, {
      ipHash: limiterHash(limitKey, "ip", visitorIpKey(request.headers.get("x-forwarded-for"))),
      emailHash: (email) => limiterHash(limitKey, "email", email),
      isTest: gate.isTest,
      transferWindowMinutes: gate.windowMinutes,
    });
    return reply(outcome.response, holdStatus(outcome.response));
  } catch {
    return reply(unavailable, 503);
  }
}
