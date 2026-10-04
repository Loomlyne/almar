import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ABOUT_PAGE_COPY } from "../lib/copy/about-page.ts";

// Plan 03.3-23 Task 1: the About page's copy. The key-tree walk of tests/contact-page-copy.test.mjs, the live English
// pinned as literals (and, while app/about/route.ts exists, proven present in its decoded text), the headings the
// canvas approved in Arabic and Spanish, the footer table kept out (S3-24) and the strings that must not be here.

const FILE = "lib/copy/about-page.ts";
const LOCALES = ["en", "ar", "es"];
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function walk(en, other, path, problems) {
  if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    for (const key of Object.keys(en)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else walk(en[key], other[key], `${path}.${key}`, problems);
    }
    for (const key of Object.keys(other)) if (!(key in en)) problems.push(`${path}.${key}: not in en`);
  } else if (typeof en === "string") {
    if (typeof other !== "string") problems.push(`${path}: expected string`);
    else if (other.trim() === "") problems.push(`${path}: empty string`);
  } else problems.push(`${path}: a value that is neither object nor string`);
}

function leaves(value, prefix = "", out = []) {
  if (typeof value === "string") out.push([prefix, value]);
  else if (isObj(value)) for (const [k, v] of Object.entries(value)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

test("the three locales exist", () => {
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY).sort(), [...LOCALES].sort());
});

for (const locale of ["ar", "es"]) {
  test(`${FILE}: every en key exists in ${locale} with a non-empty value, and no other key`, () => {
    const problems = [];
    walk(ABOUT_PAGE_COPY.en, ABOUT_PAGE_COPY[locale], `${FILE} [${locale}]`, problems);
    assert.deepEqual(problems, []);
  });
}

test("the key tree is the one the page reads, and has no frame or footer key (S3-24)", () => {
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en), ["meta", "story", "values", "team", "getInTouch"]);
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en.meta), ["title", "description"]);
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en.story), ["heading", "intro"]);
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en.values), ["heading", "intro"]);
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en.team), ["kicker", "heading"]);
  assert.deepEqual(Object.keys(ABOUT_PAGE_COPY.en.getInTouch), ["heading", "intro", "cta"]);
  for (const l of LOCALES) {
    assert.ok(!("frame" in ABOUT_PAGE_COPY[l]), `${l} has a frame key`);
    assert.ok(!("footer" in ABOUT_PAGE_COPY[l]), `${l} has a footer key`);
  }
});

const EN = {
  meta: {
    title: "ALMAR private travel team in Colombia",
    description:
      "ALMAR is a team that plans private trips in Colombia for international travelers. Safety and privacy come first.",
  },
  story: {
    heading: "Our Story",
    intro: "From Colombia, with love — and a mission to make every journey safe, pleasant, and unforgettable.",
  },
  values: { heading: "Our Values", intro: "What we believe in shapes every stay." },
  team: { kicker: "Our Team", heading: "A small team with a singular focus." },
  getInTouch: {
    heading: "Get In Touch",
    intro:
      "Your private Colombia journey begins with a conversation. Share your vision and our team will design a safety-led, fully bespoke experience.",
    cta: "Begin Your Journey",
  },
};

test("EN is the live Framer About page, verbatim", () => {
  assert.deepEqual(ABOUT_PAGE_COPY.en, EN);
});

test("while app/about/route.ts exists, every EN leaf is in its decoded text (skipped once it is deleted)", (t) => {
  if (!existsSync("app/about/route.ts")) return t.skip("app/about/route.ts is gone (plan 23 task 2 deleted it)");
  const line = readFileSync("app/about/route.ts", "utf8")
    .split("\n")
    .find((l) => l.startsWith("const HTML = "));
  assert.ok(line, "HTML constant not found");
  const html = JSON.parse(line.slice("const HTML = ".length).replace(/;$/, ""));
  const decode = (s) =>
    s
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&mdash;|&#8212;|&#x2014;/g, "—");
  const text = decode(html);
  for (const [path, value] of leaves(EN)) assert.ok(text.includes(decode(value)), `not on the live About page: ${path}: ${value}`);
});

test("the headings the canvas approved (design 3.4), in Arabic and Spanish", () => {
  assert.equal(ABOUT_PAGE_COPY.ar.story.heading, "قصتنا");
  assert.equal(ABOUT_PAGE_COPY.es.story.heading, "Nuestra historia");
  assert.equal(ABOUT_PAGE_COPY.ar.values.heading, "قيمنا");
  assert.equal(ABOUT_PAGE_COPY.es.values.heading, "Nuestros valores");
  assert.equal(ABOUT_PAGE_COPY.ar.getInTouch.heading, "تواصل معنا");
  assert.equal(ABOUT_PAGE_COPY.es.getInTouch.heading, "Ponte en contacto");
});

test("the Arabic strings the owner saw on the signed pictures (mock.py T['ar'])", () => {
  const ar = ABOUT_PAGE_COPY.ar;
  assert.equal(ar.story.intro, "من كولومبيا بكل حب، ومهمتنا أن تكون كل رحلة آمنة وممتعة ولا تُنسى.");
  assert.equal(ar.values.intro, "ما نؤمن به يصوغ كل إقامة.");
  assert.equal(
    ar.getInTouch.intro,
    "تبدأ رحلتكم الخاصة في كولومبيا بحديث. شاركونا رؤيتكم وسيصمّم فريقنا تجربة مفصّلة بالكامل تضع الأمان أولاً.",
  );
  assert.equal(ar.getInTouch.cta, "ابدأوا رحلتكم");
});

test("every AR and ES leaf differs from its EN leaf; every AR leaf has an Arabic letter", () => {
  const en = new Map(leaves(ABOUT_PAGE_COPY.en));
  for (const l of ["ar", "es"]) {
    for (const [path, value] of leaves(ABOUT_PAGE_COPY[l])) {
      assert.notEqual(value, en.get(path), `${l}.${path} equals the English`);
      if (l === "ar") assert.match(value, /[؀-ۿ]/, `ar.${path} has no Arabic letter`);
    }
  }
});

test("the copy file carries none of the refused or foreign strings", () => {
  const text = readFileSync(FILE, "utf8");
  for (const bad of [
    "partnerships@",
    "Nothing on this page is sent",
    "framerusercontent",
    "catbox",
    "pexels",
    "Ana Velásquez",
    "Mateo Ríos",
    "Sofía Marín",
    "footer",
  ]) {
    assert.ok(!text.includes(bad), `${FILE} contains ${bad}`);
  }
  assert.doesNotMatch(text, /[0-9]{1,3},[0-9]{3}/, "a digit-grouped number");
  assert.doesNotMatch(text, /\b(USD|AED|EUR)\b/, "a currency code");
});

test("the copy file is not registered in lib/copy/index.ts (R-9)", () => {
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("about-page"), false);
});
