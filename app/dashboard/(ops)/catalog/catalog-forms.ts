// The pure side of Catalog -> Destinations and Experiences and services (plan 03.2-06): detail -> form state, form ->
// save payload, money normalisation, small view helpers and the client filters. No React, no fetch, no directive.
//
// Translation is automatic (owner, 2026-10-14): Maria writes the English; the kit editor fills Arabic and Spanish on
// Save. The site shows a language only when its record is "published": Publish sends Arabic and Spanish as published, a
// Save keeps a language that is published published and the others in draft (as Media, components/ops/media-alt.ts).

import type {
  CatalogDetail,
  CatalogKind,
  CatalogSummary,
  CatalogUnit,
  DestinationDetail,
  Locale3,
  MediaRef,
  TextStatus,
} from "../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../components/ops/auto-translate";
import type { MissingItem } from "../../../../components/ops/publish-check";
import { foldText } from "../../../../lib/data/stay-filter";

export const FORM_LOCALES: readonly Locale3[] = ["en", "ar", "es"];

/** The text fields of a destination, one set per language. Empty string = not set. */
export type DestinationText = { name: string; short_line: string; region: string; summary: string; nights_label: string };
export const DESTINATION_TEXT_FIELDS = ["name", "short_line", "region", "summary", "nights_label"] as const;

/** The text fields of an experience or service, one set per language. */
export type CatalogItemText = { name: string; summary: string; duration_label: string };
export const CATALOG_TEXT_FIELDS = ["name", "summary", "duration_label"] as const;

export type DestinationForm = {
  id: string | null;
  slug: string;
  published: boolean;
  hero: MediaRef | null;
  inset: MediaRef | null;
  text: Record<Locale3, DestinationText>;
  /** Arabic and Spanish go live with the English on Publish (owner, 2026-10-14); English is always published text. */
  status: Record<Locale3, TextStatus>;
};

export type CatalogItemForm = {
  id: string | null;
  slug: string;
  published: boolean;
  kind: CatalogKind;
  unit: CatalogUnit;
  /** What the owner typed: "" = not set, otherwise a decimal. Normalised to a two-decimal string when saved. */
  price: string;
  is_uae: boolean;
  is_home_pickup: boolean;
  media: MediaRef | null;
  destination_ids: string[];
  stay_ids: string[];
  text: Record<Locale3, CatalogItemText>;
  status: Record<Locale3, TextStatus>;
};

const emptyStatus = (): Record<Locale3, TextStatus> => ({ en: "published", ar: "draft", es: "draft" });

export function emptyDestinationForm(): DestinationForm {
  const blank = (): DestinationText => ({ name: "", short_line: "", region: "", summary: "", nights_label: "" });
  return { id: null, slug: "", published: false, hero: null, inset: null, text: { en: blank(), ar: blank(), es: blank() }, status: emptyStatus() };
}

export function emptyCatalogItemForm(): CatalogItemForm {
  const blank = (): CatalogItemText => ({ name: "", summary: "", duration_label: "" });
  return {
    id: null,
    slug: "",
    published: false,
    kind: "experience",
    unit: "person",
    price: "",
    is_uae: false,
    is_home_pickup: false,
    media: null,
    destination_ids: [],
    stay_ids: [],
    text: { en: blank(), ar: blank(), es: blank() },
    status: emptyStatus(),
  };
}

/**
 * The Arabic and Spanish fields on the site now, for the kit editor's `liveTranslations`: only a published item is on
 * the site, and in it only a language published with text (an item can be live in one language and not the other).
 * `saved` is the text as last saved, not as typed.
 */
export function liveFields(
  published: boolean,
  status: Record<Locale3, TextStatus>,
  saved: Record<Locale3, Record<string, string>>,
): LiveFields {
  if (!published) return {};
  const live: LiveFields = {};
  for (const target of ["ar", "es"] as const) {
    if (status[target] !== "published") continue;
    live[target] = Object.entries(saved[target])
      .filter(([, value]) => value.trim() !== "")
      .map(([field]) => field);
  }
  return live;
}

