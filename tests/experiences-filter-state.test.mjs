// The /experiences page's filter state as pure functions (phase 3.3 plan 14, task 2): controls to CatalogFilter, the URL in and
// out, chips, groups, and the locked counts of design 3.4 in all three locales. The filter RULE is lib/data/catalog-filter.ts
// (plan 10); this file proves the page only maps its controls onto it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const stateMod = await loadTs("components/pages/experiences/filter-state.ts");
const filterMod = await loadTs("lib/data/catalog-filter.ts");
const experiencesMod = await loadTs("lib/data/experiences.ts");
const destinationsMod = await loadTs("lib/data/destinations.ts");
const staysMod = await loadTs("lib/data/stays.ts");

const {
  EMPTY_STATE,
  activeChips,
  isFiltered,
  removeChip,
  setDestinations,
  setStays,
  sheetFilterCount,
  splitGroups,
  stateFromQuery,
  stayOptions,
  toCatalogFilter,
  toggleDestination,
  toggleStay,
  urlQuery,
} = stateMod;
const { filterCatalog, parseCatalogQuery } = filterMod;
const { getCatalogItems } = experiencesMod;
const { getDestinations } = destinationsMod;
const { getStays } = staysMod;

const LOCALES = ["en", "ar", "es"];
const state = (patch = {}) => ({ ...EMPTY_STATE, destinations: [], stays: [], ...patch });

const DESTINATION_ORDER = ["cartagena", "medellin", "bogota", "san-andres", "cocora-valley"];
const stays = (await getStays("en")).map((s) => ({ slug: s.slug, destination_slug: s.destination_slug }));
const itemSlugs = (await getCatalogItems("en")).map((i) => i.slug);
const ctx = { destinations: DESTINATION_ORDER, stays, items: itemSlugs };

test("EMPTY_STATE maps to the filter {} and is not filtered", () => {
  assert.deepEqual(EMPTY_STATE, { query: "", kind: "all", destinations: [], stays: [] });
  assert.deepEqual(toCatalogFilter(EMPTY_STATE), {});
  assert.equal(isFiltered(EMPTY_STATE), false);
  assert.equal(sheetFilterCount(EMPTY_STATE), 0);
});

test("toCatalogFilter leaves out every empty control and trims the query", () => {
  assert.deepEqual(toCatalogFilter(state({ query: "   " })), {});
  assert.deepEqual(toCatalogFilter(state({ query: "  yacht " })), { query: "yacht" });
  assert.deepEqual(toCatalogFilter(state({ kind: "service" })), { kind: "service" });
  assert.deepEqual(toCatalogFilter(state({ destinations: ["cartagena"], stays: ["x"] })), { destinations: ["cartagena"], stays: ["x"] });
});

test("isFiltered is true when any of the four narrows; a blank query does not", () => {
  assert.equal(isFiltered(state({ query: " " })), false);
  assert.equal(isFiltered(state({ query: "a" })), true);
  assert.equal(isFiltered(state({ kind: "experience" })), true);
  assert.equal(isFiltered(state({ destinations: ["bogota"] })), true);
  assert.equal(isFiltered(state({ stays: ["santa-fe-farm-antioquia"] })), true);
});

test("sheetFilterCount counts destinations and stays only", () => {
  assert.equal(sheetFilterCount(state({ query: "x", kind: "service" })), 0);
  assert.equal(sheetFilterCount(state({ destinations: ["a", "b"], stays: ["c"] })), 3);
});

test("stayOptions: every stay with no destination, else only the checked destinations' stays, in order", () => {
  assert.deepEqual(stayOptions(stays, []).map((s) => s.slug), stays.map((s) => s.slug));
  assert.deepEqual(stayOptions(stays, ["medellin"]).map((s) => s.slug), ["santa-fe-farm-antioquia", "sopetran-country-estate"]);
  assert.equal(stayOptions(stays, ["cartagena", "medellin"]).length, 12);
  assert.deepEqual(stayOptions(stays, ["bogota"]), []);
});

