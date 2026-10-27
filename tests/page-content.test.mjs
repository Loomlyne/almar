// lib/data/page-content.ts (plan 06-02 Task 5): what the five public pages read from the Pages CMS at build. Fixtures mode
// is today's page (every section shown, the copy files' words, no hero photo or video); supabase mode drops a hidden
// section from `shown`, reads the copy-held words from the published records, and returns a stored hero video for each
// of the five pages. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildSiteContentPayload } from "../scripts/import-site-content.mjs";
import { catalogViews, fakeClient, pageViews, SUPABASE_ENV, withEnv } from "./helpers/site-cms-views.mjs";

let counter = 0;

/** page-content.ts with the copy files and source's test seam, @supabase/supabase-js stubbed out (as loadPageBlocks). */
async function loadPageContent() {
  const out = await build({
    stdin: {
      contents: [
        'export * from "./lib/data/page-content.ts";',
        'export { __testing, loadSource } from "./lib/data/source.ts";',
        'export { PAGE_SECTIONS } from "./lib/data/page-sections.ts";',
        'export { HOME_PAGE_COPY } from "./lib/copy/home-page.ts";',
        'export { ABOUT_PAGE_COPY } from "./lib/copy/about-page.ts";',
        'export { CONTACT_PAGE_COPY } from "./lib/copy/contact-page.ts";',
        'export { DESTINATIONS_PAGE_COPY } from "./lib/copy/destinations-page.ts";',
        'export { EXPERIENCES_PAGE_COPY } from "./lib/copy/experiences-page.ts";',
      ].join("\n"),
      resolveDir: resolve("."),
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "throwing-supabase-js",
        setup(b) {
          b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "stub", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'throw new Error("@supabase/supabase-js was imported");', loader: "js" }));
        },
      },
    ],
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-page-content-"));
  const file = join(dir, `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const PAGES = ["home", "about", "destinations", "experiences", "contact"];
const LOCALES = ["en", "ar", "es"];
const { payload } = await buildSiteContentPayload({ root: process.cwd() });

async function loaded(views) {
  const mod = await loadPageContent();
  mod.__testing.reset();
  mod.__testing.setClientFactory(() => fakeClient({ ...catalogViews(), ...views }));
  await withEnv(SUPABASE_ENV, () => mod.loadSource());
  return mod;
}

test("fixtures mode: every section shown, the copy files' words in EN/AR/ES, no hero photo or video; withPageWords keeps the copy", async () => {
  const mod = await loadPageContent();
  await withEnv({}, async () => {
    for (const page of PAGES) {
      for (const locale of LOCALES) {
        const content = await mod.getPageContent(page, locale);
        assert.deepEqual([...content.shown], mod.PAGE_SECTIONS[page].map((s) => s.section), `${page} ${locale}: every section`);
        assert.deepEqual(content.hero, { image: null, video_url: null });
      }
    }
    const home = await mod.getPageContent("home", "ar");
    assert.equal(home.text.stays.heading, mod.HOME_PAGE_COPY.ar.stays.heading);
    assert.equal(home.text.begin.cta_label, mod.HOME_PAGE_COPY.ar.begin.cta);
    assert.deepEqual(mod.withPageWords(mod.HOME_PAGE_COPY.ar, "home", home), mod.HOME_PAGE_COPY.ar, "same strings: the page HTML is unchanged");
    const contact = await mod.getPageContent("contact", "es");
    assert.deepEqual(mod.withPageWords(mod.CONTACT_PAGE_COPY.es, "contact", contact), mod.CONTACT_PAGE_COPY.es);
    const about = await mod.getPageContent("about", "en");
    assert.deepEqual(mod.withPageWords(mod.ABOUT_PAGE_COPY.en, "about", about), mod.ABOUT_PAGE_COPY.en);
  });
});

test("supabase mode, every section shown: the copy-held words equal the copy files (the import copied them)", async () => {
  const mod = await loaded(pageViews(payload));
  await withEnv(SUPABASE_ENV, async () => {
    for (const locale of LOCALES) {
      const home = await mod.getPageContent("home", locale);
      assert.deepEqual(mod.withPageWords(mod.HOME_PAGE_COPY[locale], "home", home), mod.HOME_PAGE_COPY[locale], `home ${locale}`);
      const exp = await mod.getPageContent("experiences", locale);
      assert.deepEqual(mod.withPageWords(mod.EXPERIENCES_PAGE_COPY[locale], "experiences", exp), mod.EXPERIENCES_PAGE_COPY[locale], `experiences ${locale}`);
    }
  });
});

test("supabase mode: a hidden section is not in `shown`; the others keep the code's order", async () => {
  const mod = await loaded(pageViews(payload, { hide: ["home/gallery", "contact/confidence"] }));
  await withEnv(SUPABASE_ENV, async () => {
    const home = await mod.getPageContent("home", "en");
    assert.equal(home.shown.has("gallery"), false);
    assert.deepEqual(
      [...home.shown],
      mod.PAGE_SECTIONS.home.map((s) => s.section).filter((s) => s !== "gallery"),
    );
    const contact = await mod.getPageContent("contact", "ar");
    assert.equal(contact.shown.has("confidence"), false);
    assert.equal(contact.shown.has("title"), true);
  });
});

test("supabase mode: an edited heading reaches the page in its language; a stored video URL reaches hero.video_url on all five pages", async () => {
  const views = pageViews(payload);
  const VIDEO = "https://media.almarprivatejourney.com/video/hero.mp4";
  const heroIds = new Set();
  views.api_page_sections = views.api_page_sections.map((s) => {
    const first = PAGES.includes(s.page) && s.section === (s.page === "contact" ? "title" : "hero");
    if (first) heroIds.add(s.id);
    return first ? { ...s, video_url: VIDEO } : s;
  });
  const stays = views.api_page_sections.find((s) => s.page === "home" && s.section === "stays");
  views.api_page_section_translations = views.api_page_section_translations.map((t) =>
    t.section_id === stays.id && t.locale === "es" ? { ...t, heading: "[Estancias, editado]" } : t,
  );
  const mod = await loaded(views);
  await withEnv(SUPABASE_ENV, async () => {
    for (const page of PAGES) assert.equal((await mod.getPageContent(page, "en")).hero.video_url, VIDEO, page);
    const es = await mod.getPageContent("home", "es");
    assert.equal(mod.withPageWords(mod.HOME_PAGE_COPY.es, "home", es).stays.heading, "[Estancias, editado]");
  });
  assert.equal(heroIds.size, 5);
});

test("supabase mode (Sonnet review 06-02): an empty Arabic column reads the English record's, column by column; a page with no row stops the build", async () => {
  const views = pageViews(payload);
  const stays = views.api_page_sections.find((s) => s.page === "home" && s.section === "stays");
  views.api_page_section_translations = views.api_page_section_translations.map((t) => {
    if (t.section_id !== stays.id) return t;
    if (t.locale === "en") return { ...t, heading: "[Stays, English]" };
    if (t.locale === "ar") return { ...t, heading: null };
    return t;
  });
  const mod = await loaded(views);
  await withEnv(SUPABASE_ENV, async () => {
    const ar = await mod.getPageContent("home", "ar");
    assert.equal(ar.text.stays.heading, "[Stays, English]", "the empty Arabic heading falls back to English");
    const own = views.api_page_section_translations.find((t) => t.section_id === stays.id && t.locale === "ar");
    for (const [column, value] of Object.entries(ar.text.stays)) {
      if (column !== "heading" && typeof own[column] === "string" && own[column] !== "") assert.equal(value, own[column], `ar ${column} is its own`);
    }
  });

  const empty = await loaded({ ...pageViews(payload), api_page_sections: pageViews(payload).api_page_sections.filter((s) => s.page !== "contact") });
  await withEnv(SUPABASE_ENV, async () => {
    await assert.rejects(() => empty.getPageContent("contact", "en"), /no row for page "contact"/);
  });
});
