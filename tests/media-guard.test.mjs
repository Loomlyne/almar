// Guards for the image host (plan 03.3-07, task 4; design 10.1, threat T-3.3-07-04 and -07).
//   1. Source scan (always runs): no non-Framer file under app/, components/, lib/copy/ or lib/data/ names
//      framerusercontent.com, files.catbox.moe or videos.pexels.com; fixtures hold keys, never URLs; the placeholder
//      host lives in lib/data/media.ts only.
//   2. Constants: lib/data/media.ts is coherent (placeholder iff flag true; otherwise an https origin).
//   3. out/ scan (only with MEDIA_CHECK_OUT=1): the 42 slice-1 documents point at the media base and nowhere else.
//   4. assertMediaReady() and the `--deploy` CLI the controller runs before every deploy.
// The red cases run on scratch copies in os.tmpdir(); the scan functions below are this file's own, so the guard
// cannot go silent because the script it also tests changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT, collectFixtureImages, readStaySlugs, slice1Documents } from "../scripts/media-lib.mjs";
import { assertMediaReady, imageReferences, main as guardMain, readMediaConstants, scanOut } from "../scripts/media-guard.mjs";

const THIRD_PARTY = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
const PLACEHOLDER = "media-pending.invalid";
const rel = (p) => p.split(path.sep).join("/");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** The files the third-party scan reads, and the Framer route files it skips (for the counts the test asserts). */
function sourceFiles(root) {
  const scanned = [];
  const framer = [];
  for (const top of ["app", "components", "lib/copy", "lib/data"]) {
    for (const file of walk(path.join(root, top))) {
      const r = rel(path.relative(root, file));
      if (!/\.(ts|tsx|mjs|js|json|css)$/.test(r)) continue;
      if (r === "lib/data/media-manifest.json") continue; // its `source` field is the record of origin
      if (/^app\/.*route\.ts$/.test(r) && fs.readFileSync(file, "utf8").includes('const HTML = "')) {
        framer.push(r); // a Framer file, not converted yet
        continue;
      }
      scanned.push({ file, r });
    }
  }
  return { scanned, framer };
}

/** Third-party hosts and URL-in-fixture violations, `file:line`, for one tree. */
function scanSources(root) {
  const found = [];
  for (const { file, r } of sourceFiles(root).scanned) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const host of THIRD_PARTY) if (line.includes(host)) found.push(`${r}:${i + 1} names ${host}`);
      if (r.startsWith("lib/data/fixtures/") && line.includes("/assets/img/")) found.push(`${r}:${i + 1} holds /assets/img/ (fixtures hold keys, not paths)`);
    });
  }
  return found;
}

/** The placeholder host anywhere outside lib/data/media.ts and tests/. */
function scanPlaceholder(root) {
  const found = [];
  for (const top of ["app", "components", "lib", "scripts"]) {
    for (const file of walk(path.join(root, top))) {
      const r = rel(path.relative(root, file));
      if (r === "lib/data/media.ts") continue;
      if (!/\.(ts|tsx|mjs|js|json|css)$/.test(r)) continue;
      const text = fs.readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (line.includes(PLACEHOLDER)) found.push(`${r}:${i + 1} names the placeholder host`);
      });
    }
  }
  return found;
}

/** Problems with the text of a lib/data/media.ts. */
function checkConstants(text) {
  const urls = [...text.matchAll(/^export const MEDIA_BASE_URL = "([^"]*)";/gm)];
  const flags = [...text.matchAll(/^export const MEDIA_BASE_URL_IS_PLACEHOLDER = (true|false);/gm)];
  if (urls.length !== 1) return [`MEDIA_BASE_URL is declared ${urls.length} times, expected once`];
  if (flags.length !== 1) return [`MEDIA_BASE_URL_IS_PLACEHOLDER is declared ${flags.length} times, expected once`];
  const url = urls[0][1];
  if (flags[0][1] === "true") return url === `https://${PLACEHOLDER}` ? [] : [`flag is true but the URL is ${url}, not the placeholder`];
  let u;
  try {
    u = new URL(url);
  } catch {
    return [`flag is false but ${url} is not a URL`];
  }
  const problems = [];
  if (u.protocol !== "https:") problems.push(`${url} is not https`);
  if (u.origin !== url) problems.push(`${url} is not a bare origin (no path, no trailing slash)`);
  if (u.hostname.endsWith(".invalid")) problems.push(`${url} is under the reserved .invalid TLD`);
  return problems;
}

