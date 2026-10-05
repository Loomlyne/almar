// Guards for the image host (plan 03.3-07, task 4; design 10.1, threat T-3.3-07-04 and -07).
//   1. Source scan (always runs): no non-Framer file under app/, components/, lib/copy/ or lib/data/ names
//      framerusercontent.com, files.catbox.moe or videos.pexels.com; fixtures hold keys, never URLs; the placeholder
//      host lives in lib/data/media.ts only.
//   2. Constants: lib/data/media.ts is coherent (placeholder iff flag true; otherwise an https origin).
//   3. out/ scan (only with MEDIA_CHECK_OUT=1): coverage (every document names real manifest keys, and the pages that
//      must carry their images do) in both media states, and the host scan once the flag is false.
//   4. assertMediaReady() and the `--deploy` CLI the controller runs before every deploy.
// Document counts are computed from PUBLIC_PAGES and stays.json, never written as a number (plan 03.3-16).
// The red cases run on scratch copies in os.tmpdir(); the scan functions below are this file's own, so the guard
// cannot go silent because the script it also tests changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PUBLIC_PAGES } from "../lib/locale-path.ts";
import { REPO_ROOT, collectFixtureImages, readManifest, readStaySlugs, publicDocuments } from "../scripts/media-lib.mjs";
import { assertMediaReady, imageReferences, main as guardMain, readMediaConstants, referencedKeys, scanOut } from "../scripts/media-guard.mjs";

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

const SCRATCH_KEYS = ["home/hero/poster.webp", "stays/a/hero.webp", "stays/a/gallery-1.webp"];

function scratchTree(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `almar-guard-${label}-`));
  fs.mkdirSync(path.join(root, "lib", "data", "fixtures"), { recursive: true });
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, "lib", "data", "fixtures", "stays.json"), path.join(root, "lib", "data", "fixtures", "stays.json"));
  // the manifest holds the keys writeDocs uses, so the clean scan has nothing to report
  fs.writeFileSync(path.join(root, "lib", "data", "media-manifest.json"), JSON.stringify(SCRATCH_KEYS.map((key) => ({ key })), null, 2) + "\n");
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
  for (const doc of publicDocuments(slugs)) {
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

test("fixtures hold keys: the distinct media_key count of collectFixtureImages equals the manifest's entry count", () => {
  const distinct = new Set(collectFixtureImages().map((i) => i.media_key));
  assert.ok(distinct.size > 0);
  assert.equal(distinct.size, readManifest().length);
});

test("publicDocuments is computed from PUBLIC_PAGES: 3 locales x (static pages + published stays), the new pages named, no services", () => {
  const stays = readStaySlugs().length;
  const perLocale = PUBLIC_PAGES.reduce((n, p) => n + (p === "/private-stays/[stay]" ? stays : 1), 0);
  const docs = publicDocuments();
  assert.equal(docs.length, 3 * perLocale);
  assert.equal(new Set(docs).size, docs.length);
  for (const d of ["destinations.html", "ar/destinations.html", "es/destinations.html", "experiences.html", "ar/experiences.html", "es/experiences.html"]) {
    assert.ok(docs.includes(d), `${d} is in the list`);
  }
  assert.ok(!docs.some((d) => d.includes("services")), "services have no page of their own");
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
const outSkip = !checkOut && "set MEDIA_CHECK_OUT=1 after the assembler has written out/";
const outTitle = (t) => (checkOut ? t : `${t} (SKIPPED: set MEDIA_CHECK_OUT=1)`);
const outDir = path.join(REPO_ROOT, "out");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "lib", "data", "fixtures", name), "utf8"));
const outHtml = (doc) => fs.readFileSync(path.join(outDir, ...doc.split("/")), "utf8");

