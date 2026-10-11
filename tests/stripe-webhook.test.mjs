// Plan 04-04, Task 2: the Stripe webhook. Events are signed with Stripe's own test-header helper and verified through the
// real constructEventAsync (SubtleCrypto), exactly as the route does; the database and Stripe are fakes (no keys, no
// network). Every amount is a symbolic test value in fils. The raw-body proof on the built Worker is
// tests/build/stripe-webhook.spec.ts.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadRoute } from "./helpers/load-route.mjs";

const { handleStripeEvent, deliverStripeEvent } = await loadTs("lib/stripe/webhook.ts");
const { fulfillSession } = await loadTs("lib/stripe/fulfill.ts");

const SECRET = "whsec_unit_test_secret_value";
const verifier = new Stripe("sk_test_unit_test_only", { httpClient: Stripe.createFetchHttpClient() });

/** A signed delivery verified by the real constructEventAsync, like the route. */
async function delivered(event) {
  const body = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  return verifier.webhooks.constructEventAsync(body, header, SECRET, undefined, Stripe.createSubtleCryptoProvider());
}

const event = (id, type, object) => ({ id, object: "event", type, created: 1_800_000_000, data: { object } });
const SESSION = "cs_test_a1B2c3D4e5F6g7";
const PAYMENT_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const paidSession = (over = {}) => ({
  id: SESSION, object: "checkout.session", payment_status: "paid", payment_intent: "pi_test_123", amount_total: 31500, currency: "aed", ...over,
});
const intent = (over = {}) => ({
  id: "pi_test_123",
  amount: 31500,
  currency: "aed",
  metadata: { booking_id: BOOKING_ID, payment_id: PAYMENT_ID, amount_fils: "31500" },
  latest_charge: { id: "ch_test_1", payment_method_details: { card: { brand: "visa", last4: "4242", wallet: null } } },
  ...over,
});

/** A fake database: `script[name]` is a value or a function of (args, calls) answering { data, error }. */
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
const of = (calls, name) => calls.filter((c) => c.name === name);

function fakeStripe({ retrieve, refunds } = {}) {
  const calls = { retrieve: [], refunds: [] };
  return {
    calls,
    paymentIntents: { retrieve: async (id, params) => { calls.retrieve.push({ id, params }); return (retrieve ?? (() => intent()))(id, params); } },
    refunds: { list: async (params) => { calls.refunds.push(params); return (refunds ?? (() => ({ data: [], has_more: false })))(params); } },
  };
}

const FIRST = { found: true, first_time: true, booking_id: BOOKING_ID, payment_id: PAYMENT_ID, kind: "deposit", status: "deposit_paid", needs_attention: false, closed_sessions: [] };
const AGAIN = { found: true, first_time: false, booking_id: BOOKING_ID, payment_id: PAYMENT_ID, kind: "deposit", status: "deposit_paid", needs_attention: false, closed_sessions: [] };
const deps = (db, stripe) => ({ db, stripe, now: () => new Date("2026-10-11T12:00:00Z") });

// ---------------------------------------------------------------- fulfilment

test("fulfil: a paid session records the payment once and sets the card details (last 4 only)", async () => {
  const db = fakeDb({ record_payment: { data: FIRST, error: null } });
  const stripe = fakeStripe();
  const result = await fulfillSession(db, stripe, paidSession(), "stripe:evt_1");
  assert.deepEqual(result, FIRST);
  assert.deepEqual(of(db.calls, "record_payment").map((c) => c.args), [{ p_session: SESSION, p_payment_intent: "pi_test_123", p_actor: "stripe:evt_1" }]);
  assert.deepEqual(stripe.calls.retrieve, [{ id: "pi_test_123", params: { expand: ["latest_charge"] } }]);
  assert.deepEqual(of(db.calls, "set_payment_card").map((c) => c.args), [
    { p_payment: PAYMENT_ID, p_charge: "ch_test_1", p_brand: "visa", p_last4: "4242", p_wallet: null, p_presentment_amount: null, p_presentment_currency: null },
  ]);
  assert.deepEqual(of(db.calls, "log_booking_event"), [], "an exact amount is not a mismatch");
});

test("fulfil: the same session a second time (webhook, then the status check) changes nothing and asks Stripe nothing", async () => {
  const db = fakeDb({ record_payment: { data: AGAIN, error: null } });
  const stripe = fakeStripe();
  const result = await fulfillSession(db, stripe, paidSession(), "guest");
  assert.deepEqual(result, AGAIN);
  assert.equal(stripe.calls.retrieve.length, 0, "no second card call");
  assert.equal(of(db.calls, "set_payment_card").length, 0);
});

