import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

// Plan 03.3-13: source-level guards on the React /destinations page. The browser proof is in
// tests/build/destinations/destinations.spec.ts; these keep the shape from drifting between runs of it.

const read = (file) => readFileSync(file, "utf8");
const ROUTES = { en: "app/destinations/page.tsx", ar: "app/ar/destinations/page.tsx", es: "app/es/destinations/page.tsx" };
const PAGE = "components/pages/destinations-page.tsx";
/** Strip comments, so a sentence that names a forbidden thing is not mistaken for using it. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("each route file binds one locale, is static and re-exports metadata, and nothing else", () => {
  for (const [locale, file] of Object.entries(ROUTES)) {
    const source = read(file);
    assert.match(source, new RegExp(`<DestinationsPage locale="${locale}" />`), file);
    assert.match(source, new RegExp(`destinationsMetadata\\("${locale}"\\)`), file);
    assert.match(source, /export const dynamic = "force-static"/, file);
    assert.equal(/\bfetch\(|process\.env|cookies\(|headers\(/.test(source), false, `${file} reads the request`);
    assert.ok(source.split("\n").length <= 12, `${file} is more than a binding`);
  }
});

test("the Framer route is gone", () => {
  assert.equal(existsSync("app/destinations/route.ts"), false);
});

test("the page is a server component that reads the hero and the five destinations through the data layer", () => {
  const source = code(read(PAGE));
  assert.equal(/["']use client["']/.test(source), false);
  assert.match(source, /getDestinationsPageHero\(locale\)/);
  assert.match(source, /getDestinations\(locale, \{ includeEmpty: true \}\)/);
  assert.equal(/lib\/data\/(fixtures|resolve|media)/.test(source), false);
});

test("it is built only from job 11's parts: Slider hero, PortraitCard and Reveal", () => {
  const source = code(read(PAGE));
  assert.match(source, /from "\.\.\/ui\/slider"/);
  assert.match(source, /from "\.\.\/ui\/card"/);
  assert.match(source, /from "\.\.\/ui\/reveal"/);
  assert.match(source, /<Slider layout="hero" autoplay /);
  assert.match(source, /<PortraitCard\b[^>]*ratio="square"/s);
  assert.match(source, /kind="row"/);
  assert.match(source, /kind="headline"/);
  assert.match(source, /localeAlternates\(locale, PATH\)/);
  assert.match(source, /ORGANIZATION_JSON_LD_SCRIPT/);
});

test("no card link or button, no motion code of its own, no held control, no size or colour of its own", () => {
  const source = code(read(PAGE));
  for (const word of [
    "IntersectionObserver",
    "@keyframes",
    "transition",
    "setInterval",
    "setTimeout",
    "<a ",
    "<a\n",
    "<Link",
    "<button",
    "onOpen",
    "currency",
    "text-display",
    "text-title",
    "text-caption",
    "framerusercontent",
    "catbox",
    "pexels",
    "Eje Cafetero",
    "eje-cafetero",
    "/destinations/",
    "Three exclusive packages",
    "border-gold",
    "tabIndex",
  ])
    assert.equal(source.includes(word), false, word);
  assert.equal(/<PortraitCard[^>]*\bhref=/s.test(source), false, "a PortraitCard with href");
  assert.equal(/#[0-9a-fA-F]{3,8}\b|[0-9]+px|-\[/.test(source), false, "raw hex, px or arbitrary value");
  assert.match(source, /text-hero/);
  assert.match(source, /md:grid-cols-4 md:gap-8/);
  assert.match(source, /grid-cols-1 gap-4/);
  assert.match(source, /md:col-span-2 md:col-start-2/);
});

test("five destinations in the owner's order in every language, each with a hero photo; EN regions pinned; three hero photos", async () => {
  const data = await loadTs("lib/data/destinations.ts");
  const slugs = ["cartagena", "medellin", "bogota", "san-andres", "cocora-valley"];
  for (const locale of ["en", "ar", "es"]) {
    const rows = await data.getDestinations(locale, { includeEmpty: true });
    assert.deepEqual(rows.map((r) => r.slug), slugs, locale);
    for (const row of rows) assert.ok(row.hero_image?.url, `${locale} ${row.slug} hero`);
    assert.equal((await data.getDestinationsPageHero(locale)).length, 3, `${locale} hero`);
  }
  const en = await data.getDestinations("en", { includeEmpty: true });
  assert.deepEqual(en.map((r) => r.region), ["Caribbean coast", "Andes", "Andes", "Caribbean", "Coffee region"]);
});
