// Plan 03.2-04: one parse function per owner endpoint (03.2-API-CONTRACT.md §5.1-5.9). Each takes the JSON body (or the
// query of a GET) and returns the RPC payload already shaped as §2.4 expects: snake_case keys, money as 2-decimal
// strings, days as YYYY-MM-DD. The first bad field throws OpsInvalid (400 invalid, contract §1.1).
//
// Save semantics (§1.2): a key the screen did not send is not in the payload, so the database leaves that column or
// join set alone; null and [] are values. On create the slug, the required facts and the English record are needed.
// Unknown keys are refused (a screen typo fails loudly instead of being dropped). `is_published` and `position` are
// never accepted in a save: Publish and reorder have their own actions.
//
// These rules mirror the checks of 20261005100000_catalog_and_team.sql. Where they differ, the app is the narrower one
// and the test says why (pets fee only with its rule in the same save; a field cap); never so narrow that content the
// owner already has could not be saved again (the caps sit above the longest imported text).

import { isEmail } from "../auth/rules";
import { parseTierPrice } from "./journey-price";
import { OpsInvalid } from "./route-core";
import {
  CAPS,
  bool,
  boolOrNull,
  daysBetween,
  has,
  int,
  intOrNull,
  isoDay,
  money,
  moneyOrNull,
  onlyKeys,
  rawText,
  record,
  slug,
  text,
  translations,
  uuid,
  uuidList,
  uuidOrNull,
  type TextSpec,
  type TranslationsPayload,
} from "./validate";

type Payload = Record<string, unknown>;

export type SaveAction = { action: "save"; item: Payload };
export type DeleteAction = { action: "delete"; id: string };
export type ReorderAction = { action: "reorder"; ids: string[] };
export type EntityAction = SaveAction | DeleteAction | ReorderAction;

// ---- the text specs (contract §2.1 translation tables) -----------------------------------------------------------------

const NAME = { kind: "text", max: CAPS.name } as const;
const LABEL = { kind: "text", max: CAPS.label } as const;
const PARAGRAPH = { kind: "text", max: CAPS.paragraph } as const;
const SHORT_LIST = { kind: "list", max: CAPS.name } as const;
const PARAGRAPH_LIST = { kind: "list", max: CAPS.paragraph } as const;

export const DESTINATION_TEXT: TextSpec = {
  required: ["name"],
  fields: { name: NAME, short_line: NAME, region: NAME, summary: PARAGRAPH, nights_label: LABEL },
};

export const STAY_TEXT: TextSpec = {
  required: ["title"],
  fields: {
    title: NAME,
    tagline: NAME,
    neighborhood: NAME,
    guests_label: LABEL,
    bathrooms_label: LABEL,
    beds_label: LABEL,
    price_label: LABEL,
    price_note: PARAGRAPH,
    description: PARAGRAPH_LIST,
    amenities: SHORT_LIST,
    inclusions: SHORT_LIST,
    policy_headings: SHORT_LIST,
  },
};

export const CATALOG_TEXT: TextSpec = {
  required: ["name"],
  fields: { name: NAME, summary: PARAGRAPH, duration_label: LABEL },
};

export const TEAM_TEXT: TextSpec = {
  required: ["name"],
  fields: { name: NAME, role: NAME, bio: PARAGRAPH },
};

export const JOURNEY_TEXT: TextSpec = {
  required: ["name", "price_label"],
  fields: { name: NAME, price_label: NAME, tagline: NAME, duration_label: LABEL, ideal_for_label: LABEL, ideal_for: PARAGRAPH, body: PARAGRAPH },
};

// ---- shared pieces ---------------------------------------------------------------------------------------------------

function bodyOf(value: unknown): Payload {
  return record(value, "body");
}

function action<T extends string>(body: Payload, allowed: readonly T[]): T {
  const value = body.action;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new OpsInvalid("action");
  return value as T;
}

