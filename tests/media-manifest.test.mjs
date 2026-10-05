// Tests for the media manifest, its builder and the fetch step (plan 03.3-07, tasks 1 and 2).
// The manifest is the one list of every image the slice-1 pages render. These tests prove, on the real tree,
// that its key set equals the fixtures' key set both ways, that every image has an alt record in all three
// languages, and (once the files are measured) that every entry has a hash, size and dimensions. The red cases
// run on scratch copies in os.tmpdir().
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FRAMER_SOURCE_RE,
  KEY_RE,
  LOCAL_SOURCE_RE,
  REPO_ROOT,
  assertKey,
  cachePath,
  collectFixtureImages,
  defaultPaths,
  isWebp,
  md5,
  readManifest,
  readPostSlugs,
  readStaySlugs,
  reactDocuments,
  serializeManifest,
  sha256,
  slice1Documents,
  slice3Documents,
  webpDimensions,
} from "../scripts/media-lib.mjs";
import { buildManifest, checkManifest, main as manifestMain, syncFixtureDimensions } from "../scripts/media-manifest.mjs";
import { fetchAll, withFormatWebp } from "../scripts/media-fetch.mjs";
import { assembleOut } from "../scripts/assemble-cloudflare.mjs";
import { PUBLIC_PAGES, matchPublicPage } from "../lib/locale-path.ts";

const paths = defaultPaths();
const manifest = readManifest(paths.manifestPath);
const images = collectFixtureImages(paths.fixturesDir);
const alts = JSON.parse(fs.readFileSync(path.join(paths.fixturesDir, "image-translations.json"), "utf8"));

function scratch(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `almar-media-${label}-`));
  fs.mkdirSync(path.join(root, "lib", "data"), { recursive: true });
  fs.cpSync(paths.fixturesDir, path.join(root, "lib", "data", "fixtures"), { recursive: true });
  fs.copyFileSync(paths.manifestPath, path.join(root, "lib", "data", "media-manifest.json"));
  return root;
}

// 1. Key parity, both directions ---------------------------------------------------------------------------------

test("the manifest's key set equals the fixtures' media_key set, both directions", () => {
  const fixtureKeys = new Set(images.map((i) => i.media_key));
  const manifestKeys = new Set(manifest.map((e) => e.key));
  assert.ok(fixtureKeys.size >= 100, `expected 100+ distinct image keys, saw ${fixtureKeys.size}`);
  assert.deepEqual([...fixtureKeys].filter((k) => !manifestKeys.has(k)), [], "fixture key missing from the manifest");
  assert.deepEqual([...manifestKeys].filter((k) => !fixtureKeys.has(k)), [], "manifest key used by no fixture");
});

test("every manifest entry points at its fixture image ids (image_ids, sorted)", () => {
  const idsByKey = new Map();
  for (const i of images) idsByKey.set(i.media_key, [...(idsByKey.get(i.media_key) ?? []), i.id]);
  for (const e of manifest) {
    assert.deepEqual(e.image_ids, [...new Set(idsByKey.get(e.key))].sort(), `${e.key}: image_ids`);
  }
});

// 2. Alt records --------------------------------------------------------------------------------------------------

test("every manifest image_id has an en, ar and es alt record: three non-empty, or all three exactly empty (decorative)", (t) => {
  const rec = new Map(alts.map((a) => [`${a.image_id}|${a.locale}`, a.alt]));
  let checked = 0;
  let decorative = 0;
  for (const e of manifest) {
    assert.ok(e.image_ids.length > 0, `${e.key} has no image_ids`);
    assert.equal("alt" in e, false, `${e.key}: the manifest must not hold alt text`);
    for (const id of e.image_ids) {
      const three = ["en", "ar", "es"].map((locale) => rec.get(`${id}|${locale}`));
      for (const [i, alt] of three.entries()) assert.equal(typeof alt, "string", `${e.key}: no ${["en", "ar", "es"][i]} alt record for image ${id}`);
      const empty = three.filter((a) => a === "").length;
      if (empty === 3) decorative++;
      else assert.ok(three.every((a) => a.trim().length > 0), `${e.key}: image ${id} is empty in ${empty} language(s) and not in all, or holds only spaces`);
      checked += 3;
    }
  }
  assert.ok(checked >= 300);
  assert.ok(decorative >= 1, "the About photos are decorative, so at least one image has empty alt in all three languages");
  t.diagnostic(`${decorative} decorative image id(s) of ${checked / 3}`);
});

