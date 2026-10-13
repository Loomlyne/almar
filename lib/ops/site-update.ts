// Plan 03.2-05 (contract §6, research §1.3): the public-site update the owner's writes trigger, and the status the
// dashboard reads. Server only (the ops Worker `almar-ops`).
//
// A write that reaches the public site (affects_site: true) calls requestSiteUpdate(): site_request_update() bumps the
// sequence, then the Workers Builds deploy hook is POSTed once. Its result ("ok", "already_exists" while a build from
// the hook is still queued, or "error:<reason>") is recorded with site_record_hook(). The content is saved before any of
// this, so nothing here ever undoes or blocks a save.
//
// PUBLISH_DEPLOY_HOOK_URL is a Worker secret on almar-ops only (OpenNext exposes Worker secrets on process.env, like
// SUPABASE_SERVICE_ROLE_KEY). It is read in this file only, and never logged or returned: the URL is the credential.

import { OpsInvalid, type OpsOutcome } from "./route-core";
import { computeSiteStatus, type LiveVersion, type PublishState, type SiteStatus } from "./site-status";

/** The live site's own record of what it was built from (written by scripts/build-live.mjs, served no-store). */
export const LIVE_VERSION_URL = "https://almarprivatejourney.com/site-version.json";
/** Only a Cloudflare deploy hook is ever called, whatever the secret holds. */
const HOOK_PREFIX = "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/";
const HOOK_TIMEOUT_MS = 10_000;
const LIVE_TIMEOUT_MS = 5_000;

type RpcReply = { data: unknown; error: { code?: string | null; message?: string | null } | null };
/** The part of the service-role client this file uses. */
export type SiteAdmin = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcReply> };

export type SiteDeps = {
  fetchImpl?: typeof fetch;
  hookUrl?: string | null;
  now?: () => Date;
};

/** A database refusal while reading or bumping the sequence: the route answers 503 (runOps maps any throw). */
export class SiteStateError extends Error {
  constructor(step: string) {
    super(`site ${step} failed`);
    this.name = "SiteStateError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSeq(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * GET the live /site-version.json without any cache. A 404 (no build from branch live yet) is seq 0. Anything else that
 * is not a readable `{ seq }` is null: the status then counts the live site as behind.
 */
export async function readLiveVersion(fetchImpl: typeof fetch = globalThis.fetch): Promise<LiveVersion> {
  let res: Response;
  try {
    res = await fetchImpl(LIVE_VERSION_URL, { cache: "no-store", signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
  } catch {
    return null;
  }
  if (res.status === 404) return { seq: 0, built_at: null };
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!isRecord(body)) return null;
  const seq = asSeq(body.seq);
  if (seq === null) return null;
  return { seq, built_at: asText(body.built_at) };
}

async function readState(admin: SiteAdmin): Promise<PublishState> {
  const { data, error } = await admin.rpc("site_publish_state");
  if (error || !isRecord(data)) throw new SiteStateError("state");
  return {
    requested_seq: asSeq(data.requested_seq) ?? 0,
    requested_at: asText(data.requested_at),
    last_hook_at: asText(data.last_hook_at),
    last_hook_result: asText(data.last_hook_result),
    last_build_uuid: asText(data.last_build_uuid),
  };
}

type HookCall = { result: string; buildUuid: string | null };

/**
 * One POST to the deploy hook, no body and no Authorization header (the URL is the credential). Any 2xx is "ok"; the
 * response fields are read tolerantly ([ASSUMED] names: `build_uuid`, `already_exists`, at the top or under `result`;
 * confirmed at the owner gate).
 */
async function callHook(hookUrl: string | null | undefined, fetchImpl: typeof fetch): Promise<HookCall> {
  const url = (hookUrl ?? "").trim();
  if (!url) return { result: "error:no_hook", buildUuid: null };
  if (!url.startsWith(HOOK_PREFIX)) return { result: "error:bad_hook", buildUuid: null };
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(HOOK_TIMEOUT_MS) });
  } catch {
    return { result: "error:network", buildUuid: null };
  }
  if (!res.ok) return { result: `error:${res.status}`, buildUuid: null };
  const body: unknown = await res.json().catch(() => null);
  const parts = isRecord(body) ? [isRecord(body.result) ? body.result : null, body].filter(isRecord) : [];
  const already = parts.some((part) => part.already_exists === true);
  const uuid = parts.map((part) => asText(part.build_uuid) ?? asText(part.uuid)).find((value) => value !== null) ?? null;
  return { result: already ? "already_exists" : "ok", buildUuid: uuid && uuid.length <= 64 ? uuid : null };
}

function hookFromEnv(): string | null {
  return process.env.PUBLISH_DEPLOY_HOOK_URL ?? null;
}

/**
 * Requests one rebuild of the public site and returns the status right after. Throws SiteStateError only when the
 * sequence itself could not be bumped or read (runOps then attaches a failed status to the saved write).
 */
export async function requestSiteUpdate(admin: SiteAdmin, deps: SiteDeps = {}): Promise<SiteStatus> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const now = deps.now ?? (() => new Date());
  const bumped = await admin.rpc("site_request_update");
  if (bumped.error) throw new SiteStateError("request");

  const hook = await callHook(deps.hookUrl !== undefined ? deps.hookUrl : hookFromEnv(), fetchImpl);
  const recorded = await admin.rpc("site_record_hook", { p_result: hook.result, p_build_uuid: hook.buildUuid });

  const [state, live] = await Promise.all([readState(admin), readLiveVersion(fetchImpl)]);
  // When the record itself failed, the reply still tells the truth about the call just made.
  const effective = recorded.error ? { ...state, last_hook_at: now().toISOString(), last_hook_result: hook.result } : state;
  return computeSiteStatus(effective, live, now());
}

/** The status now: the database's request against the live site's sequence. */
export async function siteStatus(admin: SiteAdmin, deps: SiteDeps = {}): Promise<SiteStatus> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const now = deps.now ?? (() => new Date());
  const [state, live] = await Promise.all([readState(admin), readLiveVersion(fetchImpl)]);
  return computeSiteStatus(state, live, now());
}

/** POST /api/ops/site-update takes exactly `{}`. */
export function parseSiteUpdate(body: unknown): Record<string, never> {
  if (!isRecord(body)) throw new OpsInvalid("body");
  const key = Object.keys(body)[0];
  if (key !== undefined) throw new OpsInvalid(key.slice(0, 64));
  return {};
}

/** GET /api/ops/site-status → { ok, site }. */
export async function getSiteStatus({ owner }: { owner: { admin: unknown } }): Promise<OpsOutcome> {
  return { body: { ok: true, site: await siteStatus(owner.admin as SiteAdmin) } };
}

/** POST /api/ops/site-update ("Try again") → fires the hook again → { ok, site }. */
export async function postSiteUpdate({ owner }: { owner: { admin: unknown } }): Promise<OpsOutcome> {
  return { body: { ok: true, site: await requestSiteUpdate(owner.admin as SiteAdmin) } };
}
