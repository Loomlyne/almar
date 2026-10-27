// lib/data/page-blocks.ts (plan 06-01, Task 4)
//
// Server only, internal to lib/data. The page blocks the home, About and /destinations readers take: the same objects
// `home.json`, `about.json`, `destinations-page.json` and their `-translations` files hold. Fixtures mode reads those
// files unchanged. Supabase mode (build time, anon key, C-04) rebuilds the same shapes from the published views of
// migration 20261025120000 (api_page_sections, api_page_section_translations, api_page_section_media, api_page_items,
// api_page_item_translations) and lib/data/page-sections.ts: while every section is shown, the result deep-equals the
// fixture (the import copied it there). A hidden section is absent from the views; its block then comes back empty
// (no photos, no text records) and 06-02 draws the hide. Home's `tiers` are not here: they stay on the journey-tier views.
//
// Callers `await loadSource()` first, as for readSource.

import { PAGE_SECTIONS, type PageKey, type SectionSpec } from "./page-sections";
import type { RawImage, StoredStatus } from "./resolve";
import { dataSource, readFixtureFile, readSource } from "./source";
import type { Locale } from "./types";

/** The pages whose blocks live in a fixture file today, and that file's name. */
const FIXTURE_FILE = { home: "home", about: "about", destinations: "destinations-page" } as const;
export type BlockPage = keyof typeof FIXTURE_FILE;

type SectionRow = { id: string; page: string; section: string; video_url: string | null };
type SectionTextRow = { section_id: string; locale: Locale; status: StoredStatus } & Record<string, unknown>;
type MediaRow = { section_id: string; slot: string; position: number; is_decorative: boolean; image: RawImage };
type ItemRow = Record<string, unknown> & { id: string; section: string; position: number };
type ItemTextRow = { card_id: string; locale: Locale; status: StoredStatus; title: string; body: string };

type Rec = { locale: Locale; status: StoredStatus } & Record<string, unknown>;

/** A dotted path inside a fixture block ("hero.poster" -> the first segment is the block key, the rest its field). */
function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let at = target;
  for (const part of parts.slice(0, -1)) {
    if (!at[part] || typeof at[part] !== "object") at[part] = {};
    at = at[part] as Record<string, unknown>;
  }
  at[parts[parts.length - 1]!] = value;
}

/** Everything the views hold for one page, keyed by section name. */
function pageRows(page: PageKey) {
  const sections = readSource<SectionRow[]>("page-sections").filter((row) => row.page === page);
  const bySection = new Map(sections.map((row) => [row.section, row]));
  const ids = new Set(sections.map((row) => row.id));
  const texts = readSource<SectionTextRow[]>("page-section-translations").filter((row) => ids.has(row.section_id));
  const media = readSource<MediaRow[]>("page-section-media").filter((row) => ids.has(row.section_id));
  return { bySection, texts, media };
}

/** A slot's photos in the owner's order: a list for a `many` slot, the photo or null for a single one. */
function slotValue(spec: SectionSpec, slot: string, rows: readonly MediaRow[]): RawImage | RawImage[] | null {
  const images = rows
    .filter((row) => row.slot === slot)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.image);
  const many = spec.media.find((m) => m.slot === slot)?.many ?? false;
  return many ? images : (images[0] ?? null);
}

/** One section's text records in the fixture form: locale, status and only the section's own columns. */
function textRecords(spec: SectionSpec, rows: readonly SectionTextRow[]): Rec[] {
  return rows
    .slice()
    .sort((a, b) => LOCALE_ORDER.indexOf(a.locale) - LOCALE_ORDER.indexOf(b.locale))
    .map((row) => {
      const record: Rec = { locale: row.locale, status: row.status };
      for (const column of spec.text) {
        const value = row[column];
        if (value !== null && value !== undefined) record[column] = value;
      }
      return record;
    });
}

const LOCALE_ORDER: readonly Locale[] = ["en", "ar", "es"];

/**
 * The page's photo blocks in the fixture shape (`home.json` without `tiers`, `about.json`, `destinations-page.json`).
 * Home heroes also carry `video_url` (the stored hero video, or null) beside `video_key`.
 */
export function pageFixture<T>(page: BlockPage): T {
  if (dataSource() === "fixtures") {
    const raw = readFixtureFile<Record<string, unknown>>(FIXTURE_FILE[page]);
    if (page !== "home") return raw as T;
    const { tiers: _tiers, ...blocks } = raw;
    void _tiers;
    return blocks as T;
  }
  const { bySection, media } = pageRows(page);
  const out: Record<string, unknown> = {};
  for (const spec of PAGE_SECTIONS[page]) {
    const row = bySection.get(spec.section);
    const rows = row ? media.filter((m) => m.section_id === row.id) : [];
    for (const [slot, source] of Object.entries(spec.mediaFrom)) {
      setPath(out, source.path, slotValue(spec, slot, rows));
    }
    if (page === "home" && spec.video) {
      // The block keeps today's shape: video_key (a media key, none stored in the database) and the stored URL beside it.
      setPath(out, `${spec.section}.video_key`, null);
      setPath(out, `${spec.section}.video_url`, row?.video_url ?? null);
    }
  }
  if (page === "about") {
    const shownSections = new Set([...bySection.keys()]);
    out.cards = readSource<ItemRow[]>("page-items")
      .filter((item) => shownSections.has(item.section))
      .sort((a, b) => a.position - b.position);
  }
  return out as T;
}

/**
 * The page's text records in the fixture shape (`home-translations.json` without `tiers`, `about-translations.json`;
 * /destinations has no translations file, so `{}`).
 */
export function pageFixtureTranslations<T>(page: BlockPage): T {
  if (dataSource() === "fixtures") {
    if (page === "destinations") return {} as T;
    const raw = readFixtureFile<Record<string, unknown>>(`${FIXTURE_FILE[page]}-translations`);
    if (page !== "home") return raw as T;
    const { tiers: _tiers, ...blocks } = raw;
    void _tiers;
    return blocks as T;
  }
  if (page === "destinations") return {} as T;
  const { bySection, texts } = pageRows(page);
  const out: Record<string, unknown> = {};
  for (const spec of PAGE_SECTIONS[page]) {
    // Only the blocks the fixture file holds: the copy-held section texts are read by 06-02 when it moves them to data.
    if (spec.textFrom?.kind !== "fixture") continue;
    const row = bySection.get(spec.section);
    out[spec.textFrom.block] = row ? textRecords(spec, texts.filter((t) => t.section_id === row.id)) : [];
  }
  if (page === "about") {
    const shownCards = new Set((pageFixture<{ cards: ItemRow[] }>("about").cards ?? []).map((card) => card.id));
    out.cards = readSource<ItemTextRow[]>("page-item-translations").filter((row) => shownCards.has(row.card_id));
  }
  return out as T;
}
