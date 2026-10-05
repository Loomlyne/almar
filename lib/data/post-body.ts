// lib/data/post-body.ts
//
// Pure helpers for blog posts: no fs, no value imports, so node tests can load this file directly.

import type { Locale, PostBlock } from "./types";

export const WORDS_PER_MINUTE = 200;

const KINDS = new Set(["paragraph", "heading", "quote"]);

/** Validates a stored body and assigns heading ids section-1..n. Throws (fails the build) on anything else. */
export function parseBody(json: unknown): PostBlock[] {
  if (!Array.isArray(json)) throw new Error("post body: not an array");
  let headings = 0;
  return json.map((item, i) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`post body[${i}]: not an object`);
    }
    const { type, text } = item as { type?: unknown; text?: unknown };
    if (typeof type !== "string" || !KINDS.has(type)) {
      throw new Error(`post body[${i}]: unknown block type ${JSON.stringify(type)}`);
    }
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error(`post body[${i}]: empty or missing text`);
    }
    if (type === "heading") {
      headings += 1;
      return { type: "heading", text, id: `section-${headings}` } as PostBlock;
    }
    return { type, text } as PostBlock;
  });
}

/** Minutes to read: words / 200, rounded up, at least 1. Word count by Intl.Segmenter for the locale. */
export function readingMinutes(blocks: readonly PostBlock[], locale: Locale): number {
  const seg = new Intl.Segmenter(locale, { granularity: "word" });
  let words = 0;
  for (const b of blocks) for (const s of seg.segment(b.text)) if (s.isWordLike) words += 1;
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
