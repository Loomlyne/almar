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

const PREFIXED = ["ar", "es"] as const;

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
 *   en:       "/"  ->  "/"               "/private-stays"  ->  "/private-stays"
 *   ar / es:  "/"  ->  "/ar/"            "/private-stays"  ->  "/ar/private-stays"
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
  if (locale === "en") return path;
  return path === "/" ? `/${locale}/` : `/${locale}${path}`;
}

/** Inverse of localePath. Lenient about a trailing slash. "/arabic" is not "/ar" + "bic". */
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
export const PUBLIC_PAGES = ["/", "/private-stays", "/private-stays/[stay]", "/about", "/contact", "/blog", "/blog/[post]"] as const;

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
 * Link target for an internal page. Only pages that exist in every locale are localised; an English-only
 * page keeps its English URL, so an Arabic page links to /about, never to the dead /ar/about.
 * A trailing "?query" or "#hash" is kept and does not take part in the match.
 */
export function siteHref(locale: Locale, path: string): string {
  const cut = path.search(/[?#]/);
  const bare = cut === -1 ? path : path.slice(0, cut);
  const suffix = cut === -1 ? "" : path.slice(cut);
  if (matchPublicPage(bare) === null) return path;
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
