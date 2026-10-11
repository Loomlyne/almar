// Owner API, contract 5.2 (plan 03.2-04). Logic: lib/ops/catalog-handlers.ts; owner, Origin and body rules: lib/ops/route.ts.
import { getStays, postStays } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseStayAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getStays);
export const POST = opsPost(parseStayAction, postStays);
