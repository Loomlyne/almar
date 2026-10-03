import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { CalendarDate } from "@internationalized/date";

// tests/helpers/load-ts.mjs leaves packages external, and its output sits in the temp folder where a bare
// import such as @internationalized/date cannot be found. This module needs that package, so it is bundled whole.
let counter = 0;
async function loadTs(path) {
  const out = await build({
    entryPoints: [resolve(process.cwd(), path)],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-stay-value-")), `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}


// Plan 03.3-06 task 1: the stay page's pre-fill and dock rules as pure functions. Every expected
// string is computed here from lib/journey-format.ts and lib/copy/journey.ts, never typed by hand.

const value = await loadTs("components/pages/stay-detail/booking-value.ts");
const { formatGuestSummary } = await loadTs("lib/journey-format.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
const { formatDate } = await loadTs("lib/format.ts");

const TODAY = new CalendarDate(2026, 10, 3);
const SLUG = "cartagena";
const BLOCKED = value.toCalendarDates(["2026-10-17", "2026-10-18", "2026-11-10"]);
const ctx = { destinationSlug: SLUG, blocked: BLOCKED };

const stored = (patch = {}) => ({
  destination_id: "medellin",
  from: "2026-10-20",
  to: "2026-10-24",
  adults: 2,
  children: 1,
  infants: 0,
  guests_set: true,
  ...patch,
});

const ymd = (d) => (d ? [d.year, d.month, d.day] : null);

test("toCalendarDates parses ISO dates and throws on anything malformed", () => {
  const dates = value.toCalendarDates(["2026-11-14", "2026-12-01"]);
  assert.deepEqual(dates.map(ymd), [
    [2026, 11, 14],
    [2026, 12, 1],
  ]);
  assert.deepEqual(value.toCalendarDates([]), []);
  // parseDate alone would clamp "2026-02-30" and "2026-13-01"; a bad fixture must fail the build instead.
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-4", "14/11/2026", "", "nope", "2026-11-14T00:00"]) {
    assert.throws(() => value.toCalendarDates([bad]), `${JSON.stringify(bad)} must throw`);
  }
  assert.throws(() => value.toCalendarDates(["2026-11-14", "x"]));
});

test("rangeHitsBlocked checks the nights, not the departure day", () => {
  const d = (m, day) => new CalendarDate(2026, m, day);
  // a blocked night inside the range
  assert.equal(value.rangeHitsBlocked(d(10, 15), d(10, 20), BLOCKED), true);
  // the arrival night is a night
  assert.equal(value.rangeHitsBlocked(d(10, 17), d(10, 20), BLOCKED), true);
  // the departure day itself may be blocked: the guest leaves that morning
  assert.equal(value.rangeHitsBlocked(d(10, 15), d(10, 17), BLOCKED), false);
  // nothing blocked, and an empty block list
  assert.equal(value.rangeHitsBlocked(d(10, 20), d(10, 24), BLOCKED), false);
  assert.equal(value.rangeHitsBlocked(d(10, 15), d(10, 20), []), false);
  // a range across a month end
  assert.equal(value.rangeHitsBlocked(d(10, 30), d(11, 12), BLOCKED), true);
});

test("a stored Medellin choice with valid dates keeps the dates and takes the stay's destination", () => {
  const v = value.initialStayValue(stored(), ctx, TODAY);
  assert.equal(v.destinationId, SLUG);
  assert.deepEqual(ymd(v.start), [2026, 10, 20]);
  assert.deepEqual(ymd(v.end), [2026, 10, 24]);
  assert.equal(v.adults, 2);
  assert.equal(v.children, 1);
  assert.equal(v.infants, 0);
});

test("nothing stored gives the defaults: the stay's destination, no dates, one adult", () => {
  const v = value.initialStayValue(null, ctx, TODAY);
  assert.deepEqual(v, { destinationId: SLUG, start: null, end: null, adults: 1, children: 0, infants: 0 });
});

test("a stored range with a blocked night drops both dates and keeps the guests", () => {
  const v = value.initialStayValue(stored({ from: "2026-10-15", to: "2026-10-20" }), ctx, TODAY);
  assert.equal(v.start, null);
  assert.equal(v.end, null);
  assert.equal(v.adults, 2);
  assert.equal(v.children, 1);
});

test("a stored range that ends on a blocked day is kept", () => {
  const v = value.initialStayValue(stored({ from: "2026-10-15", to: "2026-10-17" }), ctx, TODAY);
  assert.deepEqual(ymd(v.start), [2026, 10, 15]);
  assert.deepEqual(ymd(v.end), [2026, 10, 17]);
});

test("a past start drops the dates, today is allowed, guests are kept", () => {
  const past = value.initialStayValue(stored({ from: "2026-10-02", to: "2026-10-06" }), ctx, TODAY);
  assert.equal(past.start, null);
  assert.equal(past.end, null);
  assert.equal(past.adults, 2);
  const same = value.initialStayValue(stored({ from: "2026-10-03", to: "2026-10-06" }), ctx, TODAY);
  assert.deepEqual(ymd(same.start), [2026, 10, 3]);
});

test("a range that does not end after it starts, or has one end only, drops both dates", () => {
  for (const patch of [
    { from: "2026-10-20", to: "2026-10-20" },
    { from: "2026-10-24", to: "2026-10-20" },
    { from: "2026-10-20", to: null },
    { from: null, to: "2026-10-24" },
    { from: "not a date", to: "2026-10-24" },
  ]) {
    const v = value.initialStayValue(stored(patch), ctx, TODAY);
    assert.equal(v.start, null, JSON.stringify(patch));
    assert.equal(v.end, null, JSON.stringify(patch));
  }
});

test("guest counts are clamped: adults at least 1, children and infants at least 0", () => {
  const zero = value.initialStayValue(stored({ adults: 0 }), ctx, TODAY);
  assert.equal(zero.adults, 1);
  const negative = value.initialStayValue(stored({ adults: -3, children: -1, infants: -2 }), ctx, TODAY);
  assert.deepEqual([negative.adults, negative.children, negative.infants], [1, 0, 0]);
});

const dockInput = (patch) => ({
  destinationId: SLUG,
  start: null,
  end: null,
  adults: 1,
  children: 0,
  infants: 0,
  ...patch,
});
const NAMES = { destinationName: "Cartagena", title: "Getsemaní Colonial House" };

test("dockLines: stay line, then the empty Dates value and the guest summary", () => {
  const copy = JOURNEY_COPY.en;
  const lines = value.dockLines(dockInput({}), NAMES, copy, "en");
  assert.equal(lines.line1, "Cartagena, Getsemaní Colonial House");
  assert.equal(lines.line2, `${copy.bar.dates.empty} · ${formatGuestSummary({ adults: 1, children: 0, infants: 0 }, "en", copy.guests.summary)}`);
});

test("dockLines: a range in DD/MM/YYYY, a half range and several guest groups", () => {
  const copy = JOURNEY_COPY.en;
  const start = new CalendarDate(2026, 10, 12);
  const end = new CalendarDate(2026, 10, 17);
  const guests = { adults: 2, children: 1, infants: 1 };
  const full = value.dockLines(dockInput({ start, end, ...guests }), NAMES, copy, "en");
  const a = formatDate(12, 10, 2026);
  const b = formatDate(17, 10, 2026);
  assert.equal(full.line2, `${a} – ${b} · ${formatGuestSummary(guests, "en", copy.guests.summary)}`);
  const half = value.dockLines(dockInput({ start }), NAMES, copy, "en");
  assert.equal(half.line2, `${copy.bar.dates.partial.replace("{start}", a)} · ${formatGuestSummary({ adults: 1, children: 0, infants: 0 }, "en", copy.guests.summary)}`);
});

test("dockLines in Arabic: the dual guest form and Western digits", () => {
  const copy = JOURNEY_COPY.ar;
  const start = new CalendarDate(2026, 10, 12);
  const end = new CalendarDate(2026, 10, 17);
  const guests = { adults: 2, children: 0, infants: 0 };
  const lines = value.dockLines(dockInput({ start, end, ...guests }), { destinationName: "قرطاجنة", title: "بيت" }, copy, "ar");
  const summary = formatGuestSummary(guests, "ar", copy.guests.summary);
  assert.equal(lines.line2, `${formatDate(12, 10, 2026)} – ${formatDate(17, 10, 2026)} · ${summary}`);
  assert.equal(/[٠-٩]/.test(lines.line1 + lines.line2), false, "no Arabic-Indic digits");
  assert.ok(lines.line1.startsWith("قرطاجنة"));
  assert.ok(lines.line1.endsWith("بيت"));
  // the dual: two adults is not written with the plural number form
  assert.equal(summary, formatGuestSummary({ adults: 2, children: 0, infants: 0 }, "ar", copy.guests.summary));
  assert.notEqual(summary, formatGuestSummary({ adults: 3, children: 0, infants: 0 }, "ar", copy.guests.summary));
});

test("dockLines in Spanish uses the Spanish empty Dates value", () => {
  const copy = JOURNEY_COPY.es;
  const lines = value.dockLines(dockInput({}), NAMES, copy, "es");
  assert.ok(lines.line2.startsWith(copy.bar.dates.empty));
});

test("the module reads no data layer and no file system", () => {
  const source = readFileSync("components/pages/stay-detail/booking-value.ts", "utf8");
  assert.equal(/lib\/data\/(stays|experiences|fixtures|resolve|media)|readFileSync|node:fs/.test(source), false);
  // type-only imports from lib/data/types are the one allowed link to the data layer
  for (const line of source.split("\n").filter((l) => /^import\s/.test(l) && l.includes("lib/data"))) {
    assert.match(line, /^import type /);
  }
});
