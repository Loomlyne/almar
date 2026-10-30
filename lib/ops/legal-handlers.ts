// Plan 06-04: the handlers of /api/ops/legal on migration 20261025120000_site_cms.sql (ops_list / ops_get('legal_page'),
// ops_save_legal_page). Same rules as posts-handlers.ts: one service-role RPC per write, a database refusal goes back as
// { dbError } for mapDbError, nothing is logged. Publish and unpublish stay on /api/ops/publish (entity legal_page). Save
// answers the function's affects_site, so opsPost asks for the site update (C-01/C-03).

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorBody, type OpsOutcome, type OpsResult } from "./route-core";
import type { SaveLegalBody } from "./site-cms-api";
import { parseLegalQuery } from "./validate-legal";

type OpsOwner = { profile: { id: string }; admin: SupabaseClient };
type GetCtx = { owner: OpsOwner; url: URL };
type PostCtx<B> = { owner: OpsOwner; body: B };
type Row = Record<string, unknown>;

function ok(body: Record<string, unknown>): OpsResult {
  return { body: { ok: true, ...body } };
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Without kind: the six summaries, in the list's order. With kind: that page, its blocks and all their translations. */
export async function getLegal({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const { kind } = parseLegalQuery(url.searchParams);
  const list = await owner.admin.rpc("ops_list", { p_entity: "legal_page" });
  if (list.error) return { dbError: list.error };
  const items = Array.isArray(list.data) ? list.data.filter(isRow) : [];
  if (kind === null) return ok({ items });
  const summary = items.find((row) => row.kind === kind);
  if (!summary) return { status: 404, body: errorBody("not_found") };
  const { data, error } = await owner.admin.rpc("ops_get", { p_entity: "legal_page", p_id: summary.id });
  if (error) return { dbError: error };
  return isRow(data) ? ok({ item: data }) : { status: 404, body: errorBody("not_found") };
}

export async function postLegal({ owner, body }: PostCtx<SaveLegalBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_save_legal_page", { p: body });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return ok({ id: out.id, affects_site: out.affects_site === true });
}
