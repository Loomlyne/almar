import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { HOME_PAGE_COPY } from "../lib/copy/home-page.ts";
import { HOME_COPY } from "../lib/copy/home.ts";
import { FRAMER_SOURCE_COPY } from "../lib/copy/framer-source.ts";
import { formatPlural } from "../lib/journey-format.ts";

// Plan 03.3-04 Task 1: the home copy file. Same key-tree walk as tests/copy.test.mjs, the live English
// pinned as literals (and, while the Framer home still exists, proven present in its text), the two lines
// that contradict the signed design kept out, and the plural forms of the live result count.

const FILE = "lib/copy/home-page.ts";
const LOCALES = ["en", "ar", "es"];
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

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
  test(`${FILE}: every en key exists in ${locale} with a non-empty value`, () => {
    const problems = [];
    walk(HOME_PAGE_COPY.en, HOME_PAGE_COPY[locale], `${FILE} [${locale}]`, problems);
    assert.deepEqual(problems, []);
  });
}

test("the key tree has exactly the sections the page renders", () => {
  assert.deepEqual(Object.keys(HOME_PAGE_COPY).sort(), ["ar", "en", "es"]);
  assert.deepEqual(Object.keys(HOME_PAGE_COPY.en), [
    "meta",
    "hero",
    "stays",
    "services",
    "moments",
    "journeys",
    "stories",
    "begin",
    "team",
    "gallery",
    "footer",
  ]);
  assert.deepEqual(Object.keys(HOME_PAGE_COPY.en.stays), ["kicker", "heading", "intro", "viewAll", "count"]);
  assert.deepEqual(Object.keys(HOME_PAGE_COPY.en.journeys), ["heading", "intro", "featured", "ratesOf"]);
});

// The live English, verbatim (app/route.ts, read 2026-10-03). Pinned as literals so a later edit of the
// copy file cannot silently change a published line.
const LIVE = {
  "meta.title": "Private luxury trips in Colombia | ALMAR",
  "meta.description":
    "ALMAR plans private trips in Colombia. We book villas, set up tours, and give you a concierge for your whole stay.",
  "stays.kicker": "Private Stays",
  "stays.heading": "Private Stays, Fully Vetted",
  "stays.intro":
    "Verified private houses, island estates, and countryside retreats across Cartagena and Antioquia — each selected for security, staff readiness, and total discretion.",
  "stays.viewAll": "View All Private Stays",
  "services.kicker": "Services & Experiences",
  "services.heading": "Everything Handled. Nothing Left to Chance.",
  "services.intro":
    "From private villas to dedicated concierge, ALMAR manages every detail of your Colombia journey, so you can simply live it.",
  "services.viewAll": "View All Services",
  "moments.kicker": "Curated Experiences",
  "moments.heading": "Moments Designed for You",
  "moments.intro": "From private yacht charters to helicopter tours, every ALMAR experience is curated exclusively around you.",
  "moments.cta": "Request Consultation",
  "journeys.heading": "Choose Your Journey",
  "journeys.intro":
    "Three tiers of privacy, luxury, and Colombia immersion — each crafted around a different depth of experience.",
  "journeys.featured": "Most Popular",
  "stories.kicker": "Travel Insights",
  "stories.heading": "ALMAR Stories",
  "stories.intro":
    "Discover Colombia through our eyes, destination guides, local tips, and insider insights from our team on the ground.",
  "stories.readAll": "Read All",
  "begin.heading": "Begin Your Journey",
  "begin.intro":
    "Your private Colombia journey begins with a conversation, share your vision and our team will design the rest.",
  "begin.cta": "Request Consultation",
  "team.kicker": "The People Behind Your Journey",
  "team.heading": "Local insight, personally delivered.",
  "footer.copyright": "© 2026 ALMAR Private Journeys. All rights reserved.",
};

const pick = (obj, path) => path.split(".").reduce((o, k) => o[k], obj);

test("the English strings are the live home text, verbatim", () => {
  for (const [path, literal] of Object.entries(LIVE)) assert.equal(pick(HOME_PAGE_COPY.en, path), literal, path);
});

test("while the Framer home exists, every pinned literal is in its text (the pin is proven before it is deleted)", async (t) => {
  if (!existsSync("app/route.ts")) {
    t.skip("app/route.ts is gone: the literals were proven against it before it was deleted (plan 04 task 4)");
    return;
  }
  const { GET } = await import(pathToFileURL("app/route.ts").href);
  const html = await GET().text();
  const decoded = html
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
  for (const [path, literal] of Object.entries(LIVE)) {
    // The live footer prints the year and name in one text node; every other literal is a text node too.
    assert.ok(decoded.includes(literal.replace(/\s+/g, " ")), `${path} is not in the live home: ${literal}`);
  }
});