/**
 * "1250.00" -> "1,250.00" for the list. Strings only, no float: grouping is done on the digits. Anything that is not a
 * decimal string is returned as it came (the scenes pass a bracket placeholder).
 */
export function groupAmount(price: string): string {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (!m) return price;
  const whole = m[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return m[2] === undefined ? whole : `${whole}.${m[2].padEnd(2, "0")}`;
}

export type CatalogFilter = { kind: "" | CatalogKind; destinationId: string; stayId: string; query: string };
export const NO_CATALOG_FILTER: CatalogFilter = { kind: "", destinationId: "", stayId: "", query: "" };

export type CatalogFilterable = {
  position: number;
  kind: CatalogKind;
  name: string;
  destinationIds: string[];
  stayIds: string[];
};

/** Type, destination, stay and search together; accents folded; position order. */
export function filterCatalogRows<T extends CatalogFilterable>(rows: readonly T[], filter: CatalogFilter): T[] {
  const needle = foldText(filter.query.trim());
  return rows
    .filter((row) => (filter.kind === "" || row.kind === filter.kind))
    .filter((row) => filter.destinationId === "" || row.destinationIds.includes(filter.destinationId))
    .filter((row) => filter.stayId === "" || row.stayIds.includes(filter.stayId))
    .filter((row) => needle === "" || foldText(row.name).includes(needle))
    .slice()
    .sort((a, b) => a.position - b.position);
}

// ---- detail -> form ---------------------------------------------------------------------------------------------

type TextRecord = Record<string, string | string[] | null | undefined> | null;

/** One language's record as the form holds it: every field a string, "" for not set. */
function textFrom<K extends string>(fields: readonly K[], record: TextRecord): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const field of fields) {
    const value = record?.[field];
    out[field] = typeof value === "string" ? value : Array.isArray(value) ? value.join(" ") : "";
  }
  return out;
}

/** A language with no record is a draft-to-be: English is always published text. */
function statusFrom(translations: Record<Locale3, { status: TextStatus } | null>): Record<Locale3, TextStatus> {
  return { en: "published", ar: translations.ar?.status ?? "draft", es: translations.es?.status ?? "draft" };
}

export function destinationFormOf(detail: DestinationDetail): DestinationForm {
  const t = detail.translations;
  return {
    id: detail.id,
    slug: detail.slug,
    published: detail.is_published,
    hero: detail.hero,
    inset: detail.inset,
    text: {
      en: textFrom(DESTINATION_TEXT_FIELDS, t.en),
      ar: textFrom(DESTINATION_TEXT_FIELDS, t.ar),
      es: textFrom(DESTINATION_TEXT_FIELDS, t.es),
    },
    status: statusFrom(t),
  };
}

export function catalogItemFormOf(detail: CatalogDetail): CatalogItemForm {
  const t = detail.translations;
  return {
    id: detail.id,
    slug: detail.slug,
    published: detail.is_published,
    kind: detail.kind,
    unit: detail.unit,
    price: detail.price_aed ?? "",
    is_uae: detail.is_uae,
    is_home_pickup: detail.is_home_pickup,
    media: detail.image,
    destination_ids: [...detail.destination_ids],
    stay_ids: [...detail.stay_ids],
    text: {
      en: textFrom(CATALOG_TEXT_FIELDS, t.en),
      ar: textFrom(CATALOG_TEXT_FIELDS, t.ar),
      es: textFrom(CATALOG_TEXT_FIELDS, t.es),
    },
    status: statusFrom(t),
  };
}

