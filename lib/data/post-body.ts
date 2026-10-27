// lib/data/post-body.ts
//
// Pure helpers for blog posts: no fs, no value imports, so node tests can load this file directly.

import type { ImageRef, Locale, PostBodyBlock } from "./types";

export const WORDS_PER_MINUTE = 200;

const KINDS = new Set(["paragraph", "heading", "quote"]);

/**
 * Validates a stored body and assigns heading ids section-1..n. Throws (fails the build) on anything else. A photo block
 * (`{ type: "photo", image }`, plan 06-03) is accepted only through `toImage`, the caller's resolver of the stored image
 * (alt text in the page's language); without one, or when it returns null, the photo throws like any bad block.
 */
export function parseBody(json: unknown, toImage?: (raw: unknown) => ImageRef | null): PostBodyBlock[] {
  if (!Array.isArray(json)) throw new Error("post body: not an array");
  let headings = 0;
  return json.map((item, i) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`post body[${i}]: not an object`);
    }
    const { type, text } = item as { type?: unknown; text?: unknown };
    if (type === "photo") {
      const image = toImage ? toImage((item as { image?: unknown }).image) : null;
      if (!image) throw new Error(`post body[${i}]: a photo with no image`);
      return { type: "photo", image };
    }
    if (typeof type !== "string" || !KINDS.has(type)) {
      throw new Error(`post body[${i}]: unknown block type ${JSON.stringify(type)}`);
    }
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error(`post body[${i}]: empty or missing text`);
    }
    if (type === "heading") {
      headings += 1;
      return { type: "heading", text, id: `section-${headings}` } as PostBodyBlock;
    }
    return { type, text } as PostBodyBlock;
  });
}

/** Minutes to read: words / 200, rounded up, at least 1. Word count by Intl.Segmenter for the locale; photos have none. */
export function readingMinutes(blocks: readonly PostBodyBlock[], locale: Locale): number {
  const seg = new Intl.Segmenter(locale, { granularity: "word" });
  let words = 0;
  for (const b of blocks) {
    if (b.type === "photo") continue;
    for (const s of seg.segment(b.text)) if (s.isWordLike) words += 1;
  }
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const TAGS: Record<Locale, string> = { en: "en-US", ar: "ar-AE-u-nu-latn", es: "es" };

/** "Jun 1, 2025" / "1 يونيو 2025" / "1 jun 2025", from an ISO timestamp, in UTC. */
export function dateLabel(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TAGS[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}
