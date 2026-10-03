import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOME_COPY } from "../lib/copy/home.ts";
import { convertWrittenAmount, formatConverted, rewriteHomeAmounts } from "../lib/fx/rates.ts";

// Plan 03.3-04 Task 2 (money): an estimate range converts at both ends under one currency code.
// Every expected string below is derived from convertWrittenAmount and formatConverted, never typed.
// The three labels are read from lib/copy/home.ts, the published text, never retyped here.

const RATES = { aed: 3.6725, eur: 0.92 };
const LOCALES = ["en", "ar", "es"];
const CURRENCIES = ["AED", "USD", "EUR"];
const LABELS = HOME_COPY.en.journeys.map((tier) => tier.price);

const num = (digits) => Number(digits.replaceAll(",", ""));
const PUBLISHED = /^From USD \$(\d{1,3}(?:,\d{3})*)\/person · Est\. AED (\d{1,3}(?:,\d{3})*)–(\d{1,3}(?:,\d{3})*)(\+?)$/;

/** The label as it must read after choosing `currency`, built only from the two exported functions. */
function expectedLabel(label, currency, locale) {
  const m = PUBLISHED.exec(label);
  assert.ok(m, `label shape changed: ${label}`);
  const prefix = `${currency} `;
  const fromAmount = convertWrittenAmount({ amount: num(m[1]), currency: "USD" }, currency, RATES);
  const bare = (digits) => {
    const shown = formatConverted(currency, convertWrittenAmount({ amount: num(digits), currency: "AED" }, currency, RATES), locale);
    assert.ok(shown.startsWith(prefix), shown);
    return shown.slice(prefix.length);
  };
  return `From ${formatConverted(currency, fromAmount, locale)}/person · Est. ${prefix}${bare(m[2])}–${bare(m[3])}${m[4]}`;
}

test("the three labels come from lib/copy/home.ts and this file types none of their amounts", () => {
  assert.equal(LABELS.length, 3);
  for (const label of LABELS) assert.ok(PUBLISHED.test(label), label);
  const own = readFileSync(new URL(import.meta.url), "utf8");
  assert.equal(/\d{1,3},\d{3}/.test(own), false, "a typed digit-grouped amount");
  // All three locales publish the same English price text.
  for (const locale of ["ar", "es"]) {
    assert.deepEqual(HOME_COPY[locale].journeys.map((tier) => tier.price), LABELS);
  }
});

for (const [index, label] of LABELS.entries()) {
  for (const currency of CURRENCIES) {
    for (const locale of LOCALES) {
      test(`label ${index + 1}, ${currency}, ${locale}: both ends of the estimate are in ${currency}`, () => {
        const out = rewriteHomeAmounts(label, currency, RATES, locale);
        assert.equal(out, expectedLabel(label, currency, locale));
        const codes = out.match(/\b(?:AED|USD|EUR)\b/g) ?? [];
        assert.deepEqual([...new Set(codes)], [currency], `mixed currencies in: ${out}`);
        assert.equal(out.includes("$"), false, out);
        const m = PUBLISHED.exec(label);
        if (m[4]) assert.ok(out.endsWith("+"), `the Sovereign keeps its trailing +: ${out}`);
        else assert.equal(out.endsWith("+"), false);
        if (locale === "ar") assert.equal(/[٠-٩]/.test(out), false, `Arabic-Indic digit in ${out}`);
      });
    }
  }
}

test("the Explorer in USD no longer carries its AED high end (the measured defect)", () => {
  const [explorer] = LABELS;
  const m = PUBLISHED.exec(explorer);
  const out = rewriteHomeAmounts(explorer, "USD", RATES, "en");
  assert.equal(out.includes(m[3]), false, `the published high end ${m[3]} is still in: ${out}`);
  assert.equal(out.includes("AED"), false, out);
});

test("choosing AED leaves the published text byte for byte", () => {
  for (const label of LABELS) {
    for (const locale of LOCALES) assert.equal(rewriteHomeAmounts(label, "AED", RATES, locale), expectedLabel(label, "AED", locale));
  }
  // The USD-first part loses its dollar sign after conversion; the AED range is unchanged.
  const [explorer] = LABELS;
  const m = PUBLISHED.exec(explorer);
  const out = rewriteHomeAmounts(explorer, "AED", RATES, "en");
  assert.ok(out.includes(`Est. AED ${m[2]}–${m[3]}`), out);
});

test("with no rates, or a currency that is not one of the three, the label is returned unchanged", () => {
  for (const label of LABELS) {
    for (const locale of LOCALES) {
      for (const currency of CURRENCIES) {
        assert.equal(rewriteHomeAmounts(label, currency, null, locale), label);
        assert.equal(rewriteHomeAmounts(label, currency, { aed: Number.NaN, eur: 0.92 }, locale), label);
        assert.equal(rewriteHomeAmounts(label, currency, { aed: 3.6725, eur: Number.POSITIVE_INFINITY }, locale), label);
      }
      for (const currency of ["GBP", "usd", "", null, undefined]) {
        assert.equal(rewriteHomeAmounts(label, currency, RATES, locale), label, String(currency));
      }
    }
  }
});

test("a range with a zero AED rate is left as written, never NaN", () => {
  const out = rewriteHomeAmounts(LABELS[0], "USD", { aed: 0, eur: 0.92 }, "en");
  assert.equal(/NaN|Infinity/.test(out), false, out);
  assert.equal(out.includes(PUBLISHED.exec(LABELS[0])[3]), true, out);
});

test("the single-amount rows convert exactly as before (sources built from the published labels)", () => {
  const rows = LABELS.flatMap((label) => {
    const m = PUBLISHED.exec(label);
    return [
      [`USD $${m[1]}`, num(m[1]), "USD"],
      [`$${m[1]}`, num(m[1]), "USD"],
      [`AED ${m[2]}`, num(m[2]), "AED"],
    ];
  });
  for (const [source, amount, written] of rows) {
    for (const currency of CURRENCIES) {
      for (const locale of LOCALES) {
        const want = formatConverted(currency, convertWrittenAmount({ amount, currency: written }, currency, RATES), locale);
        assert.equal(rewriteHomeAmounts(source, currency, RATES, locale), want, `${source} -> ${currency} (${locale})`);
      }
    }
  }
});

test("text without a written amount is untouched", () => {
  assert.equal(rewriteHomeAmounts("No amount here", "USD", RATES, "en"), "No amount here");
});
