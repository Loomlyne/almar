import test from "node:test";
import assert from "node:assert/strict";
import { fill, formatGuestSummary, formatPlural } from "../lib/journey-format.ts";
import { JOURNEY_COPY } from "../lib/copy/journey.ts";

const forms = (l) => JOURNEY_COPY[l].guests.summary;

test("en: 2 adults", () => {
  assert.equal(formatGuestSummary({ adults: 2, children: 0, infants: 0 }, "en", forms("en")), "2 adults");
});

test("en: 1 adult singular", () => {
  assert.equal(formatGuestSummary({ adults: 1, children: 0, infants: 0 }, "en", forms("en")), "1 adult");
});

test("en: 2 adults, 1 child, 1 infant", () => {
  assert.equal(
    formatGuestSummary({ adults: 2, children: 1, infants: 1 }, "en", forms("en")),
    "2 adults, 1 child, and 1 infant",
  );
});

test("en: zero groups are omitted", () => {
  assert.equal(formatGuestSummary({ adults: 2, children: 0, infants: 1 }, "en", forms("en")), "2 adults and 1 infant");
});

test("ar: dual form for 2", () => {
  assert.equal(formatGuestSummary({ adults: 2, children: 0, infants: 0 }, "ar", forms("ar")), "بالغان");
});

test("ar: few form for 3, Western digits", () => {
  const out = formatGuestSummary({ adults: 3, children: 0, infants: 0 }, "ar", forms("ar"));
  assert.equal(out, "3 بالغين");
  assert.match(out, /^[0-9]/);
});

test("ar: many form for 11 uses Western digits", () => {
  const out = formatGuestSummary({ adults: 11, children: 0, infants: 0 }, "ar", forms("ar"));
  assert.equal(out, "11 بالغًا");
});

test("es: joins with y", () => {
  const out = formatGuestSummary({ adults: 2, children: 1, infants: 1 }, "es", forms("es"));
  assert.match(out, /2 adultos, 1 niño y 1 bebé/);
});

test("formatPlural falls back to other", () => {
  assert.equal(formatPlural({ other: "# x" }, 1, "en"), "1 x");
  assert.equal(formatPlural({ one: "# a", other: "# b" }, 5, "es"), "5 b");
});

test("formatPlural: ar nights use dual", () => {
  assert.equal(formatPlural(JOURNEY_COPY.ar.dates.nights, 2, "ar"), "ليلتان");
  assert.equal(formatPlural(JOURNEY_COPY.en.dates.nights, 5, "en"), "5 nights");
});

test("fill replaces slots and leaves unknown ones", () => {
  assert.equal(fill("Arrive {start}", { start: "12/10/2026" }), "Arrive 12/10/2026");
  assert.equal(fill("{a} {b}", { a: "x" }), "x {b}");
});