function deleteAction(body: Payload): DeleteAction {
  onlyKeys(body, ["action", "id"]);
  return { action: "delete", id: uuid(body.id, "id") };
}

function reorderAction(body: Payload): ReorderAction {
  onlyKeys(body, ["action", "ids"]);
  return { action: "reorder", ids: uuidList(body.ids, "ids", { min: 1 }) };
}

/** The item of a save, its id (absent or null = create) and the item keys allowed for this entity. */
function saveItem(body: Payload, keys: readonly string[]): { item: Payload; out: Payload; create: boolean } {
  onlyKeys(body, ["action", "item"]);
  const item = record(body.item, "item");
  onlyKeys(item, ["id", ...keys]);
  const create = item.id === undefined || item.id === null;
  const out: Payload = {};
  if (!create) out.id = uuid(item.id, "id");
  return { item, out, create };
}

function slugField(item: Payload, out: Payload, create: boolean): void {
  if (has(item, "slug")) out.slug = slug(item.slug, "slug");
  else if (create) throw new OpsInvalid("slug");
}

function translationsField(item: Payload, out: Payload, spec: TextSpec, create: boolean): TranslationsPayload | null {
  if (!has(item, "translations")) {
    if (create) throw new OpsInvalid("translations.en", "en");
    return null;
  }
  const value = translations(item.translations, spec, { create });
  out.translations = value;
  return value;
}

function mediaField(item: Payload, out: Payload, key: string): void {
  if (has(item, key)) out[key] = uuidOrNull(item[key], key);
}

// ---- 5.1 destinations ------------------------------------------------------------------------------------------------

export function parseDestinationAction(value: unknown): EntityAction {
  const body = bodyOf(value);
  const kind = action(body, ["save", "delete", "reorder"] as const);
  if (kind === "delete") return deleteAction(body);
  if (kind === "reorder") return reorderAction(body);
  const { item, out, create } = saveItem(body, ["slug", "hero_media_id", "inset_media_id", "translations"]);
  slugField(item, out, create);
  mediaField(item, out, "hero_media_id");
  mediaField(item, out, "inset_media_id");
  translationsField(item, out, DESTINATION_TEXT, create);
  return { action: "save", item: out };
}

// ---- 5.2 stays -------------------------------------------------------------------------------------------------------

const STAY_KEYS = [
  "slug",
  "destination_id",
  "max_guests",
  "min_guests",
  "bedrooms",
  "bathrooms",
  "min_nights",
  "pets_rule",
  "pets_fee_aed",
  "infants_count",
  "hero_media_id",
  "gallery_media_ids",
  "translations",
  "connections",
] as const;

const PETS_RULES = ["allowed", "not_allowed", "fee"] as const;

function amenitiesFollowEnglish(tr: TranslationsPayload | null): void {
  const en = tr?.en?.amenities;
  if (!Array.isArray(en)) return;
  for (const locale of ["ar", "es"] as const) {
    const list = tr?.[locale]?.amenities;
    // An empty list is a draft in progress (the database lets a draft hold it; Publish refuses it).
    if (Array.isArray(list) && list.length > 0 && list.length !== en.length) {
      throw new OpsInvalid(`translations.${locale}.amenities`, locale);
    }
  }
}

