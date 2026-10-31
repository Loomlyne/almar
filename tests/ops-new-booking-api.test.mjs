// Plan 05-02 Task 1: the owner's New booking endpoints (lib/ops/new-booking-api.ts) with a fake `rpc`, a fake notifier, a fake
// view and a fake link, in the shape of tests/ops-bookings-api.test.mjs. Every amount is a symbolic test value in fils
// (1000.00 AED a night = 100000, VAT 500 bp, deposit 3000 bp, balance due 30 days before arrival); nothing here is a real
// price or rate. WRITTEN, NOT RUN (owner's no-test rule); the SQL itself is proven by supabase/tests/ops-os.test.sql.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");
const api = await loadTs("lib/ops/new-booking-api.ts");

const OWNER_ID = "0b0b0b0b-0000-4000-8000-000000000001";
const STAY_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ITEM = "aaaaaaaa-1111-4222-8333-444455556666";
const HOME_ITEM = "bbbbbbbb-1111-4222-8333-444455556666";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const BOOKING = "55555555-5555-4555-8555-555555555555";
const REF = "ALMAR-ABCDEF";
const HOLD = "2026-12-01T14:30:00+04:00";

function nightsBetween(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t < Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const OFFERS = [
  { id: PERSON_ITEM, slug: "breakfast", kind: "service", unit: "person", is_uae: false, is_home_pickup: false, price_fils: 10000, name: "Breakfast", image_key: null, image_alt: null },
  { id: HOME_ITEM, slug: "home-pickup", kind: "service", unit: "trip", is_uae: true, is_home_pickup: true, price_fils: 25000, name: "Pickup at home", image_key: null, image_alt: null },
];

function ctx(args, over = {}) {
  const nights = nightsBetween(args.p_from, args.p_to);
  const noRate = over.noRate === true;
  const stay = over.stay === null ? null : {
    id: STAY_ID, slug: args.p_stay_slug, destination_id: "d-1", is_published: true, max_guests: 6, min_nights: 2, infants_count: false,
    base_rate_fils: noRate ? null : 100000, title: "Stay one", destination_name: "Destination one", image_key: null, image_alt: null, ...over.stay,
  };
  return {
    stay,
    night_rates: nights.map((night) => ({ night, rate_fils: noRate ? null : 100000, source: noRate ? null : "base", rate_id: null })),
    blocked: over.blocked ?? [],
    taken: over.taken ?? [],
    offers: OFFERS,
    inclusions: [],
    settings: over.settings ?? { vat_bp: 500, deposit_bp: 3000, balance_due_days: 30 },
    today: "2026-10-05",
  };
}

/** A fake service client: records every rpc call; answers per name (a value or a function of the args). */
function fakeDb(answers = {}, over = {}) {
  const calls = [];
  return {
    calls,
    names: () => calls.map((c) => c.name),
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "booking_context") return { data: ctx(args, typeof over === "function" ? over(args) : over), error: null };
      const answer = answers[name];
      const value = typeof answer === "function" ? answer(args) : answer;
      if (value !== undefined) return value;
      if (name === "ops_create_booking") return { data: { booking_id: BOOKING, ref: REF, hold_expires_at: "2026-12-01T10:30:00.000Z", link_version: 1 }, error: null };
      if (name === "ops_get_booking") return { data: { id: BOOKING, events: [] }, error: null };
      return { data: null, error: null };
    },
  };
}

const refusal = (code, details = null) => ({ data: null, error: { code: "P0001", message: `almar:${code}`, details, hint: null } });

function fakeNotifier({ ready = true, outcome = { ok: true } } = {}) {
  const sent = [];
  const ownerRequest = [];
  return {
    sent,
    ownerRequest,
    notifier: {
      ready,
      requestReceived: async (job, opts) => (sent.push({ job, key: opts.idempotencyKey }), outcome),
      ownerRequest: async (job) => (ownerRequest.push(job), outcome),
      paymentReceipt: async () => outcome,
      ownerPayment: async () => outcome,
      requestLapsed: async () => outcome,
      ownerWithdrawn: async () => outcome,
      refundReceipt: async () => outcome,
    },
  };
}

