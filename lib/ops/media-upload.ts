// Plan 03.2-09 Task 2: the core of /api/ops/media (03.2-API-CONTRACT.md §5.10). Pure, with every outside thing
// injected (the R2 bucket, the length stream, the RPC callers), so node tests run it against fakes; the route file
// (app/api/ops/media/route.ts) binds it to getCloudflareContext().env.MEDIA, FixedLengthStream and owner.admin.rpc,
// after opsGet / opsPut / opsPost have run requireOwner() and the Origin check.
//
// Upload (C-10, research §3.2): headers first (nothing is read before they pass), then a content-addressed key
// `uploads/<first 32 hex of the SHA-256>.<ext>`. `head` first: an object already there is never overwritten. Else the
// body is piped through a length stream of exactly Content-Length bytes into `put` with the hex sha256, so R2 refuses
// bytes that do not match (this code never reads the file whole). Only after a stored object does
// `ops_save_media` record the row. Never Supabase Storage. Nothing here logs: alt text, keys and headers never reach
// a log. Note (job 03.2-09b): on Cloudflare, OpenNext has already read the whole request body into memory before this
// runs (@opennextjs/aws overrides/converters/edge.js, in its routing layer and again for the server function, for every
// non-GET request whatever the middleware matcher says), so the 10 MB limit (validate-media.ts) is also the memory
// bound of one upload.

import type { MediaItem } from "../../components/ops/media-types";
import { mediaRef } from "./shape";
import { errorBody, OpsInvalid, type DbError, type OpsOutcome, type OpsResult } from "./route-core";
import {
  hasSignature,
  isSha256,
  isUploadType,
  MAX_UPLOAD_BYTES,
  parseMediaQuery,
  parseUploadHeaders,
  SNIFF_BYTES,
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
 * Reads the body's first `need` bytes (fewer when it ends first) and gives back a stream of the whole body: those bytes,
 * then the rest as it arrives. Nothing past the first chunks is buffered.
 */
async function sniffBody(
  body: ReadableStream<Uint8Array>,
  need: number,
): Promise<{ head: Uint8Array; whole: ReadableStream<Uint8Array>; cancel: () => void }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let have = 0;
  while (have < need) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.byteLength === 0) continue;
    chunks.push(value);
    have += value.byteLength;
  }
  const head = new Uint8Array(Math.min(have, need));
  let at = 0;
  for (const chunk of chunks) {
    if (at >= head.length) break;
    const part = chunk.subarray(0, head.length - at);
    head.set(part, at);
    at += part.byteLength;
  }
  const cancel = () => {
    reader.cancel().catch(() => undefined);
  };
  let queued = chunks;
  const whole = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (queued.length > 0) {
        for (const chunk of queued) controller.enqueue(chunk);
        queued = [];
        return;
      }
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel() {
      cancel();
    },
  });
  return { head, whole, cancel };
}

