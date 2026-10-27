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

// ---- Task 2: detail -> form -> save payload ----------------------------------------------------------------------

const {
  normalisePrice,
  catalogItemPayload,
  destinationPayload,
  catalogItemFormOf,
  destinationFormOf,
  withTranslations,
  connectionChanges,
  movedIds,
  emptyDestinationForm,
  liveGaps,
  strandedItems,
  connectedAfter,
  afterSave,
} = await loadTs("app/dashboard/(ops)/catalog/catalog-forms.ts");
const { saveThenPublish, saveConnections } = await loadTs("app/dashboard/(ops)/catalog/persist.ts");

test("normalisePrice: empty is not set, a decimal gets two places, anything else is refused", () => {
  assert.deepEqual(normalisePrice(""), { ok: true, value: null });
  assert.deepEqual(normalisePrice("  "), { ok: true, value: null });
  assert.deepEqual(normalisePrice("1250"), { ok: true, value: "1250.00" });
  assert.deepEqual(normalisePrice("12.5"), { ok: true, value: "12.50" });
  assert.deepEqual(normalisePrice("007.25"), { ok: true, value: "7.25" });
  assert.deepEqual(normalisePrice("0"), { ok: true, value: "0.00" });
  for (const bad of ["abc", "-1", "1.234", "1,250", "1e3", "12."]) assert.deepEqual(normalisePrice(bad), { ok: false }, bad);
});

test("normalisePrice: at most 10 whole digits, as the server's MONEY (leading zeros do not count)", () => {
  assert.deepEqual(normalisePrice("9999999999.99"), { ok: true, value: "9999999999.99" });
  assert.deepEqual(normalisePrice("0009999999999"), { ok: true, value: "9999999999.00" });
  assert.deepEqual(normalisePrice("10000000000"), { ok: false });
  assert.deepEqual(normalisePrice("12345678901.5"), { ok: false });
});

const itemDetail = {
  id: "c1",
  slug: "coffee-farm",
  kind: "experience",
  unit: "person",
  price_aed: "1250.00",
  is_uae: false,
  is_home_pickup: true,
  media_id: "m1",
  image: { id: "m1", key: "k", url: "https://media.example/k", width: 1, height: 1, alt_en: "Farm" },
  destination_ids: ["d1"],
  stay_ids: ["s1"],
  is_published: false,
  position: 1,
  translations: {
    en: { name: "Coffee farm", summary: "A morning", duration_label: null, status: "published" },
    ar: { name: "مزرعة البن", summary: null, duration_label: null, status: "draft" },
    es: null,
  },
  translation_state: { en: "published", ar: "draft", es: "missing" },
  updated_at: "2026-10-15T00:00:00Z",
};

test("catalogItemFormOf: nulls become empty strings, a missing language is an empty draft", () => {
  const form = catalogItemFormOf(itemDetail);
  assert.equal(form.price, "1250.00");
  assert.equal(form.media.id, "m1");
  assert.deepEqual(form.text.en, { name: "Coffee farm", summary: "A morning", duration_label: "" });
  assert.deepEqual(form.text.es, { name: "", summary: "", duration_label: "" });
  assert.deepEqual(form.status, { en: "published", ar: "draft", es: "draft" });
});

test("catalogItemPayload on Save: the facts as booleans and money strings, Arabic stays draft, empty Spanish is null", () => {
  const form = { ...catalogItemFormOf(itemDetail), price: "1300.5" };
  const out = catalogItemPayload(form, { publish: false });
  assert.equal(out.ok, true);
  assert.deepEqual(out.item, {
    id: "c1",
    slug: "coffee-farm",
    kind: "experience",
    unit: "person",
    price_aed: "1300.50",
    is_uae: false,
    is_home_pickup: true,
    media_id: "m1",
    destination_ids: ["d1"],
    stay_ids: ["s1"],
    translations: {
      en: { name: "Coffee farm", summary: "A morning", duration_label: null, status: "published" },
      ar: { name: "مزرعة البن", summary: null, duration_label: null, status: "draft", locked_fields: [] },
      es: null,
    },
  });
});

test("catalogItemPayload on Publish: Arabic and Spanish with text go out published", () => {
  const form = withTranslations(catalogItemFormOf(itemDetail), { ar: { name: "[AR] Coffee farm", summary: "[AR] A morning" }, es: { name: "[ES] Coffee farm", summary: "[ES] A morning" } });
  const out = catalogItemPayload(form, { publish: true });
  assert.equal(out.item.translations.ar.status, "published");
  assert.equal(out.item.translations.es.status, "published");
  assert.equal(out.item.translations.es.name, "[ES] Coffee farm");
});

