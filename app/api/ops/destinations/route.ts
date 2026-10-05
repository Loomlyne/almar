// Owner API, contract 5.1 (plan 03.2-04). Logic: lib/ops/catalog-handlers.ts; owner, Origin and body rules: lib/ops/route.ts.
import { getDestinations, postDestinations } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseDestinationAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getDestinations);
export const POST = opsPost(parseDestinationAction, postDestinations);
