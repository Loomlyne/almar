// Owner API, contract 5.8 (plans 03.2-04, 06-06): packages: create, edit, legs, included add-ons, delete while hidden and reorder; show/hide is /api/ops/publish.
import { getJourneys, postJourneys } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseJourneyAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getJourneys);
export const POST = opsPost(parseJourneyAction, postJourneys);
