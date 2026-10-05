// POST /api/booking/quote: the live quote with every reason (plan 04-02). Money comes from the server's own pricing,
// never from the page. 200 with the answer (also when it says "not bookable": the reasons are content), 400 for a body
// that is not a quote request, 403 for a foreign origin, 503 when the server cannot answer. Nothing is logged: no body,
// no email, no phone.
import { readJsonBody } from "../../../../lib/booking/http";
import { isAllowedPostOrigin } from "../../../../lib/booking/origin";
import { quoteBooking } from "../../../../lib/booking/server";
import { parseQuoteRequest } from "../../../../lib/booking/validate";
import { createSupabaseAdmin } from "../../../../lib/supabase/clients";

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
  const parsed = parseQuoteRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);

  const admin = createSupabaseAdmin();
  if (!admin) return reply(unavailable, 503);
  try {
    return reply(await quoteBooking(admin, parsed.value), 200);
  } catch {
    return reply(unavailable, 503);
  }
}
