// Plan 03.2-07: the stay editor's pure form module (app/dashboard/(ops)/catalog/stays/stay-forms.ts) and its copy.
// No React, no request: facts validation, the amenities lock, lines, the form read from a stay.
import test from "node:test";
import assert from "node:assert/strict";
import {
  amenityCounts,
  emptyStayForm,
  linesOf,
  lockedLength,
  stayForm,
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
