import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The hero booker specimen and its Framer mount were removed at Phase 3.3 close. Plan 04-03 replaced the /booking/trip
// placeholder with the guest's trip: the pages are app/en|ar|es/booking/trip/page.tsx (every locale prefixed, job 21);
// app/booking/trip/ keeps the shared screen and metadata and has no page of its own.
const TRIP = "app/booking/trip/trip-screen.tsx";
const META = "app/booking/trip/trip-meta.ts";
const PAGES = { en: "app/en/booking/trip/page.tsx", ar: "app/ar/booking/trip/page.tsx", es: "app/es/booking/trip/page.tsx" };

const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"];

test("trip page (plan 04-03): static, noindex, a bad link is a line", () => {
  assert.equal(existsSync("app/booking/trip/page.tsx"), false, "no unprefixed page: English has its prefix too");
  for (const [locale, file] of Object.entries(PAGES)) {
    const page = readFileSync(file, "utf8");
    assert.equal(page.includes("notFound"), false, file);
    assert.match(page, /export const dynamic = "force-static";/, file);
    assert.match(page, new RegExp(`tripMetadata\\("${locale}"\\)`), file);
    assert.match(page, new RegExp(`locale="${locale}"`), file);
    assert.equal(page.includes("use client"), false, file);
  }
  const meta = readFileSync(META, "utf8");
  assert.match(meta, /robots: \{ index: false, follow: false \}/);
  assert.match(meta, /referrer: "same-origin"/);

  const screen = readFileSync(TRIP, "utf8");
  assert.match(screen, /parseTripQuery\(/);
  assert.match(screen, /trip\.badLink/);
  assert.match(screen, /localePath\(locale, "\/private-stays"\)/);
  for (const key of QUERY_KEYS) {
    assert.equal(screen.includes(`params.get("${key}")`), false, key);
  }
  assert.match(readFileSync("lib/copy/journey.ts", "utf8"), /badLink: "This booking link is not complete\."/);
  assert.equal(screen.includes("Casa San Diego"), false);
  assert.equal(screen.includes("Sample stay"), false);
  assert.equal(screen.includes("innerHTML"), false);
  assert.equal(screen.includes("dangerouslySetInnerHTML"), false);
  assert.equal(/stripe|\$[0-9]/i.test(screen), false);
});
