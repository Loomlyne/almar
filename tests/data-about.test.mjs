// About page data (plan 03.3-20, design 3.1-3.5 and 12.1, S3-25): getAboutBlocks in three locales.
// EN is pinned to the live app/about/route.ts text (while that file exists; plan 23 deletes it). AR and ES are
// drafts. The published filter and the order are shown on a scratch copy of lib/data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const ROOT = process.cwd();
const BASE = "https://media.almarprivatejourney.com";
const fixture = (name, root = ROOT) => JSON.parse(readFileSync(join(root, "lib", "data", "fixtures", `${name}.json`), "utf8"));
const KEY_RE = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.webp$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ARABIC_LETTER = /[؀-ۿ]/;
const ARABIC_INDIC_DIGIT = /[٠-٩]/;
const IMAGE_KEYS = ["alt", "height", "id", "position", "url", "width"];

const HERO_ALT = "Infinity pool blending into the ocean view, minimalist sun loungers in soft neutral fabric, curved architecture";
const STATEMENT =
  "ALMAR Private Journeys is a luxury travel agency created for travellers who want to experience Colombia with privacy, careful planning, and high standards of service.";
const EN_CARDS = {
  story: [
    ["designed-with-heart", "Designed with Heart", "Every ALMAR journey reflects our commitment to personalised planning, selected local partners, and experiences shaped around each client."],
    ["bridging-curiosity-and-confidence", "Bridging Curiosity & Confidence", "ALMAR was founded by a Colombian who spent years guiding international executives across the Gulf and beyond—watching them fall in love with Colombia, then pull back from fear. We answered with all-inclusive private packages: private driver, in-villa chef, 24-hour assistance, handpicked villas, and curated culture. That bridge became our mission."],
    ["a-vision-that-grows", "A Vision That Grows", "Our long-term vision: direct villa and luxury car partnerships across Colombia, then Latin America — earning trust as the reference for safety-led luxury travel throughout the region."],
  ],
  values: [
    ["intentional-hospitality", "Intentional Hospitality", "We believe great service should feel natural, never forced. Every team member is empowered to create moments that matter - from a warm greeting to a handwritten note."],
    ["bilingual-trip-support", "Bilingual Trip Support", "Bilingual trip coordination and a 24/7 emergency contact are planned around each confirmed journey."],
    ["privacy-and-discreet-coordination", "Privacy & Discreet Coordination", "Private transfer coordination, discreet planning, and specialist support can be arranged around each client and confirmed before booking."],
  ],
};
// [media_key, width, height]
const INTRO = [
  ["about/intro/01.webp", 1820, 1024],
  ["home/gallery/13.webp", 1820, 1024],
  ["about/intro/03.webp", 1820, 1024],
  ["about/intro/04.webp", 1820, 1024],
  ["about/intro/05.webp", 1820, 1024],
];
const CARD_IMAGES = {
  "designed-with-heart": ["about/story/designed-with-heart.webp", 1920, 1277],
  "bridging-curiosity-and-confidence": ["about/story/bridging-curiosity-and-confidence.webp", 992, 1200],
  "a-vision-that-grows": ["about/story/a-vision-that-grows.webp", 1408, 768],
  "intentional-hospitality": ["about/values/intentional-hospitality.webp", 1536, 1024],
  "bilingual-trip-support": ["about/values/bilingual-trip-support.webp", 1536, 1024],
  "privacy-and-discreet-coordination": ["about/values/privacy-and-discreet-coordination.webp", 1536, 1024],
};

const about = async (locale) => (await loadTs("lib/data/about.ts")).getAboutBlocks(locale);

/** A scratch copy of lib/data (modules and fixtures): the real tree is never edited. */
async function withScratch(edit, locale) {
  const dir = mkdtempSync(join(tmpdir(), "almar-about-"));
  mkdirSync(join(dir, "lib"), { recursive: true });
  cpSync(join(ROOT, "lib", "data"), join(dir, "lib", "data"), { recursive: true });
  edit(dir);
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    const mod = await loadTs("lib/data/about.ts");
    return await mod.getAboutBlocks(locale);
  } finally {
    process.chdir(cwd);
  }
}
const editAbout = (fn) => (dir) => {
  const p = join(dir, "lib", "data", "fixtures", "about.json");
  const data = JSON.parse(readFileSync(p, "utf8"));
  fn(data);
  writeFileSync(p, JSON.stringify(data, null, 2));
};

