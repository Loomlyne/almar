import { cn } from "../../lib/cn";

/**
 * Closed block set, plain text only, plus a photo (plan 06-03, F-08). The text blocks are structurally identical to
 * lib/data PostBlock (components/ui imports nothing from lib/data); the photo takes the resolved address and alt text.
 */
export type RichTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; id: string }
  | { type: "quote"; text: string }
  | { type: "photo"; src: string; alt: string; width: number | null; height: number | null };

/**
 * A body from typed blocks: paragraph, heading with an anchor id, pull quote, photo. No HTML is ever injected. `quote`: "tint"
 * is the post's pull quote; "line" is the legal page's (pictures 06-04): a gold line at its start, 20px display.
 */
export function RichText({ blocks, className, quote = "tint" }: { blocks: RichTextBlock[]; className?: string; quote?: "tint" | "line" }) {
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
        if (block.type === "photo") {
          // Square, the full width of the text column, no caption (F-08 has none); the alt is the media library's.
          return (
            <figure key={index} className="m-0 w-full">
              <img
                src={block.src}
                alt={block.alt}
                width={block.width ?? undefined}
                height={block.height ?? undefined}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rounded-none bg-ivory object-cover"
              />
            </figure>
          );
        }
        if (block.type === "quote") {
          if (quote === "line") {
            return (
              <blockquote key={index} className="m-0 border-s border-gold ps-5">
                <p className="m-0 font-display text-title text-teal">{block.text}</p>
              </blockquote>
            );
          }
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
