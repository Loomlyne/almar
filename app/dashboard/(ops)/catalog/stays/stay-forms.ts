// Catalog -> Stays: the stay editor's form, pure (no React, no fetch). The facts are kept as typed (strings), so a box
// never jumps while the owner types; validateStayFacts says what is wrong in words keys, the screen says them.
//
// Field names of the texts are the contract's (StayText, contract 5.2) and the translate route's: the kit sends them as
// they are. The four line lists are arrays: the route keeps their length, and amenities must have the English number of
// lines in Arabic and Spanish (the public build refuses a record that differs; the server answers 409 amenities_mismatch).

import type { Fields, Target } from "../../../../../components/ops/auto-translate";
import type { Locale3, MediaRef, PetsRule, StayDetail } from "../../../../../components/ops/api-types";

/** The short text fields, in the order the editor shows them. */
export const STAY_LINES = ["title", "tagline", "neighborhood", "guests_label", "bathrooms_label", "beds_label", "price_label", "price_note"] as const;
/** The line lists, in the order the editor shows them. */
export const STAY_LISTS = ["description", "amenities", "inclusions", "policy_headings"] as const;

export type StayLine = (typeof STAY_LINES)[number];
export type StayList = (typeof STAY_LISTS)[number];

export type StayFacts = {
  destinationId: string;
  slug: string;
  maxGuests: string;
  minGuests: string;
  bedrooms: string;
  bathrooms: string;
  minNights: string;
  /** "" is "Not set". */
  petsRule: PetsRule | "";
  petsFee: string;
  /** "" is "Not set". */
  infants: "yes" | "no" | "";
};

export type StayForm = {
  facts: StayFacts;
  /** English: every StayLine as a string, every StayList as an array of lines. */
  english: Fields;
  translations: Record<Target, Fields>;
  hero: MediaRef | null;
  gallery: MediaRef[];
  /** Experiences and services connected to this stay, in the order guests see them. */
  connected: string[];
};

export type FactKey = keyof StayFacts;
/** A fact error, said by the screen in its own words. */
export type FactProblem = "whole" | "atLeastOne" | "guestsOrder" | "fee" | "feeNeeded" | "slug" | "slugNeeded" | "destinationNeeded";

const blankText = (): Fields => ({
  ...Object.fromEntries(STAY_LINES.map((name) => [name, ""])),
  ...Object.fromEntries(STAY_LISTS.map((name) => [name, [] as string[]])),
});

export function emptyStayForm(): StayForm {
  return {
    facts: {
      destinationId: "",
      slug: "",
      maxGuests: "",
      minGuests: "",
      bedrooms: "",
      bathrooms: "",
      minNights: "1",
      petsRule: "",
      petsFee: "",
      infants: "",
    },
    english: blankText(),
    translations: { ar: blankText(), es: blankText() },
    hero: null,
    gallery: [],
    connected: [],
  };
}

const numberText = (value: number | null) => (value === null ? "" : String(value));

/** The form for a stay read from the server. Connected experiences come first, then services, each in its saved order. */
export function stayForm(stay: StayDetail): StayForm {
  const text = (locale: "en" | Target): Fields => {
    const record = stay.translations[locale];
    const out = blankText();
    if (!record) return out;
    for (const name of STAY_LINES) out[name] = record[name] ?? "";
    for (const name of STAY_LISTS) out[name] = [...record[name]];
    return out;
  };
  return {
    facts: {
      destinationId: stay.destination_id,
      slug: stay.slug,
      maxGuests: numberText(stay.max_guests),
      minGuests: numberText(stay.min_guests),
      bedrooms: numberText(stay.bedrooms),
      bathrooms: numberText(stay.bathrooms),
      minNights: String(stay.min_nights),
      petsRule: stay.pets_rule ?? "",
      petsFee: stay.pets_fee_aed ?? "",
      infants: stay.infants_count === null ? "" : stay.infants_count ? "yes" : "no",
    },
    english: text("en"),
    translations: { ar: text("ar"), es: text("es") },
    hero: stay.hero,
    gallery: [...stay.gallery],
    connected: [...stay.experience_ids, ...stay.service_ids],
  };
}

const WHOLE = /^\d+$/;
// The server's money rule (lib/ops/validate.ts), and the fee must be above 0.
const MONEY = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * What is wrong with the facts, per field. An empty optional number is fine (null); minimum nights empty is 1. The
 * server stays the authority (contract 2.1 checks); this keeps a wrong value from being sent.
 */
export function validateStayFacts(facts: StayFacts): Partial<Record<FactKey, FactProblem>> {
  const out: Partial<Record<FactKey, FactProblem>> = {};
  if (facts.destinationId === "") out.destinationId = "destinationNeeded";
  const slug = facts.slug.trim();
  if (slug === "") out.slug = "slugNeeded";
  else if (slug.length > 80 || !SLUG.test(slug)) out.slug = "slug";
  for (const key of ["maxGuests", "minGuests", "bedrooms", "bathrooms"] as const) {
    const value = facts[key].trim();
    if (value !== "" && !WHOLE.test(value)) out[key] = "whole";
  }
  const nights = facts.minNights.trim();
  if (nights !== "" && (!WHOLE.test(nights) || Number(nights) < 1)) out.minNights = "atLeastOne";
  if (!out.maxGuests && !out.minGuests && facts.maxGuests.trim() !== "" && facts.minGuests.trim() !== "") {
    if (Number(facts.maxGuests) < Number(facts.minGuests)) out.maxGuests = "guestsOrder";
  }
  if (facts.petsRule === "fee") {
    const fee = facts.petsFee.trim();
    if (fee === "") out.petsFee = "feeNeeded";
    else if (!MONEY.test(fee) || Number(fee) === 0) out.petsFee = "fee";
  }
  return out;
}

