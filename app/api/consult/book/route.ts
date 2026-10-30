// POST /api/consult/book (plan 06-05, SITE-06): books one slot, then the two emails with the .ics. Rules:
// lib/site-requests/submit.ts handleConsultBookPost and bookConsultation.

import { realDeps } from "../../../../lib/site-requests/real-deps";
import { handleConsultBookPost } from "../../../../lib/site-requests/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleConsultBookPost(request, realDeps());
}
