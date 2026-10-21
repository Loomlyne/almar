// STAY-05: petsText. Unrun in job 22 (owner: no test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { petsText } = await loadTs("lib/stay-pets.ts");
const { STAY_DETAIL_COPY } = await loadTs("lib/copy/stay-detail.ts");

test("no rule: no fact", () => {
  for (const locale of ["en", "ar", "es"]) {
    assert.equal(petsText({ pets_rule: null, pets_fee_aed: null }, STAY_DETAIL_COPY[locale].pets), null);
  }
});

test("allowed and not allowed read from the copy of each language", () => {
  for (const locale of ["en", "ar", "es"]) {
    const c = STAY_DETAIL_COPY[locale].pets;
    assert.equal(petsText({ pets_rule: "allowed", pets_fee_aed: null }, c), c.allowed);
    assert.equal(petsText({ pets_rule: "not_allowed", pets_fee_aed: null }, c), c.notAllowed);
  }
});

test("fee: two decimals, grouped, Western numerals in every language", () => {
  for (const locale of ["en", "ar", "es"]) {
    const c = STAY_DETAIL_COPY[locale].pets;
    assert.ok(petsText({ pets_rule: "fee", pets_fee_aed: 150 }, c).includes("150.00"));
    assert.ok(petsText({ pets_rule: "fee", pets_fee_aed: 1250.5 }, c).includes("1,250.50"));
  }
  assert.equal(petsText({ pets_rule: "fee", pets_fee_aed: 150 }, STAY_DETAIL_COPY.en.pets), "Allowed, AED 150.00 fee");
});

test("a fee rule with no fee shows nothing", () => {
  assert.equal(petsText({ pets_rule: "fee", pets_fee_aed: null }, STAY_DETAIL_COPY.en.pets), null);
});
