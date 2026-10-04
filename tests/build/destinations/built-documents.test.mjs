import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DESTINATIONS_PAGE_COPY } from "../../../lib/copy/destinations-page.ts";
import { HOME_COPY } from "../../../lib/copy/home.ts";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { absoluteLocaleUrl, localeAlternates, localeDir, localePath } from "../../../lib/locale-path.ts";
import { loadTs } from "../../helpers/load-ts.mjs";

// Plan 03.3-13 Task 3: the three built /destinations documents, read from the assembled out/ folder.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs --target=local && node --test tests/build/destinations/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "destinations.html"))) {
  throw new Error("out/destinations.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const PATH = "/destinations";
const DOCS = { en: "destinations.html", ar: "ar/destinations.html", es: "es/destinations.html" };
const html = Object.fromEntries(Object.entries(DOCS).map(([locale, file]) => [locale, readFileSync(join(OUT, file), "utf8")]));
const data = await loadTs("lib/data/destinations.ts");

const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const text = (fragment) => decode(fragment.replace(/<[^>]+>/g, "")).trim();
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : null;
};

for (const [locale, doc] of Object.entries(html)) {
  const copy = DESTINATIONS_PAGE_COPY[locale];

  test(`${locale}: a React document with lang and dir in the served bytes`, async () => {
    assert.ok(doc.includes("self.__next_f"), "not a React document");
    const tag = /<html\b[^>]*>/i.exec(doc)?.[0] ?? "";
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
  });

  test(`${locale}: one h1 with the heading, the kicker, no paragraph between the hero and the cards`, () => {
    const h1 = [...doc.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
    assert.deepEqual(h1, [copy.heading]);
    assert.ok(doc.includes(`>${copy.kicker}</p>`), "kicker");
    const afterHero = doc.slice(doc.indexOf("</section>", doc.indexOf('aria-roledescription="carousel"')), doc.indexOf('<ul role="list"'));
    assert.equal(/<p\b/.test(afterHero), false, "an intro sentence");
  });

  test(`${locale}: title, description, canonical, four hreflang, og:url, one Organization block`, () => {
    assert.equal(decode(/<title>([^<]*)<\/title>/.exec(doc)?.[1] ?? ""), copy.meta.title);
    assert.equal(decode(/<meta name="description" content="([^"]*)"/.exec(doc)?.[1] ?? ""), copy.meta.description);
    const want = localeAlternates(locale, PATH);
    const links = [...doc.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const alternates = links.filter((l) => /hreflang/i.test(l));
    assert.equal(alternates.length, 4);
    assert.deepEqual(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")])), want.languages);
    assert.deepEqual(links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l)).map((l) => attr(l, "href")), [want.canonical]);
    assert.equal(/<meta property="og:url" content="([^"]*)"/.exec(doc)?.[1], absoluteLocaleUrl(locale, PATH));
    const blocks = [...doc.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(blocks.length, 1);
    const urls = [...blocks[0].matchAll(/"(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith("https://schema.org"));
    for (const url of urls) assert.ok(url.startsWith("https://almarprivatejourney.com/"), url);
  });

  test(`${locale}: three hero images, five non-link cards in one list, names and regions from the data layer`, async () => {
    const hero = await data.getDestinationsPageHero(locale);
    const rows = await data.getDestinations(locale, { includeEmpty: true });
    const section = /<section\b[^>]*aria-roledescription="carousel"[\s\S]*?<\/section>/.exec(doc)?.[0] ?? "";
    const heroSrcs = [...section.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => decode(m[1]));
    assert.deepEqual(heroSrcs, hero.map((h) => h.url));
    assert.equal(/<button\b/.test(section), false, "a control in the served hero");

    const lists = [...doc.matchAll(/<ul role="list"[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => m[1]);
    assert.equal(lists.length, 1);
    assert.equal(/<a\b|<button\b/.test(lists[0]), false, "a link or button inside the list");
    const cards = [...lists[0].matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => m[0]);
    assert.equal(cards.length, 5);
    cards.forEach((card, i) => {
      const spans = [...card.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1])).filter(Boolean);
      assert.ok(spans.includes(rows[i].name), `${locale} card ${i} name`);
      assert.ok(spans.some((s) => s.includes(rows[i].region)), `${locale} card ${i} region`);
      assert.ok(card.includes("<svg"), "pin icon");
      assert.equal(decode(/<img\b[^>]*?\ssrc="([^"]+)"/.exec(card)?.[1] ?? ""), rows[i].hero_image.url);
    });
  });

  test(`${locale}: every image and og:image is on the media host; nothing from the Framer hosts`, () => {
    const srcs = [...doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => decode(m[1]));
    const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
    // The nav wordmark (repo file) and the footer wordmark (data: URI), as on the home page.
    assert.equal(outside.length, 2, outside.map((s) => s.slice(0, 60)).join(", "));
    assert.ok((/<meta property="og:image" content="([^"]*)"/.exec(doc)?.[1] ?? "").startsWith(`${MEDIA_BASE_URL}/`));
    for (const needle of ["framerusercontent", "files.catbox.moe", "catbox", "videos.pexels.com", "pexels"])
      assert.equal(doc.includes(needle), false, needle);
  });

  test(`${locale}: nothing is hidden in the served markup (the start state is script-only)`, () => {
    const tags = [...doc.matchAll(/<[a-z0-9]+\b[^>]*\sdata-reveal="[^"]*"[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length >= 7, `${tags.length} reveal elements`);
    for (const tag of tags) {
      const style = attr(tag, "style") ?? "";
      assert.equal(/opacity|translate|transform/.test(style), false, tag);
      for (const token of (attr(tag, "class") ?? "").split(/\s+/)) {
        if (token.startsWith("pre-reveal:")) continue;
        assert.equal(/^-?(opacity-0|translate-|scale-)/.test(token), false, `${token} in ${tag}`);
      }
    }
  });

  test(`${locale}: the Destinations nav link marks the page; no link into a destination page; no held control`, () => {
    const current = [...doc.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    assert.ok(current.length >= 1, "no aria-current link");
    for (const tag of current) assert.equal(attr(tag, "href"), localePath(locale, PATH), tag);
    for (const needle of [
      'href="/destinations/',
      'href="/ar/destinations/',
      'href="/es/destinations/',
      "Eje Cafetero",
      "Three exclusive packages",
      "<form",
      'type="submit"',
      'type="email"',
    ])
      assert.equal(doc.includes(needle), false, needle);
    const names = [HOME_COPY[locale].nav.login, HOME_COPY[locale].listTitle, HOME_COPY[locale].subscribe, HOME_COPY[locale].newsletter];
    const controls = [...doc.matchAll(/<(?:a|button)\b[^>]*>([^<]*)</g)].map((m) => decode(m[1]).trim());
    for (const name of names) assert.equal(controls.includes(name), false, `a control named ${name}`);
  });
}
