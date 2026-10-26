// Plan 04-08, Task 3: the rebuilt request gate (no card key), TEST from the Host header, the booking-page link shape,
// and the gate's database half on a fake rpc. Replaces 04-02's liveGate test (research Q5): replaced, not renamed.
// Every value here is a symbolic test value; nothing is a real setting, account or secret.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");

const origin = await loadTs("lib/booking/origin.ts");
const server = await loadTs("lib/booking/server.ts");
const gateServer = await loadTs("lib/booking/gate-server.ts");

const { isTestHost, originForBooking, bookingPagePath } = origin;
const { requestGate, readBookingGate, withRequestGate, holdStatus, TEST_TRANSFER_WINDOW_MINUTES } = server;
const { currentRequestGate } = gateServer;

const REF = "ALMAR-7K3QH9";
const TOKEN = "A".repeat(43);

function fakeDb(handlers = {}) {
  const calls = [];
  return {
    calls,
    names: () => calls.map((c) => c.name),
    rpc: async (name, args) => {
      calls.push({ name, args });
      const h = handlers[name];
      if (!h) throw new Error(`unexpected rpc ${name}`);
      const out = await h(args);
      if (out && out.__error) return { data: null, error: out.__error };
      return { data: out, error: null };
    },
  };
}

// ---------------------------------------------------------------- isTestHost

test("isTestHost: false only for the production host and www (trimmed, any case, no port)", () => {
  assert.equal(isTestHost("almarprivatejourney.com"), false);
  assert.equal(isTestHost("www.almarprivatejourney.com"), false);
  assert.equal(isTestHost(" AlmarPrivateJourney.com "), false);
  assert.equal(isTestHost("WWW.almarprivatejourney.com"), false);
});

test("isTestHost: true for preview, local hosts, the ops host, an empty or missing host and any other name", () => {
  for (const host of [
    "preview.almarprivatejourney.com",
    "127.0.0.1:3010",
    "localhost",
    "localhost:3000",
    "dashboard.almarprivatejourney.com",
    "almarprivatejourney.com:443",
    "www.almarprivatejourney.com:443",
    "almarprivatejourney.com.evil.example",
    "evil.example",
    "",
    "   ",
    null,
    undefined,
  ]) {
    assert.equal(isTestHost(host), true, String(host));
  }
});

// ---------------------------------------------------------------- originForBooking, bookingPagePath

test("originForBooking: the production origin for a real booking, the preview origin for a TEST one", () => {
  assert.equal(originForBooking(false), "https://almarprivatejourney.com");
  assert.equal(originForBooking(true), "https://preview.almarprivatejourney.com");
});

test("bookingPagePath: /<locale>/bookings/trip with ref and t; every locale is prefixed (#33)", () => {
  assert.equal(bookingPagePath("en", REF, TOKEN), `/en/bookings/trip?ref=${REF}&t=${TOKEN}`);
  assert.equal(bookingPagePath("ar", REF, TOKEN), `/ar/bookings/trip?ref=${REF}&t=${TOKEN}`);
  assert.equal(bookingPagePath("es", REF, TOKEN), `/es/bookings/trip?ref=${REF}&t=${TOKEN}`);
});

test("bookingPagePath: without t only the ref is in the link; both values are URL-encoded", () => {
  assert.equal(bookingPagePath("en", REF), `/en/bookings/trip?ref=${REF}`);
  assert.equal(bookingPagePath("ar", REF), `/ar/bookings/trip?ref=${REF}`);
  assert.equal(bookingPagePath("en", "a b&c", "x/y=z"), "/en/bookings/trip?ref=a%20b%26c&t=x%2Fy%3Dz");
});

test("origin.ts stays pure: no imports, and PUBLIC_ORIGIN is not used for guest links", () => {
  const source = readFileSync("lib/booking/origin.ts", "utf8");
  assert.doesNotMatch(source, /^import /m);
  const guestPart = source.slice(source.indexOf("export function isTestHost"));
  assert.doesNotMatch(guestPart, /process\.env/);
});

// ---------------------------------------------------------------- requestGate

const ALL_SET = {
  termsArePlaceholder: false,
  linkConfigured: true,
  mailReady: true,
  settingsPresent: true,
  windowMinutes: 120,
  bankComplete: true,
};

