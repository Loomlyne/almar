// scripts/media-manifest.mjs
//
// The manifest builder and checker for lib/data/media-manifest.json (plan 03.3-07, design 10.1).
//
//   node scripts/media-manifest.mjs                       = --check: read-only, exit 1 on any drift
//   node scripts/media-manifest.mjs --write               fills image_ids and, from media-staging/, the measured fields
//   node scripts/media-manifest.mjs --sync-fixture-dimensions
//                                                         rewrites fixture width/height where the file disagrees
//   --root <dir>                                          operate on another tree (tests use a scratch copy)
//
// No timestamp is written anywhere, so a re-run is no diff. A cached file whose sha256 differs from the
// committed one is a problem in both modes: the manifest's hash is the record of what was uploaded, and it is
// never silently replaced.

import fs from "node:fs";
import path from "node:path";
import {
  FORBIDDEN_HOSTS,
  FRAMER_SOURCE_RE,
  LOCAL_SOURCE_RE,
  assertKey,
  cachePath,
  collectFixtureImages,
  defaultPaths,
  isMain,
  isWebp,
  md5,
  readManifest,
  serializeManifest,
  sha256,
  webpDimensions,
  writeManifest,
} from "./media-lib.mjs";

const LOCALES = ["en", "ar", "es"];

/**
 * The decorative set: the only images allowed to have alt="" in en, ar and es (design 3.3 and S3-25 publish the About
 * intro photos, the still, the card photos and the Get In Touch still with an empty alt). Every other image needs a
 * non-empty alt record in all three languages. Eleven keys sit under the four prefixes below; two more are About's own
 * image ids for photos whose keys the home page shares (home/gallery/13.webp, home/hero/poster.webp): the home-side id
 * of the same key is a described photo and stays outside the set. The About hero is a meaningful picture and is outside it.
 */
export const DECORATIVE_KEY_PREFIXES = ["about/intro/", "about/story/", "about/values/", "about/cta/"];
export const DECORATIVE_REUSED_IMAGE_IDS = new Set([
  "94ffea10-71fa-5bd9-a4b3-291b2ff7047a", // About intro photo 2 = home/gallery/13.webp
  "ed7466de-f9a3-51b7-a170-987601defa6d", // About Get In Touch still = home/hero/poster.webp
]);

/** True when this image may carry alt="" in every language. */
export function isDecorativeImage(id, key) {
  return DECORATIVE_REUSED_IMAGE_IDS.has(id) || (typeof key === "string" && DECORATIVE_KEY_PREFIXES.some((p) => key.startsWith(p)));
}
const MEASURED = ["content_type", "bytes", "sha256", "md5", "width", "height"];

