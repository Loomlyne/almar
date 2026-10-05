// Guards lib/copy/destinations-page.ts (phase 3.3 plan 13): the same key tree in three languages, the two published EN meta
// strings (also proven against the live Framer route while app/destinations/route.ts exists), board 5d's kicker and h1, and the
// slider labels that are the stay gallery's own.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DESTINATIONS_PAGE_COPY } from "../lib/copy/destinations-page.ts";
import { STAY_DETAIL_COPY } from "../lib/copy/stay-detail.ts";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Same walk as tests/stays-list-copy.test.mjs. */
function walk(en, other, path, problems) {
  if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    for (const key of Object.keys(en)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else walk(en[key], other[key], `${path}.${key}`, problems);
    }
  } else if (typeof en === "string") {
    if (typeof other !== "string") problems.push(`${path}: expected string`);
    else if (other.trim() === "") problems.push(`${path}: empty string`);
  }
}

for (const locale of ["ar", "es"]) {
  test(`destinations-page: every en key exists in ${locale} with a non-empty value`, () => {
    const problems = [];
    walk(DESTINATIONS_PAGE_COPY.en, DESTINATIONS_PAGE_COPY[locale], `DESTINATIONS_PAGE_COPY [${locale}]`, problems);
    assert.deepEqual(problems, []);
  });
}

test("the walk reports the path of a missing key (red case of the checker)", () => {
  const problems = [];
  walk({ a: { b: "x" } }, { a: {} }, "sample", problems);
  assert.deepEqual(problems, ["sample.a.b: missing"]);
  const empty = [];
  walk({ a: "x" }, { a: "  " }, "sample", empty);
  assert.deepEqual(empty, ["sample.a: empty string"]);
});

test("status: published in en, draft in ar and es", () => {
  assert.equal(DESTINATIONS_PAGE_COPY.en.status, "published");
  assert.equal(DESTINATIONS_PAGE_COPY.ar.status, "draft");
  assert.equal(DESTINATIONS_PAGE_COPY.es.status, "draft");
});

const LIVE_TITLE = "Best places to visit in Colombia | ALMAR";
const LIVE_DESCRIPTION = "Cartagena, Medellín, Bogotá, coffee country, and islands. ALMAR plans private trips to each place.";

test("the two published EN meta strings are the live page's, pinned and found in the Framer route while it exists", (t) => {
  assert.equal(DESTINATIONS_PAGE_COPY.en.meta.title, LIVE_TITLE);
  assert.equal(DESTINATIONS_PAGE_COPY.en.meta.description, LIVE_DESCRIPTION);
  if (!existsSync("app/destinations/route.ts")) return t.skip("app/destinations/route.ts is gone: the live-string proof ran before the deletion");
  const route = readFileSync("app/destinations/route.ts", "utf8");
  assert.ok(route.includes(`<title>${LIVE_TITLE}</title>`), "live <title>");
  assert.ok(route.includes(`name=\\"description\\" content=\\"${LIVE_DESCRIPTION}\\"`), "live meta description");
});

test("the kicker and the h1 in all three languages are board 5d keys k22 and k14, verbatim", () => {
  const board = readFileSync(".planning/design/2026-10-01-canvas/boards/PublicDestinations.dc.html", "utf8");
  const word = (key) => JSON.parse(board.match(new RegExp(`"${key}":(\\{[^}]*\\})`))[1]);
  const [k14, k22] = [word("k14"), word("k22")];
  for (const locale of ["en", "ar", "es"]) {
    assert.equal(DESTINATIONS_PAGE_COPY[locale].heading, k14[locale], `${locale} heading`);
    assert.equal(DESTINATIONS_PAGE_COPY[locale].kicker, k22[locale], `${locale} kicker`);
  }
});

test("AR and ES meta differ from EN; titles hold ALMAR; AR is Arabic and spells Medellín ميديلين", () => {
  const en = DESTINATIONS_PAGE_COPY.en.meta;
  for (const locale of ["ar", "es"]) {
    const meta = DESTINATIONS_PAGE_COPY[locale].meta;
    assert.notEqual(meta.title, en.title);
    assert.notEqual(meta.description, en.description);
    assert.ok(meta.title.includes("ALMAR"), `${locale} title`);
  }
  const ar = DESTINATIONS_PAGE_COPY.ar.meta;
  assert.match(ar.title + ar.description, /[؀-ۿ]/);
  assert.ok(ar.description.includes("ميديلين"));
  assert.equal(ar.description.includes("ميديين"), false);
});

test("slider labels are the stay gallery's own, except the region name", () => {
  for (const locale of ["en", "ar", "es"]) {
    const g = STAY_DETAIL_COPY[locale].gallery;
    const s = DESTINATIONS_PAGE_COPY[locale].slider;
    for (const key of ["previous", "next", "goTo", "slide", "pause", "play"]) assert.equal(s[key], g[key], `${locale} ${key}`);
    assert.notEqual(s.region, g.region);
    assert.equal(s.region.includes("{"), false, `${locale} region has no slot`);
  }
});

test("no footer string, no packages, no Eje Cafetero, no brackets, no currency or grouped number; not registered in index.ts", () => {
  const source = readFileSync("lib/copy/destinations-page.ts", "utf8");
  const body = source.split("export const DESTINATIONS_PAGE_COPY")[1];
  assert.equal(/Eje Cafetero|packages|\[|AED|USD|EUR|[0-9]{1,3},[0-9]{3}|copyright|newsletter/.test(body), false);
  for (const locale of ["en", "ar", "es"]) {
    assert.equal("frame" in DESTINATIONS_PAGE_COPY[locale] || "footer" in DESTINATIONS_PAGE_COPY[locale], false);
  }
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("destinations-page"), false);
});