test("fulfil: card details cover a wallet and the guest's own currency; a last 4 that is not four digits is dropped", async () => {
  const db = fakeDb({ record_payment: { data: FIRST, error: null } });
  const stripe = fakeStripe({
    retrieve: () => intent({
      presentment_details: { presentment_amount: 8123, presentment_currency: "eur" },
      latest_charge: { id: "ch_test_2", payment_method_details: { card: { brand: "mastercard", last4: "12", wallet: { type: "apple_pay" } } } },
    }),
  });
  await fulfillSession(db, stripe, paidSession(), "stripe:evt_2");
  assert.deepEqual(of(db.calls, "set_payment_card")[0].args, {
    p_payment: PAYMENT_ID, p_charge: "ch_test_2", p_brand: "mastercard", p_last4: null, p_wallet: "apple_pay", p_presentment_amount: 8123, p_presentment_currency: "eur",
  });
});

test("fulfil: an amount or currency that is not what the payment row asked for is logged as a mismatch, never dropped", async () => {
  for (const [label, session, pi] of [
    ["session total", paidSession({ amount_total: 31000 }), intent()],
    ["intent amount", paidSession(), intent({ amount: 31000 })],
    ["currency", paidSession({ currency: "eur" }), intent()],
  ]) {
    const db = fakeDb({ record_payment: { data: FIRST, error: null } });
    await fulfillSession(db, fakeStripe({ retrieve: () => pi }), session, "stripe:evt_3");
    const logged = of(db.calls, "log_booking_event");
    assert.equal(logged.length, 1, label);
    assert.equal(logged[0].args.p_booking, BOOKING_ID, label);
    assert.equal(logged[0].args.p_action, "payment", label);
    assert.equal(logged[0].args.p_detail.mismatch, true, label);
    assert.equal(logged[0].args.p_detail.expected_fils, 31500, label);
    assert.equal(of(db.calls, "set_payment_card").length, 1, `${label}: the card details are still stored`);
  }
});

test("fulfil: a session that is not paid is never recorded", async () => {
  const db = fakeDb();
  const stripe = fakeStripe();
  const result = await fulfillSession(db, stripe, paidSession({ payment_status: "unpaid" }), "guest");
  assert.deepEqual(result, { found: false, first_time: false, reason: "not_paid" });
  assert.deepEqual(db.calls, []);
  assert.equal(stripe.calls.retrieve.length, 0);
});

test("fulfil: a late payment (needs_attention) is passed through unchanged", async () => {
  const late = { ...FIRST, status: "expired", needs_attention: true };
  const db = fakeDb({ record_payment: { data: late, error: null } });
  assert.deepEqual(await fulfillSession(db, fakeStripe(), paidSession(), "stripe:evt_4"), late);
});

test("fulfil: a session we do not know throws (the webhook answers 500 and Stripe retries)", async () => {
  const db = fakeDb({ record_payment: { data: { found: false, first_time: false, reason: "payment_unknown" }, error: null } });
  await assert.rejects(fulfillSession(db, fakeStripe(), paidSession(), "stripe:evt_5"), /payment_unknown/);
});

test("fulfil: a database error throws without the session or payment details in the message", async () => {
  const db = fakeDb({ record_payment: { data: null, error: { message: "boom cs_test_a1B2c3D4e5F6g7" } } });
  await assert.rejects(fulfillSession(db, fakeStripe(), paidSession(), "x"), (err) => err.message === "rpc record_payment failed");
});

test("fulfil: a failing card lookup does not undo the recorded payment", async () => {
  const db = fakeDb({ record_payment: { data: FIRST, error: null } });
  const stripe = fakeStripe({ retrieve: () => { throw new Error("stripe down"); } });
  assert.deepEqual(await fulfillSession(db, stripe, paidSession(), "stripe:evt_6"), FIRST);
});

// ---------------------------------------------------------------- the dispatcher

test("completed + paid: one record_payment, the card set once", async () => {
  const db = fakeDb({ record_payment: { data: FIRST, error: null } });
  const stripe = fakeStripe();
  const out = await handleStripeEvent(await delivered(event("evt_10", "checkout.session.completed", paidSession())), deps(db, stripe));
  assert.equal(out.handled, true);
  assert.deepEqual(out.fulfilled, FIRST);
  assert.equal(of(db.calls, "record_payment").length, 1);
  assert.equal(of(db.calls, "set_payment_card").length, 1);
  assert.equal(of(db.calls, "record_payment")[0].args.p_actor, "stripe:evt_10");
});

