import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The hero booker specimen and its Framer mount were removed at Phase 3.3 close; /booking/trip stays until plan 04-03
// replaces it.
const TRIP = "app/booking/trip/trip-screen.tsx";
const PAGE = "app/booking/trip/page.tsx";

const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"];

test("trip screen is an empty stay list with the query as text", () => {
  const screen = readFileSync(TRIP, "utf8");
  const page = readFileSync(PAGE, "utf8");
  assert.match(screen, /No stays for these dates/);
  assert.match(screen, /Choose a destination to search\./);
  assert.match(screen, /href="\/"/);
  assert.equal(screen.includes("Casa San Diego"), false);
  assert.equal(screen.includes("Sample stay"), false);
  assert.equal(screen.includes("innerHTML"), false);
  assert.equal(screen.includes("dangerouslySetInnerHTML"), false);
  assert.equal(/stripe|\$[0-9]/i.test(screen), false);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /title:\s*"Trip"/);
  assert.equal(page.includes("use client"), false);
  for (const key of QUERY_KEYS) {
    assert.equal(screen.includes(`params.get("${key}")`), true, key);
  }
});
