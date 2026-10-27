// Owner API, plan 06-02: About's story and values cards. POST save / delete / reorder.
import { opsPost } from "../../../../lib/ops/route";
import { postPageItems } from "../../../../lib/ops/site-pages-handlers";
import { parsePageItemAction } from "../../../../lib/ops/validate-site-pages";

export const dynamic = "force-dynamic";
export const POST = opsPost(parsePageItemAction, postPageItems);
