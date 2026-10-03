import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRENCY_CHOICE_KEY, parseCurrencyChoice } from "../lib/currency-choice.ts";
import {
  JOURNEY_CHOICE_KEY,
  journeyChoiceToStayQuery,
  parseJourneyChoice,
  serializeJourneyChoice,
} from "../lib/journey-choice.ts";

// Plan 03.3-04 Task 1: the two saved choices the home page keeps. The journey choice module belongs to plan
// 02 (reconcile R-1) and has its own test; the cases here are the ones the home provider relies on.

const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("the currency key is fixed and the module touches no browser API and imports only a type", () => {
  assert.equal(CURRENCY_CHOICE_KEY, "almar-currency");
  const source = readFileSync("lib/currency-choice.ts", "utf8");
  assert.equal(/\b(window|document|sessionStorage|localStorage)\b/.test(strip(source)), false);
  const imports = source.match(/^import\s.*$/gm) ?? [];
  assert.ok(imports.every((line) => line.startsWith("import type")), imports.join("\n"));
});

test("parseCurrencyChoice accepts exactly AED, USD and EUR", () => {
  for (const code of ["AED", "USD", "EUR"]) assert.equal(parseCurrencyChoice(code), code);
});

test("parseCurrencyChoice drops everything else: null, empty, other case, other code, padding, markup", () => {
  for (const bad of [null, undefined, "", "aed", "Aed", "usd", "GBP", "AED ", " USD", "AED\n", "EURO", "<b>", "AED,USD", "0"]) {
    assert.equal(parseCurrencyChoice(bad), null, JSON.stringify(bad));
  }
});

const choice = {
  destination_id: "8990190e-2836-58e4-9eb0-3ac94c24632a",
  from: "2026-10-12",
  to: "2026-10-17",
  adults: 2,
  children: 1,
  infants: 0,
  guests_set: true,
};

test("the journey key is the shared one and a choice round-trips through its stored form", () => {
  assert.equal(JOURNEY_CHOICE_KEY, "almar-journey-choice");
  const text = serializeJourneyChoice(choice);
  assert.deepEqual(Object.keys(JSON.parse(text)), [
    "destination_id",
    "from",
    "to",
    "adults",
    "children",
    "infants",
    "guests_set",
  ]);
  assert.deepEqual(parseJourneyChoice(text), choice);
});

test("a stored value that is malformed, mistyped, impossible or reversed is dropped, never repaired", () => {
  const store = (patch) => JSON.stringify({ ...choice, ...patch });
  const bad = [
    "{",
    "null",
    "[]",
    store({ extra: 1 }),
    store({ adults: "2" }),
    store({ from: "2026-02-30" }),
    store({ from: "12/10/2026" }),
    store({ adults: 0 }),
    store({ children: -1 }),
    store({ infants: -1 }),
    store({ from: "2026-10-17", to: "2026-10-12" }),
    store({ from: "2026-10-12", to: "2026-10-12" }),
    store({ destination_id: "a b" }),
    store({ guests_set: "yes" }),
  ];
  for (const text of bad) assert.equal(parseJourneyChoice(text), null, text);
});

test("an arrival in the past is dropped when today is given (a stale tab restores nothing)", () => {
  const text = serializeJourneyChoice(choice);
  assert.deepEqual(parseJourneyChoice(text, "2026-10-12"), choice);
  assert.equal(parseJourneyChoice(text, "2026-10-13"), null);
});

test("the stay query: slug and dates always, guests only when the Who step was touched", () => {
  const slugs = { [choice.destination_id]: "cartagena" };
  assert.deepEqual(journeyChoiceToStayQuery(choice, slugs), {
    destination: "cartagena",
    from: "2026-10-12",
    to: "2026-10-17",
    guests: 3,
  });
  assert.deepEqual(journeyChoiceToStayQuery({ ...choice, guests_set: false }, slugs), {
    destination: "cartagena",
    from: "2026-10-12",
    to: "2026-10-17",
  });
  assert.deepEqual(
    journeyChoiceToStayQuery({ ...choice, destination_id: null, from: null, to: null, guests_set: false }, slugs),
    {},
  );
  // An id with no slug adds no destination; a prototype name never resolves.
  assert.deepEqual(journeyChoiceToStayQuery({ ...choice, destination_id: "constructor", guests_set: false }, slugs), {
    from: "2026-10-12",
    to: "2026-10-17",
  });
});
