// Plan 02-05 (addendum 2026-10-11): at sign-in, her account's language and currency follow her into this browser.
// Called by the confirm action right after verifyOtp; no Next import, so node tests drive it with a fake client or a
// local-stack session.
//
// A returning account: almar-locale := her saved language, and her saved currency goes to the browser in the one-shot
// almar-prefs-sync cookie (the currency lives in localStorage, which the server cannot write). A new account (its row
// was made by this very confirmation, so it holds only the defaults) keeps what she was already using: the browser's
// language is saved to her row, and almar-prefs-sync = "push" asks the browser to send its currency. On the ops host
// there are no public pages, so no sync cookie is set there.

import { LOCALE_COOKIE } from "./auth/rules";
import {
  PREFS_SYNC_COOKIE,
  PREFS_SYNC_MAX_AGE,
  isNewAccount,
  parseAccountCurrency,
  parseAccountLocale,
} from "./account-preferences";
import { saveOwnPreferences, type ProfilesUpdate } from "./preferences-route";
import type { Locale } from "./locale-path";

export type FollowCookieOptions = { path: "/"; maxAge: number; sameSite: "lax"; secure?: boolean };

type RowClient = {
  from: (table: "profiles") => ProfilesUpdate & {
    select: (columns: "locale, currency, created_at") => {
      eq: (column: "id", value: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/** Returns the language to send her back in, or null. Never throws: a failure here must not cost her the sign-in. */
export async function followAccount({
  client,
  userId,
  readCookie,
  setCookie,
  ops,
  now,
  production,
}: {
  client: unknown;
  userId: string | undefined;
  readCookie: (name: string) => string | undefined;
  setCookie: (name: string, value: string, options: FollowCookieOptions) => void;
  ops: boolean;
  now: number;
  production: boolean;
}): Promise<Locale | null> {
  if (!userId) return null;
  try {
    const db = client as RowClient;
    const { data, error } = await db.from("profiles").select("locale, currency, created_at").eq("id", userId).maybeSingle();
    if (error || !data || typeof data !== "object") return null;
    const row = data as { locale?: unknown; currency?: unknown; created_at?: unknown };
    const sync: FollowCookieOptions = { path: "/", maxAge: PREFS_SYNC_MAX_AGE, sameSite: "lax", secure: production };

    if (isNewAccount(row.created_at, now)) {
      const browser = parseAccountLocale(readCookie(LOCALE_COOKIE));
      if (browser && browser !== row.locale) await saveOwnPreferences(db, userId, { locale: browser });
      if (!ops) setCookie(PREFS_SYNC_COOKIE, "push", sync);
      return browser ?? parseAccountLocale(row.locale);
    }

    const locale = parseAccountLocale(row.locale);
    const currency = parseAccountCurrency(row.currency);
    // Same flags as every other almar-locale write (account actions, LocaleSelect).
    if (locale) setCookie(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    if (currency && !ops) setCookie(PREFS_SYNC_COOKIE, currency, sync);
    return locale;
  } catch {
    return null;
  }
}
