import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BOOKER = "components/specimens/hero-booker.tsx";
const MOUNT = "lib/framer-hero-booker-mount.tsx";
const TRIP = "app/booking/trip/trip-screen.tsx";
const PAGE = "app/booking/trip/page.tsx";

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"];
const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"];

test("booker source names the five destinations and six query keys", () => {
  const text = readFileSync(BOOKER, "utf8");
  for (const name of DESTINATIONS) {
    assert.equal(text.includes(name), true, name);
  }
  for (const key of QUERY_KEYS) {
    assert.match(text, new RegExp(`name="${key}"`));
  }
  // The preview sentence lives in BOOKER_COPY (lib/copy/home.ts), not in the component source.
  assert.match(readFileSync("lib/copy/home.ts", "utf8"), /preview: "Search is a preview on this page\."/);
  assert.match(text, /t\.preview/);
  assert.match(text, /role="search"/);
  assert.match(text, /onBook/);
  assert.equal(text.includes("window.top"), false);
});

test("framer mount assigns the top window to /booking/trip and rejects an unknown where", () => {
  const text = readFileSync(MOUNT, "utf8");
  assert.match(text, /window\.top\.location\.assign\(`\/booking\/trip\?/);
  assert.match(text, /new URLSearchParams\(\)/);
  assert.match(text, /if \(!allowedWhere\(query\.where\)/);
  assert.equal(text.includes("window.location.assign"), false);
  assert.equal(text.includes("innerHTML"), false);
  assert.equal(/price|stripe|stayId/i.test(text), false);
  for (const name of DESTINATIONS) {
    assert.equal(text.includes(name), true, name);
  }
  for (const key of QUERY_KEYS) {
    assert.equal(text.includes(`"${key}"`), true, key);
  }
});

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

test("the hero booker component itself does not call a booking handler unless one is passed", () => {
  const booker = readFileSync("components/specimens/hero-booker.tsx", "utf8");
  assert.match(booker, /onBook\?: \(query: HeroBookQuery\) => void/);
  assert.match(booker, /if \(!onBook \|\| !where \|\| !start \|\| !end\) return;/);
});

test("the hero booker Search button is never disabled", () => {
  const booker = readFileSync(BOOKER, "utf8");
  const submit = booker.match(/<Button type="submit"[^>]*>/);
  assert.ok(submit, "submit button not found");
  assert.equal(/disabled/.test(submit[0]), false);
});
