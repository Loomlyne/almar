// Owner API, contract 5.6 (plan 03.2-04): experiences and services, one list (D-89).
import { getCatalog, postCatalog } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseCatalogAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getCatalog);
export const POST = opsPost(parseCatalogAction, postCatalog);
