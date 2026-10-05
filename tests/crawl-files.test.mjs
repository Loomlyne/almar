import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LOCALES,
  SITE_ORIGIN,
  TARGETS,
  assertPublicClean,
  assertTargetFiles,
  buildSitemap,
  htmlFileToPath,
  isSitemapExcluded,
  outDirNameFor,
  parseTarget,
  writeTargetFiles,
} from "../scripts/crawl-files.mjs";
import { LOCALES as LOCALE_PATH_LOCALES, localePath } from "../lib/locale-path.ts";
import { SLICE1_PAGES, publicDocuments, readStaySlugs } from "../scripts/media-lib.mjs";

// Plan 03.3-08, Task 2. The noindex trap: a preview-only noindex header or disallow-all robots.txt must never
// reach the production folder. Everything here runs on temp directories; nothing builds and nothing deploys.
// Tests run from the repo root (as every test in this repo does).

const NOINDEX_OR_ROBOTS_HEADER = /noindex|x-robots-tag/i;
const BARE_DISALLOW = /^Disallow:\s*\/\s*$/m;
const SITEMAP_LINE = `Sitemap: ${SITE_ORIGIN}/sitemap.xml`;

/** A fake repo root: the real _headers and deploy/ files, an empty public/, and room for the out folders. */
function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), "almar-crawl-"));
  cpSync("_headers", join(root, "_headers"));
  cpSync("deploy", join(root, "deploy"), { recursive: true });
  mkdirSync(join(root, "public"));
  return root;
}

