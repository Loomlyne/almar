// Plan 03.2-05 (contract §6, research §1.3): what the dashboard says about the public site. Pure: no Next, no fetch, no
// env, so node tests load it and the status line (a client component) can use siteStatusTime().
//
// The truth is the sequence: the database's site_publish.requested_seq goes up on every write that reaches the site,
// and the live site's /site-version.json carries the sequence it was built from (scripts/build-live.mjs). Live at or
// past the request = up to date. Behind = updating, for at most UPDATING_LIMIT_MINUTES, unless the deploy hook call
// itself failed; past that, or after a failed hook call, failed (the owner sees Try again).

import type { SiteStatus } from "../../components/ops/api-types";

export type { SiteStatus };

/** 20 min Workers Builds timeout + 2 min settle + deploy margin (research §1.3). */
export const UPDATING_LIMIT_MINUTES = 28;

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

/** A hook result recorded as "error" or "error:<reason>" means the build was never started. */
export function isHookError(result: string | null | undefined): boolean {
  return typeof result === "string" && (result === "error" || result.startsWith("error:"));
}

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

/**
 * The time the line shows (signed pictures: "Up to date · 14:05", "Updating since 14:02", "Update failed · 14:30"):
 * up to date = when the live site was built; updating = when the update was requested; failed = when the hook call
 * failed, or the moment the update ran out of time (requested_at + the limit). Null when unknown (the line shows no time).
 */
export function siteStatusTime(site: SiteStatus): string | null {
  if (site.state === "up_to_date") return site.built_at;
  if (site.state === "updating") return site.requested_at;
  if (isHookError(site.last_hook_result) && site.last_hook_at) return site.last_hook_at;
  if (!site.requested_at) return null;
  const at = Date.parse(site.requested_at);
  return Number.isNaN(at) ? null : new Date(at + UPDATING_LIMIT_MINUTES * 60_000).toISOString();
}

/** "14:05": 24-hour UAE time, Western digits in every language (lib/format.ts westernDigits; dashboard rule). */
export function formatSiteTime(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