function scratchTree(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `almar-guard-${label}-`));
  fs.mkdirSync(path.join(root, "lib", "data", "fixtures"), { recursive: true });
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, "lib", "data", "fixtures", "stays.json"), path.join(root, "lib", "data", "fixtures", "stays.json"));
  return root;
}

function setMedia(root, { base, placeholder }) {
  fs.writeFileSync(
    path.join(root, "lib", "data", "media.ts"),
    `export const MEDIA_BASE_URL = "${base}";\nexport const MEDIA_BASE_URL_IS_PLACEHOLDER = ${placeholder};\n`,
  );
}

const GOOD_BASE = "https://media.example.test";

function writeDocs(root, base, { out = "out", mutate } = {}) {
  const slugs = readStaySlugs(path.join(root, "lib", "data", "fixtures"));
  for (const doc of slice1Documents(slugs)) {
    const file = path.join(root, out, ...doc.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let html = `<!doctype html><html><head><meta content="${base}/home/hero/poster.webp" property="og:image"/></head><body>` +
      `<img data-src="https://elsewhere.test/not-a-src.png" alt="" src="${base}/stays/a/hero.webp" srcset="${base}/stays/a/hero.webp 1x, ${base}/stays/a/gallery-1.webp 2x"></body></html>`;
    if (mutate) html = mutate(doc, html) ?? html;
    fs.writeFileSync(file, html);
  }
}

// 1. Source scan ----------------------------------------------------------------------------------------------------

test("no non-Framer file under app/, components/, lib/copy/ or lib/data/ names framerusercontent, catbox or pexels", () => {
  const { scanned, framer } = sourceFiles(REPO_ROOT);
  assert.ok(scanned.length > 100, `the scan read only ${scanned.length} files; it must not pass by reading nothing`);
  assert.ok(scanned.some((f) => f.r === "lib/data/fixtures/stays.json") && scanned.some((f) => f.r.startsWith("components/")));
  assert.ok(framer.length >= 1, "the Framer route files are skipped, not scanned");
  assert.deepEqual(scanSources(REPO_ROOT), []);
});

test("the placeholder host appears nowhere in app/, components/, lib/ or scripts/ except lib/data/media.ts", () => {
  assert.deepEqual(scanPlaceholder(REPO_ROOT), []);
});

test("fixtures hold keys: collectFixtureImages finds the images and throws on no URL", () => {
  assert.ok(collectFixtureImages().length >= 117);
});

test("RED: a page file with a Framer URL, a catbox URL or a pexels URL is caught with file and line", () => {
  for (const host of THIRD_PARTY) {
    const root = scratchTree("src");
    fs.writeFileSync(path.join(root, "app", "page.tsx"), `export default function P() {\n  return <img src="https://${host}/x.jpg" alt="" />;\n}\n`);
    assert.deepEqual(scanSources(root), [`app/page.tsx:2 names ${host}`]);
  }
});

test("a Framer route file (const HTML = \") is the one exception, and only under app/**/route.ts", () => {
  const root = scratchTree("framer");
  fs.mkdirSync(path.join(root, "app", "contact"), { recursive: true });
  fs.writeFileSync(path.join(root, "app", "contact", "route.ts"), 'const HTML = "<img src=\\"https://framerusercontent.com/images/a.png\\">";\n');
  assert.deepEqual(scanSources(root), []);
  fs.writeFileSync(path.join(root, "app", "contact", "page.tsx"), 'const HTML = "https://framerusercontent.com/images/a.png";\n');
  assert.equal(scanSources(root).length, 1);
});

test("RED: a fixture holding /assets/img/ is caught, and collectFixtureImages throws on it", () => {
  const root = scratchTree("fixture");
  const file = path.join(root, "lib", "data", "fixtures", "catalog.json");
  fs.writeFileSync(file, JSON.stringify([{ id: "c", image: { id: "i", media_key: "catalog/x.webp", width: 1, height: 1, position: 0 }, legacy: "/assets/img/x.webp" }], null, 2) + "\n");
  assert.deepEqual(scanSources(root), ["lib/data/fixtures/catalog.json:11 holds /assets/img/ (fixtures hold keys, not paths)"]);
  assert.throws(() => collectFixtureImages(path.join(root, "lib", "data", "fixtures")), /not URLs/);
});

test("RED: the placeholder host in a component is caught; in lib/data/media.ts it is the one allowed place", () => {
  const root = scratchTree("placeholder");
  fs.mkdirSync(path.join(root, "components"), { recursive: true });
  fs.writeFileSync(path.join(root, "components", "x.tsx"), `export const U = "https://${PLACEHOLDER}/a.webp";\n`);
  setMedia(root, { base: `https://${PLACEHOLDER}`, placeholder: true });
  assert.deepEqual(scanPlaceholder(root), ["components/x.tsx:1 names the placeholder host"]);
});

// 2. Constants ------------------------------------------------------------------------------------------------------

test("lib/data/media.ts declares both constants once, and they are coherent", () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, "lib", "data", "media.ts"), "utf8");
  assert.deepEqual(checkConstants(text), []);
});

