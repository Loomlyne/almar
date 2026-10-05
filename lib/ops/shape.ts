// Plan 03.2-04: database jsonb (ops_list / ops_get / plain selects) -> the reply shapes of 03.2-API-CONTRACT.md §5,
// typed by components/ops/api-types.ts (one definition for the server and the screens). Every shaper picks the
// contract's keys and nothing else, so a column added later never leaks into a reply. MediaRef gets its `url` here,
// from mediaUrl() (lib/data/media.ts is the only file that knows the media host); money becomes a 2-decimal string.

import type {
  Aed,
  Block,
  BlockScope,
  CatalogDetail,
  CatalogSummary,
  DestinationDetail,
  DestinationSummary,
  JourneyDetail,
  JourneySummary,
  Locale3,
  MediaRef,
  RateNight,
  RateRange,
  StayAccess,
  StayDetail,
  StaySummary,
  TeamDetail,
  TeamSummary,
  TeamLink,
  TextStatus,
  TranslationState,
  TranslationStates,
  Translations,
} from "../../components/ops/api-types";
import { mediaUrl } from "../data/media";

type Row = Record<string, unknown>;

const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** A photo reference with its public URL, or null. */
export function mediaRef(value: unknown): MediaRef | null {
  if (!isRow(value) || typeof value.id !== "string" || typeof value.key !== "string") return null;
  return {
    id: value.id,
    key: value.key,
    url: mediaUrl(value.key),
    width: numOrNull(value.width),
    height: numOrNull(value.height),
    alt_en: typeof value.alt_en === "string" ? value.alt_en : "",
  };
}

/** AED as "1250.00" (a numeric's text or a JSON number in; null stays null). */
export function aed(value: unknown): Aed | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, cents = ""] = text.split(".");
  return `${whole}.${cents.padEnd(2, "0").slice(0, 2)}`;
}

function oneState(value: unknown): TranslationState {
  return value === "published" || value === "draft" ? value : "missing";
}

export function translationState(value: unknown): TranslationStates {
  const row = isRow(value) ? value : {};
  return { en: oneState(row.en), ar: oneState(row.ar), es: oneState(row.es) };
}

function status(value: unknown): TextStatus {
  return value === "published" ? "published" : "draft";
}

/** One record per language with exactly `textKeys` (+ `lists`) and its status; a missing record is null. */
function translationsOf<T>(value: unknown, textKeys: readonly string[], lists: readonly string[] = []): Translations<T> {
  const all = isRow(value) ? value : {};
  const out = {} as Record<Locale3, unknown>;
  for (const locale of LOCALES) {
    const rec = all[locale];
    if (!isRow(rec)) {
      out[locale] = null;
      continue;
    }
    const item: Row = {};
    for (const key of textKeys) item[key] = strOrNull(rec[key]);
    for (const key of lists) item[key] = Array.isArray(rec[key]) ? (rec[key] as unknown[]).map(str) : [];
    item.status = status(rec.status);
    out[locale] = item;
  }
  return out as Translations<T>;
}

// ---- 5.1 destinations ------------------------------------------------------------------------------------------------

const DESTINATION_TEXT = ["name", "short_line", "region", "summary", "nights_label"] as const;

