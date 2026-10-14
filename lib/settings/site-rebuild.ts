// Plan 02-06: the one call that asks for a publish rebuild after a Settings save that changes the public site.
// 03.2-05 owns the rebuild: its runOps afterWrite calls requestPublish({ admin }) (lib/ops/site-update.ts) for every
// reply with `affects_site: true`, which POST /api/ops/settings sends. Until 03.2-05 is on main this is the seam the
// handler calls and the tests fake; once it lands, the handler stops calling it (afterWrite does) and this file goes.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestRebuild = (admin: SupabaseClient) => Promise<unknown>;

/** Before 03.2-05: nothing to call yet (the saved row is picked up by the next deploy's build). */
export const requestRebuild: RequestRebuild = async () => null;
