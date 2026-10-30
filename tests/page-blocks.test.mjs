// lib/data/page-blocks.ts (plan 06-01, Task 4): the page blocks read back from the page views are the fixture blocks.
// Fixtures -> scripts/import-site-content.mjs payload -> the rows the views return (tests/helpers/site-cms-views.mjs) ->
// pageFixture / pageFixtureTranslations deep-equal each fixture file. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteContentPayload } from "../scripts/import-site-content.mjs";
import { catalogViews, fakeClient, loadPageBlocks, pageViews, SUPABASE_ENV, withEnv } from "./helpers/site-cms-views.mjs";

const fixture = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
const { payload } = await buildSiteContentPayload({ root: process.cwd() });

async function loaded(views) {
  const mod = await loadPageBlocks();
  mod.__testing.setClientFactory(() => fakeClient({ ...catalogViews(), ...views }));
  await withEnv(SUPABASE_ENV, () => mod.loadSource());
  return mod;
}

const inSupabase = (fn) => withEnv(SUPABASE_ENV, fn);
const byCardLocale = (rows) => [...rows].sort((a, b) => `${a.card_id}:${a.locale}`.localeCompare(`${b.card_id}:${b.locale}`));

test("fixtures mode: pageFixture and pageFixtureTranslations return the fixture files (home without tiers)", async () => {
  const mod = await loadPageBlocks();
  await withEnv({}, () => {
    const { tiers: _t, ...home } = fixture("home");
    assert.deepEqual(mod.pageFixture("home"), home);
    const { tiers: _tt, ...homeT } = fixture("home-translations");
    assert.deepEqual(mod.pageFixtureTranslations("home"), homeT);
    assert.deepEqual(mod.pageFixture("about"), fixture("about"));
    assert.deepEqual(mod.pageFixtureTranslations("about"), fixture("about-translations"));
    assert.deepEqual(mod.pageFixture("destinations"), fixture("destinations-page"));
    assert.deepEqual(mod.pageFixtureTranslations("destinations"), {});
  });
});

test("supabase mode, every section shown: home blocks equal home.json (plus video_url null beside each video_key)", async () => {
  const mod = await loaded(pageViews(payload));
  await inSupabase(() => {
    const { tiers: _t, ...home } = fixture("home");
    const expected = { ...home, hero: { ...home.hero, video_url: null }, begin: { ...home.begin, video_url: null } };
    assert.deepEqual(mod.pageFixture("home"), expected);
    const { tiers: _tt, ...homeT } = fixture("home-translations");
    assert.deepEqual(mod.pageFixtureTranslations("home"), homeT);
  });
});

test("supabase mode, every section shown: About equals about.json and about-translations.json", async () => {
  const mod = await loaded(pageViews(payload));
  await inSupabase(() => {
    assert.deepEqual(mod.pageFixture("about"), fixture("about"));
    const got = mod.pageFixtureTranslations("about");
    const want = fixture("about-translations");
    assert.deepEqual({ ...got, cards: byCardLocale(got.cards) }, { ...want, cards: byCardLocale(want.cards) });
  });
});

test("supabase mode: the /destinations hero equals destinations-page.json", async () => {
  const mod = await loaded(pageViews(payload));
  await inSupabase(() => assert.deepEqual(mod.pageFixture("destinations"), fixture("destinations-page")));
});

test("supabase mode: a hidden section drops its block (photos empty, no text records); the rest is unchanged", async () => {
  const mod = await loaded(pageViews(payload, { hide: ["home/gallery", "about/story"] }));
  await inSupabase(() => {
    const home = mod.pageFixture("home");
    assert.deepEqual(home.gallery.images, []);
    assert.deepEqual(home.welcome.images, fixture("home").welcome.images);
    assert.deepEqual(mod.pageFixtureTranslations("home").gallery, []);
    const about = mod.pageFixture("about");
    assert.ok(about.cards.every((c) => c.section !== "story"), "Our Story cards go with their section");
    assert.ok(about.cards.some((c) => c.section === "values"));
    const cardIds = new Set(about.cards.map((c) => c.id));
    assert.ok(mod.pageFixtureTranslations("about").cards.every((t) => cardIds.has(t.card_id)));
  });
});

test("supabase mode: a stored hero video URL is returned beside video_key", async () => {
  const views = pageViews(payload);
  views.api_page_sections = views.api_page_sections.map((s) =>
    s.page === "home" && s.section === "hero" ? { ...s, video_url: "https://media.almarprivatejourney.com/home/hero.mp4" } : s,
  );
  const mod = await loaded(views);
  await inSupabase(() => {
    const home = mod.pageFixture("home");
    assert.equal(home.hero.video_url, "https://media.almarprivatejourney.com/home/hero.mp4");
    assert.equal(home.hero.video_key, null);
    assert.equal(home.begin.video_url, null);
  });
});