test("completed with any other payment_status is ignored (200)", async () => {
  for (const status of ["unpaid", "no_payment_required"]) {
    const db = fakeDb();
    const out = await handleStripeEvent(await delivered(event("evt_11", "checkout.session.completed", paidSession({ payment_status: status }))), deps(db, fakeStripe()));
    assert.equal(out.handled, false);
    assert.deepEqual(db.calls, []);
  }
});

test("expired: mark_session_expired with the event id as the actor", async () => {
  const db = fakeDb({ mark_session_expired: { data: { found: true }, error: null } });
  const out = await handleStripeEvent(await delivered(event("evt_12", "checkout.session.expired", { id: SESSION, object: "checkout.session" })), deps(db, fakeStripe()));
  assert.equal(out.handled, true);
  assert.deepEqual(db.calls.map((c) => [c.name, c.args]), [["mark_session_expired", { p_session: SESSION, p_actor: "stripe:evt_12" }]]);
});

const charge = (over = {}) => ({
  id: "ch_test_1", object: "charge", payment_intent: "pi_test_123", amount: 31500, amount_refunded: 10000,
  refunds: { data: [{ id: "re_1", amount: 6000, status: "succeeded", charge: "ch_test_1" }, { id: "re_2", amount: 4000, status: "pending", charge: "ch_test_1" }], has_more: false },
  ...over,
});

test("refund: every refund of the charge is recorded by its own id", async () => {
  const db = fakeDb({ record_refund: { data: "ok", error: null } });
  const stripe = fakeStripe();
  const out = await handleStripeEvent(await delivered(event("evt_13", "charge.refunded", charge())), deps(db, stripe));
  assert.equal(out.handled, true);
  assert.deepEqual(of(db.calls, "record_refund").map((c) => c.args), [
    { p_refund_id: "re_1", p_charge: "ch_test_1", p_payment_intent: "pi_test_123", p_amount_fils: 6000, p_status: "succeeded", p_actor: "stripe:evt_13" },
    { p_refund_id: "re_2", p_charge: "ch_test_1", p_payment_intent: "pi_test_123", p_amount_fils: 4000, p_status: "pending", p_actor: "stripe:evt_13" },
  ]);
  assert.equal(stripe.calls.refunds.length, 0, "the event carried all of them");
});

test("refund: when the charge lists more (or none), Stripe's own list is read, page by page", async () => {
  const pages = [
    { data: [{ id: "re_1", amount: 1000, status: "succeeded" }, { id: "re_2", amount: 2000, status: "succeeded" }], has_more: true },
    { data: [{ id: "re_3", amount: 3000, status: "succeeded" }], has_more: false },
  ];
  for (const shape of [{ refunds: { data: [{ id: "re_1", amount: 1000, status: "succeeded" }], has_more: true } }, { refunds: undefined }]) {
    const db = fakeDb({ record_refund: { data: "ok", error: null } });
    const stripe = fakeStripe({ refunds: (params) => (params.starting_after ? pages[1] : pages[0]) });
    await handleStripeEvent(await delivered(event("evt_14", "charge.refunded", charge(shape))), deps(db, stripe));
    assert.deepEqual(of(db.calls, "record_refund").map((c) => c.args.p_refund_id), ["re_1", "re_2", "re_3"]);
    assert.deepEqual(stripe.calls.refunds.map((p) => [p.charge, p.starting_after ?? null]), [["ch_test_1", null], ["ch_test_1", "re_2"]]);
  }
});

test("refund and dispute on a payment we do not know yet throw, so the route answers 500 and Stripe retries", async () => {
  const db = fakeDb({ record_refund: { data: "payment_unknown", error: null }, record_dispute: { data: "payment_unknown", error: null } });
  await assert.rejects(handleStripeEvent(await delivered(event("evt_15", "charge.refunded", charge())), deps(db, fakeStripe())), /payment_unknown/);
  const dispute = { id: "dp_1", object: "dispute", amount: 31500, charge: "ch_test_1", payment_intent: "pi_test_123", reason: "fraudulent", status: "needs_response" };
  await assert.rejects(handleStripeEvent(await delivered(event("evt_16", "charge.dispute.created", dispute)), deps(db, fakeStripe())), /payment_unknown/);
});

