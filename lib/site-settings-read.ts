// Plan 02-06: the saved settings for code that runs at request time (the public Worker's maintenance gate, the ops
// shell, the sign-in email). Read with the anon key from api_site_settings, kept for SITE_SETTINGS_CACHE_MS in this
// isolate. A failed or unconfigured read gives null: callers fall back to the design system (a Supabase outage must not
// close sign-in, blank the dashboard or stop an email).

import { fetchSiteSettings, type PublicSiteSettings } from "./site-settings";

export const SITE_SETTINGS_CACHE_MS = 30_000;

type FetchLike = Parameters<typeof fetchSiteSettings>[2];
export type SiteSettingsEnv = { url?: string; anonKey?: string };

let cached: { at: number; settings: PublicSiteSettings | null } | null = null;

/** The two public Supabase values this runtime reads (Worker secrets on the edge, .dev.vars locally). */
export function siteSettingsEnv(): SiteSettingsEnv {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() };
}

/**
 * The saved settings, or null when they cannot be read. `maxAgeMs` 0 always reads (the ops shell: one owner, and a save
 * must show on her next page); the default keeps a read for 30 s (public sign-in paths, emails).
 */
export async function readSiteSettings(
  env: SiteSettingsEnv,
  { now = Date.now(), fetcher, maxAgeMs = SITE_SETTINGS_CACHE_MS }: { now?: number; fetcher?: FetchLike; maxAgeMs?: number } = {},
): Promise<PublicSiteSettings | null> {
  if (maxAgeMs > 0 && cached && now - cached.at < maxAgeMs) return cached.settings;
  let settings: PublicSiteSettings | null = null;
  if (env.url && env.anonKey) {
    try {
      settings = await fetchSiteSettings(env.url, env.anonKey, fetcher);
    } catch {
      settings = null;
    }
  }
  cached = { at: now, settings };
  return settings;
}

/** For node tests only. */
export const __testing = {
  reset(): void {
    cached = null;
  },
};
