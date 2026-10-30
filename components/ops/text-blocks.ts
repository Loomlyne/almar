// The pure side of the text blocks kit piece (plan 06-04): a block as form state, its field name, its name on screen, moving
// it. No React, no fetch, no directive. Text blocks are named by their key, `block_<k>` (the translate route's name rule),
// not their place, so a lock stays on its block when blocks move (as lib post-forms.ts does for a post's body).

import type { Locale3 } from "./api-types";
import type { Target } from "./auto-translate";

export type TextBlockKind = "heading" | "paragraph" | "quote";

export type TextBlock = {
  /** The block's identity while blocks are added, moved and removed, and its translate field name (block_<k>). */
  key: string;
  kind: TextBlockKind;
  /** "" = not set. */
  text: Record<Locale3, string>;
  /** The Arabic and Spanish texts the owner fixed by hand. */
  locked: Record<Target, boolean>;
};

let count = 0;
export const textBlockKey = () => `block_${++count}`;

export function newTextBlock(kind: TextBlockKind): TextBlock {
  return { key: textBlockKey(), kind, text: { en: "", ar: "", es: "" }, locked: { ar: false, es: false } };
}

/** "Paragraph 2": the kind's word and the block's number. */
export const textBlockName = (words: Record<TextBlockKind, string>, block: Pick<TextBlock, "kind">, index: number) => `${words[block.kind]} ${index + 1}`;

/** The list after moving one block up or down; out of range: unchanged. */
export function movedTextBlocks(blocks: readonly TextBlock[], key: string, by: -1 | 1): TextBlock[] {
  const at = blocks.findIndex((b) => b.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= blocks.length) return [...blocks];
  const next = [...blocks];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}
