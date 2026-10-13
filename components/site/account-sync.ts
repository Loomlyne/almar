// Plan 02-05 (addendum 2026-10-11), browser side: a pick on a public page is offered to her account, and the sign-in's
// handoff cookie copies her saved currency into the browser choice. Nothing here may block or break the page: every
// failure (offline, signed out, storage blocked, a 4xx/5xx) is swallowed; a 503 is retried once first.

import {
  PREFS_SYNC_COOKIE,
  SIGNED_IN_HINT_COOKIE,
  parseAccountCurrency,
  parseSyncValue,
  type AccountCurrency,
  type PreferenceFields,
  type SyncValue,
} from "../../lib/account-preferences";
import { CURRENCY_CHOICE_KEY } from "../../lib/currency-choice";

/** True when the sign-in left its readable hint (value "1"). Without it a pick stays in this browser. */
export function hasSignedInHint(): boolean {
  try {
    return new RegExp(`(?:^|;\\s*)${SIGNED_IN_HINT_COOKIE}=1(?:;|$)`).test(document.cookie);
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget POST /api/preferences, only when the sign-in hint is present: a signed-out visitor sends nothing.
 * The server still writes only for a real session (a stale hint gets a 204). `keepalive` lets it
 * finish while a language pick navigates away; `same-origin` referrer policy keeps a real Origin header on it even if
 * a page sets `no-referrer`. A 503 (the save failed on the server) is sent once more (02-05b); any other answer, a
 * second 503 or a network error is dropped. A retry needs the first answer to arrive while this page is still open:
 * a language pick that has already navigated away cannot retry. Never awaited by a caller.
 */
export function postPreferences(fields: PreferenceFields): void {
  if (!hasSignedInHint()) return;
  sendPreferences(JSON.stringify(fields), true);
}

function sendPreferences(body: string, retryOn503: boolean): void {
  try {
    void fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "same-origin",
      referrerPolicy: "same-origin",
      keepalive: true,
    })
      .then((response) => {
        if (retryOn503 && response.status === 503) sendPreferences(body, false);
      })
      .catch(() => undefined);
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
