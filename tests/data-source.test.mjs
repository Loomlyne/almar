// lib/data/source.ts (plan 03.2-02, Task 1) and the assembler's source rule (Task 2): the one place that decides
// whether a build reads the JSON fixtures or the Supabase api_* views. Everything here runs without a database: the
// Supabase client is a fake injected through __testing, and @supabase/supabase-js itself is replaced by a stub that
// throws when it is imported, so a test can also prove that a mode never touches it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { assertLiveSupabaseUrl, assertNoPublicEnv, guardPublishSequence, assertNoServiceKey, BUILD_HANDOVER_ENV, BUILD_PUBLIC_ENV, dataSourceFor, LIVE_SUPABASE_HOST, nextBuildEnv } from "../scripts/assemble-cloudflare.mjs";
import * as assembler from "../scripts/assemble-cloudflare.mjs";

const fixture = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
let counter = 0;

/** A fresh copy of lib/data/source.ts (own state each call) whose supabase-js import throws when it runs. */
async function loadSourceModule() {
  const stub = {
    name: "throwing-supabase-js",
    setup(b) {
      b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "supabase-js-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'throw new Error("@supabase/supabase-js was imported");', loader: "js" }));
    },
  };
  const out = await build({
    entryPoints: [resolve("lib/data/source.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    plugins: [stub],
    logLevel: "silent",
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-data-source-"));
  const file = join(dir, `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const ENV_NAMES = ["ALMAR_DATA_SOURCE", "ALMAR_FIXTURE_DIR", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ALMAR_BUILD_SUPABASE_URL", "ALMAR_BUILD_SUPABASE_ANON_KEY"];

/** Runs `fn` with exactly these variables set (the others of ENV_NAMES removed), then puts everything back. */
async function withEnv(env, fn) {
  const saved = Object.fromEntries(ENV_NAMES.map((n) => [n, process.env[n]]));
  for (const n of ENV_NAMES) delete process.env[n];
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const n of ENV_NAMES) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
  }
}

const SUPABASE_ENV = {
  ALMAR_DATA_SOURCE: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test",
};

const PUBLIC_FOR_IMPORT = { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test" };

const VIEW_NAMES = [
  "api_destinations", "api_destination_translations", "api_stays", "api_stay_translations", "api_catalog",
  "api_catalog_translations", "api_team", "api_team_translations", "api_journey_tiers", "api_journey_tier_translations",
  "api_image_translations",
  // Phase 6 (plan 06-01): page blocks and posts from the database; nav, legal and package legs named up front.
  "api_page_sections", "api_page_section_translations", "api_page_section_media", "api_page_items",
  "api_page_item_translations", "api_posts", "api_post_translations", "api_nav_links", "api_nav_link_translations",
  "api_legal_pages", "api_legal_page_translations", "api_journey_tier_legs", "api_journey_tier_leg_translations",
  "api_journey_tier_addons",
];

const rowsOf = (n, make = (i) => ({ id: `row-${i}` })) => Array.from({ length: n }, (_, i) => make(i));

/** Every view with one row, unless `tables` says otherwise. */
const defaultTables = (tables = {}) => Object.fromEntries(VIEW_NAMES.map((v) => [v, tables[v] ?? rowsOf(1)]));

/**
 * A PostgREST-shaped fake: from(view).select(cols, { count }).order(col)....range(a, b) answers rows a..b inclusive,
 * at most `cap` of them (the server's max-rows setting), with the exact total when `count: "exact"` was asked for.
 */
function fakeClient(tables, { cap = Infinity, noCount = false, errors = {}, lie = {} } = {}) {
  const calls = [];
  const client = {
    from(view) {
      const q = { orders: [], options: null, columns: null };
      const builder = {
        select(columns, options) {
          q.columns = columns;
          q.options = options ?? null;
          return builder;
        },
        order(column) {
          q.orders.push(column);
          return builder;
        },
        range(from, to) {
          calls.push({ view, from, to, orders: [...q.orders], columns: q.columns, count: q.options?.count ?? null });
          if (errors[view]) return Promise.resolve({ data: null, error: { message: errors[view] }, count: null });
          const all = tables[view];
          if (!all) {
            return Promise.resolve({ data: null, error: { message: `Could not find the table 'public.${view}' in the schema cache` }, count: null });
          }
          const page = all.slice(from, Math.min(to + 1, from + cap));
          const total = lie[view] ?? all.length;
          return Promise.resolve({ data: page, error: null, count: noCount || q.options?.count !== "exact" ? null : total });
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

async function loadedWith(tables, options, env = SUPABASE_ENV) {
  const mod = await loadSourceModule();
  const fake = fakeClient(defaultTables(tables), options);
  mod.__testing.setClientFactory(() => fake.client);
  return withEnv(env, async () => ({ mod, fake, result: await mod.loadSource().then(() => "ok", (error) => error) }));
}

// ---------------------------------------------------------------------------------------------------------------
// dataSource()
// ---------------------------------------------------------------------------------------------------------------

test("dataSource: unset or 'fixtures' is fixtures, 'supabase' is supabase, anything else throws (a typo never means fixtures)", async () => {
  const mod = await loadSourceModule();
  await withEnv({}, () => assert.equal(mod.dataSource(), "fixtures"));
  await withEnv({ ALMAR_DATA_SOURCE: "" }, () => assert.equal(mod.dataSource(), "fixtures"));
  await withEnv({ ALMAR_DATA_SOURCE: "fixtures" }, () => assert.equal(mod.dataSource(), "fixtures"));
  await withEnv({ ALMAR_DATA_SOURCE: "supabase" }, () => assert.equal(mod.dataSource(), "supabase"));
  for (const bad of ["supabse", "Supabase", "FIXTURES", "true", "1", " supabase"]) {
    await withEnv({ ALMAR_DATA_SOURCE: bad }, () => assert.throws(() => mod.dataSource(), /ALMAR_DATA_SOURCE/, JSON.stringify(bad)));
  }
});

test("SOURCE_VIEWS maps every fixture name to its api_* view, and nothing else", async () => {
  const mod = await loadSourceModule();
  assert.deepEqual(mod.SOURCE_VIEWS, {
    destinations: "api_destinations",
    "destination-translations": "api_destination_translations",
    stays: "api_stays",
    "stay-translations": "api_stay_translations",
    catalog: "api_catalog",
    "catalog-translations": "api_catalog_translations",
    team: "api_team",
    "team-translations": "api_team_translations",
    "journey-tiers": "api_journey_tiers",
    "journey-tier-translations": "api_journey_tier_translations",
    "image-translations": "api_image_translations",
    "page-sections": "api_page_sections",
    "page-section-translations": "api_page_section_translations",
    "page-section-media": "api_page_section_media",
    "page-items": "api_page_items",
    "page-item-translations": "api_page_item_translations",
    posts: "api_posts",
    "post-translations": "api_post_translations",
    "nav-links": "api_nav_links",
    "nav-link-translations": "api_nav_link_translations",
    "legal-pages": "api_legal_pages",
    "legal-page-translations": "api_legal_page_translations",
    "journey-tier-legs": "api_journey_tier_legs",
    "journey-tier-leg-translations": "api_journey_tier_leg_translations",
    "journey-tier-addons": "api_journey_tier_addons",
  });
});

// ---------------------------------------------------------------------------------------------------------------
// fixtures mode
// ---------------------------------------------------------------------------------------------------------------

test("fixtures mode: loadSource resolves without importing supabase-js or building a client", async () => {
  const mod = await loadSourceModule();
  let built = 0;
  mod.__testing.setClientFactory(() => {
    built++;
    throw new Error("a client was built in fixtures mode");
  });
  await withEnv({}, async () => {
    await mod.loadSource();
    await mod.loadSource();
  });
  assert.equal(built, 0);
});

test("fixtures mode: readSource returns the fixture files; the journeys come from home.json and home-translations.json", async () => {
  const mod = await loadSourceModule();
  await withEnv({}, async () => {
    await mod.loadSource();
    assert.deepEqual(mod.readSource("stays"), fixture("stays"));
    assert.deepEqual(mod.readSource("stay-translations"), fixture("stay-translations"));
    assert.deepEqual(mod.readSource("destinations"), fixture("destinations"));
    assert.deepEqual(mod.readSource("catalog"), fixture("catalog"));
    assert.deepEqual(mod.readSource("team"), fixture("team"));
    assert.deepEqual(mod.readSource("image-translations"), fixture("image-translations"));
    assert.deepEqual(mod.readSource("journey-tiers"), fixture("home").tiers);
    assert.deepEqual(mod.readSource("journey-tier-translations"), fixture("home-translations").tiers);
  });
});

test("ALMAR_FIXTURE_DIR points every fixture read at another folder", async () => {
  const mod = await loadSourceModule();
  const dir = mkdtempSync(join(tmpdir(), "almar-fixture-dir-"));
  writeFileSync(join(dir, "stays.json"), JSON.stringify([{ id: "only-one" }]));
  await withEnv({ ALMAR_FIXTURE_DIR: dir }, async () => {
    assert.equal(mod.fixtureDir(), dir);
    assert.deepEqual(mod.readSource("stays"), [{ id: "only-one" }]);
    assert.deepEqual(mod.readFixtureFile("stays"), [{ id: "only-one" }]);
  });
  await withEnv({}, () => assert.equal(mod.fixtureDir(), join(process.cwd(), "lib", "data", "fixtures")));
});

// ---------------------------------------------------------------------------------------------------------------
// supabase mode
// ---------------------------------------------------------------------------------------------------------------

test("supabase mode without the public settings: loadSource rejects naming the missing setting, never its value", async () => {
  // A failed load stays failed inside one module copy, so every case gets its own copy.
  const failure = async (env) => {
    const mod = await loadSourceModule();
    mod.__testing.setClientFactory(() => assert.fail("no client may be built without settings"));
    return withEnv(env, () => mod.loadSource().then(() => null, (e) => e));
  };
  const secretLooking = "https://never-print-this.invalid";
  const noKey = await failure({ ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: secretLooking });
  assert.match(noKey.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(noKey.message, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.equal(noKey.message.includes(secretLooking), false);
  const noUrl = await failure({ ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_ANON_KEY: "key-value-xyz" });
  assert.match(noUrl.message, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(noUrl.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.equal(noUrl.message.includes("key-value-xyz"), false);
  const none = await failure({ ALMAR_DATA_SOURCE: "supabase" });
  assert.match(none.message, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(none.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  const blank = await failure({ ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "  ", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" });
  assert.match(blank.message, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(blank.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("supabase mode: every view is read, in the order the data layer expects, with an exact count", async () => {
  const { mod, fake, result } = await loadedWith({});
  assert.equal(result, "ok");
  assert.deepEqual([...new Set(fake.calls.map((c) => c.view))].sort(), [...VIEW_NAMES].sort());
  for (const c of fake.calls) {
    assert.equal(c.columns, "*", c.view);
    assert.equal(c.count, "exact", c.view);
    assert.deepEqual([c.from, c.to], [0, 999], c.view);
  }
  const orderOf = (view) => fake.calls.find((c) => c.view === view).orders;
  assert.deepEqual(orderOf("api_stays"), ["position", "slug"]);
  assert.deepEqual(orderOf("api_stay_translations"), ["stay_id", "locale"]);
  assert.deepEqual(orderOf("api_image_translations"), ["image_id", "locale"]);
  await withEnv(SUPABASE_ENV, () => {
    assert.deepEqual(mod.readSource("stays"), rowsOf(1));
    assert.deepEqual(mod.readSource("journey-tiers"), rowsOf(1));
  });
});

test("supabase mode: rows are kept exactly as the view returned them (no reshaping, same objects)", async () => {
  const row = { id: "s1", slug: "a", created_at: "2026-10-03T00:00:00+00:00", extra: { nested: [1, 2] }, nightly_rate_aed: null };
  const { mod } = await loadedWith({ api_stays: [row] });
  await withEnv(SUPABASE_ENV, () => assert.deepEqual(mod.readSource("stays"), [row]));
});

test("supabase mode: a view that returns an error rejects with the view name, and the error stays", async () => {
  const { result } = await loadedWith({}, { errors: { api_catalog: "permission denied for view api_catalog" } });
  assert.ok(result instanceof Error);
  assert.match(result.message, /^api_catalog: permission denied/);
});

test("supabase mode: a missing view rejects with the view name (the migration was not applied)", async () => {
  const tables = defaultTables();
  delete tables.api_team;
  const mod = await loadSourceModule();
  const fake = fakeClient(tables);
  mod.__testing.setClientFactory(() => fake.client);
  const error = await withEnv(SUPABASE_ENV, () => mod.loadSource().then(() => null, (e) => e));
  assert.match(error.message, /^api_team: Could not find the table/);
});

test("supabase mode: api_stays with no rows rejects (an empty catalogue never ships)", async () => {
  const { result } = await loadedWith({ api_stays: [] });
  assert.ok(result instanceof Error);
  assert.match(result.message, /api_stays/);
});

test("supabase mode: the team may be empty (team imports empty, C-17), and so may the translation views", async () => {
  const { result } = await loadedWith({ api_team: [], api_team_translations: [], api_catalog_translations: [], api_destination_translations: [] });
  assert.equal(result, "ok");
});

// 03.2-02b finding 3: an empty catalogue, journey list or destination list never ships silently ------------------------

for (const view of ["api_catalog", "api_journey_tiers", "api_destinations"]) {
  test(`supabase mode: ${view} with no rows rejects, naming the view (an empty ${view} never ships)`, async () => {
    const { result } = await loadedWith({ [view]: [] });
    assert.ok(result instanceof Error);
    assert.match(result.message, new RegExp(`^${view}: no published rows`));
  });
}

// 03.2-02b finding 2: no publish-sequence read inside the build's data layer (Next caches it; see guardPublishSequence) ---

test("source.ts reads no api_site_version (a second read inside a Next build would be a cache hit); the assembler guards the build", async () => {
  const { fake, result } = await loadedWith({});
  assert.equal(result, "ok");
  assert.equal(fake.calls.some((c) => c.view === "api_site_version"), false);
  assert.equal(readFileSync("lib/data/source.ts", "utf8").includes('from("api_site_version")'), false);
});

// 03.2-02b finding 4: every published picture has an alt in en, ar and es ---------------------------------------------

const pictureOf = (id) => ({ id, media_key: `stays/${id}.webp`, width: 1, height: 1, position: 1 });
const altsOf = (id, locales = ["en", "ar", "es"]) => locales.map((locale) => ({ image_id: id, locale, alt: `${id} ${locale}`, status: "published" }));

test("supabase mode: a published picture with all three alts loads", async () => {
  const { result } = await loadedWith({ api_stays: [{ id: "s1", images: [pictureOf("p1")] }], api_image_translations: altsOf("p1") });
  assert.equal(result, "ok");
});

for (const missing of ["en", "ar", "es"]) {
  test(`supabase mode: a published picture with no ${missing} alt fails the load, naming the picture and the language`, async () => {
    const present = ["en", "ar", "es"].filter((l) => l !== missing);
    const { result } = await loadedWith({ api_stays: [{ id: "s1", images: [pictureOf("p1")] }], api_image_translations: altsOf("p1", present) });
    assert.ok(result instanceof Error);
    assert.match(result.message, new RegExp(`api_image_translations: 1 alt text\\(s\\) missing for published pictures, p1 \\(${missing}\\)`));
  });
}

test("supabase mode: a blank alt counts as missing, for pictures of every database-read entity", async () => {
  const blank = altsOf("p1").map((r) => (r.locale === "ar" ? { ...r, alt: "  " } : r));
  const entities = {
    api_stays: "stays",
    api_destinations: "cover",
    api_catalog: "image",
    api_team: "photo",
    api_journey_tiers: "image",
    api_page_section_media: "image",
    api_page_items: "image",
    api_posts: "cover_image",
  };
  for (const [view, key] of Object.entries(entities)) {
    const { result } = await loadedWith({ [view]: [{ id: "x", [key]: pictureOf("p1") }], api_image_translations: blank });
    assert.match(result.message, /p1 \(ar\)/, view);
  }
});

test("supabase mode: a decorative page photo (About collage, Get In Touch still) needs no alt; a non-decorative one does (plan 06-01)", async () => {
  const media = (is_decorative) => [{ section_id: "sec-1", slot: "images", position: 1, is_decorative, image: pictureOf("p9") }];
  const decorative = await loadedWith({ api_page_section_media: media(true), api_image_translations: altsOf("p1") });
  assert.equal(decorative.result, "ok");
  const shown = await loadedWith({ api_page_section_media: media(false), api_image_translations: altsOf("p1") });
  assert.ok(shown.result instanceof Error);
  assert.match(shown.result.message, /p9 \(en\)/);
});

test("supabase mode: the six known About pictures need no alt; any other page item's picture does", async () => {
  const known = await loadedWith({ api_page_items: [{ id: "i1", image: pictureOf("0ef47bf1-b746-598d-9180-3fc172e4914b") }], api_image_translations: altsOf("p1") });
  assert.equal(known.result, "ok");
  const other = await loadedWith({ api_page_items: [{ id: "i2", image: pictureOf("p9") }], api_image_translations: altsOf("p1") });
  assert.ok(other.result instanceof Error);
  assert.match(other.result.message, /p9 \(en\)/);
});

// 03.2-02b finding 1: assembled builds read the live project only -------------------------------------------------------

test("assertLiveSupabaseUrl accepts the live project's https origin and nothing else (names only in the message)", () => {
  assert.equal(LIVE_SUPABASE_HOST, "jkdkaldgeiowkhlfmsft.supabase.co");
  assert.equal(assertLiveSupabaseUrl("X", LIVE_URL), LIVE_URL);
  assert.equal(assertLiveSupabaseUrl("X", `${LIVE_URL}/`), `${LIVE_URL}/`);
  assert.equal(assertLiveSupabaseUrl("X", ` ${LIVE_URL} `), ` ${LIVE_URL} `);
  const bad = [
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "https://127.0.0.1",
    "http://jkdkaldgeiowkhlfmsft.supabase.co",
    "https://abcdefghijklmnopqrst.supabase.co",
    "https://jkdkaldgeiowkhlfmsft.supabase.co.evil.example",
    "https://evil.example/jkdkaldgeiowkhlfmsft.supabase.co",
    "https://jkdkaldgeiowkhlfmsft.supabase.co@evil.example",
    "https://user:pw@jkdkaldgeiowkhlfmsft.supabase.co",
    "https://jkdkaldgeiowkhlfmsft.supabase.co:8443",
    `${LIVE_URL}/rest/v1`,
    `${LIVE_URL}?x=1`,
    "jkdkaldgeiowkhlfmsft.supabase.co",
    "not a url",
    "",
  ];
  for (const value of bad) {
    assert.throws(
      () => assertLiveSupabaseUrl("NEXT_PUBLIC_SUPABASE_URL", value),
      (error) => /^NEXT_PUBLIC_SUPABASE_URL must be https:\/\/jkdkaldgeiowkhlfmsft\.supabase\.co/.test(error.message) && (value === "" || value === LIVE_SUPABASE_HOST || !error.message.includes(value)),
      JSON.stringify(value),
    );
  }
});

test("supabase mode: a view with 2,500 rows is read in three .range pages", async () => {
  const { mod, fake, result } = await loadedWith({ api_stay_translations: rowsOf(2500, (i) => ({ stay_id: `s${i}`, locale: "en", title: "x", status: "published" })) });
  assert.equal(result, "ok");
  const pages = fake.calls.filter((c) => c.view === "api_stay_translations").map((c) => [c.from, c.to]);
  assert.deepEqual(pages, [[0, 999], [1000, 1999], [2000, 2999]]);
  await withEnv(SUPABASE_ENV, () => assert.equal(mod.readSource("stay-translations").length, 2500));
});

test("supabase mode: exactly 1,000 rows is one page plus a stop on the count, not an extra request that returns nothing", async () => {
  const { fake, result } = await loadedWith({ api_stay_translations: rowsOf(1000, (i) => ({ stay_id: "s", locale: "en", n: i })) });
  assert.equal(result, "ok");
  assert.equal(fake.calls.filter((c) => c.view === "api_stay_translations").length, 1);
});

test("supabase mode: a server that caps every page below 1,000 is still read completely (paging follows rows read, not the page size)", async () => {
  const { mod, fake, result } = await loadedWith({ api_catalog: rowsOf(1300) }, { cap: 500 });
  assert.equal(result, "ok");
  const pages = fake.calls.filter((c) => c.view === "api_catalog").map((c) => c.from);
  assert.deepEqual(pages, [0, 500, 1000]);
  await withEnv(SUPABASE_ENV, () => assert.equal(mod.readSource("catalog").length, 1300));
});

test("supabase mode: a truncated read fails the load (the count says more rows than the pages delivered)", async () => {
  const { result } = await loadedWith({ api_catalog: rowsOf(1500) }, { lie: { api_catalog: 2000 } });
  assert.ok(result instanceof Error);
  assert.match(result.message, /api_catalog: truncated read \(1500 of 2000 rows\)/);
});

test("supabase mode: more rows than the count promised (changed while reading) fails the load", async () => {
  const { result } = await loadedWith({ api_catalog: rowsOf(1200) }, { lie: { api_catalog: 1100 } });
  assert.ok(result instanceof Error);
  assert.match(result.message, /api_catalog/);
});

test("supabase mode: with no count in the answer, a short page ends the read", async () => {
  const { mod, fake, result } = await loadedWith({ api_catalog: rowsOf(1200) }, { noCount: true });
  assert.equal(result, "ok");
  assert.deepEqual(fake.calls.filter((c) => c.view === "api_catalog").map((c) => c.from), [0, 1000]);
  await withEnv(SUPABASE_ENV, () => assert.equal(mod.readSource("catalog").length, 1200));
});

test("loadSource called 20 times makes one set of requests; concurrent callers share it", async () => {
  const mod = await loadSourceModule();
  const fake = fakeClient(defaultTables());
  mod.__testing.setClientFactory(() => fake.client);
  await withEnv(SUPABASE_ENV, async () => {
    await Promise.all(Array.from({ length: 20 }, () => mod.loadSource()));
    await mod.loadSource();
  });
  assert.equal(fake.calls.length, VIEW_NAMES.length);
});

test("a failed load stays failed: every later caller gets the error, no second set of requests", async () => {
  const mod = await loadSourceModule();
  const fake = fakeClient(defaultTables(), { errors: { api_stays: "boom" } });
  mod.__testing.setClientFactory(() => fake.client);
  await withEnv(SUPABASE_ENV, async () => {
    const first = await mod.loadSource().then(() => null, (e) => e);
    const calls = fake.calls.length;
    const second = await mod.loadSource().then(() => null, (e) => e);
    assert.match(first.message, /api_stays: boom/);
    assert.equal(second, first);
    assert.equal(fake.calls.length, calls);
  });
});

test("readSource in supabase mode before loadSource has resolved throws", async () => {
  const mod = await loadSourceModule();
  await withEnv(SUPABASE_ENV, () => assert.throws(() => mod.readSource("stays"), /before loadSource/));
});

test("__testing.reset forgets the loaded rows, the failure and the injected client", async () => {
  const mod = await loadSourceModule();
  const fake = fakeClient(defaultTables());
  mod.__testing.setClientFactory(() => fake.client);
  await withEnv(SUPABASE_ENV, async () => {
    await mod.loadSource();
    mod.__testing.reset();
    assert.throws(() => mod.readSource("stays"), /before loadSource/);
  });
});

// the load starts at import (Flight row order depends on it), without a top-level await ------------------------------

test("importing source.ts in supabase mode starts the load without rejecting the import; every read gets its error; fixtures mode does nothing", async () => {
  // The stub throws when supabase-js is imported: the import itself resolves, and the first read gets the load's error.
  const refused = await withEnv(SUPABASE_ENV, async () => {
    const mod = await loadSourceModule();
    const first = await mod.loadSource().then(() => null, (e) => e);
    const second = await mod.loadSource().then(() => null, (e) => e);
    assert.equal(first, second, "a failed load stays failed: every later read gets the same error");
    return first;
  });
  assert.match(refused.message, /@supabase\/supabase-js was imported/);
  const noSettings = await withEnv({ ALMAR_DATA_SOURCE: "supabase" }, async () => (await loadSourceModule()).loadSource().then(() => null, (e) => e));
  assert.match(noSettings.message, /NEXT_PUBLIC_SUPABASE_URL/);
  await withEnv({}, () => loadSourceModule());
  await withEnv({ ALMAR_DATA_SOURCE: "fixtures", ...PUBLIC_FOR_IMPORT }, () => loadSourceModule());
  const typo = await withEnv({ ALMAR_DATA_SOURCE: "supabse" }, () => loadSourceModule());
  await withEnv({ ALMAR_DATA_SOURCE: "supabse" }, () => assert.throws(() => typo.dataSource(), /ALMAR_DATA_SOURCE/));
});

// image-translations in supabase mode -----------------------------------------------------------------------------

test("image-translations in supabase mode: the database records only; no fixture file is read in this mode (plan 06-01)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "almar-image-db-only-"));
  // An empty fixture folder: any fixture read in supabase mode would throw ENOENT.
  const database = [{ image_id: "database-only", locale: "en", alt: "x", status: "published" }];
  const { mod, result } = await loadedWith({ api_image_translations: database }, undefined, { ...SUPABASE_ENV, ALMAR_FIXTURE_DIR: dir });
  assert.equal(result, "ok");
  await withEnv({ ...SUPABASE_ENV, ALMAR_FIXTURE_DIR: dir }, () => assert.deepEqual(mod.readSource("image-translations"), database));
});

test("image-translations in supabase mode: no database alt record while stays exist throws (never a silent fixture fall back)", async () => {
  const { result } = await loadedWith({ api_image_translations: [] });
  assert.ok(result instanceof Error);
  assert.match(result.message, /api_image_translations: no alt texts while stays exist/);
});

// ---------------------------------------------------------------------------------------------------------------
// what the file may import (static)
// ---------------------------------------------------------------------------------------------------------------

test("source.ts: anon client only, no cookies, no session, no service key, no other lib/data module", () => {
  // Code only: the header comment is allowed to say what the file does not do.
  const src = readFileSync("lib/data/source.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");
  assert.doesNotMatch(src, /lib\/supabase\/clients|createSupabaseServer|createSupabaseAdmin|next\/headers|cookies\(/);
  assert.doesNotMatch(src, /SERVICE|service_role|service-role/i);
  assert.match(src, /persistSession:\s*false/);
  assert.match(src, /autoRefreshToken:\s*false/);
  assert.match(src, /await import\("@supabase\/supabase-js"\)/);
  assert.equal(/^import .*@supabase\/supabase-js/m.test(src.replace(/import type[^\n]*\n/g, "")), false, "supabase-js is imported lazily, inside supabase mode only");
  assert.deepEqual(
    [...src.matchAll(/from "(\.[^"]*)"/g)].map((m) => m[1]),
    ["./anon-key"],
    "source.ts imports no sibling module but the pure anon-key check (resolve.ts imports source.ts)",
  );
});

// ---------------------------------------------------------------------------------------------------------------
// the assembler's rule (Task 2): dataSourceFor(target, env)
// ---------------------------------------------------------------------------------------------------------------

const LIVE_URL = "https://jkdkaldgeiowkhlfmsft.supabase.co";
const PUBLIC = { NEXT_PUBLIC_SUPABASE_URL: LIVE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test" };

test("dataSourceFor('local'): fixtures unless supabase is asked for, and then both public settings are needed", () => {
  assert.equal(dataSourceFor("local", {}), "fixtures");
  assert.equal(dataSourceFor("local", { ALMAR_DATA_SOURCE: "fixtures" }), "fixtures");
  assert.equal(dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase", ...PUBLIC }), "supabase");
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase" }), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: PUBLIC.NEXT_PUBLIC_SUPABASE_URL }), /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabse" }), /ALMAR_DATA_SOURCE/);
});

for (const target of ["preview", "production"]) {
  test(`dataSourceFor('${target}'): the database only; refuses a missing public setting, fixtures, a typo and a fixture folder`, () => {
    assert.equal(dataSourceFor(target, { ...PUBLIC }), "supabase");
    assert.equal(dataSourceFor(target, { ...PUBLIC, ALMAR_DATA_SOURCE: "supabase" }), "supabase");
    assert.throws(() => dataSourceFor(target, {}), /NEXT_PUBLIC_SUPABASE_URL/);
    assert.throws(() => dataSourceFor(target, { NEXT_PUBLIC_SUPABASE_ANON_KEY: PUBLIC.NEXT_PUBLIC_SUPABASE_ANON_KEY }), /NEXT_PUBLIC_SUPABASE_URL/);
    assert.throws(() => dataSourceFor(target, { NEXT_PUBLIC_SUPABASE_URL: PUBLIC.NEXT_PUBLIC_SUPABASE_URL }), /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.throws(() => dataSourceFor(target, { ...PUBLIC, NEXT_PUBLIC_SUPABASE_URL: "   " }), /NEXT_PUBLIC_SUPABASE_URL/);
    assert.throws(() => dataSourceFor(target, { ...PUBLIC, ALMAR_DATA_SOURCE: "fixtures" }), /refuses ALMAR_DATA_SOURCE=fixtures/);
    assert.throws(() => dataSourceFor(target, { ...PUBLIC, ALMAR_DATA_SOURCE: "supabse" }), /ALMAR_DATA_SOURCE/);
    assert.throws(() => dataSourceFor(target, { ...PUBLIC, ALMAR_FIXTURE_DIR: "/somewhere/else" }), /ALMAR_FIXTURE_DIR/);
  });
}

for (const target of ["preview", "production"]) {
  test(`dataSourceFor('${target}'): the local stack's URL, another project and a non-https URL are refused, before anything is built`, () => {
    for (const url of ["http://127.0.0.1:54321", "http://localhost:54321", "https://example-project.invalid", "https://abcdefghijklmnopqrst.supabase.co", "http://jkdkaldgeiowkhlfmsft.supabase.co"]) {
      assert.throws(
        () => dataSourceFor(target, { ...PUBLIC, NEXT_PUBLIC_SUPABASE_URL: url }),
        (error) => /NEXT_PUBLIC_SUPABASE_URL must be https:\/\/jkdkaldgeiowkhlfmsft\.supabase\.co/.test(error.message) && !error.message.includes(url),
        url,
      );
    }
    assert.equal(dataSourceFor(target, { ...PUBLIC, NEXT_PUBLIC_SUPABASE_URL: ` ${LIVE_URL} ` }), "supabase");
  });
}

test("dataSourceFor('local') still accepts the local stack's URL (the parity and rebuild tests build against it)", () => {
  assert.equal(dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }), "supabase");
});

test("dataSourceFor('ops'): fixtures always, no public setting needed (out-ops ships no catalogue page); refuses supabase, a typo and a fixture folder", () => {
  assert.equal(dataSourceFor("ops", {}), "fixtures");
  assert.equal(dataSourceFor("ops", { ...PUBLIC }), "fixtures");
  assert.equal(dataSourceFor("ops", { ALMAR_DATA_SOURCE: "fixtures" }), "fixtures");
  assert.equal(dataSourceFor("ops", { ALMAR_DATA_SOURCE: "" }), "fixtures");
  assert.throws(() => dataSourceFor("ops", { ...PUBLIC, ALMAR_DATA_SOURCE: "supabase" }), /--target=ops refuses ALMAR_DATA_SOURCE=supabase/);
  assert.throws(() => dataSourceFor("ops", { ALMAR_DATA_SOURCE: "supabse" }), /ALMAR_DATA_SOURCE/);
  assert.throws(() => dataSourceFor("ops", { ALMAR_FIXTURE_DIR: "/somewhere/else" }), /ALMAR_FIXTURE_DIR/);
});

test("dataSourceFor names the setting and never prints a value", () => {
  const url = "https://value-that-must-not-appear.invalid";
  for (const env of [{ NEXT_PUBLIC_SUPABASE_URL: url }, { NEXT_PUBLIC_SUPABASE_URL: url, ALMAR_FIXTURE_DIR: "/value/that/must/not/appear" }, { ...PUBLIC, NEXT_PUBLIC_SUPABASE_URL: url, ALMAR_DATA_SOURCE: "fixtures" }]) {
    try {
      dataSourceFor("production", env);
      assert.fail("expected a throw");
    } catch (error) {
      assert.equal(error.message.includes("value-that-must-not-appear"), false);
      assert.equal(error.message.includes("value/that/must/not/appear"), false);
    }
  }
});

test("main() decides the source before assertMediaReady and before anything is built or removed, and hands it to the OpenNext build", () => {
  const src = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  const main = src.slice(src.indexOf("function main("));
  const at = (needle) => main.indexOf(needle);
  assert.ok(at("dataSourceFor(") > 0, "main calls dataSourceFor");
  assert.ok(at("dataSourceFor(") < at("assertMediaReady()"), "before the media check");
  assert.ok(at("dataSourceFor(") < at("assertPublicClean("), "before the public folder check");
  assert.ok(at("dataSourceFor(") < at("opennextjs-cloudflare"), "before the build");
  assert.ok(at("dataSourceFor(") < at("assembleOut("), "before out/ is touched");
  assert.match(main, /env: nextBuildEnv\(process\.env, source\)/, "the build environment is nextBuildEnv: the decided source, no NEXT_PUBLIC_*");
});

// A second build must read the database again (review of 03.2-02) ----------------------------------------------------

test("main() clears Next's fetch cache after the checks that can refuse a run and before the OpenNext build", () => {
  const src = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  const main = src.slice(src.indexOf("function main("));
  const at = (needle) => main.indexOf(needle);
  assert.ok(at("clearFetchCache(root)") > 0, "main calls clearFetchCache(root)");
  assert.ok(at("clearFetchCache(root)") > at("assertMediaReady()"), "a refused run leaves the previous .next as it was");
  assert.ok(at("clearFetchCache(root)") < at("opennextjs-cloudflare"), "before the build, which would otherwise find the old entries");
  assert.match(src, /\.next["'], ["']cache["'], ["']fetch-cache/, "the folder Next 15 keeps every fetch result in");
});

test("clearFetchCache removes .next/cache/fetch-cache and nothing else (the webpack cache keeps builds fast and deterministic)", () => {
  assert.equal(typeof assembler.clearFetchCache, "function", "the assembler exports clearFetchCache");
  const root = mkdtempSync(join(tmpdir(), "almar-fetch-cache-"));
  const keep = [join(root, ".next", "cache", "webpack", "client-production", "0.pack"), join(root, ".next", "server", "app", "x.html")];
  for (const file of [join(root, ".next", "cache", "fetch-cache", "abc123"), ...keep]) {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "x");
  }
  assembler.clearFetchCache(root);
  assert.equal(existsSync(join(root, ".next", "cache", "fetch-cache")), false);
  for (const file of keep) assert.equal(existsSync(file), true, file);
  assembler.clearFetchCache(root); // already gone: no error
  assembler.clearFetchCache(join(root, "no-such-checkout"));
});

// What the build shell may hold (job 10's rule, reconciled with this plan) -------------------------------------------

test("the build may see exactly two NEXT_PUBLIC_* names: the public URL and the public (anon) key", () => {
  assert.deepEqual([...BUILD_PUBLIC_ENV], ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  assertNoPublicEnv({ PATH: "/usr/bin", ...PUBLIC });
  assertNoPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "" });
});

test("assertNoPublicEnv still refuses every other NEXT_PUBLIC_* name, also next to the two allowed ones, naming only those", () => {
  assert.throws(
    () => assertNoPublicEnv({ ...PUBLIC, NEXT_PUBLIC_STRIPE_KEY: "value-xyz", NEXT_PUBLIC_A: "value-abc" }),
    (error) => {
      assert.match(error.message, /: NEXT_PUBLIC_A, NEXT_PUBLIC_STRIPE_KEY$/);
      assert.equal(error.message.includes("NEXT_PUBLIC_SUPABASE"), false);
      assert.equal(error.message.includes("value-"), false);
      return true;
    },
  );
  assert.throws(() => assertNoPublicEnv({ NEXT_PUBLIC_SUPABASE_URL_2: "x" }), /NEXT_PUBLIC_SUPABASE_URL_2/);
  assert.throws(() => assertNoPublicEnv({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "x" }), /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});

test("assertNoServiceKey: a service-role variable in the build shell stops the build before anything runs (names only)", () => {
  assertNoServiceKey({ PATH: "/usr/bin", ...PUBLIC });
  assertNoServiceKey({ SUPABASE_SERVICE_ROLE_KEY: "" });
  assertNoServiceKey({ SUPABASE_SERVICE_ROLE_KEY: "   " });
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "supabase_service_role_key", "MY_SERVICE_ROLE", "NEXT_PUBLIC_SERVICE_ROLE_KEY"]) {
    assert.throws(
      () => assertNoServiceKey({ [name]: "value-must-not-appear" }),
      (error) => {
        assert.ok(error.message.includes(name), name);
        assert.equal(error.message.includes("value-must-not-appear"), false);
        return true;
      },
      name,
    );
  }
});

