// Owner API (plan 04-09): GET and POST the money Settings (balance due days, transfer window, bank details) through
// ops_get_money_settings and ops_save_money_settings. The only route that answers bank values, to the owner only.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getMoneyRoute, parseMoneySave, postMoneyRoute } from "../../../../lib/ops/money-settings";

export const dynamic = "force-dynamic";
export const GET = opsGet(getMoneyRoute);
export const POST = opsPost(parseMoneySave, postMoneyRoute);
