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

test("calendar page has no page gate (02-04 owner gate in the layout) and delegates to the client screen", () => {
  const page = readFileSync(CALENDAR_PAGE, "utf8");
  assert.equal(page.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(page), false);
  assert.match(page, /from ["']\.\/calendar-screen["']/);
});

const CALENDAR_FILES = [
  "app/dashboard/(ops)/calendar/calendar-screen.tsx",
  "app/dashboard/(ops)/calendar/calendar-view.tsx",
  "app/dashboard/(ops)/calendar/block-form.ts",
  "app/dashboard/(ops)/calendar/block-form-fields.tsx",
];
const calendarText = () => CALENDAR_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("the Calendar reads days in Asia/Dubai (OPS-09) and implements no hold or cutoff; an overlap is only the server's count", () => {
  assert.match(readFileSync("app/dashboard/(ops)/calendar/block-form.ts", "utf8"), /Asia\/Dubai/);
  const text = stripComments(calendarText()).toLowerCase();
  assert.doesNotMatch(text, /\bhold\b/);
  assert.doesNotMatch(text, /cutoff/);
});

test("calendar screen draws no booking and does not use CalendarPanel itself (the date field does)", () => {
  const text = calendarText();
  assert.doesNotMatch(text, /CalendarPanel/);
  assert.doesNotMatch(text, /booking-row|booking-bar|booking-title/);
});

test("the month grid is Monday-first (getDayOfWeek with en-GB) and the screen takes today from the Dubai day", () => {
  const view = readFileSync("app/dashboard/(ops)/calendar/calendar-view.tsx", "utf8");
  assert.match(view, /getDayOfWeek\(/);
  assert.match(view, /"en-GB"/);
  const screen = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.match(screen, /dubaiDay\(/);
});

test("no dead control: the New booking form, its Guest and Status fields and the old Block button are gone", () => {
  const text = stripComments(calendarText());
  assert.doesNotMatch(text, /New booking|newBooking|noBookingsYet|DASHBOARD_COPY/);
  assert.doesNotMatch(text, /label="Guest"|label="Status"|label="Destination"|label="Dates"/);
  assert.doesNotMatch(text, /onClick=\{\(\) => undefined\}/);
  // Delete and Block are wired: the screen posts both.
  const screen = readFileSync(CALENDAR_SCREEN, "utf8");
  assert.match(screen, /action: "add"/);
  assert.match(screen, /action: "delete"/);
});

test("sidebar.tsx keeps its close control and docks to the end side", () => {
  const text = readFileSync("components/ui/sidebar.tsx", "utf8");
  assert.match(text, /Close/);
  assert.match(text, /\bend-0\b/);
  assert.equal(text.includes("dockEnd"), false);
});