export function parseStayAction(value: unknown): EntityAction {
  const body = bodyOf(value);
  const kind = action(body, ["save", "delete", "reorder"] as const);
  if (kind === "delete") return deleteAction(body);
  if (kind === "reorder") return reorderAction(body);
  const { item, out, create } = saveItem(body, STAY_KEYS);
  slugField(item, out, create);

  if (has(item, "destination_id")) out.destination_id = uuid(item.destination_id, "destination_id");
  else if (create) throw new OpsInvalid("destination_id");

  for (const key of ["max_guests", "min_guests", "bedrooms", "bathrooms"] as const) {
    if (has(item, key)) out[key] = intOrNull(item[key], key, { min: 0 });
  }
  if (has(item, "min_nights")) out.min_nights = int(item.min_nights, "min_nights", { min: 1 });
  else if (create) out.min_nights = 1;

  // STAY-05: the fee goes with its rule, in the same save, so the database check (fee iff rule = fee) always holds.
  if (has(item, "pets_rule")) {
    const rule = item.pets_rule;
    if (rule !== null && !(PETS_RULES as readonly unknown[]).includes(rule)) throw new OpsInvalid("pets_rule");
    out.pets_rule = rule;
    if (rule === "fee") {
      if (!has(item, "pets_fee_aed") || item.pets_fee_aed === null) throw new OpsInvalid("pets_fee_aed");
      out.pets_fee_aed = money(item.pets_fee_aed, "pets_fee_aed", { positive: true });
    } else {
      if (has(item, "pets_fee_aed") && item.pets_fee_aed !== null) throw new OpsInvalid("pets_fee_aed");
      out.pets_fee_aed = null;
    }
  } else if (has(item, "pets_fee_aed")) {
    throw new OpsInvalid("pets_rule");
  }

  if (has(item, "infants_count")) out.infants_count = boolOrNull(item.infants_count, "infants_count");
  mediaField(item, out, "hero_media_id");
  if (has(item, "gallery_media_ids")) out.gallery_media_ids = uuidList(item.gallery_media_ids, "gallery_media_ids", { max: CAPS.items });

  if (has(item, "connections")) {
    const conn = record(item.connections, "connections");
    onlyKeys(conn, ["experience_ids", "service_ids"], "connections.");
    const links: Payload = {};
    for (const key of ["experience_ids", "service_ids"] as const) {
      if (has(conn, key)) links[key] = uuidList(conn[key], `connections.${key}`, { max: 200 });
    }
    out.connections = links;
  }

  amenitiesFollowEnglish(translationsField(item, out, STAY_TEXT, create));
  return { action: "save", item: out };
}

// ---- 5.3 rates -------------------------------------------------------------------------------------------------------

export type RateAction =
  | { action: "set_base"; stay_id: string; base_nightly_rate_aed: string | null }
  | { action: "save_range"; rate: { id?: string; stay_id: string; first_night: string; last_night: string; nightly_rate_aed: string } }
  | { action: "delete_range"; id: string };

/** At most 730 nights in one range (the database's own limit). */
const MAX_RANGE_NIGHTS = 730;

export function parseRateAction(value: unknown): RateAction {
  const body = bodyOf(value);
  const kind = action(body, ["set_base", "save_range", "delete_range"] as const);
  if (kind === "delete_range") {
    onlyKeys(body, ["action", "id"]);
    return { action: "delete_range", id: uuid(body.id, "id") };
  }
  if (kind === "set_base") {
    onlyKeys(body, ["action", "stay_id", "base_nightly_rate_aed"]);
    const stay = uuid(body.stay_id, "stay_id");
    if (!has(body, "base_nightly_rate_aed")) throw new OpsInvalid("base_nightly_rate_aed");
    return { action: "set_base", stay_id: stay, base_nightly_rate_aed: moneyOrNull(body.base_nightly_rate_aed, "base_nightly_rate_aed", { positive: true }) };
  }
  onlyKeys(body, ["action", "stay_id", "range"]);
  const stay = uuid(body.stay_id, "stay_id");
  const range = record(body.range, "range");
  onlyKeys(range, ["id", "first_night", "last_night", "nightly_rate_aed"], "range.");
  const first = isoDay(range.first_night, "range.first_night");
  const last = isoDay(range.last_night, "range.last_night");
  const nights = daysBetween(first, last) + 1;
  if (nights < 1 || nights > MAX_RANGE_NIGHTS) throw new OpsInvalid("range.last_night");
  const rate: { id?: string; stay_id: string; first_night: string; last_night: string; nightly_rate_aed: string } = {
    stay_id: stay,
    first_night: first,
    last_night: last,
    nightly_rate_aed: money(range.nightly_rate_aed, "range.nightly_rate_aed", { positive: true }),
  };
  if (range.id !== undefined && range.id !== null) rate.id = uuid(range.id, "range.id");
  return { action: "save_range", rate };
}

