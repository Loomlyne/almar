// Keyboard focus after a move in the catalog lists (review round 2 of PR #18). A fallback: the focus loss came from the
// disabled fieldset (removed), and in Chromium focus stays on the moved row's button on its own; its bite check (this
// call removed) did not fail, 2026-10-15. Kept for a browser that re-places the focused row's node: once the list is
// read back, the view puts focus back on the moved row's move button. DOM only, no React; the kit's table is not changed.

/**
 * Focuses the move button of the visible row whose open button reads `name`: the button for the same direction, or the
 * other one when the row reached the end and that one is disabled. `labels` are the kit's Move up / Move down words
 * (the table's buttons carry them as aria-label, the phone cards as text).
 */
export function focusMovedRow(root: HTMLElement | null, name: string, by: -1 | 1, labels: { up: string; down: string }): void {
  if (!root) return;
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
  if (target && document.activeElement !== target) target.focus();
}
