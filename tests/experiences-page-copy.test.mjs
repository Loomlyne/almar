// Guards lib/copy/experiences-page.ts (phase 3.3 plan 14): one key tree in three languages, the two published EN meta
// strings (also proven against the live Framer route while app/experiences/route.ts exists), every string that has a key on
// board 5e or 5f equal to the board's dictionary value, "Request Inquiry" equal to the stay pages' own label, the plural
// families, and no price, currency, cart or login word anywhere in the file.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { EXPERIENCES_PAGE_COPY } from "../lib/copy/experiences-page.ts";
import { STAY_DETAIL_COPY } from "../lib/copy/stay-detail.ts";
import { fill, formatPlural } from "../lib/journey-format.ts";

const LOCALES = ["en", "ar", "es"];
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Same walk as tests/stays-list-copy.test.mjs. Plural nodes are checked on their own below. */
function walk(en, other, path, problems) {
  if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    if (/\.(count|showResults|badge)$/.test(path)) return;
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
  test(`experiences-page: every en key exists in ${locale} with a non-empty value`, () => {
    const problems = [];
    walk(EXPERIENCES_PAGE_COPY.en, EXPERIENCES_PAGE_COPY[locale], `EXPERIENCES_PAGE_COPY [${locale}]`, problems);
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

test("the key tree is the one the page reads", () => {
  const en = EXPERIENCES_PAGE_COPY.en;
  assert.deepEqual(Object.keys(en).sort(), [
    "badge", "clear", "count", "destination", "empty", "filters", "groups", "heading", "meta", "overlay",
    "removeFilter", "search", "showResults", "stay", "type",
  ]);
  assert.deepEqual(Object.keys(en.overlay).sort(), ["close", "duration", "experience", "requestInquiry", "service", "stays"]);
  assert.deepEqual(Object.keys(en.type).sort(), ["all", "experiences", "label", "services"]);
  assert.deepEqual(Object.keys(en.filters).sort(), ["button", "label", "title"]);
});

const LIVE_TITLE = "Private tours and experiences in Colombia | ALMAR";
const LIVE_DESCRIPTION = "Private boat trips, city tours, food walks, and more. Every experience is just for you and your group.";

test("the two published EN meta strings are the live page's, pinned and found in the Framer route while it exists", (t) => {
  assert.equal(EXPERIENCES_PAGE_COPY.en.meta.title, LIVE_TITLE);
  assert.equal(EXPERIENCES_PAGE_COPY.en.meta.description, LIVE_DESCRIPTION);
  if (!existsSync("app/experiences/route.ts")) return t.skip("app/experiences/route.ts is gone: the live-string proof ran before the deletion");
  const route = readFileSync("app/experiences/route.ts", "utf8");
  assert.ok(route.includes(`<title>${LIVE_TITLE}</title>`), "live <title>");
  assert.ok(route.includes(`name=\\"description\\" content=\\"${LIVE_DESCRIPTION}\\"`), "live meta description");
});

const board = (file) => readFileSync(`.planning/design/2026-10-01-canvas/boards/${file}`, "utf8");
function word(source, key) {
  const m = source.match(new RegExp(`"${key}":(\\{[^}]*\\})`));
  assert.ok(m, `board key ${key} not found`);
  return JSON.parse(m[1]);
}

test("every string with a board key is the board's dictionary value in all three languages", () => {
  const e = board("PublicExperiences.dc.html");
  const o = board("PublicOverlay.dc.html");
  for (const locale of LOCALES) {
    const c = EXPERIENCES_PAGE_COPY[locale];
    const pairs = [
      ["heading k15", c.heading, word(e, "k15")],
      ["search.label k60", c.search.label, word(e, "k60")],
      ["type.label k61", c.type.label, word(e, "k61")],
      ["type.all k63", c.type.all, word(e, "k63")],
      ["type.experiences k64", c.type.experiences, word(e, "k64")],
      ["type.services k65", c.type.services, word(e, "k65")],
      ["destination.label k66", c.destination.label, word(e, "k66")],
      ["stay.label k72", c.stay.label, word(e, "k72")],
      ["clear k73", c.clear, word(e, "k73")],
      ["filters.button k74", c.filters.button, word(e, "k74")],
      ["filters.title k74", c.filters.title, word(e, "k74")],
      ["overlay.experience k3", c.overlay.experience, word(o, "k3")],
      ["overlay.duration k7", c.overlay.duration, word(o, "k7")],
    ];
    for (const [name, got, dict] of pairs) assert.equal(got, dict[locale], `${locale} ${name}`);
    assert.equal(c.groups.experiences, c.type.experiences, `${locale} groups.experiences`);
    assert.equal(c.groups.services, c.type.services, `${locale} groups.services`);
  }
});

test("overlay.requestInquiry is the stay pages' own label", () => {
  for (const locale of LOCALES) {
    assert.equal(EXPERIENCES_PAGE_COPY[locale].overlay.requestInquiry, STAY_DETAIL_COPY[locale].requestInquiry, locale);
  }
});

test("the plural families render in every locale: non-empty, Western digits, AR carries six categories", () => {
  const ARABIC_INDIC = /[٠-٩]/;
  for (const locale of LOCALES) {
    for (const family of ["count", "showResults", "badge"]) {
      const forms = EXPERIENCES_PAGE_COPY[locale][family];
      assert.equal(typeof forms.other, "string", `${locale} ${family}.other`);
      for (const [category, text] of Object.entries(forms)) {
        assert.ok(text.trim().length > 0, `${locale} ${family}.${category} is empty`);
        assert.ok((text.match(/#/g) ?? []).length <= 1, `${locale} ${family}.${category}: more than one #`);
      }
      for (const n of [0, 1, 2, 3, 10, 11, 14, 45]) {
        const text = formatPlural(forms, n, locale);
        assert.ok(text.trim().length > 0, `${locale} ${family} ${n}`);
        assert.equal(ARABIC_INDIC.test(text), false, `${locale} ${family} ${n}: Arabic-Indic digit in "${text}"`);
      }
      if (locale === "ar") {
        assert.deepEqual(Object.keys(forms).sort(), ["few", "many", "one", "other", "two", "zero"], `ar ${family}`);
      }
    }
  }
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.en.count, 45, "en"), "45 options");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.en.count, 1, "en"), "1 option");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.en.showResults, 14, "en"), "Show 14 options");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.en.badge, 2, "en"), "2 active filters");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.ar.count, 2, "ar"), "خياران");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.ar.count, 3, "ar"), "3 خيارات");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.ar.count, 11, "ar"), "11 خيارًا");
  assert.equal(formatPlural(EXPERIENCES_PAGE_COPY.ar.count, 45, "ar"), "45 خيارًا");
});

