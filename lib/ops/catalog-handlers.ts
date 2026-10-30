// Plan 03.2-04: the owner API's handlers, one GET and one POST per endpoint of 03.2-API-CONTRACT.md §5.1-5.9. No Next
// import, so node tests call them against a local stack (tests/ops-api-local.test.mjs); the route files under
// app/api/ops bind them with lib/ops/route.ts, which has already run requireOwner(), the Origin check and the parse.
//
// Writes are always ONE service-role RPC (one transaction, research §4.4): never a chain of table writes from here.
// Reads that are not entity lists (rates, blocks, access) may be plain service-role selects. A database error is handed
// back as `{ dbError }` and mapped by the wrapper (mapDbError); nothing here logs, and no request body is ever logged.
// ids come from the query (GET) or the parsed body (POST), never from the path.

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { JourneyDetailWithLegs, JourneyLeg, JourneyLegText, Locale3, Translations } from "../../components/ops/api-types";
import { errorBody, type OpsOutcome, type OpsResult } from "./route-core";
import * as shape from "./shape";
import {
  parseBlocksQuery,
  parseCatalogQuery,
  parseIdQuery,
  parseRatesQuery,
  parseStayQuery,
  type AccessSave,
  type BlockAction,
  type EntityAction,
  type PublishEntity,
  type RateAction,
} from "./validate-catalog";

/** What a handler needs of requireOwner()'s owner: the profile id (blocks record who made them) and the admin client. */
export type OpsOwner = { profile: { id: string }; admin: SupabaseClient };
type GetCtx = { owner: OpsOwner; url: URL };
type PostCtx<B> = { owner: OpsOwner; body: B };
type Row = Record<string, unknown>;

function ok(body: Record<string, unknown>): OpsResult {
  return { body: { ok: true, ...body } };
}

function notFound(): OpsResult {
  return { status: 404, body: errorBody("not_found") };
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

// ---- shared list / detail / write ------------------------------------------------------------------------------------

type Entity = PublishEntity;

async function listOrDetail(
  owner: OpsOwner,
  entity: Entity,
  id: string | null,
  summary: (r: Row) => unknown,
  detail: (r: Row) => unknown,
  keep: (r: Row) => boolean = () => true,
): Promise<OpsOutcome> {
  if (id) {
    const { data, error } = await owner.admin.rpc("ops_get", { p_entity: entity, p_id: id });
    if (error) return { dbError: error };
    if (!isRow(data)) return notFound();
    return ok({ item: detail(data) });
  }
  const { data, error } = await owner.admin.rpc("ops_list", { p_entity: entity });
  if (error) return { dbError: error };
  return ok({ items: rows(data).filter(keep).map(summary) });
}

async function save(owner: OpsOwner, fn: string, item: Row): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc(fn, { p: item });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return ok({ id: out.id, affects_site: out.affects_site === true });
}

async function remove(owner: OpsOwner, entity: Entity, id: string): Promise<OpsOutcome> {
  const { error } = await owner.admin.rpc("ops_delete", { p_entity: entity, p_id: id });
  if (error) return { dbError: error };
  // Only an unpublished row can be deleted, so nothing on the public site changes.
  return ok({ id, affects_site: false });
}

async function reorder(owner: OpsOwner, entity: Entity, ids: string[]): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_reorder", { p_entity: entity, p_ids: ids });
  if (error) return { dbError: error };
  return ok({ affects_site: isRow(data) && data.affects_site === true });
}

function entityPost(owner: OpsOwner, entity: Entity, saveFn: string, body: EntityAction): Promise<OpsOutcome> {
  if (body.action === "save") return save(owner, saveFn, body.item);
  if (body.action === "delete") return remove(owner, entity, body.id);
  return reorder(owner, entity, body.ids);
}

async function exists(owner: OpsOwner, table: "stays" | "destinations", id: string): Promise<{ found: boolean; row: Row | null; error: PostgrestError | null }> {
  const columns = table === "stays" ? "id, destination_id, base_nightly_rate_aed" : "id";
  const { data, error } = await owner.admin.from(table).select(columns).eq("id", id).maybeSingle();
  return { found: isRow(data), row: isRow(data) ? data : null, error };
}

