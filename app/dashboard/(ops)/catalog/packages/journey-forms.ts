// The pure side of Catalog -> Packages, the three home journeys (plan 03.2-08, C-15): form state, how the site reads the
// price line, and the live Arabic and Spanish fields for the kit editor. No React, no fetch, no directive. The price line
// is the owner's own text: nothing here computes, rounds or fills a price; the reading only repeats what the server
// parsed from the saved English line (contract 5.8). The save payload (journeyPayload) joins this file in Task 2.

import type { JourneyDetail, Locale3, MediaRef, TextStatus } from "../../../../../components/ops/api-types";
import type { LiveFields } from "../../../../../components/ops/auto-translate";

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
