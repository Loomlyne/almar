import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EXPERIENCES_PAGE_COPY } from "../../../lib/copy/experiences-page.ts";
import { HOME_COPY } from "../../../lib/copy/home.ts";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { absoluteLocaleUrl, localeAlternates, localeDir, localePath } from "../../../lib/locale-path.ts";

// Plan 03.3-14 Task 7: the three built /experiences documents, read from the assembled out/ folder.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs --target=local && node --test tests/build/experiences/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "experiences.html"))) {
  throw new Error("out/experiences.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const PATH = "/experiences";
const DOCS = { en: "experiences.html", ar: "ar/experiences.html", es: "es/experiences.html" };
const html = Object.fromEntries(Object.entries(DOCS).map(([locale, file]) => [locale, readFileSync(join(OUT, file), "utf8")]));

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
/** What a visitor reads: no scripts (the Next payload), no comments (React's <!--$--> markers), no tags. */
const visible = (doc) => text(doc.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, ""));

for (const [locale, doc] of Object.entries(html)) {
  const copy = EXPERIENCES_PAGE_COPY[locale];

  test(`${locale}: a React document with lang and dir in the served bytes`, () => {
    assert.ok(doc.includes("self.__next_f"), "not a React document");
    const tag = /<html\b[^>]*>/i.exec(doc)?.[0] ?? "";
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
  });

  test(`${locale}: one h1 with the heading; two group h2s; the count line is polite and live`, () => {
    const h1 = [...doc.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
    assert.deepEqual(h1, [copy.heading]);
    const h2 = [...doc.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
    assert.equal(h2.length, 2);
    assert.ok(h2[0].startsWith(copy.groups.experiences) && h2[0].endsWith("35"), h2[0]);
    assert.ok(h2[1].startsWith(copy.groups.services) && h2[1].endsWith("10"), h2[1]);
    assert.equal((doc.match(/<p aria-live="polite"/g) ?? []).length, 1);
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

  test(`${locale}: exactly 45 card buttons, 35 then 10, none a link; no route, no form, no price`, () => {
    const buttons = [...doc.matchAll(/<button\b[^>]*aria-haspopup="dialog"[^>]*>/g)];
    assert.equal(buttons.length, 45);
    const sections = doc.split("<section ").slice(1);
    assert.equal(sections.length, 2);
    assert.equal((sections[0].match(/aria-haspopup="dialog"/g) ?? []).length, 35);
    assert.equal((sections[1].match(/aria-haspopup="dialog"/g) ?? []).length, 10);
    const shown = visible(doc);
    for (const needle of [
      'href="/experiences/',
      'href="/ar/experiences/',
      'href="/es/experiences/',
      'href="/services',
      "framerusercontent",
      "files.catbox.moe",
      "catbox",
      "videos.pexels.com",
      "pexels",
      'type="submit"',
      "<form",
      "per person",
    ])
      assert.equal(doc.includes(needle), false, needle);
    assert.equal(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(shown), false, "a currency in the visible text");
  });

  test(`${locale}: every picture is on the media host (the two wordmarks aside); the card pictures are 45`, () => {
    const srcs = [...doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => decode(m[1]));
    const onHost = srcs.filter((src) => src.startsWith(`${MEDIA_BASE_URL}/`));
    assert.equal(onHost.length, 45);
    const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
    // The nav wordmark (a repo file) and the footer wordmark (a data: URI), as on the home page.
    assert.equal(outside.length, 2, outside.map((s) => s.slice(0, 60)).join(", "));
    assert.ok((/<meta property="og:image" content="([^"]*)"/.exec(doc)?.[1] ?? "").startsWith(`${MEDIA_BASE_URL}/`));
  });

  test(`${locale}: the noscript rule is in the served bytes`, () => {
    assert.ok(
      doc.includes(
        "<noscript><style>[data-catalog-filters]{display:none}[data-clamp]{display:block;-webkit-line-clamp:unset;overflow:visible}</style></noscript>",
      ),
    );
    assert.ok(doc.includes("data-catalog-filters"));
  });

  test(`${locale}: the Experiences link marks the page; no held control by name`, () => {
    const current = [...doc.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
    assert.ok(current.length >= 1, "no aria-current link");
    for (const tag of current) assert.equal(attr(tag, "href"), localePath(locale, PATH), tag);
    const names = [HOME_COPY[locale].nav.login, HOME_COPY[locale].listTitle, HOME_COPY[locale].subscribe, HOME_COPY[locale].newsletter];
    const controls = [...doc.matchAll(/<(?:a|button)\b[^>]*>([^<]*)</g)].map((m) => decode(m[1]).trim());
    for (const name of names) assert.equal(controls.includes(name), false, `a control named ${name}`);
  });
}
