// GET /api/consult/slots?from=&to= (plan 06-05, SITE-06): the free 30-minute starts, read live, so a change in Content ->
// Consultation shows on the next request with no rebuild. Rules: lib/site-requests/submit.ts handleConsultSlotsGet.

import { realDeps } from "../../../../lib/site-requests/real-deps";
import { handleConsultSlotsGet } from "../../../../lib/site-requests/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleConsultSlotsGet(new URL(request.url), realDeps());
}
