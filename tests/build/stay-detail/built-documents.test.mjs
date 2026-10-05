import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "../../helpers/load-ts.mjs";
import { HIDDEN } from "../../helpers/site-links.mjs";

// Plan 03.3-06 tasks 3 and 5, byte layer. Run explicitly after `npm run build` (it is not matched by
// tests/*.test.mjs, so the hand-over's node step, which runs before the build, is unaffected):
//
//   node --test tests/build/stay-detail/built-documents.test.mjs
//
// It reads the 36 prerendered stay documents byte for byte, and every file the build emitted. When an assembled
// out/ exists (plans 03 and 08 assemble it) the same checks follow the documents there.

const { getStaySlugs } = await loadTs("lib/data/stays.ts");
const { MEDIA_BASE_URL } = await loadTs("lib/data/media.ts");
const SLUGS = await getStaySlugs();
const PREFIXES = ["", "ar/", "es/"];
const HIDDEN_SLUGS = HIDDEN.filter((p) => p.startsWith("/private-stays/")).map((p) => p.split("/").pop());

const BUILT = ".next/server/app";
const OUT = "out";
const haveBuild = existsSync(BUILT) && existsSync(".next/static");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Binary-safe: latin1 keeps every byte, so an ASCII word is found in a font or an image too. */
const bytes = (file) => readFileSync(file).toString("latin1");

function stayDocuments(root) {
  return PREFIXES.flatMap((prefix) => SLUGS.map((slug) => ({ prefix, slug, file: join(root, `${prefix}private-stays`, `${slug}.html`) })));
}

const MARIVEN = /mariven/i;
const SENTENCE = "From cozy beachfront rooms";

const ROOTS = [
  { name: ".next/server/app", root: BUILT, present: () => haveBuild },
  { name: "out/", root: OUT, present: () => existsSync(join(OUT, "index.html")) },
];

test("the build exists (run npm run build first)", () => {
  assert.ok(haveBuild, "no .next/server/app and .next/static: run `npm run build` first");
});

