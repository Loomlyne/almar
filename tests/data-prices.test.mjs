// The accepted-price test (plan 03.3-01, design 3.9 test 3, threat T-3.3-02): the three home tier
// price_label strings, in en, ar and es, equal the journeys[].price strings in lib/copy/home.ts byte for
// byte, so an owner-accepted price cannot drift. ALMAR_DATA_ROOT points the scan at a scratch copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const ROOT = resolve(process.env.ALMAR_DATA_ROOT ?? process.cwd());
const fixture = (name) => JSON.parse(readFileSync(join(ROOT, "lib", "data", "fixtures", `${name}.json`), "utf8"));
const { HOME_COPY } = await loadTs("lib/copy/home.ts");

const ACCEPTED = [
  "From USD $3,000/person · Est. AED 80,000–90,000",
  "From USD $3,500/person · Est. AED 120,000–150,000",
  "From USD $20,000/person · Est. AED 200,000–250,000+",
];

test("lib/copy/home.ts still holds the three accepted prices", () => {
  for (const locale of ["en", "ar", "es"]) {
    assert.deepEqual(HOME_COPY[locale].journeys.map((j) => j.price), ACCEPTED, locale);
  }
});

test("tier price_label equals lib/copy/home.ts byte for byte in en, ar and es", () => {
  const tiers = fixture("home").tiers.sort((a, b) => a.position - b.position);
  const records = fixture("home-translations").tiers;
  assert.equal(tiers.length, 3);
  for (const locale of ["en", "ar", "es"]) {
    tiers.forEach((tier, i) => {
      const rec = records.find((r) => r.tier_id === tier.id && r.locale === locale);
      assert.ok(rec, `${locale}: tier ${tier.slug} has no record`);
      assert.equal(rec.price_label, HOME_COPY[locale].journeys[i].price, `${locale} ${tier.slug}`);
      assert.equal(rec.price_label, ACCEPTED[i]);
    });
  }
});

test("the structured price fields agree with the label they were parsed from", () => {
  const tiers = fixture("home").tiers.sort((a, b) => a.position - b.position);
  assert.deepEqual(tiers.map((t) => t.price_from), [
    { amount: 3000, currency: "USD" }, { amount: 3500, currency: "USD" }, { amount: 20000, currency: "USD" },
  ]);
  assert.deepEqual(tiers.map((t) => t.price_estimate), [
    { low: 80000, high: 90000, currency: "AED", open_ended: false },
    { low: 120000, high: 150000, currency: "AED", open_ended: false },
    { low: 200000, high: 250000, currency: "AED", open_ended: true },
  ]);
});
