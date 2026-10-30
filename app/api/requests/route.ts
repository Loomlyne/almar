// POST /api/requests (plan 06-05): Plan with us and List with us; 06-06 adds the package request in lib/site-requests/route-kinds.ts.
// The order of refusals and the save and email are lib/site-requests/submit.ts's. No per-kind code here.

import { realDeps } from "../../../lib/site-requests/real-deps";
import { REQUEST_PREPARE, REQUEST_ROUTE_KINDS } from "../../../lib/site-requests/route-kinds";
import { handleSiteRequestPost } from "../../../lib/site-requests/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleSiteRequestPost(request, realDeps(), REQUEST_ROUTE_KINDS, REQUEST_PREPARE);
}
