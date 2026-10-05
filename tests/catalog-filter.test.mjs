// The /experiences browser and the data layer use ONE CatalogFilter implementation (lib/data/catalog-filter.ts,
// design 3.2). This test proves the rule, the query-string contract and that the server read and the client
// filter agree over a fixed matrix in all three locales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, cpSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const filterMod = await loadTs("lib/data/catalog-filter.ts");
const expMod = await loadTs("lib/data/experiences.ts");
const destMod = await loadTs("lib/data/destinations.ts");

const { matchesCatalogFilter, filterCatalog, parseCatalogQuery, toCatalogQuery } = filterMod;
const { getCatalogItems, getCatalogItem, getCatalogForStay } = expMod;
const { getDestinationSlugs } = destMod;

const LOCALES = ["en", "ar", "es"];
const slugs = (list) => list.map((i) => i.slug);
const item = (o) => ({
  kind: "experience",
  name: "Name",
  summary: "Summary",
  destination_slugs: [],
  stay_slugs: [],
  ...o,
});

test("matchesCatalogFilter: kind, destinations, stays, query", () => {
  const cart = item({ destination_slugs: ["cartagena"], stay_slugs: ["x"] });
  assert.equal(matchesCatalogFilter(cart, {}), true);
  assert.equal(matchesCatalogFilter(cart, { kind: "service" }), false);
  assert.equal(matchesCatalogFilter(cart, { kind: "experience" }), true);
  assert.equal(matchesCatalogFilter(cart, { destinations: ["bogota", "cartagena"] }), true);
  assert.equal(matchesCatalogFilter(item({ destination_slugs: ["medellin"] }), { destinations: ["bogota", "cartagena"] }), false);
  assert.equal(matchesCatalogFilter(item({ destination_slugs: [] }), { destinations: ["bogota", "cartagena"] }), false);
  assert.equal(matchesCatalogFilter(cart, { stays: ["x", "y"] }), true);
  assert.equal(matchesCatalogFilter(cart, { stays: ["y"] }), false);
  assert.equal(matchesCatalogFilter(cart, { destinations: ["cartagena"], stays: ["x"] }), true);
  assert.equal(matchesCatalogFilter(cart, { destinations: ["cartagena"], stays: ["y"] }), false);
  assert.equal(matchesCatalogFilter(cart, { destinations: [], stays: [] }), true);
  const sky = item({ summary: "Aerial tours of Medellín's skyline" });
  assert.equal(matchesCatalogFilter(sky, { query: "  MEDELLÍN " }), true);
  assert.equal(matchesCatalogFilter(sky, { query: "zzzz" }), false);
  assert.equal(matchesCatalogFilter(item({ summary: null }), { query: "zzzz" }), false);
  assert.equal(matchesCatalogFilter(item({ summary: null }), { query: "name" }), true);
  assert.equal(matchesCatalogFilter(sky, { query: "" }), true);
  assert.equal(matchesCatalogFilter(sky, { query: "   " }), true);
});

test("filterCatalog keeps order and returns a new array", () => {
  const input = [item({ name: "a" }), item({ name: "b", kind: "service" }), item({ name: "c" })];
  const out = filterCatalog(input, { kind: "experience" });
  assert.deepEqual(out.map((i) => i.name), ["a", "c"]);
  assert.equal(input.length, 3);
  assert.notEqual(filterCatalog(input, {}), input);
});

test("parseCatalogQuery", () => {
  const p = (s, o) => parseCatalogQuery(new URLSearchParams(s), o);
  assert.deepEqual(p("type=service"), { kind: "service", destinations: [], stays: [] });
  assert.equal(p("type=tour").kind, undefined);
  assert.deepEqual(p("destination=cartagena,bogota").destinations, ["cartagena", "bogota"]);
  assert.deepEqual(p("destination=cartagena%2Cbogota").destinations, ["cartagena", "bogota"]);
  assert.deepEqual(p("destination=Cartagena,../x,,bogota,bogota").destinations, ["bogota"]);
  const many = Array.from({ length: 25 }, (_, i) => `d${i}`).join(",");
  assert.equal(p(`destination=${many}`).destinations.length, 20);
  assert.equal(p("item=vip-airport-meet-greet").item, "vip-airport-meet-greet");
  assert.equal(p("item=%3Cscript%3E").item, undefined);
  assert.equal(p("type=service&type=experience").kind, "service");
  assert.deepEqual(p("destination=cartagena,bogota", { destinations: ["cartagena"] }).destinations, ["cartagena"]);
  assert.equal(p("item=b", { items: ["a"] }).item, undefined);
  assert.equal(p("item=a", { items: ["a"] }).item, "a");
  assert.deepEqual(p("stay=casa-a,casa-b", { stays: ["casa-b"] }).stays, ["casa-b"]);
});

