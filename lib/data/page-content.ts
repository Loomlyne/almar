// lib/data/page-content.ts (plan 06-02, Task 5)
//
// Server only. What the five editable public pages read from the Pages CMS at build (F-09, CMS-07, SITE-02): which
// sections are shown, the words of the sections whose text lived in a copy file (lib/copy/*-page.ts, the `copy`
// textFrom of lib/data/page-sections.ts), and the page hero's photo and video. Sections whose words live in a fixture
// block (home hero, welcome and gallery; About hero and intro) keep coming through ./page-blocks, in the same shapes.
//
// Fixtures mode: every section shown, the copy files' own words, the hero as today (no video, no new photo), so the
// pages' HTML is unchanged. Supabase mode (after `await loadSource()`, anon views only): `shown` is the sections the
// published view holds (a hidden section is absent), each copy-held column comes from the section's published record in
// the locale (English when that locale has none); a section with no record at all keeps the copy file's words, so a
// row imported without text never blanks the page. The section order stays the code's: nothing here reorders.

import { ABOUT_PAGE_COPY } from "../copy/about-page";
import { CONTACT_PAGE_COPY } from "../copy/contact-page";
import { DESTINATIONS_PAGE_COPY } from "../copy/destinations-page";
import { EXPERIENCES_PAGE_COPY } from "../copy/experiences-page";
import { HOME_PAGE_COPY } from "../copy/home-page";
import { PAGE_SECTIONS, type PageKey, type SectionSpec } from "./page-sections";
import { image, type RawImage, type StoredStatus } from "./resolve";
import { dataSource, loadSource, readSource } from "./source";
import type { ImageRef, Locale } from "./types";

export type SectionWords = Record<string, string | string[]>;

export type PageContent = {
  /** The sections on the site, by key (PAGE_SECTIONS names). */
  shown: ReadonlySet<string>;
  /** Per copy-held section: its columns resolved for the locale. */
  text: Partial<Record<string, SectionWords>>;
  /** The page's hero (its first section): the photo of its single image slot, and its https video, when set. */
  hero: { image: ImageRef | null; video_url: string | null };
};

type SectionRow = { id: string; page: string; section: string; video_url: string | null };
type SectionTextRow = { section_id: string; locale: Locale; status: StoredStatus } & Record<string, unknown>;
type MediaRow = { section_id: string; slot: string; position: number; image: RawImage };

/** The copy objects the `copy` textFrom names (module -> export), read for fixtures mode and the no-record fallback. */
const COPY_MODULES: Record<string, Record<string, Record<Locale, unknown>>> = {
  "home-page": { HOME_PAGE_COPY },
  "about-page": { ABOUT_PAGE_COPY },
  "destinations-page": { DESTINATIONS_PAGE_COPY },
  "experiences-page": { EXPERIENCES_PAGE_COPY },
  "contact-page": { CONTACT_PAGE_COPY },
};

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((at, key) => (at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined), value);
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let at = target;
  for (const part of parts.slice(0, -1)) {
    const next = at[part];
    // Copy on the way down: the copy objects are shared module values and are never mutated.
    at[part] = next && typeof next === "object" && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    at = at[part] as Record<string, unknown>;
  }
  at[parts[parts.length - 1]!] = value;
}

/** A copy-held section's words as the copy file has them today. */
function copyWords(spec: SectionSpec, locale: Locale): SectionWords {
  if (spec.textFrom?.kind !== "copy") return {};
  const source = COPY_MODULES[spec.textFrom.module]?.[spec.textFrom.name]?.[locale];
  const out: SectionWords = {};
  for (const [column, path] of Object.entries(spec.textFrom.paths)) {
    const value = getPath(source, path);
    if (typeof value === "string" || Array.isArray(value)) out[column] = value as string | string[];
  }
  return out;
}

/** The section's published record in the locale, else the English one; none -> null. */
function recordFor(rows: readonly SectionTextRow[], locale: Locale): SectionTextRow | null {
  const published = rows.filter((row) => row.status === "published");
  return published.find((row) => row.locale === locale) ?? published.find((row) => row.locale === "en") ?? null;
}

export async function getPageContent(page: PageKey, locale: Locale): Promise<PageContent> {
  await loadSource();
  const specs = PAGE_SECTIONS[page];
  const heroSpec = specs[0];
  if (dataSource() === "fixtures") {
    const text: Partial<Record<string, SectionWords>> = {};
    for (const spec of specs) if (spec.textFrom?.kind === "copy") text[spec.section] = copyWords(spec, locale);
    return { shown: new Set(specs.map((spec) => spec.section)), text, hero: { image: null, video_url: null } };
  }

  const sections = readSource<SectionRow[]>("page-sections").filter((row) => row.page === page);
  const bySection = new Map(sections.map((row) => [row.section, row]));
  const texts = readSource<SectionTextRow[]>("page-section-translations");
  const text: Partial<Record<string, SectionWords>> = {};
  for (const spec of specs) {
    if (spec.textFrom?.kind !== "copy") continue;
    const row = bySection.get(spec.section);
    if (!row) continue;
    const record = recordFor(
      texts.filter((t) => t.section_id === row.id),
      locale,
    );
    if (!record) {
      text[spec.section] = copyWords(spec, locale);
      continue;
    }
    const words: SectionWords = {};
    for (const column of Object.keys(spec.textFrom.paths)) {
      const value = record[column];
      words[column] = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value : "";
    }
    text[spec.section] = words;
  }

  const heroRow = heroSpec ? bySection.get(heroSpec.section) : undefined;
  const single = heroSpec?.media.find((slot) => !slot.many);
  const media = heroRow && single ? readSource<MediaRow[]>("page-section-media").filter((m) => m.section_id === heroRow.id && m.slot === single.slot) : [];
  const first = media.slice().sort((a, b) => a.position - b.position)[0];
  return {
    shown: new Set(sections.map((row) => row.section)),
    text,
    hero: { image: first ? image(first.image, locale) : null, video_url: heroRow?.video_url ?? null },
  };
}

/**
 * `copy` with the copy-held words of `page` put in at the paths PAGE_SECTIONS names (a new object; `copy` is not
 * changed). The page components keep passing their copy objects down as before: same strings in fixtures mode.
 */
export function withPageWords<T>(copy: T, page: PageKey, content: PageContent): T {
  const out = { ...(copy as Record<string, unknown>) };
  for (const spec of PAGE_SECTIONS[page]) {
    if (spec.textFrom?.kind !== "copy") continue;
    const words = content.text[spec.section];
    if (!words) continue;
    for (const [column, path] of Object.entries(spec.textFrom.paths)) {
      if (column in words) setPath(out, path, words[column]);
    }
  }
  return out as T;
}
