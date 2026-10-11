// Owner API, contract 5.8 (plan 03.2-04): the three home journeys (C-15): edit and reorder; show/hide is /api/ops/publish.
import { getJourneys, postJourneys } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseJourneyAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getJourneys);
export const POST = opsPost(parseJourneyAction, postJourneys);
