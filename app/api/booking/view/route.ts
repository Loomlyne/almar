// POST /api/booking/view { ref, t?, locale? }: the guest's booking page (plan 04-08, BOOK-08). The signed link token is
// the only key when the body has one; without it the signed-in guest's email must be the booking's. 200 with the
// booking; 404 with the same body for a wrong token, an unknown reference, no matching session or a TEST/real mismatch;
// 400 for a body that is not a view request; 403 for a foreign origin; 413 over 4 KB; 503 when the server cannot answer.
// TEST comes from the Host header, never from the body. Nothing is logged. The booking id never leaves the server.
import { readJsonBody } from "../../../../lib/booking/http";
import { bookingLinkConfigured } from "../../../../lib/booking/link";
import { isAllowedPostOrigin, isTestHost } from "../../../../lib/booking/origin";
import { viewBooking } from "../../../../lib/booking/server";
import { parseViewRequest } from "../../../../lib/booking/validate";
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
  const parsed = parseViewRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  if (!admin || !bookingLinkConfigured()) return reply(unavailable, 503);
  try {
    const isTest = isTestHost(request.headers.get("host"));
    // The session is read only when the body has no token: with one, the token is the only door.
    const readSession = parsed.value.t === undefined ? readSessionProfile : undefined;
    const view = await viewBooking(admin, parsed.value, { isTest, readSession });
    return view.ok ? reply(view, 200) : reply({ ok: false }, 404);
  } catch {
    return reply(unavailable, 503);
  }
}
