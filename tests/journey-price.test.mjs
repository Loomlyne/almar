// Plan 03.2-04 Task 2: parseTierPrice reads the owner's English price label (C-15, stored verbatim) into the structured
// fields, by the same rule that produced lib/data/fixtures/home.json (tests/data-prices.test.mjs, third test). The label
// is never computed; the structured values are derived from it only and are null when a part does not parse.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { parseTierPrice } = await loadTs("lib/ops/journey-price.ts");

const home = JSON.parse(readFileSync("lib/data/fixtures/home.json", "utf8"));
const records = JSON.parse(readFileSync("lib/data/fixtures/home-translations.json", "utf8")).tiers;

test("the three accepted labels parse to exactly home.json's price_from and price_estimate", () => {
  assert.equal(home.tiers.length, 3);
  for (const tier of home.tiers) {
    const label = records.find((r) => r.tier_id === tier.id && r.locale === "en").price_label;
    assert.deepEqual(parseTierPrice(label), { price_from: tier.price_from, price_estimate: tier.price_estimate }, tier.slug);
  }
});

test("the plan's example and the open-ended '+' label", () => {
  assert.deepEqual(parseTierPrice("From USD $3,000/person · Est. AED 80,000–90,000"), {
    price_from: { amount: 3000, currency: "USD" },
    price_estimate: { low: 80000, high: 90000, currency: "AED", open_ended: false },
  });
  assert.deepEqual(parseTierPrice("From USD $20,000/person · Est. AED 200,000–250,000+"), {
    price_from: { amount: 20000, currency: "USD" },
    price_estimate: { low: 200000, high: 250000, currency: "AED", open_ended: true },
  });
});

test("unparsable labels give null; nothing is guessed", () => {
  for (const label of ["Price on request", "", "On request · WhatsApp", "From $3,000", "Est. 80,000–90,000", "From USD three thousand"]) {
    assert.deepEqual(parseTierPrice(label), { price_from: null, price_estimate: null }, label);
  }
  assert.deepEqual(parseTierPrice(null), { price_from: null, price_estimate: null });
  assert.deepEqual(parseTierPrice(undefined), { price_from: null, price_estimate: null });
});

test("each part is read on its own: a label with only a 'From' or only an estimate keeps the other null", () => {
  assert.deepEqual(parseTierPrice("From AED 12,500/person"), { price_from: { amount: 12500, currency: "AED" }, price_estimate: null });
  assert.deepEqual(parseTierPrice("Est. AED 80,000-90,000"), { price_from: null, price_estimate: { low: 80000, high: 90000, currency: "AED", open_ended: false } });
  assert.deepEqual(parseTierPrice("Est. AED 300,000+"), { price_from: null, price_estimate: { low: 300000, high: null, currency: "AED", open_ended: true } });
});

test("malformed numbers and a reversed range are not parsed", () => {
  assert.equal(parseTierPrice("From USD $3,00/person").price_from, null, "bad thousands grouping");
  assert.equal(parseTierPrice("Est. AED 90,000–80,000").price_estimate, null, "low above high");
  assert.equal(parseTierPrice("From EUR €3,000/person").price_from, null, "only USD and AED");
});
