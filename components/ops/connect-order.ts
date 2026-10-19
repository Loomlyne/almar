// The order of a ConnectPicker's connected list when the screen turns ordering on (03.2-07, owner 2026-10-17:
// Move up / Move down on a stay's experiences and services). Pure, so node tests hold it.

/** Whether two neighbours may trade places; without it every neighbour may. */
export type CanSwap = (above: string, below: string) => boolean;

/** Whether `id` can move one place up (-1) or down (1): not past an end, and only with a neighbour it may swap with. */
export function canMove(ids: readonly string[], id: string, by: -1 | 1, canSwap?: CanSwap): boolean {
  const at = ids.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ids.length) return false;
  const [above, below] = by === -1 ? [ids[to]!, id] : [id, ids[to]!];
  return canSwap ? canSwap(above, below) : true;
}

/** `ids` with `id` moved one place; the same list (same array) when it cannot move. */
export function moveConnected(ids: readonly string[], id: string, by: -1 | 1, canSwap?: CanSwap): readonly string[] {
  if (!canMove(ids, id, by, canSwap)) return ids;
  const at = ids.indexOf(id);
  const next = [...ids];
  [next[at], next[at + by]] = [next[at + by]!, next[at]!];
  return next;
}
