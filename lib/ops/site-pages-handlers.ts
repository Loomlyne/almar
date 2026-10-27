// Plan 06-02: the handlers of /api/ops/pages, /api/ops/page-items and /api/ops/nav, on the functions of migration
// 20261025120000_site_cms.sql. Same rules as catalog-handlers.ts: writes are ONE service-role RPC, a database error goes
// back as { dbError } (mapped by the wrapper), nothing is logged. Every write answers affects_site: true, so opsPost asks
// for the site update (C-01…C-03); no rebuild code here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_KEYS, sectionSpec, type PageKey } from "../data/page-sections";
import { PUBLIC_PAGES } from "../locale-path";
import { JOURNEY_PREFIX, NAV_TARGET_KEYS, targetAvailable, type BuiltPages } from "../site-nav";
import { errorBody, type OpsOutcome, type OpsResult } from "./route-core";
import type { PageItemsBody, SaveNavBody, SavePageSectionBody } from "./site-cms-api";
import { checkSectionSave, parsePagesQuery } from "./validate-site-pages";

type OpsOwner = { profile: { id: string }; admin: SupabaseClient };
type GetCtx = { owner: OpsOwner; url: URL };
type PostCtx<B> = { owner: OpsOwner; body: B };
type Row = Record<string, unknown>;

/**
 * The owner's answer to the 06-02 picture question 2. A: each page's hero is always shown (no Show on site on a hero);
 * B: every section can be hidden. Until the answer is recorded, B's behaviour holds (the database allows both).
 */
export const HERO_FIXED = false;

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

// ---- pages -----------------------------------------------------------------------------------------------------------

/** One line of the page list: how many of its sections are on the site. */
export type PageSummary = { page: PageKey; shown: number; total: number };

export async function getPages({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const { page, id } = parsePagesQuery(url.searchParams);
  if (id) {
    const { data, error } = await owner.admin.rpc("ops_get", { p_entity: "page_section", p_id: id });
    if (error) return { dbError: error };
    return isRow(data) ? ok({ item: data }) : notFound();
  }
  if (page) {
    const { data, error } = await owner.admin.rpc("ops_list_page", { p_page: page });
    if (error) return { dbError: error };
    return ok({ item: isRow(data) ? data : { page, sections: [] } });
  }
  const { data, error } = await owner.admin.rpc("ops_list", { p_entity: "page_section" });
  if (error) return { dbError: error };
  const list = rows(data);
  const items: PageSummary[] = PAGE_KEYS.map((key) => {
    const mine = list.filter((r) => r.page === key);
    return { page: key, shown: mine.filter((r) => r.is_shown === true).length, total: mine.length };
  });
  return ok({ items });
}

export async function postPages({ owner, body }: PostCtx<SavePageSectionBody>): Promise<OpsOutcome> {
  const found = await owner.admin.from("page_sections").select("page, section").eq("id", body.id).maybeSingle();
  if (found.error) return { dbError: found.error };
  if (!isRow(found.data)) return notFound();
  const spec = (PAGE_KEYS as readonly unknown[]).includes(found.data.page)
    ? sectionSpec(found.data.page as PageKey, String(found.data.section))
    : undefined;
  if (!spec) return notFound();
  checkSectionSave(body, spec, { heroFixed: HERO_FIXED });
  const { data, error } = await owner.admin.rpc("ops_save_page_section", { p: body });
  if (error) return { dbError: error };
  return ok({ id: isRow(data) ? data.id : body.id, affects_site: true });
}

// ---- About cards -------------------------------------------------------------------------------------------------------

export async function postPageItems({ owner, body }: PostCtx<PageItemsBody>): Promise<OpsOutcome> {
  if (body.action === "delete") {
    const { error } = await owner.admin.rpc("ops_delete", { p_entity: "page_item", p_id: body.id });
    if (error) return { dbError: error };
    return ok({ id: body.id, affects_site: true });
  }
  if (body.action === "reorder") {
    const { error } = await owner.admin.rpc("ops_reorder", { p_entity: "page_item", p_ids: body.ids });
    if (error) return { dbError: error };
    return ok({ affects_site: true });
  }
  const { action: _action, ...item } = body;
  const { data, error } = await owner.admin.rpc("ops_save_page_item", { p: item });
  if (error) return { dbError: error };
  return ok({ id: isRow(data) ? data.id : null, affects_site: true });
}

// ---- header and footer -----------------------------------------------------------------------------------------------

/** A page a link may point to. `name`: a package's English name (the other labels are the dashboard copy's). */
export type NavTargetOption = { key: string; available: boolean; name?: string };
export type NavReply = { header: Row[]; footer: Row[]; targets: NavTargetOption[] };

const LEGAL_KINDS = ["privacy", "terms", "booking_terms", "waiver", "disclaimer"];

function allPublished(state: unknown): boolean {
  return isRow(state) && ["en", "ar", "es"].every((l) => state[l] === "published");
}

export async function getNav({ owner }: GetCtx): Promise<OpsOutcome> {
  const [links, legal, tiers] = await Promise.all([
    owner.admin.rpc("ops_list", { p_entity: "nav_link" }),
    owner.admin.rpc("ops_list", { p_entity: "legal_page" }),
    owner.admin.rpc("ops_list", { p_entity: "journey_tier" }),
  ]);
  if (links.error) return { dbError: links.error };
  if (legal.error) return { dbError: legal.error };
  if (tiers.error) return { dbError: tiers.error };
  const packages = rows(tiers.data);
  const built: BuiltPages = {
    pages: PUBLIC_PAGES,
    legal: rows(legal.data)
      .filter((r) => LEGAL_KINDS.includes(String(r.kind)) && r.is_published === true && allPublished(r.translation_state))
      .map((r) => String(r.kind)),
    packages: packages.filter((r) => r.is_published === true).map((r) => String(r.slug)),
  };
  const targets: NavTargetOption[] = [
    ...NAV_TARGET_KEYS.map((key) => ({ key, available: targetAvailable(key, built) })),
    ...packages.map((r) => {
      const key = `${JOURNEY_PREFIX}${String(r.slug)}`;
      return { key, available: targetAvailable(key, built), name: typeof r.name_en === "string" ? r.name_en : String(r.slug) };
    }),
  ];
  const all = rows(links.data);
  const reply: NavReply = { header: all.filter((r) => r.area === "header"), footer: all.filter((r) => r.area === "footer"), targets };
  return ok(reply);
}

export async function postNav({ owner, body }: PostCtx<SaveNavBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_save_nav", { p_area: body.area, p_links: body.links });
  if (error) return { dbError: error };
  return ok({ area: body.area, ids: isRow(data) && Array.isArray(data.ids) ? data.ids : [], affects_site: true });
}