function deps({ view = { locale: "en", status: "awaiting_payment" }, url = "https://dashboard.example/booking-link", real = true, test = true, notifier = fakeNotifier() } = {}) {
  return {
    notifier: () => notifier.notifier,
    view: async () => view,
    bookingUrl: async () => url,
    linkReady: () => true,
    gates: async () => ({ real: { open: real }, test: { open: test } }),
  };
}

const owner = (db) => ({ profile: { id: OWNER_ID, email: "[owner email]" }, admin: db });

const body = (over = {}) => ({
  stay: "stay-one", from: "2026-12-10", to: "2026-12-13", adults: 2, children: 0, infants: 0, addons: [], plan: "deposit", locale: "ar",
  agreed_amount: null, request_id: REQUEST, guest: { name: "[guest name]", email: "guest@example.com", phone: "+971 50 000 0000" },
  airport: null, pickup_address: null, hold_until: HOLD, is_test: false, agreed_reason: null, ...over,
});

// ---------------------------------------------------------------- parsers

test("parsers: an unknown key, a bad range, adults 0 and a hold without an offset are refused", () => {
  const invalid = (fn, input, field) => assert.throws(() => fn(input), (e) => e.field === field);
  invalid(api.parseCreate, { ...body(), travellers: [] }, "travellers");
  invalid(api.parseCreate, { ...body(), terms_version: "x" }, "terms_version");
  invalid(api.parseCreate, body({ from: "2026-12-13", to: "2026-12-10" }), "to");
  invalid(api.parseCreate, body({ adults: 0 }), "adults");
  invalid(api.parseCreate, body({ hold_until: "2026-12-01T14:30:00" }), "hold_until");
  invalid(api.parseCreate, body({ agreed_amount: "abc", agreed_reason: "Agreed by phone" }), "agreed_amount");
  invalid(api.parseQuote, { ...body(), guest: undefined, request_id: REQUEST }, "request_id");
});

test("parsers: the email is lowercased and trimmed; the reason and the amount go together", () => {
  const parsed = api.parseCreate(body({ guest: { name: " [guest name] ", email: "  Guest@Example.COM ", phone: "+971 50 000 0000" } }));
  assert.equal(parsed.guest.email, "guest@example.com");
  assert.equal(parsed.guest.name, "[guest name]");
  assert.throws(() => api.parseCreate(body({ agreed_amount: "1000" })), (e) => e.field === "agreed_reason");
  assert.throws(() => api.parseCreate(body({ agreed_reason: "Agreed by phone" })), (e) => e.field === "agreed_reason");
  const agreed = api.parseCreate(body({ agreed_amount: "1,000.00", agreed_reason: "Agreed by phone" }));
  assert.equal(agreed.agreed_reason, "Agreed by phone");
});

// ---------------------------------------------------------------- availability

test("availability: has_rate is false with no base rate, and an unpublished stay is null", async () => {
  const withRate = await api.postAvailability({ owner: owner(fakeDb()), body: { stay: "stay-one", from: "2026-12-10", to: "2026-12-13" } });
  assert.equal(withRate.body.has_rate, true);
  const noRate = await api.postAvailability({ owner: owner(fakeDb({}, { noRate: true })), body: { stay: "stay-one", from: "2026-12-10", to: "2026-12-13" } });
  assert.equal(noRate.body.has_rate, false);
  const hidden = await api.postAvailability({ owner: owner(fakeDb({}, { stay: null })), body: { stay: "stay-one", from: "2026-12-10", to: "2026-12-13" } });
  assert.equal(hidden.body.stay, null);
});

// ---------------------------------------------------------------- quote

