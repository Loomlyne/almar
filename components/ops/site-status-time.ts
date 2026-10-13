// Plan 03.2-05: the time rules of the site status, shared by the server (the server status module re-exports them) and
// the status line. Pure: no React, no fetch, no env.

import type { SiteStatus } from "./api-types";

/** 20 min Workers Builds timeout + 2 min settle + deploy margin (research §1.3). */
export const UPDATING_LIMIT_MINUTES = 28;

/** A hook result recorded as "error" or "error:<reason>" means the build was never started. */
export function isHookError(result: string | null | undefined): boolean {
  return typeof result === "string" && (result === "error" || result.startsWith("error:"));
}

/**
 * The time the line shows (signed pictures: "Up to date · 14:05", "Updating since 14:02", "Update failed · 14:30"):
 * up to date = when the live site was built; updating = when the update was requested; failed = when the hook call
 * failed, or the moment the update ran out of time (requested_at + the limit). Null when unknown or unavailable (the line
 * shows no time).
 */
export function siteStatusTime(site: SiteStatus): string | null {
  if (site.state === "up_to_date") return site.built_at;
  if (site.state === "updating") return site.requested_at;
  if (site.state === "unavailable") return null;
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