/**
 * PUT /api/ops/media. Returns `{ ok, id, key, url, created }`, a refusal (415 for a type or a first-bytes signature
 * that is not JPEG / PNG / WebP, 413, 400 with the field, 503 when the bucket is missing), or `{ dbError }` for the
 * wrapper to map.
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
    // The first bytes must be the declared type's signature (review finding 4): a body labelled image/png that is not
    // a PNG is 415 before anything is stored. A body that ends before Content-Length is the length error, as below.
    let sniffed: Awaited<ReturnType<typeof sniffBody>>;
    try {
      sniffed = await sniffBody(body, SNIFF_BYTES);
    } catch {
      // The body broke off within its first bytes: the same answer as a body cut short later on.
      return refuse(400, "invalid", "content_length");
    }
    if (!hasSignature(sniffed.head, contentType)) {
      sniffed.cancel();
      if (sniffed.head.byteLength < Math.min(SNIFF_BYTES, length)) return refuse(400, "invalid", "content_length");
      return refuse(415, "wrong_type");
    }
    const lengthStream = makeLengthStream(length);
    const abort = new AbortController();
    // The pipe's own outcome: "ok", or "length" when the body was shorter or longer than Content-Length. Set only by
    // the pipe ending by itself, never by the stop below.
    const pipe: { outcome: "pending" | "ok" | "length" } = { outcome: "pending" };
    const piping = sniffed.whole.pipeTo(lengthStream.writable, { signal: abort.signal }).then(
      () => {
        if (pipe.outcome === "pending") pipe.outcome = "ok";
      },
      () => {
        if (pipe.outcome === "pending" && !abort.signal.aborted) pipe.outcome = "length";
      },
    );

    let stored = false;
    let digestRefused = false;
    try {
      const object = await media.put(key, lengthStream.readable, {
        httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
        sha256,
      });
      stored = object !== null && object !== undefined;
      // put returns null when a precondition fails; with no condition set here, treat it like a refused digest.
      digestRefused = !stored;
    } catch (error) {
      // R2 names an integrity failure in its message ("…SHA-256…" / "digest"); anything else is R2 not answering.
      digestRefused = /sha-?256|digest|checksum/i.test(error instanceof Error ? error.message : String(error));
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
    // R2 refused the bytes (sha256 mismatch: its integrity check); any other failure is R2 not answering.
    if (!stored) return digestRefused ? refuse(400, "invalid", "sha256") : refuse(503, "unavailable");
  }

  const save: MediaSave = { key, width, height, bytes: length, content_type: contentType, sha256, source: "upload", alt_en: altEn };
  let { data, error } = await saveMedia(save);
  // Two uploads of one file at the same moment (review finding 5): both find no row, the second insert hits the unique
  // upload key (23505). That row is the same file, so ask once more: ops_save_media now finds it and answers
  // `created: false` with its id, and the screen shows the stored row instead of a 409.
  if (error?.code === "23505") ({ data, error } = await saveMedia(save));
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

/** One `ops_list_media` item (the shape of an `ops_list('media')` row) -> the contract's list item (MediaRef plus the library fields); unknown keys dropped. */
export function mediaItem(row: Row): MediaItem | null {
  const altIn = isRow(row.alt) ? row.alt : {};
  const statusIn = isRow(row.alt_status) ? row.alt_status : {};
  const alt = {} as MediaItem["alt"];
  const status = {} as MediaItem["alt_status"];
  for (const locale of LOCALES) {
    alt[locale] = typeof altIn[locale] === "string" ? (altIn[locale] as string) : null;
    status[locale] = altStatus(statusIn[locale]);
  }
  const lockedIn = isRow(row.alt_locked) ? row.alt_locked : {};
  const ref = mediaRef({ id: row.id, key: row.key, width: row.width, height: row.height, alt_en: alt.en });
  if (!ref) return null;
  return {
    ...ref,
    content_type: typeof row.content_type === "string" ? row.content_type : "",
    source: row.source === "import" ? "import" : "upload",
    alt,
    alt_status: status,
    alt_locked: { ar: lockedIn.ar === true, es: lockedIn.es === true },
    used_by: typeof row.used_by === "number" && Number.isFinite(row.used_by) ? row.used_by : 0,
  };
}

/**
 * One `ops_list_media` reply -> `{ items, next }`. The search, the key order and the paging (a page never ends between
 * two rows of one imported key) are the database's (job 03.2-09b, review finding 3): the Worker maps at most one page.
 */
export function mediaPage(data: unknown): { items: MediaItem[]; next: string | null } {
  const out = isRow(data) ? data : {};
  const items = (Array.isArray(out.items) ? out.items : [])
    .filter(isRow)
    .map(mediaItem)
    .filter((m): m is MediaItem => m !== null);
  return { items, next: typeof out.next === "string" && items.length > 0 ? out.next : null };
}

/** GET /api/ops/media[?q=&limit=&after=]: the query is checked before the database is asked for that one page. */
export async function listMedia({
  listPage,
  url,
}: {
  listPage: (query: MediaQuery) => PromiseLike<RpcReply>;
  url: URL;
}): Promise<OpsOutcome> {
  const query = parseMediaQuery(url.searchParams);
  const { data, error } = await listPage(query);
  if (error) return { dbError: error };
  return { body: { ok: true, ...mediaPage(data) } };
}

// ---- POST --------------------------------------------------------------------------------------------------------------

/**
 * POST save_alt -> ops_save_image_alts({id, alt, status, locked}) -> `{ ok, id, affects_site }`; delete -> ops_delete_media
 * (the R2 object is kept) -> `{ ok, id, affects_site: false }`. A used or imported photo is the database's 23503,
 * which the wrapper maps to 409 in_use.
 */
export async function postMedia({
  body,
  saveAlts,
  deleteMedia,
}: {
  body: MediaPost;
  saveAlts: (p: { id: string; alt: Record<string, string | null>; status?: Record<string, string>; locked?: Record<string, boolean> }) => PromiseLike<RpcReply>;
  deleteMedia: (id: string) => PromiseLike<RpcReply>;
}): Promise<OpsOutcome> {
  if (body.action === "delete") {
    const { error } = await deleteMedia(body.id);
    if (error) return { dbError: error };
    // Only an unused photo can be deleted, so nothing on the public site changes.
    return { body: { ok: true, id: body.id, affects_site: false } };
  }
  const p: { id: string; alt: Record<string, string | null>; status?: Record<string, string>; locked?: Record<string, boolean> } = { id: body.id, alt: body.alt };
  if (body.status) p.status = body.status;
  if (body.locked) p.locked = body.locked;
  const { data, error } = await saveAlts(p);
  if (error) return { dbError: error };
  const out = isRow(data) ? data : {};
  return { body: { ok: true, id: typeof out.id === "string" ? out.id : body.id, affects_site: out.affects_site === true } };
}
