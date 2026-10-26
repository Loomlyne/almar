// Plan 04-03 review: the hold answer carries `serverNow`, the server's clock as it answered, so the trip page runs the
// countdown from the server's time and never from the device's own clock. createWebHold on a fake rpc (the same canned
// shapes as tests/booking-api.test.mjs, kept here because that file has open edits). Every amount is a symbolic test
// value in fils, not a price.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");
const server = await loadTs("lib/booking/server.ts");
const client = await loadTs("lib/booking/client.ts");
const { createWebHold } = server;
const { isHoldOk } = client;

const NOW = new Date("2026-10-05T10:00:00Z");
const STAY_ID = "11111111-1111-4111-8111-111111111111";
const OWN_ID = "99999999-9999-4999-8999-999999999999";
const OWN_REF = "ALMAR-7K3QH9";

function nightsBetween(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t < Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const ctx = (args) => ({
  stay: {
    id: STAY_ID, slug: args.p_stay_slug, destination_id: "d-1", is_published: true, max_guests: 6, min_nights: 2, infants_count: false,
    base_rate_fils: 100000, title: "Stay one", destination_name: "Destination one", image_key: null, image_alt: null,
  },
  night_rates: nightsBetween(args.p_from, args.p_to).map((night) => ({ night, rate_fils: 100000, source: "base", rate_id: null })),
  blocked: [],
  taken: [],
  offers: [],
  inclusions: [],
  settings: { vat_bp: 500, deposit_bp: 3000, balance_due_days: 30 },
  today: "2026-10-05",
});

const created = { ok: true, booking_id: OWN_ID, ref: OWN_REF, hold_expires_at: "2026-10-05T10:30:00.000Z", link_version: 1 };

function fakeDb() {
  const handlers = { booking_context: ctx, claim_hold_slot: () => true, create_web_booking: () => created };
  return {
    rpc: async (name, args) => {
      const h = handlers[name];
      if (!h) throw new Error(`unexpected rpc ${name}`);
      return { data: await h(args), error: null };
    },
  };
}

const guest = () => ({
  stay: "stay-one", from: "2026-12-10", to: "2026-12-13", adults: 2, children: 0, infants: 0, addons: [], plan: "deposit", locale: "en",
  contact: { name: "Ann Guest", email: "ann@example.com", phone: "+971 50 123 4567" },
  travellers: [
    { kind: "adult", fullName: "Ann Guest", isBooker: true, notStaying: false },
    { kind: "adult", fullName: "Bob Guest", isBooker: false, notStaying: false },
  ],
  airport: "DXB",
  termsAccepted: true,
});
const CTX = { ipHash: "iphash", emailHash: (email) => `h:${email}`, isTest: true, transferWindowMinutes: 35 };

test("hold answer: serverNow is the server's clock as it answered, an instant the page accepts", async () => {
  const out = await createWebHold(fakeDb(), guest(), { ...CTX, now: NOW });
  assert.equal(out.response.ok, true);
  assert.equal(out.response.serverNow, NOW.toISOString(), "the clock the hold was made on");
  assert.equal(out.response.holdExpiresAt, "2026-10-05T10:30:00.000Z");
  assert.deepEqual(Object.keys(out.response).sort(), ["breakdown", "holdExpiresAt", "linkToken", "ok", "ref", "serverNow", "transferWindowMinutes"]);
  assert.equal(isHoldOk(JSON.parse(JSON.stringify(out.response))), true, "the client's answer check accepts it");
  const { serverNow: _drop, ...without } = JSON.parse(JSON.stringify(out.response));
  assert.equal(isHoldOk(without), false, "and refuses an answer without it");
});

test("hold answer: without a fixed clock, serverNow is the server's own time", async () => {
  const before = Date.now();
  const out = await createWebHold(fakeDb(), guest(), CTX);
  const after = Date.now();
  const at = Date.parse(out.response.serverNow);
  assert.ok(at >= before && at <= after, out.response.serverNow);
});