test("AR and ES reuse the approved lib/copy/home.ts lines where the live English is the same", () => {
  for (const locale of ["ar", "es"]) {
    const home = HOME_COPY[locale];
    const page = HOME_PAGE_COPY[locale];
    assert.equal(page.stays.heading, home.staysTitle, `${locale} stays.heading`);
    assert.equal(page.services.heading, home.servicesTitle, `${locale} services.heading`);
    assert.equal(page.moments.heading, home.momentsTitle, `${locale} moments.heading`);
    assert.equal(page.journeys.heading, home.journeysTitle, `${locale} journeys.heading`);
    assert.equal(page.stories.heading, home.storiesTitle, `${locale} stories.heading`);
    assert.equal(page.begin.heading, home.contactTitle, `${locale} begin.heading`);
    assert.equal(page.team.heading, home.teamTitle, `${locale} team.heading`);
  }
});

test("the footer words reuse approved lines and the copyright is the live footer's, byte for byte", () => {
  for (const locale of LOCALES) {
    const page = HOME_PAGE_COPY[locale].footer;
    assert.equal(page.pages, HOME_COPY[locale].pages, `${locale} footer.pages`);
    assert.equal(page.contact, HOME_COPY[locale].nav.contact, `${locale} footer.contact`);
    assert.equal(page.language, HOME_COPY[locale].nav.language, `${locale} footer.language`);
    assert.equal(
      page.copyright,
      FRAMER_SOURCE_COPY[locale]["© 2026 ALMAR Private Journeys. All rights reserved."],
      `${locale} footer.copyright`,
    );
  }
});

test("nothing in the file contradicts the signed design, carries a price or names a person", () => {
  const source = readFileSync(FILE, "utf8");
  assert.equal(/does not convert/i.test(source), false);
  assert.equal(/nothing on this page is sent/i.test(source), false);
  assert.equal(/\b(?:USD|AED|EUR)\b/.test(source), false, "a currency code");
  assert.equal(/[0-9]{1,3},[0-9]{3}/.test(source), false, "a digit-grouped number");
  assert.equal(/[$€£]\s?\d/.test(source), false, "a currency symbol before a number");
  // The team heading is the only line near people; no member name, no email address.
  assert.equal(/@/.test(source.replace(/\/\/.*$/gm, "")), false, "an email address");
});

test("the file is not registered in the shared copy catalogue", () => {
  assert.equal(readFileSync("lib/copy/index.ts", "utf8").includes("home-page"), false);
});

test("the AR and ES lines that have no live source are drafts marked as such in the file header", () => {
  const source = readFileSync(FILE, "utf8");
  assert.match(source, /AR and ES are DRAFTS/);
  assert.match(source, /DRAFTED UI COPY/);
});

test("the result count: one and other in en and es; zero, one, two, few, many in ar; Western digits", () => {
  const forms = (l) => HOME_PAGE_COPY[l].stays.count;
  assert.deepEqual([0, 1, 2, 3, 10, 12].map((n) => formatPlural(forms("en"), n, "en")), [
    "0 stays",
    "1 stay",
    "2 stays",
    "3 stays",
    "10 stays",
    "12 stays",
  ]);
  assert.deepEqual([0, 1, 2, 3, 10, 12].map((n) => formatPlural(forms("es"), n, "es")), [
    "0 estancias",
    "1 estancia",
    "2 estancias",
    "3 estancias",
    "10 estancias",
    "12 estancias",
  ]);
  const ar = [0, 1, 2, 3, 10, 12].map((n) => formatPlural(forms("ar"), n, "ar"));
  assert.deepEqual(ar, ["لا توجد إقامات", "إقامة واحدة", "إقامتان", "3 إقامات", "10 إقامات", "12 إقامة"]);
  for (const text of ar) assert.equal(/[٠-٩]/.test(text), false, `Arabic-Indic digit in ${text}`);
  for (const key of ["zero", "one", "two", "few", "many", "other"]) assert.ok(forms("ar")[key], `ar count.${key}`);
});

test("the rates line and the gallery labels carry their slots in every language", () => {
  for (const locale of LOCALES) {
    const page = HOME_PAGE_COPY[locale];
    assert.ok(page.journeys.ratesOf.includes("{date}"), `${locale} ratesOf`);
    assert.ok(page.gallery.open.includes("{alt}"), `${locale} gallery.open`);
    assert.ok(page.gallery.count.includes("{n}") && page.gallery.count.includes("{total}"), `${locale} gallery.count`);
  }
});
