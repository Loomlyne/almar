// The Stripe flow end to end on a real local database (plan 04-04): the real hold, pay, status, release and webhook route
// handlers, called with real Request objects, against this worktree's own local Supabase stack, with only Stripe's API
// faked (tests/helpers/fake-stripe.mjs; no key, no network). It proves what the fake-database tests cannot: that every RPC
// the Stripe code calls exists with the argument names and answers the TypeScript reads, that one payment is recorded
// once however often it is announced, that a refresh never opens a second session, and that a late payment is flagged,
// never dropped. Needs `node tests/helpers/local-supabase.mjs start`. Without a stack the cases are skipped with a printed
// reason; with ALMAR_REQUIRE_STACK=1 a missing stack fails. It removes what it made and restores the one setting it changes.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { acquireStackLock, requireStack } from "./helpers/local-supabase.mjs";
import { loadRoute } from "./helpers/load-route.mjs";
import { installFakeStripe } from "./helpers/fake-stripe.mjs";

const ORIGIN = "https://preview.almarprivatejourney.com";
const HOST = "preview.almarprivatejourney.com";
const LINK_SECRET = "flow-test-secret-".padEnd(48, "f");
const WEBHOOK_SECRET = "whsec_flow_test_only_value";
const NAMES = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BOOKING_LINK_SECRET", "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"];
const SAVED = Object.fromEntries(NAMES.map((k) => [k, process.env[k]]));
let state = null;
let releaseStackLock = null;
let savedBalanceDays;

function dubaiDay(offset) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

async function waitReady(admin) {
  for (let i = 0, good = 0; i < 120 && good < 3; i += 1) {
    const r = await admin.rpc("booking_context", { p_stay_slug: "ready-probe", p_from: null, p_to: null, p_locale: "en" });
    if (!r.error) { good += 1; await new Promise((x) => setTimeout(x, 300)); continue; }
    good = 0;
    await new Promise((x) => setTimeout(x, 500));
  }
}

async function seed(t) {
  if (state) return state;
  const stack = requireStack(t);
  if (!stack) return null;
  assert.match(stack.url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "this test only talks to a local stack");
  releaseStackLock = await acquireStackLock();
  process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceKey;
  process.env.BOOKING_LINK_SECRET = LINK_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_flow_test_only_value";
  process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_flow_test_only_value";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const fake = installFakeStripe();
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await waitReady(admin);
  const settings = await admin.from("site_settings").select("balance_due_days").eq("id", 1).single();
  assert.ifError(settings.error);
  savedBalanceDays = settings.data.balance_due_days;
  assert.ifError((await admin.from("site_settings").update({ balance_due_days: 14 }).eq("id", 1)).error);

  const suffix = randomUUID().slice(0, 8);
  const ids = { destination: randomUUID(), stay: randomUUID() };
  let r = await admin.from("destinations").insert({ id: ids.destination, slug: `flow-dest-${suffix}`, is_published: true });
  assert.ifError(r.error);
  r = await admin.from("stays").insert({ id: ids.stay, slug: `flow-stay-${suffix}`, destination_id: ids.destination, max_guests: 6, min_nights: 1, base_nightly_rate_aed: 1000, is_published: true });
  assert.ifError(r.error);
  state = {
    admin, fake, ids, slug: `flow-stay-${suffix}`,
    hold: await loadRoute("app/api/booking/hold/route.ts"),
    pay: await loadRoute("app/api/booking/pay/route.ts"),
    status: await loadRoute("app/api/booking/status/route.ts"),
    release: await loadRoute("app/api/booking/release/route.ts"),
    webhook: await loadRoute("app/api/stripe/webhook/route.ts"),
  };
  return state;
}

after(async () => {
  state?.fake.restore();
  try {
    if (state) {
      await state.admin.from("site_settings").update({ balance_due_days: savedBalanceDays }).eq("id", 1);
      await state.admin.from("bookings").delete().eq("stay_id", state.ids.stay);
      await state.admin.from("stays").delete().eq("id", state.ids.stay);
      await state.admin.from("destinations").delete().eq("id", state.ids.destination);
    }
  } finally {
    for (const [name, value] of Object.entries(SAVED)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    releaseStackLock?.();
  }
});

const visitor = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const email = () => `flow-${randomUUID().slice(0, 8)}@example.com`;

function post(handler, body) {
  return handler.POST(new Request(`${ORIGIN}/api/booking/x`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: HOST, "x-forwarded-for": visitor() },
    body: JSON.stringify(body),
  }));
}