test("requestGate: production opens only when every input is set, with the database window", () => {
  assert.deepEqual(requestGate({ isTest: false, ...ALL_SET }), { isTest: false, open: true, windowMinutes: 120, reasons: [] });
  assert.deepEqual(requestGate({ isTest: false, ...ALL_SET, windowMinutes: 35 }), { isTest: false, open: true, windowMinutes: 35, reasons: [] });
});

test("requestGate: production, each missing input closes it with its own reason", () => {
  const cases = [
    [{ termsArePlaceholder: true }, "terms_not_final"],
    [{ linkConfigured: false }, "link_secret_missing"],
    [{ mailReady: false }, "mail_not_ready"],
    [{ settingsPresent: false }, "settings_missing"],
    [{ windowMinutes: null }, "window_not_set"],
    [{ windowMinutes: 34 }, "window_not_set"],
    [{ bankComplete: false }, "bank_incomplete"],
  ];
  for (const [over, reason] of cases) {
    const gate = requestGate({ isTest: false, ...ALL_SET, ...over });
    assert.equal(gate.open, false, reason);
    assert.equal(gate.isTest, false, reason);
    assert.deepEqual(gate.reasons, [reason], reason);
  }
});

test("requestGate: production with nothing set lists every reason, in the fixed order", () => {
  const gate = requestGate({
    isTest: false,
    termsArePlaceholder: true,
    linkConfigured: false,
    mailReady: false,
    settingsPresent: false,
    windowMinutes: null,
    bankComplete: false,
  });
  assert.equal(gate.open, false);
  assert.deepEqual(gate.reasons, ["terms_not_final", "link_secret_missing", "mail_not_ready", "settings_missing", "window_not_set", "bank_incomplete"]);
  assert.equal(gate.windowMinutes, null);
});

test("requestGate: TEST opens with the link secret, the settings and the bank details; terms, mail and window may be missing", () => {
  const gate = requestGate({ isTest: true, termsArePlaceholder: true, linkConfigured: true, mailReady: false, settingsPresent: true, windowMinutes: null, bankComplete: true });
  assert.deepEqual(gate, { isTest: true, open: true, windowMinutes: TEST_TRANSFER_WINDOW_MINUTES, reasons: [] });
  assert.equal(TEST_TRANSFER_WINDOW_MINUTES, 35);
});

test("requestGate: TEST always uses the 35-minute window, whatever the owner's window (P-06)", () => {
  assert.equal(requestGate({ isTest: true, ...ALL_SET, windowMinutes: 120 }).windowMinutes, 35);
  assert.equal(requestGate({ isTest: true, ...ALL_SET, windowMinutes: 43200 }).windowMinutes, 35);
});

test("requestGate: TEST still needs the link secret, the settings and complete bank details", () => {
  for (const [over, reason] of [
    [{ linkConfigured: false }, "link_secret_missing"],
    [{ settingsPresent: false }, "settings_missing"],
    [{ bankComplete: false }, "bank_incomplete"],
  ]) {
    const gate = requestGate({ isTest: true, ...ALL_SET, termsArePlaceholder: true, mailReady: false, windowMinutes: null, ...over });
    assert.equal(gate.open, false, reason);
    assert.equal(gate.isTest, true, reason);
    assert.deepEqual(gate.reasons, [reason], reason);
  }
});

// ---------------------------------------------------------------- withRequestGate

const QUOTE = {
  ok: true,
  reasons: [],
  stay: { slug: "stay-one", title: "Stay one", destinationName: "Destination one", image: null, maxGuests: 4, minNights: 2, infantsCount: false },
  offers: [],
  inclusions: [],
  breakdown: { grandFils: 100000, nights: [] },
};

test("withRequestGate: an open gate returns the quote unchanged", () => {
  const open = requestGate({ isTest: true, ...ALL_SET });
  assert.equal(withRequestGate(QUOTE, open), QUOTE);
});

test("withRequestGate: a closed gate keeps the breakdown, sets ok false and appends exactly one requests_closed", () => {
  const closed = requestGate({ isTest: false, ...ALL_SET, bankComplete: false, mailReady: false });
  const out = withRequestGate(QUOTE, closed);
  assert.equal(out.ok, false);
  assert.deepEqual(out.reasons, [{ code: "requests_closed" }], "one code, no detail: the guest never sees the gate's causes");
  assert.deepEqual(out.breakdown, QUOTE.breakdown);
  assert.deepEqual(out.stay, QUOTE.stay);
  const refused = { ...QUOTE, ok: false, reasons: [{ code: "sold_out", nights: ["2026-12-10"] }] };
  assert.deepEqual(withRequestGate(refused, closed).reasons, [{ code: "sold_out", nights: ["2026-12-10"] }, { code: "requests_closed" }]);
  assert.deepEqual(QUOTE.reasons, [], "the quote passed in is not changed");
});