test("toCatalogQuery and the round trip", () => {
  assert.equal(toCatalogQuery({ destinations: [], stays: [] }), "");
  assert.equal(
    toCatalogQuery({ kind: "service", destinations: [], stays: [], item: "24-7-private-concierge" }),
    "?type=service&item=24-7-private-concierge",
  );
  assert.equal(
    toCatalogQuery({ kind: "experience", destinations: ["cartagena", "bogota"], stays: ["casa-jardin-san-diego"] }),
    "?type=experience&destination=cartagena,bogota&stay=casa-jardin-san-diego",
  );
  const cases = [
    { destinations: [], stays: [] },
    { kind: "service", destinations: [], stays: [], item: "24-7-private-concierge" },
    { kind: "experience", destinations: ["cartagena", "bogota"], stays: ["casa-jardin-san-diego"] },
    { destinations: ["medellin"], stays: ["a", "b"], item: "x" },
  ];
  for (const c of cases) {
    const out = toCatalogQuery(c);
    assert.deepEqual(parseCatalogQuery(new URLSearchParams(out.slice(1))), c);
    assert.doesNotMatch(out, /query|q=|search/);
  }
  assert.equal(toCatalogQuery({ destinations: ["Bad Slug", "ok"], stays: [], item: "<x>" }), "?destination=ok");
});

test("every catalogue item carries destination_slugs and stay_slugs in id order; AR = EN", async () => {
  const dests = JSON.parse(readFileSync("lib/data/fixtures/destinations.json", "utf8"));
  const stays = JSON.parse(readFileSync("lib/data/fixtures/stays.json", "utf8"));
  const dSlug = new Map(dests.map((d) => [d.id, d.slug]));
  const sSlug = new Map(stays.map((s) => [s.id, s.slug]));
  const rows = JSON.parse(readFileSync("lib/data/fixtures/catalog.json", "utf8"));
  for (const l of LOCALES) {
    for (const i of await getCatalogItems(l)) {
      const row = rows.find((r) => r.slug === i.slug);
      assert.deepEqual(i.destination_slugs, row.destination_ids.map((x) => dSlug.get(x)), `${l} ${i.slug}`);
      assert.deepEqual(i.stay_slugs, row.stay_ids.map((x) => sSlug.get(x)), `${l} ${i.slug}`);
    }
  }
  const wc = await getCatalogItem("en", "welcome-cocktail");
  assert.equal(wc.stay_slugs.length, 12);
  const mr = await getCatalogItem("en", "medellin-renaissance");
  assert.deepEqual(mr.stay_slugs, ["santa-fe-farm-antioquia", "sopetran-country-estate"]);
  const cht = await getCatalogItem("en", "cartagena-heritage-tours");
  assert.deepEqual(cht.stay_slugs, [
    "getsemani-colonial-house",
    "getsemani-courtyard-residence",
    "cartagena-historic-center-house",
    "casa-jardin-san-diego",
    "casa-juliana-historic-center",
    "casa-mariana-historic-center",
    "bocagrande-beach-house",
  ]);
  const forStay = await getCatalogForStay("en", "santa-fe-farm-antioquia");
  assert.ok(forStay.experiences.every((e) => Array.isArray(e.destination_slugs)));
});

