// Plan 03.2-04: the core of every owner endpoint under /api/ops/* (03.2-API-CONTRACT.md §1 and §4). No Next import, so
// node tests load it directly; lib/ops/route.ts binds it to requireOwner() and is what route files use.
//
// Fixed order (T-3.2-20..23): decide (requireOwner) -> Origin (POST, PUT) -> content type and size (POST) -> JSON ->
// parse -> handler. A refusal at any step returns before the next one runs, so a non-owner never has the body read and
// never reaches the database. Every reply is JSON with Cache-Control: no-store. Nothing internal is ever put in a reply
// (no database message, no stack) and nothing but an error name or code is logged: stay access, team emails and the
// owner's texts pass through here.

import type { Locale3 } from "../../components/ops/api-types";
import { allowHostOverride, HOST_OVERRIDE_HEADER, isOpsHost, OPS_HOSTNAME } from "../host";

/** POST bodies are JSON of at most 64 KiB (contract §1). */
export const OPS_BODY_LIMIT = 64 * 1024;

const INVALID_BRAND: unique symbol = Symbol.for("almar.ops.invalid");

/**
 * A validation refusal: 400 `invalid` with the first bad field (dotted path) and its language. Recognised by a brand,
 * not by class identity, so a copy of this module bundled elsewhere still maps to 400.
 */
export class OpsInvalid extends Error {
  readonly field: string;
  readonly locale: Locale3 | null;
  readonly [INVALID_BRAND] = true;

  constructor(field: string, locale?: Locale3 | null) {
    super(`invalid ${field}`);
    this.name = "OpsInvalid";
    this.field = field;
    this.locale = locale ?? null;
  }
}

export function isOpsInvalid(error: unknown): error is OpsInvalid {
  return typeof error === "object" && error !== null && (error as Record<symbol, unknown>)[INVALID_BRAND] === true;
}

/** What a handler returns on success or a business refusal it builds itself (status defaults to 200). */
export type OpsResult = { status?: number; body: Record<string, unknown> & { ok: boolean } };
/** A Supabase / PostgREST error object, as `rpc()` and `from()` return it. */
export type DbError = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
/** A handler hands a database error back as `{ dbError }`; the wrapper maps it (mapDbError). */
export type OpsOutcome = OpsResult | { dbError: DbError } | Response;

export type OpsDecision<O> = { ok: true; owner: O } | { ok: false; status: number; code: string };

export type OpsErrorBody = {
  ok: false;
  error: { code: string; field: string | null; locale: Locale3 | null; detail: unknown };
};

export function errorBody(code: string, field: string | null = null, locale: Locale3 | null = null, detail: unknown = null): OpsErrorBody {
  return { ok: false, error: { code, field, locale, detail } };
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isLocale(value: unknown): value is Locale3 {
  return value === "en" || value === "ar" || value === "es";
}

/**
 * Whether a POST or PUT may act: its Origin header must be the ops origin. Production: exactly
 * `https://dashboard.almarprivatejourney.com`. Outside production also the local dashboard origins, and then only when
 * the Origin is the request's own host: `http://dashboard.localhost:<port>`, or `http://127.0.0.1:<port>` when the
 * request carries the dev host override naming the ops host (job 02). No Origin is a refusal.
 */
export function checkOrigin({
  origin,
  host,
  overrideHost,
  nodeEnv,
}: {
  origin: string | null | undefined;
  host: string | null | undefined;
  overrideHost: string | null | undefined;
  nodeEnv: string | undefined;
}): boolean {
  if (!origin) return false;
  if (origin === `https://${OPS_HOSTNAME}`) return true;
  if (nodeEnv === "production") return false;
  const local = origin.match(/^http:\/\/(dashboard\.localhost|127\.0\.0\.1)(:\d{2,5})?$/);
  if (!local) return false;
  if (local[1] === "127.0.0.1" && !isOpsHost(overrideHost, nodeEnv)) return false;
  return (host ?? "").trim().toLowerCase() === origin.slice("http://".length);
}

export type MappedDbError = { status: number; code: string; field: string | null; locale: Locale3 | null; detail: unknown };

const PLAIN_FIELD = /^[a-z_]+(\.[a-z_]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detailObject(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const value: unknown = JSON.parse(details);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapped(status: number, code: string, field: string | null = null, locale: Locale3 | null = null, detail: unknown = null): MappedDbError {
  return { status, code, field, locale, detail };
}

/**
 * A database refusal -> the contract's status and code (§1.1, §2.4). Business refusals are P0001 `almar:<code>` with a
 * JSON detail; constraint errors keep their SQLSTATE. A refusal the database makes against what it holds (a photo id
 * that does not exist, a slug change on a published row, the second home-pickup add-on) is 409 `invalid` with its
 * field. Only a plain dotted field name, a known locale and a uuid are ever copied out; anything else is 503
 * `unavailable` with nothing from the database in it.
 */
export function mapDbError(error: DbError | null | undefined): MappedDbError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  const detail = detailObject(error?.details);
  const field = typeof detail?.field === "string" && PLAIN_FIELD.test(detail.field) ? detail.field : null;
  const locale = isLocale(detail?.locale) ? detail.locale : null;

  if (code === "23505") {
    const text = `${message} ${error?.details ?? ""}`;
    if (text.includes("catalog_items_one_home_pickup")) return mapped(409, "invalid", "is_home_pickup");
    return mapped(409, "slug_taken", "slug");
  }
  if (code === "23P01") {
    const conflict = typeof detail?.conflict_id === "string" && UUID.test(detail.conflict_id) ? detail.conflict_id.toLowerCase() : null;
    return mapped(409, "rate_overlap", null, null, { conflict_id: conflict });
  }
  if (code === "23503") {
    return mapped(409, "in_use", null, null, message === "almar:in_use" && detail?.reason === "imported" ? { reason: "imported" } : null);
  }
  if (code === "P0001" && message.startsWith("almar:")) {
    switch (message.slice("almar:".length)) {
      case "not_found":
        return mapped(404, "not_found");
      case "published":
        return mapped(409, "published");
      case "amenities_mismatch":
        return mapped(409, "amenities_mismatch", field ?? "amenities");
      case "parent_unpublished":
        return mapped(409, "parent_unpublished", field ?? "destination_id");
      case "has_published_stays":
        return mapped(409, "has_published_stays");
      case "invalid":
        return mapped(409, "invalid", field, locale);
    }
  }
  return mapped(503, "unavailable");
}

type BodyRead = { ok: true; value: unknown } | { ok: false; response: Response };

/** Reads a POST body: JSON content type, at most `limit` bytes (counted while reading), valid UTF-8, valid JSON. */
export async function readJsonBody(request: Request, limit: number = OPS_BODY_LIMIT): Promise<BodyRead> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { ok: false, response: json(415, errorBody("wrong_type")) };
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    return { ok: false, response: json(413, errorBody("too_large")) };
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: json(413, errorBody("too_large")) };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: json(400, errorBody("invalid", "body")) };
  }
}

