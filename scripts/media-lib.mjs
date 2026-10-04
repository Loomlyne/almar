// scripts/media-lib.mjs
//
// Pure helpers shared by the four media scripts (media-manifest, media-fetch, media-upload, media-guard).
// Everything here is deterministic and offline. Only readManifest / writeManifest and collectFixtureImages
// touch the disk; cachePath builds a path and nothing more.
//
// Design 10.1 (plan 03.3-07): every image a slice-1 page renders is one manifest entry, keyed by a ".webp"
// media key. Fixtures store the key, never a URL. The bytes live in R2; the base URL lives in
// lib/data/media.ts and nowhere else.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LOCALES, PUBLIC_PAGES } from "../lib/locale-path.ts";

/** The repo root, resolved from this file so the scripts work from any cwd. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Default bucket. The controller may pass another one with --bucket; it is printed in the header. */
export const BUCKET_DEFAULT = "almar-media";
/** ALMAR's Cloudflare account ("Almar Private Journey"). The default wrangler login is the Vamos account. */
export const ALMAR_ACCOUNT_ID = "f1d9a1fa3abdda98c15161b00b40385c";
/** The HOME that holds ALMAR's own wrangler login. */
export const ALMAR_CF_HOME = "/Users/koss/.almar-cloudflare";
export const CONTENT_TYPE = "image/webp";
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Same shape rule as the plan: lower-case path segments, ending ".webp". */
export const KEY_RE = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.webp$/;

/** A source is a local file under public/assets/img or a Framer CDN image. Nothing else. */
export const LOCAL_SOURCE_RE = /^\/assets\/img\/[A-Za-z0-9_-]+\.webp$/;
export const FRAMER_SOURCE_RE = /^https:\/\/framerusercontent\.com\/images\/[A-Za-z0-9_.-]+(\?[A-Za-z0-9_=&.%-]*)?$/;

export const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];

/** The order keys are written in, so a re-run is no diff. */
export const ENTRY_FIELD_ORDER = [
  "key",
  "source",
  "source_kind",
  "used_by",
  "image_ids",
  "content_type",
  "bytes",
  "sha256",
  "md5",
  "width",
  "height",
];

export function defaultPaths(root = REPO_ROOT) {
  return {
    root,
    fixturesDir: path.join(root, "lib", "data", "fixtures"),
    manifestPath: path.join(root, "lib", "data", "media-manifest.json"),
    cacheDir: path.join(root, "media-staging"),
    publicDir: path.join(root, "public"),
    outDir: path.join(root, "out"),
  };
}

/**
 * Throws unless `key` is a plain, safe ".webp" key. The same rejections as lib/data/media.ts mediaUrl, plus the
 * shape rule, so a key the manifest accepts is a key mediaUrl accepts and a key a wrangler argv can carry.
 */
export function assertKey(key) {
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.includes("://") ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.includes("\\") ||
    !KEY_RE.test(key)
  ) {
    throw new Error(`media key refused: ${JSON.stringify(key)}`);
  }
  return key;
}

/** Path of a key inside the staging cache. Path only, no IO. */
export function cachePath(key, cacheDir = defaultPaths().cacheDir) {
  assertKey(key);
  return path.join(cacheDir, ...key.split("/"));
}

export function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function md5(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

/** True for a buffer that starts with RIFF....WEBP. */
export function isWebp(buf) {
  return (
    Buffer.isBuffer(buf) &&
    buf.length >= 16 &&
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  );
}

/**
 * Pixel size from the first chunk of a WebP file.
 *   VP8  (lossy):    14-bit width and height at bytes 26-29 (after the 9d 01 2a start code at 23-25)
 *   VP8L (lossless): signature 0x2f at byte 20, then two 14-bit (size - 1) fields in bytes 21-24
 *   VP8X (extended): 24-bit (canvas width - 1) at bytes 24-26 and (canvas height - 1) at bytes 27-29
 */
export function webpDimensions(buf) {
  if (!isWebp(buf)) throw new Error("not a RIFF....WEBP file");
  const fourcc = buf.toString("latin1", 12, 16);
  if (fourcc === "VP8 ") {
    if (buf.length < 30) throw new Error("truncated VP8 header");
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) throw new Error("bad VP8 start code");
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    if (buf.length < 25) throw new Error("truncated VP8L header");
    if (buf[20] !== 0x2f) throw new Error("bad VP8L signature");
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8X") {
    if (buf.length < 30) throw new Error("truncated VP8X header");
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`unknown WebP chunk ${JSON.stringify(fourcc)}`);
}

/** A string that must never be a fixture value: fixtures hold keys, not addresses. */
function isUrlLike(value) {
  return /^(https?:\/\/|\/assets\/)/i.test(value);
}