test("the pattern reader and the real module agree on the constants of this tree", () => {
  const real = readMediaConstants(REPO_ROOT);
  const root = scratchTree("agree");
  fs.copyFileSync(path.join(REPO_ROOT, "lib", "data", "media.ts"), path.join(root, "lib", "data", "media.ts"));
  assert.deepEqual(readMediaConstants(root), real);
  assert.equal(typeof real.base, "string");
  assert.equal(typeof real.placeholder, "boolean");
});

test("RED: a media.ts with the flag false and an .invalid URL, a path, a trailing slash or http is incoherent", () => {
  const mk = (url, flag) => `export const MEDIA_BASE_URL = "${url}";\nexport const MEDIA_BASE_URL_IS_PLACEHOLDER = ${flag};\n`;
  assert.deepEqual(checkConstants(mk(`https://${PLACEHOLDER}`, true)), []);
  assert.deepEqual(checkConstants(mk(GOOD_BASE, false)), []);
  assert.match(checkConstants(mk(`https://${PLACEHOLDER}`, false)).join(), /\.invalid/);
  assert.match(checkConstants(mk(`${GOOD_BASE}/`, false)).join(), /bare origin/);
  assert.match(checkConstants(mk(`${GOOD_BASE}/media`, false)).join(), /bare origin/);
  assert.match(checkConstants(mk("http://media.example.test", false)).join(), /not https/);
  assert.match(checkConstants(mk(GOOD_BASE, true)).join(), /not the placeholder/);
  assert.match(checkConstants(mk(GOOD_BASE, false) + mk(GOOD_BASE, false)).join(), /declared 2 times/);
  assert.match(checkConstants("").join(), /declared 0 times/);
});

// 3. The built documents (opt in) -----------------------------------------------------------------------------------

const checkOut = process.env.MEDIA_CHECK_OUT === "1";