test("catalogItemPayload: a published language stays published on Save; a published item sends no web address", () => {
  const form = { ...catalogItemFormOf({ ...itemDetail, is_published: true }), status: { en: "published", ar: "published", es: "draft" } };
  form.text.es = { name: "[ES] x", summary: "", duration_label: "" };
  const out = catalogItemPayload(form, { publish: false });
  assert.equal("slug" in out.item, false);
  assert.equal(out.item.translations.ar.status, "published");
  assert.equal(out.item.translations.es.status, "draft");
});

test("catalogItemPayload: a price that is not money is refused before any request; empty price is null", () => {
  const form = catalogItemFormOf(itemDetail);
  assert.deepEqual(catalogItemPayload({ ...form, price: "abc" }, { publish: false }), { ok: false, field: "price_aed" });
  assert.equal(catalogItemPayload({ ...form, price: "" }, { publish: false }).item.price_aed, null);
});

test("a language with text but no name is left out (the server needs a name), not sent half", () => {
  const form = catalogItemFormOf(itemDetail);
  form.text.ar = { name: "", summary: "صباح", duration_label: "" };
  const out = catalogItemPayload(form, { publish: false });
  assert.equal("ar" in out.item.translations, false);
});

test("destinationPayload: a new destination sends its slug, photos and English; empty optional English is null", () => {
  const blank = emptyDestinationForm();
  const form = { ...blank, slug: " cartagena ", text: { ...blank.text, en: { ...blank.text.en, name: "Cartagena", region: "Caribbean" } } };
  assert.deepEqual(destinationPayload(form, { publish: false }), {
    slug: "cartagena",
    hero_media_id: null,
    inset_media_id: null,
    translations: {
      en: { name: "Cartagena", short_line: null, region: "Caribbean", summary: null, nights_label: null, status: "published" },
      ar: null,
      es: null,
    },
  });
});

test("destinationFormOf then destinationPayload keeps the photos and drops the web address once published", () => {
  const detail = {
    id: "d1",
    slug: "cartagena",
    is_published: true,
    position: 1,
    hero_media_id: "h1",
    inset_media_id: null,
    hero: { id: "h1", key: "h", url: "https://media.example/h", width: 1, height: 1, alt_en: "x" },
    inset: null,
    translations: { en: { name: "Cartagena", short_line: null, region: null, summary: null, nights_label: null, status: "published" }, ar: null, es: null },
    translation_state: { en: "published", ar: "missing", es: "missing" },
    updated_at: "2026-10-15T00:00:00Z",
  };
  const out = destinationPayload(destinationFormOf(detail), { publish: false });
  assert.equal(out.id, "d1");
  assert.equal("slug" in out, false);
  assert.equal(out.hero_media_id, "h1");
});

test("connectionChanges: connecting adds the destination to that item, Remove takes it off, the rest are untouched", () => {
  const items = [
    { id: "c1", destination_ids: ["d1", "d2"] },
    { id: "c2", destination_ids: ["d2"] },
    { id: "c3", destination_ids: [] },
  ];
  assert.deepEqual(connectionChanges(items, "d1", ["c1", "c3"]), [{ id: "c3", destination_ids: ["d1"] }]);
  assert.deepEqual(connectionChanges(items, "d1", []), [{ id: "c1", destination_ids: ["d2"] }]);
  assert.deepEqual(connectionChanges(items, "d1", ["c1"]), []);
});

test("movedIds: one row up or down in position order; the ends do not move", () => {
  const rows = [
    { id: "b", position: 2 },
    { id: "a", position: 1 },
    { id: "c", position: 3 },
  ];
  assert.deepEqual(movedIds(rows, "b", -1), ["b", "a", "c"]);
  assert.deepEqual(movedIds(rows, "b", 1), ["a", "c", "b"]);
  assert.deepEqual(movedIds(rows, "a", -1), ["a", "b", "c"]);
});

test("liveGaps: a published item cannot be saved without its photo, its destination or its English; AR/ES are the kit's", () => {
  const missing = [
    { locale: null, field: "media_id" },
    { locale: null, field: "destination_ids" },
    { locale: "en", field: "name" },
    { locale: "ar", field: "name" },
    { locale: "es", field: "summary" },
  ];
  assert.deepEqual(liveGaps(true, missing), missing.slice(0, 3));
  assert.deepEqual(liveGaps(false, missing), []);
  assert.deepEqual(liveGaps(true, []), []);
});

