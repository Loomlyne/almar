// Owner API, plan 06-02: the public pages' sections (CMS-07). GET ?page= / ?id=, POST saves one section.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getPages, postPages } from "../../../../lib/ops/site-pages-handlers";
import { parsePageSave } from "../../../../lib/ops/validate-site-pages";

export const dynamic = "force-dynamic";
export const GET = opsGet(getPages);
export const POST = opsPost(parsePageSave, postPages);
