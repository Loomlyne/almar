// Plan 03.2-09 Task 2: the core of /api/ops/media (03.2-API-CONTRACT.md §5.10). Pure, with every outside thing
// injected (the R2 bucket, the length stream, the RPC callers), so node tests run it against fakes; the route file
// (app/api/ops/media/route.ts) binds it to getCloudflareContext().env.MEDIA, FixedLengthStream and owner.admin.rpc,
// after opsGet / opsPut / opsPost have run requireOwner() and the Origin check.
//
// Upload (C-10, research §3.2): headers first (nothing is read before they pass), then a content-addressed key
// `uploads/<first 32 hex of the SHA-256>.<ext>`. `head` first: an object already there is never overwritten. Else the
// body is piped through a length stream of exactly Content-Length bytes into `put` with the hex sha256, so R2 refuses
// bytes that do not match (never arrayBuffer() on the file: memory and CPU on the Free plan). Only after a stored
// object does `ops_save_media` record the row. Never Supabase Storage. Nothing here logs: alt text, keys and
// headers never reach a log.

import type { MediaItem } from "../../components/ops/media-types";
import { mediaRef } from "./shape";
import { errorBody, OpsInvalid, type DbError, type OpsOutcome, type OpsResult } from "./route-core";
import {
  isSha256,
  isUploadType,
  MAX_UPLOAD_BYTES,
  parseMediaQuery,
  parseUploadHeaders,
  UPLOAD_EXT,
  type MediaPost,
  type MediaQuery,
} from "./validate-media";

export { MAX_UPLOAD_BYTES };

/** The one-year immutable header every media object carries (the same value as scripts/media-lib.mjs). */
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** What the core needs of an R2 bucket binding (a structural subset of R2Bucket). */
export type MediaBucket = {
  head(key: string): Promise<{ size?: number } | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options: { httpMetadata: { contentType: string; cacheControl: string }; sha256: string },
  ): Promise<unknown>;
};

/** A stream that passes exactly `length` bytes and errors otherwise (Workers' FixedLengthStream). */
export type LengthStream = { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };

/** A Supabase rpc() reply (a PostgrestBuilder is a thenable of this). */
export type RpcReply = { data: unknown; error: DbError | null };

export type MediaSave = {
  key: string;
  width: number;
  height: number;
  bytes: number;
  content_type: string;
  sha256: string;
  source: "upload";
  alt_en: string;
};

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refuse(status: number, code: string, field: string | null = null): OpsResult {
  return { status, body: errorBody(code, field) };
}

function discard(body: ReadableStream<Uint8Array> | null): void {
  if (body && !body.locked) body.cancel().catch(() => undefined);
}

/** `uploads/<first 32 hex>.<webp|jpg|png>`: the extension comes from the checked type, never from a file name. */
export function keyFor(sha256: string, contentType: string): string {
  if (!isSha256(sha256)) throw new OpsInvalid("sha256");
  if (!isUploadType(contentType)) throw new OpsInvalid("content_type");
  return `uploads/${sha256.slice(0, 32)}.${UPLOAD_EXT[contentType]}`;
}

const PIPE_STOPPED = Symbol("pipe stopped");

/**
 * PUT /api/ops/media. Returns `{ ok, id, key, url, created }`, a refusal (415 / 413 / 400 with the field, 503 when the
 * bucket is missing), or `{ dbError }` for the wrapper to map.
 */
export async function uploadCore({
  headers,
  body,
  media,
  saveMedia,
  makeLengthStream,
}: {
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  media: MediaBucket | null;
  saveMedia: (p: MediaSave) => PromiseLike<RpcReply>;
  makeLengthStream: (length: number) => LengthStream;
}): Promise<OpsOutcome> {
  const parsed = parseUploadHeaders(headers);
  if (!parsed.ok) {
    discard(body);
    return refuse(parsed.status, parsed.code, parsed.field);
  }
  const { contentType, length, sha256, width, height, altEn } = parsed.value;
  if (!media) {
    discard(body);
    return refuse(503, "unavailable");
  }
  if (!body) return refuse(400, "invalid", "content_length");

  const key = keyFor(sha256, contentType);
  const existing = await media.head(key);
  if (existing) {
    discard(body);
    // Same key, other size: not the file the hash names. Refuse rather than record a row for it.
    if (typeof existing.size === "number" && existing.size !== length) return refuse(400, "invalid", "sha256");
  } else {
    const lengthStream = makeLengthStream(length);
    const abort = new AbortController();
    // The pipe's own outcome: "ok", or "length" when the body was shorter or longer than Content-Length. Set only by
    // the pipe ending by itself, never by the stop below.
    const pipe: { outcome: "pending" | "ok" | "length" } = { outcome: "pending" };
    const piping = body.pipeTo(lengthStream.writable, { signal: abort.signal }).then(
      () => {
        if (pipe.outcome === "pending") pipe.outcome = "ok";
      },
      () => {
        if (pipe.outcome === "pending" && !abort.signal.aborted) pipe.outcome = "length";
      },
    );

    let stored = false;
    try {
      const object = await media.put(key, lengthStream.readable, {
        httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
        sha256,
      });
      stored = object !== null && object !== undefined;
    } catch {
      stored = false;
    }
    if (!stored && pipe.outcome === "pending") {
      // Let a pipe that is about to fail on length say so first (one task), then stop it: a put that never read the
      // stream leaves the pipe waiting on backpressure, so the unread side is cancelled too.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (pipe.outcome === "pending") {
        abort.abort(PIPE_STOPPED);
        if (!lengthStream.readable.locked) lengthStream.readable.cancel().catch(() => undefined);
      }
    }
    await piping;

    if (pipe.outcome === "length") return refuse(400, "invalid", "content_length");
    // R2 refused the bytes (sha256 mismatch: its integrity check) or did not store them.
    if (!stored) return refuse(400, "invalid", "sha256");
  }

  const { data, error } = await saveMedia({
    key,
    width,
    height,
    bytes: length,
    content_type: contentType,
    sha256,
    source: "upload",
    alt_en: altEn,
  });
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  if (typeof out.id !== "string") return refuse(503, "unavailable");
  const ref = mediaRef({ id: out.id, key });
  return { body: { ok: true, id: out.id, key, url: ref?.url ?? null, created: out.created === true } };
}

