// Plan 03.2-07 step 4: what the connected stays screen builds from the /api/ops replies
// (app/dashboard/(ops)/catalog/stays/stays-data.ts). Pure: rows, choices, the destination's own items, live languages,
// the no-rate warning and Move up / Move down. Bracket data only: no rate, fee or person.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const data = await loadTs("app/dashboard/(ops)/catalog/stays/stays-data.ts");

const summary = (id, position, patch = {}) => ({
  id,
  slug: `stay-${id}`,
  title_en: `[Stay ${id}]`,
  destination_id: "d1",
  destination_name_en: "[Destination 1]",
  is_published: false,
  position,
  base_nightly_rate_aed: null,
  bookable: false,
  hero: null,
  translation_state: { en: "complete", ar: "missing", es: "missing" },
  updated_at: "2026-10-17T00:00:00Z",
  ...patch,
});

const text = (patch = {}) => ({
  title: "[Title]",
  tagline: "",
  neighborhood: null,
  guests_label: "",
  bathrooms_label: "",
  beds_label: "",
  price_label: "",
  price_note: "",
  description: [],
  amenities: [],
  inclusions: [],
  policy_headings: [],
  status: "draft",
  ...patch,
});

const detail = (id, patch = {}) => ({
  id,
  slug: `stay-${id}`,
  destination_id: "d1",
  is_published: false,
  position: 0,
  max_guests: null,
  min_guests: null,
  bedrooms: null,
  bathrooms: null,
  min_nights: 1,
  pets_rule: null,
  pets_fee_aed: null,
  infants_count: null,
  base_nightly_rate_aed: null,
  hero_media_id: null,
  hero: null,
  gallery: [],
  experience_ids: [],
  service_ids: [],
  has_access: false,
  translations: { en: text(), ar: null, es: null },
  translation_state: { en: "complete", ar: "missing", es: "missing" },
  updated_at: "2026-10-17T00:00:00Z",
  ...patch,
});

const item = (id, kind, position, destination_ids = []) => ({
  id,
  slug: id,
  kind,
  unit: "person",
  price_aed: null,
  is_uae: false,
  is_home_pickup: false,
  name_en: `[${kind} ${id}]`,
  is_published: true,
  position,
  image: null,
  destination_ids,
  stay_count: 0,
  translation_state: { en: "complete", ar: "complete", es: "complete" },
  updated_at: "2026-10-17T00:00:00Z",
});

test("rows follow position and count each stay's experiences and services from its own ids", () => {
  const details = new Map([
    ["s1", detail("s1", { experience_ids: ["e1", "e2"], service_ids: ["v1"] })],
    ["s2", detail("s2")],
  ]);
  const rows = data.stayRows([summary("s2", 1, { is_published: true }), summary("s1", 0)], details);
  assert.deepEqual(
    rows.map((row) => [row.id, row.connected, row.published]),
    [
      ["s1", 3, false],
      ["s2", 0, true],
    ],
  );
  assert.equal(rows[0].name, "[Stay s1]");
  assert.equal(rows[0].destinationName, "[Destination 1]");
});

test("the picker offers experiences first, then services, each in its own order", () => {
  const choices = data.catalogChoices([item("v1", "service", 0), item("e2", "experience", 1), item("e1", "experience", 0)]);
  assert.deepEqual(
    choices.map((one) => [one.id, one.kind]),
    [
      ["e1", "experience"],
      ["e2", "experience"],
      ["v1", "service"],
    ],
  );
});

test("the destination's own items are its catalog links, none when no destination is chosen", () => {
  const catalog = [item("e1", "experience", 0, ["d1"]), item("e2", "experience", 1, ["d2"]), item("v1", "service", 0, ["d1", "d2"])];
  assert.deepEqual(data.destinationItemIds(catalog, "d1"), ["e1", "v1"]);
  assert.deepEqual(data.destinationItemIds(catalog, ""), []);
});

test("destination choices keep position and say which are published", () => {
  const destinations = [
    { id: "d2", slug: "b", name_en: "[B]", is_published: false, position: 1, stay_count: 0, published_stay_count: 0, hero: null, translation_state: {}, updated_at: "" },
    { id: "d1", slug: "a", name_en: "[A]", is_published: true, position: 0, stay_count: 0, published_stay_count: 0, hero: null, translation_state: {}, updated_at: "" },
  ];
  assert.deepEqual(data.destinationChoices(destinations), [
    { id: "d1", name: "[A]", published: true },
    { id: "d2", name: "[B]", published: false },
  ]);
});

test("live fields: only a published Arabic or Spanish text, and in it only the fields with text", () => {
  assert.deepEqual(data.liveStayFields(null), {});
  const stay = detail("s1", {
    translations: {
      en: text({ status: "published" }),
      ar: text({ status: "published", tagline: "[ar]", amenities: ["[a]", " "] }),
      es: text({ status: "draft", tagline: "[es]" }),
    },
  });
  assert.deepEqual(data.liveStayFields(stay), { ar: ["title", "tagline", "amenities"] });
  assert.deepEqual(data.liveLanguages(stay), { en: true, ar: true, es: false });
  assert.deepEqual(data.liveLanguages(null), {});
});

test("a published stay without a base nightly rate carries the no-rate warning; a draft or a rated one does not", () => {
  assert.deepEqual(data.stayWarnings(detail("s1", { is_published: true })), ["no_base_rate"]);
  assert.deepEqual(data.stayWarnings(detail("s1", { is_published: false })), []);
  assert.deepEqual(data.stayWarnings(detail("s1", { is_published: true, base_nightly_rate_aed: "[rate]" })), []);
  assert.deepEqual(data.stayWarnings(null), []);
});

test("Move up and Move down swap neighbours and never leave the list", () => {
  assert.deepEqual(data.movedOrder(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(data.movedOrder(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(data.movedOrder(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(data.movedOrder(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(data.movedOrder(["a", "b"], "x", 1), ["a", "b"]);
});

test("the destination filter never hands Radix an empty value: every destination is 'all' in the Select, '' in the list", () => {
  assert.equal(data.ALL_DESTINATIONS, "all");
  assert.equal(data.filterSelectValue(""), "all");
  assert.equal(data.filterSelectValue("d1"), "d1");
  assert.equal(data.filterFromSelect("all"), "");
  assert.equal(data.filterFromSelect("d1"), "d1");
});

test("the list's destination column is singular: one stay has one destination", async () => {
  const { OPS_STAYS_COPY } = await loadTs("lib/copy/ops-stays.ts");
  assert.deepEqual(
    ["en", "ar", "es"].map((code) => OPS_STAYS_COPY[code].columnDestination),
    ["Destination", "الوجهة", "Destino"],
  );
  assert.deepEqual(
    ["en", "ar", "es"].map((code) => OPS_STAYS_COPY[code].allDestinations),
    ["All destinations", "كل الوجهات", "Todos los destinos"],
  );
});

test("Arabic says the web address as destinations and team do: عنوان الويب, never عنوان الصفحة", async () => {
  const { OPS_STAYS_COPY } = await loadTs("lib/copy/ops-stays.ts");
  assert.equal(OPS_STAYS_COPY.ar.slug, "عنوان الويب");
  assert.equal(OPS_STAYS_COPY.ar.problemSlugNeeded, "أدخل عنوان الويب.");
  assert.equal(Object.values(OPS_STAYS_COPY.ar).some((line) => line.includes("عنوان الصفحة")), false);
});