test("nextBuildEnv: Next never sees a NEXT_PUBLIC_* name; the data layer gets the two public values under hand-over names", () => {
  assert.deepEqual(BUILD_HANDOVER_ENV, { NEXT_PUBLIC_SUPABASE_URL: "ALMAR_BUILD_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_ANON_KEY: "ALMAR_BUILD_SUPABASE_ANON_KEY" });
  const shell = { PATH: "/usr/bin", HOME: "/h", ...PUBLIC, ALMAR_BUILD_SUPABASE_URL: "stale", ALMAR_DATA_SOURCE: "supabase" };
  const database = nextBuildEnv(shell, "supabase");
  assert.deepEqual(database, {
    PATH: "/usr/bin",
    HOME: "/h",
    ALMAR_BUILD_SUPABASE_URL: PUBLIC.NEXT_PUBLIC_SUPABASE_URL,
    ALMAR_BUILD_SUPABASE_ANON_KEY: PUBLIC.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ALMAR_DATA_SOURCE: "supabase",
    WRANGLER_SEND_METRICS: "false",
  });
  assert.equal(Object.keys(database).some((name) => name.startsWith("NEXT_PUBLIC_")), false);
  // Fixtures mode: nothing public and no stale hand-over value at all, so a local build is what it was before this plan.
  const fixtures = nextBuildEnv(shell, "fixtures");
  assert.deepEqual(fixtures, { PATH: "/usr/bin", HOME: "/h", ALMAR_DATA_SOURCE: "fixtures", WRANGLER_SEND_METRICS: "false" });
  // Values are trimmed; the shell object is not changed.
  assert.equal(nextBuildEnv({ NEXT_PUBLIC_SUPABASE_URL: " u ", NEXT_PUBLIC_SUPABASE_ANON_KEY: " k " }, "supabase").ALMAR_BUILD_SUPABASE_URL, "u");
  assert.equal(shell.NEXT_PUBLIC_SUPABASE_URL, PUBLIC.NEXT_PUBLIC_SUPABASE_URL);
});

test("the data layer reads the hand-over names first and the NEXT_PUBLIC names second (tests, next dev); both missing is named", async () => {
  const seen = [];
  const run = async (env) => {
    const mod = await loadSourceModule();
    const fake = fakeClient(defaultTables());
    mod.__testing.setClientFactory((url, key) => {
      seen.push([url, key]);
      return fake.client;
    });
    return withEnv(env, () => mod.loadSource().then(() => "ok", (e) => e));
  };
  assert.equal(await run({ ALMAR_DATA_SOURCE: "supabase", ALMAR_BUILD_SUPABASE_URL: "https://build.invalid", ALMAR_BUILD_SUPABASE_ANON_KEY: "build-key" }), "ok");
  assert.equal(await run({ ALMAR_DATA_SOURCE: "supabase", ...PUBLIC }), "ok");
  assert.equal(
    await run({ ALMAR_DATA_SOURCE: "supabase", ALMAR_BUILD_SUPABASE_URL: "https://build.invalid", ALMAR_BUILD_SUPABASE_ANON_KEY: "build-key", ...PUBLIC }),
    "ok",
  );
  assert.deepEqual(seen, [
    ["https://build.invalid", "build-key"],
    [PUBLIC.NEXT_PUBLIC_SUPABASE_URL, PUBLIC.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ["https://build.invalid", "build-key"],
  ]);
  const none = await run({ ALMAR_DATA_SOURCE: "supabase" });
  assert.match(none.message, /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("main() refuses the shell before it chooses the source: public names, service key, then dataSourceFor", () => {
  const src = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  const main = src.slice(src.indexOf("function main("));
  const order = ["parseTarget(", "assertNoPublicEnv(", "assertNoServiceKey(", "dataSourceFor(", "assertPublicClean("].map((n) => main.indexOf(n));
  assert.ok(order.every((n) => n > 0), "every call is in main");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("no lib/data module has a top-level await: the Playwright build specs load lib/data as CommonJS", async () => {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync("lib/data").filter((name) => name.endsWith(".ts"));
  // A statement that starts at column 0 is module scope in these files (every function body is indented).
  const offenders = files.filter((name) => /^(?:if \([^\n]*\) )?(?:const [^\n]*= )?await\b/m.test(readFileSync(`lib/data/${name}`, "utf8")));
  assert.deepEqual(offenders, []);
  assert.match(readFileSync("lib/data/source.ts", "utf8"), /^if \(process\.env\.ALMAR_DATA_SOURCE === "supabase"\) loadSource\(\)\.catch\(\(\) => \{\}\);$/m);
});

// 03.2-02b finding 6: the README says which targets need the two public names ---------------------------------------------

test("README: --target=ops needs neither public name (the code reads fixtures for it); preview and production need both and the live URL", () => {
  const readme = readFileSync("README.md", "utf8").replace(/\s+/g, " ");
  assert.doesNotMatch(readme, /`production` and `ops`/);
  assert.match(readme, /--target=ops` reads fixtures and needs neither name/);
  assert.match(readme, /`--target=preview` and `production`/);
  assert.match(readme, /https:\/\/jkdkaldgeiowkhlfmsft\.supabase\.co/);
  // the ops runbook says the same (Grok's re-check of PR #7)
  const runbook = readFileSync(".planning/phases/03.2-real-catalog-and-team-inserted/03.2-OPS-DEPLOY.md", "utf8").replace(/\s+/g, " ");
  assert.doesNotMatch(runbook, /every assembled target reads the catalogue/);
  assert.doesNotMatch(runbook, /exports \*\*exactly two\*\* public names/);
  assert.match(runbook, /`--target=ops` reads \*\*fixtures\*\* and ships no catalogue page, so it needs \*\*neither\*\*/);
  // and the code agrees: ops needs nothing
  assert.equal(dataSourceFor("ops", {}), "fixtures");
});

// 03.2-02b finding 2, review of PR #10: the publish sequence is read around the whole build, outside Next ---------------

const GUARD_ENV = { NEXT_PUBLIC_SUPABASE_URL: LIVE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test" };

/** A stub of fetch that answers api_site_version with these sequences one read after another (the last repeats) and records the calls. */
function stubFetch(sequences, { status = 200, body } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const seq = sequences[Math.min(calls.length - 1, sequences.length - 1)];
    return { ok: status >= 200 && status < 300, status, json: async () => (body !== undefined ? body : [{ requested_seq: seq }]) };
  };
  return { fetchImpl, calls };
}

test("guardPublishSequence: the sequence moving between the read before and the read after the build throws, naming both numbers", async () => {
  for (const target of ["preview", "production"]) {
    const { fetchImpl, calls } = stubFetch([5, 6]);
    let built = 0;
    await assert.rejects(
      guardPublishSequence({ target, source: "supabase", env: GUARD_ENV, fetchImpl, build: () => built++ }),
      new RegExp(`api_site_version: requested_seq moved from 5 to 6 while --target=${target} was built`),
    );
    assert.equal(built, 1, "the build ran once, between the two reads");
    assert.equal(calls.length, 2);
  }
});

test("guardPublishSequence: an unchanged sequence passes; the reads are plain GETs of the pinned view with the anon key, never cached", async () => {
  const { fetchImpl, calls } = stubFetch(["9007199254740993"]);
  const order = [];
  const tracked = async (...args) => (order.push("read"), fetchImpl(...args));
  assert.equal(await guardPublishSequence({ target: "production", source: "supabase", env: GUARD_ENV, fetchImpl: tracked, build: () => order.push("build") }), "9007199254740993");
  assert.deepEqual(order, ["read", "build", "read"], "read, build, read");
  assert.equal(calls[0].url, `${LIVE_URL}/rest/v1/api_site_version?select=requested_seq`);
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.headers.apikey, GUARD_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  assert.equal(calls[0].init.method, undefined, "a GET");
  assert.match((await guardPublishSequence({ target: "production", source: "supabase", env: GUARD_ENV, fetchImpl: stubFetch(["9007199254740993", "9007199254740994"]).fetchImpl, build() {} }).catch((e) => e)).message, /moved from/);
});

test("guardPublishSequence: local, ops and fixtures builds read nothing and just build", async () => {
  for (const [target, source] of [["local", "supabase"], ["local", "fixtures"], ["ops", "fixtures"]]) {
    const { fetchImpl, calls } = stubFetch([1, 2]);
    let built = 0;
    await guardPublishSequence({ target, source, env: GUARD_ENV, fetchImpl, build: () => built++ });
    assert.equal(built, 1);
    assert.equal(calls.length, 0, `${target}/${source}`);
  }
});

test("guardPublishSequence: a failed build is the error to see (no second read); a failed or odd read fails before the build starts", async () => {
  const { fetchImpl, calls } = stubFetch([3]);
  await assert.rejects(guardPublishSequence({ target: "preview", source: "supabase", env: GUARD_ENV, fetchImpl, build() { throw new Error("next build failed"); } }), /next build failed/);
  assert.equal(calls.length, 1);
  let built = 0;
  const build = () => built++;
  const run = (fetchImpl) => guardPublishSequence({ target: "preview", source: "supabase", env: GUARD_ENV, fetchImpl, build });
  await assert.rejects(run(stubFetch([1], { status: 401 }).fetchImpl), /api_site_version: the publish sequence could not be read \(HTTP 401\)/);
  await assert.rejects(run(stubFetch([1], { body: [] }).fetchImpl), /expected one row/);
  await assert.rejects(run(stubFetch([1], { body: [{ requested_seq: null }] }).fetchImpl), /expected one row/);
  await assert.rejects(run(async () => { throw new Error(`boom ${LIVE_URL} anon-key-for-a-test`); }), (e) => /could not be read \(network error or timeout\)/.test(e.message) && !e.message.includes("anon-key") && !e.message.includes(LIVE_URL));
  assert.equal(built, 0, "no build starts when the first read fails");
});

test("main() reads the sequence around the build: guardPublishSequence wraps the OpenNext build call, after the checks that can refuse a run", () => {
  const src = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  const main = src.slice(src.indexOf("async function main("));
  const at = (needle) => main.indexOf(needle);
  assert.ok(at("await guardPublishSequence(") > at("assertMediaReady()"), "after the media check");
  assert.ok(at("await guardPublishSequence(") > at("clearFetchCache(root)"));
  assert.ok(at("await guardPublishSequence(") < at('opennextjs-cloudflare'), "the build is inside the guard");
  assert.ok(at('opennextjs-cloudflare') < at("assertNoBundledEnv("), "the guard ends before the output is assembled");
});
