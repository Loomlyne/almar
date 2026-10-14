// Plan 02-06: the bindings app/api/ops/settings/route.ts uses (route files import lib/ops only). The handlers are pure
// in lib/settings/handlers.ts; here they get the live FX loader and the publish-rebuild seam.
import { loadRates } from "../fx/rates";
import { getSettings, postSettings } from "../settings/handlers";
import { requestRebuild } from "../settings/site-rebuild";
import type { OwnerContext } from "../auth/require-owner";
import type { SettingsSave } from "../settings/validate";

export { parseSettingsSave } from "../settings/validate";

export const getSettingsRoute = ({ owner }: { owner: OwnerContext }) => getSettings({ owner, loadRates });
export const postSettingsRoute = ({ owner, body }: { owner: OwnerContext; body: SettingsSave }) =>
  postSettings({ owner, body, requestRebuild });