function outFolder(root, target) {
  const dir = join(root, outDirNameFor(target));
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The slice-1 documents (42) plus 12 English-only Framer documents. */
const SLUGS = readStaySlugs();
const SLICE1 = publicDocuments(SLUGS, SLICE1_PAGES);
const EN_ONLY = [
  "about.html",
  "blog.html",
  "blog/a-story.html",
  "blog/another-story.html",
  "contact.html",
  "destinations.html",
  "experiences.html",
  "services/concierge.html",
  "services/ground-transport.html",
  "services/airport.html",
  "services.html",
  "team.html",
];
const EXCLUDED = ["404.html", "ar/404.html", "es/404.html", "_not-found.html", "dashboard.html", "__harness.html", "ar/login.html", "account/x.html"];
const ALL_FILES = [...EXCLUDED, ...SLICE1, ...EN_ONLY];

function written(target, htmlFiles = ALL_FILES) {
  const root = fakeRoot();
  const outDir = outFolder(root, target);
  writeTargetFiles({ outDir, target, root, htmlFiles });
  return { root, outDir, read: (name) => readFileSync(join(outDir, name), "utf8"), has: (name) => existsSync(join(outDir, name)) };
}

// ---- the targets ------------------------------------------------------------------------------------------------

test("TARGETS are local, preview and production; the default is local", () => {
  assert.deepEqual([...TARGETS], ["local", "preview", "production"]);
  assert.equal(parseTarget([]), "local");
  assert.equal(parseTarget(["--target=preview"]), "preview");
  assert.equal(parseTarget(["--target=production"]), "production");
});

test("an unknown or malformed target throws (a typo cannot build the wrong variant)", () => {
  for (const bad of ["--target=previw", "--target=", "--target=Preview", "--target=prod", "--target", "preview", "--targets=preview"]) {
    assert.throws(() => parseTarget([bad]), /target|argument/i, bad);
  }
  assert.throws(() => parseTarget(["--target=preview", "--target=production"]), /more than once/i);
});

test("an unknown target throws in writeTargetFiles and assertTargetFiles", () => {
  const root = fakeRoot();
  const outDir = join(root, "out");
  mkdirSync(outDir);
  assert.throws(() => writeTargetFiles({ outDir, target: "previw", root, htmlFiles: [] }), /previw/);
  assert.throws(() => assertTargetFiles(outDir, "previw", { root }), /previw/);
});

test("preview builds into out-preview/, every other target into out/", () => {
  assert.equal(outDirNameFor("preview"), "out-preview");
  assert.equal(outDirNameFor("production"), "out");
  assert.equal(outDirNameFor("local"), "out");
  assert.throws(() => outDirNameFor("previw"), /previw/);
});

test("a preview folder named out, or a production folder named out-preview, is refused", () => {
  const root = fakeRoot();
  const out = join(root, "out");
  const preview = join(root, "out-preview");
  mkdirSync(out);
  mkdirSync(preview);
  assert.throws(() => writeTargetFiles({ outDir: out, target: "preview", root, htmlFiles: [] }), /out-preview/);
  assert.throws(() => writeTargetFiles({ outDir: preview, target: "production", root, htmlFiles: [] }), /out/);
  assert.throws(() => writeTargetFiles({ outDir: preview, target: "local", root, htmlFiles: [] }), /out/);
  assert.throws(() => assertTargetFiles(out, "preview", { root }), /out-preview/);
});

// ---- production and local ---------------------------------------------------------------------------------------

for (const target of ["production", "local"]) {
  test(`${target} target: _headers is the root file byte for byte, with no noindex and no X-Robots-Tag`, () => {
    const { root, read } = written(target);
    assert.equal(read("_headers"), readFileSync(join(root, "_headers"), "utf8"));
    assert.doesNotMatch(read("_headers"), NOINDEX_OR_ROBOTS_HEADER);
  });

  test(`${target} target: robots.txt allows, names the sitemap, and has no bare Disallow: /`, () => {
    const { read } = written(target);
    const robots = read("robots.txt");
    assert.match(robots, /^User-agent: \*$/m);
    assert.match(robots, /^Allow: \/$/m);
    assert.ok(robots.split("\n").includes(SITEMAP_LINE), "the Sitemap line");
    assert.doesNotMatch(robots, BARE_DISALLOW);
  });

  test(`${target} target: sitemap.xml is written and assertTargetFiles accepts the folder`, () => {
    const { root, outDir, has } = written(target);
    assert.equal(has("sitemap.xml"), true);
    assertTargetFiles(outDir, target, { root });
  });
}

test("production robots.txt equals deploy/production/robots.txt", () => {
  const { root, read } = written("production");
  assert.equal(read("robots.txt"), readFileSync(join(root, "deploy/production/robots.txt"), "utf8"));
});

// ---- preview ----------------------------------------------------------------------------------------------------

test("preview target: _headers starts with the root bytes and ends with the one noindex block", () => {
  const { root, read } = written("preview");
  const rootBytes = readFileSync(join(root, "_headers"), "utf8");
  const block = readFileSync(join(root, "deploy/preview/_headers"), "utf8");
  const headers = read("_headers");
  assert.ok(headers.startsWith(rootBytes), "starts with the root _headers");
  assert.ok(headers.endsWith(block), "ends with the preview block");
  assert.equal(headers.split("X-Robots-Tag: noindex, nofollow").length - 1, 1, "exactly one X-Robots-Tag");
  assert.equal(block, "/*\n  X-Robots-Tag: noindex, nofollow\n");
});

test("preview target: robots.txt is the disallow-all file and no sitemap.xml is written", () => {
  const { root, outDir, read, has } = written("preview");
  assert.equal(read("robots.txt"), readFileSync(join(root, "deploy/preview/robots.txt"), "utf8"));
  assert.equal(read("robots.txt"), "User-agent: *\nDisallow: /\n");
  assert.equal(has("sitemap.xml"), false);
  assertTargetFiles(outDir, "preview", { root });
});

// ---- the trap: each injected violation is refused, one named test each -------------------------------------------

function refuses(target, mutate, pattern) {
  const { root, outDir } = written(target);
  mutate(outDir, root);
  assert.throws(() => assertTargetFiles(outDir, target, { root }), pattern);
}

test("trap 1: a production _headers with noindex appended is refused, naming _headers", () => {
  refuses("production", (out) => writeFileSync(join(out, "_headers"), readFileSync(join(out, "_headers"), "utf8") + "/*\n  X-Robots-Tag: noindex\n"), /_headers.*noindex or X-Robots-Tag/);
});

test("trap 2: a production _headers with an X-Robots-Tag in any case is refused", () => {
  refuses("production", (out) => writeFileSync(join(out, "_headers"), readFileSync(join(out, "_headers"), "utf8") + "/*\n  x-robots-tag: all\n"), /_headers.*noindex or X-Robots-Tag/);
});

test("trap 3: a production robots.txt with Disallow: / is refused, naming robots.txt", () => {
  refuses("production", (out) => writeFileSync(join(out, "robots.txt"), "User-agent: *\nDisallow: /\n\n" + SITEMAP_LINE + "\n"), /robots\.txt.*bare Disallow: \//);
});

test("trap 3b: a production robots.txt without its Sitemap line is refused", () => {
  refuses("production", (out) => writeFileSync(join(out, "robots.txt"), "User-agent: *\nAllow: /\n"), /robots\.txt.*no Sitemap line/);
});

test("trap 3c: a production folder without sitemap.xml is refused", () => {
  refuses("production", (out) => rmSync(join(out, "sitemap.xml")), /sitemap\.xml: is missing/);
});

test("trap 4: a preview folder without the noindex block is refused, naming _headers", () => {
  refuses("preview", (out, root) => writeFileSync(join(out, "_headers"), readFileSync(join(root, "_headers"), "utf8")), /_headers/);
});

test("trap 4b: a preview _headers with the block twice is refused", () => {
  refuses("preview", (out) => writeFileSync(join(out, "_headers"), readFileSync(join(out, "_headers"), "utf8") + "/*\n  X-Robots-Tag: noindex, nofollow\n"), /_headers/);
});

test("trap 5: a preview folder that carries a sitemap.xml is refused", () => {
  refuses("preview", (out) => writeFileSync(join(out, "sitemap.xml"), "<urlset/>"), /sitemap/);
});

test("trap 6: a preview robots.txt that is not the disallow-all file is refused", () => {
  refuses("preview", (out) => writeFileSync(join(out, "robots.txt"), "User-agent: *\nAllow: /\n"), /robots\.txt/);
});

// ---- public/ may hold none of the three files -------------------------------------------------------------------

for (const name of ["robots.txt", "sitemap.xml", "_headers"]) {
  test(`public/${name} makes assertPublicClean throw (a copy of public/ would bypass the target logic)`, () => {
    const root = fakeRoot();
    assertPublicClean(root);
    writeFileSync(join(root, "public", name), "x");
    assert.throws(() => assertPublicClean(root), new RegExp(name.replace(".", "\\.")));
  });
}

test("the real public/ holds none of robots.txt, sitemap.xml or _headers", () => {
  assertPublicClean(process.cwd());
});

// ---- addresses and exclusions -----------------------------------------------------------------------------------

test("LOCALES equals the locale list of lib/locale-path.ts", () => {
  assert.deepEqual([...LOCALES], [...LOCALE_PATH_LOCALES]);
});

test("htmlFileToPath: the English home, a locale home keeps its slash, a page has none", () => {
  assert.equal(htmlFileToPath("index.html"), "/");
  assert.equal(htmlFileToPath("ar/index.html"), "/ar/");
  assert.equal(htmlFileToPath("es/index.html"), "/es/");
  assert.equal(htmlFileToPath("private-stays.html"), "/private-stays");
  assert.equal(htmlFileToPath("ar/private-stays/x.html"), "/ar/private-stays/x");
});

test("isSitemapExcluded: 404s at any depth, _-prefixed names, and the non-public sections", () => {
  for (const rel of ["404.html", "ar/404.html", "es/404.html", "a/b/404.html", "_not-found.html", "__harness.html", "_next/x.html", "a/_b/c.html"]) {
    assert.equal(isSitemapExcluded(rel), true, rel);
  }
  for (const section of ["dashboard", "account", "login", "booking", "bookings", "fx", "newsletter", "embed"]) {
    assert.equal(isSitemapExcluded(`${section}.html`), true, section);
    assert.equal(isSitemapExcluded(`${section}/x.html`), true, `${section}/x`);
    assert.equal(isSitemapExcluded(`ar/${section}.html`), true, `ar/${section}`);
  }
  for (const rel of ["index.html", "ar/index.html", "about.html", "private-stays/x.html", "es/private-stays.html", "blog/a-story.html"]) {
    assert.equal(isSitemapExcluded(rel), false, rel);
  }
});

// ---- the sitemap ------------------------------------------------------------------------------------------------

const urlBlocks = (xml) => [...xml.matchAll(/<url>\n([\s\S]*?)<\/url>/g)].map((m) => m[1]);
const locOf = (block) => /<loc>([^<]*)<\/loc>/.exec(block)[1];
const alternatesOf = (block) =>
  Object.fromEntries([...block.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map((m) => [m[1], m[2]]));

const BASES = ["/", "/private-stays", ...SLUGS.map((s) => `/private-stays/${s}`)];

test("the slice-1 document list is 42 files and the synthetic input is 62", () => {
  assert.equal(SLICE1.length, 42);
  assert.equal(SLUGS.length, 12);
  assert.equal(EN_ONLY.length, 12);
  assert.equal(ALL_FILES.length, 62);
});

test("sitemap: 54 <url> entries, one per live page and locale, nothing excluded", () => {
  const xml = buildSitemap(ALL_FILES);
  assert.equal(urlBlocks(xml).length, 54);
  assert.equal((xml.match(/<url>/g) ?? []).length, 54);
  for (const word of ["404", "_not-found", "__harness", "dashboard", "login", "account"]) {
    assert.equal(xml.includes(word), false, `${word} must not appear`);
  }
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml">/);
  assert.equal(/lastmod|priority|changefreq/.test(xml), false, "no date or priority is invented");
});

test("sitemap: each of the 42 documents has exactly four alternates equal to SITE_ORIGIN + localePath", () => {
  const blocks = urlBlocks(buildSitemap(ALL_FILES));
  let checked = 0;
  for (const base of BASES) {
    const want = {
      en: SITE_ORIGIN + localePath("en", base),
      ar: SITE_ORIGIN + localePath("ar", base),
      es: SITE_ORIGIN + localePath("es", base),
      "x-default": SITE_ORIGIN + localePath("en", base),
    };
    for (const locale of LOCALE_PATH_LOCALES) {
      const own = SITE_ORIGIN + localePath(locale, base);
      const found = blocks.filter((b) => locOf(b) === own);
      assert.equal(found.length, 1, `one <url> for ${own}`);
      assert.deepEqual(alternatesOf(found[0]), want, own);
      assert.equal((found[0].match(/<xhtml:link /g) ?? []).length, 4, `${own} has four alternates`);
      checked += 1;
    }
  }
  assert.equal(checked, 42);
});

test("sitemap: the English-only pages have one <url> and no alternates", () => {
  const blocks = urlBlocks(buildSitemap(ALL_FILES));
  for (const rel of EN_ONLY) {
    const loc = SITE_ORIGIN + htmlFileToPath(rel);
    const found = blocks.filter((b) => locOf(b) === loc);
    assert.equal(found.length, 1, loc);
    assert.equal(/xhtml:link/.test(found[0]), false, `${loc} has no alternates`);
  }
});

test("sitemap: /ar/ and /es/ keep their slash, no page has one", () => {
  const locs = urlBlocks(buildSitemap(ALL_FILES)).map(locOf);
  assert.ok(locs.includes(`${SITE_ORIGIN}/`));
  assert.ok(locs.includes(`${SITE_ORIGIN}/ar/`));
  assert.ok(locs.includes(`${SITE_ORIGIN}/es/`));
  assert.equal(locs.includes(`${SITE_ORIGIN}/ar`), false);
  assert.equal(locs.includes(`${SITE_ORIGIN}/es`), false);
  for (const loc of locs) {
    const path = loc.slice(SITE_ORIGIN.length);
    if (path !== "/" && path !== "/ar/" && path !== "/es/") assert.equal(path.endsWith("/"), false, loc);
  }
});

test("sitemap: dropping one es document throws, naming it (a half-translated page never ships)", () => {
  const dropped = `es/private-stays/${SLUGS[0]}.html`;
  assert.ok(ALL_FILES.includes(dropped));
  assert.throws(() => buildSitemap(ALL_FILES.filter((f) => f !== dropped)), new RegExp(SLUGS[0]));
  assert.throws(() => buildSitemap(ALL_FILES.filter((f) => f !== "ar/index.html")), /\/ar\/|ar/);
});

test("sitemap: the same input gives the same output, in any input order, sorted by page then en, ar, es", () => {
  const first = buildSitemap(ALL_FILES);
  assert.equal(buildSitemap(ALL_FILES), first);
  assert.equal(buildSitemap([...ALL_FILES].reverse()), first);
  const locs = urlBlocks(first).map(locOf);
  const pageOrder = [...new Set(locs.map((loc) => loc.slice(SITE_ORIGIN.length).replace(/^\/(ar|es)(\/|$)/, "/")))];
  assert.deepEqual(pageOrder, [...pageOrder].sort());
  const home = locs.slice(0, 3);
  assert.deepEqual(home, [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/ar/`, `${SITE_ORIGIN}/es/`]);
});

test("sitemap: a path is XML-escaped", () => {
  const xml = buildSitemap(["a&b.html"]);
  assert.match(xml, /<loc>https:\/\/almarprivatejourney\.com\/a&amp;b<\/loc>/);
});

test("sitemap: two files for one address throw", () => {
  assert.throws(() => buildSitemap(["ar.html", "ar/index.html", "index.html", "es/index.html"]), /ar/);
});