/** The name of a thrown value, for the log line only (never its message: it may hold a payload). */
function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof (error as { name: unknown }).name === "string") {
    return (error as { name: string }).name;
  }
  return typeof error;
}

async function finish(outcome: OpsOutcome): Promise<Response> {
  if (outcome instanceof Response) {
    // A handler's own Response keeps its body and status; the no-store and JSON rules still hold.
    const headers = new Headers(outcome.headers);
    headers.set("cache-control", "no-store");
    if (!(headers.get("content-type") ?? "").startsWith("application/json")) headers.set("content-type", JSON_HEADERS["content-type"]);
    return new Response(outcome.body, { status: outcome.status, headers });
  }
  if ("dbError" in outcome) {
    const error = mapDbError(outcome.dbError);
    if (error.code === "unavailable") console.error("[ops] database error", outcome.dbError?.code || "no code");
    return json(error.status, errorBody(error.code, error.field, error.locale, error.detail));
  }
  return json(outcome.status ?? 200, outcome.body);
}

export type OpsMethod = "GET" | "POST" | "PUT";

/**
 * Runs one owner request. `decide` is requireOwner() in production; tests pass a fake. `parse` runs on the JSON body
 * (POST only) and throws OpsInvalid on the first bad field. The handler gets the owner, the parsed body and the request.
 */
export async function runOps<O, B = unknown>(options: {
  method: OpsMethod;
  request: Request;
  decide: () => Promise<OpsDecision<O>>;
  parse?: (body: unknown) => B;
  handler: (ctx: { owner: O; body: B; request: Request }) => Promise<OpsOutcome>;
  nodeEnv: string | undefined;
}): Promise<Response> {
  const { method, request, nodeEnv } = options;

  let decision: OpsDecision<O>;
  try {
    decision = await options.decide();
  } catch (error) {
    console.error("[ops] owner check failed", errorName(error));
    return json(503, errorBody("unavailable"));
  }
  if (!decision.ok) return json(decision.status, errorBody(decision.code));

  if (method !== "GET") {
    const allowed = checkOrigin({
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      overrideHost: allowHostOverride(nodeEnv) ? request.headers.get(HOST_OVERRIDE_HEADER) : null,
      nodeEnv,
    });
    if (!allowed) return json(403, errorBody("wrong_origin"));
  }

  let raw: unknown;
  if (method === "POST") {
    const read = await readJsonBody(request);
    if (!read.ok) return read.response;
    raw = read.value;
  }

  try {
    const body = (options.parse ? options.parse(raw) : raw) as B;
    return await finish(await options.handler({ owner: decision.owner, body, request }));
  } catch (error) {
    if (isOpsInvalid(error)) return json(400, errorBody("invalid", error.field, error.locale));
    console.error(`[ops] ${method} failed`, errorName(error));
    return json(503, errorBody("unavailable"));
  }
}
