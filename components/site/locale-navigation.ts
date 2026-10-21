// Job 21 (owner, 2026-10-21, decisions #7 and #13): every page lives at /en/…, /ar/… or /es/…, so a language pick on a
// page the Worker renders (sign-in, account, bookings) is a navigation to the same page in the other language, like the
// public pages' select. The pick is remembered in the almar-locale cookie, which "/" reads to send a returning visitor to
// that language (worker/handle.mjs). Browser only.

import { isLocale, switchLocalePath, type Locale } from "../../lib/locale-path";

/** The cookie the language select writes and "/" reads (lib/auth/rules.ts LOCALE_COOKIE, same name). */
const LOCALE_COOKIE = "almar-locale";

export function rememberLocale(next: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Remember `next` and open this page in it, keeping the query and the hash. Anything but en, ar, es is ignored. */
export function goToLocale(next: string): void {
  if (!isLocale(next)) return;
  rememberLocale(next);
  const { pathname, search, hash } = window.location;
  let target: string;
  try {
    target = switchLocalePath(pathname, next);
  } catch {
    target = switchLocalePath("/", next);
  }
  window.location.assign(`${target}${search}${hash}`);
}