test("en hero: the live kicker and headline, the hero image with its published alt (the live page's lost first letter restored)", async () => {
  const b = await about("en");
  assert.equal(b.hero.kicker, "Our Story");
  assert.equal(b.hero.headline, "Your Private Colombia");
  assert.equal(b.hero.image.url, `${BASE}/about/hero.webp`);
  assert.equal(b.hero.image.width, 1820);
  assert.equal(b.hero.image.height, 1024);
  assert.equal(b.hero.image.alt, HERO_ALT);
  // The live Framer alt began "nfinity pool" (a lost first letter). The same string feeds og:image and twitter:image alt
  // in aboutMetadata, so it is fixed at the source, in image-translations.json, and nowhere else.
  assert.ok(b.hero.image.alt.startsWith("Infinity pool"));
  assert.ok(!b.hero.image.alt.startsWith("nfinity"));
});

test("no published English alt on the About page starts with a lowercase letter (a lost first letter shows up as one)", () => {
  const a = fixture("about");
  const alts = fixture("image-translations");
  const images = [a.hero.image, ...a.intro.images, a.intro.still, a.cta_image, ...a.cards.map((c) => c.image)];
  let described = 0;
  for (const img of images) {
    const en = alts.find((r) => r.image_id === img.id && r.locale === "en");
    assert.ok(en, img.media_key);
    if (en.status !== "published" || en.alt === "") continue;
    described++;
    assert.doesNotMatch(en.alt, /^\p{Ll}/u, `${img.media_key}: "${en.alt.slice(0, 30)}"`);
  }
  assert.ok(described >= 1, "the hero is described");
});

test("en intro: the live statement, the collage's five photos in order, the wide still", async () => {
  const b = await about("en");
  assert.equal(b.intro.statement, STATEMENT);
  assert.equal(b.intro.images.length, 5);
  b.intro.images.forEach((img, i) => {
    assert.equal(img.url, `${BASE}/${INTRO[i][0]}`);
    assert.equal(img.position, i + 1);
    assert.equal(img.width, INTRO[i][1]);
    assert.equal(img.height, INTRO[i][2]);
    assert.equal(img.alt, "");
  });
  assert.equal(b.intro.still.url, `${BASE}/home/hero/poster.webp`);
  assert.equal(b.intro.still.width, 1920);
  assert.equal(b.intro.still.height, 1077);
});

test("cta_image: the Get In Touch still (S3-25) with alt empty in three languages", async () => {
  for (const l of ["en", "ar", "es"]) {
    const b = await about(l);
    assert.equal(b.cta_image.url, `${BASE}/about/cta/band.webp`);
    assert.equal(b.cta_image.width, 1920);
    assert.equal(b.cta_image.height, 1010);
    assert.equal(b.cta_image.position, 0);
    assert.equal(b.cta_image.alt, "");
    assert.equal(b.intro.still.alt, "", `${l} still alt`);
    for (const img of b.intro.images) assert.equal(img.alt, "", `${l} collage alt`);
  }
});

test("en cards: slugs, order and every title and body byte-equal to the live page", async () => {
  const b = await about("en");
  for (const section of ["story", "values"]) {
    assert.deepEqual(b[section].map((c) => c.slug), EN_CARDS[section].map((c) => c[0]));
    b[section].forEach((c, i) => {
      assert.equal(c.title, EN_CARDS[section][i][1]);
      assert.equal(c.body, EN_CARDS[section][i][2]);
      assert.equal(c.section, section);
      assert.equal(c.is_published, true);
      assert.equal(c.is_sample, false);
      assert.deepEqual(c.sample_fields, []);
      assert.equal(c.position, i + 1);
      assert.equal(c.translation_status, "published");
      assert.equal(c.locale, "en");
      const [key, w, h] = CARD_IMAGES[c.slug];
      assert.equal(c.image.url, `${BASE}/${key}`);
      assert.equal(c.image.width, w);
      assert.equal(c.image.height, h);
      assert.equal(c.image.alt, "");
    });
  }
});

