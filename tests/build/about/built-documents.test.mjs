import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { SITE_ORIGIN, absoluteLocaleUrl, localeAlternates, localeDir } from "../../../lib/locale-path.ts";
import { loadTs } from "../../helpers/load-ts.mjs";

// Plan 03.3-25 Task 2: the three built About documents and their sitemap entries, read from the assembled out/.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs && node --test tests/build/about/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "404.html"))) {
  throw new Error("out/404.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const { ABOUT_PAGE_COPY } = await loadTs("lib/copy/about-page.ts");
const { getAboutBlocks } = await loadTs("lib/data/about.ts");

const PATH = "/about";
const DOCS = { en: "about.html", ar: "ar/about.html", es: "es/about.html" };
const read = (file) => readFileSync(join(OUT, file), "utf8");
const html = Object.fromEntries(Object.entries(DOCS).map(([locale, file]) => [locale, existsSync(join(OUT, file)) ? read(file) : ""]));

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
const mainOf = (doc) => /<main\b[\s\S]*?<\/main>/.exec(doc)?.[0] ?? "";

test("the three About documents exist, and no folder-style index exists", () => {
  for (const file of Object.values(DOCS)) assert.ok(existsSync(join(OUT, file)), file);
  for (const file of ["about/index.html", "ar/about/index.html", "es/about/index.html"]) {
    assert.equal(existsSync(join(OUT, file)), false, file);
  }
});

for (const [locale, doc] of Object.entries(html)) {
  test(`${locale}: a React document, not Framer; lang and dir are in the served bytes`, () => {
    assert.ok(doc.includes("self.__next_f"), "not a React document");
    assert.equal(doc.includes('name="generator" content="Framer'), false);
    const tag = /<html\b[^>]*>/i.exec(doc)?.[0] ?? "";
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
  });

  test(`${locale}: one h1 equal to the hero headline`, async () => {
    const blocks = await getAboutBlocks(locale);
    const h1 = [...doc.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    assert.deepEqual(h1, [blocks.hero.headline]);
  });

  test(`${locale}: canonical and the four hreflang links`, () => {
    const want = localeAlternates(locale, PATH);
    const links = [...doc.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const alternates = links.filter((l) => /hreflang/i.test(l));
    assert.equal(alternates.length, 4);
    assert.deepEqual(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")])), want.languages);
    const canonical = links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l));
    assert.deepEqual(canonical.map((l) => attr(l, "href")), [want.canonical]);
  });

  test(`${locale}: title, description, og:image and the JSON-LD on the site origin`, async () => {
    const blocks = await getAboutBlocks(locale);
    const copy = ABOUT_PAGE_COPY[locale];
    assert.equal(decode(/<title>([^<]*)<\/title>/.exec(doc)?.[1] ?? ""), copy.meta.title);
    assert.equal(decode(/<meta name="description" content="([^"]*)"/.exec(doc)?.[1] ?? ""), copy.meta.description);
    assert.equal(/<meta property="og:image" content="([^"]*)"/.exec(doc)?.[1], blocks.hero.image.url);
    const ld = [...doc.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(ld.length >= 1);
    for (const block of ld) {
      const urls = block.match(/https?:\/\/[^"\s]+/g) ?? [];
      for (const url of urls) {
        if (url.startsWith("https://schema.org")) continue;
        assert.ok(url.startsWith(`${SITE_ORIGIN}/`), `${locale}: JSON-LD url ${url}`);
      }
    }
  });

  test(`${locale}: no foreign host, no video, no form field, no held string`, () => {
    for (const needle of [
      "framerusercontent",
      "catbox",
      "pexels",
      "<video",
      "<form",
      'type="submit"',
      'type="email"',
      "<textarea",
      "partnerships@",
    ]) {
      assert.equal(doc.includes(needle), false, `${locale}: contains ${needle}`);
    }
    // The header's language select is the one <select>: the component's hidden, aria-hidden native twin. None in main.
    assert.equal(/<select\b/.test(mainOf(doc)), false, `${locale}: a select in main`);
    assert.equal((doc.match(/<select\b/g) ?? []).length, 1, `${locale}: selects`);
  });

  test(`${locale}: every <img src> is on the media host; outside main only the nav wordmark and the footer's data: wordmark; no monogram`, async () => {
    const blocks = await getAboutBlocks(locale);
    const main = mainOf(doc);
    const all = [...doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => m[1]);
    const outside = all.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
    for (const src of outside) {
      assert.ok(
        /^\/_next\/static\/media\/Poly_White\.[0-9a-f]+\.svg$/.test(src) || src.startsWith("data:image/svg+xml"),
        `${locale}: unexpected img ${src.slice(0, 80)}`,
      );
    }
    for (const src of [...main.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => m[1])) {
      assert.ok(src.startsWith(`${MEDIA_BASE_URL}/`), `${locale}: main img ${src.slice(0, 80)}`);
    }
    assert.equal(/monogram/i.test(main), false, "monogram in main");
    assert.equal(main.includes("Curves_black"), false, "brand file name in main");
    const hero = /<section\b[\s\S]*?<\/section>/.exec(main)?.[0] ?? "";
    assert.equal(hero.includes("<svg"), false, "svg in the hero");
    const intro = /<[^>]*data-about-intro[\s\S]*?(?=<[^>]*data-about-still)/.exec(main)?.[0] ?? "";
    assert.ok(intro.length > 0, "intro section not found");
    assert.equal(intro.includes("<svg"), false, "svg in the intro section");
    assert.ok(main.includes(blocks.cta_image.url), "the Get In Touch image is in main");
  });
}

test("sitemap: one <url> per About document with the four alternates; no trailing-slash loc", () => {
  const xml = read("sitemap.xml");
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  for (const locale of ["en", "ar", "es"]) {
    const loc = absoluteLocaleUrl(locale, PATH);
    const mine = entries.filter((e) => e.includes(`<loc>${loc}</loc>`));
    assert.equal(mine.length, 1, loc);
    const alternates = [...mine[0].matchAll(/<xhtml:link\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(alternates.length, 4);
    assert.deepEqual(
      Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")])),
      localeAlternates(locale, PATH).languages,
    );
  }
  assert.equal(/<loc>[^<]*\/about\/<\/loc>/.test(xml), false);
});
