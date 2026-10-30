"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronIcon } from "../icons/icons";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { LINK_BUTTON_DANGER, RemoveMark } from "../ui/link";
import { cn } from "../../lib/cn";
import type { OpsKitCopy } from "../../lib/copy/ops-kit";
import { movedTextBlocks, newTextBlock, textBlockName, type TextBlock, type TextBlockKind } from "./text-blocks";

const SQUARE =
  "inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border border-line bg-transparent p-0 text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent";


export type TextBlocksCopy = {
  /** The list's name for a screen reader. */
  list: string;
  /** "Heading", "Paragraph", "Quote": with the number, a block's name. */
  kinds: Record<TextBlockKind, string>;
  add: Record<TextBlockKind, string>;
  remove: string;
  /** Said when the list is empty. */
  empty: string;
};

/**
 * A list of text blocks (plan 06-04; pictures signed 2026-10-30): one row per block in order, its kind and number, the
 * English input (one line for a heading, an area for a paragraph or a quote), Move up / Move down / Remove block, and under
 * the list one Add button per kind in `kinds`. The owner writes English; Arabic, Spanish and their locks are the kit editor's
 * translation boxes, by each block's key. Controlled: the parent owns the list.
 */
export function TextBlocksField({
  blocks,
  onChange,
  kinds,
  copy,
  kit,
  maxLength,
}: {
  blocks: TextBlock[];
  onChange: (next: TextBlock[]) => void;
  kinds: readonly TextBlockKind[];
  copy: TextBlocksCopy;
  kit: Pick<OpsKitCopy, "moveUp" | "moveDown">;
  maxLength: number;
}) {
  const idBase = useId();
  // The block just moved: focus returns to its move button once React has put the row in its new place.
  const moved = useRef<{ key: string; by: -1 | 1 } | null>(null);
  useEffect(() => {
    if (!moved.current) return;
    const { key, by } = moved.current;
    moved.current = null;
    const same = document.getElementById(`${idBase}-${key}-${by === 1 ? "down" : "up"}`) as HTMLButtonElement | null;
    const other = document.getElementById(`${idBase}-${key}-${by === 1 ? "up" : "down"}`) as HTMLButtonElement | null;
    (same && !same.disabled ? same : other)?.focus();
  });

  const setText = (block: TextBlock, value: string) => onChange(blocks.map((b) => (b.key === block.key ? { ...b, text: { ...b.text, en: value } } : b)));
  const move = (key: string, by: -1 | 1) => {
    moved.current = { key, by };
    onChange(movedTextBlocks(blocks, key, by));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {blocks.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label={copy.list}>
          {blocks.map((block, i) => {
            const name = textBlockName(copy.kinds, block, i);
            const id = `${idBase}-${block.key}`;
            return (
              <li key={block.key} className="flex min-w-0 flex-col gap-3 border-b border-line pb-4 last:border-b-0 last:pb-0">
                <Field
                  id={`${id}-en`}
                  label={name}
                  className="max-w-none"
                  lang="en"
                  dir="ltr"
                  maxLength={maxLength}
                  {...(block.kind === "heading" ? { autoComplete: "off" } : { multiline: true as const, rows: block.kind === "quote" ? 3 : 5 })}
                  value={block.text.en}
                  onChange={(event: { target: { value: string } }) => setText(block, event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" id={`${id}-up`} className={SQUARE} aria-label={`${kit.moveUp}, ${name}`} disabled={i === 0} onClick={() => move(block.key, -1)}>
                    <ChevronIcon size={20} className="-rotate-90" aria-hidden="true" />
                  </button>
                  <button type="button" id={`${id}-down`} className={SQUARE} aria-label={`${kit.moveDown}, ${name}`} disabled={i === blocks.length - 1} onClick={() => move(block.key, 1)}>
                    <ChevronIcon size={20} className="rotate-90" aria-hidden="true" />
                  </button>
                  <button type="button" className={cn(LINK_BUTTON_DANGER, "ms-0")} aria-label={`${copy.remove}, ${name}`} onClick={() => onChange(blocks.filter((other) => other.key !== block.key))}>
                    <RemoveMark />
                    {copy.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 text-pretty text-body text-muted">{copy.empty}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <Button key={kind} variant="secondary" onClick={() => onChange([...blocks, newTextBlock(kind)])}>
            {copy.add[kind]}
          </Button>
        ))}
      </div>
    </div>
  );
}