const holdBody = (s, offset, plan, guest = email()) => ({
  stay: s.slug, from: dubaiDay(offset), to: dubaiDay(offset + 3), adults: 2, children: 0, infants: 0, addons: [], plan, locale: "en",
  contact: { name: "Flow Guest", email: guest, phone: "+971 50 123 4567" },
  travellers: [{ kind: "adult", fullName: "Flow Guest", isBooker: true, notStaying: false }, { kind: "adult", fullName: "Other Adult", isBooker: false, notStaying: false }],
  airport: "DXB",
  termsAccepted: true,
});

async function holdOk(s, offset, plan) {
  const res = await post(s.hold, holdBody(s, offset, plan));
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}

const booking = async (s, ref) => (await s.admin.from("bookings").select("*").eq("ref", ref).single()).data;
const payments = async (s, bookingId) => (await s.admin.from("booking_payments").select("*").eq("booking_id", bookingId).order("created_at")).data;

let eventCounter = 0;
async function deliver(s, type, object, id = `evt_flow_${randomUUID().replace(/-/g, "").slice(0, 16)}_${eventCounter++}`) {
  const payload = JSON.stringify({ id, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const res = await s.webhook.POST(new Request(`${ORIGIN}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
  return { status: res.status, id, text: await res.text() };
}

async function paidBooking(s, offset, plan) {
  const held = await holdOk(s, offset, plan);
  const sessionId = held.checkout.sessionId;
  const { intent, charge } = s.fake.markPaid(sessionId);
  const out = await deliver(s, "checkout.session.completed", s.fake.object(sessionId));
  assert.equal(out.status, 200, out.text);
  return { ref: held.ref, token: held.linkToken, sessionId, intent, charge };
}

test("hold: the open payment is the stored amount, the session carries the payment id as its idempotency key", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3000, "full");
  const b = await booking(s, held.ref);
  const rows = await payments(s, b.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "open");
  assert.equal(rows[0].kind, "full");
  assert.equal(Number(rows[0].amount_fils), Number(b.grand_fils));
  assert.equal(rows[0].checkout_session_id, held.checkout.sessionId);
  const create = s.fake.calls("create").filter((c) => c.form.client_reference_id === b.id);
  assert.equal(create.length, 1);
  assert.equal(create[0].idempotencyKey, `cs-create:${rows[0].id}`);
  assert.equal(Number(create[0].form["line_items[0][price_data][unit_amount]"]), Number(b.grand_fils));
  assert.equal(create[0].form.currency, "aed");
  assert.equal(create[0].form["payment_method_types[0]"], "card");
  assert.equal(create[0].form["adaptive_pricing[enabled]"], "true");
  assert.equal(create[0].form.ui_mode, "elements");
  assert.equal(create[0].form["metadata[ref]"], held.ref);
  assert.equal("locale" in create[0].form, false);
  assert.ok(Number(create[0].form.expires_at) * 1000 >= Date.parse(b.hold_expires_at) + 59_000, "the session outlasts the hold by a minute");
  assert.ok(create[0].form.return_url.startsWith(`${ORIGIN}/bookings/trip?ref=${held.ref}&t=${held.linkToken}&session_id=`));
});

test("webhook: a paid session is recorded once, however many times it is announced, then the status check agrees", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const paid = await paidBooking(s, 3100, "full");
  const b = await booking(s, paid.ref);
  assert.equal(b.status, "paid_in_full");
  assert.equal(Number(b.paid_fils), Number(b.grand_fils));
  assert.equal(b.needs_attention, false);
  const [row] = await payments(s, b.id);
  assert.equal(row.status, "succeeded");
  assert.equal(row.payment_intent_id, paid.intent);
  assert.equal(row.card_brand, "visa");
  assert.equal(row.card_last4, "4242");
  assert.equal(row.charge_id, paid.charge);
  const nights = await s.admin.from("booking_nights").select("expires_at").eq("booking_id", b.id);
  assert.equal(nights.data.length, 3);
  assert.ok(nights.data.every((n) => n.expires_at === null), "the nights are permanent once paid");

  // The same event again, and a second event about the same session: nothing is counted twice.
  const first = await s.admin.from("stripe_events").select("id, processed_at").like("id", "evt_flow_%").order("received_at", { ascending: false }).limit(1);
  assert.ok(first.data[0].processed_at, "the event was finished");
  const replay = await deliver(s, "checkout.session.completed", s.fake.object(paid.sessionId), first.data[0].id);
  assert.equal(replay.status, 200);
  const other = await deliver(s, "checkout.session.completed", s.fake.object(paid.sessionId));
  assert.equal(other.status, 200);
  const after = await booking(s, paid.ref);
  assert.equal(Number(after.paid_fils), Number(b.grand_fils));
  const events = await s.admin.from("booking_events").select("action").eq("booking_id", b.id).eq("action", "payment");
  assert.equal(events.data.length, 1, "one payment event");

  // The return page's status check: paid, nothing more in the answer.
  const status = await s.status.GET(new Request(`${ORIGIN}/api/booking/status?session_id=${paid.sessionId}`));
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { status: "paid" });
  assert.equal(Number((await booking(s, paid.ref)).paid_fils), Number(b.grand_fils));
});

test("webhook: an unpaid completed session changes nothing; a session we do not know is 500 and is not remembered (Stripe retries)", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3200, "full");
  const unpaid = await deliver(s, "checkout.session.completed", { ...s.fake.object(held.checkout.sessionId), payment_status: "unpaid" });
  assert.equal(unpaid.status, 200);
  assert.equal((await booking(s, held.ref)).status, "held");

  const stranger = await deliver(s, "checkout.session.completed", { id: "cs_test_strangerSession0001", object: "checkout.session", payment_status: "paid", payment_intent: "pi_test_stranger0001", amount_total: 100000, currency: "aed" });
  assert.equal(stranger.status, 500);
  const remembered = await s.admin.from("stripe_events").select("id").eq("id", stranger.id);
  assert.deepEqual(remembered.data, [], "the failed claim was dropped so the retry runs");
});

test("webhook: a bad signature is 400 and touches nothing", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const payload = JSON.stringify({ id: "evt_flow_badsig", object: "event", type: "checkout.session.completed", data: { object: {} } });
  const res = await s.webhook.POST(new Request(`${ORIGIN}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body: payload }));
  assert.equal(res.status, 400);
  assert.deepEqual((await s.admin.from("stripe_events").select("id").eq("id", "evt_flow_badsig")).data, []);
});

