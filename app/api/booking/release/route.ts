// POST /api/booking/release { ref, t }: the guest drops their own hold (plan 04-02), for "Change" and the deposit/full
// switch. The signed link token is the only key; a wrong token, an unknown reference and a malformed one all answer 404
// with the same body. 200 { ok: true } also when the booking was no longer held. 400 for a body that is not a release
// request; 403 for a foreign origin; 503 when the server cannot answer. 04-04 adds expiring the returned Checkout
// Sessions at Stripe. Nothing is logged.
import { readJsonBody } from "../../../../lib/booking/http";
import { isAllowedPostOrigin } from "../../../../lib/booking/origin";
import { releaseWebHold } from "../../../../lib/booking/server";
import { parseReleaseRequest } from "../../../../lib/booking/validate";
import { createSupabaseAdmin } from "../../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 4 * 1024;

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parseReleaseRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  if (!admin) return reply({ ok: false, reasons: [{ code: "unavailable" }] }, 503);
  try {
    const released = await releaseWebHold(admin, parsed.value);
    return released.ok ? reply({ ok: true }, 200) : reply({ ok: false }, 404);
  } catch {
    return reply({ ok: false, reasons: [{ code: "unavailable" }] }, 503);
  }
}
