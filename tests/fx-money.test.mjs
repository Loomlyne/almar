// Money review should-fixes for lib/fx/rates.ts (Phase 3.3 slice 1, job "money").
//
// 1. TODAY pins the 27 home prices (3 labels x AED/USD/EUR x en/ar/es) exactly as the module printed them
//    at 84deec2 with the fixture rates, captured before any change. Valid input must stay byte-identical.
// 2. BY_HAND is an arithmetic reference written here, not taken from the module (SF-3). The feed quotes
//    1 USD in AED and in EUR, so USD->AED multiplies by aed, AED->USD divides by aed, AED->EUR divides by
//    aed then multiplies by eur. A module that inverts any of these prints different text and fails here.
import test from "node:test";
import assert from "node:assert/strict";
import { HOME_COPY } from "../lib/copy/home.ts";
import { convertWrittenAmount, rewriteHomeAmounts } from "../lib/fx/rates.ts";

const FIXTURE = { aed: 3.6725, eur: 0.92 };
const LOCALES = ["en", "ar", "es"];
const CODES = ["AED", "USD", "EUR"];
const LABELS = HOME_COPY.en.journeys.map((tier) => tier.price);

const TODAY = {
  AED: [
    "From AED 11,017.50/person · Est. AED 80,000–90,000",
    "From AED 12,853.75/person · Est. AED 120,000–150,000",
    "From AED 73,450/person · Est. AED 200,000–250,000+",
  ],
  USD: [
    "From USD 3,000/person · Est. USD 21,783.53–24,506.47",
    "From USD 3,500/person · Est. USD 32,675.29–40,844.11",
    "From USD 20,000/person · Est. USD 54,458.82–68,073.52+",
  ],
  EUR: [
    "From EUR 2,760/person · Est. EUR 20,040.84–22,545.95",
    "From EUR 3,220/person · Est. EUR 30,061.27–37,576.58",
    "From EUR 18,400/person · Est. EUR 50,102.11–62,627.64+",
  ],
};

const BY_HAND = {
  USD: { USD: (n) => n, AED: (n) => n * FIXTURE.aed, EUR: (n) => n * FIXTURE.eur },
  AED: { AED: (n) => n, USD: (n) => n / FIXTURE.aed, EUR: (n) => (n / FIXTURE.aed) * FIXTURE.eur },
};

/** Western digits, comma groups, two decimals unless the value is whole (the published money format). */
const shown = (n) => {
  const whole = Number.isInteger(n);
  return n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};
const digits = (text) => Number(text.replaceAll(",", ""));
const LABEL = /^From USD \$([\d,]+)\/person · Est\. AED ([\d,]+)–([\d,]+)(\+?)$/;

/** The label after choosing `code`, computed only from FIXTURE and BY_HAND. */
function byHand(label, code) {
  const m = LABEL.exec(label);
  assert.ok(m, `label shape changed: ${label}`);
  const [, from, low, high, plus] = m;
  const head = `From ${code} ${shown(BY_HAND.USD[code](digits(from)))}/person · Est. `;
  if (code === "AED") return `${head}AED ${low}–${high}${plus}`;
  return `${head}${code} ${shown(BY_HAND.AED[code](digits(low)))}–${shown(BY_HAND.AED[code](digits(high)))}${plus}`;
}

test("today's 27 home prices are unchanged at the fixture rates", () => {
  assert.equal(LABELS.length, 3);
  for (const code of CODES) {
    for (const locale of LOCALES) {
      assert.deepEqual(
        LABELS.map((label) => rewriteHomeAmounts(label, code, FIXTURE, locale)),
        TODAY[code],
        `${code} ${locale}`,
      );
    }
  }
});

test("SF-3: the hand-written arithmetic reproduces today's 27 prices", () => {
  for (const code of CODES) {
    assert.deepEqual(LABELS.map((label) => byHand(label, code)), TODAY[code], code);
  }
});

test("SF-3: the module agrees with the hand-written arithmetic for every label, currency and locale", () => {
  for (const label of LABELS) {
    for (const code of CODES) {
      for (const locale of LOCALES) {
        assert.equal(rewriteHomeAmounts(label, code, FIXTURE, locale), byHand(label, code), `${code} ${locale}`);
      }
    }
  }
});

test("SF-3: convertWrittenAmount points the right way for every pair", () => {
  const close = (actual, expected, what) =>
    assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * 1e-12, `${what}: ${actual} != ${expected}`);
  for (const amount of [3000, 3500, 20000, 80000, 90000, 250000]) {
    for (const from of ["USD", "AED"]) {
      for (const to of CODES) {
        close(convertWrittenAmount({ amount, currency: from }, to, FIXTURE), BY_HAND[from][to](amount), `${from}->${to}`);
      }
    }
    // Direction without arithmetic: at these rates one US dollar is worth more than one dirham and more
    // than one euro, and one dirham is worth less in euros than in dollars.
    assert.ok(convertWrittenAmount({ amount, currency: "USD" }, "AED", FIXTURE) > amount);
    assert.ok(convertWrittenAmount({ amount, currency: "AED" }, "USD", FIXTURE) < amount);
    assert.ok(convertWrittenAmount({ amount, currency: "USD" }, "EUR", FIXTURE) < amount);
    assert.ok(
      convertWrittenAmount({ amount, currency: "AED" }, "EUR", FIXTURE) <
        convertWrittenAmount({ amount, currency: "AED" }, "USD", FIXTURE),
    );
  }
});
