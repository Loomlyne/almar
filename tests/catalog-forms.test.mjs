// The pure side of Catalog -> Destinations and Experiences and services (plan 03.2-06): what the kit editor is told is
// live (liveTranslations), the list filter and the price grouping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { liveFields, filterCatalogRows, groupAmount, emptyCatalogItemForm, NO_CATALOG_FILTER } = await loadTs("app/dashboard/(ops)/catalog/catalog-forms.ts");

const text = (name, summary = "") => ({ name, summary, duration_label: "" });
const saved = { en: text("Coffee farm", "A morning"), ar: text("مزرعة البن", "صباح"), es: text("Finca cafetera", "") };

test("liveFields: nothing is live on an unpublished item", () => {
  assert.deepEqual(liveFields(false, { en: "published", ar: "published", es: "published" }, saved), {});
});

test("liveFields: a published item is live in each published language, in the fields that have text", () => {
  assert.deepEqual(liveFields(true, { en: "published", ar: "published", es: "published" }, saved), {
    ar: ["name", "summary"],
    es: ["name"],
  });
});

test("liveFields: a language still in draft is not live", () => {
  assert.deepEqual(liveFields(true, { en: "published", ar: "draft", es: "published" }, saved), { es: ["name"] });
});

test("liveFields: blank text does not count as live", () => {
  assert.deepEqual(liveFields(true, { en: "published", ar: "published", es: "draft" }, { ...saved, ar: text("  ") }), { ar: [] });
});

test("a new item starts with no price and English published, Arabic and Spanish draft", () => {
  const form = emptyCatalogItemForm();
  assert.equal(form.price, "");
  assert.deepEqual(form.status, { en: "published", ar: "draft", es: "draft" });
});

test("filterCatalogRows: type, destination and accent-folded search together, position order", () => {
  const rows = [
    { position: 2, kind: "service", name: "Traslado", destinationIds: ["d1"], stayIds: [] },
    { position: 1, kind: "experience", name: "Café tour", destinationIds: ["d1"], stayIds: ["s1"] },
    { position: 3, kind: "service", name: "Chef", destinationIds: ["d2"], stayIds: [] },
  ];
  assert.deepEqual(filterCatalogRows(rows, NO_CATALOG_FILTER).map((r) => r.position), [1, 2, 3]);
  assert.deepEqual(filterCatalogRows(rows, { ...NO_CATALOG_FILTER, kind: "service", destinationId: "d1" }).map((r) => r.name), ["Traslado"]);
  assert.deepEqual(filterCatalogRows(rows, { ...NO_CATALOG_FILTER, query: "cafe" }).map((r) => r.name), ["Café tour"]);
});

test("groupAmount groups the digits of a decimal string and leaves anything else alone", () => {
  assert.equal(groupAmount("1250"), "1,250");
  assert.equal(groupAmount("1250.5"), "1,250.50");
  assert.equal(groupAmount("[PRICE]"), "[PRICE]");
});
