// Owner API (plan 02-06): Settings. GET reads site_settings, her language and currency and the live FX row; POST saves
// them (contrast gate, logo checks) and answers affects_site: true when the public site needs a publish rebuild.
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getSettingsRoute, parseSettingsSave, postSettingsRoute } from "../../../../lib/ops/settings";

export const dynamic = "force-dynamic";
export const GET = opsGet(getSettingsRoute);
export const POST = opsPost(parseSettingsSave, postSettingsRoute);