/** The rate preview reads at most 366 nights (contract §5.3). */
const MAX_PREVIEW_NIGHTS = 366;

/** GET /api/ops/stay-rates: stay_id, and from + to together (nights [from, to), to is the check-out day). */
export function parseRatesQuery(query: URLSearchParams): { stay_id: string; from: string | null; to: string | null } {
  const stay = uuid(query.get("stay_id"), "stay_id");
  const rawFrom = query.get("from");
  const rawTo = query.get("to");
  if (rawFrom === null && rawTo === null) return { stay_id: stay, from: null, to: null };
  if (rawFrom === null) throw new OpsInvalid("from");
  if (rawTo === null) throw new OpsInvalid("to");
  const from = isoDay(rawFrom, "from");
  const to = isoDay(rawTo, "to");
  const nights = daysBetween(from, to);
  if (nights < 1 || nights > MAX_PREVIEW_NIGHTS) throw new OpsInvalid("to");
  return { stay_id: stay, from, to };
}

// ---- 5.4 blocks ------------------------------------------------------------------------------------------------------

export type BlockAction =
  | { action: "add"; block: { scope: "all" | "destination" | "stay"; destination_id: string | null; stay_id: string | null; starts_on: string; ends_on: string; reason: string | null } }
  | { action: "delete"; id: string };

const SCOPES = ["all", "destination", "stay"] as const;

export function parseBlockAction(value: unknown): BlockAction {
  const body = bodyOf(value);
  const kind = action(body, ["add", "delete"] as const);
  if (kind === "delete") return deleteAction(body) as { action: "delete"; id: string };
  onlyKeys(body, ["action", "block"]);
  const block = record(body.block, "block");
  onlyKeys(block, ["scope", "destination_id", "stay_id", "starts_on", "ends_on", "reason"], "block.");
  const scope = block.scope;
  if (typeof scope !== "string" || !(SCOPES as readonly string[]).includes(scope)) throw new OpsInvalid("block.scope");

  const target = (key: "destination_id" | "stay_id", needed: boolean): string | null => {
    const raw = block[key];
    if (needed) return uuid(raw, `block.${key}`);
    if (raw !== undefined && raw !== null) throw new OpsInvalid(`block.${key}`);
    return null;
  };
  const stay = target("stay_id", scope === "stay");
  const destination = target("destination_id", scope === "destination");
  const startsOn = isoDay(block.starts_on, "block.starts_on");
  const endsOn = isoDay(block.ends_on, "block.ends_on");
  if (endsOn < startsOn) throw new OpsInvalid("block.ends_on");
  return {
    action: "add",
    block: {
      scope: scope as "all" | "destination" | "stay",
      stay_id: stay,
      destination_id: destination,
      starts_on: startsOn,
      ends_on: endsOn,
      reason: text(block.reason, "block.reason", { max: 300 }),
    },
  };
}

/** A blocks window holds at most 400 days (from and to inclusive, contract §5.4). */
const MAX_WINDOW_DAYS = 400;

export function parseBlocksQuery(query: URLSearchParams): { from: string; to: string; stay_id: string | null; destination_id: string | null } {
  const from = isoDay(query.get("from"), "from");
  const to = isoDay(query.get("to"), "to");
  const days = daysBetween(from, to) + 1;
  if (days < 1 || days > MAX_WINDOW_DAYS) throw new OpsInvalid("to");
  const stay = query.get("stay_id");
  const destination = query.get("destination_id");
  if (stay !== null && destination !== null) throw new OpsInvalid("destination_id");
  return {
    from,
    to,
    stay_id: stay === null ? null : uuid(stay, "stay_id"),
    destination_id: destination === null ? null : uuid(destination, "destination_id"),
  };
}

