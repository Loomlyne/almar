// The pure side of Catalog -> Packages (plans 03.2-08 and 06-06): form state, how the site reads the price line, the legs and
// included add-ons, and the live Arabic and Spanish fields for the kit editor. No React, no fetch, no directive. The price line
// is the owner's own text: nothing here computes, rounds or fills a price; the reading only repeats what the server
// parsed from the saved English line (contract 5.8).
//
// A leg's nights line is translated like any field: the kit gets one flat field per leg, named by the leg's key (`leg_<k>`, the
// translate route's name rule), so its lock stays on its leg when legs move. The kit keeps its locks by name while the page is
// open, and a save replaces every leg with new ids, so journeyForm(detail, keys) keeps the keys across a read-back (as post-forms).

import type { JourneyDetail, JourneyDetailWithLegs, Locale3, MediaRef, TextStatus } from "../../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../../components/ops/auto-translate";
import { locksOf, noLocks, translationsFor, withTranslations, type Locks } from "../catalog-forms";

export const JOURNEY_TEXT_FIELDS = ["name", "price_label", "tagline", "duration_label", "ideal_for_label", "ideal_for", "body"] as const;
export type JourneyTextField = (typeof JOURNEY_TEXT_FIELDS)[number];
/** The text of one language. Empty string = not set. */
export type JourneyText = Record<JourneyTextField, string>;

/** One city of a package. `text` is the nights line per language; "" = not set. */
export type JourneyLegForm = {
  /** The leg's identity while legs are added, moved and removed, and its translate field name. */
  key: string;
  destination_id: string;
  stay_id: string | null;
  text: Record<Locale3, string>;
  /** The Arabic and Spanish nights lines the owner fixed by hand. */
  locked: Record<Target, boolean>;
};

export type JourneyForm = {
  /** Null: a new package, not saved yet. */
  id: string | null;
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
  legs: JourneyLegForm[];
  /** The included add-ons, in their order. */
  addon_ids: string[];
};

export const blankJourneyText = (): JourneyText => ({ name: "", price_label: "", tagline: "", duration_label: "", ideal_for_label: "", ideal_for: "", body: "" });

/** A request form takes at most six cities (site_request_payload_ok), so the editor stops there: every city can be asked for. */
export const MAX_FORM_LEGS = 6;

let legCount = 0;
const legKey = () => `leg_${++legCount}`;

/** A new city: the first destination on the list, no stay, no nights line. */
export const blankJourneyLeg = (destinationId: string): JourneyLegForm => ({
  key: legKey(),
  destination_id: destinationId,
  stay_id: null,
  text: { en: "", ar: "", es: "" },
  locked: { ar: false, es: false },
});

/** A new package: no id, hidden, nothing connected. */
export function blankJourneyForm(): JourneyForm {
  return {
    id: null,
    slug: "",
    published: false,
    is_featured: false,
    media: null,
    text: { en: blankJourneyText(), ar: blankJourneyText(), es: blankJourneyText() },
    status: { en: "published", ar: "draft", es: "draft" },
    locked: noLocks(),
    stored: { ar: false, es: false },
    price_from: null,
    price_estimate: null,
    legs: [],
    addon_ids: [],
  };
}

/**
 * The form for a journey as the server returns it. `keys`: the leg keys to reuse, in order (the legs just saved): a read-back
 * after Save keeps each leg's field name, so the kit's locks stay on their legs. The legs and add-ons are absent on a database
 * before migration 20261025120000: none.
 */
export function journeyForm(detail: JourneyDetail & Partial<Pick<JourneyDetailWithLegs, "legs" | "addon_ids">>, keys: readonly string[] = []): JourneyForm {
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
    legs: (detail.legs ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((leg, i) => ({
        key: keys[i] ?? legKey(),
        destination_id: leg.destination_id,
        stay_id: leg.stay_id ?? null,
        text: { en: leg.translations.en?.nights_label ?? "", ar: leg.translations.ar?.nights_label ?? "", es: leg.translations.es?.nights_label ?? "" },
        locked: {
          ar: (leg.translations.ar?.locked_fields ?? []).includes("nights_label"),
          es: (leg.translations.es?.locked_fields ?? []).includes("nights_label"),
        },
      })),
    addon_ids: [...(detail.addon_ids ?? [])],
  };
}

/** One language's values for the kit: the package's fields plus `leg_<k>` for each leg's nights line. */
export function journeyFields(form: Pick<JourneyForm, "text" | "legs">, locale: Locale3): Fields {
  const out: Fields = {};
  for (const field of JOURNEY_TEXT_FIELDS) out[field] = form.text[locale][field];
  for (const leg of form.legs) out[leg.key] = leg.text[locale];
  return out;
}

/** The kit's lock lists: the package's own, plus `leg_<k>` for each locked nights line. */
export function journeyLocks(form: Pick<JourneyForm, "locked" | "legs">): Record<Target, string[]> {
  const list = (target: Target) => [...form.locked[target], ...form.legs.filter((leg) => leg.locked[target]).map((leg) => leg.key)].sort();
  return { ar: list("ar"), es: list("es") };
}

