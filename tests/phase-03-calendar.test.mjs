import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CalendarDate, getDayOfWeek } from "@internationalized/date";

const CALENDAR_PAGE = "app/dashboard/(ops)/calendar/page.tsx";
const CALENDAR_SCREEN = "app/dashboard/(ops)/calendar/calendar-screen.tsx";

test("a known Monday (2026-09-28) is day index 0 with en-GB", () => {
  const weekday = getDayOfWeek(new CalendarDate(2026, 9, 28), "en-GB");
  assert.equal(weekday, 0);
});

test("calendar page gates production and delegates to the client screen", () => {
  const page = readFileSync(CALENDAR_PAGE, "utf8");
  assert.equal(page.includes("use client"), false);
  assert.match(page, /NODE_ENV/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /from ["']\.\/calendar-screen["']/);
});

test("calendar screen uses Asia/Dubai and does not implement overlap, hold, or cutoff", () => {
  const text = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.match(text, /Asia\/Dubai/);
  assert.doesNotMatch(text.toLowerCase(), /overlap/);
  assert.doesNotMatch(text.toLowerCase(), /\bhold\b/);
  assert.doesNotMatch(text.toLowerCase(), /cutoff/);
});

test("calendar screen draws no booking and does not use CalendarPanel", () => {
  const text = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.doesNotMatch(text, /CalendarPanel/);
  assert.doesNotMatch(text, /booking-row|booking-bar|booking-title/);
});

test("calendar screen uses getDayOfWeek with en-GB for the Monday-start grid", () => {
  const text = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.match(text, /getDayOfWeek\(/);
  assert.match(text, /"en-GB"/);
  assert.match(text, /today\(/);
});

test("the empty day sidebar has No bookings yet, New booking, and Block", () => {
  const text = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.match(text, /copy\.noBookingsYet/);
  assert.match(text, /copy\.newBooking/);
  assert.match(text, /copy\.block/);
});

test("sidebar.tsx keeps its close control and docks to the end side", () => {
  const text = readFileSync("components/ui/sidebar.tsx", "utf8");
  assert.match(text, /Close/);
  assert.match(text, /\bend-0\b/);
  assert.equal(text.includes("dockEnd"), false);
});
