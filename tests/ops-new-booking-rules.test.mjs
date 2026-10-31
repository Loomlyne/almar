// Plan 05-02 Task 3: the pure rules of the owner's New booking screen (lib/ops/new-booking-rules.ts). Symbolic values only.
// WRITTEN, NOT RUN (owner's no-test rule).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const rules = await loadTs("lib/ops/new-booking-rules.ts");

test("holdIso: a real day and a UAE time give the +04:00 instant; a bad part gives null", () => {
  assert.equal(rules.holdIso("2026-11-02", "14:30"), "2026-11-02T14:30:00+04:00");
  assert.equal(rules.holdIso("2026-02-30", "14:30"), null);
  assert.equal(rules.holdIso("2026-11-02", "24:00"), null);
  assert.equal(rules.holdIso("2026-11-02", "9:30"), null);
  assert.equal(rules.holdIso("", ""), null);
});

test("holdFloorOk: exactly 35 minutes after now is false, 36 is true", () => {
  const now = Date.parse("2026-11-02T10:00:00+04:00");
  assert.equal(rules.holdFloorOk("2026-11-02T10:35:00+04:00", now), false);
  assert.equal(rules.holdFloorOk("2026-11-02T10:36:00+04:00", now), true);
  assert.equal(rules.holdFloorOk("nonsense", now), false);
});

test("guestProblems: an empty name, an address without @ and a 6-digit phone are flagged; a plus, spaces and brackets pass", () => {
  assert.deepEqual(rules.guestProblems({ name: "", email: "no-at-sign", phone: "123456" }), { name: true, email: true, phone: true });
  assert.deepEqual(rules.guestProblems({ name: "[guest name]", email: "Guest@Example.com", phone: "+971 (50) 000-0000" }), {});
});

test("cleanEmail trims and lowercases", () => {
  assert.equal(rules.cleanEmail("  Guest@Example.COM "), "guest@example.com");
});

test("stepOfField sends each field to its step", () => {
  for (const f of ["guest", "guest.name", "guest.email", "guest.phone"]) assert.equal(rules.stepOfField(f), 1, f);
  for (const f of ["stay", "from", "to", "adults"]) assert.equal(rules.stepOfField(f), 2, f);
  for (const f of ["addons", "addons.qty", "airport", "pickup_address"]) assert.equal(rules.stepOfField(f), 3, f);
  for (const f of ["hold_until", "plan", "agreed_amount", "agreed_reason"]) assert.equal(rules.stepOfField(f), 4, f);
  for (const f of ["is_test", "request_id", "anything"]) assert.equal(rules.stepOfField(f), 5, f);
  assert.equal(rules.stepOfField(null), 5);
});

test("createAllowed: real needs the real gate, TEST needs the TEST gate; TEST with only the real gate open is false", () => {
  assert.equal(rules.createAllowed({ isTest: false, realOpen: true, testOpen: false }), true);
  assert.equal(rules.createAllowed({ isTest: false, realOpen: false, testOpen: true }), false);
  assert.equal(rules.createAllowed({ isTest: true, realOpen: false, testOpen: true }), true);
  assert.equal(rules.createAllowed({ isTest: true, realOpen: true, testOpen: false }), false);
});

const TODAY = "2026-11-01";
const row = (kind, payload, over = {}) => ({ kind, name: " [Guest name] ", email: "Guest@Example.COM", locale: "es", payload, ...over });

test("prefillFrom: a list request gives nothing", () => {
  assert.equal(rules.prefillFrom(row("list", { property_type: "x", city: "y", message: "z" }), TODAY), null);
});

test("prefillFrom: a plan with dates and 3 guests gives those; email lowercased, name trimmed, locale kept", () => {
  const p = rules.prefillFrom(row("plan", { from: "2026-12-10", to: "2026-12-14", guests: 3, phone: "+971 50 000 0000" }), TODAY);
  assert.deepEqual(p, { name: "[Guest name]", email: "guest@example.com", phone: "+971 50 000 0000", locale: "es", from: "2026-12-10", to: "2026-12-14", adults: 3 });
});

test("prefillFrom: a past from drops both dates; reversed dates drop both", () => {
  const past = rules.prefillFrom(row("package", { from: "2026-10-01", to: "2026-10-05", guests: 2 }), TODAY);
  assert.equal(past.from, null);
  assert.equal(past.to, null);
  assert.equal(past.adults, 2);
  const reversed = rules.prefillFrom(row("plan", { from: "2026-12-14", to: "2026-12-10" }), TODAY);
  assert.equal(reversed.from, null);
});

test("prefillFrom: a consultation gives name, email, phone and no dates", () => {
  const c = rules.prefillFrom(row("consultation", { slot_start: "2026-12-10T10:00:00+04:00", time_zone: "Asia/Dubai", phone: "+971 50 000 0000", from: "2026-12-10", to: "2026-12-12" }), TODAY);
  assert.equal(c.from, null);
  assert.equal(c.to, null);
  assert.equal(c.phone, "+971 50 000 0000");
  assert.equal(c.adults, null);
});

test("prefillFrom: guests outside 1..99 make the request unusable (null); a missing phone is empty text", () => {
  assert.equal(rules.prefillFrom(row("plan", { guests: 0 }), TODAY), null);
  assert.equal(rules.prefillFrom(row("plan", { guests: 100 }), TODAY), null);
  assert.equal(rules.prefillFrom(row("plan", {}), TODAY).phone, "");
});

test("the rules file is pure: no React, no fetch, no clock of its own", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("lib/ops/new-booking-rules.ts", "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.doesNotMatch(src, /from "react"|fetch\(|Date\.now|new Date\(\)|process\.env/);
});