test(checkOut ? "out/: the 42 slice-1 documents point at the media base and nowhere else" : "out/: the 42 slice-1 documents point at the media base and nowhere else (SKIPPED: set MEDIA_CHECK_OUT=1)", { skip: !checkOut && "set MEDIA_CHECK_OUT=1 after the assembler has written out/" }, () => {
  const outDir = path.join(REPO_ROOT, "out");
  assert.ok(fs.existsSync(outDir), "out/ is missing: run the assembler first (with MEDIA_CHECK_OUT=1 a missing out/ is a failure)");
  const { base } = readMediaConstants(REPO_ROOT);
  const r = scanOut(outDir, base);
  assert.deepEqual(r.violations, []);
  assert.equal(r.documents, 42);
  assert.ok(r.images > 0);
});

// 4. assertMediaReady, scanOut and the CLI --------------------------------------------------------------------------

test("assertMediaReady on this tree: throws the step-C9 message while the flag is true, returns the base once it is false", () => {
  const { base, placeholder } = readMediaConstants(REPO_ROOT);
  if (placeholder) {
    assert.throws(() => assertMediaReady(), (e) => e.message === "media host is a placeholder (MEDIA_BASE_URL_IS_PLACEHOLDER = true): R2 runbook step C9 has not landed");
  } else {
    assert.equal(assertMediaReady(), base);
  }
});

test("assertMediaReady on scratch roots: placeholder, bad base, good base", () => {
  const root = scratchTree("ready");
  setMedia(root, { base: `https://${PLACEHOLDER}`, placeholder: true });
  assert.throws(() => assertMediaReady({ root }), /media host is a placeholder .*step C9 has not landed/);
  setMedia(root, { base: `https://${PLACEHOLDER}`, placeholder: false });
  assert.throws(() => assertMediaReady({ root }), /not an https origin that can resolve/);
  for (const base of ["http://media.example.test", `${GOOD_BASE}/`, `${GOOD_BASE}/img`, "media.example.test", ""]) {
    setMedia(root, { base, placeholder: false });
    assert.throws(() => assertMediaReady({ root }), /media host/, base);
  }
  setMedia(root, { base: GOOD_BASE, placeholder: false });
  assert.equal(assertMediaReady({ root }), GOOD_BASE);
  fs.writeFileSync(path.join(root, "lib", "data", "media.ts"), "export const MEDIA_BASE_URL = 'x';\n");
  assert.throws(() => assertMediaReady({ root }), /exactly once each/);
});

test("scanOut: 42 clean documents have no violations and 4 image references each", () => {
  const root = scratchTree("scan-ok");
  writeDocs(root, GOOD_BASE);
  const r = scanOut(path.join(root, "out"), GOOD_BASE, { documents: slice1Documents(readStaySlugs(path.join(root, "lib", "data", "fixtures"))) });
  assert.deepEqual(r.violations, []);
  assert.equal(r.documents, 42);
  assert.equal(r.images, 42 * 4, "one img src, two srcset candidates, one og:image per document; data-src is not an image src");
});

test("imageReferences reads attributes in any order, with single or double quotes", () => {
  const refs = imageReferences(`<IMG alt='' SRC='https://h.test/a.webp' srcset='https://h.test/a.webp 1x,https://h.test/b.webp 2x'><meta content='https://h.test/o.webp' property='og:image'><meta property="og:title" content="x"><source srcset="https://h.test/s.webp"><img data-src="x">`);
  assert.deepEqual(refs.map((r) => `${r.kind}=${r.url}`), [
    "img src=https://h.test/a.webp",
    "img without src=",
    "srcset=https://h.test/a.webp",
    "srcset=https://h.test/b.webp",
    "srcset=https://h.test/s.webp",
    "og:image=https://h.test/o.webp",
  ]);
});