test("toggleDestination adds in the offered order, removes, and drops stays outside the checked destinations", () => {
  let s = toggleDestination(EMPTY_STATE, "medellin", stays, DESTINATION_ORDER);
  assert.deepEqual(s.destinations, ["medellin"]);
  s = toggleDestination(s, "cartagena", stays, DESTINATION_ORDER);
  assert.deepEqual(s.destinations, ["cartagena", "medellin"], "kept in the offered order");
  s = toggleDestination(s, "cartagena", stays, DESTINATION_ORDER);
  assert.deepEqual(s.destinations, ["medellin"]);

  const withStays = state({ destinations: ["cartagena", "medellin"], stays: ["getsemani-colonial-house", "santa-fe-farm-antioquia"] });
  const onlyMedellin = toggleDestination(withStays, "cartagena", stays, DESTINATION_ORDER);
  assert.deepEqual(onlyMedellin.stays, ["santa-fe-farm-antioquia"], "a Cartagena stay is unchecked");

  const none = toggleDestination(state({ destinations: ["medellin"], stays: ["santa-fe-farm-antioquia"] }), "medellin", stays, DESTINATION_ORDER);
  assert.deepEqual(none.destinations, []);
  assert.deepEqual(none.stays, ["santa-fe-farm-antioquia"], "unchecking the last destination keeps the checked stays");
});

test("setDestinations and setStays take the next list from a checkbox group", () => {
  const withStays = state({ destinations: ["cartagena", "medellin"], stays: ["getsemani-colonial-house", "santa-fe-farm-antioquia"] });
  assert.deepEqual(setDestinations(withStays, ["medellin"], stays).stays, ["santa-fe-farm-antioquia"]);
  assert.deepEqual(setStays(withStays, ["sopetran-country-estate"]).stays, ["sopetran-country-estate"]);
});

test("toggleStay adds and removes in the offered stay order", () => {
  const order = stays.map((s) => s.slug);
  let s = toggleStay(EMPTY_STATE, "santa-fe-farm-antioquia", order);
  s = toggleStay(s, "getsemani-colonial-house", order);
  assert.deepEqual(s.stays, ["getsemani-colonial-house", "santa-fe-farm-antioquia"]);
  s = toggleStay(s, "getsemani-colonial-house", order);
  assert.deepEqual(s.stays, ["santa-fe-farm-antioquia"]);
});

test("stateFromQuery keeps only what the page offers and never sets a search text", () => {
  const q = (text) => parseCatalogQuery(new URLSearchParams(text));
  const good = stateFromQuery(q("type=service&destination=medellin&stay=santa-fe-farm-antioquia&item=vip-airport-meet-greet"), ctx);
  assert.deepEqual(good.state, state({ kind: "service", destinations: ["medellin"], stays: ["santa-fe-farm-antioquia"] }));
  assert.equal(good.item, "vip-airport-meet-greet");

  // bad input: bogus type, unknown destination dropped but the real one kept, unknown stay, unknown item
  const bad = stateFromQuery(q("type=bogus&destination=nowhere,cartagena&stay=nope&item=unknown-slug"), ctx);
  assert.deepEqual(bad.state, state({ destinations: ["cartagena"] }));
  assert.equal(bad.item, null);

  assert.deepEqual(stateFromQuery(q("destination=&stay=&item="), ctx), { state: EMPTY_STATE, item: null });
  assert.deepEqual(stateFromQuery(q("destination=cartagena,cartagena"), ctx).state.destinations, ["cartagena"], "duplicates");
  assert.deepEqual(stateFromQuery(q("destination=CARTAGENA"), ctx).state.destinations, [], "uppercase slugs are not slugs");
  assert.deepEqual(stateFromQuery(q("item=VIP-Airport"), ctx).item, null);

  // a stay outside the kept destinations is dropped; with no destination it is kept
  assert.deepEqual(stateFromQuery(q("destination=medellin&stay=getsemani-colonial-house"), ctx).state.stays, []);
  assert.deepEqual(stateFromQuery(q("stay=getsemani-colonial-house"), ctx).state.stays, ["getsemani-colonial-house"]);
  assert.equal(stateFromQuery(q("q=yacht"), ctx).state.query, "");
});

test("urlQuery equals toCatalogQuery with kind left out for all, never carries the search text, and round-trips", () => {
  assert.equal(urlQuery(EMPTY_STATE, null), "");
  assert.equal(urlQuery(state({ query: "yacht" }), null), "", "search text is never in the URL");
  assert.equal(urlQuery(state({ kind: "service" }), null), "?type=service");
  assert.equal(urlQuery(state({}), "welcome-cocktail"), "?item=welcome-cocktail");
  const full = state({ kind: "experience", destinations: ["cartagena", "medellin"], stays: ["santa-fe-farm-antioquia"] });
  assert.equal(urlQuery(full, "welcome-cocktail"), "?type=experience&destination=cartagena,medellin&stay=santa-fe-farm-antioquia&item=welcome-cocktail");
  const back = stateFromQuery(parseCatalogQuery(new URLSearchParams(urlQuery(full, "welcome-cocktail"))), ctx);
  assert.deepEqual(back.state, full);
  assert.equal(back.item, "welcome-cocktail");
});

