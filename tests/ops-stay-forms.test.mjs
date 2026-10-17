// Plan 03.2-07: the stay editor's pure form module (app/dashboard/(ops)/catalog/stays/stay-forms.ts) and its copy.
// No React, no request: facts validation, the amenities lock, lines, the form read from a stay.
import test from "node:test";
import assert from "node:assert/strict";
import {
  amenityCounts,
  INT_MAX,
  emptyStayForm,
  linesOf,
  lockedLength,
  stayForm,
  stayPayload,
  validateStayFacts,
} from "../app/dashboard/(ops)/catalog/stays/stay-forms.ts";
import { OPS_STAYS_COPY } from "../lib/copy/ops-stays.ts";

const facts = (patch = {}) => ({ ...emptyStayForm().facts, destinationId: "d1", slug: "stay-one", ...patch });

test("a new stay starts at one minimum night, nothing else set", () => {
  const form = emptyStayForm();
  assert.equal(form.facts.minNights, "1");
  assert.equal(form.facts.petsRule, "");
  assert.equal(form.facts.infants, "");
  assert.deepEqual(form.english.amenities, []);
  assert.equal(form.english.title, "");
  assert.deepEqual(form.connected, []);
});

test("validateStayFacts: clean facts pass; empty optional numbers are fine", () => {
  assert.deepEqual(validateStayFacts(facts()), {});
  assert.deepEqual(validateStayFacts(facts({ minNights: "" })), {});
});

test("validateStayFacts: destination and web address are needed; the address follows the server's rule", () => {
  assert.equal(validateStayFacts(facts({ destinationId: "" })).destinationId, "destinationNeeded");
  assert.equal(validateStayFacts(facts({ slug: " " })).slug, "slugNeeded");
  for (const bad of ["Stay-One", "stay--one", "-stay", "stay one", "a".repeat(81)]) {
    assert.equal(validateStayFacts(facts({ slug: bad })).slug, "slug", bad);
  }
});

test("validateStayFacts: minimum nights is a whole number of at least 1, with no maximum", () => {
  for (const bad of ["0", "-1", "1.5", "two"]) assert.equal(validateStayFacts(facts({ minNights: bad })).minNights, "atLeastOne", bad);
  assert.equal(validateStayFacts(facts({ minNights: "365" })).minNights, undefined);
});

test("validateStayFacts: capacity numbers are whole and max is not below min", () => {
  assert.equal(validateStayFacts(facts({ bedrooms: "2.5" })).bedrooms, "whole");
  assert.equal(validateStayFacts(facts({ bathrooms: "-1" })).bathrooms, "whole");
  assert.equal(validateStayFacts(facts({ maxGuests: "2", minGuests: "4" })).maxGuests, "guestsOrder");
  assert.equal(validateStayFacts(facts({ maxGuests: "4", minGuests: "4" })).maxGuests, undefined);
});

test("validateStayFacts: a pet fee is needed only for 'Allowed with a fee', in AED with up to two decimals", () => {
  assert.equal(validateStayFacts(facts({ petsRule: "fee", petsFee: "" })).petsFee, "feeNeeded");
  for (const bad of ["1.234", "abc", "-5"]) assert.equal(validateStayFacts(facts({ petsRule: "fee", petsFee: bad })).petsFee, "fee", bad);
  assert.equal(validateStayFacts(facts({ petsRule: "fee", petsFee: "10.5" })).petsFee, undefined);
  assert.equal(validateStayFacts(facts({ petsRule: "allowed", petsFee: "" })).petsFee, undefined);
});

test("linesOf drops blank lines and trims", () => {
  assert.deepEqual(linesOf(" a \n\n b\n  \n"), ["a", "b"]);
});

