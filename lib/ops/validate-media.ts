// Plan 03.2-09 Task 2: the validators of /api/ops/media (03.2-API-CONTRACT.md §5.10), house style of
// lib/ops/validate.ts: plain TS, the clean value or OpsInvalid on the first bad field. Pure: node tests load it.
//
// Upload headers come first and are checked before a byte of the body is read: type (415), length (413), then the
// hash, the size in pixels and the English alt text (400 with the field). Alt text is never logged or echoed.

import type { Locale3 } from "../../components/ops/api-types";
import { isOpsInvalid, OpsInvalid } from "./route-core";
import { has, onlyKeys, record, requiredText, text, uuid } from "./validate";

/** The largest file the owner can send: 10 MB, Next's middleware body buffer (DEFAULT_BODY_CLONE_SIZE_LIMIT); job 03.2-09b. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Alt text: at most 300 characters per language. */
export const ALT_MAX = 300;
/** Width and height: 1..10000 px. */
export const PIXELS_MAX = 10000;

/** The three types the bucket accepts, with the key extension each gets (never from the file name). */
export const UPLOAD_EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;
export type UploadType = keyof typeof UPLOAD_EXT;

export function isUploadType(value: string): value is UploadType {
  return Object.prototype.hasOwnProperty.call(UPLOAD_EXT, value);
}

/** How many leading bytes the type check reads: enough for the longest signature below (WebP, 12). */
export const SNIFF_BYTES = 12;

/**
 * True when the file's first bytes are the signature of `type` (job 03.2-09b, review finding 4): JPEG `FF D8 FF`, PNG
 * `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF` + 4 size bytes + `WEBP`. A body labelled image/png that is not one is refused,
 * so the media host never serves non-image bytes under an image type.
 */
export function hasSignature(bytes: Uint8Array, type: UploadType): boolean {
  const at = (offset: number, sig: readonly number[]) => bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
  if (type === "image/jpeg") return at(0, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50]);
}

const SHA256 = /^[0-9a-f]{64}$/;
/** The `media.key` check of the migration (20261005100000_catalog_and_team.sql). */
export const MEDIA_KEY = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$/;
const KEY_MAX = 300;
const Q_MAX = 100;
export const LIST_LIMIT = 60;

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

function chars(value: string): number {
  return Array.from(value).length;
}

// ---- PUT headers -------------------------------------------------------------------------------------------------------

export type UploadHeaders = {
  contentType: UploadType;
  length: number;
  sha256: string;
  width: number;
  height: number;
  altEn: string;
};

export type HeaderRefusal = { status: 400 | 413 | 415; code: "invalid" | "too_large" | "wrong_type"; field: string | null };

function pixels(value: string | null, field: "width" | "height"): number {
  if (value === null || !/^\d{1,5}$/.test(value)) throw new OpsInvalid(field);
  const n = Number(value);
  if (n < 1 || n > PIXELS_MAX) throw new OpsInvalid(field);
  return n;
}

function altFromHeader(value: string | null): string {
  if (value === null) throw new OpsInvalid("alt_en");
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new OpsInvalid("alt_en");
  }
  const out = decoded.trim();
  if (out.length === 0 || chars(out) > ALT_MAX) throw new OpsInvalid("alt_en");
  return out;
}

/**
 * The upload's headers, in the contract's order: Content-Type (415 wrong_type), Content-Length (413 too_large when
 * missing, not a plain number or over 10 MB; 0 is 400 field content_length), x-almar-sha256 (64 lowercase hex),
 * x-almar-width / x-almar-height (1..10000), x-almar-alt-en (URI-encoded, required after trim, at most 300 characters).
 */
export function parseUploadHeaders(headers: Headers): { ok: true; value: UploadHeaders } | ({ ok: false } & HeaderRefusal) {
  const type = (headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!isUploadType(type)) return { ok: false, status: 415, code: "wrong_type", field: null };

  const declared = headers.get("content-length");
  if (declared === null || !/^\d{1,9}$/.test(declared) || Number(declared) > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, code: "too_large", field: null };
  }
  const length = Number(declared);

  try {
    if (length === 0) throw new OpsInvalid("content_length");
    const sha256 = headers.get("x-almar-sha256");
    if (!isSha256(sha256)) throw new OpsInvalid("sha256");
    const width = pixels(headers.get("x-almar-width"), "width");
    const height = pixels(headers.get("x-almar-height"), "height");
    const altEn = altFromHeader(headers.get("x-almar-alt-en"));
    return { ok: true, value: { contentType: type, length, sha256, width, height, altEn } };
  } catch (error) {
    if (isOpsInvalid(error)) return { ok: false, status: 400, code: "invalid", field: error.field };
    throw error;
  }
}

