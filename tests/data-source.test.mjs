// lib/data/source.ts (plan 03.2-02, Task 1) and the assembler's source rule (Task 2): the one place that decides
// whether a build reads the JSON fixtures or the Supabase api_* views. Everything here runs without a database: the
// Supabase client is a fake injected through __testing, and @supabase/supabase-js itself is replaced by a stub that
// throws when it is imported, so a test can also prove that a mode never touches it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { assertNoPublicEnv, assertNoServiceKey, BUILD_HANDOVER_ENV, BUILD_PUBLIC_ENV, dataSourceFor, nextBuildEnv } from "../scripts/assemble-cloudflare.mjs";

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

test("supabase mode: other views may be empty (team imports empty, C-17)", async () => {
  const { result } = await loadedWith({ api_team: [], api_team_translations: [], api_catalog: [], api_catalog_translations: [] });
  assert.equal(result, "ok");
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

// the load at import (byte parity depends on it) -------------------------------------------------------------------------

test("importing source.ts in supabase mode loads the views before any read; in fixtures mode it does nothing", async () => {
  // The stub throws when supabase-js is imported, so a rejected import proves the import started the load.
  const refused = await withEnv(SUPABASE_ENV, () => loadSourceModule().then(() => null, (e) => e));
  assert.match(refused.message, /@supabase\/supabase-js was imported/);
  const noSettings = await withEnv({ ALMAR_DATA_SOURCE: "supabase" }, () => loadSourceModule().then(() => null, (e) => e));
  assert.match(noSettings.message, /NEXT_PUBLIC_SUPABASE_URL/);
  await withEnv({}, () => loadSourceModule());
  await withEnv({ ALMAR_DATA_SOURCE: "fixtures", ...PUBLIC_FOR_IMPORT }, () => loadSourceModule());
  const typo = await withEnv({ ALMAR_DATA_SOURCE: "supabse" }, () => loadSourceModule());
  await withEnv({ ALMAR_DATA_SOURCE: "supabse" }, () => assert.throws(() => typo.dataSource(), /ALMAR_DATA_SOURCE/));
});

// image-translations in supabase mode -----------------------------------------------------------------------------

test("image-translations in supabase mode: every database record plus fixture records of images the database does not know, never two for one (image_id, locale)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "almar-image-merge-"));
  const fixtureRecords = [
    { image_id: "A", locale: "en", alt: "fixture A en", status: "published" },
    { image_id: "A", locale: "ar", alt: "fixture A ar", status: "published" },
    { image_id: "B", locale: "en", alt: "fixture B en", status: "published" },
    { image_id: "B", locale: "es", alt: "fixture B es", status: "draft" },
    { image_id: "C", locale: "en", alt: "fixture C en", status: "published" },
  ];
  writeFileSync(join(dir, "image-translations.json"), JSON.stringify(fixtureRecords));
  const database = [
    { image_id: "A", locale: "en", alt: "database A en", status: "published" },
    { image_id: "C", locale: "ar", alt: "database C ar", status: "draft" },
  ];
  const { mod, result } = await loadedWith({ api_image_translations: database }, undefined, { ...SUPABASE_ENV, ALMAR_FIXTURE_DIR: dir });
  assert.equal(result, "ok");
  await withEnv({ ...SUPABASE_ENV, ALMAR_FIXTURE_DIR: dir }, () => {
    const merged = mod.readSource("image-translations");
    assert.deepEqual(
      merged.map((r) => `${r.image_id}:${r.locale}:${r.alt}`),
      ["A:en:database A en", "C:ar:database C ar", "B:en:fixture B en", "B:es:fixture B es"],
    );
    const keys = merged.map((r) => `${r.image_id}:${r.locale}`);
    assert.equal(new Set(keys).size, keys.length);
  });
});

test("image-translations in supabase mode: the real fixtures against an empty database keep every record once", async () => {
  const { mod, result } = await loadedWith({ api_image_translations: [] });
  assert.equal(result, "ok");
  await withEnv(SUPABASE_ENV, () => assert.deepEqual(mod.readSource("image-translations"), fixture("image-translations")));
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
  assert.deepEqual([...src.matchAll(/from "(\.[^"]*)"/g)].map((m) => m[1]), [], "source.ts imports no sibling module (resolve.ts imports it)");
});

// ---------------------------------------------------------------------------------------------------------------
// the assembler's rule (Task 2): dataSourceFor(target, env)
// ---------------------------------------------------------------------------------------------------------------

const PUBLIC = { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test" };

test("dataSourceFor('local'): fixtures unless supabase is asked for, and then both public settings are needed", () => {
  assert.equal(dataSourceFor("local", {}), "fixtures");
  assert.equal(dataSourceFor("local", { ALMAR_DATA_SOURCE: "fixtures" }), "fixtures");
  assert.equal(dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase", ...PUBLIC }), "supabase");
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase" }), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: PUBLIC.NEXT_PUBLIC_SUPABASE_URL }), /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.throws(() => dataSourceFor("local", { ALMAR_DATA_SOURCE: "supabse" }), /ALMAR_DATA_SOURCE/);
});

for (const target of ["preview", "production", "ops"]) {
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