test("deposit, then the balance through the same checkout; a second tab never leaves two open sessions", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const paid = await paidBooking(s, 3300, "deposit");
  let b = await booking(s, paid.ref);
  assert.equal(b.status, "deposit_paid");
  assert.equal(Number(b.paid_fils), Number(b.deposit_fils));
  const due = Number(b.grand_fils) - Number(b.paid_fils);

  assert.deepEqual(await (await post(s.pay, { ref: paid.ref, t: "A".repeat(43) })).json(), { ok: false }, "a wrong token is a plain 404");
  const wrong = await post(s.pay, { ref: paid.ref, t: "A".repeat(43) });
  assert.equal(wrong.status, 404);

  const one = await post(s.pay, { ref: paid.ref, t: paid.token });
  const first = await one.json();
  assert.equal(one.status, 200, JSON.stringify(first));
  assert.equal(first.kind, "balance");
  assert.equal(first.amountFils, due);
  assert.equal(first.publishableKey, "pk_test_flow_test_only_value");
  assert.notEqual(first.sessionId, paid.sessionId);

  // A second tab: a new session, the first one expired at Stripe, still exactly one open payment.
  const two = await post(s.pay, { ref: paid.ref, t: paid.token });
  const second = await two.json();
  assert.equal(two.status, 200, JSON.stringify(second));
  assert.notEqual(second.sessionId, first.sessionId);
  assert.equal(s.fake.sessions.get(first.sessionId).status, "expired", "the earlier session was closed at Stripe first");
  const open = (await payments(s, b.id)).filter((p) => p.status === "open");
  assert.equal(open.length, 1);
  assert.equal(open[0].checkout_session_id, second.sessionId);
  const balanceCreate = s.fake.calls("create").find((c) => c.form["metadata[kind]"] === "balance" && c.form["metadata[payment_id]"] === open[0].id);
  assert.equal(balanceCreate.idempotencyKey, `cs-create:${open[0].id}`);
  assert.ok(Math.abs(Number(balanceCreate.form.expires_at) - (Date.now() / 1000 + 3600)) < 120, "a balance session lasts an hour");

  s.fake.markPaid(second.sessionId);
  assert.equal((await deliver(s, "checkout.session.completed", s.fake.object(second.sessionId))).status, 200);
  b = await booking(s, paid.ref);
  assert.equal(b.status, "paid_in_full");
  assert.equal(Number(b.paid_fils), Number(b.grand_fils));

  const done = await post(s.pay, { ref: paid.ref, t: paid.token });
  assert.equal(done.status, 409);
  assert.deepEqual((await done.json()).reasons, [{ code: "not_payable" }]);
});

test("pay: a held booking gets its own open session back on refresh, with no second session", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3400, "full");
  const before = s.fake.calls("create").length;
  const res = await post(s.pay, { ref: held.ref, t: held.linkToken });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.sessionId, held.checkout.sessionId);
  assert.equal(body.clientSecret, held.checkout.clientSecret);
  assert.equal(body.kind, "full");
  assert.equal(s.fake.calls("create").length, before, "no new session was made");
  const b = await booking(s, held.ref);
  assert.equal((await payments(s, b.id)).filter((p) => p.status === "open").length, 1);
});

