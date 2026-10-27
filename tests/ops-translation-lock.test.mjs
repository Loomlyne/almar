// The translation lock end to end on the TypeScript side (I18N-04, plan 06-01 Tasks 5-6): the route validators accept
// and refuse `locked_fields`, `locked` and `notes_locked` as the database does, and every editor's form carries the lock
// into its save body and reads it back. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const v = await loadTs("lib/ops/validate.ts");
const vm = await loadTs("lib/ops/validate-media.ts");
const vc = await loadTs("lib/ops/validate-catalog.ts");
const forms = await loadTs("app/dashboard/(ops)/catalog/catalog-forms.ts");
const stays = await loadTs("app/dashboard/(ops)/catalog/stays/stay-forms.ts");
const alt = await loadTs("components/ops/media-alt.ts");

const SPEC = { required: ["name"], fields: { name: { kind: "text", max: 160 }, summary: { kind: "text", max: 4000 } } };
const ID = "11111111-1111-4111-8111-111111111111";

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

// ---- lib/ops/validate.ts translations() ------------------------------------------------------------------------------

test("translations: locked_fields on ar/es is a list of the spec's own field names, kept as sent", () => {
  const t = v.translations({ en: { name: "X" }, ar: { name: "س", locked_fields: ["name"] }, es: { locked_fields: [] } }, SPEC, { create: false });
  assert.deepEqual(t.ar.locked_fields, ["name"]);
  assert.deepEqual(t.es.locked_fields, []);
});

test("translations: locked_fields refused on en, with an unknown name, a non-string, a duplicate, or not a list", () => {
  invalid(() => v.translations({ en: { name: "X", locked_fields: [] } }, SPEC, { create: false }), "translations.en.locked_fields", "en");
  invalid(() => v.translations({ ar: { locked_fields: ["title"] } }, SPEC, { create: false }), "translations.ar.locked_fields", "ar");
  invalid(() => v.translations({ ar: { locked_fields: [1] } }, SPEC, { create: false }), "translations.ar.locked_fields", "ar");
  invalid(() => v.translations({ es: { locked_fields: ["name", "name"] } }, SPEC, { create: false }), "translations.es.locked_fields", "es");
  invalid(() => v.translations({ es: { locked_fields: "name" } }, SPEC, { create: false }), "translations.es.locked_fields", "es");
  invalid(() => v.translations({ es: { locked_fields: ["constructor"] } }, SPEC, { create: false }), "translations.es.locked_fields", "es");
});

// ---- lib/ops/validate-media.ts save_alt ------------------------------------------------------------------------------

test("save_alt: locked { ar?, es? } booleans pass through; en, a non-boolean and an unknown key are refused", () => {
  const body = vm.parseMediaPost({ action: "save_alt", id: ID, alt: { en: "Pool" }, locked: { ar: true, es: false } });
  assert.deepEqual(body.locked, { ar: true, es: false });
  assert.equal("locked" in vm.parseMediaPost({ action: "save_alt", id: ID, alt: { en: "Pool" } }), false);
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: ID, alt: { en: "Pool" }, locked: { en: true } }), "locked.en");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: ID, alt: { en: "Pool" }, locked: { ar: "yes" } }), "locked.ar", "ar");
});

// ---- lib/ops/validate-catalog.ts stay access --------------------------------------------------------------------------

test("stay access: notes_locked is a list of distinct ar / es", () => {
  const save = vc.parseAccessSave({ action: "save", stay_id: ID, access: { notes: "Gate", notes_ar: "بوابة", notes_locked: ["ar"] } });
  assert.deepEqual(save.access.notes_locked, ["ar"]);
  invalid(() => vc.parseAccessSave({ action: "save", stay_id: ID, access: { notes_locked: ["en"] } }), "access.notes_locked");
  invalid(() => vc.parseAccessSave({ action: "save", stay_id: ID, access: { notes_locked: ["ar", "ar"] } }), "access.notes_locked");
  invalid(() => vc.parseAccessSave({ action: "save", stay_id: ID, access: { notes_locked: "ar" } }), "access.notes_locked");
});

test("publish: post and legal_page are accepted entities (06-03, 06-04 never edit the list)", () => {
  assert.equal(vc.parsePublish({ entity: "post", id: ID, published: true }).entity, "post");
  assert.equal(vc.parsePublish({ entity: "legal_page", id: ID, published: false }).entity, "legal_page");
});