test("dispute created and closed are both recorded with the dispute's status", async () => {
  const db = fakeDb({ record_dispute: { data: "ok", error: null } });
  const base = { id: "dp_1", object: "dispute", amount: 31500, charge: "ch_test_1", payment_intent: "pi_test_123", reason: "fraudulent" };
  await handleStripeEvent(await delivered(event("evt_17", "charge.dispute.created", { ...base, status: "needs_response" })), deps(db, fakeStripe()));
  await handleStripeEvent(await delivered(event("evt_18", "charge.dispute.closed", { ...base, status: "lost" })), deps(db, fakeStripe()));
  assert.deepEqual(of(db.calls, "record_dispute").map((c) => c.args), [
    { p_dispute_id: "dp_1", p_charge: "ch_test_1", p_payment_intent: "pi_test_123", p_amount_fils: 31500, p_reason: "fraudulent", p_status: "needs_response", p_actor: "stripe:evt_17" },
    { p_dispute_id: "dp_1", p_charge: "ch_test_1", p_payment_intent: "pi_test_123", p_amount_fils: 31500, p_reason: "fraudulent", p_status: "lost", p_actor: "stripe:evt_18" },
  ]);
});

test("an expanded charge or payment intent object is read by its id", async () => {
  const db = fakeDb({ record_dispute: { data: "ok", error: null } });
  const dispute = { id: "dp_2", object: "dispute", amount: 100, charge: { id: "ch_test_9" }, payment_intent: { id: "pi_test_9" }, reason: "general", status: "needs_response" };
  await handleStripeEvent(await delivered(event("evt_19", "charge.dispute.created", dispute)), deps(db, fakeStripe()));
  const args = of(db.calls, "record_dispute")[0].args;
  assert.equal(args.p_charge, "ch_test_9");
  assert.equal(args.p_payment_intent, "pi_test_9");
});

test("any other event type is ignored: no database call, no Stripe call", async () => {
  for (const type of ["customer.created", "payment_intent.succeeded", "charge.succeeded", "checkout.session.async_payment_succeeded"]) {
    const db = fakeDb();
    const stripe = fakeStripe();
    const out = await handleStripeEvent(await delivered(event("evt_20", type, { id: "x_1", object: "thing" })), deps(db, stripe));
    assert.equal(out.handled, false, type);
    assert.deepEqual(db.calls, [], type);
    assert.equal(stripe.calls.retrieve.length + stripe.calls.refunds.length, 0, type);
  }
});

// ---------------------------------------------------------------- delivery: the event claim around the dispatcher

test("delivery: the event is claimed, handled, finished; the answer is 200", async () => {
  const db = fakeDb({ claim_stripe_event: { data: true, error: null }, record_payment: { data: FIRST, error: null } });
  const out = await deliverStripeEvent(await delivered(event("evt_30", "checkout.session.completed", paidSession())), deps(db, fakeStripe()));
  assert.deepEqual(out, { status: 200, duplicate: false });
  assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event", "record_payment", "set_payment_card", "finish_stripe_event"]);
  assert.deepEqual(db.calls[0].args, { p_id: "evt_30", p_type: "checkout.session.completed" });
  assert.deepEqual(db.calls.at(-1).args, { p_id: "evt_30" });
});

test("delivery: a duplicate event id (claim false) is 200 and the handler is never called", async () => {
  const db = fakeDb({ claim_stripe_event: { data: false, error: null } });
  const stripe = fakeStripe();
  const out = await deliverStripeEvent(await delivered(event("evt_31", "checkout.session.completed", paidSession())), deps(db, stripe));
  assert.deepEqual(out, { status: 200, duplicate: true });
  assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event"]);
  assert.equal(stripe.calls.retrieve.length, 0);
});

test("delivery: a refund on an unknown charge is 500 and the claim is dropped; the retry succeeds", async () => {
  let known = false;
  const db = fakeDb({ claim_stripe_event: { data: true, error: null }, record_refund: () => ({ data: known ? "ok" : "payment_unknown", error: null }) });
  const refund = await delivered(event("evt_32", "charge.refunded", charge({ refunds: { data: [{ id: "re_1", amount: 6000, status: "succeeded" }], has_more: false } })));
  assert.deepEqual(await deliverStripeEvent(refund, deps(db, fakeStripe())), { status: 500, duplicate: false });
  assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event", "record_refund", "drop_stripe_event"]);
  assert.deepEqual(db.calls.at(-1).args, { p_id: "evt_32" });
  known = true;
  db.calls.length = 0;
  assert.deepEqual(await deliverStripeEvent(refund, deps(db, fakeStripe())), { status: 200, duplicate: false });
  assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event", "record_refund", "finish_stripe_event"]);
});

