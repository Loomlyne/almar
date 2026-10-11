import { parseTranslate } from "../../../../lib/ops/translate";
import { postTranslate } from "../../../../lib/ops/translate-route";
import { opsPost } from "../../../../lib/ops/route";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseTranslate, postTranslate);
