// Plan 02-06: the saved settings for code that runs at request time (the public Worker's maintenance gate, the ops
// shell, the sign-in email). Read with the anon key from api_site_settings. A good read is kept in this isolate; a
// caller may reuse it for SITE_SETTINGS_CACHE_MS (the email) or read every time (the gate, the ops shell).
// A failed read never replaces a good one (PR #14 review): it returns the last good settings, so a closed site stays
// closed through a Supabase blip. Only when there never was a good read (or nothing is configured) is the answer null:
// callers then fall back to the design system and an open site (an outage must not close sign-in on its own).

import { brandColor, fetchSiteSettings, LOGO_KEY, type PublicSiteSettings } from "./site-settings";
import { mediaUrl } from "./data/media";
import type { EmailBrand } from "./email/magic-link";

export const SITE_SETTINGS_CACHE_MS = 30_000;

type FetchLike = Parameters<typeof fetchSiteSettings>[2];
export type SiteSettingsEnv = { url?: string; anonKey?: string };

/** The last good read in this isolate (never a failed one). */
let cached: { at: number; settings: PublicSiteSettings } | null = null;

/** The two public Supabase values this runtime reads (Worker secrets on the edge, .dev.vars locally). */
export function siteSettingsEnv(): SiteSettingsEnv {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() };
}

/**
 * The saved settings. `maxAgeMs` 0 always reads (the maintenance gate and the ops shell: a save shows on the next
 * request); the default reuses a good read for 30 s (the sign-in email). A failed read returns the last good settings,
 * or null when there never was one.
 */
export async function readSiteSettings(
  env: SiteSettingsEnv,
  { now = Date.now(), fetcher, maxAgeMs = SITE_SETTINGS_CACHE_MS }: { now?: number; fetcher?: FetchLike; maxAgeMs?: number } = {},
): Promise<PublicSiteSettings | null> {
  if (maxAgeMs > 0 && cached && now - cached.at < maxAgeMs) return cached.settings;
  if (!env.url || !env.anonKey) return null;
  try {
    const settings = await fetchSiteSettings(env.url, env.anonKey, fetcher);
    cached = { at: now, settings };
    return settings;
  } catch {
    return cached?.settings ?? null;
  }
}

/**
 * The saved logo straight from the image host, for surfaces rendered at request time (the ops shell, the sign-in email,
 * the closed page the public Worker answers): a /brand/ copy exists only after the next publish rebuild. Null when no
 * logo is saved.
 */
export function logoMediaUrl(logoKey: string | null): string | null {
  if (logoKey === null) return null;
  if (!LOGO_KEY.test(logoKey)) throw new Error("logoMediaUrl: not a media key");
  return mediaUrl(logoKey);
}

/** The values the sign-in email takes from the saved settings (lib/email/magic-link.ts EmailBrand), or null. */
export function emailBrand(settings: PublicSiteSettings | null): EmailBrand | null {
  if (!settings) return null;
  return {
    teal: brandColor(settings, "teal"),
    white: brandColor(settings, "white"),
    ivory: brandColor(settings, "ivory"),
    ink: brandColor(settings, "charcoal"),
    titleFace: settings.titleFace,
    bodyFace: settings.bodyFace,
    logoUrl: logoMediaUrl(settings.logoKey),
  };
}

/** For node tests only. */
export const __testing = {
  reset(): void {
    cached = null;
  },
};
