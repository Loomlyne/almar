// Plan 02-06: maintenance on the server paths of the public host. The static pages are closed by the publish rebuild
// (scripts/assemble-cloudflare.mjs); the pages the public Worker renders itself (/login, /account, /bookings) read the
// flag on each request instead, so they close on Save even before the rebuild finishes. The ops host is never closed.
//
// The flag is read with the anon key from api_site_settings and kept for MAINTENANCE_CACHE_MS in this isolate. A failed
// read leaves the page open (the static site follows the last good build; a Supabase outage must not close sign-in on
// its own). Pure apart from the injected fetch: middleware.ts binds it, node tests fake it.

import { fetchSiteSettings, logoPath, brandStyle, type PublicSiteSettings } from "./site-settings";
import { renderMaintenancePage, type MaintenanceLocale } from "./maintenance-document";

/** The HTML pages of the public Worker that maintenance closes (lib/server-routes.ts SERVER_PATHS_OUTSIDE_API). */
export const MAINTENANCE_SERVER_PATHS: readonly string[] = ["/login", "/account", "/bookings"];

export const MAINTENANCE_CACHE_MS = 30_000;

export function closesOnMaintenance(path: string): boolean {
  const bare = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return MAINTENANCE_SERVER_PATHS.includes(bare);
}

type Cached = { at: number; settings: PublicSiteSettings | null };
let cached: Cached | null = null;

type FetchLike = Parameters<typeof fetchSiteSettings>[2];

/** The saved settings, or null when they cannot be read (then nothing closes). */
export async function readGateSettings(
  env: { url?: string; anonKey?: string },
  now: number = Date.now(),
  fetcher?: FetchLike,
): Promise<PublicSiteSettings | null> {
  if (cached && now - cached.at < MAINTENANCE_CACHE_MS) return cached.settings;
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

function pageLocale(cookieLocale: string | undefined): MaintenanceLocale {
  return cookieLocale === "ar" || cookieLocale === "es" ? cookieLocale : "en";
}

/** The closed page as a 503 (Retry-After an hour, never cached), or null when this request stays open. */
export async function maintenanceResponse({
  path,
  opsHost,
  cookieLocale,
  env,
  now,
  fetcher,
}: {
  path: string;
  opsHost: boolean;
  cookieLocale: string | undefined;
  env: { url?: string; anonKey?: string };
  now?: number;
  fetcher?: FetchLike;
}): Promise<Response | null> {
  if (opsHost || !closesOnMaintenance(path)) return null;
  const settings = await readGateSettings(env, now, fetcher);
  if (!settings?.maintenance) return null;
  const html = renderMaintenancePage(pageLocale(cookieLocale), { logoSrc: logoPath(settings.logoKey), brandStyle: brandStyle(settings) });
  return new Response(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "3600",
      "x-robots-tag": "noindex",
    },
  });
}

/** For node tests only. */
export const __testing = {
  reset(): void {
    cached = null;
  },
};