// ---- 5.5 stay access -------------------------------------------------------------------------------------------------

const ACCESS_MAX = 2000;

export type AccessSave = { action: "save"; stay_id: string; access: Record<string, string | null> };

/** Address, wifi name and notes are trimmed; the wifi password and the door code are kept exactly as typed. */
export function parseAccessSave(value: unknown): AccessSave {
  const body = bodyOf(value);
  action(body, ["save"] as const);
  onlyKeys(body, ["action", "stay_id", "access"]);
  const stay = uuid(body.stay_id, "stay_id");
  const access = record(body.access, "access");
  onlyKeys(access, ["address", "wifi_name", "wifi_password", "door_code", "notes"], "access.");
  const out: Record<string, string | null> = {};
  for (const key of ["address", "wifi_name", "notes"] as const) {
    if (has(access, key)) out[key] = text(access[key], `access.${key}`, { max: ACCESS_MAX });
  }
  for (const key of ["wifi_password", "door_code"] as const) {
    if (has(access, key)) out[key] = rawText(access[key], `access.${key}`, { max: ACCESS_MAX });
  }
  return { action: "save", stay_id: stay, access: out };
}

// ---- 5.6 experiences and services ------------------------------------------------------------------------------------

const KINDS = ["experience", "service"] as const;
const UNITS = ["person", "night", "trip"] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new OpsInvalid(field);
  return value as T;
}

export function parseCatalogAction(value: unknown): EntityAction {
  const body = bodyOf(value);
  const kind = action(body, ["save", "delete", "reorder"] as const);
  if (kind === "delete") return deleteAction(body);
  if (kind === "reorder") return reorderAction(body);
  const { item, out, create } = saveItem(body, [
    "slug",
    "kind",
    "unit",
    "price_aed",
    "is_uae",
    "is_home_pickup",
    "media_id",
    "destination_ids",
    "stay_ids",
    "translations",
  ]);
  slugField(item, out, create);
  if (has(item, "kind")) out.kind = oneOf(item.kind, KINDS, "kind");
  else if (create) throw new OpsInvalid("kind");
  if (has(item, "unit")) out.unit = oneOf(item.unit, UNITS, "unit");
  else if (create) throw new OpsInvalid("unit");
  if (has(item, "price_aed")) out.price_aed = moneyOrNull(item.price_aed, "price_aed");
  if (has(item, "is_uae")) out.is_uae = bool(item.is_uae, "is_uae");
  if (has(item, "is_home_pickup")) out.is_home_pickup = bool(item.is_home_pickup, "is_home_pickup");
  mediaField(item, out, "media_id");
  if (has(item, "destination_ids")) out.destination_ids = uuidList(item.destination_ids, "destination_ids");
  if (has(item, "stay_ids")) out.stay_ids = uuidList(item.stay_ids, "stay_ids");
  translationsField(item, out, CATALOG_TEXT, create);
  return { action: "save", item: out };
}

export function parseCatalogQuery(query: URLSearchParams): { id: string | null; kind: "experience" | "service" | null } {
  const kind = query.get("kind");
  return { id: parseIdQuery(query), kind: kind === null ? null : oneOf(kind, KINDS, "kind") };
}

// ---- 5.7 team --------------------------------------------------------------------------------------------------------

const MAX_LINKS = 8;

function teamLinks(value: unknown): { label: string; url: string }[] {
  if (!Array.isArray(value) || value.length > MAX_LINKS) throw new OpsInvalid("links");
  return value.map((entry, i) => {
    const link = record(entry, `links.${i}`);
    onlyKeys(link, ["label", "url"], `links.${i}.`);
    const label = text(link.label, `links.${i}.label`, { max: 40 });
    if (label === null) throw new OpsInvalid(`links.${i}.label`);
    const url = typeof link.url === "string" ? link.url.trim() : "";
    let https = false;
    try {
      const parsed = new URL(url);
      https = parsed.protocol === "https:" && parsed.hostname.length > 0;
    } catch {
      https = false;
    }
    if (!https || url.length > 300 || !/^https:\/\/[^\s]+$/.test(url)) throw new OpsInvalid(`links.${i}.url`);
    return { label, url };
  });
}