test("ar and es: everything is a draft with the requested locale; the canvas hero lines; text differs from EN", async () => {
  const en = await about("en");
  for (const l of ["ar", "es"]) {
    const b = await about(l);
    const all = [...b.story, ...b.values];
    assert.equal(all.length, 6);
    for (const c of all) {
      assert.equal(c.translation_status, "draft", `${l} ${c.slug}`);
      assert.equal(c.locale, l);
    }
    assert.notEqual(b.hero.image.alt, "");
    assert.notEqual(b.hero.image.alt, en.hero.image.alt);
    all.forEach((c, i) => {
      const e = [...en.story, ...en.values][i];
      assert.notEqual(c.title, e.title, `${l} title ${c.slug}`);
      assert.notEqual(c.body, e.body, `${l} body ${c.slug}`);
    });
  }
  const ar = await about("ar");
  assert.equal(ar.hero.kicker, "قصتنا");
  assert.equal(ar.hero.headline, "كولومبيا الخاصة بك");
  for (const text of [ar.intro.statement, ...[...ar.story, ...ar.values].flatMap((c) => [c.title, c.body])]) {
    assert.match(text, ARABIC_LETTER);
    assert.doesNotMatch(text, ARABIC_INDIC_DIGIT);
  }
  assert.match(ar.hero.image.alt, ARABIC_LETTER);
  const es = await about("es");
  assert.equal(es.hero.kicker, "Nuestra historia");
  assert.equal(es.hero.headline, "Tu Colombia privada");
  assert.notEqual(es.intro.statement, en.intro.statement);
});

test("no storage shape leaks: no translations, status, card_id, media_key or locale-suffixed key; ImageRef keys exact", async () => {
  for (const l of ["en", "ar", "es"]) {
    const b = await about(l);
    const seen = [];
    const walk = (n, where) => {
      if (Array.isArray(n)) n.forEach((v, i) => walk(v, `${where}[${i}]`));
      else if (n && typeof n === "object") {
        for (const [k, v] of Object.entries(n)) {
          assert.ok(!["translations", "status", "card_id", "media_key"].includes(k) && !/_(en|ar|es)$/.test(k), `${l} ${where}.${k}`);
          walk(v, `${where}.${k}`);
        }
        if ("url" in n && "alt" in n) seen.push(n);
      }
    };
    walk(b, "blocks");
    assert.equal(seen.length, 1 + 5 + 1 + 1 + 6, "hero, five collage, still, cta, six cards");
    for (const img of seen) assert.deepEqual(Object.keys(img).sort(), IMAGE_KEYS);
  }
});

test("published filter and order, on a scratch tree", async () => {
  const one = await withScratch(
    editAbout((d) => { d.cards.find((c) => c.slug === "bilingual-trip-support").is_published = false; }),
    "en",
  );
  assert.equal(one.values.length, 2);
  assert.equal(one.story.length, 3);

  const none = await withScratch(
    editAbout((d) => { for (const c of d.cards) if (c.section === "story") c.is_published = false; }),
    "en",
  );
  assert.deepEqual(none.story, []);
  assert.equal(none.values.length, 3);

  const swapped = await withScratch(
    editAbout((d) => {
      const s = d.cards.filter((c) => c.section === "story");
      s[0].position = 3;
      s[2].position = 1;
    }),
    "en",
  );
  assert.deepEqual(swapped.story.map((c) => c.slug), ["a-vision-that-grows", "bridging-curiosity-and-confidence", "designed-with-heart"]);
});

