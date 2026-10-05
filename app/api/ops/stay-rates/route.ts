// Owner API, contract 5.3 (plan 03.2-04): base rate, date-range rates, per-night preview. Never affects the site.
import { getStayRates, postStayRates } from "../../../../lib/ops/catalog-handlers";
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { parseRateAction } from "../../../../lib/ops/validate-catalog";

export const dynamic = "force-dynamic";
export const GET = opsGet(getStayRates);
export const POST = opsPost(parseRateAction, postStayRates);
