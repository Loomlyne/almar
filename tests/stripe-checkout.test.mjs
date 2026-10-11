// Plan 04-04, Task 3: the Checkout Session for a hold, the pay endpoint, the status check, the release, the Payment Element
// appearance and the payment copy. The database and Stripe are fakes (no keys, no network). Every amount is a symbolic
// test value in fils (1 AED = 100 fils), not a real price. The panel itself needs a browser and a Stripe key: its states are
// covered at the owner's UAT on preview (plan 04-07), the way the plan says.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadRoute } from "./helpers/load-route.mjs";

// These modules reach the `stripe` package (for the key helpers), so they load beside node_modules.
const checkout = await loadRoute("lib/stripe/checkout.ts");
const pay = await loadRoute("lib/stripe/pay.ts");
const serverModule = await loadRoute("lib/stripe/server.ts");
const link = await loadTs("lib/booking/link.ts");
const appearanceModule = await loadTs("lib/stripe/appearance.ts");
const tokens = JSON.parse(readFileSync("tokens.json", "utf8"));

const { checkoutParams, sessionExpiry, openCheckout, expireCheckoutSessions } = checkout;
const { holdWithCheckout, parsePayRequest, startPayment, checkSession, releaseAndExpire } = pay;
const { paymentsOpen, stripeMode, stripePublishableKey } = serverModule;