test("single-slug options equal one-element lists", async () => {
  for (const l of LOCALES) {
    for (const d of ["cartagena", "medellin", "atlantis"]) {
      assert.deepEqual(
        slugs(await getCatalogItems(l, { destinationSlug: d })),
        slugs(await getCatalogItems(l, { destinationSlugs: [d] })),
      );
    }
    for (const s of ["santa-fe-farm-antioquia", "atlantis"]) {
      assert.deepEqual(
        slugs(await getCatalogItems(l, { staySlug: s })),
        slugs(await getCatalogItems(l, { staySlugs: [s] })),
      );
    }
  }
  assert.deepEqual(await getCatalogItems("en", { destinationSlug: "atlantis" }), []);
});

test("server read = client filter over the matrix, all locales", async () => {
  const destSlugs = await getDestinationSlugs();
  const MATRIX = [
    {},
    { kind: "experience" },
    { kind: "service" },
    ...destSlugs.map((d) => ({ destinations: [d] })),
    { destinations: ["cartagena", "medellin"] },
    { stays: ["santa-fe-farm-antioquia"] },
    { stays: ["casa-jardin-san-diego", "sopetran-country-estate"] },
    { destinations: ["cartagena"], stays: ["santa-fe-farm-antioquia"] },
    { query: "yacht" },
    { query: "MEDELLÍN" },
    { query: "medellin" },
    { query: "zzzz" },
    { query: "  spa " },
  ];
  const MIXED = { destinationSlug: "cartagena", destinationSlugs: ["bogota"] };
  for (const l of LOCALES) {
    const all = await getCatalogItems(l);
    assert.deepEqual(
      slugs(await getCatalogItems(l, MIXED)),
      slugs(filterCatalog(all, { destinations: ["cartagena", "bogota"] })),
      `${l} mixed single + list`,
    );
    for (const f of MATRIX) {
      const server = await getCatalogItems(l, {
        kind: f.kind,
        destinationSlugs: f.destinations,
        staySlugs: f.stays,
        query: f.query,
      });
      assert.deepEqual(slugs(server), slugs(filterCatalog(all, f)), `${l} ${JSON.stringify(f)}`);
    }
  }
});

test("EN facts on the full catalogue", async () => {
  const all = await getCatalogItems("en");
  assert.equal(all.length, 45);
  assert.equal((await getCatalogItems("en", { kind: "experience" })).length, 35);
  assert.equal((await getCatalogItems("en", { kind: "service" })).length, 10);
  assert.deepEqual(slugs(filterCatalog(all, { destinations: ["bogota", "san-andres"] })), ["bogota-art-gastronomy", "san-andres-diving-escape", "helicopter-city-tours", "private-city-guides"]);
  assert.deepEqual(slugs(filterCatalog(all, { stays: ["santa-fe-farm-antioquia"] })), ["welcome-cocktail", "medellin-renaissance", "medellin-discovery-tours", "24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"]);
  assert.deepEqual(slugs(filterCatalog(all, { destinations: ["cartagena"], stays: ["santa-fe-farm-antioquia"] })), ["welcome-cocktail", "24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"]);
  assert.deepEqual(slugs(filterCatalog(all, { query: "MEDELLÍN" })), ["private-ceremony-colombia", "medellin-renaissance", "medellin-discovery-tours", "helicopter-city-tours", "gourmet-food-tours", "helicopter-transfers", "private-city-guides"]);
  assert.deepEqual(filterCatalog(all, { destinations: ["cocora-valley"], kind: "service" }), []);
});

test("slugsOf throws on an unknown destination or stay id (isolated fixture copy)", async () => {
  const BAD = "00000000-0000-4000-8000-000000000000";
  const root = process.cwd();
  for (const [field, word] of [["destination_ids", "destination"], ["stay_ids", "stay"]]) {
    const tmp = mkdtempSync(join(tmpdir(), "almar-fx-"));
    mkdirSync(join(tmp, "lib", "data"), { recursive: true });
    cpSync(join(root, "lib", "data", "fixtures"), join(tmp, "lib", "data", "fixtures"), { recursive: true });
    const file = join(tmp, "lib", "data", "fixtures", "catalog.json");
    const rows = JSON.parse(readFileSync(file, "utf8"));
    const row = rows.find((r) => r.is_published);
    row[field] = [...row[field], BAD];
    writeFileSync(file, JSON.stringify(rows));
    try {
      const fresh = await loadTs("lib/data/experiences.ts");
      process.chdir(tmp);
      await assert.rejects(() => fresh.getCatalogItems("en"), new RegExp(`catalog .*: unknown ${word}`));
    } finally {
      process.chdir(root);
    }
  }
});