test("fixture shape: about.json, about-translations.json and the alt records", () => {
  const a = fixture("about");
  const t = fixture("about-translations");
  assert.ok(a.hero.image);
  assert.equal(a.intro.images.length, 5);
  assert.ok(a.intro.still);
  assert.ok(a.cta_image);
  assert.equal(a.cards.length, 6);
  for (const section of ["story", "values"]) {
    const cards = a.cards.filter((c) => c.section === section);
    assert.deepEqual(cards.map((c) => c.position).sort(), [1, 2, 3]);
  }
  for (const block of ["hero", "intro"]) {
    assert.deepEqual(t[block].map((r) => r.locale).sort(), ["ar", "en", "es"], block);
    for (const r of t[block]) assert.equal(r.status, r.locale === "en" ? "published" : "draft", `${block} ${r.locale}`);
  }
  assert.equal(t.cards.length, 18);
  for (const c of a.cards) {
    const mine = t.cards.filter((r) => r.card_id === c.id);
    assert.deepEqual(mine.map((r) => r.locale).sort(), ["ar", "en", "es"], c.slug);
    for (const r of mine) assert.equal(r.status, r.locale === "en" ? "published" : "draft");
  }

  // Images: expected table, UUIDs, uniqueness, keys.
  const images = [a.hero.image, ...a.intro.images, a.intro.still, a.cta_image, ...a.cards.map((c) => c.image)];
  assert.equal(images.length, 14);
  const expected = new Map([
    ["about/hero.webp", [1820, 1024]],
    ["home/hero/poster.webp", [1920, 1077]],
    ["about/cta/band.webp", [1920, 1010]],
    ...INTRO.map(([k, w, h]) => [k, [w, h]]),
    ...Object.values(CARD_IMAGES).map(([k, w, h]) => [k, [w, h]]),
  ]);
  assert.deepEqual([...images.map((i) => i.media_key)].sort(), [...expected.keys()].sort());
  for (const i of images) {
    assert.match(i.media_key, KEY_RE);
    assert.deepEqual([i.width, i.height], expected.get(i.media_key), i.media_key);
    assert.match(i.id, UUID_RE);
  }
  const rowIds = [a.cards.map((c) => c.id), images.map((i) => i.id)].flat();
  assert.equal(new Set(rowIds).size, rowIds.length, "ids unique");
  for (const id of rowIds) assert.match(id, UUID_RE);
  // The two reused keys agree with the manifest.
  const manifest = JSON.parse(readFileSync(join(ROOT, "lib", "data", "media-manifest.json"), "utf8"));
  for (const key of ["home/gallery/13.webp", "home/hero/poster.webp"]) {
    const m = manifest.find((e) => e.key === key);
    const mine = images.find((i) => i.media_key === key);
    assert.deepEqual([mine.width, mine.height], [m.width, m.height], key);
  }
  // Ids absent from every other fixture.
  for (const f of ["stays", "destinations", "catalog", "home", "team"]) {
    const text = JSON.stringify(fixture(f));
    for (const id of rowIds) assert.ok(!text.includes(id), `${id} also in ${f}`);
  }
  // No URL, no source path, no locale map, no person.
  for (const f of ["about", "about-translations"]) {
    const text = readFileSync(join(ROOT, "lib", "data", "fixtures", `${f}.json`), "utf8");
    assert.doesNotMatch(text, /https?:\/\/|\/assets\//, f);
    assert.doesNotMatch(text, /"(?:en|ar|es)"\s*:\s*[{[]/, f);
  }
});

test("alt records: 42 appended for the 14 About images, hero published alt, thirteen empty alts", () => {
  const a = fixture("about");
  const alts = fixture("image-translations");
  const images = [a.hero.image, ...a.intro.images, a.intro.still, a.cta_image, ...a.cards.map((c) => c.image)];
  for (const img of images) {
    const mine = alts.filter((r) => r.image_id === img.id);
    assert.deepEqual(mine.map((r) => r.locale).sort(), ["ar", "en", "es"], img.media_key);
    if (img.media_key === "about/hero.webp") {
      const by = Object.fromEntries(mine.map((r) => [r.locale, r]));
      assert.equal(by.en.alt, HERO_ALT);
      assert.equal(by.en.status, "published");
      assert.equal(by.ar.status, "draft");
      assert.equal(by.es.status, "draft");
      assert.match(by.ar.alt, ARABIC_LETTER);
      assert.ok(!by.ar.alt.includes("nfinity") && !by.es.alt.includes("nfinity"), "typo not carried into drafts");
    } else {
      for (const r of mine) {
        assert.equal(r.alt, "", img.media_key);
        assert.equal(r.status, "published");
      }
    }
  }
  const ids = new Set(images.map((i) => i.id));
  assert.equal(alts.filter((r) => ids.has(r.image_id)).length, 42);
  // Appended at the end, in the order of the table: the last 42 records are the About ones.
  assert.ok(alts.slice(-42).every((r) => ids.has(r.image_id)), "the last 42 records are the About alts");
});

test("the live page carries every pinned EN literal (skipped once plan 23 deletes app/about/route.ts)", (t) => {
  const file = join(ROOT, "app", "about", "route.ts");
  if (!existsSync(file)) return t.skip("app/about/route.ts is gone (plan 23 deleted it); the pin was proven before");
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("const HTML = "));
  assert.ok(line, "HTML constant not found");
  const html = JSON.parse(line.slice("const HTML = ".length).replace(/;$/, ""));
  const decode = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");
  const text = decode(html);
  const pins = [HERO_ALT, STATEMENT, "Our Story", "Your Private Colombia", "3484e51613dcadfa", ...Object.values(EN_CARDS).flat().flatMap((c) => [c[1], c[2]])];
  for (const p of pins) assert.ok(text.includes(p), `not in the live About page: ${p.slice(0, 60)}`);
});