test("RED: a document with a framerusercontent src, a placeholder host, a foreign srcset candidate, a foreign og:image or no file is reported", () => {
  const root = scratchTree("scan-red");
  const docs = slice1Documents(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  writeDocs(root, GOOD_BASE, {
    mutate: (doc, html) => {
      if (doc === "index.html") return html.replace(`src="${GOOD_BASE}/stays/a/hero.webp"`, 'src="https://framerusercontent.com/images/x.jpg"');
      if (doc === "ar/index.html") return html.replace(GOOD_BASE, `https://${PLACEHOLDER}`);
      if (doc === "es/index.html") return html.replace(`${GOOD_BASE}/stays/a/gallery-1.webp 2x`, "https://cdn.example.test/g.webp 2x");
      if (doc === "private-stays.html") return html.replace(`content="${GOOD_BASE}/home/hero/poster.webp"`, 'content="https://files.catbox.moe/p.webp"');
      return html;
    },
  });
  fs.rmSync(path.join(root, "out", "es", "private-stays.html"));
  const { violations } = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs });
  const text = violations.map((v) => `${v.document}: ${v.problem}`).join("\n");
  assert.match(text, /^index\.html: contains framerusercontent\.com$/m);
  assert.match(text, /^index\.html: img src "https:\/\/framerusercontent\.com\/images\/x\.jpg" does not start with/m);
  assert.match(text, new RegExp(`^ar/index\\.html: contains the placeholder host ${PLACEHOLDER.replace(".", "\\.")}$`, "m"));
  assert.match(text, /^es\/index\.html: srcset "https:\/\/cdn\.example\.test\/g\.webp" does not start with/m);
  assert.match(text, /^private-stays\.html: contains files\.catbox\.moe$/m);
  assert.match(text, /^private-stays\.html: og:image "https:\/\/files\.catbox\.moe\/p\.webp" does not start with/m);
  assert.match(text, /^es\/private-stays\.html: document is missing$/m);
});

test("main --deploy: exit 0 and the OK line for a good scratch root; exit 1 for a bad document, a missing out/, a placeholder", () => {
  const root = scratchTree("cli");
  setMedia(root, { base: GOOD_BASE, placeholder: false });
  const logs = [];
  const log = (l) => logs.push(l);
  writeDocs(root, GOOD_BASE);
  assert.equal(guardMain(["--deploy", "--root", root], { log }), 0, logs.join("\n"));
  assert.equal(logs.at(-1), `media-guard: OK ${GOOD_BASE}, 42 documents, 168 image references`);
  // another output folder (the preview build writes out-preview/)
  writeDocs(root, GOOD_BASE, { out: "out-preview" });
  logs.length = 0;
  assert.equal(guardMain(["--deploy", "--root", root, "--out", "out-preview"], { log }), 0);
  // a bad document
  fs.appendFileSync(path.join(root, "out", "index.html"), '<img src="https://framerusercontent.com/images/y.png">');
  logs.length = 0;
  assert.equal(guardMain(["--deploy", "--root", root], { log }), 1);
  assert.ok(logs.some((l) => l.startsWith("media-guard: index.html: ")));
  // no out/
  fs.rmSync(path.join(root, "out"), { recursive: true });
  logs.length = 0;
  assert.equal(guardMain(["--deploy", "--root", root], { log }), 1);
  assert.match(logs.join("\n"), /out\/ is absent/);
  // placeholder
  setMedia(root, { base: `https://${PLACEHOLDER}`, placeholder: true });
  logs.length = 0;
  assert.equal(guardMain(["--deploy", "--root", root], { log }), 1);
  assert.match(logs.join("\n"), /step C9 has not landed/);
  // no --deploy
  assert.equal(guardMain([], { log: () => {} }), 2);
  assert.equal(guardMain(["--nope"], { log: () => {} }), 2);
});

test("`node scripts/media-guard.mjs --deploy` exits 1 and names runbook step C9 while the flag is true", () => {
  const { placeholder } = readMediaConstants(REPO_ROOT);
  const r = spawnSync(process.execPath, ["scripts/media-guard.mjs", "--deploy"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (placeholder) {
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /step C9 has not landed/);
  } else {
    assert.ok(r.status === 0 || r.status === 1, "after the flip it depends on out/");
  }
});