// ---------------------------------------------------------------- readBookingGate

test("readBookingGate: one booking_gate call, read into the gate's database inputs", async () => {
  const db = fakeDb({ booking_gate: () => ({ window_minutes: 120, bank_complete: true, settings_present: true }) });
  assert.deepEqual(await readBookingGate(db), { windowMinutes: 120, bankComplete: true, settingsPresent: true });
  assert.deepEqual(db.names(), ["booking_gate"]);
  const unset = fakeDb({ booking_gate: () => ({ window_minutes: null, bank_complete: false, settings_present: false }) });
  assert.deepEqual(await readBookingGate(unset), { windowMinutes: null, bankComplete: false, settingsPresent: false });
});

test("readBookingGate: any other shape is thrown, and so is a database error", async () => {
  for (const bad of [
    null,
    "x",
    [],
    {},
    { window_minutes: "120", bank_complete: true, settings_present: true },
    { window_minutes: 1.5, bank_complete: true, settings_present: true },
    { window_minutes: 120, bank_complete: "yes", settings_present: true },
    { window_minutes: 120, bank_complete: true },
    { bank_complete: true, settings_present: true },
  ]) {
    const db = fakeDb({ booking_gate: () => bad });
    await assert.rejects(() => readBookingGate(db), /rpc booking_gate: unreadable answer/, JSON.stringify(bad));
  }
  const down = fakeDb({ booking_gate: () => ({ __error: { message: "down" } }) });
  await assert.rejects(() => readBookingGate(down), /booking_gate/);
});

// ---------------------------------------------------------------- currentRequestGate (the runtime inputs)

test("currentRequestGate: the preview host is TEST and opens on the database half (placeholder terms, mail not ready)", async () => {
  const db = fakeDb({ booking_gate: () => ({ window_minutes: null, bank_complete: true, settings_present: true }) });
  assert.deepEqual(await currentRequestGate(db, "preview.almarprivatejourney.com"), { isTest: true, open: true, windowMinutes: 35, reasons: [] });
});

test("currentRequestGate: the production host stays closed while the terms are the placeholder and the mail is not ready", async () => {
  const db = fakeDb({ booking_gate: () => ({ window_minutes: 120, bank_complete: true, settings_present: true }) });
  const gate = await currentRequestGate(db, "almarprivatejourney.com");
  assert.equal(gate.isTest, false);
  assert.equal(gate.open, false);
  assert.deepEqual(gate.reasons, ["terms_not_final", "mail_not_ready"]);
});

test("currentRequestGate: without the link secret even the preview host is closed", async () => {
  const saved = process.env.BOOKING_LINK_SECRET;
  delete process.env.BOOKING_LINK_SECRET;
  try {
    const db = fakeDb({ booking_gate: () => ({ window_minutes: 120, bank_complete: true, settings_present: true }) });
    const gate = await currentRequestGate(db, "preview.almarprivatejourney.com");
    assert.equal(gate.open, false);
    assert.deepEqual(gate.reasons, ["link_secret_missing"]);
  } finally {
    process.env.BOOKING_LINK_SECRET = saved;
  }
});

test("gate-server.ts reads no environment itself and names no card provider", () => {
  const source = readFileSync("lib/booking/gate-server.ts", "utf8");
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /stripe/i);
});

// ---------------------------------------------------------------- holdStatus

test("holdStatus: requests_closed is 503 and too_many_open is 429; the other codes are unchanged", () => {
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "requests_closed" }] }), 503);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "too_many_open" }] }), 429);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "hold_limit" }] }), 429);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "unavailable" }] }), 503);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "invalid", field: "x" }] }), 400);
  assert.equal(holdStatus({ ok: false, reasons: [{ code: "sold_out" }] }), 409);
  assert.equal(holdStatus({ ok: true, ref: REF, holdExpiresAt: "x", linkToken: "y", breakdown: {} }), 200);
});