test("strandedItems: only a published item left with no destination is refused", () => {
  const items = [
    { id: "c1", name_en: "Coffee farm", is_published: true, destination_ids: ["d1"] },
    { id: "c2", name_en: "Airport transfer", is_published: true, destination_ids: ["d1", "d2"] },
    { id: "c3", name_en: "Chef dinner", is_published: false, destination_ids: ["d1"] },
  ];
  assert.deepEqual(strandedItems(items, "d1", []), [{ id: "c1", name: "Coffee farm" }]);
  assert.deepEqual(strandedItems(items, "d1", ["c1"]), []);
  assert.deepEqual(strandedItems(items, "d2", []), []);
});

test("connectedAfter: the owner's change applied to the list read now, keeping a change made elsewhere", () => {
  assert.deepEqual(connectedAfter(["c1"], ["c1", "c2"], ["c1", "c3"]), ["c1", "c3", "c2"]);
  assert.deepEqual(connectedAfter(["c1", "c2"], ["c2"], ["c1", "c2", "c3"]), ["c2", "c3"]);
  assert.deepEqual(connectedAfter([], ["c2"], ["c2"]), ["c2"]);
});

/** A fake send: answers in order from `replies` (default: taken) and records every call. */
function fakeSend(replies = {}) {
  const calls = [];
  const send = async (path, body) => {
    calls.push({ path, body });
    const answer = replies[calls.length];
    if (answer) return answer;
    if (path === "/api/ops/publish") return { ok: true, id: body.id, is_published: true, affects_site: true, warnings: [{ code: "no_price" }] };
    return { ok: true, id: body.item?.id ?? "new-id", affects_site: true };
  };
  return { send, calls };
}
const refused = (code) => ({ ok: false, status: 409, error: { code, field: null, locale: null, detail: null } });

test("saveThenPublish: the save first, then the publish call with the saved id", async () => {
  const { send, calls } = fakeSend();
  const result = await saveThenPublish(send, "/api/ops/catalog", "catalog_item", { slug: "x" }, true);
  assert.deepEqual(calls, [
    { path: "/api/ops/catalog", body: { action: "save", item: { slug: "x" } } },
    { path: "/api/ops/publish", body: { entity: "catalog_item", id: "new-id", published: true } },
  ]);
  assert.deepEqual(result, { ok: true, id: "new-id", publishError: null, warnings: ["no_price"] });
});

test("saveThenPublish: a refused save never calls publish; a refused publish still reports the saved id", async () => {
  const one = fakeSend({ 1: refused("slug_taken") });
  assert.deepEqual(await saveThenPublish(one.send, "/api/ops/destinations", "destination", { id: "d2" }, true), { ok: false, error: refused("slug_taken").error });
  assert.equal(one.calls.length, 1);
  const two = fakeSend({ 2: refused("publish_incomplete") });
  assert.deepEqual(await saveThenPublish(two.send, "/api/ops/destinations", "destination", { id: "d2" }, true), {
    ok: true,
    id: "d2",
    publishError: refused("publish_incomplete").error,
    warnings: [],
  });
  const save = fakeSend();
  await saveThenPublish(save.send, "/api/ops/destinations", "destination", { id: "d2" }, false);
  assert.equal(save.calls.length, 1, "a Save sends no publish call");
});

test("saveConnections: stops at the first refusal and says how many saved, of how many, and which item", async () => {
  const { send, calls } = fakeSend({ 2: refused("invalid") });
  const changes = [
    { id: "c2", destination_ids: ["d2", "d1"] },
    { id: "c3", destination_ids: ["d1"] },
    { id: "c4", destination_ids: ["d1"] },
  ];
  assert.deepEqual(await saveConnections(send, changes), { saved: 1, total: 3, failed: { id: "c3", error: refused("invalid").error } });
  assert.equal(calls.length, 2);
  assert.deepEqual(await saveConnections(fakeSend().send, changes), { saved: 3, total: 3, failed: null });
});

test("afterSave: the new id; after a taken Publish, published, with each language that has a name published", () => {
  const form = {
    ...emptyDestinationForm(),
    slug: "medellin",
    text: { en: { ...emptyDestinationForm().text.en, name: "Medellin" }, ar: { ...emptyDestinationForm().text.ar, name: "ميديلين" }, es: emptyDestinationForm().text.es },
    status: { en: "published", ar: "draft", es: "draft" },
  };
  assert.deepEqual(afterSave(form, "d2", false), { ...form, id: "d2" });
  const held = afterSave(form, "d2", true);
  assert.equal(held.id, "d2");
  assert.equal(held.published, true);
  assert.deepEqual(held.status, { en: "published", ar: "published", es: "draft" });
  const payload = destinationPayload(held, { publish: false });
  assert.equal("slug" in payload, false, "the address is fixed once published");
  assert.equal(payload.translations.ar.status, "published", "a Save keeps the published Arabic published");
});