function jsonFilesIn(dir) {
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".json") && n !== "image-translations.json")
    .sort();
}

/**
 * Every object carrying a `media_key`, anywhere in lib/data/fixtures/*.json except image-translations.json:
 * `{ id, media_key, width, height, file, path }`. Throws on any string value that starts with http://, https://
 * or /assets/ (fixtures store keys, never URLs).
 */
export function collectFixtureImages(dir = defaultPaths().fixturesDir) {
  const found = [];
  for (const file of jsonFilesIn(dir)) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const walk = (node, where) => {
      if (typeof node === "string") {
        if (isUrlLike(node)) {
          throw new Error(`${file} ${where}: fixtures store media keys, not URLs (${JSON.stringify(node.slice(0, 80))})`);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${where}[${i}]`));
        return;
      }
      if (node && typeof node === "object") {
        if (typeof node.media_key === "string") {
          found.push({
            id: node.id,
            media_key: node.media_key,
            width: node.width,
            height: node.height,
            file,
            path: where,
          });
        }
        for (const [k, v] of Object.entries(node)) walk(v, where === "$" ? `$.${k}` : `${where}.${k}`);
      }
    };
    walk(data, "$");
  }
  return found;
}

/** Reads the manifest. Plan 01's top-level shape is an array and stays one. */
export function readManifest(manifestPath = defaultPaths().manifestPath) {
  const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(data)) throw new Error(`${manifestPath}: the manifest must be a JSON array`);
  return data;
}

/** One entry with its fields in the fixed order; unknown fields are kept after the known ones, sorted. */
export function orderEntry(entry) {
  const out = {};
  for (const f of ENTRY_FIELD_ORDER) if (entry[f] !== undefined) out[f] = entry[f];
  for (const f of Object.keys(entry).sort()) if (!(f in out)) out[f] = entry[f];
  return out;
}

/** The exact text of a manifest file: sorted by key, 2-space JSON, trailing newline. */
export function serializeManifest(manifest) {
  const sorted = [...manifest].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(orderEntry);
  return JSON.stringify(sorted, null, 2) + "\n";
}

export function writeManifest(manifest, manifestPath = defaultPaths().manifestPath) {
  fs.writeFileSync(manifestPath, serializeManifest(manifest));
}

/** The slugs of the published stays (the 12 stay pages), in fixture order. */
export function readStaySlugs(fixturesDir = defaultPaths().fixturesDir) {
  const stays = JSON.parse(fs.readFileSync(path.join(fixturesDir, "stays.json"), "utf8"));
  return stays.filter((s) => s.is_published !== false).map((s) => s.slug);
}

/**
 * The out/ paths of the slice-1 documents: for each of "", "ar/", "es/": the locale root, the list page and one
 * page per stay. 3 x (2 + 12) = 42. The EN root is index.html; a locale root is <locale>/index.html (design 5.4).
 */
export function slice1Documents(staySlugs = readStaySlugs()) {
  const docs = [];
  for (const prefix of ["", "ar/", "es/"]) {
    docs.push(`${prefix}index.html`, `${prefix}private-stays.html`);
    for (const slug of staySlugs) docs.push(`${prefix}private-stays/${slug}.html`);
  }
  return docs;
}

/** The two pages slice 3 converts. They enter the media guard's list only once they are in PUBLIC_PAGES. */
export const SLICE3_PAGES = ["/about", "/contact"];

/**
 * The out/ paths of slice 3's documents (About and Contact in all three locales) that `pages` makes public: nothing
 * while neither is in PUBLIC_PAGES, six once both are (locale prefix "", "ar/", "es/"; no root, no parameter). Added
 * beside slice1Documents and not inside it: slice 2's publicDocuments() replaces both when it lands.
 */
export function slice3Documents(pages = PUBLIC_PAGES) {
  const docs = [];
  for (const locale of LOCALES) {
    const prefix = locale === "en" ? "" : `${locale}/`;
    for (const page of SLICE3_PAGES) {
      if (pages.includes(page)) docs.push(`${prefix}${page.slice(1)}.html`);
    }
  }
  return docs;
}

/** Every document the media guard scans: slice 1's, then slice 3's that PUBLIC_PAGES has made public. */
export function guardedDocuments(staySlugs = readStaySlugs(), pages = PUBLIC_PAGES) {
  return [...slice1Documents(staySlugs), ...slice3Documents(pages)];
}

/** Bytes as decimal megabytes with one decimal, e.g. "47.3". */
export function formatMB(bytes) {
  return (bytes / 1_000_000).toFixed(1);
}

/** The entry point guard every script uses so tests can import it without running it. */
export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}
