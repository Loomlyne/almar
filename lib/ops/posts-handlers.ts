// Plan 06-03: the handlers of /api/ops/posts on migration 20261025120000_site_cms.sql (ops_list / ops_get('post'),
// ops_save_post, ops_delete('post')). Same rules as catalog-handlers.ts: one service-role RPC per write, a database
// refusal goes back as { dbError } for mapDbError (a published post cannot be deleted: the existing refusal), nothing is
// logged. Publish and unpublish stay on /api/ops/publish (entity post). Save answers the function's affects_site, so
// opsPost asks for the site update (C-01/C-03).

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorBody, type OpsOutcome, type OpsResult } from "./route-core";
import type { PostsBody } from "./site-cms-api";
import { parsePostsQuery } from "./validate-posts";

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

export async function getPosts({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const { id } = parsePostsQuery(url.searchParams);
  if (id) {
    const { data, error } = await owner.admin.rpc("ops_get", { p_entity: "post", p_id: id });
    if (error) return { dbError: error };
    return isRow(data) ? ok({ item: data }) : { status: 404, body: errorBody("not_found") };
  }
  // ops_list('post') is newest first (published_at desc, drafts without a date first).
  const { data, error } = await owner.admin.rpc("ops_list", { p_entity: "post" });
  if (error) return { dbError: error };
  return ok({ items: Array.isArray(data) ? data.filter(isRow) : [] });
}

export async function postPosts({ owner, body }: PostCtx<PostsBody>): Promise<OpsOutcome> {
  if (body.action === "delete") {
    const { error } = await owner.admin.rpc("ops_delete", { p_entity: "post", p_id: body.id });
    if (error) return { dbError: error };
    // Only an unpublished post can be deleted, so nothing on the public site changes.
    return ok({ id: body.id, affects_site: false });
  }
  const { action: _action, ...item } = body;
  const { data, error } = await owner.admin.rpc("ops_save_post", { p: item });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return ok({ id: out.id, affects_site: out.affects_site === true });
}
