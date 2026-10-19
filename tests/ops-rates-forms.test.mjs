// Phase 3.2 plan 15: the pure rules of the stay panel's Rates, Availability and Access tabs (rates-forms.ts). No server,
// no port. The browser behaviour of the tabs is tests/ops-stay-tabs.spec.ts (after the owner signs the pictures).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const FILE = "app/dashboard/(ops)/catalog/stays/rates-forms.ts";
const {
  moneyString, rangePayload, nightsInRange, lastToExclusive, checkSpan, monthWindow, blockedDays, calendarBlockHref,
  accessPayload, withBaseRate, MAX_RANGE_NIGHTS, MAX_CHECK_NIGHTS, MAX_ACCESS_CHARS,
} = await loadTs(FILE);

test("moneyString: the API's 2-decimal AED string, never a float", () => {
  assert.deepEqual(moneyString("1250"), { ok: true, value: "1250.00" });
  assert.deepEqual(moneyString("1250.5"), { ok: true, value: "1250.50" });
  assert.deepEqual(moneyString(" 980.75 "), { ok: true, value: "980.75" });
  assert.deepEqual(moneyString("١٢٥٠٫٥"), { ok: true, value: "1250.50" }, "Arabic-Indic digits and decimal mark");
  for (const bad of ["0", "0.00", "-5", "abc", "1.234", "1,250", "1250,50", "01250", "12345678901", "1e3", ".5"]) {
    assert.deepEqual(moneyString(bad), { ok: false }, bad);
  }
});

test("moneyString: empty clears the base rate only", () => {
  assert.deepEqual(moneyString("", { allowEmpty: true }), { ok: true, value: null });
  assert.deepEqual(moneyString("   ", { allowEmpty: true }), { ok: true, value: null });
  assert.deepEqual(moneyString(""), { ok: false });
});

test("nightsInRange counts both ends; lastToExclusive is the day after", () => {
  assert.equal(nightsInRange("2026-12-20", "2026-12-20"), 1);
  assert.equal(nightsInRange("2026-12-20", "2027-01-05"), 17);
  assert.equal(nightsInRange("2027-01-05", "2026-12-20"), 0);
  assert.equal(nightsInRange("2026-02-30", "2026-03-01"), 0, "a day that does not exist");
  assert.equal(nightsInRange("2028-02-28", "2028-03-01"), 3, "leap year");
  assert.equal(lastToExclusive("2026-12-31"), "2027-01-01");
  assert.equal(lastToExclusive("2028-02-28"), "2028-02-29");
  assert.throws(() => lastToExclusive("2026-13-01"));
});

test("rangePayload: the save_range body, or the first wrong field", () => {
  assert.deepEqual(rangePayload({ first: "2026-12-20", last: "2027-01-05", rate: "1800" }), {
    ok: true,
    value: { first_night: "2026-12-20", last_night: "2027-01-05", nightly_rate_aed: "1800.00" },
  });
  assert.deepEqual(rangePayload({ id: "r1", first: "2026-12-31", last: "2026-12-31", rate: "2000.5" }).value, {
    id: "r1", first_night: "2026-12-31", last_night: "2026-12-31", nightly_rate_aed: "2000.50",
  });
  assert.deepEqual(rangePayload({ first: null, last: "2027-01-05", rate: "1800" }), { ok: false, field: "first_night", reason: "required" });
  assert.deepEqual(rangePayload({ first: "2026-12-20", last: null, rate: "1800" }), { ok: false, field: "last_night", reason: "required" });
  assert.deepEqual(rangePayload({ first: "2027-01-05", last: "2026-12-20", rate: "1800" }), { ok: false, field: "last_night", reason: "order" });
  assert.deepEqual(rangePayload({ first: "2026-12-20", last: "2026-12-21", rate: "" }), { ok: false, field: "nightly_rate_aed", reason: "money" });
  assert.deepEqual(rangePayload({ first: "2026-12-20", last: "2026-12-21", rate: "0" }), { ok: false, field: "nightly_rate_aed", reason: "money" });
});

test("rangePayload: 730 nights is the most, 731 is refused", () => {
  assert.equal(MAX_RANGE_NIGHTS, 730);
  assert.equal(rangePayload({ first: "2026-01-01", last: "2027-12-31", rate: "1" }).ok, true); // 730 nights
  assert.deepEqual(rangePayload({ first: "2026-01-01", last: "2028-01-01", rate: "1" }), { ok: false, field: "last_night", reason: "too_long" });
});

test("checkSpan: nights [from, to) for the price check, at most 366", () => {
  assert.deepEqual(checkSpan("2026-12-18", "2026-12-24"), { ok: true, from: "2026-12-18", to: "2026-12-25" });
  assert.deepEqual(checkSpan("2026-12-18", "2026-12-18"), { ok: true, from: "2026-12-18", to: "2026-12-19" });
  assert.equal(MAX_CHECK_NIGHTS, 366);
  assert.equal(checkSpan("2027-01-01", "2028-01-01").ok, true); // 366 nights
  assert.deepEqual(checkSpan("2027-01-01", "2028-01-02"), { ok: false, reason: "too_long" });
  assert.deepEqual(checkSpan("2026-12-24", "2026-12-18"), { ok: false, reason: "order" });
  assert.deepEqual(checkSpan(null, "2026-12-18"), { ok: false, reason: "required" });
});

