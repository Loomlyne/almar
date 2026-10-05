// Plan 03.2-01 (C-19): the one owner gate. Server only: it reads request headers and cookies and builds the
// service-role client (the `server-only` package is not a dependency, so this is a comment, not an import).
// Every /api/ops/* call goes through lib/ops/route.ts (plan 03.2-04), which calls this first, before it reads the
// body or touches the database. It builds no Response: the caller maps the refusal.
//
// Order: the shell header (ops host, set by middleware only) -> the session (getUser through readSessionProfile,
// never getSession) -> isOwnerProfile (role owner AND the owner email) -> the service-role client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { SHELL_HEADER } from "../host";
import { createSupabaseAdmin, readSessionProfile, type SessionProfile } from "../supabase/clients";
import { ownerDecision } from "./owner-decision";

export type OwnerContext = { profile: SessionProfile; admin: SupabaseClient };

export type OwnerResult =
  | { ok: true; owner: OwnerContext }
  | { ok: false; status: 403 | 503; code: "not_owner" | "unavailable" };

export async function requireOwner(): Promise<OwnerResult> {
  const shell = (await headers()).get(SHELL_HEADER);
  // The session is read only on the ops host: a call on the wrong host costs no Supabase round trip.
  const profile = shell === "ops" ? await readSessionProfile() : null;

  // Not the owner: refuse before a service-role client is made for someone who may not have one.
  if (ownerDecision({ shell, profile, hasAdmin: true }) === "not_owner") {
    return { ok: false, status: 403, code: "not_owner" };
  }
  const admin = createSupabaseAdmin();
  const decision = ownerDecision({ shell, profile, hasAdmin: admin !== null });
  if (decision === "not_owner") return { ok: false, status: 403, code: "not_owner" };
  if (decision === "unavailable" || !admin || !profile) return { ok: false, status: 503, code: "unavailable" };
  return { ok: true, owner: { profile, admin } };
}