for (const { name, root, present } of ROOTS) {
  const run = { skip: present() ? false : `${name} does not exist` };

  test(`${name}: exactly the 36 stay documents, none for a hidden slug`, run, () => {
    for (const prefix of PREFIXES) {
      const dir = join(root, `${prefix}private-stays`);
      const found = readdirSync(dir)
        .filter((f) => f.endsWith(".html"))
        .map((f) => f.slice(0, -5))
        .sort();
      assert.deepEqual(found, [...SLUGS].sort(), `${prefix || "en/"}private-stays holds the 12 published stays and nothing else`);
      for (const hidden of HIDDEN_SLUGS) assert.equal(found.includes(hidden), false, hidden);
    }
    assert.equal(stayDocuments(root).filter((d) => existsSync(d.file)).length, 36);
  });

  test(`${name}: no Mariven in any of the 36 stay documents, inline RSC payload included`, run, () => {
    for (const { file } of stayDocuments(root)) {
      const text = bytes(file);
      assert.equal(MARIVEN.test(text), false, `${file} carries Mariven`);
      assert.equal(text.includes(SENTENCE), false, `${file} carries the template sentence`);
    }
  });

  test(`${name}: no Mariven in any emitted file (html, rsc, body, js, json, css, fonts)`, run, () => {
    const roots = root === OUT ? [OUT] : [".next/server", ".next/static"];
    const all = roots.flatMap((r) => walk(r));
    assert.ok(all.length > 50, `expected to scan the real build, scanned ${all.length}`);
    const hits = all.filter((file) => MARIVEN.test(bytes(file)) || bytes(file).includes(SENTENCE));
    assert.deepEqual(hits, []);
  });

  // ---- task 5, byte layer -------------------------------------------------------------------------------------

  test(`${name}: no rate, no minimum stay, no currency code in the 36 documents (the payload included)`, run, () => {
    for (const { file } of stayDocuments(root)) {
      const text = bytes(file);
      for (const field of ["nightly_rate_aed", "min_nights", "price_aed"]) {
        assert.equal(text.includes(field), false, `${file} carries ${field}`);
      }
      assert.equal(/\b(?:AED|USD|EUR|COP)\b/.test(text), false, `${file} carries a currency code`);
    }
  });

  test(`${name}: each of the 36 documents holds the default request link, and no placeholder policy text`, run, async () => {
    const { buildStayRequestMessage, stayRequestHref } = await loadTs("lib/whatsapp-request.ts");
    const { STAY_DETAIL_COPY } = await loadTs("lib/copy/stay-detail.ts");
    const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
    const { absoluteLocaleUrl } = await loadTs("lib/locale-path.ts");
    const { getStay } = await loadTs("lib/data/stays.ts");
    for (const { prefix, slug, file } of stayDocuments(root)) {
      const locale = prefix === "" ? "en" : prefix.slice(0, -1);
      const stay = await getStay(locale, slug);
      const href = stayRequestHref(
        buildStayRequestMessage(
          {
            locale,
            title: stay.title,
            destinationName: stay.destination_name,
            start: null,
            end: null,
            adults: 1,
            children: 0,
            infants: 0,
            pageUrl: absoluteLocaleUrl(locale, `/private-stays/${slug}`),
          },
          STAY_DETAIL_COPY[locale].whatsapp,
          { nights: JOURNEY_COPY[locale].dates.nights, guests: JOURNEY_COPY[locale].guests.summary },
        ),
      );
      const text = Buffer.from(readFileSync(file)).toString("utf8");
      // React escapes & and ' inside an attribute.
      const attr = href.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
      assert.ok(text.includes(`href="${attr}"`), `${file} lacks the default request link`);
      assert.equal(/PRIVADA|CAMARERA/.test(text), false, `${file} carries placeholder policy text`);
    }
  });

  test(`${name}: no image from the Framer CDN, catbox or pexels in the 36 documents`, run, () => {
    for (const { file } of stayDocuments(root)) {
      const text = bytes(file);
      for (const host of ["framerusercontent", "framer.com", "files.catbox.moe", "videos.pexels.com"]) {
        assert.equal(text.includes(host), false, `${file} names ${host}`);
      }
    }
  });

  test(`${name}: every <img> and the share image are on the media host`, run, () => {
    for (const { file } of stayDocuments(root)) {
      const text = bytes(file);
      const sources = [...text.matchAll(/<img\b[^>]*?\ssrc="([^"]*)"/g)].map((m) => m[1]);
      // The images that are not content are repo-owned brand files: the nav wordmark (bundled under /_next/static/media/)
      // and the footer's, inlined as a data: URI (plan 41). Two at most.
      const content = sources.filter((src) => !src.startsWith("/_next/static/media/") && !src.startsWith("data:image/svg+xml"));
      assert.ok(sources.length - content.length <= 2, `${file}: only the two wordmarks are bundled images`);
      assert.ok(content.length >= 10, `${file}: expected the hero, the gallery and the cards, found ${content.length}`);
      for (const src of content) assert.ok(src.startsWith(`${MEDIA_BASE_URL}/`), `${file}: <img src="${src}">`);
      const share = /<meta property="og:image" content="([^"]*)"/.exec(text);
      assert.ok(share && share[1].startsWith(`${MEDIA_BASE_URL}/`), `${file}: og:image ${share?.[1]}`);
    }
  });

  test(`${name}: the document carries no form, no submit and no script-less fake control`, run, () => {
    for (const { file } of stayDocuments(root)) {
      const text = bytes(file);
      assert.equal(/<form\b/i.test(text), false, `${file} has a <form>`);
      assert.equal(/type="submit"/i.test(text), false, `${file} has a submit button`);
      assert.equal(/<input\b/i.test(text), false, `${file} has an <input>`);
    }
  });

  // Plan 03.3-15: each card on a stay page is one link to its overlay on /experiences, in the document's language.
  test(`${name}: the Services and Experiences cards in the 36 documents link to /experiences?item=, never to /services`, run, async () => {
    const { getCatalogForStay } = await loadTs("lib/data/experiences.ts");
    const { localePath } = await loadTs("lib/locale-path.ts");
    const decode = (text) => text.replace(/&amp;/g, "&");
    for (const { prefix, slug, file } of stayDocuments(root)) {
      const locale = prefix === "" ? "en" : prefix.slice(0, -1);
      const catalog = await getCatalogForStay(locale, slug);
      // The page shows the first three items with a picture in each section.
      const shown = [...catalog.services, ...catalog.experiences].length === 0 ? [] : [
        ...catalog.services.filter((i) => i.image).slice(0, 3),
        ...catalog.experiences.filter((i) => i.image).slice(0, 3),
      ];
      const experiences = localePath(locale, "/experiences");
      const text = decode(Buffer.from(readFileSync(file)).toString("utf8"));
      assert.equal(text.split(`href="${experiences}?item=`).length - 1, shown.length, `${file}: card links`);
      for (const item of shown) assert.ok(text.includes(`href="${experiences}?item=${item.slug}"`), `${file}: ${item.slug}`);
      assert.equal(text.includes('href="/services'), false, `${file}: a /services link`);
      assert.equal(text.includes('href="./services'), false, `${file}: a ./services link`);
    }
  });
}