/** Runs `fn(fresh experiences module, temp root)` with an isolated copy of the fixtures that `mutate(name, rows)` has edited. */
async function withEditedFixtures(edits, fn) {
  const root = process.cwd();
  const tmp = mkdtempSync(join(tmpdir(), "almar-fx-"));
  mkdirSync(join(tmp, "lib", "data"), { recursive: true });
  cpSync(join(root, "lib", "data", "fixtures"), join(tmp, "lib", "data", "fixtures"), { recursive: true });
  for (const [name, edit] of Object.entries(edits)) {
    const file = join(tmp, "lib", "data", "fixtures", `${name}.json`);
    const rows = JSON.parse(readFileSync(file, "utf8"));
    edit(rows);
    writeFileSync(file, JSON.stringify(rows));
  }
  const fresh = await loadTs("lib/data/experiences.ts");
  try {
    process.chdir(tmp);
    return await fn(fresh, tmp);
  } finally {
    process.chdir(root);
  }
}

test("an unpublished stay is not joined into any item's stay_slugs (the overlay would link to a page that is not built)", async () => {
  const OFF = "santa-fe-farm-antioquia";
  await withEditedFixtures(
    { stays: (rows) => (rows.find((s) => s.slug === OFF).is_published = false) },
    async (fresh, tmp) => {
      const stays = JSON.parse(readFileSync(join(tmp, "lib", "data", "fixtures", "stays.json"), "utf8"));
      const published = new Set(stays.filter((s) => s.is_published).map((s) => s.slug));
      assert.equal(published.has(OFF), false);
      for (const l of LOCALES) {
        const all = await fresh.getCatalogItems(l);
        assert.equal(all.length, 45, l);
        for (const i of all) {
          assert.ok(i.stay_slugs.every((s) => published.has(s)), `${l} ${i.slug}: ${i.stay_slugs.filter((s) => !published.has(s))}`);
        }
        const mr = await fresh.getCatalogItem(l, "medellin-renaissance");
        assert.deepEqual(mr.stay_slugs, ["sopetran-country-estate"], l);
        // The filter agrees: the hidden stay offers nothing, so a bookmarked ?stay=<hidden> shows nothing.
        assert.deepEqual(await fresh.getCatalogItems(l, { staySlug: OFF }), [], l);
      }
      // The unpublished stay leaves the services' stay lists too: 12 stays become 11.
      const vip = await fresh.getCatalogItem("en", "vip-airport-meet-greet");
      assert.equal(vip.stay_slugs.length, 11);
    },
  );
});

test("an unpublished destination is not joined into any item's destination_slugs", async () => {
  const OFF = "cocora-valley";
  await withEditedFixtures(
    { destinations: (rows) => (rows.find((d) => d.slug === OFF).is_published = false) },
    async (fresh) => {
      for (const l of LOCALES) {
        const all = await fresh.getCatalogItems(l);
        for (const i of all) assert.equal(i.destination_slugs.includes(OFF), false, `${l} ${i.slug}`);
        const pcc = await fresh.getCatalogItem(l, "private-ceremony-colombia");
        assert.deepEqual(pcc.destination_slugs, ["cartagena", "medellin"], l);
        const coffee = await fresh.getCatalogItem(l, "coffee-region-immersion");
        assert.deepEqual(coffee.destination_slugs, [], l);
      }
    },
  );
});

test("the published fixtures still join every stay and destination (nothing is dropped when all are published)", async () => {
  const wc = await getCatalogItem("en", "welcome-cocktail");
  assert.equal(wc.stay_slugs.length, 12);
  const pcc = await getCatalogItem("en", "private-ceremony-colombia");
  assert.deepEqual(pcc.destination_slugs, ["cartagena", "medellin", "cocora-valley"]);
});
