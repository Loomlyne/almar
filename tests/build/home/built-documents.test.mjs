import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { HOME_COPY } from "../../../lib/copy/home.ts";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page.ts";
import { JOURNEY_COPY } from "../../../lib/copy/journey.ts";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { localeAlternates, localeDir } from "../../../lib/locale-path.ts";

// Plan 03.3-04 Task 5: the three built home documents, read from the assembled out/ folder.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs && node --test tests/build/home/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "index.html"))) {
  throw new Error("out/index.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const DOCS = { en: "index.html", ar: "ar/index.html", es: "es/index.html" };
const html = Object.fromEntries(Object.entries(DOCS).map(([locale, file]) => [locale, readFileSync(join(OUT, file), "utf8")]));

const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : null;
};

// The live Organization block, byte for byte (carried from the Framer home into plan 03's helper).
const LIVE_JSON_LD =
  '{"@context":"https://schema.org","@type":["Organization","TravelAgency"],"@id":"https://almarprivatejourney.com/#organization","name":"ALMAR Private Journeys","url":"https://almarprivatejourney.com/","description":"Private journeys in Colombia.","areaServed":{"@type":"Country","name":"Colombia"}}';

test("the three home documents exist and no flat out/ar.html or out/es.html does", () => {
  for (const file of Object.values(DOCS)) assert.ok(existsSync(join(OUT, file)), file);
  for (const file of ["ar.html", "es.html"]) assert.equal(existsSync(join(OUT, file)), false, file);
});

for (const [locale, doc] of Object.entries(html)) {
  const copy = HOME_PAGE_COPY[locale];

  test(`${locale}: lang and dir are in the served bytes`, () => {
    const tag = /<html\b[^>]*>/i.exec(doc)?.[0] ?? "";
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
  });

  test(`${locale}: one h1, eight h2, the sections in the live order`, () => {
    assert.equal((doc.match(/<h1\b/g) ?? []).length, 1);
    const h2 = [...doc.matchAll(/<h2\b[^>]*>(.*?)<\/h2>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    assert.equal(h2.length, 8, h2.join(" | "));
    // welcome and gallery headings come from lib/data; the other six from the home copy file.
    assert.deepEqual(h2.slice(2), [
      copy.stays.heading,
      copy.services.heading,
      copy.moments.heading,
      copy.journeys.heading,
      copy.stories.heading,
      copy.begin.heading,
    ]);
    // Zero published team members: no kicker, no heading.
    assert.equal(doc.includes(decode(copy.team.heading)) || doc.includes(copy.team.kicker), false);
  });

  test(`${locale}: the three accepted prices are the published text, byte for byte`, () => {
    const prices = [...doc.matchAll(/<p data-price="[a-z-]+"[^>]*><bdi[^>]*>([^<]*)<\/bdi><\/p>/g)].map((m) => decode(m[1]));
    assert.deepEqual(prices, HOME_COPY[locale].journeys.map((tier) => tier.price));
    assert.deepEqual(prices, HOME_COPY.en.journeys.map((tier) => tier.price));
  });

  test(`${locale}: canonical and the four hreflang links`, () => {
    const want = localeAlternates(locale, "/");
    const links = [...doc.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const alternates = links.filter((l) => /hreflang/i.test(l));
    assert.equal(alternates.length, 4);
    assert.deepEqual(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")])), want.languages);
    const canonical = links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l));
    assert.deepEqual(canonical.map((l) => attr(l, "href")), [want.canonical]);
  });

  test(`${locale}: title, description and the Organization JSON-LD`, () => {
    assert.equal(decode(/<title>([^<]*)<\/title>/.exec(doc)?.[1] ?? ""), copy.meta.title);
    const description = /<meta name="description" content="([^"]*)"/.exec(doc)?.[1] ?? "";
    assert.equal(decode(description), copy.meta.description);
    const blocks = [...doc.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.deepEqual(blocks, [LIVE_JSON_LD]);
    const ogImage = /<meta property="og:image" content="([^"]*)"/.exec(doc)?.[1] ?? "";
    assert.ok(ogImage.startsWith(`${MEDIA_BASE_URL}/`), ogImage);
  });

  test(`${locale}: the bar's search form is the only form and its Search the only submit (plan 03.3-43)`, () => {
    const forms = doc.match(/<form\b[^>]*>/g) ?? [];
    assert.equal(forms.length, 1, `${locale}: ${forms.length} forms`);
    assert.match(forms[0], /role="search"/);
    assert.equal((doc.match(/type="submit"/g) ?? []).length, 1, `${locale}: submit buttons`);
    const bar = /<form\b[^>]*role="search"[^>]*>([\s\S]*?)<\/form>/.exec(doc)?.[1] ?? "";
    assert.ok(bar.includes('type="submit"'), `${locale}: the submit is not inside the search form`);
    assert.ok(bar.includes(decode(JOURNEY_COPY[locale].bar.search)), `${locale}: the submit is not named Search`);
  });

  test(`${locale}: no third-party host, no video, no other form, no contradicting line`, () => {
    for (const needle of [
      "framerusercontent",
      "files.catbox.moe",
      "catbox",
      "videos.pexels.com",
      "pexels",
      "<video",
      'type="email"',
      "does not convert",
      "Nothing on this page is sent",
      "Discover the Journey",
      "Design your journey",
      "See Packages",
    ]) {
      assert.equal(doc.includes(needle), false, `${locale}: contains ${needle}`);
    }
  });

  test(`${locale}: every <img src> is on the media host; only the nav wordmark (repo file) and the footer wordmark (data: URI) are not`, () => {
    const srcs = [...doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(srcs.length > 30, `only ${srcs.length} images`);
    const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
    assert.equal(outside.length, 2, outside.map((src) => src.slice(0, 80)).join(", "));
    assert.equal(outside.filter((src) => /^\/_next\/static\/media\/Poly_White\.[0-9a-f]+\.svg$/.test(src)).length, 1);
    assert.equal(outside.filter((src) => src.startsWith("data:image/svg+xml")).length, 1);
  });

  test(`${locale}: the held controls are not in the markup`, () => {
    // Login, cart, newsletter email, Subscribe, List with us: asserted by name in the page's own language.
    const names = [HOME_COPY[locale].nav.login, HOME_COPY[locale].listTitle, HOME_COPY[locale].subscribe, HOME_COPY[locale].newsletter];
    for (const name of names) {
      const links = [...doc.matchAll(/<(?:a|button)\b[^>]*>([^<]*)</g)].map((m) => decode(m[1]).trim());
      assert.equal(links.includes(name), false, `${locale}: a control named ${name}`);
    }
  });
}
