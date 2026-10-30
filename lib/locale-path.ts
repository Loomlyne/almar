// The one place that builds a locale URL (phase 3.3 design 5.1 and 5.3).
//
// A leaf module on purpose: no value imports, so plain Node (the assembler, node tests) loads it directly.

export const LOCALES = ["en", "ar", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar" || value === "es";
}

export function localeDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Every locale has its prefix (owner, 2026-10-21, decision #13): /en/…, /ar/…, /es/…. "/" itself is the Worker's language redirect. */
const PREFIXED = LOCALES;

/** A path is "plain" when it is a site-absolute path with no origin, query, hash, backslash or empty segment. */
function assertPlainPath(path: string): void {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(`locale path must start with a single "/": ${JSON.stringify(path)}`);
  }
  if (path.includes("//") || path.includes("://") || path.includes("\\") || path.includes("?") || path.includes("#")) {
    throw new Error(`locale path must be a plain path: ${JSON.stringify(path)}`);
  }
  if (path !== "/" && path.endsWith("/")) {
    throw new Error(`locale path must not end in "/" (except "/"): ${JSON.stringify(path)}`);
  }
  if (PREFIXED.some((l) => path === `/${l}` || path.startsWith(`/${l}/`))) {
    throw new Error(`locale path is already locale-prefixed: ${JSON.stringify(path)}`);
  }
}

/**
 * The URL of a page in a locale, in the form the server serves without a redirect.
 *
 *   "/"  ->  "/en/", "/ar/", "/es/"            "/private-stays"  ->  "/en/private-stays", "/ar/private-stays", ...
 *
 * Every locale is prefixed since job 21 (owner, 2026-10-21, decision #13); a bare "/" is answered by the Worker, which
 * sends the visitor to the language in the almar-locale cookie (else /en/), and every old unprefixed page URL answers
 * 301 to its /en/ address (public/_redirects).
 *
 * The trailing slash on a locale home and its absence on a page are BOTH required. Measured 2026-10-02
 * against Cloudflare static assets with html_handling = "auto-trailing-slash": individual files are served
 * without a trailing slash and folder index files with one, so "/ar/about/" answers 307 to "/ar/about" and
 * "/ar" answers 307 to "/ar/". Do not "fix" the asymmetry: every language link, canonical, og:url and
 * hreflang goes through here so a language switch never costs a redirect.
 *
 * Throws on anything that is not a plain site path (no "//", "://", "\", "?", "#", no trailing slash, not
 * already prefixed), so a crafted value can never become a protocol-relative URL or an open redirect.
 */
export function localePath(locale: Locale, path: string): string {
  if (!isLocale(locale)) throw new Error(`unknown locale: ${JSON.stringify(locale)}`);
  assertPlainPath(path);
  return path === "/" ? `/${locale}/` : `/${locale}${path}`;
}

/**
 * Inverse of localePath. Lenient about a trailing slash. "/arabic" is not "/ar" + "bic". An unprefixed path (an old
 * address, before job 21) reads as English.
 */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  let locale: Locale = "en";
  let rest = pathname;
  for (const l of PREFIXED) {
    if (rest === `/${l}` || rest.startsWith(`/${l}/`)) {
      locale = l;
      rest = rest.slice(l.length + 1) || "/";
      break;
    }
  }
  if (rest.length > 1 && rest.endsWith("/")) rest = rest.replace(/\/+$/, "") || "/";
  return { locale, path: rest };
}

export function switchLocalePath(pathname: string, target: Locale): string {
  return localePath(target, stripLocale(pathname).path);
}

/** The three URLs of one page, for the language select and the footer language row. */
export function localeHrefs(path: string): Record<Locale, string> {
  return { en: localePath("en", path), ar: localePath("ar", path), es: localePath("es", path) };
}

/**
 * The pages that exist in all three locales. A later slice that converts a page appends its pattern here;
 * nothing else changes. `[param]` matches one segment of [a-z0-9-]+.
 */
export const PUBLIC_PAGES = [
  "/",
  "/private-stays",
  "/private-stays/[stay]",
  "/about",
  "/contact",
  "/blog",
  "/blog/[post]",
  "/destinations",
  "/experiences",
  // Plan 04-03 (Q-06): the trip page, in every locale, noindex and out of the sitemap (scripts/crawl-files.mjs NOT_PUBLIC).
  "/booking/trip",
  "/bookings/trip", // Plan 04-05 (Task 5): the guest's booking page, noindex and out of the sitemap (NOT_PUBLIC has bookings).
  "/legal/[legal]", // Plan 06-04: a legal page exists only once published in all three languages (lib/data/legal.ts).
] as const;

/**
 * The guest pages the public Worker renders itself (lib/server-routes.ts): prefixed like every page since job 21, but
 * never static, never in the sitemap and without hreflang (noindex). Phase 4 pages under /bookings live at
 * /<locale>/bookings/… (app/[locale]/bookings/…).
 */
export const GUEST_PAGES = ["/login", "/account", "/bookings"] as const;

/** True for a guest page or a page under /bookings (Phase 4), English path without a query. */
export function isGuestPage(path: string): boolean {
  return (GUEST_PAGES as readonly string[]).includes(path) || path.startsWith("/bookings/");
}

const PARAM = /^[a-z0-9-]+$/;

export function matchPublicPage(path: string): (typeof PUBLIC_PAGES)[number] | null {
  const parts = path.split("/").slice(1);
  for (const pattern of PUBLIC_PAGES) {
    const want = pattern.split("/").slice(1);
    if (pattern === "/") {
      if (path === "/") return pattern;
      continue;
    }
    if (want.length !== parts.length) continue;
    const ok = want.every((seg, i) =>
      seg.startsWith("[") && seg.endsWith("]") ? PARAM.test(parts[i]) : seg === parts[i],
    );
    if (ok) return pattern;
  }
  return null;
}

/**
 * Link target for an internal page. Only pages that exist in every locale (PUBLIC_PAGES and the guest pages) are
 * localised; anything else keeps its path as given. A trailing "?query" or "#hash" is kept and does not take part in
 * the match.
 */
export function siteHref(locale: Locale, path: string): string {
  const cut = path.search(/[?#]/);
  const bare = cut === -1 ? path : path.slice(0, cut);
  const suffix = cut === -1 ? "" : path.slice(cut);
  if (matchPublicPage(bare) === null && !isGuestPage(bare)) return path;
  return localePath(locale, bare) + suffix;
}

export const SITE_ORIGIN = "https://almarprivatejourney.com";

export function absoluteLocaleUrl(locale: Locale, path: string): string {
  return `${SITE_ORIGIN}${localePath(locale, path)}`;
}

/** canonical plus the four alternates (en, ar, es, x-default -> en), absolute, in the served form. */
export function localeAlternates(
  locale: Locale,
  path: string,
): { canonical: string; languages: { en: string; ar: string; es: string; "x-default": string } } {
  if (matchPublicPage(path) === null) {
    throw new Error(`no alternates for ${JSON.stringify(path)}: it is not in PUBLIC_PAGES (English-only page)`);
  }
  return {
    canonical: absoluteLocaleUrl(locale, path),
    languages: {
      en: absoluteLocaleUrl("en", path),
      ar: absoluteLocaleUrl("ar", path),
      es: absoluteLocaleUrl("es", path),
      "x-default": absoluteLocaleUrl("en", path),
    },
  };
}
