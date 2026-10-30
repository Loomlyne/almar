// Owner API, plan 06-05: the Requests list (F-10). GET ?kind=&handled=; POST handled on or off.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getRequests, postRequests } from "../../../../lib/ops/requests-handlers";
import { parseRequestsAction } from "../../../../lib/ops/validate-requests";

export const dynamic = "force-dynamic";
export const GET = opsGet(getRequests);
export const POST = opsPost(parseRequestsAction, postRequests);
