// Plan 06-04, Task 3: bookingTermsGate on booking_terms_current(), and the wiring: one read per request, the version on the
// hold, every other gate condition as it was. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");

const { bookingTermsGate, BAKED_TERMS_VERSION, BOOKING_TERMS_VERSION, BOOKING_TERMS_IS_PLACEHOLDER } = await loadTs("lib/booking/terms.ts");
const { requestGateAndTerms, currentRequestGate } = await loadTs("lib/booking/gate-server.ts");

const VERSION = "cms-0123456789abcdef";
const CLOSED = { isPlaceholder: true, version: "placeholder" };
const db = (answer) => ({ rpc: async () => answer });

test("the two constants stay the closed fallback", () => {
  assert.equal(BOOKING_TERMS_VERSION, "placeholder");
  assert.equal(BOOKING_TERMS_IS_PLACEHOLDER, true);
});

test("the committed snapshot bakes no version: closed until a build bakes one", async () => {
  assert.equal(BAKED_TERMS_VERSION, null);
  assert.deepEqual(await bookingTermsGate(db({ data: { published: true, version: VERSION }, error: null })), CLOSED);
});

test("published with the baked version: open, that version", async () => {
  assert.deepEqual(await bookingTermsGate(db({ data: { published: true, version: VERSION }, error: null }), VERSION), { isPlaceholder: false, version: VERSION });
});

test("published with another version than the baked one (edited since the last deploy): closed", async () => {
  assert.deepEqual(await bookingTermsGate(db({ data: { published: true, version: "cms-ffffffffffffffff" }, error: null }), VERSION), CLOSED);
});

test("anything else is closed", async () => {
  const answers = [
    { data: { published: false }, error: null },
    { data: { published: true, version: VERSION }, error: { message: "boom" } },
    { data: null, error: null },
    { data: "published", error: null },
    { data: { published: "true", version: VERSION }, error: null },
    { data: { published: true }, error: null },
    { data: { published: true, version: 7 }, error: null },
    { data: { published: true, version: "placeholder" }, error: null },
    { data: { published: true, version: "cms-0123" }, error: null },
    { data: { published: true, version: "cms-0123456789ABCDEF" }, error: null },
    { data: { published: true, version: `${VERSION}x` }, error: null },
  ];
  for (const answer of answers) assert.deepEqual(await bookingTermsGate(db(answer), VERSION), CLOSED, JSON.stringify(answer));
});

test("a thrown rpc is closed, not a throw", async () => {
  assert.deepEqual(await bookingTermsGate({ rpc: async () => { throw new Error("network"); } }, VERSION), CLOSED);
});

function fullDb(terms) {
  const calls = [];
  return {
    calls,
    rpc: async (name) => {
      calls.push(name);
      if (name === "booking_terms_current") return { data: terms, error: null };
      if (name === "booking_gate") return { data: { window_minutes: 120, bank_complete: true, settings_present: true }, error: null };
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

test("requestGateAndTerms: one read of the terms; published terms drop terms_not_final and nothing else", async () => {
  const live = fullDb({ published: true, version: VERSION });
  const { gate, termsVersion } = await requestGateAndTerms(live, "almarprivatejourney.com", VERSION);
  assert.equal(termsVersion, VERSION);
  assert.equal(live.calls.filter((name) => name === "booking_terms_current").length, 1);
  // The mail sender is not ready in a test process: published terms alone do not open the gate.
  assert.equal(gate.open, false);
  assert.deepEqual(gate.reasons, ["mail_not_ready"]);
});

test("requestGateAndTerms: unpublished terms stay terms_not_final and the placeholder version", async () => {
  const { gate, termsVersion } = await requestGateAndTerms(fullDb({ published: false }), "almarprivatejourney.com", VERSION);
  assert.equal(termsVersion, "placeholder");
  assert.deepEqual(gate.reasons, ["terms_not_final", "mail_not_ready"]);
});

test("currentRequestGate keeps its shape: the gate alone", async () => {
  assert.deepEqual(Object.keys(await currentRequestGate(fullDb({ published: false }), "preview.almarprivatejourney.com")).sort(), ["isTest", "open", "reasons", "windowMinutes"]);
});

test("the hold route stores the version that opened the gate; createWebHold falls back to the placeholder", () => {
  const route = readFileSync("app/api/booking/hold/route.ts", "utf8");
  assert.match(route, /requestGateAndTerms\(admin/);
  assert.match(route, /termsVersion,/);
  assert.equal(route.includes("currentRequestGate("), false, "one gate call");
  assert.match(readFileSync("lib/booking/server.ts", "utf8"), /terms_version: ctx\.termsVersion \?\? BOOKING_TERMS_VERSION/);
});

test("write-booking-terms: the version from the anon read; anything else is none, never a throw", async () => {
  const { readBakedTermsVersion } = await import("../scripts/write-booking-terms.mjs");
  const env = { ALMAR_DATA_SOURCE: "supabase", ALMAR_BUILD_SUPABASE_URL: "https://x.supabase.co", ALMAR_BUILD_SUPABASE_ANON_KEY: "anon" };
  const answer = (body, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });
  assert.equal((await readBakedTermsVersion(env, answer({ published: true, version: VERSION }))).version, VERSION);
  assert.equal((await readBakedTermsVersion(env, answer({ published: false }))).version, null);
  assert.equal((await readBakedTermsVersion(env, answer({ published: true, version: "x" }))).version, null);
  assert.equal((await readBakedTermsVersion(env, answer({}, false, 404))).version, null);
  assert.equal((await readBakedTermsVersion(env, async () => { throw new Error("network"); })).version, null);
  assert.equal((await readBakedTermsVersion({ ALMAR_DATA_SOURCE: "fixtures" }, answer({ published: true, version: VERSION }))).version, null);
});
