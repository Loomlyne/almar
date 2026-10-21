// CMS-02: the price sort. Unrun in job 22 (owner: no test).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { sortByPrice, priceRanks, canSortByPrice, parsePriceSort, parseCatalogQuery, toCatalogQuery } = await loadTs("lib/data/catalog-filter.ts");

const items = [
  { id: "a", v: null },
  { id: "b", v: 300 },
  { id: "c", v: 100 },
  { id: "d", v: null },
  { id: "e", v: 100 },
];

test("position keeps the incoming order", () => {
  assert.deepEqual(sortByPrice(items, "position", (i) => i.v).map((i) => i.id), ["a", "b", "c", "d", "e"]);
});

test("low to high: unpriced last, ties keep order", () => {
  assert.deepEqual(sortByPrice(items, "price_asc", (i) => i.v).map((i) => i.id), ["c", "e", "b", "a", "d"]);
});

test("high to low: unpriced still last", () => {
  assert.deepEqual(sortByPrice(items, "price_desc", (i) => i.v).map((i) => i.id), ["b", "c", "e", "a", "d"]);
});

test("the address carries the sort and drops junk", () => {
  assert.equal(parsePriceSort("nope"), "position");
  const q = parseCatalogQuery(new URLSearchParams("sort=price_desc"));
  assert.equal(q.sort, "price_desc");
  assert.equal(toCatalogQuery(q), "?sort=price_desc");
  assert.equal(parseCatalogQuery(new URLSearchParams("sort=x")).sort, undefined);
});

test("priceRanks: unit first (person, night, trip), then amount; no price, no rank; equal prices share a rank", () => {
  const ranks = priceRanks([
    { slug: "trip-low", unit: "trip", price_aed: 10 },
    { slug: "person-high", unit: "person", price_aed: 500 },
    { slug: "person-low", unit: "person", price_aed: 50 },
    { slug: "person-low-2", unit: "person", price_aed: 50 },
    { slug: "night", unit: "night", price_aed: 5 },
    { slug: "none", unit: "person", price_aed: null },
  ]);
  assert.equal(ranks.get("person-low"), 0);
  assert.equal(ranks.get("person-low-2"), 0);
  assert.equal(ranks.get("person-high"), 1);
  assert.equal(ranks.get("night"), 2);
  assert.equal(ranks.get("trip-low"), 3);
  assert.equal(ranks.has("none"), false);
});

test("the sort is offered only with two ranked items in the view", () => {
  assert.equal(canSortByPrice([]), false);
  assert.equal(canSortByPrice([{ sort_rank: 0 }, { sort_rank: null }]), false);
  assert.equal(canSortByPrice([{ sort_rank: 0 }, { sort_rank: 1 }, { sort_rank: null }]), true);
});