const asLine = (value: Fields[string] | undefined, fallback: string) => (value === undefined ? fallback : Array.isArray(value) ? value.join(" ") : (value ?? ""));

/** The Arabic and Spanish the kit handed back, and its lock lists, split back into the package and its legs. */
export function journeyWithTranslations(form: JourneyForm, translations: Record<Target, Fields>, locked: Record<Target, string[]>): JourneyForm {
  const own = (target: Target) => locked[target].filter((field) => (JOURNEY_TEXT_FIELDS as readonly string[]).includes(field));
  const next = withTranslations(form, translations, { ar: own("ar"), es: own("es") });
  return {
    ...next,
    legs: form.legs.map((leg) => ({
      ...leg,
      text: { en: leg.text.en, ar: asLine(translations.ar[leg.key], leg.text.ar), es: asLine(translations.es[leg.key], leg.text.es) },
      locked: { ar: locked.ar.includes(leg.key), es: locked.es.includes(leg.key) },
    })),
  };
}

/** A leg can be saved once it has a destination and its English nights line (the server asks for both). */
export const legsReady = (legs: readonly JourneyLegForm[]) => legs.every((leg) => leg.destination_id !== "" && leg.text.en.trim() !== "");

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lowercase letters, numbers and dashes, at most 80 (the server's rule). */
export function journeySlugOk(slug: string): boolean {
  const value = slug.trim();
  return value.length > 0 && value.length <= 80 && SLUG.test(value);
}

/** A list with one leg moved one place, keeping its key; out of range: the same list. */
export function movedLegs(legs: readonly JourneyLegForm[], key: string, by: -1 | 1): JourneyLegForm[] {
  const at = legs.findIndex((leg) => leg.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= legs.length) return [...legs];
  const next = [...legs];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return next;
}

/** A leg with another destination: a suggested stay goes unless it belongs to that destination (the server refuses it otherwise). */
export function legWithDestination(leg: JourneyLegForm, destinationId: string, staysOfDestination: readonly { id: string }[]): JourneyLegForm {
  const stays = staysOfDestination.some((stay) => stay.id === leg.stay_id);
  return { ...leg, destination_id: destinationId, stay_id: stays ? leg.stay_id : null };
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
export function liveJourneyFields(published: boolean, status: Record<Locale3, TextStatus>, saved: Record<Locale3, JourneyText>, savedLegs: readonly JourneyLegForm[] = []): LiveFields {
  if (!published) return {};
  const live: LiveFields = {};
  for (const target of ["ar", "es"] as const) {
    if (status[target] !== "published") continue;
    live[target] = [...JOURNEY_TEXT_FIELDS.filter((field) => saved[target][field].trim() !== ""), ...savedLegs.filter((leg) => leg.text[target].trim() !== "").map((leg) => leg.key)];
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

/** The whole `legs` of a save: replaced on the server, in this order; each leg's Arabic and Spanish go with their locks. */
function legsPayload(form: JourneyForm, publish: boolean): Record<string, unknown>[] {
  const statusOf = (target: Target): TextStatus => (publish || form.status[target] === "published" ? "published" : "draft");
  const record = (leg: JourneyLegForm, target: Target) => {
    const line = leg.text[target].trim();
    return line === "" ? null : { nights_label: line, status: statusOf(target), locked_fields: leg.locked[target] ? ["nights_label"] : [] };
  };
  return form.legs.map((leg) => ({
    destination_id: leg.destination_id,
    stay_id: leg.stay_id,
    translations: { en: { nights_label: leg.text.en.trim(), status: "published" }, ar: record(leg, "ar"), es: record(leg, "es") },
  }));
}

/**
 * The `save` item of /api/ops/journeys (contract 5.8, plan 06-06). A new package sends no id and its web address; a hidden one
 * sends both (the address can still change); a published one sends the id and no address (it is locked). The stored `is_featured`
 * goes back unchanged, then the photo, the translations, and the legs and add-ons whole on every save. English always carries the
 * name and the price line as typed (the server reads the price from it); no price column is ever sent. On Publish every language
 * with a name goes out published; a Save keeps each language as it is. An Arabic or Spanish record with an empty price line is
 * never dropped whole: a stored one goes without the price key (its saved line stays, the rest of the text is saved); only a new
 * one, which the database cannot create without the line, is left out (journeyPriceGaps).
 */
export function journeyPayload(form: JourneyForm, { publish }: { publish: boolean }): Record<string, unknown> {
  const translations = translationsFor(form, publish);
  const gaps = journeyPriceGaps(form, { publish });
  for (const target of gaps.kept) delete translations[target]!.price_label;
  for (const target of gaps.held) delete translations[target];
  const item: Record<string, unknown> = {};
  if (form.id !== null) item.id = form.id;
  if (!form.published) item.slug = form.slug.trim();
  item.is_featured = form.is_featured;
  item.media_id = form.media?.id ?? null;
  item.translations = translations;
  item.legs = legsPayload(form, publish);
  item.addon_ids = [...form.addon_ids];
  return item;
}
