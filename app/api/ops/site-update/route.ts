// Owner API, contract §6 (plan 03.2-05): "Try again" fires the public-site update once more. POST `{}` only.
import { opsPost } from "../../../../lib/ops/route";
import { parseSiteUpdate, postSiteUpdate } from "../../../../lib/ops/site-update";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseSiteUpdate, postSiteUpdate);
