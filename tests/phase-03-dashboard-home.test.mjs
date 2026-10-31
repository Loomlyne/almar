import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = "app/dashboard/(ops)/home/page.tsx";
const SCREEN = "app/dashboard/(ops)/home/home-screen.tsx";
const COPY = "lib/copy/dashboard.ts";

test("home page has no page gate (02-04 owner gate in the layout) and delegates to the client screen", () => {
  const text = readFileSync(PAGE, "utf8");
  assert.equal(text.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(text), false);
  assert.match(text, /from ["']\.\/home-screen["']/);
  assert.match(text, /title:\s*"Home"/);
});

// Plan 05-04 (P5-08): the three numbers, wired to /api/ops/home. Cost, Occupancy, Charts and Reminders are not drawn.
test("home screen draws the three numbers and none of the v1.1 slots", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /OPS_HOME_COPY/);
  assert.match(text, /copy\.bookings/);
  assert.match(text, /copy\.recorded/);
  assert.match(text, /copy\.outstanding/);
  for (const word of ["Cost", "Occupancy", "Charts", "Reminders", "Revenue"]) {
    assert.equal(text.includes(word), false, `${word} must not be drawn`);
  }
  assert.equal(readFileSync(COPY, "utf8").includes("noRemindersYet"), false);
});

test("home screen date control is three kit chips that read /api/ops/home through opsFetch", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /dash\.thisMonth/);
  assert.match(text, /dash\.last30/);
  assert.match(text, /dash\.custom/);
  assert.match(text, /<Chip/);
  assert.match(text, /opsFetch<[^>]*>\("\/api\/ops\/home"/);
  assert.equal(/<input[^>]*type=["']radio["']/i.test(text), false, "no radio input");
  assert.equal(/\bfetch\(/.test(text), false, "only opsFetch reads");
  assert.equal(text.includes('aria-label="Date range"'), false, "the group label comes from copy");
});

test("home screen has no chart, no sample number and no underline", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(/<svg|<path|recharts/i.test(text), false, "no drawn chart");
  assert.equal(/underline/.test(text), false, "no underlined text");
  assert.equal(/matched\[1\]/.test(text), false, "no local cookie reader");
});

test("home screen does not touch lib/copy/dashboard or globals.css", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(text.includes("export const DASHBOARD_COPY"), false);
  assert.equal(/globals\.css/.test(text), false);
});