test("removeFilter carries the filter's name in every locale", () => {
  for (const locale of LOCALES) {
    const text = fill(EXPERIENCES_PAGE_COPY[locale].removeFilter, { name: "Cartagena" });
    assert.ok(text.includes("Cartagena"), locale);
    assert.ok(!text.includes("{"), locale);
  }
});

test("no string holds a currency, a price, a cart, a login or a person's name", () => {
  const strings = [];
  (function collect(value) {
    if (typeof value === "string") strings.push(value);
    else if (isObj(value)) Object.values(value).forEach(collect);
  })(EXPERIENCES_PAGE_COPY);
  const banned = [
    /\b(AED|USD|EUR|COP)\b/,
    /[$€£]/,
    /\d{1,3}[,.]\d{3}/,
    /per person/i,
    /add to cart/i,
    /\bcart\b/i,
    /login/i,
    /price/i,
    /\b(Ana|Mateo|Sof[ií]a|Abeer|Khadija|Koussay)\b/,
  ];
  for (const text of strings) for (const re of banned) assert.ok(!re.test(text), `"${text}" matches ${re}`);
  const source = readFileSync("lib/copy/experiences-page.ts", "utf8");
  assert.ok(!/\b(AED|USD|EUR|COP)\b|per person|Add to cart/.test(source.replace(/\/\/.*$/gm, "")), "source holds a banned word outside a comment");
});

test("AR and ES differ from EN and AR is Arabic", () => {
  const en = EXPERIENCES_PAGE_COPY.en;
  for (const locale of ["ar", "es"]) {
    const c = EXPERIENCES_PAGE_COPY[locale];
    assert.notEqual(c.meta.title, en.meta.title);
    assert.notEqual(c.meta.description, en.meta.description);
    assert.notEqual(c.empty, en.empty);
    assert.ok(c.meta.title.includes("ALMAR"), `${locale} title`);
  }
  assert.match(EXPERIENCES_PAGE_COPY.ar.empty + EXPERIENCES_PAGE_COPY.ar.removeFilter, /[؀-ۿ]/);
});

test("the copy is not registered in lib/copy/index.ts (reconcile R-9)", () => {
  assert.ok(!readFileSync("lib/copy/index.ts", "utf8").includes("experiences-page"));
});