function readAlts(fixturesDir) {
  const file = path.join(fixturesDir, "image-translations.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Computes the manifest from the committed one, the fixtures and (when present) the cached files.
 * Returns `{ manifest, problems }`. `problems` is structural: anything in it makes --write refuse and --check fail.
 * It never throws on a bad manifest, but collectFixtureImages throws on a URL inside a fixture.
 */
export function buildManifest({ fixturesDir, manifestPath, cacheDir } = {}) {
  const d = defaultPaths();
  fixturesDir ??= d.fixturesDir;
  manifestPath ??= d.manifestPath;
  cacheDir ??= d.cacheDir;

  const problems = [];
  const images = collectFixtureImages(fixturesDir);
  const committed = readManifest(manifestPath);
  const alts = readAlts(fixturesDir);

  // 1. Entries: shape, key, source, uniqueness.
  const byKey = new Map();
  for (const entry of committed) {
    const key = entry && entry.key;
    if (byKey.has(key)) {
      problems.push(`duplicate key ${JSON.stringify(key)}`);
      continue;
    }
    byKey.set(key, entry);
    try {
      assertKey(key);
    } catch {
      problems.push(`bad key ${JSON.stringify(key)}`);
    }
    const src = entry.source;
    if (typeof src !== "string") {
      problems.push(`${key}: source is missing`);
    } else {
      for (const host of FORBIDDEN_HOSTS.filter((h) => h !== "framerusercontent.com")) {
        if (src.includes(host)) problems.push(`${key}: source names ${host} (not allowed)`);
      }
      const isLocal = LOCAL_SOURCE_RE.test(src);
      const isFramer = FRAMER_SOURCE_RE.test(src);
      if (!isLocal && !isFramer) {
        problems.push(`${key}: source ${JSON.stringify(src)} is neither /assets/img/<file>.webp nor https://framerusercontent.com/images/...`);
      } else if (entry.source_kind !== (isLocal ? "local" : "framerusercontent")) {
        problems.push(`${key}: source_kind ${JSON.stringify(entry.source_kind)} does not match its source`);
      }
    }
    if (!Array.isArray(entry.used_by) || entry.used_by.length === 0 || !entry.used_by.every((x) => typeof x === "string")) {
      problems.push(`${key}: used_by must be a non-empty array of strings`);
    }
  }

  // 2. Key parity with the fixtures, both directions.
  const idsByKey = new Map();
  const keyById = new Map();
  for (const img of images) {
    if (!idsByKey.has(img.media_key)) idsByKey.set(img.media_key, new Set());
    idsByKey.get(img.media_key).add(img.id);
    const prior = keyById.get(img.id);
    if (prior && prior !== img.media_key) problems.push(`image id ${img.id} points at two keys: ${prior} and ${img.media_key}`);
    keyById.set(img.id, img.media_key);
    try {
      assertKey(img.media_key);
    } catch {
      problems.push(`${img.file} ${img.path}: fixture key ${JSON.stringify(img.media_key)} fails the key rules`);
    }
  }
  for (const key of idsByKey.keys()) {
    if (!byKey.has(key)) problems.push(`missing from manifest: fixture key ${key}`);
  }
  for (const key of byKey.keys()) {
    if (!idsByKey.has(key)) problems.push(`orphan in manifest: ${key} is used by no fixture`);
  }

  // 3. Alt records: the manifest points at the record, it never copies the text.
  // Every image needs a non-empty alt in en, ar and es. The one exception is the decorative set (isDecorativeImage:
  // the About photos of the signed design, design 3.3 and S3-25), which may carry alt="" exactly, in all three languages
  // or in none; a mix is a problem, and a whitespace-only alt is still no record. Any other image with an empty alt fails.
  const altSet = new Set();
  const rawAlt = new Map();
  for (const a of alts) {
    if (typeof a.alt !== "string") continue;
    rawAlt.set(`${a.image_id}|${a.locale}`, a.alt);
    if (a.alt.trim().length > 0) altSet.add(`${a.image_id}|${a.locale}`);
  }
  for (const [id, key] of keyById) {
    if (isDecorativeImage(id, key)) {
      if (LOCALES.every((l) => rawAlt.get(`${id}|${l}`) === "")) continue;
      if (LOCALES.some((l) => rawAlt.get(`${id}|${l}`) === "") && LOCALES.some((l) => altSet.has(`${id}|${l}`))) {
        problems.push(`image ${id} (${key}) is decorative in some languages and not in others`);
        continue;
      }
    }
    for (const locale of LOCALES) {
      if (!altSet.has(`${id}|${locale}`)) problems.push(`no ${locale} alt record for image ${id} (${key})`);
    }
  }

  // 4. Compute each entry, filling measured fields from the cache when the file is there.
  const manifest = [];
  for (const entry of committed) {
    const key = entry.key;
    const next = { ...entry };
    const ids = idsByKey.get(key);
    next.image_ids = ids ? [...ids].filter((x) => typeof x === "string").sort() : [];
    if (typeof key === "string" && keyOk(key)) {
      const file = cachePath(key, cacheDir);
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        if (!isWebp(buf)) {
          problems.push(`${key}: cached file is not RIFF....WEBP`);
        } else {
          const hash = sha256(buf);
          if (entry.sha256 && entry.sha256 !== hash) {
            problems.push(`HASH MISMATCH ${key} expected ${entry.sha256} got ${hash}`);
          } else {
            let dims = null;
            try {
              dims = webpDimensions(buf);
            } catch (err) {
              problems.push(`${key}: ${err.message}`);
            }
            if (dims) {
              next.content_type = "image/webp";
              next.bytes = buf.length;
              next.sha256 = hash;
              next.md5 = md5(buf);
              next.width = dims.width;
              next.height = dims.height;
            }
          }
        }
      }
    }
    // Measured fields are all present or all absent, and well formed when present.
    const present = MEASURED.filter((f) => next[f] !== undefined);
    if (present.length > 0) {
      if (present.length !== MEASURED.length) {
        problems.push(`${key}: measured fields are partial (have ${present.join(", ")})`);
      } else {
        if (next.content_type !== "image/webp") problems.push(`${key}: content_type must be image/webp`);
        if (!Number.isInteger(next.bytes) || next.bytes <= 0) problems.push(`${key}: bytes must be a positive integer`);
        if (!/^[0-9a-f]{64}$/.test(next.sha256)) problems.push(`${key}: sha256 is not 64 hex characters`);
        if (!/^[0-9a-f]{32}$/.test(next.md5)) problems.push(`${key}: md5 is not 32 hex characters`);
        if (!Number.isInteger(next.width) || next.width <= 0) problems.push(`${key}: width must be a positive integer`);
        if (!Number.isInteger(next.height) || next.height <= 0) problems.push(`${key}: height must be a positive integer`);
      }
    }
    manifest.push(next);
  }

  return { manifest, problems };
}

function keyOk(key) {
  try {
    assertKey(key);
    return true;
  } catch {
    return false;
  }
}

/** buildManifest plus the byte-identity check against the committed file. */
export function checkManifest(opts = {}) {
  const d = defaultPaths();
  const manifestPath = opts.manifestPath ?? d.manifestPath;
  const { manifest, problems } = buildManifest(opts);
  const list = [...problems];
  if (list.length === 0) {
    const want = serializeManifest(manifest);
    const have = fs.readFileSync(manifestPath, "utf8");
    if (want !== have) list.push("manifest is not byte-identical to the computed one (run: node scripts/media-manifest.mjs --write)");
  }
  return { manifest, problems: list };
}

/**
 * Rewrites only the width and height numbers of fixture image objects whose size differs from the manifest entry
 * measured from the file. Key order and formatting are kept (the fixtures are 2-space JSON with a trailing
 * newline; a file that does not round-trip is refused rather than reformatted).
 * Returns `{ changes: [{ file, id, key, from: {width,height}, to: {width,height} }], problems }`.
 */
export function syncFixtureDimensions({ fixturesDir, manifestPath } = {}) {
  const d = defaultPaths();
  fixturesDir ??= d.fixturesDir;
  manifestPath ??= d.manifestPath;
  const manifest = new Map(readManifest(manifestPath).map((e) => [e.key, e]));
  const changes = [];
  const problems = [];
  const files = fs
    .readdirSync(fixturesDir)
    .filter((n) => n.endsWith(".json") && n !== "image-translations.json")
    .sort();
  for (const file of files) {
    const full = path.join(fixturesDir, file);
    const text = fs.readFileSync(full, "utf8");
    const data = JSON.parse(text);
    if (JSON.stringify(data, null, 2) + "\n" !== text) {
      problems.push(`${file}: not 2-space JSON with a trailing newline; refusing to rewrite`);
      continue;
    }
    let touched = false;
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      if (typeof node.media_key === "string") {
        const entry = manifest.get(node.media_key);
        if (!entry || !Number.isInteger(entry.width) || !Number.isInteger(entry.height)) {
          problems.push(`${file}: ${node.media_key} has no measured size in the manifest (run media-fetch, then media-manifest --write)`);
        } else if (node.width !== entry.width || node.height !== entry.height) {
          changes.push({
            file,
            id: node.id,
            key: node.media_key,
            from: { width: node.width, height: node.height },
            to: { width: entry.width, height: entry.height },
          });
          node.width = entry.width;
          node.height = entry.height;
          touched = true;
        }
      }
      for (const v of Object.values(node)) walk(v);
    };
    walk(data);
    if (touched) fs.writeFileSync(full, JSON.stringify(data, null, 2) + "\n");
  }
  return { changes, problems };
}