test("lockedLength: amenities typed in Arabic or Spanish must have the English number of lines", () => {
  const english = { amenities: ["a", "b", "c", "d", "e"] };
  const translations = { ar: { amenities: ["1", "2", "3", "4"] }, es: { amenities: ["1", "2", "3", "4", "5"] } };
  assert.deepEqual(lockedLength(english, translations, { ar: true, es: true }), ["ar"]);
  // A language the AI fills on this Save is not counted: the route keeps the English length.
  assert.deepEqual(lockedLength(english, translations, { ar: false, es: true }), []);
  // Empty in that language: not counted (Save fills it).
  assert.deepEqual(lockedLength(english, { ar: { amenities: [] }, es: translations.es }, { ar: true, es: true }), []);
  assert.deepEqual(amenityCounts(english, translations), { en: 5, ar: 4, es: 5 });
});

test("stayForm reads a stay: numbers as text, rules as choices, experiences then services", () => {
  const text = (title) => ({
    title, tagline: null, neighborhood: null, guests_label: null, bathrooms_label: null, beds_label: null,
    price_label: null, price_note: null, description: ["p"], amenities: ["a"], inclusions: [], policy_headings: [], status: "draft",
  });
  const form = stayForm({
    id: "s1", slug: "stay-one", destination_id: "d1", is_published: false, position: 1,
    max_guests: 6, min_guests: null, bedrooms: 3, bathrooms: 2, min_nights: 2,
    pets_rule: "fee", pets_fee_aed: "10.00", infants_count: false, base_nightly_rate_aed: null,
    hero_media_id: null, hero: null, gallery: [], experience_ids: ["e1", "e2"], service_ids: ["v1"], has_access: false,
    translations: { en: text("[Title]"), ar: null, es: text("[Título]") },
    translation_state: { en: "draft", ar: "missing", es: "draft" }, updated_at: "2026-10-15T00:00:00Z",
  });
  assert.deepEqual(
    [form.facts.maxGuests, form.facts.minGuests, form.facts.minNights, form.facts.petsRule, form.facts.petsFee, form.facts.infants],
    ["6", "", "2", "fee", "10.00", "no"],
  );
  assert.equal(form.english.title, "[Title]");
  assert.equal(form.english.tagline, "");
  assert.deepEqual(form.translations.ar.amenities, []);
  assert.equal(form.translations.es.title, "[Título]");
  assert.deepEqual(form.connected, ["e1", "e2", "v1"]);
});

