// Plan 05-04 Task 3: the email handoff from Customers to Bookings (session storage, read once), the source checks that keep
// the email out of a URL, the live sections, and the three-language copy. Written, not run (owner rule).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { putBookingsSearch, takeBookingsSearch } = await loadTs("lib/ops/bookings-handoff.ts");
const { OPS_LIVE_SECTIONS } = await loadTs("lib/ops-routes.ts");
const { OPS_HOME_COPY } = await loadTs("lib/copy/ops-home.ts");

function fakeStorage() {
  const map = new Map();
  return {
    setItem: (key, value) => map.set(key, String(value)),
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    removeItem: (key) => map.delete(key),
    size: () => map.size,
  };
}

test("put then take returns the text once; the second take is null and the key is gone", () => {
  const storage = fakeStorage();
  globalThis.window = { sessionStorage: storage };
  putBookingsSearch("guest@example.com");
  assert.equal(takeBookingsSearch(), "guest@example.com");
  assert.equal(takeBookingsSearch(), null);
  assert.equal(storage.size(), 0);
});

test("a storage that throws answers null and never throws", () => {
  const boom = () => {
    throw new Error("blocked");
  };
  globalThis.window = { sessionStorage: { setItem: boom, getItem: boom, removeItem: boom } };
  assert.doesNotThrow(() => putBookingsSearch("guest@example.com"));
  assert.equal(takeBookingsSearch(), null);
});

test("Bookings takes the handed text inside a ref guard; Customers builds no query string with an email", () => {
  const bookings = readFileSync("app/dashboard/(ops)/bookings/bookings-screen.tsx", "utf8");
  assert.match(bookings, /if \(handed\.current === undefined\) handed\.current = takeBookingsSearch\(\)/);
  assert.equal((bookings.match(/takeBookingsSearch\(\)/g) ?? []).length, 1, "taken in one place only");
  const customers = readFileSync("app/dashboard/(ops)/customers/customers-screen.tsx", "utf8");
  assert.doesNotMatch(customers, /\?q=|encodeURIComponent|URLSearchParams|replaceState/);
  assert.match(customers, /router\.push\("\/dashboard\/bookings"\)/);
});

test("Home, Profile and Customers are live sections", () => {
  for (const section of ["/customers", "/", "/home", "/profile"]) assert.ok(OPS_LIVE_SECTIONS.includes(section), section);
});

test("OPS_HOME_COPY: the same keys in EN, AR and ES, each a non-empty string with no bracket", () => {
  const flat = (value, prefix = "") =>
    Object.entries(value).flatMap(([key, item]) => (typeof item === "string" ? [[`${prefix}${key}`, item]] : flat(item, `${prefix}${key}.`)));
  const en = flat(OPS_HOME_COPY.en);
  assert.ok(en.length > 0);
  for (const locale of ["ar", "es"]) {
    const other = flat(OPS_HOME_COPY[locale]);
    assert.deepEqual(other.map(([key]) => key), en.map(([key]) => key), locale);
  }
  for (const locale of ["en", "ar", "es"]) {
    for (const [key, text] of flat(OPS_HOME_COPY[locale])) {
      assert.ok(typeof text === "string" && text.trim() !== "", `${locale} ${key} is empty`);
      assert.doesNotMatch(text, /[\[\]{}]/, `${locale} ${key} has a bracket`);
    }
  }
});