// ---- GET query ---------------------------------------------------------------------------------------------------------

export type MediaQuery = { q: string | null; limit: number; after: string | null };

/** `q` (at most 100 characters; empty = none), `limit` (1..60, default 60), `after` (a media key; empty = none). */
export function parseMediaQuery(query: URLSearchParams): MediaQuery {
  const rawQ = query.get("q");
  const q = rawQ === null ? null : rawQ.trim();
  if (q !== null && chars(q) > Q_MAX) throw new OpsInvalid("q");

  const rawLimit = query.get("limit");
  let limit = LIST_LIMIT;
  if (rawLimit !== null && rawLimit !== "") {
    if (!/^\d{1,3}$/.test(rawLimit)) throw new OpsInvalid("limit");
    limit = Number(rawLimit);
    if (limit < 1 || limit > LIST_LIMIT) throw new OpsInvalid("limit");
  }

  const rawAfter = query.get("after");
  const after = rawAfter === null || rawAfter === "" ? null : rawAfter;
  if (after !== null && (after.length > KEY_MAX || !MEDIA_KEY.test(after) || after.includes(".."))) throw new OpsInvalid("after");

  return { q: q === "" ? null : q, limit, after };
}

// ---- POST body ---------------------------------------------------------------------------------------------------------

type OtherLocale = Exclude<Locale3, "en">;
export type AltStatus = "published" | "draft";

export type SaveAltAction = {
  action: "save_alt";
  id: string;
  alt: { en: string } & Partial<Record<OtherLocale, string | null>>;
  status?: Partial<Record<OtherLocale, AltStatus>>;
};
export type DeleteMediaAction = { action: "delete"; id: string };
export type MediaPost = SaveAltAction | DeleteMediaAction;

const OTHER: readonly OtherLocale[] = ["ar", "es"];

/**
 * `{ action: "save_alt", id, alt: { en, ar?, es? }, status?: { ar?, es? } }` or `{ action: "delete", id }`.
 * English is required (trimmed, 1..300 characters). Arabic or Spanish: a string (trimmed; empty = null) or null, and
 * null deletes that record (ops_save_image_alts). Status: "published" | "draft" for ar / es only. Unknown keys refused.
 */
export function parseMediaPost(value: unknown): MediaPost {
  const body = record(value, "body");
  if (body.action === "delete") {
    onlyKeys(body, ["action", "id"]);
    return { action: "delete", id: uuid(body.id, "id") };
  }
  if (body.action !== "save_alt") throw new OpsInvalid("action");

  onlyKeys(body, ["action", "id", "alt", "status"]);
  const id = uuid(body.id, "id");
  const altIn = record(body.alt, "alt");
  onlyKeys(altIn, ["en", "ar", "es"], "alt.");
  const alt: SaveAltAction["alt"] = { en: requiredText(altIn.en, "alt.en", { max: ALT_MAX, locale: "en" }) };
  for (const locale of OTHER) {
    if (!has(altIn, locale)) continue;
    const raw = altIn[locale];
    if (raw !== null && typeof raw !== "string") throw new OpsInvalid(`alt.${locale}`, locale);
    alt[locale] = text(raw, `alt.${locale}`, { max: ALT_MAX, locale });
  }

  const out: SaveAltAction = { action: "save_alt", id, alt };
  if (has(body, "status")) {
    const statusIn = record(body.status, "status");
    onlyKeys(statusIn, ["ar", "es"], "status.");
    const status: Partial<Record<OtherLocale, AltStatus>> = {};
    for (const locale of OTHER) {
      if (!has(statusIn, locale)) continue;
      const s = statusIn[locale];
      if (s !== "published" && s !== "draft") throw new OpsInvalid(`status.${locale}`, locale);
      status[locale] = s;
    }
    out.status = status;
  }
  return out;
}