function parseArgs(argv) {
  const opts = { mode: "check", root: undefined, sync: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") opts.mode = "check";
    else if (a === "--write") opts.mode = "write";
    else if (a === "--sync-fixture-dimensions") opts.sync = true;
    else if (a === "--root") opts.root = path.resolve(argv[++i] ?? "");
    else throw new Error(`unknown argument ${JSON.stringify(a)}`);
  }
  return opts;
}

/** Returns the exit code; the entry guard below sets process.exitCode from it. */
export function main(argv = [], { log = console.log } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    log(`media-manifest: ${err.message}`);
    log("usage: node scripts/media-manifest.mjs [--check | --write] [--sync-fixture-dimensions] [--root <dir>]");
    return 2;
  }
  const paths = defaultPaths(opts.root);
  try {
    if (opts.sync) {
      const { changes, problems } = syncFixtureDimensions(paths);
      for (const p of problems) log(`media-manifest: ${p}`);
      for (const c of changes) {
        log(`media-manifest: dimensions ${c.file} ${c.id} ${c.key} ${c.from.width}x${c.from.height} -> ${c.to.width}x${c.to.height}`);
      }
      log(`media-manifest: ${changes.length} fixture image size(s) corrected`);
      return problems.length ? 1 : 0;
    }
    if (opts.mode === "write") {
      const { manifest, problems } = buildManifest(paths);
      if (problems.length) {
        for (const p of problems) log(`media-manifest: ${p}`);
        log("media-manifest: not written, fix the problems above first");
        return 1;
      }
      writeManifest(manifest, paths.manifestPath);
      const measured = manifest.filter((e) => e.sha256).length;
      log(`media-manifest: wrote ${manifest.length} entries (${measured} measured)`);
      return 0;
    }
    const { manifest, problems } = checkManifest(paths);
    if (problems.length) {
      for (const p of problems) log(`media-manifest: ${p}`);
      return 1;
    }
    const measured = manifest.filter((e) => e.sha256).length;
    log(`media-manifest: OK ${manifest.length} entries, ${measured} measured`);
    return 0;
  } catch (err) {
    log(`media-manifest: ${err.message}`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
