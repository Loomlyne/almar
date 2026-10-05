// Owner API, contract 5.7 (plan 03.2-04): team members (imports empty, C-17).
import { getTeam, postTeam } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseTeamAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getTeam);
export const POST = opsPost(parseTeamAction, postTeam);