/** The Arabic and Spanish the kit handed back on Save, put into the form (every value a string). */
export function withTranslations<T extends Record<string, string>, F extends { text: Record<Locale3, T> }>(form: F, translations: Record<Target, Fields>): F {
  const fields = Object.keys(form.text.en);
  const pick = (target: Target): T => ({ ...form.text[target], ...textFrom(fields, translations[target] as TextRecord) });
  return { ...form, text: { ...form.text, ar: pick("ar"), es: pick("es") } };
}

/** Two forms hold the same content (the editor's "unsaved changes"). */
export const sameForm = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- money ------------------------------------------------------------------------------------------------------

/**
 * What the owner typed in "Price in AED" as the contract's money (a decimal string with two decimals, never a float):
 * "" is not set (null); "1250" -> "1250.00"; "12.5" -> "12.50"; "0" -> "0.00"; anything else ("abc", "-1", "1.234",
 * "1,250", more than 10 whole digits) is refused before any request. The 10-digit cap is the server's MONEY
 * (lib/ops/validate.ts), counted after leading zeros go.
 */
export function normalisePrice(raw: string): { ok: true; value: string | null } | { ok: false } {
  const typed = raw.trim();
  if (typed === "") return { ok: true, value: null };
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(typed);
  if (!m) return { ok: false };
  const whole = m[1].replace(/^0+(?=\d)/, "");
  if (whole.length > 10) return { ok: false };
  return { ok: true, value: `${whole}.${(m[2] ?? "").padEnd(2, "0")}` };
}

// ---- form -> save payload -----------------------------------------------------------------------------------------

type SentRecord = Record<string, string | null>;

/**
 * One language's record for a save. English: always sent, published, optional fields empty -> null. Arabic and
 * Spanish: null when every field is empty (no record); left out when the name is empty but another field is not (the
 * server needs a name in a record; the language stays as it is); otherwise sent with `status`.
 */
function recordFor(text: Record<string, string>, status: TextStatus, english: boolean): SentRecord | null | undefined {
  const entries = Object.entries(text).map(([key, value]) => [key, value.trim()] as const);
  if (!english && entries.every(([, value]) => value === "")) return null;
  if (!english && (text.name ?? "").trim() === "") return undefined;
  const out: SentRecord = {};
  for (const [key, value] of entries) out[key] = key === "name" ? value : value === "" ? null : value;
  out.status = status;
  return out;
}

/** A language with text goes out published on Publish, or when it is published already (a Save never takes it off). */
const statusFor = (form: { status: Record<Locale3, TextStatus> }, target: Target, publish: boolean): TextStatus =>
  publish || form.status[target] === "published" ? "published" : "draft";

function translationsFor(form: { text: Record<Locale3, Record<string, string>>; status: Record<Locale3, TextStatus> }, publish: boolean) {
  const out: Record<string, SentRecord | null> = {};
  out.en = recordFor(form.text.en, "published", true) as SentRecord;
  for (const target of ["ar", "es"] as const) {
    const record = recordFor(form.text[target], statusFor(form, target, publish), false);
    if (record !== undefined) out[target] = record;
  }
  return out;
}

/** The `save` item of /api/ops/destinations. The web address is not sent once published (it cannot change). */
export function destinationPayload(form: DestinationForm, { publish }: { publish: boolean }): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  if (form.id !== null) item.id = form.id;
  if (!form.published) item.slug = form.slug.trim();
  item.hero_media_id = form.hero?.id ?? null;
  item.inset_media_id = form.inset?.id ?? null;
  item.translations = translationsFor(form, publish);
  return item;
}

/** The `save` item of /api/ops/catalog, or the refusal of a price that is not money (field price_aed). */
export function catalogItemPayload(form: CatalogItemForm, { publish }: { publish: boolean }): { ok: true; item: Record<string, unknown> } | { ok: false; field: "price_aed" } {
  const price = normalisePrice(form.price);
  if (!price.ok) return { ok: false, field: "price_aed" };
  const item: Record<string, unknown> = {};
  if (form.id !== null) item.id = form.id;
  if (!form.published) item.slug = form.slug.trim();
  item.kind = form.kind;
  item.unit = form.unit;
  item.price_aed = price.value;
  item.is_uae = form.is_uae;
  item.is_home_pickup = form.is_home_pickup;
  item.media_id = form.media?.id ?? null;
  item.destination_ids = [...form.destination_ids];
  item.stay_ids = [...form.stay_ids];
  item.translations = translationsFor(form, publish);
  return { ok: true, item };
}