test("release: the guest's session is expired at Stripe and the nights are free", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3500, "full");
  const res = await post(s.release, { ref: held.ref, t: held.linkToken });
  assert.equal(res.status, 200);
  assert.equal(s.fake.sessions.get(held.checkout.sessionId).status, "expired");
  const b = await booking(s, held.ref);
  assert.equal(b.status, "expired");
  assert.equal((await s.admin.from("booking_nights").select("night").eq("booking_id", b.id)).data.length, 0);
  const again = await holdOk(s, 3500, "full");
  assert.ok(again.ref, "the same nights can be held again");
});

test("webhook: an expired session ends its hold early", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3600, "full");
  s.fake.sessions.get(held.checkout.sessionId).status = "expired";
  const out = await deliver(s, "checkout.session.expired", s.fake.object(held.checkout.sessionId));
  assert.equal(out.status, 200);
  assert.equal((await booking(s, held.ref)).status, "expired");
  const [row] = await payments(s, (await booking(s, held.ref)).id);
  assert.equal(row.status, "expired");
});

test("webhook: a payment that lands after the hold was released is recorded and flagged for the owner, never dropped", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await holdOk(s, 3700, "full");
  assert.equal((await post(s.release, { ref: held.ref, t: held.linkToken })).status, 200);
  s.fake.markPaid(held.checkout.sessionId);
  const out = await deliver(s, "checkout.session.completed", s.fake.object(held.checkout.sessionId));
  assert.equal(out.status, 200);
  const b = await booking(s, held.ref);
  assert.equal(b.needs_attention, true);
  assert.equal(Number(b.paid_fils), Number(b.grand_fils), "the money is recorded");
  const flagged = await s.admin.from("booking_events").select("detail").eq("booking_id", b.id).eq("action", "needs_attention");
  assert.equal(flagged.data[0].detail.reason, "paid_after_expiry");
});

test("webhook: refunds and disputes made in Stripe's dashboard are recorded on the booking (O-01)", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const paid = await paidBooking(s, 3800, "full");
  const b = await booking(s, paid.ref);
  const refund = { id: `re_flow_${randomUUID().slice(0, 8)}`, amount: 10000, status: "succeeded" };
  const charge = { id: paid.charge, object: "charge", payment_intent: paid.intent, amount: Number(b.grand_fils), amount_refunded: 10000, refunds: { data: [refund], has_more: false } };
  assert.equal((await deliver(s, "charge.refunded", charge)).status, 200);
  assert.equal((await deliver(s, "charge.refunded", charge)).status, 200, "a second event about the same refund");
  const refunds = await s.admin.from("booking_refunds").select("stripe_refund_id, amount_fils, status, booking_id").eq("booking_id", b.id);
  assert.deepEqual(refunds.data.map((r) => [r.stripe_refund_id, Number(r.amount_fils), r.status]), [[refund.id, 10000, "succeeded"]]);

  const unknown = await deliver(s, "charge.refunded", { ...charge, id: "ch_test_nobody0001", payment_intent: "pi_test_nobody0001" });
  assert.equal(unknown.status, 500, "a charge we do not know yet: Stripe retries");

  const dispute = { id: `dp_flow_${randomUUID().slice(0, 8)}`, object: "dispute", amount: Number(b.grand_fils), charge: paid.charge, payment_intent: paid.intent, reason: "fraudulent", status: "needs_response" };
  assert.equal((await deliver(s, "charge.dispute.created", dispute)).status, 200);
  assert.equal((await deliver(s, "charge.dispute.closed", { ...dispute, status: "won" })).status, 200);
  const disputes = await s.admin.from("booking_disputes").select("stripe_dispute_id, status, reason").eq("booking_id", b.id);
  assert.deepEqual(disputes.data.map((d) => [d.stripe_dispute_id, d.status, d.reason]), [[dispute.id, "won", "fraudulent"]]);
  const events = await s.admin.from("booking_events").select("action").eq("booking_id", b.id).in("action", ["refund", "dispute"]);
  assert.deepEqual(events.data.map((e) => e.action).sort(), ["dispute", "dispute", "refund"]);
});

test("status: an unknown or malformed session id is 404 or 400, and nothing about a booking is ever in the answer", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const bad = await s.status.GET(new Request(`${ORIGIN}/api/booking/status?session_id=nope`));
  assert.equal(bad.status, 400);
  const missing = await s.status.GET(new Request(`${ORIGIN}/api/booking/status?session_id=cs_test_doesNotExist0001`));
  assert.equal(missing.status, 404);
  const held = await holdOk(s, 3900, "full");
  const open = await s.status.GET(new Request(`${ORIGIN}/api/booking/status?session_id=${held.checkout.sessionId}`));
  assert.deepEqual(await open.json(), { status: "open" });
  assert.equal((await s.status.GET(new Request(`${ORIGIN}/api/booking/status`))).status, 400);
  assert.equal(s.status.POST, undefined);
});