/** The lines of a list as the owner typed them in one box: one item per line, blank lines dropped. */
export function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

const count = (value: Fields[string] | undefined) => (Array.isArray(value) ? value.filter((line) => line.trim() !== "").length : 0);

/**
 * Amenities whose line count differs from English in a language the owner typed into (Edit translations). A language
 * the AI fills on this Save is not counted: the route returns the English length. Empty in that language: not counted.
 */
export function lockedLength(english: Fields, translations: Record<Target, Fields>, typed: Record<Target, boolean>): Target[] {
  const wanted = count(english.amenities);
  return (["ar", "es"] as const).filter((target) => typed[target] && count(translations[target].amenities) > 0 && count(translations[target].amenities) !== wanted);
}

/** Line counts of amenities per language, for the sentence that explains the lock. */
export function amenityCounts(english: Fields, translations: Record<Target, Fields>) {
  return { en: count(english.amenities), ar: count(translations.ar.amenities), es: count(translations.es.amenities) };
}

// ---- the save request (contract 5.2, 1.2) ----------------------------------------------------------------------------

type TextRecord = Record<string, string | string[] | null>;

/** One language's text as the server takes it: trimmed, empty optional lines as null, lists without blank lines. */
function record(fields: Fields): TextRecord {
  const out: TextRecord = {};
  for (const name of STAY_LINES) {
    const value = String(fields[name] ?? "").trim();
    out[name] = name === "title" ? value : value === "" ? null : value;
  }
  for (const name of STAY_LISTS) {
    const value = fields[name];
    out[name] = Array.isArray(value) ? linesOf(value.join("\n")) : [];
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const whole = (text: string) => (text.trim() === "" ? null : Number(text.trim()));

/**
 * The `save` body for this form. Kit B's rule: Save keeps each language as it is (published stays published, a new or
 * draft text is a draft); Publish sends every language published. Only the languages that changed are sent on Save (a
 * language left out is untouched); Arabic or Spanish with no title yet is not sent (the AI has not filled it). On
 * create every fact is sent; connections and the gallery only when they changed or on create.
 */
export function stayPayload(
  form: StayForm,
  saved: StayForm,
  {
    id,
    publish,
    live,
    kindOf,
  }: {
    id: string | null;
    publish: boolean;
    /** Languages published on the site now. */
    live: Partial<Record<Locale3, boolean>>;
    kindOf: (id: string) => "experience" | "service" | undefined;
  },
) {
  const create = id === null;
  const f = form.facts;
  const translations: Partial<Record<Locale3, TextRecord & { status: "published" | "draft" }>> = {};
  const texts: Record<Locale3, [Fields, Fields]> = {
    en: [form.english, saved.english],
    ar: [form.translations.ar, saved.translations.ar],
    es: [form.translations.es, saved.translations.es],
  };
  for (const locale of ["en", "ar", "es"] as const) {
    const [now, before] = texts[locale];
    const next = record(now);
    if (locale !== "en" && next.title === "") continue;
    const status = publish || live[locale] ? "published" : "draft";
    const changed = !same(next, record(before)) || (status === "published" && !live[locale]);
    if (create ? locale === "en" || changed : changed) translations[locale] = { ...next, status };
  }

  const item: Record<string, unknown> = {
    ...(create ? {} : { id }),
    slug: f.slug.trim(),
    destination_id: f.destinationId,
    max_guests: whole(f.maxGuests),
    min_guests: whole(f.minGuests),
    bedrooms: whole(f.bedrooms),
    bathrooms: whole(f.bathrooms),
    min_nights: f.minNights.trim() === "" ? 1 : Number(f.minNights.trim()),
    pets_rule: f.petsRule === "" ? null : f.petsRule,
    pets_fee_aed: f.petsRule === "fee" ? f.petsFee.trim() : null,
    infants_count: f.infants === "" ? null : f.infants === "yes",
    hero_media_id: form.hero?.id ?? null,
  };
  if (create || !same(form.gallery.map((p) => p.id), saved.gallery.map((p) => p.id))) item.gallery_media_ids = form.gallery.map((p) => p.id);
  if (create || !same(form.connected, saved.connected)) {
    item.connections = {
      experience_ids: form.connected.filter((one) => kindOf(one) === "experience"),
      service_ids: form.connected.filter((one) => kindOf(one) === "service"),
    };
  }
  if (Object.keys(translations).length > 0) item.translations = translations;
  return { action: "save" as const, item };
}

/**
 * Connected ids as the server keeps them: experiences, then services, each in its own order. The save stores a position
 * per kind (contract 5.2 `connections`; the stay save function numbers each kind from 0), so an order across kinds would
 * not survive a reload: the editor keeps the list grouped and moves a row only within its kind.
 */
export function groupByKind(ids: readonly string[], kindOf: (id: string) => "experience" | "service" | undefined): string[] {
  return [...ids.filter((id) => kindOf(id) !== "service"), ...ids.filter((id) => kindOf(id) === "service")];
}
