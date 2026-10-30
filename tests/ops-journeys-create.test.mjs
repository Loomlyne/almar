// Plan 06-06 Task 3: the owner's package contract (parseJourneyAction) and the pure side of the editor (journey-forms.ts).
// Written, NOT run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const parse = await loadTs("lib/ops/validate-catalog.ts");
const forms = await loadTs("app/dashboard/(ops)/catalog/packages/journey-forms.ts");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const invalid = (fn, field) =>
  assert.throws(fn, (error) => {
    assert.equal(error.field, field);
    return true;
  });

const EN = { en: { name: "The Explorer", price_label: "Price on request" } };
const leg = (over = {}) => ({ destination_id: A, stay_id: null, translations: { en: { nights_label: "3 nights", status: "published" } }, ...over });

test("save without an id needs a slug and the English name and price line", () => {
  const out = parse.parseJourneyAction({ action: "save", item: { slug: "the-explorer", translations: EN } });
  assert.equal(out.item.id, undefined);
  assert.equal(out.item.slug, "the-explorer");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { translations: EN } }), "slug");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { slug: "Bad Slug", translations: EN } }), "slug");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { slug: "the-explorer" } }), "translations.en");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { slug: "the-explorer", translations: { en: { name: "x" } } } }), "translations.en.price_label");
});

test("save with an id may carry a slug: the server refuses a change once published", () => {
  assert.equal(parse.parseJourneyAction({ action: "save", item: { id: A, slug: "the-explorer" } }).item.slug, "the-explorer");
});

test("legs: at most 50 (a guard only), each with a destination, an optional stay and an English nights line", () => {
  const out = parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ stay_id: B }), leg()] } });
  assert.equal(out.item.legs.length, 2);
  assert.equal(out.item.legs[0].stay_id, B);
  assert.equal(out.item.legs[1].stay_id, null);
  assert.equal(parse.parseJourneyAction({ action: "save", item: { id: A, legs: Array.from({ length: 50 }, () => leg()) } }).item.legs.length, 50);
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: Array.from({ length: 51 }, () => leg()) } }), "legs");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ destination_id: "x" })] } }), "legs.0.destination_id");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ stay_id: "x" })] } }), "legs.0.stay_id");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ extra: 1 })] } }), "legs.0.extra");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ translations: { ar: { nights_label: "x" } } })] } }), "translations.en");
});

test("a leg's lock rides with its Arabic and Spanish; a name that is not the leg's own field is refused", () => {
  const ok = parse.parseJourneyAction({
    action: "save",
    item: { id: A, legs: [leg({ translations: { en: { nights_label: "3 nights" }, ar: { nights_label: "x", locked_fields: ["nights_label"], status: "draft" }, es: null } })] },
  });
  assert.deepEqual(ok.item.legs[0].translations.ar.locked_fields, ["nights_label"]);
  assert.equal(ok.item.legs[0].translations.es, null);
  assert.throws(() => parse.parseJourneyAction({ action: "save", item: { id: A, legs: [leg({ translations: { en: { nights_label: "3" }, ar: { nights_label: "x", locked_fields: ["name"] } } })] } }));
});

test("addon_ids: distinct uuids, at most 500 (a guard only)", () => {
  assert.deepEqual(parse.parseJourneyAction({ action: "save", item: { id: A, addon_ids: [B, C] } }).item.addon_ids, [B, C]);
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, addon_ids: [B, B] } }), "addon_ids");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, addon_ids: ["x"] } }), "addon_ids");
  const many = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, addon_ids: many } }), "addon_ids");
});

test("delete takes an id; any other key is refused", () => {
  assert.deepEqual(parse.parseJourneyAction({ action: "delete", id: A }), { action: "delete", id: A });
  invalid(() => parse.parseJourneyAction({ action: "delete", id: "x" }), "id");
  invalid(() => parse.parseJourneyAction({ action: "delete", id: A, force: true }), "force");
  invalid(() => parse.parseJourneyAction({ action: "save", item: { id: A, price_from_amount: 1 } }), "price_from_amount");
});

// ---- journey-forms -----------------------------------------------------------------------------------------------------

const detail = (over = {}) => ({
  id: A,
  slug: "the-explorer",
  is_featured: false,
  media_id: B,
  image: { id: B, key: "k", url: "u", width: null, height: null, alt_en: "" },
  price_from: null,
  price_estimate: null,
  is_published: true,
  position: 1,
  translations: {
    en: { name: "The Explorer", price_label: "Price on request", tagline: null, duration_label: null, ideal_for_label: null, ideal_for: null, body: null, status: "published" },
    ar: { name: "AR", price_label: "AR price", tagline: null, duration_label: null, ideal_for_label: null, ideal_for: null, body: null, status: "published", locked_fields: ["name"] },
    es: null,
  },
  translation_state: { en: "published", ar: "published", es: "missing" },
  updated_at: "2026-10-30T00:00:00Z",
  legs: [
    { id: "l2", position: 2, destination_id: C, stay_id: null, translations: { en: { nights_label: "2 nights", status: "published" }, ar: { nights_label: "AR 2", status: "published", locked_fields: [] }, es: null } },
    { id: "l1", position: 1, destination_id: A, stay_id: B, translations: { en: { nights_label: "3 nights", status: "published" }, ar: { nights_label: "AR 3", status: "published", locked_fields: ["nights_label"] }, es: null } },
  ],
  addon_ids: [C, A],
  ...over,
});

