// Plan 02-06: maintenance on the server paths of the public host. The static pages are closed by the publish rebuild
// (scripts/assemble-cloudflare.mjs); the pages the public Worker renders itself (/login, /account, /bookings) read the
// flag on each request instead, so they close on Save even before the rebuild finishes. The ops host is never closed.
//
// The flag is read with the anon key from api_site_settings and kept for MAINTENANCE_CACHE_MS in this isolate. A failed
// read leaves the page open (the static site follows the last good build; a Supabase outage must not close sign-in on
// its own). Pure apart from the injected fetch: middleware.ts binds it, node tests fake it.

import { brandStyle, WORDMARK_PATH, type fetchSiteSettings } from "./site-settings";
import { logoMediaUrl, readSiteSettings, __testing as readTesting, SITE_SETTINGS_CACHE_MS } from "./site-settings-read";
import { renderMaintenancePage, type MaintenanceLocale } from "./maintenance-document";

/** The HTML pages of the public Worker that maintenance closes (lib/server-routes.ts SERVER_PATHS_OUTSIDE_API). */
export const MAINTENANCE_SERVER_PATHS: readonly string[] = ["/login", "/account", "/bookings"];

export const MAINTENANCE_CACHE_MS = SITE_SETTINGS_CACHE_MS;

export function closesOnMaintenance(path: string): boolean {
  const bare = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return MAINTENANCE_SERVER_PATHS.includes(bare);
}

type FetchLike = Parameters<typeof fetchSiteSettings>[2];

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
  const settings = await readSiteSettings(env, { now, fetcher });
  if (!settings?.maintenance) return null;
  // The saved logo straight from R2: a /brand/ copy exists only after the next publish rebuild.
  const logoSrc = logoMediaUrl(settings.logoKey) ?? WORDMARK_PATH;
  const html = renderMaintenancePage(pageLocale(cookieLocale), { logoSrc, brandStyle: brandStyle(settings) });
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
    readTesting.reset();
  },
};