test(outTitle("out/ coverage: every document is found and names only manifest keys (both media states)"), { skip: outSkip }, () => {
  assert.ok(fs.existsSync(outDir), "out/ is missing: run the assembler first (with MEDIA_CHECK_OUT=1 a missing out/ is a failure)");
  const { base, placeholder } = readMediaConstants(REPO_ROOT);
  const manifestKeys = new Set(readManifest().map((e) => e.key));
  const docs = publicDocuments();
  const r = scanOut(outDir, base, { documents: docs, manifestKeys, placeholderBase: placeholder });
  assert.deepEqual(r.violations, []);
  assert.equal(r.documents, docs.length);
  assert.ok(r.images > 0);
  const union = new Set();
  for (const d of docs) for (const k of referencedKeys(outHtml(d), base)) union.add(k);
  const unreferenced = [...manifestKeys].filter((k) => !union.has(k)).sort();
  console.log(`# media coverage: ${docs.length} documents, ${r.images} image references, ${union.size} distinct keys referenced, ${unreferenced.length} manifest keys referenced by no document`);
  console.log(`# unreferenced manifest keys: ${unreferenced.join(", ") || "none"}`);
});

test(outTitle("out/ coverage: /destinations carries the 5 published card heroes and the 3 page heroes, the heroes as <img> in the static HTML"), { skip: outSkip }, () => {
  const { base } = readMediaConstants(REPO_ROOT);
  const cards = fixture("destinations.json").filter((d) => d.is_published).map((d) => d.hero_image.media_key);
  const heroes = fixture("destinations-page.json").hero.map((h) => h.media_key);
  assert.equal(cards.length, 5);
  assert.deepEqual(heroes, ["home/gallery/03.webp", "destinations/page/hero-2.webp", "destinations/page/hero-3.webp"]);
  for (const doc of ["destinations.html", "ar/destinations.html", "es/destinations.html"]) {
    const html = outHtml(doc);
    const keys = referencedKeys(html, base);
    for (const k of [...cards, ...heroes]) assert.ok(keys.has(k), `${doc} does not reference ${k}`);
    const imgs = new Set(imageReferences(html).filter((r) => r.kind === "img src").map((r) => r.url));
    for (const k of heroes) assert.ok(imgs.has(`${base}/${k}`), `${doc}: ${k} is not an <img src> in the static HTML`);
  }
});

test(outTitle("out/ coverage: /experiences carries every published catalogue image"), { skip: outSkip }, () => {
  const { base } = readMediaConstants(REPO_ROOT);
  const rows = fixture("catalog.json").filter((c) => c.is_published);
  const keys = rows.map((c) => c.image.media_key);
  assert.ok(keys.length > 0 && new Set(keys).size === keys.length, "one distinct image per published catalogue row");
  for (const doc of ["experiences.html", "ar/experiences.html", "es/experiences.html"]) {
    const got = referencedKeys(outHtml(doc), base);
    assert.deepEqual(keys.filter((k) => !got.has(k)), [], `${doc} lacks catalogue image keys`);
  }
  console.log(`# /experiences carries ${keys.length} catalogue image keys in each of 3 languages`);
});

const flag = readMediaConstants(REPO_ROOT).placeholder;
test(
  outTitle(flag ? "out/ host: the full scan with the manifest and no placeholderBase (SKIPPED: host checks wait for the flip, runbook C9)" : "out/ host: the full scan has no violation"),
  { skip: outSkip || (flag && "host checks wait for the flip, runbook C9") },
  () => {
    const { base } = readMediaConstants(REPO_ROOT);
    const manifestKeys = new Set(readManifest().map((e) => e.key));
    const docs = publicDocuments();
    const r = scanOut(outDir, base, { documents: docs, manifestKeys });
    assert.deepEqual(r.violations, []);
    assert.equal(r.documents, docs.length);
  },
);

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

test("scanOut: clean documents have no violations and 4 image references each", () => {
  const root = scratchTree("scan-ok");
  writeDocs(root, GOOD_BASE);
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  const r = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs });
  assert.deepEqual(r.violations, []);
  assert.equal(r.documents, docs.length);
  assert.equal(r.images, docs.length * 4, "one img src, two srcset candidates, one og:image per document; data-src is not an image src");
});

