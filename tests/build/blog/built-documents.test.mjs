import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BLOG_COPY } from "../../../lib/copy/blog.ts";
import { MEDIA_BASE_URL } from "../../../lib/data/media.ts";
import { localeAlternates, localeDir, localePath } from "../../../lib/locale-path.ts";
import { loadTs } from "../../helpers/load-ts.mjs";

// Plan 03.3-33 Task 1: the twelve built blog documents (list + three posts, three languages), read from the assembled
// out/ folder. Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.
//   node scripts/assemble-cloudflare.mjs && node --test tests/build/blog/built-documents.test.mjs

const OUT = "out";
if (!existsSync(join(OUT, "index.html"))) {
  throw new Error("out/index.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

const posts = await loadTs("lib/data/posts.ts");
const LOCALES = ["en", "ar", "es"];
const SLUGS = await posts.getPostSlugs();

/** [locale, path, file under out/, slug | null] for the 12 documents. */
const DOCS = LOCALES.flatMap((locale) => [
  [locale, "/blog", `${localePath(locale, "/blog").slice(1)}.html`, null],
  ...SLUGS.map((slug) => [locale, `/blog/${slug}`, `${localePath(locale, `/blog/${slug}`).slice(1)}.html`, slug]),
]);

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
const stripTags = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, ""));

test("there are 12 blog documents, three posts exist, and out/blog/index.html does not", () => {
  assert.equal(SLUGS.length, 3);
  assert.equal(DOCS.length, 12);
  for (const [, , file] of DOCS) assert.ok(existsSync(join(OUT, file)), file);
  assert.equal(existsSync(join(OUT, "blog", "index.html")), false);
});

for (const [locale, path, file, slug] of DOCS) {
  const name = `${locale} ${path}`;
  const doc = existsSync(join(OUT, file)) ? readFileSync(join(OUT, file), "utf8") : "";

  test(`${name}: lang and dir are in the served bytes`, () => {
    const tag = /<html\b[^>]*>/i.exec(doc)?.[0] ?? "";
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
  });

  test(`${name}: one h1, canonical and og:url without a slash, four hreflang links`, () => {
    assert.equal((doc.match(/<h1\b/g) ?? []).length, 1);
    const want = localeAlternates(locale, path);
    assert.equal(want.canonical.endsWith("/"), false);
    const links = [...doc.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const alternates = links.filter((l) => /hreflang/i.test(l));
    assert.equal(alternates.length, 4);
    assert.deepEqual(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")])), want.languages);
    assert.deepEqual(
      links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l)).map((l) => attr(l, "href")),
      [want.canonical],
    );
    const ogUrl = /<meta property="og:url" content="([^"]*)"/.exec(doc)?.[1] ?? "";
    assert.equal(ogUrl, want.canonical);
    assert.equal(ogUrl.endsWith("/"), false);
  });

  test(`${name}: og:image on the media host, title and description`, () => {
    const ogImage = /<meta property="og:image" content="([^"]*)"/.exec(doc)?.[1] ?? "";
    assert.ok(ogImage.startsWith(`${MEDIA_BASE_URL}/`), ogImage);
    const title = decode(/<title>([^<]*)<\/title>/.exec(doc)?.[1] ?? "");
    if (slug === null) assert.equal(title, BLOG_COPY[locale].list.meta.title);
    else assert.ok(title.endsWith(" | ALMAR"), title);
  });

  test(`${name}: organisation JSON-LD; BlogPosting only on posts, parseable, in this language, no Person`, () => {
    const blocks = [...doc.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const parsed = blocks.map((b) => JSON.parse(b));
    const org = parsed.filter((d) => Array.isArray(d["@type"]) && d["@type"].includes("Organization"));
    assert.equal(org.length, 1);
    const blogPostings = parsed.filter((d) => d["@type"] === "BlogPosting");
    if (slug === null) {
      assert.equal(blogPostings.length, 0);
      assert.equal(blocks.length, 1);
    } else {
      assert.equal(blogPostings.length, 1);
      assert.equal(blogPostings[0].inLanguage, locale);
      assert.equal(blogPostings[0].url, localeAlternates(locale, path).canonical);
    }
    for (const block of blocks) assert.equal(block.includes("Person"), false);
  });

  test(`${name}: no third-party host, no form field, no submit, no held-control word`, () => {
    for (const needle of ["framerusercontent", "catbox", "pexels", '<input type="email"', 'type="email"', "<textarea"]) {
      assert.equal(doc.includes(needle), false, `${name}: contains ${needle}`);
    }
    // Search is the one submit (the hero bar's), on posts; the list page has none.
    const submits = (doc.match(/type="submit"/g) ?? []).length;
    assert.equal(submits, slug === null ? 0 : 1, `${name}: submit buttons`);
  });

  test(`${name}: every <img src> is on the media host (the nav and footer wordmarks apart)`, () => {
    const srcs = [...doc.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(srcs.length >= 3, `only ${srcs.length} images`);
    const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
    for (const src of outside) {
      assert.ok(/^\/_next\/static\/media\/(Poly_White|Stacked_Charcoal)\.[0-9a-f]+\.svg$/.test(src) || src.startsWith("data:image/svg+xml"), src.slice(0, 80));
    }
  });

  if (slug !== null) {
    test(`${name}: the body text is the data module's body, block by block`, async () => {
      const post = await posts.getPost(locale, slug);
      const text = stripTags(doc);
      for (const block of post.body) assert.ok(text.includes(block.text), `${name}: body block missing: ${block.text.slice(0, 40)}`);
      assert.ok(text.includes(post.title));
      // The no-script document carries the Contact button and the back link as plain anchors.
      assert.ok(doc.includes(`href="${localePath(locale, "/blog")}"`), "back link");
    });
  } else {
    test(`${name}: the list shows every post, newest first`, async () => {
      const all = await posts.getPosts(locale);
      const hrefs = [...doc.matchAll(/<a\b[^>]*href="([^"]*\/blog\/[^"]+)"/g)].map((m) => m[1]);
      const mine = [...new Set(hrefs)].filter((h) => h.startsWith(`${localePath(locale, "/blog")}/`));
      assert.deepEqual(mine, all.map((p) => localePath(locale, `/blog/${p.slug}`)));
    });
  }
}

test("the sitemap lists the 12 blog URLs once each, each with four alternates", () => {
  const xml = readFileSync(join(OUT, "sitemap.xml"), "utf8");
  const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  for (const [locale, path] of DOCS) {
    const loc = localeAlternates(locale, path).canonical;
    const mine = blocks.filter((b) => b.includes(`<loc>${loc}</loc>`));
    assert.equal(mine.length, 1, `${loc} appears ${mine.length} times`);
    assert.equal((mine[0].match(/xhtml:link/g) ?? []).length, 4, `${loc} alternates`);
  }
});
