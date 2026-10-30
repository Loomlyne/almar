// Owner API, plan 06-02: header and footer links (CMS-09). GET both areas and the pages a link may point to; POST one area.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getNav, postNav } from "../../../../lib/ops/site-pages-handlers";
import { parseNavSave } from "../../../../lib/ops/validate-site-pages";

export const dynamic = "force-dynamic";
export const GET = opsGet(getNav);
export const POST = opsPost(parseNavSave, postNav);
