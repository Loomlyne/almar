// The pure side of Catalog -> Packages, the three home journeys (plan 03.2-08, C-15): form state, how the site reads the
// price line, and the live Arabic and Spanish fields for the kit editor. No React, no fetch, no directive. The price line
// is the owner's own text: nothing here computes, rounds or fills a price; the reading only repeats what the server
// parsed from the saved English line (contract 5.8).

import type { JourneyDetail, Locale3, MediaRef, TextStatus } from "../../../../../components/ops/api-types";
import type { LiveFields } from "../../../../../components/ops/auto-translate";
import { locksOf, translationsFor, type Locks } from "../catalog-forms";

export const JOURNEY_TEXT_FIELDS = ["name", "price_label", "tagline", "duration_label", "ideal_for_label", "ideal_for", "body"] as const;
export type JourneyTextField = (typeof JOURNEY_TEXT_FIELDS)[number];
/** The text of one language. Empty string = not set. */
export type JourneyText = Record<JourneyTextField, string>;

export type JourneyForm = {
  id: string;
  slug: string;
  published: boolean;
  /** Not shown (C-15 does not list it); sent back unchanged on every save. */
  is_featured: boolean;
  media: MediaRef | null;
  text: Record<Locale3, JourneyText>;
  status: Record<Locale3, TextStatus>;
  /** The Arabic and Spanish fields the owner fixed by hand (I18N-04): saved as `locked_fields`. */
  locked: Locks;
  /** Whether an Arabic or Spanish record is stored: a stored one may be saved without its price line (kept as saved). */
  stored: Record<"ar" | "es", boolean>;
  /** What the server read from the saved English price line (read-only). */
  price_from: JourneyDetail["price_from"];
  price_estimate: JourneyDetail["price_estimate"];
};

export const blankJourneyText = (): JourneyText => ({ name: "", price_label: "", tagline: "", duration_label: "", ideal_for_label: "", ideal_for: "", body: "" });

/** The form for a journey as the server returns it. */
export function journeyForm(detail: JourneyDetail): JourneyForm {
  const text = (locale: Locale3): JourneyText => {
    const record = detail.translations[locale];
    const out = blankJourneyText();
    if (record) for (const field of JOURNEY_TEXT_FIELDS) out[field] = record[field] ?? "";
    return out;
  };
  const status = (locale: Locale3): TextStatus => (locale === "en" ? "published" : (detail.translations[locale]?.status ?? "draft"));
  return {
    id: detail.id,
    slug: detail.slug,
    published: detail.is_published,
    is_featured: detail.is_featured,
    media: detail.image,
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    status: { en: status("en"), ar: status("ar"), es: status("es") },
    locked: locksOf(detail.translations),
    stored: { ar: detail.translations.ar !== null, es: detail.translations.es !== null },
    price_from: detail.price_from,
    price_estimate: detail.price_estimate,
  };
}

/**
 * "4900.00" -> "4,900"; "4900.5" -> "4,900.50". Strings only, no float: grouping is done on the digits. Anything that is
 * not a decimal string comes back as it was (the scenes pass a bracket placeholder).
 */
export function groupDigits(amount: string): string {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return amount;
  const whole = m[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = m[2] === undefined ? "" : m[2].padEnd(2, "0");
  return cents === "" || cents === "00" ? whole : `${whole}.${cents}`;
}

export type ReadingTemplates = { readingFrom: string; readingRange: string; readingOpen: string; readingNone: string };

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/**
 * How the site reads the saved English price line, in the dashboard's words: the server's `price_from` first, else its
 * estimate (a range, or an open range from its low end), else the line that says it is shown as typed.
 */
export function priceReading(from: JourneyDetail["price_from"], estimate: JourneyDetail["price_estimate"], copy: ReadingTemplates): string {
  if (from) return fill(copy.readingFrom, { currency: from.currency, amount: groupDigits(from.amount) });
  if (estimate && estimate.low !== null) {
    const low = groupDigits(estimate.low);
    if (estimate.open_ended || estimate.high === null) return fill(copy.readingOpen, { currency: estimate.currency, low });
    return fill(copy.readingRange, { currency: estimate.currency, low, high: groupDigits(estimate.high) });
  }
  return copy.readingNone;
}

/** The Arabic and Spanish fields on the site now (a shown journey, in the languages published with text). */
export function liveJourneyFields(published: boolean, status: Record<Locale3, TextStatus>, saved: Record<Locale3, JourneyText>): LiveFields {
  if (!published) return {};
  const live: LiveFields = {};
  for (const target of ["ar", "es"] as const) {
    if (status[target] !== "published") continue;
    live[target] = JOURNEY_TEXT_FIELDS.filter((field) => saved[target][field].trim() !== "");
  }
  return live;
}

export type PriceGaps = { kept: ("ar" | "es")[]; held: ("ar" | "es")[] };

/**
 * The Arabic and Spanish records that go out with an empty price line. The database keeps a stored record's line
 * when the key is not sent (catalog_save_translations), so a stored one is `kept`; a new record cannot be created
 * without one (price_label is not null), so it is `held`: not sent, and the screen says why and keeps the typed text.
 */
export function journeyPriceGaps(form: JourneyForm, { publish }: { publish: boolean }): PriceGaps {
  const translations = translationsFor(form, publish);
  const gaps: PriceGaps = { kept: [], held: [] };
  for (const target of ["ar", "es"] as const) {
    const record = translations[target];
    if (record && record.price_label === null) gaps[form.stored[target] ? "kept" : "held"].push(target);
  }
  return gaps;
}

/**
 * The `save` item of /api/ops/journeys (contract 5.8): existing ids only (C-15: no create, no slug), the stored
 * `is_featured` sent back unchanged, the photo, and the translations. English always carries the name and the price
 * line as typed (the server reads the price from it); no price column is ever sent. On Publish every language with a
 * name goes out published; a Save keeps each language as it is. An Arabic or Spanish record with an empty price line
 * is never dropped whole: a stored one goes without the price key (its saved line stays, the rest of the text is
 * saved); only a new one, which the database cannot create without the line, is left out (journeyPriceGaps).
 */
export function journeyPayload(form: JourneyForm, { publish }: { publish: boolean }): Record<string, unknown> {
  const translations = translationsFor(form, publish);
  const gaps = journeyPriceGaps(form, { publish });
  for (const target of gaps.kept) delete translations[target]!.price_label;
  for (const target of gaps.held) delete translations[target];
  return { id: form.id, is_featured: form.is_featured, media_id: form.media?.id ?? null, translations };
}