// ---- 5.1 destinations ------------------------------------------------------------------------------------------------

export async function getDestinations({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const id = parseIdQuery(url.searchParams);
  if (id) return listOrDetail(owner, "destination", id, shape.destinationSummary, shape.destinationDetail);
  // 04-09: the list also carries each destination's Arabic and Spanish name. ops_list (a live migration) gives the
  // English one only, so the other two come from the same table it reads, in one plain service-role select.
  const list = await owner.admin.rpc("ops_list", { p_entity: "destination" });
  if (list.error) return { dbError: list.error };
  const names = await owner.admin.from("destination_translations").select("destination_id, locale, name").in("locale", ["ar", "es"]);
  if (names.error) return { dbError: names.error };
  const byId = new Map<string, Row>();
  for (const n of rows(names.data)) {
    if (typeof n.destination_id !== "string") continue;
    const one = byId.get(n.destination_id) ?? {};
    if (n.locale === "ar") one.name_ar = n.name;
    if (n.locale === "es") one.name_es = n.name;
    byId.set(n.destination_id, one);
  }
  return ok({ items: rows(list.data).map((r) => shape.destinationSummary({ ...r, ...(byId.get(String(r.id)) ?? {}) })) });
}

export function postDestinations({ owner, body }: PostCtx<EntityAction>): Promise<OpsOutcome> {
  return entityPost(owner, "destination", "ops_save_destination", body);
}

// ---- 5.2 stays -------------------------------------------------------------------------------------------------------

export function getStays({ owner, url }: GetCtx): Promise<OpsOutcome> {
  return listOrDetail(owner, "stay", parseIdQuery(url.searchParams), shape.staySummary, shape.stayDetail);
}

export function postStays({ owner, body }: PostCtx<EntityAction>): Promise<OpsOutcome> {
  return entityPost(owner, "stay", "ops_save_stay", body);
}

// ---- 5.3 rates (affects_site false: rates are never baked, C-04) ------------------------------------------------------

export async function getStayRates({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const query = parseRatesQuery(url.searchParams);
  const stay = await exists(owner, "stays", query.stay_id);
  if (stay.error) return { dbError: stay.error };
  if (!stay.row) return notFound();

  const ranges = await owner.admin.from("stay_rates").select("id, nights, nightly_rate_aed").eq("stay_id", query.stay_id);
  if (ranges.error) return { dbError: ranges.error };
  const list = rows(ranges.data)
    .map(shape.rateRange)
    .sort((a, b) => (a.first_night === b.first_night ? a.nights - b.nights : a.first_night < b.first_night ? -1 : 1));

  const body: Record<string, unknown> = { stay_id: query.stay_id, base_nightly_rate_aed: shape.aed(stay.row.base_nightly_rate_aed), ranges: list };
  if (query.from && query.to) {
    const nights = await owner.admin.rpc("stay_night_rates", { p_stay: query.stay_id, p_from: query.from, p_to: query.to });
    if (nights.error) return { dbError: nights.error };
    body.nights = rows(nights.data).map(shape.rateNight);
  }
  return ok(body);
}

export async function postStayRates({ owner, body }: PostCtx<RateAction>): Promise<OpsOutcome> {
  if (body.action === "set_base") {
    const { data, error } = await owner.admin.rpc("ops_set_base_rate", { p_stay: body.stay_id, p_rate: body.base_nightly_rate_aed });
    if (error) return { dbError: error };
    const out = isRow(data) ? data : {};
    return ok({ id: body.stay_id, stay_id: body.stay_id, base_nightly_rate_aed: shape.aed(out.base_nightly_rate_aed), affects_site: false });
  }
  if (body.action === "save_range") {
    const { data, error } = await owner.admin.rpc("ops_save_stay_rate", { p: body.rate });
    if (error) return { dbError: error };
    return ok({ id: isRow(data) ? data.id : null, affects_site: false });
  }
  const { error } = await owner.admin.rpc("ops_delete_stay_rate", { p_id: body.id });
  if (error) return { dbError: error };
  return ok({ id: body.id, affects_site: false });
}

// ---- 5.4 availability blocks (affects_site true: blocked days are baked into the stay pages) ---------------------------

const BLOCK_COLUMNS = "id, scope, destination_id, stay_id, starts_on, ends_on, reason, created_at";

export async function getBlocks({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const query = parseBlocksQuery(url.searchParams);
  // Blocks that touch the window: they start on or before its last day and end on or after its first (both inclusive).
  let select = owner.admin.from("availability_blocks").select(BLOCK_COLUMNS).lte("starts_on", query.to).gte("ends_on", query.from);
  if (query.stay_id) {
    const stay = await exists(owner, "stays", query.stay_id);
    if (stay.error) return { dbError: stay.error };
    if (!stay.row) return notFound();
    // ids are parsed uuids, so they are safe inside the filter.
    select = select.or(`stay_id.eq.${query.stay_id},destination_id.eq.${String(stay.row.destination_id)},scope.eq.all`);
  } else if (query.destination_id) {
    const destination = await exists(owner, "destinations", query.destination_id);
    if (destination.error) return { dbError: destination.error };
    if (!destination.found) return notFound();
    select = select.or(`destination_id.eq.${query.destination_id},scope.eq.all`);
  }
  const { data, error } = await select.order("starts_on", { ascending: true }).order("created_at", { ascending: true });
  if (error) return { dbError: error };
  return ok({ blocks: rows(data).map(shape.block) });
}

export async function postBlocks({ owner, body }: PostCtx<BlockAction>): Promise<OpsOutcome> {
  if (body.action === "add") {
    const { data, error } = await owner.admin.rpc("ops_add_block", { p: { ...body.block, created_by: owner.profile.id } });
    if (error) return { dbError: error };
    const out = isRow(data) ? data : {};
    const overlapping = typeof out.overlapping_bookings === "number" ? out.overlapping_bookings : 0;
    return ok({ id: out.id, affects_site: true, overlapping_bookings: overlapping });
  }
  const { error } = await owner.admin.rpc("ops_delete_block", { p_id: body.id });
  if (error) return { dbError: error };
  return ok({ id: body.id, affects_site: true });
}

// ---- 5.5 stay access (C-14: owner only, no-store, never affects the site, never logged) -------------------------------

export async function getStayAccess({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const stayId = parseStayQuery(url.searchParams);
  const stay = await exists(owner, "stays", stayId);
  if (stay.error) return { dbError: stay.error };
  if (!stay.found) return notFound();
  const { data, error } = await owner.admin
    .from("stay_access")
    // Every column (the shape keeps only the card's): notes_locked exists only once 20261025120000 is applied, and a named
    // column would fail this read on a database without it.
    .select("*")
    .eq("stay_id", stayId)
    .maybeSingle();
  if (error) return { dbError: error };
  return ok({ stay_id: stayId, access: isRow(data) ? shape.stayAccess(data) : null });
}

export async function postStayAccess({ owner, body }: PostCtx<AccessSave>): Promise<OpsOutcome> {
  const { error } = await owner.admin.rpc("ops_save_stay_access", { p: { stay_id: body.stay_id, access: body.access } });
  if (error) return { dbError: error };
  return ok({ id: body.stay_id, stay_id: body.stay_id, affects_site: false });
}

// ---- 5.6 experiences and services --------------------------------------------------------------------------------------

export function getCatalog({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const query = parseCatalogQuery(url.searchParams);
  const keep = query.kind ? (r: Row) => r.kind === query.kind : undefined;
  return listOrDetail(owner, "catalog_item", query.id, shape.catalogSummary, shape.catalogDetail, keep);
}

export function postCatalog({ owner, body }: PostCtx<EntityAction>): Promise<OpsOutcome> {
  return entityPost(owner, "catalog_item", "ops_save_catalog_item", body);
}

// ---- 5.7 team --------------------------------------------------------------------------------------------------------

export function getTeam({ owner, url }: GetCtx): Promise<OpsOutcome> {
  return listOrDetail(owner, "team_member", parseIdQuery(url.searchParams), shape.teamSummary, shape.teamDetail);
}

export function postTeam({ owner, body }: PostCtx<EntityAction>): Promise<OpsOutcome> {
  return entityPost(owner, "team_member", "ops_save_team_member", body);
}

// ---- 5.8 journeys (create, edit, legs, add-ons, delete while hidden, reorder; show/hide is /api/ops/publish) ------------------

/** A leg's language records as ops_get holds them, keeping only the contract's keys. */
function legTranslations(value: unknown): Translations<JourneyLegText> {
  const all = isRow(value) ? value : {};
  const one = (locale: Locale3): Translations<JourneyLegText>[Locale3] => {
    const rec = all[locale];
    if (!isRow(rec)) return null;
    const locked = Array.isArray(rec.locked_fields) ? rec.locked_fields.filter((x): x is string => typeof x === "string") : [];
    return {
      nights_label: typeof rec.nights_label === "string" ? rec.nights_label : null,
      status: rec.status === "published" ? "published" : "draft",
      ...(locale === "en" ? {} : { locked_fields: locked }),
    };
  };
  return { en: one("en"), ar: one("ar"), es: one("es") };
}

/** The detail reply with the legs and included add-ons ops_get answers since migration 20261025120000 (none before it). */
function journeyDetail(r: Row): JourneyDetailWithLegs {
  const legs: JourneyLeg[] = rows(r.legs).map((leg) => ({
    id: String(leg.id),
    position: typeof leg.position === "number" ? leg.position : 0,
    destination_id: String(leg.destination_id),
    stay_id: typeof leg.stay_id === "string" ? leg.stay_id : null,
    translations: legTranslations(leg.translations),
  }));
  const addons = Array.isArray(r.addon_ids) ? r.addon_ids.filter((id): id is string => typeof id === "string") : [];
  return { ...shape.journeyDetail(r), legs, addon_ids: addons };
}

export function getJourneys({ owner, url }: GetCtx): Promise<OpsOutcome> {
  return listOrDetail(owner, "journey_tier", parseIdQuery(url.searchParams), shape.journeySummary, journeyDetail);
}

export function postJourneys({ owner, body }: PostCtx<EntityAction>): Promise<OpsOutcome> {
  return entityPost(owner, "journey_tier", "ops_save_journey_tier", body);
}

// ---- 5.9 publish -----------------------------------------------------------------------------------------------------

const PUBLISH_REFUSALS = ["publish_incomplete", "amenities_mismatch", "parent_unpublished", "has_published_stays"] as const;
const PLAIN_FIELD = /^[a-z_]+$/;

function missingList(value: unknown): { locale: "en" | "ar" | "es" | null; field: string }[] {
  return rows(value)
    .filter((m) => typeof m.field === "string" && PLAIN_FIELD.test(m.field))
    .map((m) => ({ locale: m.locale === "en" || m.locale === "ar" || m.locale === "es" ? m.locale : null, field: m.field as string }));
}

export async function postPublish({ owner, body }: PostCtx<{ entity: PublishEntity; id: string; published: boolean }>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_publish", { p_entity: body.entity, p_id: body.id, p_published: body.published });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  if (out.ok !== true) {
    const code = (PUBLISH_REFUSALS as readonly unknown[]).includes(out.code) ? (out.code as string) : null;
    if (!code) return { dbError: { code: "unknown_refusal" } };
    const detail = code === "publish_incomplete" || code === "amenities_mismatch" ? { missing: missingList(out.missing) } : null;
    return { status: 409, body: errorBody(code, null, null, detail) };
  }
  const warnings = rows(out.warnings)
    .map((w) => w.code)
    .filter((c): c is "no_base_rate" | "no_price" => c === "no_base_rate" || c === "no_price")
    .map((c) => ({ code: c }));
  return ok({ id: body.id, is_published: out.is_published === true, affects_site: true, warnings });
}
