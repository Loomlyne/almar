"use client";

import { useEffect, useId, useRef } from "react";
import type { PostBlockKind } from "../../../../../components/ops/api-types";
import { MediaField } from "../../../../../components/ops/media-field";
import { ChevronIcon, PlusIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import type { OpsBlogCopy } from "../../../../../lib/copy/ops-blog";
import type { OpsKitCopy } from "../../../../../lib/copy/ops-kit";
import { BLOCK_MAX, blockName, movedBlocks, newBlock, type FormBlock } from "./post-forms";

const KINDS: readonly PostBlockKind[] = ["heading", "paragraph", "photo", "quote"];

const SQUARE =
  "inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border border-line bg-transparent p-0 text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent";

const DELETE =
  "inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-error underline decoration-1 underline-offset-4";

/**
 * The body of a post (plan 06-03, F-08; pictures signed 2026-10-27): one row per block in order, each with its kind and
 * number ("Paragraph 2"), the English input (one line for a heading, an area for a paragraph or a quote) or the photo
 * from the media library with its alt text under it, and Move up / Move down / Delete block. Under the list, four Add
 * buttons. The owner writes English; Arabic and Spanish come from the kit on Save.
 */
export function PostBlocksField({
  blocks,
  onChange,
  copy,
  kit,
  mediaLocale,
}: {
  blocks: FormBlock[];
  onChange: (next: FormBlock[]) => void;
  copy: OpsBlogCopy;
  kit: OpsKitCopy;
  mediaLocale: "en" | "ar" | "es";
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

  const set = (key: string, change: Partial<FormBlock>) => onChange(blocks.map((block) => (block.key === key ? { ...block, ...change } : block)));
  const move = (key: string, by: -1 | 1) => {
    moved.current = { key, by };
    onChange(movedBlocks(blocks, key, by));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {blocks.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label={copy.sec.body}>
          {blocks.map((block, i) => {
            const name = blockName(copy, block, i);
            const id = `${idBase}-${block.key}`;
            return (
              <li key={block.key} className="flex min-w-0 flex-col gap-3 border-b border-line pb-4 last:border-b-0 last:pb-0">
                {block.kind === "photo" ? (
                  <div className="flex flex-col gap-2">
                    <MediaField id={`${id}-photo`} label={name} value={block.media} onChange={(media) => set(block.key, { media })} locale={mediaLocale} />
                    {block.media ? (
                      <p className="m-0 text-label text-muted">
                        <span className="text-ink">{copy.alt}: </span>
                        <span lang="en" dir="ltr">
                          {block.media.alt_en}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Field
                    id={`${id}-en`}
                    label={name}
                    className="max-w-none"
                    lang="en"
                    dir="ltr"
                    maxLength={BLOCK_MAX}
                    {...(block.kind === "heading" ? { autoComplete: "off" } : { multiline: true as const, rows: block.kind === "quote" ? 3 : 5 })}
                    value={block.text.en}
                    onChange={(event: { target: { value: string } }) => set(block.key, { text: { ...block.text, en: event.target.value } })}
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    id={`${id}-up`}
                    className={SQUARE}
                    aria-label={`${kit.moveUp}, ${name}`}
                    disabled={i === 0}
                    onClick={() => move(block.key, -1)}
                  >
                    <ChevronIcon size={20} className="-rotate-90" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    id={`${id}-down`}
                    className={SQUARE}
                    aria-label={`${kit.moveDown}, ${name}`}
                    disabled={i === blocks.length - 1}
                    onClick={() => move(block.key, 1)}
                  >
                    <ChevronIcon size={20} className="rotate-90" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${DELETE} ms-2`}
                    aria-label={`${copy.deleteBlock}, ${name}`}
                    onClick={() => onChange(blocks.filter((other) => other.key !== block.key))}
                  >
                    {copy.deleteBlock}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Button key={kind} variant="secondary" onClick={() => onChange([...blocks, newBlock(kind)])}>
            <PlusIcon size={16} aria-hidden="true" />
            {copy.add[kind]}
          </Button>
        ))}
      </div>
    </div>
  );
}
