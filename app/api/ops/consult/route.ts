// Owner API, plan 06-05: the consultation setup (F-04). GET the hours, days off, notice and horizon; POST save | cancel.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getConsult, postConsult } from "../../../../lib/ops/requests-handlers";
import { parseConsultAction } from "../../../../lib/ops/validate-requests";

export const dynamic = "force-dynamic";
export const GET = opsGet(getConsult);
export const POST = opsPost(parseConsultAction, postConsult);
