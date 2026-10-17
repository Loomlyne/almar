// Phase 3.2 plan 13: the Block dates form as plain data (app/dashboard/(ops)/calendar/block-form.ts): the add payload,
// the entry link, which days a block covers and every Dubai-day boundary (OPS-09). No server, no port; the screen in a
// browser is tests/ops-calendar.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const FORM = "app/dashboard/(ops)/calendar/block-form.ts";
const { blockPayload, prefillFromQuery, blockCoversDay, dubaiDay, monthWindow, shiftMonth, isIsoDay, REASON_MAX } = await loadTs(FORM);

const ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const OTHER = "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const values = (over = {}) => ({ scope: "all", destinationId: null, stayId: null, first: "2026-11-03", last: "2026-11-05", reason: "", ...over });

// ---- blockPayload (contract 5.4 add) ---------------------------------------------------------------------------------

test("everything: scope all, no id, an empty reason is null", () => {
  assert.deepEqual(blockPayload(values({ destinationId: ID, stayId: OTHER })), {
    ok: true,
    payload: { scope: "all", starts_on: "2026-11-03", ends_on: "2026-11-05", reason: null },
  });
});

test("one destination sends its id and never a stay; one stay sends its id and never a destination", () => {
  const destination = blockPayload(values({ scope: "destination", destinationId: ID, stayId: OTHER }));
  assert.deepEqual(destination, { ok: true, payload: { scope: "destination", destination_id: ID, starts_on: "2026-11-03", ends_on: "2026-11-05", reason: null } });
  const stay = blockPayload(values({ scope: "stay", stayId: OTHER, destinationId: ID }));
  assert.deepEqual(stay, { ok: true, payload: { scope: "stay", stay_id: OTHER, starts_on: "2026-11-03", ends_on: "2026-11-05", reason: null } });
  for (const result of [destination, stay]) {
    assert.equal("destination_id" in result.payload && "stay_id" in result.payload, false);
  }
});

test("a destination or stay scope without its id is refused on that field", () => {
  assert.deepEqual(blockPayload(values({ scope: "destination" })), { ok: false, field: "destination" });
  assert.deepEqual(blockPayload(values({ scope: "stay", destinationId: ID })), { ok: false, field: "stay" });
});

test("the same day is one day; a last day before the first, a missing day or a day that does not exist is refused", () => {
  assert.equal(blockPayload(values({ first: "2026-11-03", last: "2026-11-03" })).ok, true);
  for (const bad of [
    { first: "2026-11-04", last: "2026-11-03" },
    { first: null, last: null },
    { first: "2026-11-03", last: null },
    { first: "2026-02-30", last: "2026-03-01" },
    { first: "03/11/2026", last: "05/11/2026" },
  ]) {
    assert.deepEqual(blockPayload(values(bad)), { ok: false, field: "dates" }, JSON.stringify(bad));
  }
});

test("the reason is trimmed, kept up to 300 characters and refused beyond", () => {
  assert.equal(blockPayload(values({ reason: "  Owner stay  " })).payload.reason, "Owner stay");
  assert.equal(blockPayload(values({ reason: "   " })).payload.reason, null);
  assert.equal(REASON_MAX, 300);
  assert.equal(blockPayload(values({ reason: "x".repeat(300) })).ok, true);
  assert.deepEqual(blockPayload(values({ reason: "x".repeat(301) })), { ok: false, field: "reason" });
});

test("isIsoDay accepts real days only", () => {
  for (const good of ["2026-11-03", "2028-02-29"]) assert.equal(isIsoDay(good), true, good);
  for (const bad of ["2026-02-29", "2026-13-01", "2026-1-1", "", null, 20261103]) assert.equal(isIsoDay(bad), false, String(bad));
});

// ---- prefillFromQuery (the link of 03.2-15) --------------------------------------------------------------------------

test("a stay or destination link with a uuid pre-fills; the id is lower-cased", () => {
  assert.deepEqual(prefillFromQuery(`?block=stay&stay_id=${ID}`), { scope: "stay", stayId: ID });
  assert.deepEqual(prefillFromQuery(`block=destination&destination_id=${ID.toUpperCase()}`), { scope: "destination", destinationId: ID });
});

test("anything else is ignored: a non-uuid, an unknown kind, the wrong id name, no block, extra parameters alone", () => {
  for (const search of [
    "?block=stay&stay_id=not-a-uuid",
    "?block=stay&stay_id=",
    `?block=all&stay_id=${ID}`,
    `?block=stay&destination_id=${ID}`,
    `?block=destination&stay_id=${ID}`,
    `?stay_id=${ID}`,
    "",
    "?block=stay",
    `?block=stay&stay_id=${ID}x`,
  ]) {
    assert.equal(prefillFromQuery(search), null, search);
  }
  // Only the two names are read: nothing else of the URL reaches the result.
  assert.deepEqual(Object.keys(prefillFromQuery(`?block=stay&stay_id=${ID}&reason=hello&first=2026-11-03`)).sort(), ["scope", "stayId"]);
});

// ---- blockCoversDay ---------------------------------------------------------------------------------------------------