test("monthWindow: first and last day, both inclusive", () => {
  assert.deepEqual(monthWindow(2026, 12), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(monthWindow(2028, 2), { from: "2028-02-01", to: "2028-02-29" });
});

test("blockedDays: inclusive ends, clipped to the month, every covering block kept", () => {
  const block = (id, scope, starts_on, ends_on) => ({ id, scope, destination_id: null, stay_id: null, starts_on, ends_on, reason: null, created_at: "" });
  const all = block("a", "all", "2026-11-29", "2026-12-02");
  const stay = block("s", "stay", "2026-12-24", "2026-12-26");
  const dest = block("d", "destination", "2026-12-26", "2027-01-03");
  const days = blockedDays([all, stay, dest], 2026, 12);
  assert.deepEqual([...days.keys()].sort(), [
    "2026-12-01", "2026-12-02", "2026-12-24", "2026-12-25", "2026-12-26",
    "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
  ]);
  assert.deepEqual(days.get("2026-12-26").map((b) => b.id), ["s", "d"]);
  assert.equal(blockedDays([], 2026, 12).size, 0);
});

test("calendarBlockHref: /dashboard in next dev, /calendar on the ops host", () => {
  const id = "0b6f3a4e-1111-4222-8333-944455556666";
  assert.equal(calendarBlockHref("/dashboard/catalog/stays", id), `/dashboard/calendar?block=stay&stay_id=${id}`);
  assert.equal(calendarBlockHref("/dashboard", id), `/dashboard/calendar?block=stay&stay_id=${id}`);
  assert.equal(calendarBlockHref("/catalog/stays", id), `/calendar?block=stay&stay_id=${id}`);
  assert.equal(calendarBlockHref("/dashboards", id), `/calendar?block=stay&stay_id=${id}`);
});

test("accessPayload: blanks are null, the rest exactly as typed, 2,000 characters at most", () => {
  const typed = { address: " [Address] ", wifi_name: "", wifi_password: " pass word ", door_code: "   ", notes: "[Notes]" };
  assert.deepEqual(accessPayload(typed), {
    ok: true,
    value: { address: " [Address] ", wifi_name: null, wifi_password: " pass word ", door_code: null, notes: "[Notes]" },
  });
  assert.equal(MAX_ACCESS_CHARS, 2000);
  const empty = { address: "", wifi_name: "", wifi_password: "", door_code: "", notes: "" };
  assert.equal(accessPayload({ ...empty, notes: "ب".repeat(2000) }).ok, true);
  assert.equal(accessPayload({ ...empty, notes: "😀".repeat(2000) }).ok, true, "characters, not UTF-16 units");
  assert.deepEqual(accessPayload({ ...empty, door_code: "x".repeat(2001) }), { ok: false, field: "door_code" });
});

test("withBaseRate: only the stay's price changes; the same object when nothing changed; null stays null (PR #23 review)", () => {
  const stay = { id: "s2", base_nightly_rate_aed: null, translations: { en: { title: "[Casa Dos]" } } };
  const priced = withBaseRate(stay, "s2", "12.50");
  assert.notEqual(priced, stay, "a new object, so the screen draws it");
  assert.deepEqual(priced, { ...stay, base_nightly_rate_aed: "12.50" });
  assert.equal(priced.translations, stay.translations, "everything else is the same reference");
  assert.equal(stay.base_nightly_rate_aed, null, "the old stay is not changed");
  assert.equal(withBaseRate(priced, "s2", "12.50"), priced, "same price: same object");
  assert.deepEqual(withBaseRate(priced, "s2", null), { ...stay, base_nightly_rate_aed: null }, "cleared");
  assert.equal(withBaseRate(null, "s2", "12.50"), null, "no stay open");
});

test("withBaseRate: a price saved for another stay leaves the open stay unchanged (PR #23 round 2)", () => {
  // The owner opened [Casa Uno] while [Casa Dos]'s set_base was still in flight.
  const open = { id: "s1", base_nightly_rate_aed: "[PRICE]" };
  assert.equal(withBaseRate(open, "s2", "12.50"), open, "same object, its price untouched");
  assert.equal(withBaseRate(open, "s2", null), open, "a clear for another stay changes nothing either");
});

test("source guards: pure module, no request, no console, never a total", () => {
  const src = readFileSync(FILE, "utf8");
  assert.doesNotMatch(src, /fetch\(|console\.|from "react"|XMLHttpRequest/);
  assert.doesNotMatch(src, /\btotal\b\s*[=:(]/i, "no computed total");
});
