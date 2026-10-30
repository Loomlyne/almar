// lib/data/source.ts after plan 06-01: the page blocks and posts come from the database in supabase mode (no fixture file
// is read there), the seven nav/legal/package-leg names answer [] in fixtures mode, and the load refuses an empty page.
// Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSiteContentPayload } from "../scripts/import-site-content.mjs";
import { catalogViews, fakeClient, loadPageBlocks, pageViews, SUPABASE_ENV, withEnv } from "./helpers/site-cms-views.mjs";

const { payload } = await buildSiteContentPayload({ root: process.cwd() });
const SEVEN = [
  "nav-links",
  "nav-link-translations",
  "legal-pages",
  "legal-page-translations",
  "journey-tier-legs",
  "journey-tier-leg-translations",
  "journey-tier-addons",
];

/** An empty folder: any fixture read with ALMAR_FIXTURE_DIR pointing at it throws ENOENT. */
const emptyDir = () => mkdtempSync(join(tmpdir(), "almar-no-fixtures-"));

async function load(views, env = SUPABASE_ENV) {
  const mod = await loadPageBlocks();
  mod.__testing.setClientFactory(() => fakeClient({ ...catalogViews(), ...pageViews(payload), ...views }));
  const result = await withEnv(env, () => mod.loadSource().then(() => "ok", (error) => error));
  return { mod, result };
}

test("supabase mode reads the page views and never a fixture file: page blocks and posts work with no fixture folder", async () => {
  const env = { ...SUPABASE_ENV, ALMAR_FIXTURE_DIR: emptyDir() };
  const { mod, result } = await load({}, env);
  assert.equal(result, "ok");
  await withEnv(env, () => {
    assert.ok(mod.pageFixture("home").gallery.images.length > 0);
    assert.ok(mod.pageFixture("about").cards.length > 0);
    assert.ok(mod.pageFixture("destinations").hero.length > 0);
    assert.ok(mod.readSource("posts").length > 0);
    assert.ok(mod.readSource("post-translations").length > 0);
  });
});

test("supabase mode: an empty api_page_sections fails the load (an empty page never ships)", async () => {
  const { result } = await load({ api_page_sections: [] });
  assert.ok(result instanceof Error);
  assert.match(result.message, /api_page_sections: no published rows/);
});

test("supabase mode: a non-decorative page photo without an Arabic alt fails the load; a decorative one does not", async () => {
  const views = pageViews(payload);
  const poster = views.api_page_section_media.find((m) => m.slot === "poster");
  const decorative = views.api_page_section_media.find((m) => m.is_decorative);
  assert.ok(poster && decorative);
  const drop = (id) => catalogViews().api_image_translations.filter((r) => !(r.image_id === id && r.locale === "ar"));

  const missing = await load({ api_image_translations: drop(poster.image.id) });
  assert.ok(missing.result instanceof Error);
  assert.match(missing.result.message, new RegExp(`${poster.image.id} \\(ar\\)`));

  // A decorative photo used nowhere else: its missing alt is not checked.
  const onlyDecorative = views.api_page_section_media.filter((m) => m.image.id === decorative.image.id).every((m) => m.is_decorative);
  if (onlyDecorative) {
    const fine = await load({ api_image_translations: drop(decorative.image.id) });
    assert.equal(fine.result, "ok");
  }
});

test("supabase mode: empty nav, legal and package-leg views do not fail the load (nothing is published there yet)", async () => {
  const { mod, result } = await load({});
  assert.equal(result, "ok");
  await withEnv(SUPABASE_ENV, () => {
    for (const name of SEVEN) assert.deepEqual(mod.readSource(name), [], name);
  });
});

test("fixtures mode: the seven nav/legal/package-leg names answer [] and read no file", async () => {
  const mod = await loadPageBlocks();
  await withEnv({ ALMAR_FIXTURE_DIR: emptyDir() }, () => {
    for (const name of SEVEN) assert.deepEqual(mod.readSource(name), [], name);
  });
});

test("fixtures mode: the five page-* names are not readSource's (page-blocks.ts reads the files itself)", async () => {
  const mod = await loadPageBlocks();
  await withEnv({}, () => {
    for (const name of ["page-sections", "page-section-translations", "page-section-media", "page-items", "page-item-translations"]) {
      assert.throws(() => mod.readSource(name), /page blocks are read through lib\/data\/page-blocks\.ts/, name);
    }
  });
});
