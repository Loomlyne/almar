// Guards lib/copy/stays-list.ts (phase 3.3 plan 05): the same key tree in three languages, the two published
// EN meta strings, the three h1s of board 5h (k16), and the count line in every plural category.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAYS_LIST_COPY } from "../lib/copy/stays-list.ts";
import { formatPlural } from "../lib/journey-format.ts";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Same walk as tests/copy.test.mjs. `skip` names the paths where AR may carry more plural categories. */
function walk(en, other, path, problems, skip = () => false) {
  if (skip(path)) return;
  if (Array.isArray(en)) {
    if (!Array.isArray(other)) return problems.push(`${path}: expected array`);
    if (en.length !== other.length) problems.push(`${path}: length ${other.length}, en has ${en.length}`);
    en.forEach((item, i) => walk(item, other[i], `${path}[${i}]`, problems, skip));
  } else if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    for (const key of Object.keys(en)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else walk(en[key], other[key], `${path}.${key}`, problems, skip);
    }
  } else if (typeof en === "string") {
    if (typeof other !== "string") problems.push(`${path}: expected string`);
    else if (other.trim() === "") problems.push(`${path}: empty string`);
  }
}

// Plural forms differ by language, so the count node is checked on its own below.
const skipCount = (path) => path.endsWith(".count");

for (const locale of ["ar", "es"]) {
  test(`stays-list: every en key exists in ${locale} with a non-empty value`, () => {
    const problems = [];
    walk(STAYS_LIST_COPY.en, STAYS_LIST_COPY[locale], `STAYS_LIST_COPY [${locale}]`, problems, skipCount);
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

test("every count form is a non-empty string with one # slot or none, and has an `other`", () => {
  for (const locale of ["en", "ar", "es"]) {
    const forms = STAYS_LIST_COPY[locale].count;
    assert.equal(typeof forms.other, "string", `${locale}: count.other`);
    for (const [category, text] of Object.entries(forms)) {
      assert.equal(typeof text, "string");
      assert.ok(text.trim().length > 0, `${locale}: count.${category} is empty`);
      assert.ok((text.match(/#/g) ?? []).length <= 1, `${locale}: count.${category} has more than one #`);
    }
  }
  assert.deepEqual(Object.keys(STAYS_LIST_COPY.ar.count).sort(), ["few", "many", "one", "other", "two", "zero"]);
});

test("the two published EN meta strings are verbatim from the live list page", () => {
  assert.equal(STAYS_LIST_COPY.en.meta.title, "Private villas and houses in Colombia | ALMAR");
  assert.equal(
    STAYS_LIST_COPY.en.meta.description,
    "Private villas and houses in Cartagena, Medellín, and more. ALMAR checks every home before you book.",
  );
});

test("the EN filter strings are the ones design 1.2 proposes", () => {
  const en = STAYS_LIST_COPY.en;
  assert.equal(en.heading, "Your Stay, Personally Selected");
  assert.equal(en.filtersLabel, "Filter stays");
  assert.equal(en.search.label, "Search stays");
  assert.deepEqual(en.destination, { label: "Destination", all: "All" });
  assert.deepEqual(en.guests, {
    label: "Guests",
    any: "Any",
    add: "Add a guest",
    remove: "Remove a guest",
    atMax: "No stay takes more guests.",
  });
  assert.equal(en.bedrooms.label, "Bedrooms");
  assert.deepEqual(en.bedrooms.options, { any: "Any", "1-4": "1–4", "5-8": "5–8", "9+": "9+" });
  assert.deepEqual(en.count, { one: "# stay", other: "# stays" });
  assert.equal(en.empty, "No stays match these filters.");
  assert.equal(en.clear, "Clear filters");
});

test("the h1 in all three languages is board 5h key k16, verbatim", () => {
  const board = readFileSync(".planning/design/2026-10-01-canvas/boards/PublicStays.dc.html", "utf8");
  const k16 = board.match(/"k16":(\{[^}]*\})/);
  assert.ok(k16, "k16 not found in the board dictionary");
  const words = JSON.parse(k16[1]);
  for (const locale of ["en", "ar", "es"]) {
    assert.equal(STAYS_LIST_COPY[locale].heading, words[locale], `${locale} heading`);
  }
});

test("formatPlural: every count renders a Western digit, except AR zero/one/two which spell the number in words", () => {
  const ARABIC_INDIC = /[٠-٩]/;
  for (const locale of ["en", "ar", "es"]) {
    for (const n of [0, 1, 2, 3, 11, 12]) {
      const text = formatPlural(STAYS_LIST_COPY[locale].count, n, locale);
      assert.equal(ARABIC_INDIC.test(text), false, `${locale} ${n}: Arabic-Indic digit in "${text}"`);
      const inWords = locale === "ar" && n <= 2;
      if (inWords) assert.equal(/\d/.test(text), false, `${locale} ${n}: expected words, got "${text}"`);
      else assert.ok(text.includes(String(n)), `${locale} ${n}: "${text}" has no ${n}`);
    }
  }
});

test("formatPlural: the English and Spanish singular and plural, and the Arabic dual", () => {
  assert.equal(formatPlural(STAYS_LIST_COPY.en.count, 1, "en"), "1 stay");
  assert.equal(formatPlural(STAYS_LIST_COPY.en.count, 12, "en"), "12 stays");
  assert.equal(formatPlural(STAYS_LIST_COPY.en.count, 0, "en"), "0 stays");
  assert.equal(formatPlural(STAYS_LIST_COPY.es.count, 1, "es"), "1 estancia");
  assert.equal(formatPlural(STAYS_LIST_COPY.es.count, 12, "es"), "12 estancias");
  assert.equal(formatPlural(STAYS_LIST_COPY.ar.count, 2, "ar"), "إقامتان");
  assert.equal(formatPlural(STAYS_LIST_COPY.ar.count, 12, "ar"), "12 إقامة");
});

test("the frame strings carry the published copyright line in EN", () => {
  assert.equal(STAYS_LIST_COPY.en.frame.footer.copyright, "© 2026 ALMAR Private Journeys. All rights reserved.");
});

test("lib/copy/index.ts does not register this file (reconcile R-9: imported directly)", () => {
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("stays-list"), false);
});