// 3. Key, source and host rules -----------------------------------------------------------------------------------

test("every key passes assertKey, every source passes the source rule, no catbox or pexels anywhere", () => {
  for (const e of manifest) {
    assert.doesNotThrow(() => assertKey(e.key), e.key);
    assert.match(e.key, KEY_RE);
    const isLocal = LOCAL_SOURCE_RE.test(e.source);
    const isFramer = FRAMER_SOURCE_RE.test(e.source);
    assert.ok(isLocal || isFramer, `${e.key}: source ${e.source}`);
    assert.equal(e.source_kind, isLocal ? "local" : "framerusercontent", `${e.key}: source_kind`);
    assert.ok(Array.isArray(e.used_by) && e.used_by.length > 0, `${e.key}: used_by`);
  }
  const text = fs.readFileSync(paths.manifestPath, "utf8");
  assert.doesNotMatch(text, /catbox|pexels/);
});

test("assertKey refuses traversal, absolute paths, backslashes, a URL and a wrong extension", () => {
  assertKey("stays/x/hero.webp");
  for (const bad of ["a/../b.webp", "/abs.webp", "a\\b.webp", "https://x/y.webp", "x.jpg", "Stays/X.webp", "", "a b.webp", "//h/x.webp"]) {
    assert.throws(() => assertKey(bad), undefined, JSON.stringify(bad));
  }
  assert.throws(() => cachePath("../x.webp"));
});

// 4. Sorted and unique --------------------------------------------------------------------------------------------

test("entries are sorted by key and keys are unique", () => {
  const keys = manifest.map((e) => e.key);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(new Set(keys).size, keys.length);
});

// 5. The CLI check ------------------------------------------------------------------------------------------------

