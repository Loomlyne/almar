// Job 21 (owner, 2026-10-21, decisions #7 and #13): every page lives at /en/…, /ar/… or /es/….
//
//  - "/" sends the visitor to the language they chose in the language select (the almar-locale cookie), else to /en/.
//    No browser-language guessing. On Worker `almar` this runs in worker/handle.mjs before Next (no Next, a few
//    microseconds of CPU); the dev server does the same in middleware.ts.
//  - Every old unprefixed page answers 301 to its /en/ address. On Cloudflare that is public/_redirects (the static
//    asset layer answers it, no Worker call); the dev server does the same in middleware.ts with legacyLocaleTarget.
//
// A leaf module (no imports): worker/handle.mjs, middleware.ts and the node tests load it directly.

const LOCALE_COOKIE = "almar-locale";

/** The language home "/" answers with: the cookie's language when it is exactly en, ar or es, else en. */
export function rootLocaleTarget(cookieHeader: string | null | undefined): "/en/" | "/ar/" | "/es/" {
  const match = (cookieHeader ?? "").match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? match[1].trim() : "";
  return value === "ar" ? "/ar/" : value === "es" ? "/es/" : "/en/";
}

/** Headers of the "/" redirect: it depends on a cookie, so no shared cache may keep it. */
export const ROOT_REDIRECT_HEADERS = {
  "cache-control": "private, no-store",
  vary: "Cookie",
  "x-robots-tag": "noindex",
} as const;

/** The cookie name, for the node tests (lib/auth/rules.ts LOCALE_COOKIE is the same name). */
export const ROOT_LOCALE_COOKIE = LOCALE_COOKIE;

/**
 * The English sections that moved under /en/ (public/_redirects holds the same list as Cloudflare rules; the node test
 * tests/locale-redirect.test.mjs checks both agree). A section matches itself and anything below it.
 */
export const LEGACY_SECTIONS = [
  "/about",
  "/blog",
  "/contact",
  "/destinations",
  "/experiences",
  "/private-stays",
  "/login",
  "/account",
  "/bookings",
] as const;

/**
 * The /en/ address of an old unprefixed page, or null when `pathname` is not one (already prefixed, "/", an API or
 * auth path, anything else). A trailing slash is dropped. The query is the caller's to keep.
 */
export function legacyLocaleTarget(pathname: string): string | null {
  const bare = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const section of LEGACY_SECTIONS) {
    if (bare === section || bare.startsWith(`${section}/`)) return `/en${bare}`;
  }
  return null;
}