test("delivery: a claim that errors is 500 with nothing claimed or dropped", async () => {
  for (const claim of [{ data: null, error: { message: "down" } }, { data: "yes", error: null }]) {
    const db = fakeDb({ claim_stripe_event: claim });
    assert.deepEqual(await deliverStripeEvent(await delivered(event("evt_33", "charge.refunded", charge())), deps(db, fakeStripe())), { status: 500, duplicate: false });
    assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event"]);
  }
});

test("delivery: a failing finish does not undo a handled event (200)", async () => {
  const db = fakeDb({ claim_stripe_event: { data: true, error: null }, mark_session_expired: { data: { found: true }, error: null }, finish_stripe_event: { data: null, error: { message: "down" } } });
  const out = await deliverStripeEvent(await delivered(event("evt_34", "checkout.session.expired", { id: SESSION })), deps(db, fakeStripe()));
  assert.deepEqual(out, { status: 200, duplicate: false });
});

test("delivery: an ignored event type is still claimed and finished (a replay is a duplicate)", async () => {
  const db = fakeDb({ claim_stripe_event: { data: true, error: null } });
  assert.deepEqual(await deliverStripeEvent(await delivered(event("evt_35", "customer.created", { id: "cus_1" })), deps(db, fakeStripe())), { status: 200, duplicate: false });
  assert.deepEqual(db.calls.map((c) => c.name), ["claim_stripe_event", "finish_stripe_event"]);
});

// ---------------------------------------------------------------- the route

const SAVED = Object.fromEntries(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => [k, process.env[k]]));
after(() => {
  for (const [name, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function post(body, signature) {
  const headers = { "content-type": "application/json" };
  if (signature !== undefined) headers["stripe-signature"] = signature;
  return new Request("https://preview.almarprivatejourney.com/api/stripe/webhook", { method: "POST", headers, body });
}

test("route: a bad signature, a changed byte, a stale header and no header are 400; a good one without a database is 503", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const route = await loadRoute("app/api/stripe/webhook/route.ts");
  const body = JSON.stringify(event("evt_40", "customer.created", { id: "cus_1" }));
  const good = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });

  assert.equal((await route.POST(post(body, good))).status, 503, "valid signature, no database: unavailable, never 400");
  assert.equal((await route.POST(post(body, "t=1,v1=deadbeef"))).status, 400);
  assert.equal((await route.POST(post(body.replace("cus_1", "cus_2"), good))).status, 400, "one byte changed");
  assert.equal((await route.POST(post(body, Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 }))))
    .status, 400, "outside the five-minute tolerance");
  assert.equal((await route.POST(post(body))).status, 400, "no header");
  assert.equal((await route.POST(post(body, Stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_another_endpoints_secret" })))).status, 400);
  assert.equal(route.GET, undefined, "POST only");
});

test("route: without the signing secret or the Stripe key it is 503, never a guess", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const route = await loadRoute("app/api/stripe/webhook/route.ts");
  const body = "{}";
  assert.equal((await route.POST(post(body, "t=1,v1=aa"))).status, 503);
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal((await route.POST(post(body, "t=1,v1=aa"))).status, 503);
});

test("route source: raw body read once, verified with constructEventAsync and SubtleCrypto, never logged", () => {
  const source = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /constructEventAsync\(/);
  assert.match(source, /createSubtleCryptoProvider\(\)/);
  assert.doesNotMatch(source, /\.constructEvent\(/, "the synchronous form throws with SubtleCrypto");
  assert.equal((source.match(/request\.text\(\)/g) ?? []).length, 1, "the body is read once");
  assert.doesNotMatch(source, /request\.(json|formData|arrayBuffer|body)\b/);
  assert.doesNotMatch(source, /console\./, "the body and the event are never logged");
  assert.deepEqual([...source.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]).sort(), ["POST", "dynamic"]);
  assert.match(source, /deliverStripeEvent/, "claim_stripe_event, the handler and finish/drop_stripe_event run through the shared delivery");
});

test("the handler modules do not import the Stripe client at run time (types only), so tests and routes share them", () => {
  for (const file of ["lib/stripe/webhook.ts", "lib/stripe/fulfill.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /^import (?!type)[^;]*from "stripe"/m, file);
    assert.doesNotMatch(source, /process\.env/, `${file} reads no environment`);
  }
});
