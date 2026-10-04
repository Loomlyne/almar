import { cn } from "../../lib/cn";

/** Closed block set, plain text only. Structurally identical to lib/data PostBlock (components/ui imports nothing from lib/data). */
export type RichTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; id: string }
  | { type: "quote"; text: string };

/** A body from typed blocks: paragraph, heading with an anchor id, pull quote. No HTML is ever injected. */
export function RichText({ blocks, className }: { blocks: RichTextBlock[]; className?: string }) {
  return (
    <div className={cn("grid gap-6", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index} id={block.id} className="m-0 scroll-mt-rail-offset font-display text-heading text-teal">
              {block.text}
            </h2>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={index} className="m-0 bg-teal-tint p-6">
              <p className="m-0 font-display text-heading text-teal">{block.text}</p>
            </blockquote>
          );
        }
        return (
          <p key={index} className="m-0 max-w-prose text-body text-ink">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
