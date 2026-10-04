// scripts/media-fetch.mjs
//
// Fills the gitignored cache media-staging/<key> with the bytes of every manifest entry (plan 03.3-07).
//
//   node scripts/media-fetch.mjs              copy local sources, GET Framer sources, verify sha256
//   node scripts/media-fetch.mjs --offline    no network: every needed download is an error
//   --root <dir>                              operate on another tree
//
// Plain GETs only, no gate, no Cloudflare. A file whose sha256 already matches the manifest is never fetched
// again. A fresh download whose sha256 differs from the committed one is a failure and is never written, and the
// manifest is never touched by this script (the hash in it is the record of what was uploaded).
//
// Framer images are asked for as WebP in two steps, because the Framer CDN only transcodes some of them when the
// request carries `Accept: image/webp` (measured 2026-10-03: 8 of the 66 sources negotiate to WebP, the other 58
// answer with the original JPEG/PNG at the same size):
//   1. the source URL exactly as the manifest records it, with `Accept: image/webp`;
//   2. if that answer is not image/webp, the same URL with `format=webp` added to its query. The CDN then answers a
//      full-size WebP (three fresh cache misses gave the same sha256, even with `Accept: */*`).
// A source that answers WebP in neither step is a hard error naming the key.

import fs from "node:fs";
import path from "node:path";
import {
  FRAMER_SOURCE_RE,
  LOCAL_SOURCE_RE,
  assertKey,
  cachePath,
  defaultPaths,
  formatMB,
  isMain,
  isWebp,
  readManifest,
  sha256,
} from "./media-lib.mjs";

const USER_AGENT = "almar-media-fetch";

async function sleep(ms) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

/** The same Framer URL with `format=webp` in its query (kept if it is already there). */
export function withFormatWebp(source) {
  const url = new URL(source);
  url.searchParams.set("format", "webp");
  return url.toString();
}

async function getOnce(url, { fetch, retries, retryDelayMs, timeoutMs }) {
  let lastError = "no attempt";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs);
    let res;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { Accept: "image/webp", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = `network error: ${err && err.message ? err.message : err}`;
      continue;
    }
    if (res.status >= 500) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
    if (res.url && new URL(res.url).hostname !== "framerusercontent.com") throw new Error(`${url} redirected to ${res.url}`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    return { type, body: type === "image/webp" ? Buffer.from(await res.arrayBuffer()) : null };
  }
  throw new Error(`${lastError} for ${url} after ${retries + 1} attempts`);
}

async function getRemote(source, opts) {
  const seen = [];
  for (const url of [source, withFormatWebp(source)]) {
    const { type, body } = await getOnce(url, opts);
    if (body) return body;
    seen.push(type || "no content-type");
  }
  throw new Error(`${source} answered content-type ${seen.map((t) => JSON.stringify(t)).join(" then ")} (second try with format=webp), not image/webp`);
}

/**
 * Brings the cache in line with the manifest. Returns
 * `{ entries, cached, downloaded, copied, failed, bytes, unhashed }` and logs one line per notable entry (in
 * manifest order) and a final summary line.
 */
export async function fetchAll({
  manifest,
  cacheDir,
  publicDir,
  offline = false,
  fetch = globalThis.fetch,
  log = console.log,
  concurrency = 4,
  retries = 2,
  retryDelayMs = 500,
  timeoutMs = 30_000,
} = {}) {
  const d = defaultPaths();
  cacheDir ??= d.cacheDir;
  publicDir ??= d.publicDir;
  const result = { entries: manifest.length, cached: 0, downloaded: 0, copied: 0, failed: 0, bytes: 0, unhashed: 0 };
  const messages = new Array(manifest.length).fill(null).map(() => []);

  async function one(entry, say) {
    assertKey(entry.key);
    const target = cachePath(entry.key, cacheDir);
    if (fs.existsSync(target)) {
      const buf = fs.readFileSync(target);
      const got = sha256(buf);
      if (!entry.sha256) {
        if (!isWebp(buf)) throw new Error("cached file is not RIFF....WEBP");
        say(`UNHASHED ${entry.key}`);
        result.unhashed++;
        result.cached++;
        result.bytes += buf.length;
        return;
      }
      if (got === entry.sha256 && isWebp(buf)) {
        result.cached++;
        result.bytes += buf.length;
        return;
      }
      if (offline) {
        say(`HASH MISMATCH ${entry.key} expected ${entry.sha256} got ${got} (cached file)`);
        result.failed++;
        return;
      }
      // A stale or damaged cache file: fetch it again below and compare with the manifest.
    } else if (offline) {
      say(`MISSING ${entry.key} is not cached and --offline forbids a download`);
      result.failed++;
      return;
    }

    let bytes;
    let how;
    if (entry.source_kind === "local" || (typeof entry.source === "string" && entry.source.startsWith("/"))) {
      if (!LOCAL_SOURCE_RE.test(entry.source)) throw new Error(`local source ${JSON.stringify(entry.source)} is not /assets/img/<file>.webp`);
      bytes = fs.readFileSync(path.join(publicDir, entry.source));
      how = "copied";
    } else {
      if (!FRAMER_SOURCE_RE.test(entry.source)) throw new Error(`source ${JSON.stringify(entry.source)} is not a framerusercontent.com image`);
      bytes = await getRemote(entry.source, { fetch, retries, retryDelayMs, timeoutMs });
      how = "downloaded";
    }
    if (!isWebp(bytes)) throw new Error(`${how === "copied" ? "local file" : "download"} is not RIFF....WEBP`);
    const got = sha256(bytes);
    if (entry.sha256 && got !== entry.sha256) {
      say(`HASH MISMATCH ${entry.key} expected ${entry.sha256} got ${got}`);
      result.failed++;
      return;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, target);
    result[how]++;
    result.bytes += bytes.length;
    if (!entry.sha256) {
      say(`UNHASHED ${entry.key}`);
      result.unhashed++;
    }
  }

  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= manifest.length) return;
      const entry = manifest[i];
      try {
        await one(entry, (m) => messages[i].push(m));
      } catch (err) {
        messages[i].push(`FAILED ${entry.key}: ${err && err.message ? err.message : err}`);
        result.failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, manifest.length || 1)) }, worker));

  for (const list of messages) for (const m of list) log(m);
  log(
    `media-fetch: ${result.entries} entries, ${result.cached} cached, ${result.downloaded} downloaded, ${result.copied} copied, ` +
      `${result.failed} failed, ${formatMB(result.bytes)} MB in media-staging/`,
  );
  return result;
}

/** Returns the exit code. */
export async function main(argv = [], { log = console.log, fetch = globalThis.fetch } = {}) {
  let offline = false;
  let root;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") offline = true;
    else if (a === "--root") root = path.resolve(argv[++i] ?? "");
    else {
      log(`media-fetch: unknown argument ${JSON.stringify(a)}`);
      log("usage: node scripts/media-fetch.mjs [--offline] [--root <dir>]");
      return 2;
    }
  }
  const paths = defaultPaths(root);
  let manifest;
  try {
    manifest = readManifest(paths.manifestPath);
  } catch (err) {
    log(`media-fetch: ${err.message}`);
    return 1;
  }
  const result = await fetchAll({ manifest, cacheDir: paths.cacheDir, publicDir: paths.publicDir, offline, fetch, log });
  return result.failed > 0 ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
