// Plan 02-05 (addendum 2026-10-11), browser side: a pick on a public page is offered to her account, and the sign-in's
// handoff cookie copies her saved currency into the browser choice. Nothing here may block or break the page: every
// failure (offline, signed out, storage blocked, a 4xx/5xx) is swallowed.

import {
  PREFS_SYNC_COOKIE,
  parseAccountCurrency,
  parseSyncValue,
  type AccountCurrency,
  type PreferenceFields,
  type SyncValue,
} from "../../lib/account-preferences";
import { CURRENCY_CHOICE_KEY } from "../../lib/currency-choice";

/**
 * Fire-and-forget POST /api/preferences. The server writes only when she is signed in (else 204). `keepalive` lets it
 * finish while a language pick navigates away; `same-origin` referrer policy keeps a real Origin header on it even if
 * a page sets `no-referrer`. Never awaited by a caller.
 */
export function postPreferences(fields: PreferenceFields): void {
  try {
    void fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
      credentials: "same-origin",
      referrerPolicy: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // fetch itself threw (very old browser, blocked): the pick still applies in this browser.
  }
}

function readSyncCookie(): string | null {
  const matched = document.cookie.match(new RegExp(`(?:^|;\\s*)${PREFS_SYNC_COOKIE}=([^;]*)`));
  if (!matched) return null;
  try {
    return decodeURIComponent(matched[1] ?? "");
  } catch {
    return null;
  }
}

function clearSyncCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PREFS_SYNC_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Writes her currency into the browser choice the public pages read. */
export function storeCurrencyChoice(currency: string): void {
  const checked = parseAccountCurrency(currency);
  if (!checked) return;
  try {
    window.localStorage.setItem(CURRENCY_CHOICE_KEY, checked);
  } catch {
    // Storage blocked: nothing to sync into.
  }
}

/** The browser's current currency choice, or null. */
export function readCurrencyChoice(): AccountCurrency | null {
  try {
    return parseAccountCurrency(window.localStorage.getItem(CURRENCY_CHOICE_KEY));
  } catch {
    return null;
  }
}

/**
 * Runs once on a page's first mount, before the currency provider reads localStorage (a child's effect runs before
 * its parent's). A currency value: her saved currency becomes the browser choice. `push`: a new account, so the
 * browser's current choice (if any) is sent to her profile. The cookie is cleared either way. Returns what it read.
 */
export function applyAccountSync(): SyncValue | null {
  const raw = readSyncCookie();
  if (raw === null) return null;
  clearSyncCookie();
  const value = parseSyncValue(raw);
  if (value === null) return null;
  if (value !== "push") {
    storeCurrencyChoice(value);
    return value;
  }
  const currency = readCurrencyChoice();
  if (currency) postPreferences({ currency });
  return value;
}
