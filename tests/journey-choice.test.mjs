import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JOURNEY_CHOICE_KEY,
  choiceFromValue,
  isIsoDate,
  isoOf,
  journeyChoiceToStayQuery,
  parseJourneyChoice,
  serializeJourneyChoice,
} from "../lib/journey-choice.ts";

const choice = {
  destination_id: "cartagena",
  from: "2026-10-12",
  to: "2026-10-17",
  adults: 2,
  children: 1,
  infants: 0,
  guests_set: true,
};

const store = (patch) => JSON.stringify({ ...choice, ...patch });

test("the key is fixed and the module has no imports and no browser access", () => {
  assert.equal(JOURNEY_CHOICE_KEY, "almar-journey-choice");
  const source = readFileSync("lib/journey-choice.ts", "utf8");
  assert.equal(/^import\s/m.test(source), false);
  assert.equal(/\b(window|document|sessionStorage|localStorage)\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), false);
});

test("serialize writes snake_case keys with ISO dates and parse round-trips it", () => {
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

test("an empty choice (nothing picked, Who untouched) round-trips", () => {
  const empty = { destination_id: null, from: null, to: null, adults: 1, children: 0, infants: 0, guests_set: false };
  assert.deepEqual(parseJourneyChoice(serializeJourneyChoice(empty)), empty);
});

test("arrival only (no departure yet) is a valid partial choice", () => {
  const partial = { ...choice, to: null };
  assert.deepEqual(parseJourneyChoice(serializeJourneyChoice(partial)), partial);
});

test("malformed or non-object input is null", () => {
  for (const bad of [null, undefined, "", "{", "null", "[]", "42", '"x"', "true"]) {
    assert.equal(parseJourneyChoice(bad), null, String(bad));
  }
});

test("a missing, extra or wrongly typed key is null", () => {
  const missing = JSON.parse(store({}));
  delete missing.infants;
  assert.equal(parseJourneyChoice(JSON.stringify(missing)), null);
  assert.equal(parseJourneyChoice(store({ extra: 1 })), null);
  assert.equal(parseJourneyChoice(store({ adults: "2" })), null);
  assert.equal(parseJourneyChoice(store({ guests_set: "yes" })), null);
  assert.equal(parseJourneyChoice(store({ destination_id: 7 })), null);
  assert.equal(parseJourneyChoice(store({ from: 20261012 })), null);
});

test("an impossible or badly written date is null", () => {
  for (const from of ["2026-13-01", "2026-02-30", "12/10/2026", "2026-1-5", "2026-10-12T00:00", ""]) {
    assert.equal(parseJourneyChoice(store({ from })), null, from);
  }
  assert.equal(parseJourneyChoice(store({ to: "2026-10-32" })), null);
});

test("arrival must be before departure", () => {
  assert.equal(parseJourneyChoice(store({ from: "2026-10-17", to: "2026-10-17" })), null);
  assert.equal(parseJourneyChoice(store({ from: "2026-10-18", to: "2026-10-17" })), null);
});

test("adults below 1, any negative or fractional count, or an absurd count is null", () => {
  assert.equal(parseJourneyChoice(store({ adults: 0 })), null);
  assert.equal(parseJourneyChoice(store({ adults: -1 })), null);
  assert.equal(parseJourneyChoice(store({ children: -1 })), null);
  assert.equal(parseJourneyChoice(store({ infants: -3 })), null);
  assert.equal(parseJourneyChoice(store({ adults: 1.5 })), null);
  assert.equal(parseJourneyChoice(store({ children: 100 })), null);
  assert.equal(parseJourneyChoice(store({ adults: null })), null);
});

test("a destination id that is not a plain identifier is null (it is never rendered)", () => {
  for (const id of ["<script>", "a b", "", "x".repeat(81), "a/b"]) {
    assert.equal(parseJourneyChoice(store({ destination_id: id })), null, id);
  }
  assert.ok(parseJourneyChoice(store({ destination_id: "san-andres" })));
});

test("with todayIso an arrival in the past is dropped; today and later are kept", () => {
  assert.equal(parseJourneyChoice(serializeJourneyChoice(choice), "2026-10-13"), null);
  assert.ok(parseJourneyChoice(serializeJourneyChoice(choice), "2026-10-12"));
  assert.ok(parseJourneyChoice(serializeJourneyChoice(choice), "2026-09-29"));
});

test("isIsoDate and isoOf", () => {
  assert.equal(isIsoDate("2026-10-12"), true);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate(null), false);
  assert.equal(isoOf({ year: 2026, month: 3, day: 4 }), "2026-03-04");
});

test("choiceFromValue maps a bar value (CalendarDate-shaped dates) to the stored shape", () => {
  const value = {
    destinationId: "cartagena",
    start: { year: 2026, month: 10, day: 12 },
    end: { year: 2026, month: 10, day: 17 },
    adults: 2,
    children: 1,
    infants: 0,
  };
  assert.deepEqual(choiceFromValue(value, true), choice);
  assert.deepEqual(choiceFromValue({ ...value, destinationId: null, start: null, end: null }, false), {
    destination_id: null,
    from: null,
    to: null,
    adults: 2,
    children: 1,
    infants: 0,
    guests_set: false,
  });
});

test("journeyChoiceToStayQuery: slug, dates, and guests only when Who was touched", () => {
  const slugs = { cartagena: "cartagena", "san-andres": "san-andres-island" };
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
    journeyChoiceToStayQuery({ ...choice, destination_id: "san-andres", from: null, to: null }, slugs),
    { destination: "san-andres-island", guests: 3 },
  );
});

test("journeyChoiceToStayQuery: an id with no slug, and prototype names, add no destination", () => {
  assert.deepEqual(
    journeyChoiceToStayQuery({ ...choice, destination_id: "bogota", guests_set: false, from: null, to: null }, { cartagena: "cartagena" }),
    {},
  );
  assert.deepEqual(
    journeyChoiceToStayQuery({ ...choice, destination_id: "constructor", guests_set: false, from: null, to: null }, {}),
    {},
  );
  assert.deepEqual(
    journeyChoiceToStayQuery(
      { destination_id: null, from: null, to: null, adults: 1, children: 0, infants: 0, guests_set: false },
      {},
    ),
    {},
  );
});