test("scanOut allows the same-origin nav wordmarks under /_next/static/media/, and only that shape", () => {
  const root = scratchTree("scan-brand");
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  const BRAND = "/_next/static/media/Poly_White.3f2a9c1d.svg";
  const CHARCOAL = "/_next/static/media/Stacked_Charcoal.7b41e0aa.svg";
  // the nav wordmark is one <img src> on every document, as the build writes it
  writeDocs(root, GOOD_BASE, { mutate: (doc, html) => html.replace("<img ", `<img alt="ALMAR" src="${doc === "index.html" ? CHARCOAL : BRAND}"><img `) });
  const ok = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs });
  assert.deepEqual(ok.violations, []);
  assert.equal(ok.images, docs.length * 5, "the wordmark is counted and checked, not skipped");

  // every other same-origin or foreign shape keeps failing
  const bad = {
    "index.html": "/assets/img/hero.webp",
    "ar/index.html": "/_next/static/media/../../secret.svg",
    "es/index.html": "//cdn.example.test/_next/static/media/x.svg",
    "private-stays.html": "/_next/static/media/deeper/x.svg",
    "ar/private-stays.html": "/_next/static/media/x.svg?v=1",
    "es/private-stays.html": "/_next/static/media/..",
    "private-stays/casa-jardin-san-diego.html": "https://cdn.example.test/_next/static/media/x.svg",
    "ar/private-stays/casa-jardin-san-diego.html": "_next/static/media/x.svg",
  };
  writeDocs(root, GOOD_BASE, { mutate: (doc, html) => (bad[doc] ? html.replace("<img ", `<img alt="" src="${bad[doc]}"><img `) : html) });
  const text = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs }).violations.map((v) => `${v.document}: ${v.problem}`).join("\n");
  for (const [doc, url] of Object.entries(bad)) {
    assert.ok(text.includes(`${doc}: img src ${JSON.stringify(url)} does not start with`), `${doc} ${url} must still be reported:\n${text}`);
  }

  // an og:image or a srcset candidate: og:image must be on the media host; a srcset candidate may be the wordmark
  writeDocs(root, GOOD_BASE, {
    mutate: (doc, html) =>
      doc === "index.html"
        ? html.replace(`content="${GOOD_BASE}/home/hero/poster.webp"`, `content="${BRAND}"`).replace("srcset=", `srcset="${BRAND} 1x" data-x=`)
        : html,
  });
  const og = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs }).violations.map((v) => `${v.document}: ${v.problem}`);
  assert.deepEqual(og, [`index.html: og:image ${JSON.stringify(BRAND)} does not start with ${GOOD_BASE}/`]);
});

// The light footer's wordmark is not a file: components/ui/footer.tsx writes the brand SVG markup into the <img src> as
// `data:image/svg+xml;charset=utf-8,<encodeURIComponent(markup)>`. Inline markup is no network request, so it may pass
// the guard, but only while it names nothing outside itself.
const WORDMARK_SVG = fs.readFileSync(path.join(REPO_ROOT, "brand", "Logo Typography", "Poly_Black.svg"), "utf8");
const inlineSvgSrc = (markup) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
/** As React writes an attribute value into the document. */
const reactAttr = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