test("quote: no rate and no agreed amount asks for one; an agreed amount prices with no rate id and no no_rate", async () => {
  const q = { ...body(), request_id: undefined, guest: undefined, airport: undefined, pickup_address: undefined, hold_until: undefined, is_test: undefined, agreed_reason: undefined };
  const asks = await api.postQuote({ owner: owner(fakeDb({}, { noRate: true })), body: q }, deps({ real: false, test: true }));
  assert.equal(asks.body.needs_agreed, true);
  assert.equal(asks.body.breakdown, null);
  assert.ok(asks.body.reasons.some((r) => r.code === "no_rate"));
  assert.equal(asks.body.real_open, false);
  assert.equal(asks.body.test_open, true);
  const priced = await api.postQuote({ owner: owner(fakeDb({}, { noRate: true })), body: { ...q, agreed_amount: "3000" } }, deps());
  assert.equal(priced.body.needs_agreed, false);
  assert.equal(priced.body.reasons.some((r) => r.code === "no_rate"), false);
  assert.equal(priced.body.breakdown.nightsFils, 300000);
  assert.ok(priced.body.breakdown.nights.every((n) => n.source === "agreed" && !("rateId" in n)));
});

// ---------------------------------------------------------------- create

test("create: the money is the server's whatever the body says; ops keys only, no traveller or terms key", async () => {
  const db = fakeDb();
  const out = await api.postCreate({ owner: owner(db), body: { ...body(), grand_fils: 1, due_now_fils: 1 } }, deps());
  assert.equal(out.body.ok, true);
  const call = db.calls.find((c) => c.name === "ops_create_booking");
  assert.equal(call.args.p_actor, OWNER_ID);
  const p = call.args.p;
  assert.equal(p.nights_fils, 300000);
  assert.equal(p.grand_fils, 315000);
  assert.equal(p.due_now_fils, 94500);
  assert.equal(p.ops_request_id, REQUEST);
  assert.equal(p.hold_until, HOLD);
  assert.equal(p.is_test, false);
  assert.equal(p.locale, "ar");
  for (const key of ["travellers", "terms_version", "agreed_reason", "airport", "pickup_address"]) assert.equal(key in p, false, key);
});

test("create: an agreed amount stores nights as agreed and sends the reason; the stay's rates are not written", async () => {
  const db = fakeDb({}, { noRate: true });
  await api.postCreate({ owner: owner(db), body: body({ agreed_amount: "3000", agreed_reason: "Agreed by phone" }) }, deps());
  const p = db.calls.find((c) => c.name === "ops_create_booking").args.p;
  assert.equal(p.agreed_reason, "Agreed by phone");
  assert.ok(p.nights_snapshot.every((n) => n.source === "agreed" && n.rate_id === null));
  assert.equal(p.nights_fils, 300000);
});

test("create: the handler refuses an amount without a reason or a reason without an amount before any rpc", async () => {
  for (const over of [{ agreed_amount: "3000", agreed_reason: null }, { agreed_amount: null, agreed_reason: "Agreed by phone" }]) {
    const db = fakeDb();
    const out = await api.postCreate({ owner: owner(db), body: body(over) }, deps());
    assert.equal(out.status, 400);
    assert.equal(out.body.error.code, "invalid");
    assert.equal(db.names().includes("ops_create_booking"), false);
  }
});

test("create: a real booking with the real gate closed is refused with no create; TEST needs only the test gate", async () => {
  const closed = fakeDb();
  const refused = await api.postCreate({ owner: owner(closed), body: body() }, deps({ real: false, test: true }));
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error.code, "requests_closed");
  assert.equal(closed.names().includes("ops_create_booking"), false);
  const test = fakeDb();
  const made = await api.postCreate({ owner: owner(test), body: body({ is_test: true }) }, deps({ real: false, test: true }));
  assert.equal(made.body.ok, true);
  assert.equal(test.calls.find((c) => c.name === "ops_create_booking").args.p.is_test, true);
});

test("create: sold_out or blocked in the quote still reaches the SQL, which answers 409 with its code; any other reason does not", async () => {
  const sold = fakeDb({ ops_create_booking: refusal("sold_out") }, { taken: ["2026-12-11"] });
  const out = await api.postCreate({ owner: owner(sold), body: body() }, deps());
  assert.equal(sold.names().includes("ops_create_booking"), true);
  assert.equal(out.status, 409);
  assert.equal(out.body.error.code, "sold_out");
  const short = fakeDb({}, {});
  const other = await api.postCreate({ owner: owner(short), body: body({ from: "2026-12-10", to: "2026-12-11" }) }, deps());
  assert.equal(other.status, 409);
  assert.equal(other.body.error.code, "below_min_nights");
  assert.equal(short.names().includes("ops_create_booking"), false);
});

