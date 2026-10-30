// publicDocuments() (plan 03.3-12): the out/ path of every public React document, computed from PUBLIC_PAGES and
// the published stay slugs and live post slugs, so a slice adds a page pattern and nothing here changes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOCALES, PUBLIC_PAGES, matchPublicPage, stripLocale } from "../lib/locale-path.ts";
import { SLICE1_PAGES, publicDocuments, readPostSlugs, readStaySlugs } from "../scripts/media-lib.mjs";
import { reactPublicRoutes } from "./helpers/site-links.mjs";

const slugs = readStaySlugs();
/** The published packages of the home fixture (plan 06-06): the documents of /journeys/[journey]. */
const packageSlugs = JSON.parse(readFileSync("lib/data/fixtures/home.json", "utf8")).tiers.filter((tier) => tier.is_published).map((tier) => tier.slug);

/** The slice-1 algorithm as it stood at 84deec2, rebuilt here as the reference (English under en/ since job 21). */
function reference(staySlugs) {
  const docs = [];
  for (const prefix of ["en/", "ar/", "es/"]) {
    docs.push(`${prefix}index.html`, `${prefix}private-stays.html`);
    for (const slug of staySlugs) docs.push(`${prefix}private-stays/${slug}.html`);
  }
  return docs;
}

test("publicDocuments(slugs, SLICE1_PAGES) is slice 1's own list: the same paths in the same order", () => {
  const docs = publicDocuments(slugs, SLICE1_PAGES);
  assert.deepEqual(docs, reference(slugs));
  assert.equal(docs.length, 42, "slice 1's own list is 42 documents, 14 per locale");
  for (const prefix of ["en/", "ar/", "es/"]) assert.equal(docs.filter((d) => d.startsWith(prefix)).length, 14);
});

test("publicDocuments() length is computed from PUBLIC_PAGES; locales are symmetric; no duplicates", () => {
  const docs = publicDocuments();
  const statics = PUBLIC_PAGES.filter((p) => !p.includes("[")).length;
  const stayPages = PUBLIC_PAGES.filter((p) => p.includes("[stay]")).length;
  const postPages = PUBLIC_PAGES.filter((p) => p.includes("[post]")).length;
  const legalPages = PUBLIC_PAGES.filter((p) => p.includes("[legal]")).length; // no document: the database's only (plan 06-04)
  const journeyPages = PUBLIC_PAGES.filter((p) => p.includes("[journey]")).length; // the published packages (plan 06-06)
  assert.equal(statics + stayPages + postPages + legalPages + journeyPages, PUBLIC_PAGES.length, "every pattern is static, [stay], [post], [legal] or [journey]");
  assert.equal(docs.length, LOCALES.length * (statics + slugs.length * stayPages + readPostSlugs().length * postPages + packageSlugs.length * journeyPages));
  assert.equal(new Set(docs).size, docs.length);
  const perLocale = (l) => docs.filter((d) => d.startsWith(`${l}/`));
  const sizes = LOCALES.map((l) => perLocale(l).length);
  assert.equal(new Set(sizes).size, 1, `per-locale counts differ: ${sizes}`);
});

test("every document maps back to a URL that is a public page", () => {
  for (const doc of publicDocuments()) {
    assert.match(doc, /^(en|ar|es)\//, `${doc} carries its locale prefix`);
    const url = doc === "index.html" ? "/" : doc.endsWith("/index.html") ? `/${doc.slice(0, -"index.html".length)}` : `/${doc.slice(0, -".html".length)}`;
    assert.notEqual(matchPublicPage(stripLocale(url).path), null, `${doc} -> ${url}`);
  }
});

test("agreement with the page.tsx files: the sorted documents equal reactPublicRoutes() mapped to out/ paths", () => {
  const fromRoutes = reactPublicRoutes().map((url) => {
    if (url === "/en/" || url === "/ar/" || url === "/es/") return `${url.slice(1)}index.html`;
    return `${url.slice(1)}.html`;
  });
  assert.deepEqual([...publicDocuments()].sort(), fromRoutes.sort());
});

test("a new static pattern adds exactly three documents; an unknown parameter throws", () => {
  const base = publicDocuments(slugs);
  const more = publicDocuments(slugs, [...PUBLIC_PAGES, "/zz-probe"]);
  assert.equal(more.length, base.length + 3);
  for (const d of ["en/zz-probe.html", "ar/zz-probe.html", "es/zz-probe.html"]) assert.ok(more.includes(d), d);
  assert.throws(() => publicDocuments(slugs, ["/x/[thing]"]), /no enumerator for \[thing\]/);
});
