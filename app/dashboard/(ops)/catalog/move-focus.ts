// Keyboard focus after a move in the catalog lists (review rounds 2 and 3 of PR #18). The focus loss came from the
// disabled fieldset, now removed: that removal is what the keyboard tests prove (with the fieldset back and this call
// removed, both fail; with only this call removed, Chromium keeps focus and they pass). This call is a fallback the
// tests do not prove: once the list is read back, it puts focus back on the moved row's move button, but only when
// focus was lost (on the page body, nowhere, or on a node the list replaced). A keyboard user who Tabbed on while the
// order was on its way keeps their place. DOM only, no React; the kit's table is not changed.

/**
 * True when focus has nowhere to be: no active element, the page body, or a node no longer in the document. Anything
 * else is a place the user chose (another row, a filter, the nav) and is left alone.
 */
export function focusWasLost(active: Element | null, body: Element | null): boolean {
  return active === null || active === body || !active.isConnected;
}

/**
 * Focuses the move button of the visible row whose open button reads `name`: the button for the same direction, or the
 * other one when the row reached the end and that one is disabled. `labels` are the kit's Move up / Move down words
 * (the table's buttons carry them as aria-label, the phone cards as text).
 */
export function focusMovedRow(root: HTMLElement | null, name: string, by: -1 | 1, labels: { up: string; down: string }): void {
  if (!root || !focusWasLost(document.activeElement, document.body)) return;
  const visible = (el: HTMLElement) => el.getClientRects().length > 0;
  const row = [...root.querySelectorAll<HTMLElement>("tr, li")].find(
    (el) => visible(el) && el.querySelector("button")?.textContent?.trim() === name,
  );
  if (!row) return;
  const buttons = [...row.querySelectorAll<HTMLButtonElement>("button")];
  const named = (label: string) => buttons.find((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim() === label);
  const same = named(by === 1 ? labels.down : labels.up);
  const other = named(by === 1 ? labels.up : labels.down);
  const target = same && !same.disabled ? same : other;
  target?.focus();
}