// ---- the editors' forms ------------------------------------------------------------------------------------------------

const destinationDetail = (locks) => ({
  id: ID,
  slug: "cartagena",
  is_published: true,
  position: 1,
  hero_media_id: null,
  inset_media_id: null,
  hero: null,
  inset: null,
  translations: {
    en: { name: "Cartagena", short_line: null, region: "Caribbean coast", summary: null, nights_label: null, status: "published" },
    ar: { name: "قرطاجنة", short_line: null, region: null, summary: null, nights_label: null, status: "published", locked_fields: locks.ar },
    es: { name: "Cartagena de Indias", short_line: null, region: null, summary: null, nights_label: null, status: "published", locked_fields: locks.es },
  },
  translation_state: { en: "published", ar: "published", es: "published" },
  updated_at: "2026-10-27T00:00:00Z",
});

test("destination form reads the stored locks and sends them back on every ar/es record it sends (set, never merged)", () => {
  const form = forms.destinationFormOf(destinationDetail({ ar: ["name"], es: [] }));
  assert.deepEqual(form.locked, { ar: ["name"], es: [] });
  const body = forms.destinationPayload(form, { publish: false });
  assert.deepEqual(body.translations.ar.locked_fields, ["name"]);
  assert.deepEqual(body.translations.es.locked_fields, []);
  assert.equal("locked_fields" in body.translations.en, false, "English never carries a lock");
});

test("withTranslations stores the kit's lock lists; a lock change makes the form differ (the page is dirty)", () => {
  const form = forms.destinationFormOf(destinationDetail({ ar: [], es: [] }));
  const next = forms.withTranslations(form, { ar: { name: "قرطاجنة" }, es: { name: "Cartagena" } }, { ar: ["name"], es: [] });
  assert.deepEqual(next.locked, { ar: ["name"], es: [] });
  assert.equal(forms.sameForm(form, next), false);
  assert.deepEqual(forms.withTranslations(form, { ar: {}, es: {} }).locked, form.locked, "no lists given: the form's own stay");
});

test("a detail from before the migration (no locked_fields) reads as no locks", () => {
  const detail = destinationDetail({ ar: undefined, es: undefined });
  assert.deepEqual(forms.destinationFormOf(detail).locked, { ar: [], es: [] });
  assert.deepEqual(forms.emptyDestinationForm().locked, { ar: [], es: [] });
  assert.deepEqual(forms.emptyCatalogItemForm().locked, { ar: [], es: [] });
});

test("stays: a lock set or taken off is a change of that language; its record carries the whole list", () => {
  const saved = stays.emptyStayForm();
  saved.english = { ...saved.english, title: "Casa" };
  saved.translations = { ar: { ...saved.translations.ar, title: "كاسا" }, es: { ...saved.translations.es, title: "Casa" } };
  const form = { ...saved, locked: { ar: ["title"], es: [] } };
  const body = stays.stayPayload(form, saved, { id: ID, publish: false, live: { en: true, ar: true, es: true }, kindOf: () => undefined });
  assert.deepEqual(body.translations.ar.locked_fields, ["title"]);
  assert.equal(body.translations.es, undefined, "Spanish did not change: not sent");
});

test("media: the alt locks go into save_alt and come back from the list item", () => {
  const item = { id: ID, key: "a.webp", url: "", width: 1, height: 1, alt_en: "Pool", content_type: "image/webp", source: "upload", alt: { en: "Pool", ar: "مسبح", es: "Piscina" }, alt_status: { en: "published", ar: "published", es: "draft" }, alt_locked: { ar: true, es: false }, used_by: 0 };
  assert.deepEqual(alt.altLocks(item), { ar: ["alt"], es: [] });
  const body = alt.buildSaveAlt(ID, { en: "Pool", ar: "مسبح", es: "Piscina" }, false, {}, { ar: [], es: ["alt"] });
  assert.deepEqual(body.locked, { ar: false, es: true });
  assert.deepEqual(alt.itemAfterSave(item, body).alt_locked, { ar: false, es: true });
  assert.equal("locked" in alt.buildSaveAlt(ID, { en: "Pool", ar: "", es: "" }, false), false, "no lists: no key (older callers)");
});