test("a block covers its first day, its last day and the days between; not the day before or after", () => {
  const block = { starts_on: "2026-11-03", ends_on: "2026-11-05" };
  assert.deepEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map((day) => blockCoversDay(block, day)), [false, true, true, true, false]);
  assert.equal(blockCoversDay({ starts_on: "2026-11-03", ends_on: "2026-11-03" }, "2026-11-03"), true);
  // Across a month and a year end, as text.
  assert.equal(blockCoversDay({ starts_on: "2026-12-30", ends_on: "2027-01-02" }, "2027-01-01"), true);
});

// ---- Dubai days (OPS-09) ---------------------------------------------------------------------------------------------

test("a Dubai day turns over at 20:00 UTC, not at midnight UTC", () => {
  assert.equal(dubaiDay(new Date("2026-10-14T19:59:59.999Z")), "2026-10-14");
  assert.equal(dubaiDay(new Date("2026-10-14T20:00:00.000Z")), "2026-10-15");
  assert.equal(dubaiDay(new Date("2026-10-14T00:00:00.000Z")), "2026-10-14"); // 04:00 in Dubai
  assert.equal(dubaiDay(new Date("2026-10-14T23:59:59.999Z")), "2026-10-15"); // 03:59 the next morning in Dubai
});

test("the Dubai day crosses a month, a year and a leap day correctly", () => {
  assert.equal(dubaiDay(new Date("2026-10-31T20:00:00Z")), "2026-11-01");
  assert.equal(dubaiDay(new Date("2026-12-31T19:59:59Z")), "2026-12-31");
  assert.equal(dubaiDay(new Date("2026-12-31T20:00:00Z")), "2027-01-01");
  assert.equal(dubaiDay(new Date("2026-02-28T20:00:00Z")), "2026-03-01");
  assert.equal(dubaiDay(new Date("2028-02-28T20:00:00Z")), "2028-02-29");
  assert.equal(dubaiDay(new Date("2028-02-29T20:00:00Z")), "2028-03-01");
});

test("the Dubai day does not depend on the time zone of the machine", () => {
  const before = process.env.TZ;
  try {
    for (const zone of ["Pacific/Pago_Pago", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = zone;
      assert.equal(dubaiDay(new Date("2026-10-14T19:59:59Z")), "2026-10-14", zone);
      assert.equal(dubaiDay(new Date("2026-10-14T20:00:00Z")), "2026-10-15", zone);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("a block ending today still covers today until the Dubai midnight, and not one second after", () => {
  const block = { starts_on: "2026-10-18", ends_on: "2026-10-20" };
  assert.equal(blockCoversDay(block, dubaiDay(new Date("2026-10-20T19:59:59Z"))), true);
  assert.equal(blockCoversDay(block, dubaiDay(new Date("2026-10-20T20:00:00Z"))), false);
  // A block starting tomorrow does not cover today until the Dubai midnight.
  const tomorrow = { starts_on: "2026-10-15", ends_on: "2026-10-15" };
  assert.equal(blockCoversDay(tomorrow, dubaiDay(new Date("2026-10-14T19:59:59Z"))), false);
  assert.equal(blockCoversDay(tomorrow, dubaiDay(new Date("2026-10-14T20:00:00Z"))), true);
});

test("monthWindow is the first and last day, both inclusive, for 28, 29, 30 and 31 days", () => {
  assert.deepEqual(monthWindow(2026, 2), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthWindow(2028, 2), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(monthWindow(2026, 11), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(monthWindow(2026, 12), { from: "2026-12-01", to: "2026-12-31" });
  // The window is never wider than the 400 days the endpoint takes.
  assert.ok(new Date("2026-12-31") - new Date("2026-12-01") < 400 * 86_400_000);
});

test("shiftMonth crosses a year end both ways", () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 10, 0), { year: 2026, month: 10 });
  assert.deepEqual(shiftMonth(2026, 10, 15), { year: 2028, month: 1 });
});

// ---- source guards ----------------------------------------------------------------------------------------------------

test("block-form.ts is pure: no import, no React, no clock read, no fetch", () => {
  const source = readFileSync(FORM, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(/Date\.now\(|new Date\(\)|fetch\(|useState|"use client"/.test(source), false);
  assert.match(source, /Asia\/Dubai/);
});

test("the screen reaches the server only through the ops client, only for /api/ops/blocks, destinations and stays", () => {
  const screen = readFileSync("app/dashboard/(ops)/calendar/calendar-screen.tsx", "utf8");
  assert.equal(/\bfetch\(/.test(screen), false);
  assert.deepEqual([...screen.matchAll(/"\/api\/ops\/[a-z-]+"/g)].map((m) => m[0]).sort(), ['"/api/ops/blocks"', '"/api/ops/blocks"', '"/api/ops/blocks"', '"/api/ops/destinations"', '"/api/ops/stays"']);
  assert.match(screen, /dubaiDay\(new Date\(\)\)/);
  assert.equal(/getLocalTimeZone|toISOString\(\)\.slice/.test(screen), false);
});