test("create: a home-pickup line needs an address, then it is sent", async () => {
  const db = fakeDb();
  const needs = await api.postCreate({ owner: owner(db), body: body({ addons: [{ id: HOME_ITEM, qty: 1 }] }) }, deps());
  assert.equal(needs.status, 400);
  assert.equal(needs.body.error.field, "pickup_address");
  const ok = await api.postCreate({ owner: owner(db), body: body({ addons: [{ id: HOME_ITEM, qty: 1 }], pickup_address: "[address]" }) }, deps());
  assert.equal(ok.body.ok, true);
  assert.equal(db.calls.find((c) => c.name === "ops_create_booking").args.p.pickup_address, "[address]");
});

test("create: the SQL's refusals are 409 with their code; invalid carries its field; anything else is a dbError", async () => {
  for (const code of ["hold_too_soon", "settings_changed", "below_minimum_charge", "stay_unavailable"]) {
    const out = await api.postCreate({ owner: owner(fakeDb({ ops_create_booking: refusal(code) })), body: body() }, deps());
    assert.equal(out.status, 409, code);
    assert.equal(out.body.error.code, code);
  }
  const invalid = await api.postCreate({ owner: owner(fakeDb({ ops_create_booking: refusal("invalid", JSON.stringify({ field: "hold_until" })) })), body: body() }, deps());
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.field, "hold_until");
  const odd = await api.postCreate({ owner: owner(fakeDb({ ops_create_booking: { data: null, error: { code: "XX000", message: "[db text]" } } })), body: body() }, deps());
  assert.ok("dbError" in odd);
});

test("create: the mail is request_received, key request/<id>, handMade, to the guest only", async () => {
  const sent = fakeNotifier();
  const db = fakeDb();
  const out = await api.postCreate({ owner: owner(db), body: body() }, deps({ notifier: sent }));
  assert.equal(out.body.mail, "sent");
  assert.equal(sent.sent.length, 1);
  assert.equal(sent.sent[0].key, `request/${BOOKING}`);
  assert.equal(sent.sent[0].job.handMade, true);
  assert.equal(sent.sent[0].job.bookingUrl, "https://dashboard.example/booking-link");
  assert.equal(sent.ownerRequest.length, 0);
});

test("create: a replay (the booking already holds that mail key) sends nothing and says skipped", async () => {
  const sent = fakeNotifier();
  const events = [{ action: "email_sent", detail: { template: "request_received", key: `request/${BOOKING}` }, at: "2026-12-01T10:00:00Z" }];
  const db = fakeDb({ ops_get_booking: { data: { id: BOOKING, events }, error: null } });
  const out = await api.postCreate({ owner: owner(db), body: body() }, deps({ notifier: sent }));
  assert.equal(out.body.ok, true);
  assert.equal(out.body.mail, "skipped");
  assert.equal(sent.sent.length, 0);
});

test("create: a missing view or link is still ok:true with mail failed and an email_failed event", async () => {
  const noView = fakeDb();
  const a = await api.postCreate({ owner: owner(noView), body: body() }, deps({ view: null }));
  assert.equal(a.body.ok, true);
  assert.equal(a.body.mail, "failed");
  const logged = noView.calls.find((c) => c.name === "log_booking_event");
  assert.equal(logged.args.p_action, "email_failed");
  assert.equal(logged.args.p_detail.error, "no_view");
  const noLink = fakeDb();
  const b = await api.postCreate({ owner: owner(noLink), body: body() }, deps({ url: null }));
  assert.equal(b.body.mail, "failed");
  assert.equal(noLink.calls.find((c) => c.name === "log_booking_event").args.p_detail.error, "no_link");
});

test("create: the source has no owner notice, traveller, terms or Host rule, and no browser copy", () => {
  const src = readFileSync("lib/ops/new-booking-api.ts", "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(src, /ownerRequest|travellers|terms_version|isTestHost|copy\/ops-new-booking|from "next/);
  assert.match(src, /handMade: true/);
  assert.match(src, /locale: "en"/);
});
