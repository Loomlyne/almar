// Owner API, plan 06-04: legal pages and the cookie banner (F-07, F-05). GET list | ?kind=; POST save. Publish: /api/ops/publish.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getLegal, postLegal } from "../../../../lib/ops/legal-handlers";
import { LEGAL_BODY_LIMIT, parseLegalSave } from "../../../../lib/ops/validate-legal";

export const dynamic = "force-dynamic";
export const GET = opsGet(getLegal);
// A legal page's blocks need more than the 64 KiB default; the cap is read after the owner and Origin checks.
export const POST = opsPost(parseLegalSave, postLegal, { bodyLimit: LEGAL_BODY_LIMIT });
