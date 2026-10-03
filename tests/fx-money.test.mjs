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

test("SF-1: an amount that runs on inside a longer token is never rewritten", () => {
  const cases = [
    ["AED 80,000–90,0001", "USD"], // the high end runs on into another digit
    ["AED 80,000–90,000.50", "USD"], // the high end has a decimal part
    ["AED 80,000–90,000,5", "EUR"], // the high end runs on into a broken group
    ["XAED 80,000–90,000", "USD"], // the code is glued to a word
    ["AED 80,0000", "USD"], // a single amount runs on
    ["AED 80,000.5", "EUR"],
    ["$3,0000", "EUR"],
    ["$3,000.50", "AED"],
    ["US$3,000", "EUR"], // the dollar sign is glued to a word
    ["USD $3,0001", "EUR"],
  ];
  for (const [text, code] of cases) {
    for (const locale of LOCALES) assert.equal(rewriteHomeAmounts(text, code, FIXTURE, locale), text, `${text} -> ${code} (${locale})`);
  }
});

test("SF-1: a whole amount next to punctuation or the end of the line still converts", () => {
  assert.equal(rewriteHomeAmounts("(AED 80,000–90,000)", "USD", FIXTURE, "en"), "(USD 21,783.53–24,506.47)");
  assert.equal(rewriteHomeAmounts("Est. AED 80,000–90,000.", "USD", FIXTURE, "en"), "Est. USD 21,783.53–24,506.47.");
  assert.equal(rewriteHomeAmounts("AED 200,000–250,000+", "EUR", FIXTURE, "es"), "EUR 50,102.11–62,627.64+");
  assert.equal(rewriteHomeAmounts("$3,000, per person", "EUR", FIXTURE, "en"), "EUR 2,760, per person");
  assert.equal(rewriteHomeAmounts("from $20,000/person", "EUR", FIXTURE, "ar"), "from EUR 18,400/person");
});

// Zero, negative, NaN, infinite and non-number rates. JSON cannot carry NaN or Infinity, so the feed
// test below sends 1e400 (parses to Infinity) and strings instead.
const BAD_RATES = [0, -3.6725, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "3.6725", null, undefined, true, {}];

test("SF-2: convertWrittenAmount refuses a bad rate instead of returning a number", () => {
  for (const bad of BAD_RATES) {
    const badAed = { aed: bad, eur: FIXTURE.eur };
    const badEur = { aed: FIXTURE.aed, eur: bad };
    for (const amount of [3000, 80000]) {
      assert.equal(convertWrittenAmount({ amount, currency: "USD" }, "AED", badAed), null, `USD->AED aed=${String(bad)}`);
      assert.equal(convertWrittenAmount({ amount, currency: "AED" }, "USD", badAed), null, `AED->USD aed=${String(bad)}`);
      assert.equal(convertWrittenAmount({ amount, currency: "AED" }, "EUR", badAed), null, `AED->EUR aed=${String(bad)}`);
      assert.equal(convertWrittenAmount({ amount, currency: "USD" }, "EUR", badEur), null, `USD->EUR eur=${String(bad)}`);
      assert.equal(convertWrittenAmount({ amount, currency: "AED" }, "EUR", badEur), null, `AED->EUR eur=${String(bad)}`);
    }
  }
});

test("SF-2: with a bad rate every published label stays exactly as written", () => {
  for (const bad of BAD_RATES) {
    for (const rates of [{ aed: bad, eur: FIXTURE.eur }, { aed: FIXTURE.aed, eur: bad }]) {
      for (const label of LABELS) {
        for (const code of CODES) {
          for (const locale of LOCALES) {
            const out = rewriteHomeAmounts(label, code, rates, locale);
            assert.equal(out, label, `${code} ${locale} aed=${String(rates.aed)} eur=${String(rates.eur)}`);
          }
        }
      }
    }
  }
});

test("SF-2: a range converts only when both ends come out finite and above zero", () => {
  for (const text of ["AED 0–90,000", "AED 80,000–0", "AED 0–0+"]) {
    for (const code of ["USD", "EUR"]) {
      for (const locale of LOCALES) assert.equal(rewriteHomeAmounts(text, code, FIXTURE, locale), text, `${text} -> ${code}`);
    }
  }
});

test("SF-2: the feed is refused when a rate is zero, negative, infinite or not a number", async () => {
  // A fresh copy of the module, so the 12-hour memory of another test cannot answer for the feed.
  const { loadRates } = await import("../lib/fx/rates.ts?bad-feed");
  const bodies = [
    '{"date":"2026-10-03","usd":{"aed":0,"eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":-3.6725,"eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":1e400,"eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":"3.6725","eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":null,"eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":true,"eur":0.92}}',
    '{"date":"2026-10-03","usd":{"aed":3.6725,"eur":0}}',
    '{"date":"2026-10-03","usd":{"aed":3.6725,"eur":"NaN"}}',
    '{"date":"2026-10-03","usd":{"aed":3.6725,"eur":-1e400}}',
    '{"date":"2026-10-03","usd":{"aed":3.6725}}',
  ];
  const originalFetch = globalThis.fetch;
  try {
    for (const body of bodies) {
      globalThis.fetch = async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } });
      assert.equal(await loadRates(), null, body);
    }
    globalThis.fetch = async () =>
      new Response('{"date":"2026-10-03","usd":{"aed":3.6725,"eur":0.92}}', { status: 200 });
    assert.deepEqual(await loadRates(), { aed: 3.6725, eur: 0.92, date: "2026-10-03" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
