// lib/data/resolve.ts
//
// Server only (reads the fixtures with fs at build time). Internal to lib/data: components never import
// this file (tests/data-boundary.test.mjs). It is the one place the storage shape (one record per
// language, owner answer 2) is turned into the single-language rows the rest of the app sees (design 3.1.2).
// Plan 03.2-02: the catalogue entities (destinations, stays, catalogue, team, journeys and the alt texts of their
// pictures) are read through ./source (JSON fixtures or the Supabase api_* views, decided there); the page blocks
// that stay in fixtures (home hero and the rest, about, contact, posts, C-21) still use readFixture below.
// resolveRow and resolveImage are unchanged.

import { mediaUrl } from "./media";
import { readFixtureFile, readSource } from "./source";
import type { ImageRef, Locale, TranslationStatus } from "./types";

/**
 * Reads <fixture folder>/<name>.json (lib/data/fixtures, or ALMAR_FIXTURE_DIR), relative to the repo root (the build and
 * the tests run from it). Only for content that stays in fixtures: the entity modules call readSource.
 */
export function readFixture<T>(name: string): T {
  return readFixtureFile<T>(name);
}

/** The status a stored translation record carries. */
export type StoredStatus = "published" | "draft";

/** A fixture image object: a media key and its size, never a URL, never alt text. */
export type RawImage = {
  id: string;
  media_key: string;
  width: number | null;
  height: number | null;
  position: number;
};

/** One alt-text record: one per image per locale. */
export type ImageTranslation = {
  image_id: string;
  locale: Locale;
  alt: string;
  status: StoredStatus;
};

type TranslationRecord = { locale: Locale; status: StoredStatus } & Record<string, unknown>;

/**
 * Picks the record for `locale`; without one, the `en` record with translation_status "fallback" and
 * locale "en". Returns the base row plus the record's text fields, flattened, plus `locale` and
 * `translation_status`. Never returns a translations array.
 */
export function resolveRow<B extends Record<string, unknown>, T extends TranslationRecord>(
  base: B,
  translations: readonly T[],
  locale: Locale,
): Omit<B, "locale"> &
  Omit<T, "locale" | "status"> & { locale: Locale; translation_status: TranslationStatus } {
  const exact = translations.find((t) => t.locale === locale);
  const record = exact ?? translations.find((t) => t.locale === "en");
  if (!record) {
    throw new Error(`resolveRow: no "${locale}" or "en" record for ${String(base.id ?? base.slug ?? "row")}`);
  }
  const text: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    // The record's foreign key (stay_id, item_id, ...), its locale and its status are storage, not text.
    if (k === "locale" || k === "status" || k.endsWith("_id")) continue;
    text[k] = v;
  }
  const translation_status: TranslationStatus = exact ? exact.status : "fallback";
  return { ...base, ...text, locale: record.locale, translation_status } as never;
}

const imageAltCache = new Map<string, readonly ImageTranslation[]>();
let imageAltFrom: readonly ImageTranslation[] | null = null;

/**
 * The alt-text records for one image (cached by image id): the fixture file in fixtures mode; in supabase mode every
 * database record plus the fixture records of images the database does not know (see ./source). Every module that calls
 * image() awaits loadSource() first.
 */
export function imageTranslationsFor(imageId: string): readonly ImageTranslation[] {
  const records = readSource<ImageTranslation[]>("image-translations");
  if (records !== imageAltFrom) {
    imageAltCache.clear();
    const grouped = new Map<string, ImageTranslation[]>();
    for (const t of records) {
      const list = grouped.get(t.image_id) ?? [];
      list.push(t);
      grouped.set(t.image_id, list);
    }
    for (const [id, list] of grouped) imageAltCache.set(id, list);
    imageAltFrom = records;
  }
  return imageAltCache.get(imageId) ?? [];
}

/**
 * Turns a fixture image into an ImageRef: url = mediaUrl(media_key), alt resolved for `locale` with the
 * same English fallback as resolveRow. A missing alt record yields an empty alt rather than an error.
 */
export function resolveImage(
  raw: RawImage | null | undefined,
  imageTranslations: readonly ImageTranslation[],
  locale: Locale,
): ImageRef | null {
  if (!raw) return null;
  const mine = imageTranslations.filter((t) => t.image_id === raw.id);
  const alt = (mine.find((t) => t.locale === locale) ?? mine.find((t) => t.locale === "en"))?.alt ?? "";
  return {
    id: raw.id,
    url: mediaUrl(raw.media_key),
    alt,
    width: raw.width,
    height: raw.height,
    position: raw.position,
  };
}

/** resolveImage with the alt records read from the current source. The entity modules call this. */
export function image(raw: RawImage | null | undefined, locale: Locale): ImageRef | null {
  return raw ? resolveImage(raw, imageTranslationsFor(raw.id), locale) : null;
}
