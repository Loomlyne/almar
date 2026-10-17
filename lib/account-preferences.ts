// Plan 02-05 (addendum 2026-10-11): language and currency follow a signed-in account.
//
// Pure: no Next import, no `window`, no React. The confirm action, the endpoint core, the client sync and the node
// tests all load it. Every value read from a cookie, a body or a row is untrusted: anything that is not exactly one
// of the allowed values is null, never repaired.

import { localePath, matchPublicPage, stripLocale, type Locale } from "./locale-path";

export type AccountCurrency = "AED" | "USD" | "EUR";
export type PreferenceFields = { locale?: Locale; currency?: AccountCurrency };

/**
 * One-shot handoff from the sign-in to the browser (the currency lives in localStorage, which the server cannot
 * write). `AED` / `USD` / `EUR`: her saved currency, copied into localStorage. `push`: a new account, so the
 * browser's current currency is sent to her profile instead. Read once on the next page, then cleared.
 */
export const PREFS_SYNC_COOKIE = "almar-prefs-sync";
export const PREFS_SYNC_MAX_AGE = 600;

/**
 * A readable hint that this browser signed in (value "1", nothing secret: the session cookie itself is HttpOnly).
 * Set by the confirm action on the public host, cleared by both sign-outs. Without it a public pick sends no request,
 * so a signed-out visitor costs no Worker call and logs nothing. A stale hint (session expired) only gets a 204.
 */
export const SIGNED_IN_HINT_COOKIE = "almar-signed-in";
/** The @supabase/ssr session cookie's own lifetime (400 days), so the hint never outlives a fresh session by much. */
export const SIGNED_IN_HINT_MAX_AGE = 400 * 24 * 60 * 60;

export function signedInHintOptions(production: boolean, maxAge: number = SIGNED_IN_HINT_MAX_AGE) {
  return { path: "/", maxAge, sameSite: "lax" as const, secure: production, httpOnly: false };
}

/**
 * Follow-up 5 (PR #6 review, finding 2): a valid public session without the hint (signed in before the hint existed,
 * or the hint expired) gets it on the next Worker request, so her picks sync without a new sign-in. The middleware
 * sets it. Not on the ops host (the hint is the public site's), not under /auth/ (the confirm action sets it and the
 * sign-out clears it; a second Set-Cookie there could undo the clear), and only on GET and HEAD.
 */
export function needsSignedInHint({
  signedIn,
  opsHost,
  method,
  path,
  hint,
}: {
  signedIn: boolean;
  opsHost: boolean;
  method: string;
  path: string;
  hint: string | undefined;
}): boolean {
  if (!signedIn || opsHost || hint === "1") return false;
  if (method !== "GET" && method !== "HEAD") return false;
  return path !== "/auth" && !path.startsWith("/auth/");
}

/** A profile row created this recently was created by this very confirmation: a new account. */
export const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

export function parseAccountLocale(value: unknown): Locale | null {
  return value === "en" || value === "ar" || value === "es" ? value : null;
}

export function parseAccountCurrency(value: unknown): AccountCurrency | null {
  return value === "AED" || value === "USD" || value === "EUR" ? value : null;
}

/**
 * The currency /account shows (02-05 review, finding 4): the one the public pages use, which is the browser choice
 * (localStorage, read through parseAccountCurrency). Her row's currency only fills an empty browser choice.
 */
export function shownAccountCurrency(browserChoice: unknown, profileCurrency: AccountCurrency): AccountCurrency {
  return parseAccountCurrency(browserChoice) ?? profileCurrency;
}

export type SyncValue = AccountCurrency | "push";

export function parseSyncValue(value: unknown): SyncValue | null {
  return value === "push" ? "push" : parseAccountCurrency(value);
}

/** True when `createdAt` (an ISO time from the row) is within the new-account window before `now`. */
export function isNewAccount(createdAt: unknown, now: number): boolean {
  if (typeof createdAt !== "string") return false;
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return false;
  return now - at >= -60_000 && now - at <= NEW_ACCOUNT_WINDOW_MS;
}

/**
 * True when this verification is the account's first sign-in: the auth user's email was confirmed by this same
 * verification (its last sign-in is within a minute of its confirmation). A later sign-in inside the new-account
 * window (a second device) is not first, so it restores her saved row instead of overwriting it.
 */
export function isFirstSignIn(user: unknown): boolean {
  if (typeof user !== "object" || user === null) return false;
  const { email_confirmed_at: confirmed, last_sign_in_at: signedIn } = user as Record<string, unknown>;
  if (typeof confirmed !== "string" || typeof signedIn !== "string") return false;
  const a = Date.parse(confirmed);
  const b = Date.parse(signedIn);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) <= 60_000;
}

/**
 * The body of POST /api/preferences: a plain object with only `locale` and/or `currency`, each allowed, at least one.
 * Anything else is null.
 */
export function parsePreferenceBody(value: unknown): PreferenceFields | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => key !== "locale" && key !== "currency")) return null;
  const record = value as Record<string, unknown>;
  const fields: PreferenceFields = {};
  if ("locale" in record) {
    const locale = parseAccountLocale(record.locale);
    if (!locale) return null;
    fields.locale = locale;
  }
  if ("currency" in record) {
    const currency = parseAccountCurrency(record.currency);
    if (!currency) return null;
    fields.currency = currency;
  }
  return fields;
}

/**
 * Where to send her after sign-in, in her language. `back` has already passed safeReturnPath (a site path). A public
 * page that exists in every locale gets her locale's URL; anything else (`/account`, `/bookings`) is unchanged.
 * A query or hash is kept.
 *
 *   ("/private-stays", "ar") -> "/ar/private-stays"      ("/es/about?x=1", "en") -> "/about?x=1"
 *   ("/account", "ar")       -> "/account"               ("/", "es")            -> "/es/"
 */
export function localizedReturnPath(back: string, locale: Locale): string {
  const cut = back.search(/[?#]/);
  const bare = cut === -1 ? back : back.slice(0, cut);
  const suffix = cut === -1 ? "" : back.slice(cut);
  const { path } = stripLocale(bare);
  if (matchPublicPage(path) === null) return back;
  try {
    return localePath(locale, path) + suffix;
  } catch {
    return back;
  }
}

/**
 * /account preference saves (PR #14 review): only the newest successful save may set the saved value and the browser
 * choice. `begin()` numbers a save. `settle()` returns `store: true` only for a success newer than every earlier success
 * (write the browser choice then); an older success arriving after a newer one changes nothing. `show` is the value to
 * put on screen, or null to leave the screen alone: the latest click shows the new value when it saved, the newest
 * saved value when it did not. An overtaken result shows nothing while the latest click is pending or saved, but once
 * the latest click has failed, a success that is the newest success is shown (the screen had fallen back to an older
 * value; the database and the browser now hold this one). `adopt()` sets the saved value without a save (the currency
 * the page opened with).
 */
export function saveTracker<T>(initial: T) {
  let generation = 0;
  let newestSaved = 0;
  let latestFailed = false;
  let saved = initial;
  return {
    begin(): number {
      generation += 1;
      latestFailed = false;
      return generation;
    },
    adopt(value: T): void {
      saved = value;
    },
    settle(ticket: number, ok: boolean, value: T): { show: T | null; store: boolean } {
      const store = ok && ticket > newestSaved;
      if (store) {
        newestSaved = ticket;
        saved = value;
      }
      if (ticket === generation) {
        latestFailed = !ok;
        return { show: saved, store };
      }
      return { show: store && latestFailed ? saved : null, store };
    },
  };
}