export function destinationSummary(r: Row): DestinationSummary {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name_en: str(r.name_en),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    stay_count: numOrNull(r.stay_count) ?? 0,
    published_stay_count: numOrNull(r.published_stay_count) ?? 0,
    hero: mediaRef(r.hero),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

export function destinationDetail(r: Row): DestinationDetail {
  return {
    id: str(r.id),
    slug: str(r.slug),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    hero_media_id: strOrNull(r.hero_media_id),
    inset_media_id: strOrNull(r.inset_media_id),
    hero: mediaRef(r.hero),
    inset: mediaRef(r.inset),
    translations: translationsOf(r.translations, DESTINATION_TEXT),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

// ---- 5.2 stays ----------------------------------------------------------------------------------------------------------

const STAY_TEXT = ["title", "tagline", "neighborhood", "guests_label", "bathrooms_label", "beds_label", "price_label", "price_note"] as const;
const STAY_LISTS = ["description", "amenities", "inclusions", "policy_headings"] as const;

export function staySummary(r: Row): StaySummary {
  const rate = aed(r.base_nightly_rate_aed);
  return {
    id: str(r.id),
    slug: str(r.slug),
    title_en: str(r.title_en),
    destination_id: str(r.destination_id),
    destination_name_en: str(r.destination_name_en),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    base_nightly_rate_aed: rate,
    bookable: r.is_published === true && rate !== null,
    hero: mediaRef(r.hero),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

function petsRule(value: unknown): StayDetail["pets_rule"] {
  return value === "allowed" || value === "not_allowed" || value === "fee" ? value : null;
}

export function stayDetail(r: Row): StayDetail {
  return {
    id: str(r.id),
    slug: str(r.slug),
    destination_id: str(r.destination_id),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    max_guests: numOrNull(r.max_guests),
    min_guests: numOrNull(r.min_guests),
    bedrooms: numOrNull(r.bedrooms),
    bathrooms: numOrNull(r.bathrooms),
    min_nights: numOrNull(r.min_nights) ?? 1,
    pets_rule: petsRule(r.pets_rule),
    pets_fee_aed: aed(r.pets_fee_aed),
    infants_count: typeof r.infants_count === "boolean" ? r.infants_count : null,
    base_nightly_rate_aed: aed(r.base_nightly_rate_aed),
    hero_media_id: strOrNull(r.hero_media_id),
    hero: mediaRef(r.hero),
    gallery: (Array.isArray(r.gallery) ? r.gallery : []).map(mediaRef).filter((m): m is MediaRef => m !== null),
    experience_ids: idList(r.experience_ids),
    service_ids: idList(r.service_ids),
    has_access: r.has_access === true,
    translations: translationsOf(r.translations, STAY_TEXT, STAY_LISTS),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

// ---- 5.3 rates -----------------------------------------------------------------------------------------------------------

/** A stay_rates row (`nights` is the daterange text "[first,last+1)") -> the inclusive API range. */
export function rateRange(r: Row): RateRange {
  const m = str(r.nights).match(/^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/);
  const first = m ? m[1] : "";
  const upper = m ? m[2] : "";
  const day = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;
  const nights = m ? day(upper) - day(first) : 0;
  const last = m ? new Date((day(upper) - 1) * 86_400_000).toISOString().slice(0, 10) : "";
  return { id: str(r.id), first_night: first, last_night: last, nights, nightly_rate_aed: aed(r.nightly_rate_aed) ?? "0.00" };
}

export function rateNight(r: Row): RateNight {
  const source = r.source === "range" || r.source === "base" ? r.source : null;
  return { night: str(r.night), nightly_rate_aed: aed(r.nightly_rate_aed), source };
}

// ---- 5.4 blocks, 5.5 access ---------------------------------------------------------------------------------------------

export function block(r: Row): Block {
  const scope: BlockScope = r.scope === "all" || r.scope === "destination" ? r.scope : "stay";
  return {
    id: str(r.id),
    scope,
    destination_id: strOrNull(r.destination_id),
    stay_id: strOrNull(r.stay_id),
    starts_on: str(r.starts_on),
    ends_on: str(r.ends_on),
    reason: strOrNull(r.reason),
    created_at: str(r.created_at),
  };
}

export function stayAccess(r: Row): StayAccess {
  return {
    address: strOrNull(r.address),
    wifi_name: strOrNull(r.wifi_name),
    wifi_password: strOrNull(r.wifi_password),
    door_code: strOrNull(r.door_code),
    notes: strOrNull(r.notes),
    updated_at: str(r.updated_at),
  };
}

// ---- 5.6 experiences and services ----------------------------------------------------------------------------------------

const CATALOG_TEXT = ["name", "summary", "duration_label"] as const;

function kind(value: unknown): CatalogSummary["kind"] {
  return value === "service" ? "service" : "experience";
}

function unit(value: unknown): CatalogSummary["unit"] {
  return value === "night" || value === "trip" ? value : "person";
}

export function catalogSummary(r: Row): CatalogSummary {
  return {
    id: str(r.id),
    slug: str(r.slug),
    kind: kind(r.kind),
    unit: unit(r.unit),
    price_aed: aed(r.price_aed),
    is_uae: r.is_uae === true,
    is_home_pickup: r.is_home_pickup === true,
    name_en: str(r.name_en),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    image: mediaRef(r.image),
    destination_ids: idList(r.destination_ids),
    stay_count: numOrNull(r.stay_count) ?? 0,
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

export function catalogDetail(r: Row): CatalogDetail {
  return {
    id: str(r.id),
    slug: str(r.slug),
    kind: kind(r.kind),
    unit: unit(r.unit),
    price_aed: aed(r.price_aed),
    is_uae: r.is_uae === true,
    is_home_pickup: r.is_home_pickup === true,
    media_id: strOrNull(r.media_id),
    image: mediaRef(r.image),
    destination_ids: idList(r.destination_ids),
    stay_ids: idList(r.stay_ids),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    translations: translationsOf(r.translations, CATALOG_TEXT),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

// ---- 5.7 team ------------------------------------------------------------------------------------------------------------

const TEAM_TEXT = ["name", "role", "bio"] as const;

export function teamSummary(r: Row): TeamSummary {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name_en: str(r.name_en),
    role_en: strOrNull(r.role_en),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    photo: mediaRef(r.photo),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

function links(value: unknown): TeamLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRow).map((l) => ({ label: str(l.label), url: str(l.url) }));
}

export function teamDetail(r: Row): TeamDetail {
  return {
    id: str(r.id),
    slug: str(r.slug),
    photo_media_id: strOrNull(r.photo_media_id),
    photo: mediaRef(r.photo),
    email: strOrNull(r.email),
    links: links(r.links),
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    translations: translationsOf(r.translations, TEAM_TEXT),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

// ---- 5.8 journeys --------------------------------------------------------------------------------------------------------

const JOURNEY_TEXT = ["name", "price_label", "tagline", "duration_label", "ideal_for_label", "ideal_for", "body"] as const;

export function journeySummary(r: Row): JourneySummary {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name_en: str(r.name_en),
    price_label_en: str(r.price_label_en),
    is_featured: r.is_featured === true,
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    image: mediaRef(r.image),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}

export function journeyDetail(r: Row): JourneyDetail {
  const from = isRow(r.price_from) ? r.price_from : null;
  const est = isRow(r.price_estimate) ? r.price_estimate : null;
  const fromAmount = from ? aed(from.amount) : null;
  return {
    id: str(r.id),
    slug: str(r.slug),
    is_featured: r.is_featured === true,
    media_id: strOrNull(r.media_id),
    image: mediaRef(r.image),
    price_from: from && fromAmount !== null && (from.currency === "USD" || from.currency === "AED") ? { amount: fromAmount, currency: from.currency } : null,
    price_estimate: est ? { low: aed(est.low), high: aed(est.high), currency: "AED", open_ended: est.open_ended === true } : null,
    is_published: r.is_published === true,
    position: numOrNull(r.position) ?? 0,
    translations: translationsOf(r.translations, JOURNEY_TEXT),
    translation_state: translationState(r.translation_state),
    updated_at: str(r.updated_at),
  };
}