// ---- list rows ----------------------------------------------------------------------------------------------------

/** The "Connected to" list of one destination's experiences and services: the items connected to it, with the new set. */
export function connectionChanges(items: readonly Pick<CatalogSummary, "id" | "destination_ids">[], destinationId: string, connected: readonly string[]): { id: string; destination_ids: string[] }[] {
  const want = new Set(connected);
  const out: { id: string; destination_ids: string[] }[] = [];
  for (const item of items) {
    const has = item.destination_ids.includes(destinationId);
    if (has === want.has(item.id)) continue;
    out.push({ id: item.id, destination_ids: has ? item.destination_ids.filter((id) => id !== destinationId) : [...item.destination_ids, destinationId] });
  }
  return out;
}

/** The full id list after moving one row up or down (by position), for `reorder`. Out of range: unchanged. */
export function movedIds(rows: readonly { id: string; position: number }[], id: string, by: -1 | 1): string[] {
  const ids = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => row.id);
  const at = ids.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ids.length) return ids;
  [ids[at], ids[to]] = [ids[to], ids[at]];
  return ids;
}

// ---- what a published item cannot lose by Save --------------------------------------------------------------------

/**
 * The gaps a published item cannot be saved with (review of PR #18): the facts with no language (its photo, its
 * destination) and English. ops_save does not re-check the publish rules, so a live item saved without them would stay
 * live. Arabic and Spanish gaps are the kit's: it fills them on Save, or holds the save of a live item.
 */
export function liveGaps(published: boolean, missing: readonly MissingItem[]): MissingItem[] {
  return published ? missing.filter((gap) => gap.locale === null || gap.locale === "en") : [];
}

/** The published items a destination-level change would leave with no destination (Publish needs one). */
export function strandedItems(
  items: readonly Pick<CatalogSummary, "id" | "destination_ids" | "is_published" | "name_en">[],
  destinationId: string,
  connected: readonly string[],
): { id: string; name: string }[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return connectionChanges(items, destinationId, connected)
    .filter((change) => change.destination_ids.length === 0 && byId.get(change.id)?.is_published === true)
    .map((change) => ({ id: change.id, name: byId.get(change.id)?.name_en ?? "" }));
}

/**
 * The connected set to save, from what the owner changed (`before` -> `after` in the picker) applied to the list read
 * just now: an item connected or removed elsewhere meanwhile is kept as it is now.
 */
export function connectedAfter(before: readonly string[], after: readonly string[], now: readonly string[]): string[] {
  const added = after.filter((id) => !before.includes(id));
  const removed = new Set(before.filter((id) => !after.includes(id)));
  return [...new Set([...now, ...added])].filter((id) => !removed.has(id));
}

/**
 * The form as the server holds it after a taken save, when the read-back did not come: the new id; and after a taken
 * Publish, published, with each language whose record was sent (it has a name) published too, so the next Save keeps
 * the site's Arabic and Spanish published and no longer sends the web address.
 */
export function afterSave<F extends { id: string | null; published: boolean; text: Record<Locale3, { name: string }>; status: Record<Locale3, TextStatus> }>(
  form: F,
  id: string,
  published: boolean,
): F {
  if (!published) return { ...form, id };
  const status = (target: Target): TextStatus => (form.text[target].name.trim() !== "" ? "published" : form.status[target]);
  return { ...form, id, published: true, status: { en: "published", ar: status("ar"), es: status("es") } };
}