test("OPS_STAYS_COPY: the same keys in en, ar and es, every one a non-empty string", () => {
  const keys = Object.keys(OPS_STAYS_COPY.en).sort();
  for (const locale of ["en", "ar", "es"]) {
    assert.deepEqual(Object.keys(OPS_STAYS_COPY[locale]).sort(), keys, locale);
    for (const [key, value] of Object.entries(OPS_STAYS_COPY[locale])) {
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.notEqual(value.trim(), "", `${locale}.${key}`);
      assert.doesNotMatch(value, /\[object|undefined|NaN/, `${locale}.${key}`);
    }
  }
});

// ---- the save request -------------------------------------------------------------------------------------------------

const KINDS = { e1: "experience", e2: "experience", v1: "service" };
const kindOf = (id) => KINDS[id];

function filled() {
  const form = emptyStayForm();
  form.facts = { ...form.facts, destinationId: "d1", slug: " stay-one ", maxGuests: "6", minGuests: "", minNights: "", petsRule: "fee", petsFee: "10.5", infants: "yes" };
  form.english = { ...form.english, title: " [Title] ", tagline: "  ", amenities: ["a", "", " b "] };
  form.connected = ["e1", "v1", "e2"];
  form.hero = { id: "m1" };
  form.gallery = [{ id: "m2" }, { id: "m3" }];
  return form;
}

test("stayPayload on create: every fact, English as a draft, connections split by kind in order", () => {
  const body = stayPayload(filled(), emptyStayForm(), { id: null, publish: false, live: {}, kindOf });
  assert.equal(body.action, "save");
  const { item } = body;
  assert.equal(item.id, undefined);
  assert.equal(item.slug, "stay-one");
  assert.deepEqual([item.max_guests, item.min_guests, item.min_nights, item.pets_rule, item.pets_fee_aed, item.infants_count], [6, null, 1, "fee", "10.5", true]);
  assert.equal(item.hero_media_id, "m1");
  assert.deepEqual(item.gallery_media_ids, ["m2", "m3"]);
  assert.deepEqual(item.connections, { experience_ids: ["e1", "e2"], service_ids: ["v1"] });
  assert.deepEqual(Object.keys(item.translations), ["en"]);
  assert.equal(item.translations.en.title, "[Title]");
  assert.equal(item.translations.en.tagline, null);
  assert.deepEqual(item.translations.en.amenities, ["a", "b"]);
  assert.equal(item.translations.en.status, "draft");
});

test("stayPayload: a fee is dropped when pets are not 'fee'", () => {
  const form = filled();
  form.facts.petsRule = "allowed";
  const { item } = stayPayload(form, emptyStayForm(), { id: null, publish: false, live: {}, kindOf });
  assert.equal(item.pets_fee_aed, null);
});

test("stayPayload on Save: only changed languages; live ones stay published, new AI text is a draft", () => {
  const saved = filled();
  saved.translations.ar = { ...saved.translations.ar, title: "[عنوان]" };
  const form = structuredClone(saved);
  form.translations.ar.title = "[عنوان جديد]";
  form.translations.es = { ...form.translations.es, title: "[Título]" };
  const { item } = stayPayload(form, saved, { id: "s1", publish: false, live: { en: true, ar: true }, kindOf });
  assert.equal(item.id, "s1");
  assert.deepEqual(Object.keys(item.translations).sort(), ["ar", "es"]);
  assert.equal(item.translations.ar.status, "published");
  assert.equal(item.translations.es.status, "draft");
  // Unchanged join sets are left out (absent = untouched).
  assert.equal(item.gallery_media_ids, undefined);
  assert.equal(item.connections, undefined);
});

test("stayPayload on Publish: every language with a title goes published, even unchanged ones", () => {
  const saved = filled();
  saved.translations.ar = { ...saved.translations.ar, title: "[عنوان]" };
  saved.translations.es = { ...saved.translations.es, title: "[Título]" };
  const { item } = stayPayload(saved, saved, { id: "s1", publish: true, live: {}, kindOf });
  assert.deepEqual(Object.keys(item.translations).sort(), ["ar", "en", "es"]);
  for (const locale of ["en", "ar", "es"]) assert.equal(item.translations[locale].status, "published");
});

test("stayPayload: Arabic or Spanish with no title yet is not sent", () => {
  const form = filled();
  form.translations.ar = { ...form.translations.ar, amenities: ["x"] };
  const { item } = stayPayload(form, emptyStayForm(), { id: null, publish: false, live: {}, kindOf });
  assert.equal(item.translations.ar, undefined);
});

test("validateStayFacts: a pet fee of 0 or with a leading zero is refused, as the server does", () => {
  for (const bad of ["0", "0.00", "007"]) assert.equal(validateStayFacts(facts({ petsRule: "fee", petsFee: bad })).petsFee, "fee", bad);
});

test("validateStayFacts: whole numbers stop at the server's INT_MAX (lib/ops/validate.ts), said on the field", () => {
  assert.equal(INT_MAX, 2147483647);
  for (const key of ["maxGuests", "minGuests", "bedrooms", "bathrooms"]) {
    assert.equal(validateStayFacts(facts({ [key]: "2147483647" }))[key], undefined, key);
    assert.equal(validateStayFacts(facts({ [key]: "2147483648" }))[key], "tooLarge", key);
  }
  assert.equal(validateStayFacts(facts({ minNights: "2147483647" })).minNights, undefined);
  assert.equal(validateStayFacts(facts({ minNights: "99999999999" })).minNights, "tooLarge");
  // A wrong shape is still "whole" / "atLeastOne", not "too large".
  assert.equal(validateStayFacts(facts({ bedrooms: "9999999999.5" })).bedrooms, "whole");
  assert.equal(validateStayFacts(facts({ minNights: "0" })).minNights, "atLeastOne");
  for (const locale of ["en", "ar", "es"]) {
    const line = OPS_STAYS_COPY[locale].problemTooLarge;
    assert.ok(line.includes("{field}") && line.includes("2147483647"), locale);
  }
});