export function parseTeamAction(value: unknown): EntityAction {
  const body = bodyOf(value);
  const kind = action(body, ["save", "delete", "reorder"] as const);
  if (kind === "delete") return deleteAction(body);
  if (kind === "reorder") return reorderAction(body);
  const { item, out, create } = saveItem(body, ["slug", "photo_media_id", "email", "links", "translations"]);
  slugField(item, out, create);
  mediaField(item, out, "photo_media_id");
  if (has(item, "email")) {
    const email = text(item.email, "email", { max: 254 });
    if (email !== null && !isEmail(email)) throw new OpsInvalid("email");
    out.email = email;
  }
  if (has(item, "links")) out.links = teamLinks(item.links);
  translationsField(item, out, TEAM_TEXT, create);
  return { action: "save", item: out };
}

// ---- 5.8 journeys ----------------------------------------------------------------------------------------------------

/**
 * Existing ids only (C-15: no create, no delete in v1). When the English record is sent it carries both the name and
 * the price label, and the five structured price columns are re-derived from that label (lib/ops/journey-price.ts);
 * a save without English leaves them as they are, so they always agree with the stored label.
 */
export function parseJourneyAction(value: unknown): SaveAction | ReorderAction {
  const body = bodyOf(value);
  const kind = action(body, ["save", "reorder"] as const);
  if (kind === "reorder") return reorderAction(body);
  onlyKeys(body, ["action", "item"]);
  const item = record(body.item, "item");
  onlyKeys(item, ["id", "is_featured", "media_id", "translations"]);
  const out: Payload = { id: uuid(item.id, "id") };
  if (has(item, "is_featured")) out.is_featured = bool(item.is_featured, "is_featured");
  mediaField(item, out, "media_id");
  const tr = translationsField(item, out, JOURNEY_TEXT, false);
  const en = tr?.en;
  if (en) {
    for (const key of JOURNEY_TEXT.required) {
      if (typeof en[key] !== "string") throw new OpsInvalid(`translations.en.${key}`, "en");
    }
    const price = parseTierPrice(en.price_label as string);
    out.price_from_amount = price.price_from?.amount ?? null;
    out.price_from_currency = price.price_from?.currency ?? null;
    out.est_low = price.price_estimate?.low ?? null;
    out.est_high = price.price_estimate?.high ?? null;
    out.est_open_ended = price.price_estimate ? price.price_estimate.open_ended : null;
  }
  return { action: "save", item: out };
}

// ---- 5.9 publish -----------------------------------------------------------------------------------------------------

export const PUBLISH_ENTITIES = ["destination", "stay", "catalog_item", "team_member", "journey_tier"] as const;
export type PublishEntity = (typeof PUBLISH_ENTITIES)[number];

export function parsePublish(value: unknown): { entity: PublishEntity; id: string; published: boolean } {
  const body = bodyOf(value);
  onlyKeys(body, ["entity", "id", "published"]);
  return {
    entity: oneOf(body.entity, PUBLISH_ENTITIES, "entity"),
    id: uuid(body.id, "id"),
    published: bool(body.published, "published"),
  };
}

// ---- GET queries -----------------------------------------------------------------------------------------------------

/** `?id=` of a list endpoint: absent -> the list, a uuid -> the detail. */
export function parseIdQuery(query: URLSearchParams): string | null {
  const id = query.get("id");
  return id === null ? null : uuid(id, "id");
}

/** A uuid query parameter that must be present (stay-access ?stay_id=). */
export function parseStayQuery(query: URLSearchParams): string {
  return uuid(query.get("stay_id"), "stay_id");
}

