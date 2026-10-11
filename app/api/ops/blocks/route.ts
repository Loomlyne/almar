// Owner API, contract 5.4 (plan 03.2-04): availability blocks for one stay, one destination or everything.
import { getBlocks, postBlocks } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseBlockAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getBlocks);
export const POST = opsPost(parseBlockAction, postBlocks);
