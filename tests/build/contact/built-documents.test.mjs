import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { SITE_ORIGIN, absoluteLocaleUrl, localeAlternates, localeDir } from "../../../lib/locale-path.ts";
import { loadTs } from "../../helpers/load-ts.mjs";

// Plan 03.3-25 Task 3: the three built Contact documents and their sitemap entries, read from the assembled out/.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs && node --test tests/build/contact/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "404.html"))) {
  throw new Error("out/404.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const { CONTACT_PAGE_COPY } = await loadTs("lib/copy/contact-page.ts");
const { getContactDetails } = await loadTs("lib/data/contact.ts");

const PATH = "/contact";
const DOCS = { en: "contact.html", ar: "ar/contact.html", es: "es/contact.html" };
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

test("the three Contact documents exist, and no folder-style index exists", () => {
  for (const file of Object.values(DOCS)) assert.ok(existsSync(join(OUT, file)), file);
  for (const file of ["contact/index.html", "ar/contact/index.html", "es/contact/index.html"]) {
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

  test(`${locale}: one h1 equal to the page title`, () => {
    const h1 = [...doc.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    assert.deepEqual(h1, [CONTACT_PAGE_COPY[locale].title.heading]);
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

  test(`${locale}: title and description from the copy, no og:image, JSON-LD on the site origin`, () => {
    const copy = CONTACT_PAGE_COPY[locale];
    assert.equal(decode(/<title>([^<]*)<\/title>/.exec(doc)?.[1] ?? ""), copy.meta.title);
    assert.equal(decode(/<meta name="description" content="([^"]*)"/.exec(doc)?.[1] ?? ""), copy.meta.description);
    assert.equal(/<meta property="og:image"/.test(doc), false, "Contact has no og:image (design 5.2)");
    const ld = [...doc.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(ld.length >= 1);
    for (const block of ld) {
      for (const url of block.match(/https?:\/\/[^"\s]+/g) ?? []) {
        if (url.startsWith("https://schema.org")) continue;
        assert.ok(url.startsWith(`${SITE_ORIGIN}/`), `${locale}: JSON-LD url ${url}`);
      }
    }
  });

  test(`${locale}: the published email, phone and tel: link are in the bytes, and no other tel:, no partnerships@`, async () => {
    const d = await getContactDetails(locale);
    assert.equal(d.email, "inquiries@almarprivatejourney.com");
    assert.equal(d.phone_display, "+971 56 388 3302");
    assert.ok(doc.includes("inquiries@almarprivatejourney.com"));
    assert.ok(doc.includes("+971 56 388 3302"));
    assert.ok(doc.includes("tel:+971563883302"));
    for (const m of doc.matchAll(/tel:[^"\\<\s]*/g)) assert.equal(m[0], "tel:+971563883302", `${locale}: ${m[0]}`);
    assert.equal(doc.includes("partnerships@"), false);
  });

  test(`${locale}: no foreign host, no video, no form field`, () => {
    for (const needle of ["framerusercontent", "catbox", "pexels", "<video", "<form", 'type="submit"', 'type="email"', "<textarea"]) {
      assert.equal(doc.includes(needle), false, `${locale}: contains ${needle}`);
    }
    // The header's language select is the one <select>: the component's hidden, aria-hidden native twin. None in main.
    assert.equal(/<select\b/.test(mainOf(doc)), false, `${locale}: a select in main`);
    assert.equal((doc.match(/<select\b/g) ?? []).length, 1, `${locale}: selects`);
  });

  test(`${locale}: no <img> in main; outside it only the nav wordmark and the footer's data: wordmark`, () => {
    assert.equal(/<img\b/.test(mainOf(doc)), false, `${locale}: an img in main`);
    for (const m of doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)) {
      const src = m[1];
      assert.ok(
        src.startsWith(`${MEDIA_BASE_URL}/`) || /^\/_next\/static\/media\//.test(src) || src.startsWith("data:image/svg+xml"),
        `${locale}: unexpected img ${src.slice(0, 80)}`,
      );
    }
  });
}

test("sitemap: one <url> per Contact document with the four alternates; no trailing-slash loc", () => {
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
  assert.equal(/<loc>[^<]*\/contact\/<\/loc>/.test(xml), false);
});
