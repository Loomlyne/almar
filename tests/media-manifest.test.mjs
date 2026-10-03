// Tests for the media manifest and its builder (plan 03.3-07, task 1).
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
  readManifest,
  serializeManifest,
  slice1Documents,
  webpDimensions,
} from "../scripts/media-lib.mjs";
import { buildManifest, checkManifest, main as manifestMain } from "../scripts/media-manifest.mjs";

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

test("every manifest image_id has an en, ar and es alt record (the manifest never copies alt text)", () => {
  const have = new Set(alts.filter((a) => a.alt && a.alt.trim()).map((a) => `${a.image_id}|${a.locale}`));
  let checked = 0;
  for (const e of manifest) {
    assert.ok(e.image_ids.length > 0, `${e.key} has no image_ids`);
    assert.equal("alt" in e, false, `${e.key}: the manifest must not hold alt text`);
    for (const id of e.image_ids) {
      for (const locale of ["en", "ar", "es"]) {
        assert.ok(have.has(`${id}|${locale}`), `${e.key}: no ${locale} alt record for image ${id}`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 300);
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
  fs.writeFileSync(apath, JSON.stringify(a.filter((r) => !(r.image_id === images[5].id && r.locale === "ar")), null, 2) + "\n");
  const { problems } = buildManifest(defaultPaths(root));
  const text = problems.join("\n");
  assert.match(text, /duplicate key/);
  assert.match(text, /catbox\.moe/);
  assert.match(text, /bad key "Stays\/BAD key\.webp"/);
  assert.match(text, new RegExp(`no ar alt record for image ${images[5].id}`));
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
