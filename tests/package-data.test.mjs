// Plan 06-06 Task 3: lib/data/journeys.ts on fixtures, and on the views through a fake client (as tests/data-source-site-cms.test.mjs).
// Written, NOT run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSiteContentPayload } from "../scripts/import-site-content.mjs";
import { catalogViews, fakeClient, pageViews, SUPABASE_ENV, withEnv } from "./helpers/site-cms-views.mjs";

let counter = 0;

/** A fresh bundle of lib/data/journeys.ts with lib/data/source.ts (one shared state), as loadPageBlocks in the views helper. */
async function loadJourneys() {
  const out = await build({
    stdin: {
      contents: `export * from "./lib/data/journeys.ts"; export { __testing, loadSource } from "./lib/data/source.ts";`,
      resolveDir: resolve("."),
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-journeys-")), `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const home = JSON.parse(readFileSync("lib/data/fixtures/home.json", "utf8"));
const published = home.tiers.filter((tier) => tier.is_published).sort((a, b) => a.position - b.position);

test("fixtures: the slugs are the published tiers', in order; a package there has no legs and no add-ons", async () => {
  const data = await loadJourneys();
  await withEnv({}, async () => {
    assert.deepEqual(await data.getPackageSlugs(), published.map((tier) => tier.slug));
    assert.deepEqual(await data.generatePackageParams(), published.map((tier) => ({ journey: tier.slug })));
    for (const locale of ["en", "ar", "es"]) {
      const pkg = await data.getPackage(locale, published[0].slug);
      assert.equal(pkg.slug, published[0].slug);
      assert.deepEqual(pkg.legs, []);
      assert.deepEqual(pkg.addons, []);
    }
  });
});

test("fixtures: an unknown slug is null", async () => {
  const data = await loadJourneys();
  await withEnv({}, async () => assert.equal(await data.getPackage("en", "no-such-package"), null));
});

const { payload } = await buildSiteContentPayload({ root: process.cwd() });
const views = catalogViews();
const tier = published[0];
const destination = views.api_destinations.find((row) => row.is_published);
const stay = views.api_stays.find((row) => row.is_published && row.destination_id === destination.id);
const [itemOne, itemTwo] = views.api_catalog.filter((row) => row.is_published);
const OTHER = "00000000-0000-4000-8000-00000000dead";
const UNKNOWN = "00000000-0000-4000-8000-00000000beef";

const LEG_VIEWS = {
  api_journey_tiers: [...views.api_journey_tiers, { ...tier, id: OTHER, slug: "hidden-one", is_published: false, position: 99 }],
  api_journey_tier_legs: [
    { id: "l2", tier_id: tier.id, position: 2, destination_id: destination.id, stay_id: UNKNOWN },
    { id: "l1", tier_id: tier.id, position: 1, destination_id: destination.id, stay_id: stay.id },
    // A destination that is not on the site drops its leg; a leg of another package never shows on this one.
    { id: "l3", tier_id: tier.id, position: 3, destination_id: UNKNOWN, stay_id: null },
    { id: "lx", tier_id: OTHER, position: 1, destination_id: destination.id, stay_id: null },
  ],
  api_journey_tier_leg_translations: [
    { leg_id: "l1", locale: "en", status: "published", nights_label: "3 nights" },
    { leg_id: "l1", locale: "ar", status: "published", nights_label: "AR 3" },
    { leg_id: "l1", locale: "es", status: "draft", nights_label: "ES draft" },
    { leg_id: "l2", locale: "en", status: "published", nights_label: "2 nights" },
  ],
  api_journey_tier_addons: [
    { tier_id: tier.id, item_id: itemOne.id, position: 2 },
    { tier_id: tier.id, item_id: itemTwo.id, position: 1 },
    { tier_id: tier.id, item_id: UNKNOWN, position: 3 },
    { tier_id: OTHER, item_id: itemOne.id, position: 1 },
  ],
};

/** Runs `fn` on a fresh bundle in supabase mode, loaded from the fake views. */
async function onViews(fn) {
  const data = await loadJourneys();
  data.__testing.setClientFactory(() => fakeClient({ ...views, ...pageViews(payload), ...LEG_VIEWS }));
  return withEnv(SUPABASE_ENV, async () => {
    await data.loadSource();
    return fn(data);
  });
}

test("views: a hidden package has no page, and its slug is not listed", () =>
  onViews(async (data) => {
    assert.equal((await data.getPackageSlugs()).includes("hidden-one"), false);
    assert.equal(await data.getPackage("en", "hidden-one"), null);
    assert.equal(await data.getPackage("en", "no-such-package"), null);
  }));

test("views: legs in position order with the destination and the stay; a stay not on the site is no stay; a destination not on the site drops the leg", () =>
  onViews(async (data) => {
    const pkg = await data.getPackage("en", tier.slug);
    assert.deepEqual(pkg.legs.map((leg) => leg.id), ["l1", "l2"]);
    assert.equal(pkg.legs[0].destination_slug, destination.slug);
    assert.ok(pkg.legs[0].destination_name);
    assert.equal(pkg.legs[0].stay_id, stay.id);
    assert.equal(pkg.legs[0].stay_slug, stay.slug);
    assert.ok(pkg.legs[0].stay_title);
    assert.deepEqual([pkg.legs[1].stay_id, pkg.legs[1].stay_slug, pkg.legs[1].stay_title], [null, null, null]);
  }));

test("views: the nights line is the locale's when published, else the English", () =>
  onViews(async (data) => {
    const nights = async (locale) => (await data.getPackage(locale, tier.slug)).legs.map((leg) => leg.nights_label);
    assert.deepEqual(await nights("en"), ["3 nights", "2 nights"]);
    assert.deepEqual(await nights("ar"), ["AR 3", "2 nights"]);
    assert.deepEqual(await nights("es"), ["3 nights", "2 nights"]);
  }));

test("views: add-ons by position with their name; an item not on the site is left out; no price on them", () =>
  onViews(async (data) => {
    const pkg = await data.getPackage("en", tier.slug);
    assert.deepEqual(pkg.addons.map((addon) => addon.item_id), [itemTwo.id, itemOne.id]);
    for (const addon of pkg.addons) {
      assert.ok(addon.name);
      assert.deepEqual(Object.keys(addon).sort(), ["item_id", "name", "position"]);
    }
  }));

test("the reader holds no amount: it never touches a price column", () => {
  assert.doesNotMatch(readFileSync("lib/data/journeys.ts", "utf8"), /price_from|price_estimate|est_low|est_high|price_aed/);
});

test("scripts/expected-public-paths.mjs lists the package pages (06-04 left this to 06-06)", () => {
  const text = readFileSync("scripts/expected-public-paths.mjs", "utf8");
  assert.match(text, /getPackageSlugs/);
  assert.match(text, /\/journeys\//);
});
