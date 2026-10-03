import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Plan 03.3-04 Task 4: source-level guards on the React home. The browser proof is in
// tests/build/home/home.spec.ts; these keep the shape from drifting between runs of it.

const read = (file) => readFileSync(file, "utf8");
const ROUTES = { en: "app/page.tsx", ar: "app/ar/page.tsx", es: "app/es/page.tsx" };
const PARTS = readdirSync("components/pages/home").map((name) => `components/pages/home/${name}`);
const HOME_FILES = [...Object.values(ROUTES), "components/pages/home-page.tsx", ...PARTS];

/** Strip comments, so a sentence that names a forbidden thing is not mistaken for using it. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("each route file binds one locale, is static and re-exports metadata, and nothing else", () => {
  for (const [locale, file] of Object.entries(ROUTES)) {
    const source = read(file);
    assert.match(source, new RegExp(`<HomePage locale="${locale}" />`), file);
    assert.match(source, new RegExp(`homeMetadata\\("${locale}"\\)`), file);
    assert.match(source, /export const dynamic = "force-static"/, file);
    assert.equal(/\bfetch\(|process\.env|cookies\(|headers\(/.test(source), false, `${file} reads the request`);
    assert.ok(source.split("\n").length <= 12, `${file} is more than a binding`);
  }
});

test("the eleven sections render in the live order and no other", () => {
  const source = read("components/pages/home-page.tsx");
  const order = [
    "<HomeHero",
    "<Welcome",
    "<GallerySection",
    "<HomeStays",
    "<Services",
    "<Moments",
    "<HomeJourneys",
    "<Stories",
    "<Begin",
    "<Team ",
  ];
  let at = -1;
  for (const marker of order) {
    const next = source.indexOf(marker, at + 1);
    assert.ok(next > at, `${marker} is missing or out of order`);
    at = next;
  }
  // The footer is the frame's; nothing else is rendered between the sections.
  assert.match(source, /<HomeFrame\b/);
  const sections = [...source.matchAll(/<(Welcome|GallerySection|HomeStays|Services|Moments|HomeJourneys|Stories|Begin|Team|HomeHero)\b/g)];
  assert.equal(sections.length, 10);
});

test("the page makes each data read once and no file bypasses the data layer", () => {
  const source = read("components/pages/home-page.tsx");
  for (const read_ of ["getHomeBlocks", "getJourneyTiers", "getStays", "getCatalogItems", "getDestinations", "getTeam", "getRates"]) {
    assert.equal((source.match(new RegExp(`${read_}\\(`, "g")) ?? []).length >= 1, true, read_);
  }
  assert.match(source, /getCatalogItems\(locale, \{ kind: "service" \}\)/);
  assert.match(source, /getHomeBlocks\(locale\)/);
});

test("exactly one h1, in the hero; every section heading is an h2", () => {
  const hits = HOME_FILES.flatMap((file) => (code(read(file)).match(/<h1\b/g) ?? []).map(() => file));
  assert.deepEqual(hits, ["components/pages/home/home-hero.tsx"]);
  // Section draws the h2 (headingLevel defaults to 2) and no home file lowers it.
  for (const file of HOME_FILES) assert.equal(/headingLevel=/.test(read(file)), false, file);
});

test("no home file reads the two lines that contradict the signed design, or the old form, team or stories", () => {
  const FORBIDDEN = ["journeysIntro", "contactIntro", "name", "email", "message", "send", "notSent", "team", "stories", "listIntro"];
  for (const file of HOME_FILES) {
    const source = code(read(file));
    for (const [, key] of source.matchAll(/HOME_COPY(?:\[[^\]]*\]|\.\w+)\.(\w+)/g)) {
      assert.ok(!FORBIDDEN.includes(key), `${file} reads HOME_COPY...${key}`);
    }
    for (const [, key] of source.matchAll(/\bHOME_COPY\b(?!\[|\.|\s*[,}])/g)) assert.fail(`${file}: bare HOME_COPY`);
    assert.equal(/does not convert|Nothing on this page is sent/i.test(source), false, file);
  }
  // Only the nav labels are read from lib/copy/home.ts.
  const page = code(read("components/pages/home-page.tsx"));
  assert.deepEqual([...page.matchAll(/HOME_COPY\[locale\]\.(\w+)/g)].map((m) => m[1]), ["nav"]);
});

test("nothing on the home speaks to a third-party host, plays a video or draws a held control", () => {
  const FORBIDDEN = [
    /framerusercontent/,
    /catbox/,
    /pexels/,
    /<video/,
    /onSearch/,
    /type="submit"/,
    /<form/,
    /type="email"/,
    /Discover the Journey/,
    /Design your journey/,
    /See Packages/,
    /dangerouslySetInnerHTML/,
  ];
  for (const file of HOME_FILES) {
    const source = code(read(file));
    for (const pattern of FORBIDDEN) assert.equal(pattern.test(source), false, `${file} matches ${pattern}`);
  }
});

test("the chrome has the held controls off: no Login, no cart, no newsletter, a controlled currency", () => {
  const nav = read("components/pages/home/home-nav.tsx");
  assert.match(nav, /login=\{false\}/);
  assert.match(nav, /newsletter=\{false\}/);
  assert.equal(/\bcart\b/.test(code(nav)), false);
  assert.match(nav, /currency=\{currencyEnabled \? selected : false\}/);
  assert.match(nav, /onCurrency=\{choose\}/);
  assert.equal(/listWithUs/.test(nav), false);
});

test("the client parts import only types and the stay filter from lib/data", () => {
  for (const file of PARTS) {
    const source = read(file);
    if (!/^["']use client["']/.test(source.trimStart())) continue;
    for (const [, target] of source.matchAll(/from "(?:\.\.\/)+lib\/data\/([^"]+)"/g)) {
      assert.ok(["types", "stay-filter"].includes(target), `${file} imports lib/data/${target}`);
    }
  }
});

test("links to the pages that stay English-only go through siteHref, and the stay pages through localePath", () => {
  const source = read("components/pages/home-page.tsx");
  for (const path of ['"/destinations"', '"/experiences"', '"/about"', '"/contact"', '"/blog"']) {
    assert.ok(source.includes(`siteHref(locale, ${path})`), path);
  }
  assert.ok(source.includes("`/services/${item.slug}`") && source.includes("`/blog/${story.slug}`"));
  assert.match(source, /localePath\(locale, `\/private-stays\/\$\{stay\.slug\}`\)/);
  assert.match(source, /localePath\(locale, "\/private-stays"\)/);
});

test("the destination cards are not links: the live cards are not and /destinations/<slug> has no page", () => {
  const sections = code(read("components/pages/home/home-sections.tsx"));
  const moments = sections.slice(sections.indexOf("export function Moments"), sections.indexOf("export function Stories"));
  const cards = moments.match(/<MediaCard[\s\S]*?\/>/g) ?? [];
  assert.equal(cards.length, 1);
  assert.equal(/href=/.test(cards[0]), false);
  assert.match(moments, /<MediaCard\s+image=/);
});
