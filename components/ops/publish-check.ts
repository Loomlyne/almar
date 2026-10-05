// What Publish needs, mirrored from contract 5.9 for the screen. Pure: no React, no import but types.
// This is a hint. The server stays the authority: ops_publish refuses an incomplete row with 409 publish_incomplete
// and the screen shows the server's list through the same MissingItem shape.

import type { Locale3 } from "./api-types";

export type PublishEntity = "destination" | "stay" | "catalog_item" | "team_member" | "journey_tier";

/** One gap. `locale` is null for a fact that has no language (a photo, a link). Field names are the contract's. */
export type MissingItem = { locale: Locale3 | null; field: string };

const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

/** Required in each of en, ar and es, even when English is empty (contract 5.9, second column). */
const REQUIRED_TEXT: Record<PublishEntity, readonly string[]> = {
  destination: ["name"],
  stay: ["title"],
  catalog_item: ["name"],
  team_member: ["name"],
  journey_tier: ["name", "price_label"],
};

/** The photo that must be set, by the column the contract names; null = no photo rule. */
const PHOTO_FIELD: Record<PublishEntity, string | null> = {
  destination: "hero_media_id",
  stay: "hero_media_id",
  catalog_item: "media_id",
  team_member: null,
  journey_tier: "media_id",
};

/** A string is present when its trimmed length is above 0. */
function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type Fields = Record<string, unknown>;

/** Every text field filled in English must be filled in the other two languages; arrays: same length, no empty item. */
function followsEnglish(english: unknown, other: unknown): boolean {
  if (Array.isArray(english)) {
    if (!Array.isArray(other) || other.length !== english.length) return false;
    return other.every(filled);
  }
  return filled(other);
}

function englishIsFilled(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : filled(value);
}

export function missingForPublish(
  entity: PublishEntity,
  draft: {
    translations: Partial<Record<Locale3, Record<string, unknown> | null>>;
    /** Hero, photo or image, per entity. */
    media_id: string | null;
    /** catalog_item. */
    destination_ids?: string[];
    /** stay. */
    destination_published?: boolean;
  },
): MissingItem[] {
  const out: MissingItem[] = [];
  const english: Fields = draft.translations.en ?? {};
  const required = REQUIRED_TEXT[entity];

  for (const locale of LOCALES) {
    const record: Fields = draft.translations[locale] ?? {};
    for (const field of required) {
      if (!filled(record[field])) out.push({ locale, field });
    }
    if (locale === "en") continue;
    for (const field of Object.keys(english)) {
      if (field === "status" || required.includes(field)) continue;
      if (englishIsFilled(english[field]) && !followsEnglish(english[field], record[field])) {
        out.push({ locale, field });
      }
    }
  }

  const photo = PHOTO_FIELD[entity];
  if (photo && !draft.media_id) out.push({ locale: null, field: photo });
  if (entity === "stay" && draft.destination_published !== true) {
    out.push({ locale: null, field: "destination_published" });
  }
  if (entity === "catalog_item" && (draft.destination_ids?.length ?? 0) < 1) {
    out.push({ locale: null, field: "destination_ids" });
  }
  return out;
}
