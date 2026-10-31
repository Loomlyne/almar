// Plan 05-04 (P5-09, T-05-04-02): the text Customers hands to Bookings. Browser only.
//
// The guest's email never enters a URL for this handoff, so it stays out of the address bar, the browser history and any
// shared link. Customers writes it to session storage before it opens Bookings; Bookings reads it once on mount and removes
// it at that read. Session storage is the owner's tab only and is gone with it. Every storage error is caught: a blocked
// storage means Bookings opens unfiltered, never an exception.

const KEY = "almar.ops.bookings-search";

/** Keep `text` for the next Bookings mount. Nothing is thrown when storage is blocked. */
export function putBookingsSearch(text: string): void {
  try {
    window.sessionStorage.setItem(KEY, text);
  } catch {
    // Blocked storage: Bookings simply opens without the search.
  }
}

/** Read the handed text once and remove it, or null when there is none or storage is blocked. */
export function takeBookingsSearch(): string | null {
  try {
    const text = window.sessionStorage.getItem(KEY);
    if (text === null) return null;
    window.sessionStorage.removeItem(KEY);
    return text === "" ? null : text;
  } catch {
    return null;
  }
}

/** Drop any handed text that was never taken, so a stale search cannot surface later. No caller yet. */
export function clearBookingsSearch(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Blocked storage: nothing to clear.
  }
}