test("journeyForm: legs in position order, the locks read, and a detail with no legs key has none", () => {
  const form = forms.journeyForm(detail());
  assert.deepEqual(form.legs.map((l) => l.text.en), ["3 nights", "2 nights"]);
  assert.deepEqual(form.legs.map((l) => l.locked.ar), [true, false]);
  assert.deepEqual(form.addon_ids, [C, A]);
  const bare = forms.journeyForm(detail({ legs: undefined, addon_ids: undefined }));
  assert.deepEqual(bare.legs, []);
  assert.deepEqual(bare.addon_ids, []);
});

test("journeyPayload: a new form sends no id and the slug; a hidden one both; a published one no slug; legs and add-ons whole, never a price column", () => {
  const fresh = forms.blankJourneyForm();
  fresh.slug = " new-one ";
  fresh.text.en.name = "New";
  fresh.text.en.price_label = "Price";
  const created = forms.journeyPayload(fresh, { publish: false });
  assert.equal("id" in created, false);
  assert.equal(created.slug, "new-one");
  assert.deepEqual(created.legs, []);
  assert.deepEqual(created.addon_ids, []);

  const shown = forms.journeyPayload(forms.journeyForm(detail()), { publish: false });
  assert.equal(shown.id, A);
  assert.equal("slug" in shown, false);
  assert.equal(shown.legs.length, 2);
  assert.deepEqual(shown.addon_ids, [C, A]);
  for (const key of ["price_from_amount", "price_from_currency", "est_low", "est_high", "est_open_ended"]) assert.equal(key in shown, false, key);

  const hidden = forms.journeyPayload(forms.journeyForm(detail({ is_published: false })), { publish: false });
  assert.equal(hidden.id, A);
  assert.equal(hidden.slug, "the-explorer");
});

test("journeyPayload: each leg's locks ride with its Arabic and Spanish; an empty translation is null", () => {
  const item = forms.journeyPayload(forms.journeyForm(detail()), { publish: false });
  assert.deepEqual(item.legs[0].translations.ar, { nights_label: "AR 3", status: "published", locked_fields: ["nights_label"] });
  assert.equal(item.legs[0].translations.es, null);
  assert.deepEqual(item.legs[1].translations.ar.locked_fields, []);
  assert.deepEqual(item.translations.ar.locked_fields, ["name"]);
});

test("flat leg fields: the kit's values go out and come back by key, without losing order, and the name meets the translate route's rule", () => {
  const form = forms.journeyForm(detail());
  const en = forms.journeyFields(form, "en");
  const keys = form.legs.map((l) => l.key);
  for (const key of keys) assert.match(key, /^[a-z][a-z0-9_]{0,63}$/);
  assert.equal(en[keys[0]], "3 nights");
  assert.equal(en.name, "The Explorer");
  assert.deepEqual(forms.journeyLocks(form).ar, [...["name", keys[0]]].sort());

  const translations = { ar: { ...forms.journeyFields(form, "ar"), [keys[1]]: "fixed" }, es: { ...forms.journeyFields(form, "es"), [keys[0]]: "ES 3" } };
  const next = forms.journeyWithTranslations(form, translations, { ar: ["name", keys[1]], es: [] });
  assert.deepEqual(next.legs.map((l) => l.key), keys);
  assert.equal(next.legs[1].text.ar, "fixed");
  assert.equal(next.legs[0].text.es, "ES 3");
  assert.deepEqual(next.legs.map((l) => l.locked.ar), [false, true]);
  assert.deepEqual(next.locked.ar, ["name"], "a leg's name never lands in the tier's own list");
});

test("journeyForm(detail, keys): a read-back keeps the saved legs' keys, so the kit's locks stay on them", () => {
  const form = forms.journeyForm(detail());
  const again = forms.journeyForm(detail(), form.legs.map((l) => l.key));
  assert.deepEqual(again.legs.map((l) => l.key), form.legs.map((l) => l.key));
  assert.equal(JSON.stringify(again), JSON.stringify(form));
});

test("movedLegs keeps the keys; a changed destination drops a stay that is not its own", () => {
  const form = forms.journeyForm(detail());
  const moved = forms.movedLegs(form.legs, form.legs[0].key, 1);
  assert.deepEqual(moved.map((l) => l.key), [form.legs[1].key, form.legs[0].key]);
  assert.deepEqual(forms.movedLegs(form.legs, form.legs[0].key, -1).map((l) => l.key), form.legs.map((l) => l.key));
  const leg0 = form.legs[0];
  assert.equal(forms.legWithDestination(leg0, C, []).stay_id, null);
  assert.equal(forms.legWithDestination(leg0, C, [{ id: B }]).stay_id, B);
});

test("what Save waits for: a leg with its English nights line, a web address in the server's form", () => {
  const blank = forms.blankJourneyLeg(A);
  assert.equal(forms.legsReady([blank]), false);
  assert.equal(forms.legsReady([{ ...blank, text: { ...blank.text, en: "3 nights" } }]), true);
  assert.equal(forms.journeySlugOk("the-explorer"), true);
  for (const bad of ["", "Bad", "a b", "-a", "a--b", "x".repeat(81)]) assert.equal(forms.journeySlugOk(bad), false, bad);
});

test("liveJourneyFields names each leg's live nights line, only on a shown package's published language", () => {
  const form = forms.journeyForm(detail());
  const live = forms.liveJourneyFields(true, form.status, form.text, form.legs);
  for (const leg of form.legs) assert.ok(live.ar.includes(leg.key));
  assert.equal(live.es, undefined);
  assert.deepEqual(forms.liveJourneyFields(false, form.status, form.text, form.legs), {});
});
