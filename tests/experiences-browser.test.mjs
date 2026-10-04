// The /experiences catalogue as the server renders it (phase 3.3 plan 14, tasks 4 and 5): CatalogBrowser with the real 45 items
// in each locale, and the pure parts of the overlay (overlayKicker, ItemDetail). Overlay and filter behaviour in a browser is
// proven by tests/build/experiences/*.spec.ts; this file proves what a visitor with JavaScript off sees and what hydration
// must match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";
import { EXPERIENCES_PAGE_COPY } from "../lib/copy/experiences-page.ts";
import { formatPlural } from "../lib/journey-format.ts";

const experiencesMod = await loadTs("lib/data/experiences.ts");
const destinationsMod = await loadTs("lib/data/destinations.ts");
const staysMod = await loadTs("lib/data/stays.ts");
const { getCatalogItems } = experiencesMod;
const { getDestinations } = destinationsMod;
const { getStays } = staysMod;

const LOCALES = ["en", "ar", "es"];

/** Bundles the three exports under test with React and renders them on the server, as `next build` does. */
async function loadRenderer() {
  const out = await build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToString } from "react-dom/server";
        import { CatalogBrowser } from "./components/pages/experiences/catalog-browser";
        import { ItemDetail, overlayKicker } from "./components/pages/experiences/item-overlay";
        export const renderBrowser = (props) => renderToString(createElement(CatalogBrowser, props));
        export const renderDetail = (props) => renderToString(createElement(ItemDetail, props));
        export { overlayKicker };
      `,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-catalog-browser-")), "render.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return createRequire(file)(file);
}

const { renderBrowser, renderDetail, overlayKicker } = await loadRenderer();

/** React's hydration markers between adjacent text nodes are not content. */
const plain = (html) => html.replace(/<!-- -->/g, "");

async function props(locale) {
  const [items, destinations, stays] = await Promise.all([
    getCatalogItems(locale),
    getDestinations(locale, { includeEmpty: true }),
    getStays(locale),
  ]);
  const used = new Set(items.flatMap((i) => i.stay_slugs));
  const offeredStays = stays.filter((s) => used.has(s.slug));
  return {
    items,
    destinations,
    stays,
    props: {
      locale,
      items: items.map((i) => ({
        slug: i.slug,
        kind: i.kind,
        name: i.name,
        summary: i.summary,
        duration_label: i.duration_label,
        destination_slugs: i.destination_slugs,
        stay_slugs: i.stay_slugs,
        image: { src: i.image.url, alt: i.image.alt },
      })),
      destinations: destinations.map((d) => ({ slug: d.slug, name: d.name })),
      stays: offeredStays.map((s) => ({ slug: s.slug, title: s.title, destination_slug: s.destination_slug })),
      stayHrefs: Object.fromEntries(stays.map((s) => [s.slug, `/private-stays/${s.slug}`])),
      inquiryHref: "/contact",
      basePath: "/experiences",
      copy: EXPERIENCES_PAGE_COPY[locale],
    },
  };
}

const board = readFileSync(".planning/design/2026-10-01-canvas/boards/PublicExperiences.dc.html", "utf8");
const boardWord = (key, locale) => JSON.parse(board.match(new RegExp(`"${key}":(\\{[^}]*\\})`))[1])[locale];
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

for (const locale of LOCALES) {
  test(`the served catalogue: 45 card buttons in two groups, 35 then 10, in position order (${locale})`, async () => {
    const { items, props: p } = await props(locale);
    const html = plain(renderBrowser(p));
    assert.equal(items.length, 45);

    const buttons = [...html.matchAll(/<button\b[^>]*aria-haspopup="dialog"[^>]*>/g)];
    assert.equal(buttons.length, 45, "one button per card");

    const sections = html.split("<section ").slice(1);
    assert.equal(sections.length, 2, "two groups");
    const copy = EXPERIENCES_PAGE_COPY[locale];
    const names = (section) =>
      [...section.matchAll(/<button\b[^>]*aria-haspopup="dialog"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    assert.deepEqual(names(sections[0]), items.filter((i) => i.kind === "experience").map((i) => escape(i.name)));
    assert.deepEqual(names(sections[1]), items.filter((i) => i.kind === "service").map((i) => escape(i.name)));
    assert.equal(names(sections[0]).length, 35);
    assert.equal(names(sections[1]).length, 10);

    const h2 = [...html.matchAll(/<h2\b[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
    assert.equal(h2.length, 2, "two group heads and nothing else is an h2");
    assert.ok(h2[0].includes(copy.groups.experiences) && h2[0].includes(">35<"), h2[0]);
    assert.ok(h2[1].includes(copy.groups.services) && h2[1].includes(">10<"), h2[1]);

    assert.match(html, new RegExp(`<p aria-live="polite"[^>]*>${formatPlural(copy.count, 45, locale)}</p>`));
    assert.ok(html.includes("data-catalog-filters"), "the noscript rule has something to hide");
    assert.equal((html.match(/data-clamp=""/g) ?? []).length, 45);
    assert.equal(html.includes(copy.clear), false, "no Clear filters while nothing is filtered");
    assert.equal(/role="dialog"/.test(html), false, "no open dialog");
    assert.equal(html.includes("<form"), false, "no form");
    assert.equal(html.includes('type="submit"'), false, "no submit");
    assert.equal(html.includes('href="/experiences/'), false);
    assert.equal(html.includes('href="/services'), false);
    assert.equal(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(html), false, "no currency");
    assert.equal(/per person/i.test(html), false);
    assert.equal(html.includes(`>${boardWord("k38", locale)}<`), false, "no Add button");
    assert.equal(html.includes('type="radio"'), false);
  });

  test(`every card's picture is the item's own, with its own alt (${locale})`, async () => {
    const { items, props: p } = await props(locale);
    const html = plain(renderBrowser(p));
    for (const item of items) {
      const tag = `<img src="${escape(item.image.url)}" alt="${escape(item.image.alt)}"`;
      assert.ok(html.includes(tag), `${locale} ${item.slug}: ${tag}`);
    }
  });
}

test("the first render is the unfiltered list whatever the address says (state starts empty, the URL is read after mount)", () => {
  const source = readFileSync("components/pages/experiences/catalog-browser.tsx", "utf8");
  assert.match(source, /useState<CatalogState>\(EMPTY_STATE\)/);
  assert.match(source, /useEffect\(/);
  assert.match(source, /window\.location\.search/);
  assert.match(source, /history\.replaceState/);
  assert.ok(!/useRouter|useSearchParams|usePathname|next\/navigation/.test(source));
});

// ---- the overlay's pure parts (task 5) -----------------------------------------------------------------------------------

async function detailFor(locale, slug) {
  const { items, destinations, stays, props: p } = await props(locale);
  const item = p.items.find((i) => i.slug === slug);
  assert.ok(item, slug);
  return {
    item,
    full: items.find((i) => i.slug === slug),
    destinationNames: Object.fromEntries(destinations.map((d) => [d.slug, d.name])),
    stayNames: Object.fromEntries(stays.map((s) => [s.slug, s.title])),
    stayHrefs: p.stayHrefs,
    copy: p.copy,
    names: { destinations },
  };
}

test("overlayKicker: the type word, then each place in order joined with ' · '; the type alone with no place", async () => {
  const a = await detailFor("en", "cartagena-heritage-tours");
  assert.equal(overlayKicker(a.item, a.copy, a.destinationNames), "Experience · Cartagena");
  const b = await detailFor("en", "vip-airport-meet-greet");
  assert.equal(overlayKicker(b.item, b.copy, b.destinationNames), "Service · Cartagena · Medellín");
  const c = await detailFor("en", "amazon-rainforest-expedition");
  assert.equal(overlayKicker(c.item, c.copy, c.destinationNames), "Experience");
  const d = await detailFor("en", "helicopter-city-tours");
  assert.equal(overlayKicker(d.item, d.copy, d.destinationNames).split(" · ").length, 4, "the type word and three places");
  for (const locale of ["ar", "es"]) {
    const x = await detailFor(locale, "vip-airport-meet-greet");
    const want = [x.copy.overlay.service, ...x.full.destination_slugs.map((s) => x.destinationNames[s])].join(" · ");
    assert.equal(overlayKicker(x.item, x.copy, x.destinationNames), want, locale);
    const y = await detailFor(locale, "amazon-rainforest-expedition");
    assert.equal(overlayKicker(y.item, y.copy, y.destinationNames), y.copy.overlay.experience, locale);
  }
});

function detailHtml(x) {
  return plain(
    renderDetail({
      item: x.item,
      copy: x.copy,
      destinationNames: x.destinationNames,
      stayNames: x.stayNames,
      stayHrefs: x.stayHrefs,
    }),
  );
}

for (const locale of LOCALES) {
  test(`ItemDetail: full text, Duration only when published, one stay link per stay with the localised href (${locale})`, async () => {
    const heritage = await detailFor(locale, "cartagena-heritage-tours");
    const html = detailHtml(heritage);
    assert.ok(html.includes(escape(heritage.item.summary)), "the full published paragraph");
    assert.ok(!html.includes("line-clamp"), "no clamp in the overlay");
    assert.ok(html.includes(`>${heritage.copy.overlay.duration}<`), "Duration row");
    assert.ok(html.includes(escape(heritage.item.duration_label)));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
    assert.equal(links.length, heritage.item.stay_slugs.length);
    assert.deepEqual(links.map((m) => m[1]), heritage.item.stay_slugs.map((s) => heritage.stayHrefs[s]));
    assert.deepEqual(links.map((m) => m[2]), heritage.item.stay_slugs.map((s) => escape(heritage.stayNames[s])));
    assert.ok(html.includes(`>${heritage.copy.overlay.stays}<`), "Private stays row");

    const vip = await detailFor(locale, "vip-airport-meet-greet");
    const vipHtml = detailHtml(vip);
    assert.equal(vipHtml.includes(`>${vip.copy.overlay.duration}<`), false, "no Duration row for a service");
    assert.equal([...vipHtml.matchAll(/<a\b/g)].length, 12, "12 stay links");

    const amazon = await detailFor(locale, "amazon-rainforest-expedition");
    const amazonHtml = detailHtml(amazon);
    assert.ok(amazonHtml.includes(`>${amazon.copy.overlay.duration}<`));
    assert.equal(amazonHtml.includes(`>${amazon.copy.overlay.stays}<`), false, "no Private stays row without stays");
    assert.equal(/<a\b/.test(amazonHtml), false);

    for (const x of [heritage, vip, amazon]) {
      const h = detailHtml(x);
      assert.equal(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(h), false, "no currency");
      assert.equal(/per person|Details|Add to cart|price/i.test(h), false);
    }
  });
}
