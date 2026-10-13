// Plan 03.2-05 (contract §6, research §1.3): what the dashboard says about the public site. Pure: no Next, no fetch, no
// env, so node tests load it and the status line (a client component) can use siteStatusTime().
//
// The truth is the sequence: the database's site_publish.requested_seq goes up on every write that reaches the site,
// and the live site's /site-version.json carries the sequence it was built from (scripts/build-live.mjs). Live at or
// past the request = up to date. Behind = updating, for at most UPDATING_LIMIT_MINUTES, unless the deploy hook call
// itself failed; past that, or after a failed hook call, failed (the owner sees Try again).

import type { SiteStatus } from "../../components/ops/api-types";
import { UPDATING_LIMIT_MINUTES, isHookError } from "../../components/ops/site-status-time";

export type { SiteStatus };
// The pure time rules are shared with the status line (a client file may not import lib/ops: tests/ops-kit.test.mjs).
export { UPDATING_LIMIT_MINUTES, formatSiteTime, isHookError, siteStatusTime } from "../../components/ops/site-status-time";

/** site_publish_state(): the singleton row (migration 20261005100000). */
export type PublishState = {
  requested_seq: number;
  requested_at: string | null;
  last_hook_at: string | null;
  last_hook_result: string | null;
  last_build_uuid?: string | null;
};

/** What /site-version.json says; a 404 is `{ seq: 0, built_at: null }`; null = it could not be read. */
export type LiveVersion = { seq: number; built_at: string | null } | null;

function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : (now.getTime() - at) / 60_000;
}

export function computeSiteStatus(state: PublishState, live: LiveVersion, now: Date): SiteStatus {
  const requested = Number(state.requested_seq) || 0;
  const liveSeq = live ? Number(live.seq) || 0 : 0;
  const base = {
    requested_seq: requested,
    live_seq: liveSeq,
    requested_at: state.requested_at ?? null,
    built_at: live?.built_at ?? null,
    last_hook_at: state.last_hook_at ?? null,
    last_hook_result: state.last_hook_result ?? null,
  };
  if (liveSeq >= requested) return { state: "up_to_date", ...base };
  if (isHookError(state.last_hook_result)) return { state: "failed", ...base };
  if (minutesSince(state.requested_at, now) < UPDATING_LIMIT_MINUTES) return { state: "updating", ...base };
  return { state: "failed", ...base };
}