test("`node scripts/media-manifest.mjs --check` exits 0 on the real tree and is byte-identical to --write", () => {
  const r = spawnSync(process.execPath, ["scripts/media-manifest.mjs", "--check"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const { manifest: computed, problems } = checkManifest();
  assert.deepEqual(problems, []);
  assert.equal(serializeManifest(computed), fs.readFileSync(paths.manifestPath, "utf8"));
});

// 6. WebP headers -------------------------------------------------------------------------------------------------

function riff(fourcc, payload) {
  const chunk = Buffer.alloc(8 + payload.length + (payload.length % 2));
  chunk.write(fourcc, 0, "latin1");
  chunk.writeUInt32LE(payload.length, 4);
  payload.copy(chunk, 8);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(4 + chunk.length, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, chunk]);
}

function vp8(w, h) {
  const p = Buffer.alloc(10);
  p[3] = 0x9d;
  p[4] = 0x01;
  p[5] = 0x2a;
  p.writeUInt16LE(w, 6);
  p.writeUInt16LE(h, 8);
  return riff("VP8 ", p);
}

function vp8l(w, h) {
  const p = Buffer.alloc(5);
  p[0] = 0x2f;
  p.writeUInt32LE(((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14), 1);
  return riff("VP8L", p);
}

function vp8x(w, h) {
  const p = Buffer.alloc(10);
  p.writeUIntLE(w - 1, 4, 3);
  p.writeUIntLE(h - 1, 7, 3);
  return riff("VP8X", p);
}

test("webpDimensions reads VP8, VP8L and VP8X headers of known size and refuses anything else", () => {
  assert.deepEqual(webpDimensions(vp8(1600, 1084)), { width: 1600, height: 1084 });
  assert.deepEqual(webpDimensions(vp8(16383, 1)), { width: 16383, height: 1 });
  assert.deepEqual(webpDimensions(vp8l(512, 288)), { width: 512, height: 288 });
  assert.deepEqual(webpDimensions(vp8l(16384, 16384)), { width: 16384, height: 16384 });
  assert.deepEqual(webpDimensions(vp8x(4160, 2774)), { width: 4160, height: 2774 });
  assert.deepEqual(webpDimensions(vp8x(1, 1)), { width: 1, height: 1 });
  assert.equal(isWebp(vp8(2, 2)), true);
  for (const bad of [Buffer.from("not an image at all, just text"), Buffer.alloc(0), Buffer.from("RIFF0000WAVEfmt 0000000000000000")]) {
    assert.throws(() => webpDimensions(bad));
    assert.equal(isWebp(bad), false);
  }
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);
  assert.throws(() => webpDimensions(jpeg));
  assert.throws(() => webpDimensions(riff("ABCD", Buffer.alloc(10))), /unknown WebP chunk/);
});

// An independent reader: walks the RIFF chunks and reads the size relative to the chunk payload, not at the
// absolute byte offsets media-lib uses.
function sizeByChunkWalk(buf) {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("latin1", pos, pos + 4);
    const len = buf.readUInt32LE(pos + 4);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (id === "VP8X") return { width: 1 + (body[4] | (body[5] << 8) | (body[6] << 16)), height: 1 + (body[7] | (body[8] << 8) | (body[9] << 16)) };
    if (id === "VP8 ") return { width: (body[6] | (body[7] << 8)) & 0x3fff, height: (body[8] | (body[9] << 8)) & 0x3fff };
    if (id === "VP8L") {
      const b = body.readUInt32LE(1);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    pos += 8 + len + (len % 2);
  }
  throw new Error("no image chunk");
}

test("webpDimensions agrees with an independent chunk-walk on real files under public/assets/img", () => {
  const dir = path.join(REPO_ROOT, "public", "assets", "img");
  const files = fs.readdirSync(dir).filter((n) => n.endsWith(".webp")).sort();
  assert.ok(files.length > 100);
  let checked = 0;
  for (const name of files.slice(0, 40)) {
    const buf = fs.readFileSync(path.join(dir, name));
    assert.deepEqual(webpDimensions(buf), sizeByChunkWalk(buf), name);
    checked++;
  }
  assert.equal(checked, 40);
});

// 7. Red cases on scratch copies ----------------------------------------------------------------------------------

test("RED: collectFixtureImages throws on a fixture that holds a URL instead of a key", () => {
  for (const bad of ["https://framerusercontent.com/images/x.jpg", "http://example.com/x.webp", "/assets/img/abc.webp"]) {
    const root = scratch("url");
    const dir = path.join(root, "lib", "data", "fixtures");
    fs.writeFileSync(path.join(dir, "catalog.json"), JSON.stringify([{ id: "x", image: { id: "i", media_key: "catalog/a.webp", width: 1, height: 1, position: 0 }, link: bad }], null, 2) + "\n");
    assert.throws(() => collectFixtureImages(dir), /fixtures store media keys, not URLs/, bad);
    assert.equal(manifestMain(["--check", "--root", root], { log: () => {} }), 1);
  }
  assert.doesNotThrow(() => collectFixtureImages(paths.fixturesDir));
});

test("RED: buildManifest reports a fixture key missing from the manifest and a manifest key no fixture uses", () => {
  const root = scratch("parity");
  const mpath = path.join(root, "lib", "data", "media-manifest.json");
  const copy = JSON.parse(fs.readFileSync(mpath, "utf8"));
  const dropped = copy.shift();
  copy.push({ key: "stays/orphan-house/hero.webp", source: "/assets/img/0000000000000000.webp", source_kind: "local", used_by: ["x"] });
  fs.writeFileSync(mpath, JSON.stringify(copy, null, 2) + "\n");
  const { problems } = buildManifest(defaultPaths(root));
  assert.ok(problems.some((p) => p === `missing from manifest: fixture key ${dropped.key}`), problems.join("\n"));
  assert.ok(problems.some((p) => p.startsWith("orphan in manifest: stays/orphan-house/hero.webp")), problems.join("\n"));
  const out = [];
  assert.equal(manifestMain(["--check", "--root", root], { log: (l) => out.push(l) }), 1);
  assert.ok(out.length >= 2);
  // --write refuses too, and leaves the file as it was.
  const before = fs.readFileSync(mpath, "utf8");
  assert.equal(manifestMain(["--write", "--root", root], { log: () => {} }), 1);
  assert.equal(fs.readFileSync(mpath, "utf8"), before);
});

test("RED: a duplicate key, a bad key, a catbox source and a missing alt record are each reported", () => {
  const root = scratch("rules");
  const mpath = path.join(root, "lib", "data", "media-manifest.json");
  const copy = JSON.parse(fs.readFileSync(mpath, "utf8"));
  copy.push({ ...copy[0] });
  copy[1].source = "https://files.catbox.moe/abc.webp";
  copy[2].key = "Stays/BAD key.webp";
  fs.writeFileSync(mpath, JSON.stringify(copy, null, 2) + "\n");
  const apath = path.join(root, "lib", "data", "fixtures", "image-translations.json");
  const a = JSON.parse(fs.readFileSync(apath, "utf8"));
  // the first image whose English alt is non-empty, so the case holds whatever order the fixtures list their images in
  const target = images.find((i) => a.some((r) => r.image_id === i.id && r.locale === "en" && r.alt.trim().length > 0));
  fs.writeFileSync(apath, JSON.stringify(a.filter((r) => !(r.image_id === target.id && r.locale === "ar")), null, 2) + "\n");
  const { problems } = buildManifest(defaultPaths(root));
  const text = problems.join("\n");
  assert.match(text, /duplicate key/);
  assert.match(text, /catbox\.moe/);
  assert.match(text, /bad key "Stays\/BAD key\.webp"/);
  assert.match(text, new RegExp(`no ar alt record for image ${target.id}`));
});

test("RED: a manifest that differs from the computed one by one byte fails --check", () => {
  const root = scratch("drift");
  const mpath = path.join(root, "lib", "data", "media-manifest.json");
  fs.writeFileSync(mpath, fs.readFileSync(mpath, "utf8").replace('"source_kind": "local"', '"source_kind":  "local"'));
  const out = [];
  assert.equal(manifestMain(["--check", "--root", root], { log: (l) => out.push(l) }), 1);
  assert.match(out.join("\n"), /not byte-identical/);
});

test("slice1Documents lists the 42 slice-1 documents: 14 per locale, EN at the root", () => {
  const docs = slice1Documents();
  assert.equal(docs.length, 42);
  assert.equal(new Set(docs).size, 42);
  assert.ok(docs.includes("index.html") && docs.includes("ar/index.html") && docs.includes("es/index.html"));
  assert.ok(docs.includes("private-stays.html") && docs.includes("es/private-stays/getsemani-colonial-house.html"));
  assert.equal(docs.filter((d) => d.startsWith("ar/")).length, 14);
});

// The guarded document list and the assembler agree (plan 03.3-22) ------------------------------------------------

/** assembleOut's input layout for an out/ document: a locale home is <locale>.html, every other page keeps its path. */
function assemblerInput(doc) {
  return doc.replace(/^(ar|es)\/index\.html$/, "$1.html");
}

test("the guarded documents (reactDocuments) are exactly the React documents assembleOut ships, About and Contact included once public", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "almar-guarded-docs-"));
  const slugs = readStaySlugs();
  // One React .html per document the guard could ever list, plus the six About/Contact ones, whether or not they are public.
  const all = [...reactDocuments(slugs, readPostSlugs(), [...PUBLIC_PAGES, "/about", "/contact"])];
  for (const doc of all) {
    const file = path.join(base, "app", assemblerInput(doc));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<html>${doc}</html>`);
  }
  // A page outside PUBLIC_PAGES ships in neither list.
  fs.writeFileSync(path.join(base, "app", "dashboard.html"), "<html>dashboard</html>");
  fs.mkdirSync(path.join(base, "static", "css"), { recursive: true });
  fs.writeFileSync(path.join(base, "static", "css", "x.css"), "body{}");
  fs.mkdirSync(path.join(base, "public"), { recursive: true });
  fs.writeFileSync(path.join(base, "_headers"), "/*\n  X-Test: 1\n");
  const report = assembleOut({
    appDir: path.join(base, "app"),
    staticDir: path.join(base, "static"),
    outDir: path.join(base, "out"),
    publicDir: path.join(base, "public"),
    headersFile: path.join(base, "_headers"),
  });
  const shipped = [...report.react.en, ...report.react.ar, ...report.react.es].sort();
  assert.deepEqual(shipped, [...reactDocuments(slugs, readPostSlugs())].sort());
  assert.equal(shipped.includes("about.html"), matchPublicPage("/about") !== null, "about.html ships iff /about is in PUBLIC_PAGES");
  assert.equal(shipped.includes("contact.html"), matchPublicPage("/contact") !== null);
  assert.ok(!shipped.includes("dashboard.html"));
});

test("adding /about and /contact to PUBLIC_PAGES grows the guarded list by exactly six", () => {
  const slugs = readStaySlugs();
  const posts = readPostSlugs();
  const before = reactDocuments(slugs, posts, PUBLIC_PAGES.filter((p) => p !== "/about" && p !== "/contact"));
  const after = reactDocuments(slugs, posts, [...PUBLIC_PAGES.filter((p) => p !== "/about" && p !== "/contact"), "/about", "/contact"]);
  assert.equal(after.length, before.length + 6);
  const added = after.filter((d) => !before.includes(d)).sort();
  assert.deepEqual(added, ["about.html", "ar/about.html", "ar/contact.html", "contact.html", "es/about.html", "es/contact.html"]);
  assert.deepEqual(slice3Documents(["/about", "/contact"]).sort(), added);
});

// The decorative rule (plan 03.3-22): all three languages exactly "" passes; nothing else got looser ---------------

function altProblems(mutate) {
  const root = scratch("decor");
  const apath = path.join(root, "lib", "data", "fixtures", "image-translations.json");
  const a = JSON.parse(fs.readFileSync(apath, "utf8"));
  const target = images.find((i) => a.some((r) => r.image_id === i.id && r.locale === "en" && r.alt.trim().length > 0));
  const all = a;
  mutate(a.filter((r) => r.image_id === target.id), target, all);
  fs.writeFileSync(apath, JSON.stringify(all, null, 2) + "\n");
  const { problems } = buildManifest(defaultPaths(root));
  return { target, text: problems.filter((p) => /alt record|decorative/.test(p) && p.includes(target.id)).join("\n") };
}

test("decorative: an image with en, ar and es alt exactly empty passes the alt rule", () => {
  const { text } = altProblems((recs) => recs.forEach((r) => (r.alt = "")));
  assert.equal(text, "");
});

test("RED: an image empty in one or two languages and not in the others is reported as decorative in some languages only", () => {
  const one = altProblems((recs) => (recs.find((r) => r.locale === "en").alt = ""));
  assert.match(one.text, new RegExp(`image ${one.target.id} \\(${one.target.media_key}\\) is decorative in some languages and not in others`));
  const two = altProblems((recs) => recs.filter((r) => r.locale !== "es").forEach((r) => (r.alt = "")));
  assert.match(two.text, /is decorative in some languages and not in others/);
});

test("RED: a whitespace-only alt is still a missing record, and so is a missing one", () => {
  const spaces = altProblems((recs) => (recs.find((r) => r.locale === "ar").alt = "  "));
  assert.match(spaces.text, new RegExp(`no ar alt record for image ${spaces.target.id}`));
  const spacesAll = altProblems((recs) => recs.forEach((r) => (r.alt = "  ")));
  for (const l of ["en", "ar", "es"]) assert.match(spacesAll.text, new RegExp(`no ${l} alt record for image`));
  const missing = altProblems((recs, target, all) => all.splice(0, all.length, ...all.filter((r) => !(r.image_id === target.id && r.locale === "es"))));
  assert.match(missing.text, /no es alt record for image/);
});

// The About photos (plan 03.3-22) ----------------------------------------------------------------------------------

test("the twelve About entries: local sources, image/webp, measured, bytes and size as measured on 2026-10-03/04", () => {
  const expected = {
    "about/hero.webp": [334666, 1820, 1024],
    "about/intro/01.webp": [239106, 1820, 1024],
    "about/intro/03.webp": [359042, 1820, 1024],
    "about/intro/04.webp": [405880, 1820, 1024],
    "about/intro/05.webp": [366790, 1820, 1024],
    "about/story/designed-with-heart.webp": [106852, 1920, 1277],
    "about/story/bridging-curiosity-and-confidence.webp": [199496, 992, 1200],
    "about/story/a-vision-that-grows.webp": [134190, 1408, 768],
    "about/values/intentional-hospitality.webp": [100554, 1536, 1024],
    "about/values/bilingual-trip-support.webp": [112474, 1536, 1024],
    "about/values/privacy-and-discreet-coordination.webp": [169264, 1536, 1024],
    "about/cta/band.webp": [41422, 1920, 1010],
  };
  const about = manifest.filter((e) => e.key.startsWith("about/"));
  assert.deepEqual(about.map((e) => e.key).sort(), Object.keys(expected).sort());
  for (const e of about) {
    assert.equal(e.source_kind, "local", e.key);
    assert.equal(e.content_type, "image/webp", e.key);
    assert.deepEqual([e.bytes, e.width, e.height], expected[e.key], e.key);
    assert.match(e.sha256, /^[0-9a-f]{64}$/, e.key);
  }
  assert.equal(about.reduce((n, e) => n + e.bytes, 0), 2569736);
});

test("the two reused photos carry two image ids and the about:intro use, and keep their bytes", () => {
  for (const [key, use] of [["home/gallery/13.webp", "home:gallery"], ["home/hero/poster.webp", "home:hero"]]) {
    const e = manifest.find((x) => x.key === key);
    assert.equal(e.image_ids.length, 2, `${key}: image ids`);
    assert.deepEqual(e.used_by, ["about:intro", use].sort(), `${key}: used_by`);
  }
});

// Task 2: measured fields, the cache, and fetch -------------------------------------------------------------------

const cacheExists = fs.existsSync(paths.cacheDir);

test("every entry is measured: content_type, bytes, sha256, md5, width and height", () => {
  for (const e of manifest) {
    assert.equal(e.content_type, "image/webp", `${e.key}: content_type`);
    assert.ok(Number.isInteger(e.bytes) && e.bytes > 0, `${e.key}: bytes`);
    assert.match(e.sha256, /^[0-9a-f]{64}$/, `${e.key}: sha256`);
    assert.match(e.md5, /^[0-9a-f]{32}$/, `${e.key}: md5`);
    assert.ok(Number.isInteger(e.width) && e.width > 0, `${e.key}: width`);
    assert.ok(Number.isInteger(e.height) && e.height > 0, `${e.key}: height`);
  }
});

test("every fixture image's width and height equal its manifest entry's", () => {
  const byKey = new Map(manifest.map((e) => [e.key, e]));
  for (const i of images) {
    const e = byKey.get(i.media_key);
    assert.deepEqual({ width: i.width, height: i.height }, { width: e.width, height: e.height }, `${i.file} ${i.path} (${i.media_key})`);
  }
});

test(cacheExists ? "every cached file's sha256 equals the manifest" : "every cached file's sha256 equals the manifest (SKIPPED: media-staging/ is absent, as in a clean clone)", { skip: !cacheExists && "media-staging/ is absent" }, () => {
  for (const e of manifest) {
    const file = cachePath(e.key, paths.cacheDir);
    assert.ok(fs.existsSync(file), `${e.key} is not cached`);
    const buf = fs.readFileSync(file);
    assert.equal(sha256(buf), e.sha256, e.key);
    assert.equal(buf.length, e.bytes, e.key);
  }
});

function fakeResponse(body, { status = 200, type = "image/webp", url } = {}) {
  return { status, ok: status >= 200 && status < 300, url, headers: { get: (n) => (n.toLowerCase() === "content-type" ? type : null) }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
}

test("fetchAll: downloads once, skips a file whose hash matches, never overwrites on a hash mismatch, offline refuses", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-media-cache-"));
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-media-public-"));
  fs.mkdirSync(path.join(publicDir, "assets", "img"), { recursive: true });
  const good = vp8(40, 30);
  const other = vp8(41, 30);
  fs.writeFileSync(path.join(publicDir, "assets", "img", "aaaa.webp"), good);
  const entries = [
    { key: "t/local.webp", source: "/assets/img/aaaa.webp", source_kind: "local", sha256: sha256(good) },
    { key: "t/remote.webp", source: "https://framerusercontent.com/images/abc.jpg?width=40&height=30", source_kind: "framerusercontent", sha256: sha256(good) },
  ];
  const lines = [];
  let calls = 0;
  const okFetch = async (url, init) => {
    calls++;
    assert.equal(init.headers.Accept, "image/webp");
    assert.equal(init.headers["User-Agent"], "almar-media-fetch");
    return fakeResponse(good, { url });
  };
  let r = await fetchAll({ manifest: entries, cacheDir, publicDir, fetch: okFetch, log: (l) => lines.push(l) });
  assert.deepEqual({ cached: r.cached, downloaded: r.downloaded, copied: r.copied, failed: r.failed }, { cached: 0, downloaded: 1, copied: 1, failed: 0 });
  assert.equal(calls, 1);
  assert.match(lines.at(-1), /^media-fetch: 2 entries, 0 cached, 1 downloaded, 1 copied, 0 failed, 0\.0 MB in media-staging\/$/);
  // Second run: nothing to do, no network.
  r = await fetchAll({ manifest: entries, cacheDir, publicDir, fetch: async () => assert.fail("no network on a warm cache"), log: () => {} });
  assert.deepEqual({ cached: r.cached, downloaded: r.downloaded, copied: r.copied, failed: r.failed }, { cached: 2, downloaded: 0, copied: 0, failed: 0 });
  // Corrupt the cached file: --offline reports HASH MISMATCH and fails; online restores it from the source.
  fs.writeFileSync(path.join(cacheDir, "t", "remote.webp"), other);
  lines.length = 0;
  r = await fetchAll({ manifest: entries, cacheDir, publicDir, offline: true, fetch: async () => assert.fail("offline"), log: (l) => lines.push(l) });
  assert.equal(r.failed, 1);
  assert.ok(lines.some((l) => l.startsWith("HASH MISMATCH t/remote.webp expected ")), lines.join("\n"));
  r = await fetchAll({ manifest: entries, cacheDir, publicDir, fetch: okFetch, log: () => {} });
  assert.equal(r.failed, 0);
  assert.equal(sha256(fs.readFileSync(path.join(cacheDir, "t", "remote.webp"))), sha256(good));
  // A source that now serves different bytes fails and leaves the manifest alone (entries are not mutated).
  fs.rmSync(path.join(cacheDir, "t", "remote.webp"));
  lines.length = 0;
  r = await fetchAll({ manifest: entries, cacheDir, publicDir, fetch: async (url) => fakeResponse(other, { url }), log: (l) => lines.push(l) });
  assert.equal(r.failed, 1);
  assert.ok(lines.some((l) => l.startsWith("HASH MISMATCH t/remote.webp expected ")));
  assert.equal(fs.existsSync(path.join(cacheDir, "t", "remote.webp")), false);
  assert.equal(entries[1].sha256, sha256(good));
  // A source that does not negotiate to WebP is a hard error naming the key.
  lines.length = 0;
  r = await fetchAll({ manifest: entries, cacheDir, publicDir, fetch: async (url) => fakeResponse(Buffer.from([0xff, 0xd8, 0xff]), { url, type: "image/jpeg" }), log: (l) => lines.push(l) });
  assert.equal(r.failed, 1);
  assert.ok(lines.some((l) => /t\/remote\.webp/.test(l) && /image\/webp/.test(l)), lines.join("\n"));
  // An unhashed entry keeps the file and prints UNHASHED.
  lines.length = 0;
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "almar-media-cache-"));
  r = await fetchAll({ manifest: [{ key: "t/new.webp", source: "https://framerusercontent.com/images/new.jpg", source_kind: "framerusercontent" }], cacheDir: fresh, publicDir, fetch: okFetch, log: (l) => lines.push(l) });
  assert.equal(r.failed, 0);
  assert.ok(lines.includes("UNHASHED t/new.webp"));
  assert.equal(md5(fs.readFileSync(path.join(fresh, "t", "new.webp"))), md5(good));
  // A 5xx is retried at most twice, then fails.
  let tries = 0;
  lines.length = 0;
  r = await fetchAll({ manifest: [entries[1]], cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "almar-media-cache-")), publicDir, fetch: async (url) => (tries++, fakeResponse(Buffer.alloc(0), { url, status: 503 })), retryDelayMs: 0, log: (l) => lines.push(l) });
  assert.equal(tries, 3);
  assert.equal(r.failed, 1);
});

test("fetchAll: when the plain answer is not WebP, one second try adds format=webp to the query", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-media-cache-"));
  const good = vp8(40, 30);
  const urls = [];
  const entry = { key: "t/fallback.webp", source: "https://framerusercontent.com/images/abc.jpg?width=40&height=30", source_kind: "framerusercontent", sha256: sha256(good) };
  const r = await fetchAll({
    manifest: [entry],
    cacheDir,
    fetch: async (url) => {
      urls.push(url);
      return new URL(url).searchParams.get("format") === "webp" ? fakeResponse(good, { url }) : fakeResponse(Buffer.from([0xff, 0xd8, 0xff]), { url, type: "image/jpeg" });
    },
    log: () => {},
  });
  assert.equal(r.failed, 0);
  assert.equal(r.downloaded, 1);
  assert.deepEqual(urls, [entry.source, "https://framerusercontent.com/images/abc.jpg?width=40&height=30&format=webp"]);
  assert.equal(withFormatWebp("https://framerusercontent.com/images/a.png"), "https://framerusercontent.com/images/a.png?format=webp");
  assert.equal(withFormatWebp("https://framerusercontent.com/images/a.png?format=webp"), "https://framerusercontent.com/images/a.png?format=webp");
});

test("syncFixtureDimensions rewrites only width and height of a mismatching image, keeping formatting", () => {
  const root = scratch("sync");
  const mpath = path.join(root, "lib", "data", "media-manifest.json");
  const m = JSON.parse(fs.readFileSync(mpath, "utf8"));
  const target = m.find((e) => e.key === images[0].media_key);
  target.width = images[0].width + 7;
  target.height = images[0].height + 3;
  fs.writeFileSync(mpath, JSON.stringify(m, null, 2) + "\n");
  const before = fs.readFileSync(path.join(root, "lib", "data", "fixtures", images[0].file), "utf8");
  const { changes, problems } = syncFixtureDimensions(defaultPaths(root));
  assert.deepEqual(problems, []);
  assert.equal(changes.length, 1);
  const after = fs.readFileSync(path.join(root, "lib", "data", "fixtures", images[0].file), "utf8");
  const diff = [...before.split("\n").entries()].filter(([i, l]) => l !== after.split("\n")[i]);
  assert.equal(diff.length, 2);
  assert.ok(diff.every(([, l]) => /"(width|height)":/.test(l)));
  assert.equal(syncFixtureDimensions(defaultPaths(root)).changes.length, 0);
});