test("scanOut allows the inline brand SVG of the light footer on an <img src>, counts it, and nothing else of that form", () => {
  const root = scratchTree("scan-inline");
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  const reportOf = (src, { as = "img" } = {}) => {
    writeDocs(root, GOOD_BASE, {
      mutate: (doc, html) => {
        if (doc !== "index.html") return html;
        if (as === "og") return html.replace(`content="${GOOD_BASE}/home/hero/poster.webp"`, `content="${reactAttr(src)}"`);
        if (as === "srcset") return html.replace("srcset=", `srcset="${reactAttr(src)}" data-x=`);
        return html.replace("<img ", `<img alt="ALMAR" src="${reactAttr(src)}"><img `);
      },
    });
    const r = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs });
    return { ...r, text: r.violations.map((v) => `${v.document}: ${v.problem}`).join("\n") };
  };

  // the real wordmark, as the footer writes it, on every document
  writeDocs(root, GOOD_BASE, { mutate: (doc, html) => html.replace("<img ", `<img alt="ALMAR" src="${reactAttr(inlineSvgSrc(WORDMARK_SVG))}"><img `) });
  const ok = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs });
  assert.deepEqual(ok.violations, []);
  assert.equal(ok.images, docs.length * 5, "the inline wordmark is counted and checked, not skipped");

  // an inline SVG that pulls an image off the network is a violation, whatever host it names
  const catbox = reportOf(inlineSvgSrc('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://files.catbox.moe/x.png"/></svg>'));
  assert.match(catbox.text, /^index\.html: img src "data:image\/svg\+xml;charset=utf-8,.*" is an inline SVG that /m, catbox.text);
  assert.match(catbox.text, /^index\.html: contains files\.catbox\.moe$/m, "the host scan still sees it");
  assert.equal(catbox.violations.filter((v) => v.document !== "index.html").length, 0);

  // every other way out of the document is a violation, each with its own reason
  const bad = {
    "an xlink:href to a host": '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://cdn.example.test/s.svg#a"/></svg>',
    "an href to a relative file": '<svg xmlns="http://www.w3.org/2000/svg"><image href="/assets/img/hero.webp"/></svg>',
    "a protocol-relative href": '<svg xmlns="http://www.w3.org/2000/svg"><image href="//cdn.example.test/x.png"/></svg>',
    "an @import": '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "x.css";</style></svg>',
    "a url() off the document": '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(x.svg#p)"/></svg>',
    "a url() to a host": '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(\'https://cdn.example.test/p.svg#p\')"/></svg>',
    "an http URL in text": '<svg xmlns="http://www.w3.org/2000/svg"><text>http://cdn.example.test/x.png</text></svg>',
    "a numeric character reference": '<svg xmlns="http://www.w3.org/2000/svg"><image href="&#104;ttps://cdn.example.test/x.png"/></svg>',
    "an entity declaration": '<!DOCTYPE svg [<!ENTITY x SYSTEM "x.svg">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>',
    "a base64 payload": "data:image/svg+xml;base64,PHN2Zy8+",
    "a bad percent escape": "data:image/svg+xml;charset=utf-8,%E0%A4%A",
  };
  for (const [label, body] of Object.entries(bad)) {
    const src = body.startsWith("data:") ? body : inlineSvgSrc(body);
    const r = reportOf(src);
    assert.match(r.text, /^index\.html: img src "data:image\/svg\+xml.*" is an inline SVG that /m, `${label} must be reported:\n${r.text}`);
    assert.equal(r.violations.filter((v) => v.document !== "index.html").length, 0, label);
  }

  // the exception is for <img src> only, and only SVG
  const png = reportOf("data:image/png;base64,iVBORw0KGgo=");
  assert.match(png.text, /^index\.html: img src "data:image\/png;base64,iVBORw0KGgo=" does not start with /m, png.text);
  const og = reportOf(inlineSvgSrc(WORDMARK_SVG), { as: "og" });
  assert.match(og.text, /^index\.html: og:image "data:image\/svg\+xml;charset=utf-8,.*" does not start with /m, og.text);
  const set = reportOf(inlineSvgSrc(WORDMARK_SVG), { as: "srcset" });
  assert.match(set.text, /^index\.html: srcset "data:image\/svg\+xml;charset=utf-8" does not start with /m, set.text);
  assert.ok(!set.text.includes("img src"), "a srcset candidate of that form is its own violation, not an img src");
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
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
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
  const n = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures"))).length;
  assert.equal(guardMain(["--deploy", "--root", root], { log }), 0, logs.join("\n"));
  assert.equal(logs.at(-1), `media-guard: OK ${GOOD_BASE}, ${n} documents, ${n * 4} image references`);
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

test("referencedKeys drops query and fragment, ignores refs outside the base (the wordmarks too) and returns a Set", () => {
  const html =
    `<img src="${GOOD_BASE}/catalog/a.webp?v=2" srcset="${GOOD_BASE}/catalog/a.webp 1x, ${GOOD_BASE}/catalog/b.webp#x 2x">` +
    `<img src="/_next/static/media/Poly_White.3f2a9c1d.svg"><img src="https://other.test/catalog/z.webp">` +
    `<meta property="og:image" content="${GOOD_BASE}/home/hero/poster.webp">`;
  const keys = referencedKeys(html, GOOD_BASE);
  assert.ok(keys instanceof Set);
  assert.deepEqual([...keys].sort(), ["catalog/a.webp", "catalog/b.webp", "home/hero/poster.webp"]);
});

