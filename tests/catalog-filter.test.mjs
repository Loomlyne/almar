// The /experiences browser and the data layer use ONE CatalogFilter implementation (lib/data/catalog-filter.ts,
// design 3.2). This test proves the rule, the query-string contract and that the server read and the client
// filter agree over a fixed matrix in all three locales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  for (const l of LOCALES) {
    const all = await getCatalogItems(l);
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
