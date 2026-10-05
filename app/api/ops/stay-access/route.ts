// Owner API, contract 5.5 (plan 03.2-04): a stay's private access details (C-14). Owner only, no-store, never logged.
import { getStayAccess, postStayAccess } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseAccessSave } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getStayAccess);
export const POST = opsPost(parseAccessSave, postStayAccess);