// ---- GET list ----------------------------------------------------------------------------------------------------------

const LOCALES = ["en", "ar", "es"] as const;

function altStatus(value: unknown): MediaItem["alt_status"]["en"] {
  return value === "published" || value === "draft" ? value : "missing";
}

/** One `ops_list('media')` row -> the contract's list item (MediaRef plus the library fields); unknown keys dropped. */
export function mediaItem(row: Row): MediaItem | null {
  const altIn = isRow(row.alt) ? row.alt : {};
  const statusIn = isRow(row.alt_status) ? row.alt_status : {};
  const alt = {} as MediaItem["alt"];
  const status = {} as MediaItem["alt_status"];
  for (const locale of LOCALES) {
    alt[locale] = typeof altIn[locale] === "string" ? (altIn[locale] as string) : null;
    status[locale] = altStatus(statusIn[locale]);
  }
  const ref = mediaRef({ id: row.id, key: row.key, width: row.width, height: row.height, alt_en: alt.en });
  if (!ref) return null;
  return {
    ...ref,
    content_type: typeof row.content_type === "string" ? row.content_type : "",
    source: row.source === "import" ? "import" : "upload",
    alt,
    alt_status: status,
    used_by: typeof row.used_by === "number" && Number.isFinite(row.used_by) ? row.used_by : 0,
  };
}

/** Case- and accent-folded text for search. */
export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function byKey(a: MediaItem, b: MediaItem): number {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * One page of the library: key order (code-unit, so the cursor compares the same way), `q` over the key and the
 * English alt, `after` = the last key of the previous page. An imported key may carry two image ids: a page never
 * ends between two rows of one key, so `after` never skips one.
 */
export function mediaPage(data: unknown, query: MediaQuery): { items: MediaItem[]; next: string | null } {
  const all = (Array.isArray(data) ? data : [])
    .filter(isRow)
    .map(mediaItem)
    .filter((m): m is MediaItem => m !== null)
    .sort(byKey);
  const needle = query.q === null ? null : fold(query.q);
  const after = query.after;
  const matching = all.filter(
    (m) => (after === null || m.key > after) && (needle === null || fold(m.key).includes(needle) || fold(m.alt.en ?? "").includes(needle)),
  );
  let end = Math.min(query.limit, matching.length);
  while (end > 0 && end < matching.length && matching[end].key === matching[end - 1].key) end += 1;
  const items = matching.slice(0, end);
  return { items, next: end < matching.length ? items[items.length - 1].key : null };
}

/** GET /api/ops/media[?q=&limit=&after=]: the query is checked before the database is asked. */
export async function listMedia({ listRows, url }: { listRows: () => PromiseLike<RpcReply>; url: URL }): Promise<OpsOutcome> {
  const query = parseMediaQuery(url.searchParams);
  const { data, error } = await listRows();
  if (error) return { dbError: error };
  return { body: { ok: true, ...mediaPage(data, query) } };
}

// ---- POST --------------------------------------------------------------------------------------------------------------

/**
 * POST save_alt -> ops_save_image_alts({id, alt, status}) -> `{ ok, id, affects_site }`; delete -> ops_delete_media
 * (the R2 object is kept) -> `{ ok, id, affects_site: false }`. A used or imported photo is the database's 23503,
 * which the wrapper maps to 409 in_use.
 */
export async function postMedia({
  body,
  saveAlts,
  deleteMedia,
}: {
  body: MediaPost;
  saveAlts: (p: { id: string; alt: Record<string, string | null>; status?: Record<string, string> }) => PromiseLike<RpcReply>;
  deleteMedia: (id: string) => PromiseLike<RpcReply>;
}): Promise<OpsOutcome> {
  if (body.action === "delete") {
    const { error } = await deleteMedia(body.id);
    if (error) return { dbError: error };
    // Only an unused photo can be deleted, so nothing on the public site changes.
    return { body: { ok: true, id: body.id, affects_site: false } };
  }
  const p: { id: string; alt: Record<string, string | null>; status?: Record<string, string> } = { id: body.id, alt: body.alt };
  if (body.status) p.status = body.status;
  const { data, error } = await saveAlts(p);
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return { body: { ok: true, id: typeof out.id === "string" ? out.id : body.id, affects_site: out.affects_site === true } };
}
