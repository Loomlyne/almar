// Owner API, contract 5.9 (plan 03.2-04): publish and unpublish with the publish rules. POST only. 03.2-05 adds the site update.
import { postPublish } from "../../../../lib/ops/catalog-handlers";
import { opsPost } from "../../../../lib/ops/route";
import { parsePublish } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const POST = opsPost(parsePublish, postPublish);
