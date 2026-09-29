import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = "app/dashboard/(ops)/home/page.tsx";
const SCREEN = "app/dashboard/(ops)/home/home-screen.tsx";
const COPY = "lib/copy/dashboard.ts";

const SLOT_NAMES = ["Bookings", "Revenue", "Cost", "Outstanding", "Occupancy", "Reminders", "Charts"];

test("home page gates production and delegates to the client screen", () => {
  const text = readFileSync(PAGE, "utf8");
  assert.equal(text.includes("use client"), false);
  assert.match(text, /NODE_ENV/);
  assert.match(text, /notFound\(\)/);
  assert.match(text, /from ["']\.\/home-screen["']/);
  assert.match(text, /title:\s*"Home"/);
});

test("home screen draws the seven named slots in the UI-SPEC order", () => {
  const text = readFileSync(SCREEN, "utf8");
  const positions = SLOT_NAMES.map((name) => {
    const index = text.indexOf(`"${name}"`);
    assert.notEqual(index, -1, `missing slot name: ${name}`);
    return index;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1], `slot order broken at ${SLOT_NAMES[i]}`);
  }
});

test("home screen sources the reminders empty state from lib/copy/dashboard", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /copy\.noRemindersYet/);
  assert.equal(text.includes("New"), false, "reminders has no New action");
  const copyText = readFileSync(COPY, "utf8");
  assert.match(copyText, /noRemindersYet:\s*"No reminders yet"/);
});

test("home screen date control is three buttons that do not fetch or filter", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /copy\.thisMonth/);
  assert.match(text, /copy\.last30/);
  assert.match(text, /copy\.custom/);
  assert.match(text, /aria-pressed/);
  assert.equal(/<input[^>]*type=["']radio["']/i.test(text), false, "no radio input");
  assert.equal(/\bfetch\(/.test(text), false, "date control does not fetch");
});

test("home screen has no sample number and no chart series", () => {
  const text = readFileSync(SCREEN, "utf8");
  // Strip syntax that legitimately contains a digit (heading tags, the
  // "last30" copy key, and the array index used to read a cookie match) so
  // the remaining source is checked for an actual metric value.
  const sanitized = text
    .replace(/<\/?h[1-6]\b/g, "<h")
    .replace(/last30/g, "lastRange")
    .replace(/matched\[1\]/g, "matched[n]");
  assert.equal(/[0-9]/.test(sanitized), false, "no numeric literal used as a metric");
  assert.equal(/<svg|<path/i.test(text), false, "no drawn chart series");
});

test("home screen does not touch lib/copy/dashboard or globals.css", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(text.includes("export const DASHBOARD_COPY"), false);
  assert.equal(/globals\.css/.test(text), false);
});