test("RED: a reference under the base to a key the manifest does not hold is `<kind> key <key> is not in lib/data/media-manifest.json`; the wordmark is not a key", () => {
  const root = scratchTree("scan-key");
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  const manifestKeys = new Set(SCRATCH_KEYS);
  writeDocs(root, GOOD_BASE, {
    mutate: (doc, html) =>
      doc === "index.html"
        ? html.replace("<img ", `<img alt="" src="/_next/static/media/Poly_White.3f2a9c1d.svg"><img alt="" src="${GOOD_BASE}/catalog/not-in-manifest.webp"><img `)
        : html,
  });
  const r = scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs, manifestKeys });
  assert.deepEqual(r.violations.map((v) => `${v.document}: ${v.problem}`), ["index.html: img src key catalog/not-in-manifest.webp is not in lib/data/media-manifest.json"]);
  // without manifestKeys the same tree is clean (the option is what turns the check on)
  assert.deepEqual(scanOut(path.join(root, "out"), GOOD_BASE, { documents: docs }).violations, []);
});

test("RED: the CLI exits 1 on a key the manifest does not hold, and exits 1 naming the manifest when the file is missing", () => {
  const root = scratchTree("cli-key");
  setMedia(root, { base: GOOD_BASE, placeholder: false });
  writeDocs(root, GOOD_BASE, { mutate: (doc, html) => (doc === "es/index.html" ? html.replace("</body>", `<img alt="" src="${GOOD_BASE}/catalog/not-in-manifest.webp"></body>`) : html) });
  const logs = [];
  assert.equal(guardMain(["--deploy", "--root", root], { log: (l) => logs.push(l) }), 1);
  assert.ok(logs.includes("media-guard: es/index.html: img src key catalog/not-in-manifest.webp is not in lib/data/media-manifest.json"), logs.join("\n"));
  fs.rmSync(path.join(root, "lib", "data", "media-manifest.json"));
  logs.length = 0;
  assert.equal(guardMain(["--deploy", "--root", root], { log: (l) => logs.push(l) }), 1);
  assert.match(logs.join("\n"), /media-manifest\.json/);
});

test("RED: placeholderBase ignores exactly the base's own host; any other .invalid host is still a violation; with the flag off the base's own host is one", () => {
  const PBASE = `https://${PLACEHOLDER}`;
  const root = scratchTree("scan-pb");
  const docs = publicDocuments(readStaySlugs(path.join(root, "lib", "data", "fixtures")));
  writeDocs(root, PBASE);
  const manifestKeys = new Set(SCRATCH_KEYS);
  const on = scanOut(path.join(root, "out"), PBASE, { documents: docs, manifestKeys, placeholderBase: true });
  assert.deepEqual(on.violations, []);
  assert.equal(on.images, docs.length * 4);
  const off = scanOut(path.join(root, "out"), PBASE, { documents: docs, manifestKeys, placeholderBase: false });
  assert.equal(off.violations.length, docs.length, "every document names the placeholder host when the flag is off");
  assert.ok(off.violations.every((v) => v.problem === `contains the placeholder host ${PLACEHOLDER}`));
  writeDocs(root, PBASE, { mutate: (doc, html) => (doc === "index.html" ? html.replace("</body>", '<img alt="" src="https://other.invalid/x.webp"></body>') : html) });
  const other = scanOut(path.join(root, "out"), PBASE, { documents: docs, manifestKeys, placeholderBase: true }).violations.map((v) => `${v.document}: ${v.problem}`);
  assert.ok(other.includes("index.html: contains the placeholder host other.invalid"), other.join("\n"));
  assert.ok(other.includes('index.html: img src "https://other.invalid/x.webp" does not start with https://media-pending.invalid/'), other.join("\n"));
  assert.equal(other.filter((l) => !l.startsWith("index.html: ")).length, 0);
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