const SAVED = Object.fromEntries(["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "BOOKING_LINK_SECRET"].map((k) => [k, process.env[k]]));
process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_unit_test_key_value";
process.env.BOOKING_LINK_SECRET = "unit-test-link-secret-".padEnd(48, "k");
after(() => {
  for (const [name, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "11111111-1111-4111-8111-111111111111";
const REF = "ALMAR-7K3QH9";
const NOW = new Date("2026-10-11T12:00:30Z");
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60_000;
const ORIGIN = "https://preview.almarprivatejourney.com";
const TOKEN = await link.signBookingLink(BOOKING_ID, 1);

const BOOKING = { id: BOOKING_ID, ref: REF, email: "ann@example.com", locale: "en", stay_title_en: "Courtyard House" };
const open = (over = {}) => ({
  ok: true, payment_id: PAYMENT_ID, amount_fils: 31500, kind: "deposit", hold_expires_at: "2026-10-11T12:30:00.000Z",
  previous_session_id: null, booking: BOOKING, ...over,
});

function fakeDb(script = {}) {
  const calls = [];
  return {
    calls,
    rpc(name, args) {
      calls.push({ name, args });
      const entry = script[name];
      const answer = typeof entry === "function" ? entry(args, calls) : entry;
      return Promise.resolve(answer ?? { data: null, error: null });
    },
  };
}
const names = (db) => db.calls.map((c) => c.name);
const callsOf = (db, name) => db.calls.filter((c) => c.name === name);

const NEW_SESSION = { id: "cs_test_newSession1234", client_secret: "cs_test_newSession1234_secret_x", status: "open" };
/** A fake Stripe with an ordered log of its checkout calls. */
function fakeStripe({ create, expire, retrieve } = {}) {
  const log = [];
  return {
    log,
    checkout: {
      sessions: {
        async create(params, options) {
          log.push({ op: "create", params, options });
          return create ? create(params, options) : NEW_SESSION;
        },
        async expire(id, params, options) {
          log.push({ op: "expire", id, params, options });
          if (expire) return expire(id);
          return { id, status: "expired" };
        },
        async retrieve(id) {
          log.push({ op: "retrieve", id });
          if (retrieve) return retrieve(id);
          return { id, status: "open", client_secret: `${id}_secret_x`, amount_total: 31500, metadata: { kind: "deposit" } };
        },
      },
    },
    paymentIntents: {
      async retrieve() {
        return { id: "pi_1", amount: 31500, currency: "aed", metadata: { amount_fils: "31500" }, latest_charge: { id: "ch_1", payment_method_details: { card: { brand: "visa", last4: "4242", wallet: null } } } };
      },
    },
    refunds: { async list() { return { data: [], has_more: false }; } },
  };
}
const closedError = Object.assign(new Error("not open"), { type: "StripeInvalidRequestError", statusCode: 400 });
const networkError = Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" });

// ---------------------------------------------------------------- checkoutParams

test("checkoutParams: the elements-mode session, AED, card only, Adaptive Pricing on, nothing personal in the metadata", () => {
  const params = checkoutParams({
    booking: BOOKING, payment: { id: PAYMENT_ID, kind: "deposit", amountFils: 31500 }, expiresAt: new Date("2026-10-11T12:31:00Z"),
    returnUrl: `${ORIGIN}/bookings/trip?ref=${REF}&t=${TOKEN}&session_id={CHECKOUT_SESSION_ID}`, stayTitleEn: "Courtyard House",
  });
  assert.deepEqual(params, {
    mode: "payment",
    ui_mode: "elements",
    currency: "aed",
    payment_method_types: ["card"],
    adaptive_pricing: { enabled: true },
    customer_email: "ann@example.com",
    client_reference_id: BOOKING_ID,
    metadata: { booking_id: BOOKING_ID, ref: REF, kind: "deposit", payment_id: PAYMENT_ID },
    payment_intent_data: {
      description: `${REF} deposit`,
      metadata: { booking_id: BOOKING_ID, payment_id: PAYMENT_ID, amount_fils: "31500" },
    },
    line_items: [{ quantity: 1, price_data: { currency: "aed", unit_amount: 31500, product_data: { name: `${REF} · Courtyard House` } } }],
    expires_at: Math.floor(Date.parse("2026-10-11T12:31:00Z") / 1000),
    return_url: `${ORIGIN}/bookings/trip?ref=${REF}&t=${TOKEN}&session_id={CHECKOUT_SESSION_ID}`,
  });
  for (const forbidden of ["locale", "success_url", "cancel_url", "customer_creation", "saved_payment_method_options", "setup_future_usage", "capture_method"]) {
    assert.equal(forbidden in params, false, forbidden);
    assert.equal(forbidden in params.payment_intent_data, false, forbidden);
  }
  assert.doesNotMatch(JSON.stringify(params.metadata), /ann@example|@/, "no email or name in the metadata");
});

// ---------------------------------------------------------------- expiry rules

test("sessionExpiry: first payment of a web hold ends a minute after the hold", () => {
  const out = sessionExpiry({ kind: "deposit", status: "held", holdExpiresAt: "2026-10-11T12:30:00.000Z", now: NOW });
  assert.deepEqual(out, { ok: true, expiresAt: new Date("2026-10-11T12:31:00.000Z") });
});

test("sessionExpiry: a hand-made booking's session ends with its hold, never more than 24 hours out", () => {
  const at = (ms) => iso(NOW.getTime() + ms);
  assert.deepEqual(sessionExpiry({ kind: "full", status: "awaiting_payment", holdExpiresAt: at(3 * 24 * 60 * MIN), now: NOW }), { ok: true, expiresAt: new Date(NOW.getTime() + 24 * 60 * MIN) });
  assert.deepEqual(sessionExpiry({ kind: "full", status: "awaiting_payment", holdExpiresAt: at(2 * 60 * MIN), now: NOW }), { ok: true, expiresAt: new Date(NOW.getTime() + 2 * 60 * MIN) });
  assert.deepEqual(sessionExpiry({ kind: "full", status: "awaiting_payment", holdExpiresAt: at(30 * MIN), now: NOW }), { ok: true, expiresAt: new Date(NOW.getTime() + 30 * MIN) }, "exactly 30 minutes is allowed");
  assert.deepEqual(sessionExpiry({ kind: "full", status: "awaiting_payment", holdExpiresAt: at(30 * MIN - 1000), now: NOW }), { ok: false, reason: "hold_ending" });
});

test("sessionExpiry: a balance session lasts an hour from now, whatever the hold says", () => {
  assert.deepEqual(sessionExpiry({ kind: "balance", status: "deposit_paid", holdExpiresAt: null, now: NOW }), { ok: true, expiresAt: new Date(NOW.getTime() + 60 * MIN) });
  assert.deepEqual(sessionExpiry({ kind: "balance", status: "confirmed", holdExpiresAt: "2020-01-01T00:00:00.000Z", now: NOW }), { ok: true, expiresAt: new Date(NOW.getTime() + 60 * MIN) });
});

test("sessionExpiry: a web hold with under 30 minutes of session left is hold_ending (research Pitfall 4)", () => {
  assert.deepEqual(sessionExpiry({ kind: "deposit", status: "held", holdExpiresAt: iso(NOW.getTime() + 20 * MIN), now: NOW }), { ok: false, reason: "hold_ending" });
  assert.deepEqual(sessionExpiry({ kind: "deposit", status: "held", holdExpiresAt: "not a date", now: NOW }), { ok: false, reason: "hold_ending" });
});

// ---------------------------------------------------------------- openCheckout

const INPUT = { bookingId: BOOKING_ID, kind: "deposit", status: "held", origin: ORIGIN, locale: "en", linkToken: TOKEN, now: NOW };

test("openCheckout: the amount comes from SQL, the session is created with the payment id as its idempotency key, then attached", async () => {
  const db = fakeDb({ open_payment: { data: open(), error: null } });
  const stripe = fakeStripe();
  const out = await openCheckout(db, stripe, { ...INPUT, termsVersion: "placeholder" });
  assert.deepEqual(out, { ok: true, clientSecret: NEW_SESSION.client_secret, publishableKey: "pk_test_unit_test_key_value", sessionId: NEW_SESSION.id, amountFils: 31500, kind: "deposit" });
  assert.deepEqual(callsOf(db, "open_payment")[0].args, { p_booking: BOOKING_ID, p_kind: "deposit", p_terms_version: "placeholder" });
  assert.deepEqual(names(db), ["open_payment", "attach_checkout_session"]);
  assert.deepEqual(callsOf(db, "attach_checkout_session")[0].args, { p_payment: PAYMENT_ID, p_session: NEW_SESSION.id });
  const created = stripe.log.filter((l) => l.op === "create");
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].options, { idempotencyKey: `cs-create:${PAYMENT_ID}` });
  assert.equal(created[0].params.line_items[0].price_data.unit_amount, 31500);
  assert.equal(created[0].params.expires_at, Math.floor(Date.parse("2026-10-11T12:31:00Z") / 1000));
  assert.equal(created[0].params.return_url, `${ORIGIN}/bookings/trip?ref=${REF}&t=${TOKEN}&session_id={CHECKOUT_SESSION_ID}`);
});

test("openCheckout: the return address keeps the guest's language", async () => {
  for (const [locale, path] of [["ar", "/ar/bookings/trip"], ["es", "/es/bookings/trip"]]) {
    const db = fakeDb({ open_payment: { data: open(), error: null } });
    const stripe = fakeStripe();
    await openCheckout(db, stripe, { ...INPUT, locale });
    assert.ok(stripe.log[0].params.return_url.startsWith(`${ORIGIN}${path}?ref=${REF}&t=`), locale);
  }
});

test("openCheckout: the previous open session is expired first, then the new one is created", async () => {
  const db = fakeDb({ open_payment: { data: open({ previous_session_id: "cs_test_oldSession1234" }), error: null } });
  const stripe = fakeStripe();
  await openCheckout(db, stripe, INPUT);
  assert.deepEqual(stripe.log.map((l) => l.op), ["expire", "create"]);
  assert.equal(stripe.log[0].id, "cs_test_oldSession1234");
  assert.deepEqual(stripe.log[0].options, { idempotencyKey: "cs-expire:cs_test_oldSession1234" });
});

test("openCheckout: a previous session that is already closed does not stop the new one; a network failure does", async () => {
  const db = fakeDb({ open_payment: { data: open({ previous_session_id: "cs_test_oldSession1234" }), error: null } });
  const stripe = fakeStripe({ expire: () => { throw closedError; } });
  assert.equal((await openCheckout(db, stripe, INPUT)).ok, true);

  const db2 = fakeDb({ open_payment: { data: open({ previous_session_id: "cs_test_oldSession1234" }), error: null } });
  const stripe2 = fakeStripe({ expire: () => { throw networkError; } });
  await assert.rejects(openCheckout(db2, stripe2, INPUT), /socket hang up|expire/);
  assert.equal(stripe2.log.some((l) => l.op === "create"), false, "no second session while the first may still be open");
});

test("openCheckout: every refusal of open_payment comes back as a reason; nothing is created at Stripe", async () => {
  for (const reason of ["not_payable", "hold_ended", "nothing_due", "below_minimum_charge", "terms_required"]) {
    const db = fakeDb({ open_payment: { data: { ok: false, reason }, error: null } });
    const stripe = fakeStripe();
    assert.deepEqual(await openCheckout(db, stripe, INPUT), { ok: false, reasons: [{ code: reason }] }, reason);
    assert.deepEqual(stripe.log, [], reason);
  }
  const db = fakeDb({ open_payment: { data: { ok: false, reason: "something_new" }, error: null } });
  assert.deepEqual(await openCheckout(db, fakeStripe(), INPUT), { ok: false, reasons: [{ code: "unavailable" }] });
});

test("openCheckout: hold_ending when the session would last under 30 minutes; no session is created", async () => {
  const db = fakeDb({ open_payment: { data: open({ hold_expires_at: iso(NOW.getTime() + 20 * MIN) }), error: null } });
  const stripe = fakeStripe();
  assert.deepEqual(await openCheckout(db, stripe, INPUT), { ok: false, reasons: [{ code: "hold_ending" }] });
  assert.deepEqual(stripe.log, []);
});

test("openCheckout: a balance session lasts an hour", async () => {
  const db = fakeDb({ open_payment: { data: open({ kind: "balance", amount_fils: 73500, hold_expires_at: null }), error: null } });
  const stripe = fakeStripe();
  const out = await openCheckout(db, stripe, { ...INPUT, kind: "balance", status: "deposit_paid" });
  assert.equal(out.ok, true);
  assert.equal(stripe.log[0].params.expires_at, Math.floor((NOW.getTime() + 60 * MIN) / 1000));
  assert.equal(stripe.log[0].params.metadata.kind, "balance");
});

test("openCheckout: a failed attach closes the session just made and throws", async () => {
  const db = fakeDb({ open_payment: { data: open(), error: null }, attach_checkout_session: { data: null, error: { message: "x" } } });
  const stripe = fakeStripe();
  await assert.rejects(openCheckout(db, stripe, INPUT));
  assert.deepEqual(stripe.log.map((l) => l.op), ["create", "expire"]);
  assert.equal(stripe.log[1].id, NEW_SESSION.id);
});

test("openCheckout: a session without a client secret is an error, not a half answer", async () => {
  const db = fakeDb({ open_payment: { data: open(), error: null } });
  await assert.rejects(openCheckout(db, fakeStripe({ create: () => ({ id: "cs_test_x1234567890", client_secret: null }) }), INPUT));
});

test("openCheckout: without a publishable key nothing is opened at all (no payment row is made)", async () => {
  const saved = process.env.STRIPE_PUBLISHABLE_KEY;
  delete process.env.STRIPE_PUBLISHABLE_KEY;
  try {
    const db = fakeDb({ open_payment: { data: open(), error: null } });
    assert.deepEqual(await openCheckout(db, fakeStripe(), INPUT), { ok: false, reasons: [{ code: "unavailable" }] });
    assert.deepEqual(db.calls, []);
  } finally {
    process.env.STRIPE_PUBLISHABLE_KEY = saved;
  }
});

// ---------------------------------------------------------------- expireCheckoutSessions

test("expireCheckoutSessions: one call per session with its own idempotency key; closed sessions are not an error", async () => {
  const stripe = fakeStripe({ expire: (id) => { if (id === "cs_test_b") throw closedError; return { id }; } });
  await expireCheckoutSessions(stripe, ["cs_test_a", "cs_test_b", "cs_test_c"]);
  assert.deepEqual(stripe.log.map((l) => [l.op, l.id, l.options]), [
    ["expire", "cs_test_a", { idempotencyKey: "cs-expire:cs_test_a" }],
    ["expire", "cs_test_b", { idempotencyKey: "cs-expire:cs_test_b" }],
    ["expire", "cs_test_c", { idempotencyKey: "cs-expire:cs_test_c" }],
  ]);
  await expireCheckoutSessions(fakeStripe(), []);
});

test("expireCheckoutSessions: a real failure is thrown after every session was tried, naming which failed", async () => {
  const stripe = fakeStripe({ expire: (id) => { if (id === "cs_test_a") throw networkError; return { id }; } });
  await assert.rejects(expireCheckoutSessions(stripe, ["cs_test_a", "cs_test_b"]), (err) => Array.isArray(err.failed) && err.failed.join() === "cs_test_a");
  assert.equal(stripe.log.length, 2);
});

// ---------------------------------------------------------------- live guard and key helpers

test("paymentsOpen: no key is closed; TEST is open; live is open only once the terms are real (B-13)", () => {
  assert.equal(paymentsOpen("none", false), false);
  assert.equal(paymentsOpen("test", true), true);
  assert.equal(paymentsOpen("live", true), false);
  assert.equal(paymentsOpen("live", false), true);
});

test("stripeMode reads the key's prefix only; a key that is neither test nor live counts as none", () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  try {
    for (const [value, mode] of [["sk_test_abc", "test"], ["rk_test_abc", "test"], ["sk_live_abc", "live"], ["  sk_live_abc ", "live"], ["rk_live_abc", "live"], ["pk_test_abc", "none"], ["nonsense", "none"], ["", "none"]]) {
      process.env.STRIPE_SECRET_KEY = value;
      assert.equal(stripeMode(), mode, JSON.stringify(value));
    }
    delete process.env.STRIPE_SECRET_KEY;
    assert.equal(stripeMode(), "none");
    assert.equal(serverModule.stripeServer(), null);
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    assert.ok(serverModule.stripeServer());
  } finally {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
  }
  assert.equal(stripePublishableKey(), "pk_test_unit_test_key_value");
});

// ---------------------------------------------------------------- the hold with its Checkout Session

const HOLD_OUTCOME = {
  response: { ok: true, ref: REF, holdExpiresAt: "2026-10-11T12:30:00.000Z", linkToken: TOKEN, breakdown: { grandFils: 105000 } },
  bookingId: BOOKING_ID,
};
const holdDeps = (db, stripe, outcome = HOLD_OUTCOME) => ({ db, stripe, createHold: async () => outcome, origin: ORIGIN, locale: "en", plan: "deposit", now: NOW });

test("hold: a successful hold gets the checkout in its answer, with the session id the page checks after paying", async () => {
  const db = fakeDb({ open_payment: { data: open(), error: null } });
  const out = await holdWithCheckout(holdDeps(db, fakeStripe()));
  assert.equal(out.status, 200);
  assert.deepEqual(out.body.checkout, { clientSecret: NEW_SESSION.client_secret, publishableKey: "pk_test_unit_test_key_value", sessionId: NEW_SESSION.id });
  assert.equal(out.body.ref, REF);
  assert.equal(out.body.linkToken, TOKEN);
  assert.equal("bookingId" in out.body, false);
  assert.equal(JSON.stringify(out.body).includes(BOOKING_ID), false, "the booking id never reaches the browser");
});

test("hold: the first payment is the plan's kind (deposit or full)", async () => {
  for (const plan of ["deposit", "full"]) {
    const db = fakeDb({ open_payment: { data: open({ kind: plan }), error: null } });
    await holdWithCheckout({ ...holdDeps(db, fakeStripe()), plan });
    assert.equal(callsOf(db, "open_payment")[0].args.p_kind, plan);
    assert.equal(callsOf(db, "open_payment")[0].args.p_terms_version, null, "the hold already stored the terms");
  }
});

test("hold: a refused hold is passed through untouched and no checkout is opened", async () => {
  const refused = { response: { ok: false, reasons: [{ code: "sold_out", nights: ["2026-11-10"] }] }, bookingId: null };
  const db = fakeDb();
  const stripe = fakeStripe();
  const out = await holdWithCheckout(holdDeps(db, stripe, refused));
  assert.equal(out.status, 409);
  assert.deepEqual(out.body, refused.response);
  assert.deepEqual(db.calls, []);
  assert.deepEqual(stripe.log, []);
});

test("hold: when the checkout cannot be opened the hold is dropped and the guest gets 502 unavailable", async () => {
  const db = fakeDb({ open_payment: { data: open(), error: null }, booking_drop_hold: { data: { dropped: true, closed_sessions: ["cs_test_orphan12345"] }, error: null } });
  const stripe = fakeStripe({ create: () => { throw networkError; } });
  const out = await holdWithCheckout(holdDeps(db, stripe));
  assert.equal(out.status, 502);
  assert.deepEqual(out.body, { ok: false, reasons: [{ code: "unavailable" }] });
  assert.deepEqual(callsOf(db, "booking_drop_hold")[0].args, { p_booking: BOOKING_ID, p_actor: "system" });
  assert.deepEqual(stripe.log.filter((l) => l.op === "expire").map((l) => l.id), ["cs_test_orphan12345"], "any session the drop closed is closed at Stripe too");
});

test("hold: an open_payment refusal also drops the hold (the guest never keeps nights they cannot pay for)", async () => {
  const db = fakeDb({ open_payment: { data: { ok: false, reason: "below_minimum_charge" }, error: null }, booking_drop_hold: { data: { dropped: true, closed_sessions: [] }, error: null } });
  const out = await holdWithCheckout(holdDeps(db, fakeStripe()));
  assert.equal(out.status, 502);
  assert.equal(callsOf(db, "booking_drop_hold").length, 1);
});

// ---------------------------------------------------------------- the pay endpoint

const payDeps = (db, stripe, over = {}) => ({
  db, stripe, origin: ORIGIN, now: NOW, readSession: async () => null, findOpenSession: async () => null, ...over,
});
const bookingRow = (status, over = {}) => ({ data: { id: BOOKING_ID, email: "ann@example.com", link_version: 1, status, ...over }, error: null });

test("parsePayRequest: { ref, t?, termsAccepted? } and nothing else", () => {
  assert.deepEqual(parsePayRequest({ ref: REF, t: TOKEN }), { ok: true, value: { ref: REF, t: TOKEN, termsAccepted: false } });
  assert.deepEqual(parsePayRequest({ ref: REF }), { ok: true, value: { ref: REF, t: undefined, termsAccepted: false } });
  assert.deepEqual(parsePayRequest({ ref: REF, t: TOKEN, termsAccepted: true }), { ok: true, value: { ref: REF, t: TOKEN, termsAccepted: true } });
  for (const bad of [null, [], "x", {}, { ref: "nope" }, { ref: REF, t: 5 }, { ref: REF, t: "short" }, { ref: REF, termsAccepted: "yes" }, { ref: REF, amount: 1 }, { ref: REF, kind: "full" }]) {
    assert.equal(parsePayRequest(bad).ok, false, JSON.stringify(bad));
  }
});

test("pay: access is the signed link or the signed-in email; anything else is a plain 404 with no detail", async () => {
  const stripe = fakeStripe();
  const dbs = [
    [fakeDb({ booking_by_ref: { data: null, error: null } }), { ref: REF, t: TOKEN }],
    [fakeDb({ booking_by_ref: bookingRow("held") }), { ref: REF, t: "A".repeat(43) }],
    [fakeDb({ booking_by_ref: bookingRow("held") }), { ref: REF }],
  ];
  for (const [db, input] of dbs) {
    const out = await startPayment(payDeps(db, stripe), { termsAccepted: false, ...input });
    assert.deepEqual(out, { status: 404, body: { ok: false } });
    assert.equal(callsOf(db, "open_payment").length, 0);
  }
  const db = fakeDb({ booking_by_ref: bookingRow("deposit_paid"), open_payment: { data: open({ kind: "balance", amount_fils: 73500 }), error: null } });
  const viaSession = await startPayment(payDeps(db, stripe, { readSession: async () => ({ email: "Ann@Example.com" }) }), { ref: REF, termsAccepted: false });
  assert.equal(viaSession.status, 200, "a signed-in guest with the booking's email");
  const other = await startPayment(payDeps(db, stripe, { readSession: async () => ({ email: "bob@example.com" }) }), { ref: REF, termsAccepted: false });
  assert.equal(other.status, 404);
});

const LONG_HOLD = iso(NOW.getTime() + 2 * 60 * MIN);

test("pay: the booking's status picks the kind: held and awaiting_payment pay their plan, deposit_paid and confirmed pay the balance", async () => {
  for (const [status, expected] of [["held", ["deposit", "full"]], ["awaiting_payment", ["deposit", "full"]], ["deposit_paid", ["balance"]], ["confirmed", ["balance"]]]) {
    const db = fakeDb({
      booking_by_ref: bookingRow(status),
      open_payment: (args) => ({ data: expected.length === 2 && args.p_kind === "deposit" ? { ok: false, reason: "not_payable" } : open({ kind: args.p_kind, hold_expires_at: LONG_HOLD }), error: null }),
    });
    const out = await startPayment(payDeps(db, fakeStripe()), { ref: REF, t: TOKEN, termsAccepted: false });
    assert.equal(out.status, 200, status);
    assert.equal(out.body.kind, expected.at(-1), status);
    assert.deepEqual(callsOf(db, "open_payment").map((c) => c.args.p_kind), expected, `${status}: the plan's kind is the one open_payment accepts`);
  }
});

test("pay: every other status is 409 not_payable and nothing is opened", async () => {
  for (const status of ["paid_in_full", "completed", "cancelled", "expired"]) {
    const db = fakeDb({ booking_by_ref: bookingRow(status) });
    const stripe = fakeStripe();
    const out = await startPayment(payDeps(db, stripe), { ref: REF, t: TOKEN, termsAccepted: true });
    assert.deepEqual(out, { status: 409, body: { ok: false, reasons: [{ code: "not_payable" }] } }, status);
    assert.equal(callsOf(db, "open_payment").length, 0, status);
    assert.deepEqual(stripe.log, [], status);
  }
});

test("pay: nothing due and a hold that ended are 409 with their reason", async () => {
  for (const reason of ["nothing_due", "hold_ended"]) {
    const db = fakeDb({ booking_by_ref: bookingRow("confirmed"), open_payment: { data: { ok: false, reason }, error: null } });
    const out = await startPayment(payDeps(db, fakeStripe()), { ref: REF, t: TOKEN, termsAccepted: false });
    assert.deepEqual(out, { status: 409, body: { ok: false, reasons: [{ code: reason }] } }, reason);
  }
});

test("pay: terms are required for a booking that has none (hand-made) and the version is sent only when the guest accepted", async () => {
  const script = (args) => ({ data: args.p_terms_version ? open({ hold_expires_at: LONG_HOLD }) : { ok: false, reason: "terms_required" }, error: null });
  const db = fakeDb({ booking_by_ref: bookingRow("awaiting_payment"), open_payment: script });
  const refused = await startPayment(payDeps(db, fakeStripe()), { ref: REF, t: TOKEN, termsAccepted: false });
  assert.equal(refused.status, 400);
  assert.deepEqual(refused.body, { ok: false, reasons: [{ code: "terms_required" }] });
  assert.equal(callsOf(db, "open_payment")[0].args.p_terms_version, null);

  const db2 = fakeDb({ booking_by_ref: bookingRow("awaiting_payment"), open_payment: script });
  const accepted = await startPayment(payDeps(db2, fakeStripe()), { ref: REF, t: TOKEN, termsAccepted: true });
  assert.equal(accepted.status, 200);
  assert.equal(callsOf(db2, "open_payment")[0].args.p_terms_version, "placeholder");
});

test("pay: a held booking with a session Stripe still reports open gets that session back, not a new one (A5)", async () => {
  const db = fakeDb({ booking_by_ref: bookingRow("held") });
  const stripe = fakeStripe({ retrieve: (id) => ({ id, status: "open", client_secret: "cs_test_kept1234567_secret_y", amount_total: 31500, metadata: { kind: "deposit" } }) });
  const out = await startPayment(payDeps(db, stripe, { findOpenSession: async (id) => (id === BOOKING_ID ? "cs_test_kept1234567" : null) }), { ref: REF, t: TOKEN, termsAccepted: false });
  assert.deepEqual(out, { status: 200, body: { ok: true, clientSecret: "cs_test_kept1234567_secret_y", publishableKey: "pk_test_unit_test_key_value", sessionId: "cs_test_kept1234567", amountFils: 31500, kind: "deposit" } });
  assert.equal(callsOf(db, "open_payment").length, 0);
  assert.deepEqual(stripe.log.map((l) => l.op), ["retrieve"]);
});

test("pay: a session Stripe reports expired or complete, or one without a secret, is not reused", async () => {
  for (const session of [{ status: "expired", client_secret: "x_secret" }, { status: "complete", client_secret: "x_secret" }, { status: "open", client_secret: null }]) {
    const db = fakeDb({ booking_by_ref: bookingRow("held"), open_payment: { data: open(), error: null } });
    const stripe = fakeStripe({ retrieve: (id) => ({ id, amount_total: 31500, metadata: { kind: "deposit" }, ...session }) });
    const out = await startPayment(payDeps(db, stripe, { findOpenSession: async () => "cs_test_kept1234567" }), { ref: REF, t: TOKEN, termsAccepted: false });
    assert.equal(out.status, 200, JSON.stringify(session));
    assert.equal(out.body.sessionId, NEW_SESSION.id, JSON.stringify(session));
    assert.equal(callsOf(db, "open_payment").length, 1);
  }
});

test("pay: a balance is never reused; a failing Stripe lookup falls back to a new session", async () => {
  const db = fakeDb({ booking_by_ref: bookingRow("deposit_paid"), open_payment: { data: open({ kind: "balance", amount_fils: 73500 }), error: null } });
  const stripe = fakeStripe();
  await startPayment(payDeps(db, stripe, { findOpenSession: async () => "cs_test_kept1234567" }), { ref: REF, t: TOKEN, termsAccepted: false });
  assert.equal(stripe.log.some((l) => l.op === "retrieve"), false);

  const db2 = fakeDb({ booking_by_ref: bookingRow("held"), open_payment: { data: open(), error: null } });
  const stripe2 = fakeStripe({ retrieve: () => { throw networkError; } });
  const out = await startPayment(payDeps(db2, stripe2, { findOpenSession: async () => "cs_test_kept1234567" }), { ref: REF, t: TOKEN, termsAccepted: false });
  assert.equal(out.status, 200);
  assert.equal(out.body.sessionId, NEW_SESSION.id);
});

test("pay: a Stripe or database failure is 503 unavailable, with nothing in the message", async () => {
  const db = fakeDb({ booking_by_ref: bookingRow("deposit_paid"), open_payment: { data: open({ kind: "balance" }), error: null } });
  const out = await startPayment(payDeps(db, fakeStripe({ create: () => { throw networkError; } })), { ref: REF, t: TOKEN, termsAccepted: false });
  assert.deepEqual(out, { status: 503, body: { ok: false, reasons: [{ code: "unavailable" }] } });
});

// ---------------------------------------------------------------- the status check

const SESSION_ID = "cs_test_a1B2c3D4e5F6g7";
const paidSession = { id: SESSION_ID, status: "complete", payment_status: "paid", payment_intent: "pi_1", amount_total: 31500, currency: "aed" };
const statusDeps = (db, stripe) => ({ db, stripe });

test("status: only a Checkout Session id is accepted", async () => {
  const stripe = fakeStripe();
  for (const bad of ["", null, "cs_live", "pi_test_abcdefghij", "cs_test_short", "cs_test_ab cd efghijk", `cs_test_${"a".repeat(300)}`, "../etc/passwd", "cs_prod_abcdefghijkl"]) {
    const out = await checkSession(statusDeps(fakeDb(), stripe), bad);
    assert.equal(out.status, 400, String(bad));
  }
  assert.deepEqual(stripe.log, []);
});

test("status: paid is recorded through the shared fulfilment, once per call, and answered as { status: 'paid' } only", async () => {
  const first = { found: true, first_time: true, booking_id: BOOKING_ID, payment_id: PAYMENT_ID, kind: "deposit", status: "deposit_paid", needs_attention: false, closed_sessions: [] };
  const again = { ...first, first_time: false };
  let n = 0;
  const db = fakeDb({ record_payment: () => ({ data: n++ === 0 ? first : again, error: null }) });
  const stripe = fakeStripe({ retrieve: () => paidSession });
  const one = await checkSession(statusDeps(db, stripe), SESSION_ID);
  const two = await checkSession(statusDeps(db, stripe), SESSION_ID);
  assert.deepEqual(one, { status: 200, body: { status: "paid" } });
  assert.deepEqual(two, { status: 200, body: { status: "paid" } });
  assert.equal(callsOf(db, "record_payment").length, 2, "idempotent in SQL: each call asks, only the first records");
  assert.equal(callsOf(db, "record_payment")[0].args.p_session, SESSION_ID);
  assert.equal(callsOf(db, "set_payment_card").length, 1, "card details once");
  assert.deepEqual(Object.keys(one.body), ["status"], "no name, email or amount");
});

test("status: open and expired sessions are answered without recording anything", async () => {
  for (const [session, expected] of [[{ id: SESSION_ID, status: "open", payment_status: "unpaid" }, "open"], [{ id: SESSION_ID, status: "expired", payment_status: "unpaid" }, "expired"], [{ id: SESSION_ID, status: "complete", payment_status: "unpaid" }, "open"]]) {
    const db = fakeDb();
    const out = await checkSession(statusDeps(db, fakeStripe({ retrieve: () => session })), SESSION_ID);
    assert.deepEqual(out, { status: 200, body: { status: expected } }, JSON.stringify(session));
    assert.deepEqual(db.calls, []);
  }
});

test("status: a session we have no payment for is 404; a failing Stripe or database is 503", async () => {
  const unknown = fakeDb({ record_payment: { data: { found: false, first_time: false, reason: "payment_unknown" }, error: null } });
  assert.deepEqual(await checkSession(statusDeps(unknown, fakeStripe({ retrieve: () => paidSession })), SESSION_ID), { status: 404, body: { status: "unknown" } });
  const missing = Object.assign(new Error("no such session"), { type: "StripeInvalidRequestError", code: "resource_missing", statusCode: 404 });
  assert.deepEqual(await checkSession(statusDeps(fakeDb(), fakeStripe({ retrieve: () => { throw missing; } })), SESSION_ID), { status: 404, body: { status: "unknown" } });
  assert.deepEqual(await checkSession(statusDeps(fakeDb(), fakeStripe({ retrieve: () => { throw networkError; } })), SESSION_ID), { status: 503, body: { status: "unavailable" } });
  const down = fakeDb({ record_payment: { data: null, error: { message: "x" } } });
  assert.deepEqual(await checkSession(statusDeps(down, fakeStripe({ retrieve: () => paidSession })), SESSION_ID), { status: 503, body: { status: "unavailable" } });
});

// ---------------------------------------------------------------- the release expires the sessions

test("release: the sessions the release closed are expired at Stripe; a Stripe failure changes nothing for the guest", async () => {
  const db = fakeDb({
    booking_by_ref: bookingRow("held"),
    booking_drop_hold: { data: { dropped: true, closed_sessions: ["cs_test_one1234567", "cs_test_two1234567"] }, error: null },
  });
  const stripe = fakeStripe();
  assert.deepEqual(await releaseAndExpire(db, stripe, { ref: REF, t: TOKEN }), { ok: true });
  assert.deepEqual(stripe.log.map((l) => [l.op, l.id]), [["expire", "cs_test_one1234567"], ["expire", "cs_test_two1234567"]]);

  const failing = fakeStripe({ expire: () => { throw networkError; } });
  assert.deepEqual(await releaseAndExpire(db, failing, { ref: REF, t: TOKEN }), { ok: true }, "the rows are already closed; a late payment is flagged by record_payment");

  const refused = await releaseAndExpire(fakeDb({ booking_by_ref: bookingRow("held") }), fakeStripe(), { ref: REF, t: "B".repeat(43) });
  assert.deepEqual(refused, { ok: false });
});

test("release: with no Stripe client the release still stands", async () => {
  const db = fakeDb({ booking_by_ref: bookingRow("held"), booking_drop_hold: { data: { dropped: true, closed_sessions: ["cs_test_one1234567"] }, error: null } });
  assert.deepEqual(await releaseAndExpire(db, null, { ref: REF, t: TOKEN }), { ok: true });
});

// ---------------------------------------------------------------- the Payment Element appearance

test("appearance: square corners everywhere, the brand's colours from tokens.json, gold never a fill", () => {
  const appearance = appearanceModule.paymentAppearance(tokens);
  assert.equal(appearance.variables.borderRadius, "0px");
  for (const rule of Object.values(appearance.rules)) {
    if ("borderRadius" in rule) assert.equal(rule.borderRadius, "0px");
  }
  assert.equal(appearance.variables.colorPrimary, tokens.color.teal);
  assert.equal(appearance.variables.colorText, tokens.color.ink);
  assert.equal(appearance.variables.colorBackground, tokens.color.surface);
  assert.equal(appearance.variables.colorDanger, tokens.color.error);
  assert.equal(appearance.variables.colorTextSecondary, tokens.color.muted);
  assert.equal(appearance.variables.fontSizeBase, tokens.text.body.size);
  assert.match(appearance.variables.fontFamily, /^Lato, /);
  assert.doesNotMatch(appearance.variables.fontFamily, /var\(/, "the Element lives in Stripe's frame: page variables do not resolve there");
  assert.doesNotMatch(JSON.stringify(appearance).toLowerCase(), new RegExp(tokens.color.gold.slice(1)), "gold appears nowhere in the Element");
  assert.doesNotMatch(JSON.stringify(appearance), /rgb\(\d+ \d+ \d+ \//, "slash colour syntax is rewritten for Stripe");
  assert.equal(appearance.theme, "flat");
});

// ---------------------------------------------------------------- the payment copy

test("payment copy: the same keys in English, Arabic and Spanish; the drafts are not the English text", async () => {
  const copyModule = await loadTs("lib/copy/payment.ts");
  const flat = (value, prefix = "") => Object.entries(value).flatMap(([k, v]) => (typeof v === "object" && v !== null ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
  const en = flat(copyModule.paymentCopy("en"));
  assert.ok(en.length >= 8);
  for (const locale of ["ar", "es"]) {
    const other = flat(copyModule.paymentCopy(locale));
    assert.deepEqual(other.map(([k]) => k), en.map(([k]) => k), locale);
    for (const [key, value] of other) assert.ok(typeof value === "string" && value.trim() !== "", `${locale} ${key}`);
    assert.ok(other.some(([k, v], i) => v !== en[i][1]), `${locale} differs from English`);
  }
  const line = copyModule.paymentCopy("en").currency.note;
  assert.match(line, /Stripe/);
  assert.match(line, /AED/);
  assert.equal(copyModule.paymentCopy("en").pay.label.includes("{total}"), true);
});

// ---------------------------------------------------------------- source rules

function filesUnder(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesUnder(path, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(path);
  }
  return acc;
}

test("no hosted page, no success or cancel URL, no manual capture anywhere under lib/stripe or app/api", () => {
  const hits = [...filesUnder("lib/stripe"), ...filesUnder("app/api")].filter((p) => /success_url|cancel_url|hosted_page|capture_method/.test(readFileSync(p, "utf8")));
  assert.deepEqual(hits, []);
});

test("no public build variable carries a Stripe value anywhere in app, components or lib", () => {
  const hits = ["app", "components", "lib"].flatMap((d) => filesUnder(d)).filter((p) => /NEXT_PUBLIC_STRIPE/.test(readFileSync(p, "utf8")));
  assert.deepEqual(hits, []);
});

test("every Stripe POST carries an idempotency key from our own ids", () => {
  const source = readFileSync("lib/stripe/checkout.ts", "utf8");
  assert.match(source, /"cs-create:"/);
  assert.match(source, /"cs-expire:"/);
  assert.equal((source.match(/sessions\.create\(/g) ?? []).length, 1);
  assert.equal((source.match(/sessions\.expire\(/g) ?? []).length, 1);
  assert.match(source, /sessions\.create\([^)]*idempotencyKey/s);
  assert.match(source, /sessions\.expire\([^)]*idempotencyKey/s);
});

test("the three routes: origin check on the POSTs, no-store, nothing logged, the status route is GET only", () => {
  const pay = readFileSync("app/api/booking/pay/route.ts", "utf8");
  const status = readFileSync("app/api/booking/status/route.ts", "utf8");
  const hold = readFileSync("app/api/booking/hold/route.ts", "utf8");
  const release = readFileSync("app/api/booking/release/route.ts", "utf8");
  for (const [name, text] of [["pay", pay], ["status", status], ["hold", hold], ["release", release]]) {
    assert.match(text, /export const dynamic = "force-dynamic"/, name);
    assert.match(text, /no-store/, name);
    assert.doesNotMatch(text, /console\./, name);
    assert.doesNotMatch(text, /NODE_ENV\s*!==?\s*"production"[^;]*STRIPE/, name);
  }
  assert.match(pay, /isAllowedPostOrigin/);
  assert.match(pay, /4 \* 1024/);
  assert.match(pay, /export async function POST/);
  assert.doesNotMatch(pay, /export async function GET/);
  assert.match(status, /export async function GET/);
  assert.doesNotMatch(status, /export async function POST/);
  assert.match(hold, /holdWithCheckout/);
  assert.match(hold, /stripeMode\(\)/);
  assert.doesNotMatch(hold, /STRIPE_SECRET_KEY|liveGate/, "the key is read in lib/stripe/server.ts only");
  assert.match(release, /releaseAndExpire/);
});

test("the payment panel: Stripe's checkout elements, wallets as planned, the total read from Stripe, no key in the file", () => {
  const source = readFileSync("components/journey/payment-panel.tsx", "utf8");
  assert.match(source, /^"use client";/);
  assert.match(source, /@stripe\/react-stripe-js\/checkout/);
  assert.match(source, /CheckoutElementsProvider/);
  assert.match(source, /PaymentElement/);
  assert.match(source, /CurrencySelectorElement/);
  assert.match(source, /applePay: "auto"/);
  assert.match(source, /googlePay: "never"/);
  assert.match(source, /link: "never"/);
  assert.match(source, /redirect: "if_required"/);
  assert.match(source, /adaptivePricing: \{ allowed: true \}/);
  assert.match(source, /total\.total/, "the Pay button reads the total from the checkout object (confirm() throws otherwise)");
  assert.match(source, /currencyOptions/, "the currency choice appears only when Stripe offers one");
  assert.doesNotMatch(source, /pk_(test|live)_|sk_(test|live)_|process\.env|localStorage|sessionStorage/);
  assert.match(source, /export type PaymentPanelProps/);
  assert.match(source, /export function PaymentPanel/);
});
