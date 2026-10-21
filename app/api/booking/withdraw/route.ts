// POST /api/booking/withdraw { ref, t? }: the guest withdraws an unpaid request (plan 04-08, P-19). The access rule of
// the view: the signed link token when the body has one, else the signed-in guest's email. 200 with the reference, the
// status cancelled and whether this was the first time; 404 with the same body for a wrong token, an unknown reference,
// no matching session or a TEST/real mismatch; 409 part_paid or not_withdrawable; 400 for a body that is not a withdraw
// request; 403 for a foreign origin; 413 over 4 KB; 503 when the server cannot answer. No request gate: a withdraw works
// while requests are closed. TEST comes from the Host header, never from the body. The owner's notice never changes the
// answer. Nothing is logged. The booking id never leaves the server.
import { readJsonBody } from "../../../../lib/booking/http";
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { getNotifier } from "../../../../lib/booking/notify";
import { isAllowedPostOrigin, isTestHost } from "../../../../lib/booking/origin";
import { withdrawBooking } from "../../../../lib/booking/server";
import { parseWithdrawRequest } from "../../../../lib/booking/validate";
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
  const parsed = parseWithdrawRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  if (!admin || !bookingLinkConfigured()) return reply(unavailable, 503);
  try {
    const isTest = isTestHost(request.headers.get("host"));
    // The session is read only when the body has no token: with one, the token is the only door.
    const readSession = parsed.value.t === undefined ? readSessionProfile : undefined;
    const outcome = await withdrawBooking(admin, parsed.value, { isTest, readSession, notifier: getNotifier() });
    return reply(outcome.response, outcome.status);
  } catch {
    return reply(unavailable, 503);
  }
}
