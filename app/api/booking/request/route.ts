// POST /api/booking/request { ref, t }: the guest sends the request for their live hold (plan 04-08, B-23). The signed
// link token is the only key. 200 with the reference, the status, the pay-by deadline, whether this was the first time
// and whether the guest's email was sent; 404 with the same body for a wrong token, an unknown reference or a TEST/real
// mismatch; 409 hold_ended, blocked or sold_out; 429 too_many_open; 503 requests_closed while the request gate is closed
// (before any write) or unavailable when the server cannot answer; 400 for a body that is not a request; 403 for a
// foreign origin; 413 over 4 KB. TEST comes from the Host header, never from the body. An email never changes the
// answer. Nothing is logged. The booking id never leaves the server.
import { currentRequestGate } from "../../../../lib/booking/gate-server";
import { readJsonBody } from "../../../../lib/booking/http";
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { getNotifier } from "../../../../lib/booking/notify";
import { isAllowedPostOrigin, originForBooking } from "../../../../lib/booking/origin";
import { requestAlreadySent, requestBooking } from "../../../../lib/booking/server";
import { parseRequestRequest } from "../../../../lib/booking/validate";
import { createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 4 * 1024;

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const unavailable = { ok: false, reasons: [{ code: "unavailable" }] };
const requestsClosed = { ok: false, reasons: [{ code: "requests_closed" }] };

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parseRequestRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  if (!admin || !bookingLinkConfigured()) return reply(unavailable, 503);
  try {
    // The request gate before any write: a closed gate places no new request. It guards a booking still held only:
    // a replay of a request already sent goes on to request_web_booking's idempotent answer (first_time false, nothing
    // written, no mail), so a guest whose first answer was lost is never told "closed" (PR #34 review).
    const gate = await currentRequestGate(admin, request.headers.get("host"));
    if (!gate.open && !(await requestAlreadySent(admin, parsed.value, gate.isTest))) return reply(requestsClosed, 503);
    const outcome = await requestBooking(admin, parsed.value, { isTest: gate.isTest, origin: originForBooking(gate.isTest), notifier: getNotifier() });
    return reply(outcome.response, outcome.status);
  } catch {
    return reply(unavailable, 503);
  }
}
