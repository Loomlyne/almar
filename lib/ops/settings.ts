// Plan 02-06: the bindings app/api/ops/settings/route.ts uses (route files import lib/ops only). The handlers are pure
// in lib/settings/handlers.ts; here they get the live FX loader. A save answering affects_site: true is followed by
// opsPost's afterWrite (03.2-05, lib/ops/route.ts), like every other owner write.
import { loadRates } from "../fx/rates";
import { getSettings, postSettings } from "../settings/handlers";
import type { OwnerContext } from "../auth/require-owner";
import type { SettingsSave } from "../settings/validate";

export { parseSettingsSave } from "../settings/validate";

export const getSettingsRoute = ({ owner }: { owner: OwnerContext }) => getSettings({ owner, loadRates });
export const postSettingsRoute = ({ owner, body }: { owner: OwnerContext; body: SettingsSave }) =>
  postSettings({ owner, body });
