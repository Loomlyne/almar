// Plan 06-05: the handlers of /api/ops/requests and /api/ops/consult on migration 20261025120000_site_cms.sql. Same rules as
// posts-handlers.ts: one service-role RPC per call, a database refusal goes back as { dbError } for mapDbError, nothing is logged.
// The actor is the session's owner, never the body (T-06-05-07). Every reply says affects_site: false: nothing here is built
// into the static site; slots are read live (F-04).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpsOutcome, OpsResult } from "./route-core";
import type { ConsultBody, SetHandledBody } from "./site-cms-api";
import { parseRequestsQuery } from "./validate-requests";

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

export async function getRequests({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const { kind, handled } = parseRequestsQuery(url.searchParams);
  const { data, error } = await owner.admin.rpc("ops_list_requests", {
    p_kind: kind === "all" ? null : kind,
    p_handled: handled === "all" ? null : handled === "yes",
  });
  if (error) return { dbError: error };
  return ok({ items: Array.isArray(data) ? data.filter(isRow) : [] });
}

export async function postRequests({ owner, body }: PostCtx<SetHandledBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_set_request_handled", { p_id: body.id, p_handled: body.handled, p_actor: owner.profile.id });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return ok({ id: body.id, handled_at: out.handled_at ?? null, handled_by: out.handled_by ?? null, affects_site: false });
}

export async function getConsult({ owner }: GetCtx): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_get_consult");
  if (error) return { dbError: error };
  return ok({ item: isRow(data) ? data : null });
}

export async function postConsult({ owner, body }: PostCtx<ConsultBody>): Promise<OpsOutcome> {
  if (body.action === "cancel") {
    const { data, error } = await owner.admin.rpc("ops_cancel_consultation", { p_id: body.booking_id, p_actor: owner.profile.id });
    if (error) return { dbError: error };
    const out = isRow(data) ? data : {};
    return ok({ id: body.booking_id, status: out.status ?? "cancelled", affects_site: false });
  }
  const { action: _action, ...setup } = body;
  const { data, error } = await owner.admin.rpc("ops_save_consult", { p: setup });
  if (error) return { dbError: error };
  return ok({ id: "consult", item: isRow(data) ? data : null, affects_site: false });
}