test("activeChips are in the order type, destinations, stays with the given labels; removeChip removes exactly one", () => {
  const names = {
    kinds: { experience: "Experiences", service: "Services" },
    destinations: { cartagena: "Cartagena", medellin: "Medellín" },
    stays: { "santa-fe-farm-antioquia": "Santa Fe Farm" },
  };
  const s = state({ kind: "service", destinations: ["cartagena", "medellin"], stays: ["santa-fe-farm-antioquia"] });
  const chips = activeChips(s, names);
  assert.deepEqual(chips.map(({ group, value, label }) => [group, value, label]), [
    ["type", "service", "Services"],
    ["destination", "cartagena", "Cartagena"],
    ["destination", "medellin", "Medellín"],
    ["stay", "santa-fe-farm-antioquia", "Santa Fe Farm"],
  ]);
  assert.equal(new Set(chips.map((c) => c.key)).size, 4, "keys are unique");
  assert.deepEqual(activeChips(EMPTY_STATE, names), []);
  assert.deepEqual(activeChips(state({ query: "yacht" }), names), [], "the search text is not a chip");
  assert.deepEqual(removeChip(s, chips[0]), state({ destinations: ["cartagena", "medellin"], stays: ["santa-fe-farm-antioquia"] }));
  assert.deepEqual(removeChip(s, chips[1]).destinations, ["medellin"]);
  assert.deepEqual(removeChip(s, chips[3]).stays, []);
  assert.equal(removeChip(s, chips[1]).kind, "service");
});

test("splitGroups keeps input order", () => {
  const items = [
    { slug: "a", kind: "experience" },
    { slug: "b", kind: "service" },
    { slug: "c", kind: "experience" },
  ];
  const { experiences, services } = splitGroups(items);
  assert.deepEqual(experiences.map((i) => i.slug), ["a", "c"]);
  assert.deepEqual(services.map((i) => i.slug), ["b"]);
});

// The locked counts of design 3.4, as literals and recomputed from the fixtures so a data drift fails loudly.
const LOCKED = { cartagena: 14, medellin: 11, bogota: 3, "san-andres": 1, "cocora-valley": 4 };

for (const locale of LOCALES) {
  test(`locked counts through the page's own mapping (${locale})`, async () => {
    const items = await getCatalogItems(locale);
    const count = (patch) => filterCatalog(items, toCatalogFilter(state(patch))).length;
    assert.equal(items.length, 45);
    assert.equal(count({}), 45);
    for (const [slug, want] of Object.entries(LOCKED)) {
      assert.equal(count({ destinations: [slug] }), want, `${locale} ${slug}`);
      assert.equal(items.filter((i) => i.destination_slugs.includes(slug)).length, want, `${locale} ${slug} recomputed`);
    }
    assert.equal(count({ kind: "service" }), 10);
    assert.equal(count({ kind: "experience" }), 35);
    assert.equal(count({ stays: ["santa-fe-farm-antioquia"] }), 6);
    if (locale === "en") assert.equal(count({ query: "yacht" }), 2);
    assert.equal(count({ query: "zzzz" }), 0);
    const groups = splitGroups(filterCatalog(items, {}));
    assert.deepEqual([groups.experiences.length, groups.services.length], [35, 10]);
    const destinations = await getDestinations(locale, { includeEmpty: true });
    assert.deepEqual(destinations.map((d) => d.slug), DESTINATION_ORDER);
    const staysHere = await getStays(locale);
    assert.deepEqual(stayOptions(staysHere, ["medellin"]).map((s) => s.slug), ["santa-fe-farm-antioquia", "sopetran-country-estate"]);
  });
}

test("the module is pure: no React, no client directive, no window", () => {
  const source = readFileSync("components/pages/experiences/filter-state.ts", "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/use client|from "react"|window\.|document\./.test(source));
  assert.ok(!/from "[./]*lib\/data\/(?!types"|catalog-filter")/.test(source), "imports only types and catalog-filter from lib/data");
});
