// Plan 04-09 Task 5: the owner's booking endpoints (lib/ops/bookings-api.ts) with a fake `rpc`, a fake notifier (04-08's
// six methods), a fake view loader and a fake link signer, driven directly and through runOps with a fake owner decide
// (the tests/ops-api-local.test.mjs pattern) for Origin, 64 KiB and the 400 field. Symbolic fils, bracket names, the
// documentation-example ids only. The SQL itself is proven on a stack by tests/ops-record-payment.db.test.mjs (Task 6).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const api = await loadTs("lib/ops/bookings-api.ts");
const { runOps } = await loadTs("lib/ops/route-core.ts");
const SOURCE = readFileSync("lib/ops/bookings-api.ts", "utf8");
const BINDINGS = readFileSync("lib/ops/bookings.ts", "utf8");

const OPS = "https://dashboard.almarprivatejourney.com";
const OWNER_ID = "0b0b0b0b-0000-4000-8000-000000000001";
const OWNER_EMAIL = "[owner email]";
const BOOKING = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const OTHER_PAYMENT = "44444444-4444-4444-8444-444444444444";
const REF = "ALMAR-ABCDEF";
const GRAND = 105000;
const DEPOSIT = 31500;

// ---- fakes ----------------------------------------------------------------------------------------------------------

/** A fake service client: records every rpc call; answers per name (a value, or a function of the args). */
function fakeDb(answers = {}) {
  const calls = [];
  return {
    calls,
    names: () => calls.map((c) => c.name),
    async rpc(name, args) {
      calls.push({ name, args });
      const answer = answers[name];
      const value = typeof answer === "function" ? answer(args) : answer;
      if (value !== undefined) return value;
      if (name === "ops_lapse_holds") return { data: 0, error: null };
      return { data: null, error: null };
    },
  };
}

const refusal = (code, details = null) => ({ data: null, error: { code: "P0001", message: `almar:${code}`, details, hint: null } });

/** Every ownerWithdrawn call of every fake notifier in this file: must stay empty (the dashboard never sends it). */
const withdrawnLog = [];

/** 04-08's six notifier methods; each records its job and key. */
function fakeNotifier({ ready = true, outcome = { ok: true }, throws = false } = {}) {
  const sent = [];
  const method = (name) => async (job, opts) => {
    sent.push({ name, job, key: opts.idempotencyKey });
    if (name === "ownerWithdrawn") withdrawnLog.push({ job, key: opts.idempotencyKey });
    if (throws) throw new Error("[sender down]");
    return outcome;
  };
  return {
    sent,
    notifier: {
      ready,
      requestReceived: method("requestReceived"),
      ownerRequest: method("ownerRequest"),
      paymentReceipt: method("paymentReceipt"),
      ownerPayment: method("ownerPayment"),
      requestLapsed: method("requestLapsed"),
      ownerWithdrawn: method("ownerWithdrawn"),
    },
  };
}

after(() => {
  assert.deepEqual(withdrawnLog, [], "the dashboard never sends the owner withdrawal notice");
});

function view(over = {}) {
  return {
    ref: REF,
    status: "awaiting_payment",
    locale: "es",
    guest: { name: "[Guest name]", email: "[guest email]" },
    stay: { slug: "[stay]", title: "[Stay title]", destinationName: "[Destination]", image: null },
    arrive: "2026-12-01",
    leave: "2026-12-04",
    nights: 3,
    adults: 2,
    children: 0,
    infants: 0,
    travellers: [],
    lines: [],
    airport: null,
    pickupAddress: null,
    plan: "deposit",
    money: { nightsFils: GRAND, addonsFils: 0, subtotalFils: GRAND, vatBp: 0, vatFils: 0, grandFils: GRAND, depositFils: DEPOSIT, balanceFils: GRAND - DEPOSIT, paidFils: 0, dueNowFils: DEPOSIT, stillDueFils: GRAND },
    holdExpiresAt: null,
    deadline: "2026-11-01T10:00:00.000Z",
    balanceDueDate: null,
    flags: { partReceived: false, overpaid: false, writtenOff: false },
    withdrawable: true,
    payments: [],
    transfer: null,
    access: null,
    ...over,
  };
}

/** deps with a recording view loader and link signer. */
function fakeDeps({ notifier = fakeNotifier().notifier, viewValue = view(), viewThrows = false, linkReady = true, url = "https://preview.almarprivatejourney.com/es/bookings/trip?ref=ALMAR-ABCDEF&t=[token]" } = {}) {
  const views = [];
  const links = [];
  return {
    views,
    links,
    deps: {
      notifier: () => notifier,
      view: async (db, bookingId, opts) => {
        views.push({ bookingId, opts });
        if (viewThrows) throw new Error("[unreadable view]");
        return viewValue;
      },
      bookingUrl: async (b) => {
        links.push(b);
        return url;
      },
      linkReady: () => linkReady,
    },
  };
}

const owner = (db) => ({ profile: { id: OWNER_ID, email: OWNER_EMAIL }, admin: db });

function flags(over = {}) {
  return {
    needs_attention: false,
    attention_reason: null,
    part_received: false,
    overpaid: false,
    written_off: false,
    settled_fils: 0,
    due_now_fils: DEPOSIT,
    still_due_fils: GRAND,
    balance_overdue: false,
    deadline_passed: false,
    ...over,
  };
}

function paymentRow(over = {}) {
  return {
    id: PAYMENT,
    kind: "transfer",
    method: "bank_transfer",
    status: "succeeded",
    amount_fils: 10000,
    received_on: "2026-10-20",
    bank_reference: "[bank reference]",
    recorded_by: OWNER_ID,
    recorded_by_email: "[recorder email]",
    created_at: "2026-10-20T08:00:00.000Z",
    write_off_fils: 0,
    write_off_reason: null,
    void_reason: null,
    voided_at: null,
    voided_by: null,
    voided_by_email: null,
    card_brand: null,
    card_last4: null,
    ...over,
  };
}

function detail(over = {}) {
  return {
    id: BOOKING,
    ref: REF,
    status: "awaiting_payment",
    source: "web",
    is_test: true,
    link_version: 2,
    created_at: "2026-10-19T08:00:00.000Z",
    updated_at: "2026-10-19T08:00:00.000Z",
    requested_at: "2026-10-19T08:10:00.000Z",
    hold_expires_at: "2026-11-01T10:00:00.000Z",
    deadline: "2026-11-01T10:00:00.000Z",
    plan: "deposit",
    flags: flags(),
    payments: [],
    notes: [],
    events: [],
    ...over,
  };
}

function recordAnswer(over = {}) {
  return {
    first_time: true,
    booking_id: BOOKING,
    ref: REF,
    payment_id: PAYMENT,
    status_before: "awaiting_payment",
    status_after: "deposit_paid",
    amount_fils: DEPOSIT,
    paid_fils: DEPOSIT,
    written_off_fils: 0,
    write_off_fils: 0,
    flags: flags({ due_now_fils: GRAND - DEPOSIT, settled_fils: DEPOSIT }),
    is_test: true,
    locale: "ar",
    link_version: 2,
    ...over,
  };
}

const paymentBody = (over = {}) => ({
  booking_id: BOOKING,
  request_id: REQUEST,
  expected_status: "awaiting_payment",
  amount: "315.00",
  received_on: "2026-10-20",
  bank_reference: "  [bank reference]  ",
  ...over,
});

const getUrl = (query) => new URL(`${OPS}/api/ops/x${query ? `?${query}` : ""}`);

function invalidField(fn, field) {
  assert.throws(fn, (e) => e.name === "OpsInvalid" && e.field === field, `field ${field}`);
}

// ---- mapBookingRefusal -----------------------------------------------------------------------------------------------

test("mapBookingRefusal: owner, not found, invalid with a plain field, the conflicts with their code", () => {
  const m = (code, details) => api.mapBookingRefusal(refusal(code, details).error);
  assert.deepEqual(m("not_owner"), { status: 403, body: { ok: false, error: { code: "not_owner", field: null, locale: null, detail: null } } });
  assert.deepEqual(m("not_found"), { status: 404, body: { ok: false, error: { code: "not_found", field: null, locale: null, detail: null } } });
  assert.deepEqual(m("invalid", '{"field":"received_on"}'), { status: 400, body: { ok: false, error: { code: "invalid", field: "received_on", locale: null, detail: null } } });
  assert.equal(m("invalid", '{"field":"Robert\'); drop"}').body.error.field, null, "only a plain dotted name is copied");
  assert.equal(m("invalid", "not json").body.error.field, null);
  assert.deepEqual(m("changed", '{"status":"deposit_paid"}'), { status: 409, body: { ok: false, error: { code: "changed", field: null, locale: null, detail: { status: "deposit_paid" } } } });
  assert.equal(m("changed", '{"status":"[made up]"}').body.error.detail, null, "a status that is not one of the eight is dropped");
  for (const code of ["not_allowed", "not_requested", "not_applicable", "nothing_to_write_off", "not_voidable", "cancel_first", "window_missing", "nights_lost"]) {
    const out = m(code, '{"floor_fils":31500,"settled_after_fils":0}');
    assert.equal(out.status, 409, code);
    assert.deepEqual(out.body.error, { code, field: null, locale: null, detail: null }, `${code}: nothing from the database copied`);
  }
});

test("mapBookingRefusal: an unknown almar code, another SQLSTATE or no error is { dbError } (503 through route-core)", () => {
  for (const error of [
    refusal("paid_request_kept").error,
    { code: "23505", message: "duplicate key value violates unique constraint", details: "[row text]" },
    { code: "P0001", message: "something else" },
  ]) {
    const out = api.mapBookingRefusal(error);
    assert.ok("dbError" in out, JSON.stringify(error));
  }
  assert.ok("dbError" in api.mapBookingRefusal(null));
});

test("a mapped refusal through runOps never carries the database message", async () => {
  const res = await runOps({
    method: "GET",
    request: new Request(`${OPS}/api/ops/booking?ref=${REF}`),
    decide: async () => ({ ok: true, owner: owner(fakeDb()) }),
    handler: async () => api.mapBookingRefusal({ code: "XX000", message: "[secret database text]", details: "[row]" }),
    nodeEnv: "production",
  });
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.equal(text.includes("secret database text"), false);
  assert.deepEqual(JSON.parse(text), { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } });
});

// ---- list and detail -------------------------------------------------------------------------------------------------

test("listBookings: an invalid query is 400 with its field and calls nothing", async () => {
  for (const [query, field] of [["status=nope", "status"], ["destination=x", "destination"], ["from=2026-12-02&to=2026-12-01", "arrive"], ["after=abc", "after"], ["limit=61", "limit"]]) {
    const db = fakeDb();
    const out = await api.listBookings({ owner: owner(db), url: getUrl(query) });
    assert.equal(out.status, 400, query);
    assert.equal(out.body.error.field, field, query);
    assert.deepEqual(db.calls, [], `${query}: no rpc`);
  }
});

test("listBookings: ops_lapse_holds first, then ops_list_bookings with listRpcArgs; items and next as the SQL answers", async () => {
  const items = [{ id: BOOKING, ref: REF, status: "awaiting_payment" }];
  const db = fakeDb({ ops_list_bookings: { data: { items, next: "30" }, error: null } });
  const out = await api.listBookings({ owner: owner(db), url: getUrl("q=%D9%A1%D9%A2&status=attention&limit=5") });
  assert.deepEqual(db.names(), ["ops_lapse_holds", "ops_list_bookings"]);
  assert.deepEqual(db.calls[1].args, { p_q: "12", p_status: "attention", p_destination: null, p_arrive_from: null, p_arrive_to: null, p_after: null, p_limit: 5 });
  assert.deepEqual(out, { body: { ok: true, items, next: "30" } });

  const all = fakeDb({ ops_list_bookings: { data: { items: [], next: null }, error: null } });
  await api.listBookings({ owner: owner(all), url: getUrl("") });
  assert.equal(all.calls[1].args.p_status, null, "status all is p_status null (abandoned holds hidden)");
});

test("listBookings: a lapse error stops before the list", async () => {
  const db = fakeDb({ ops_lapse_holds: { data: null, error: { code: "57014", message: "[timeout]" } } });
  const out = await api.listBookings({ owner: owner(db), url: getUrl("") });
  assert.ok("dbError" in out);
  assert.deepEqual(db.names(), ["ops_lapse_holds"]);
});

test("getBooking: the ref is trimmed and upper-cased; anything else is 400 field ref with no rpc", async () => {
  for (const query of ["", "ref=", "ref=ALMAR-ABCDE", "ref=ALMAR-ABCDE0", "ref=XALMAR-ABCDEF"]) {
    const db = fakeDb();
    const out = await api.getBooking({ owner: owner(db), url: getUrl(query) });
    assert.equal(out.status, 400, query);
    assert.equal(out.body.error.field, "ref");
    assert.deepEqual(db.calls, []);
  }
  const db = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const out = await api.getBooking({ owner: owner(db), url: getUrl("ref=%20almar-abcdef%20") });
  assert.deepEqual(db.names(), ["ops_lapse_holds", "ops_get_booking"]);
  assert.deepEqual(db.calls[1].args, { p_ref: REF });
  assert.deepEqual(out, { body: { ok: true, booking: detail() } });
});

test("getBooking: null is 404 not_found; a lapse error stops before the read", async () => {
  const db = fakeDb({ ops_get_booking: { data: null, error: null } });
  const out = await api.getBooking({ owner: owner(db), url: getUrl(`ref=${REF}`) });
  assert.equal(out.status, 404);
  assert.equal(out.body.error.code, "not_found");

  const failing = fakeDb({ ops_lapse_holds: { data: null, error: { code: "57014", message: "[timeout]" } } });
  assert.ok("dbError" in (await api.getBooking({ owner: owner(failing), url: getUrl(`ref=${REF}`) })));
  assert.deepEqual(failing.names(), ["ops_lapse_holds"]);
});

// ---- parsers ---------------------------------------------------------------------------------------------------------

test("parsePayment: AED text to fils through parseAedAmount; the reference trimmed; Accept as paid off by default", () => {
  assert.deepEqual(api.parsePayment(paymentBody()), {
    booking_id: BOOKING,
    request_id: REQUEST,
    expected_status: "awaiting_payment",
    amount_fils: 31500,
    received_on: "2026-10-20",
    bank_reference: "[bank reference]",
    accept_short: false,
    accept_reason: null,
  });
  assert.equal(api.parsePayment(paymentBody({ amount: "1,050.5" })).amount_fils, 105050);
  assert.equal(api.parsePayment(paymentBody({ amount: "١٠٥٠٫٥" })).amount_fils, 105050, "Arabic-Indic digits and decimal");
  const accepted = api.parsePayment(paymentBody({ accept_short: true, accept_reason: "  [bank fee]  " }));
  assert.equal(accepted.accept_short, true);
  assert.equal(accepted.accept_reason, "[bank fee]");
  assert.equal(api.parsePayment(paymentBody({ accept_short: null, accept_reason: null })).accept_short, false);
});

test("parsePayment: every bad field is named", () => {
  invalidField(() => api.parsePayment(null), "body");
  invalidField(() => api.parsePayment(paymentBody({ amount_fils: 31500 })), "amount_fils");
  invalidField(() => api.parsePayment(paymentBody({ booking_id: "x" })), "booking_id");
  invalidField(() => api.parsePayment(paymentBody({ request_id: undefined })), "request_id");
  invalidField(() => api.parsePayment(paymentBody({ expected_status: "paid" })), "expected_status");
  for (const amount of [315, "0", "0.001", "1050.505", "1.050,00", "-5", "", "10000000000.01", "1e3"]) {
    invalidField(() => api.parsePayment(paymentBody({ amount })), "amount");
  }
  invalidField(() => api.parsePayment(paymentBody({ received_on: "2026-02-30" })), "received_on");
  invalidField(() => api.parsePayment(paymentBody({ bank_reference: "   " })), "bank_reference");
  invalidField(() => api.parsePayment(paymentBody({ bank_reference: "x".repeat(101) })), "bank_reference");
  invalidField(() => api.parsePayment(paymentBody({ accept_short: "yes" })), "accept_short");
  invalidField(() => api.parsePayment(paymentBody({ accept_short: true })), "accept_reason");
  invalidField(() => api.parsePayment(paymentBody({ accept_short: true, accept_reason: "ab" })), "accept_reason");
  invalidField(() => api.parsePayment(paymentBody({ accept_short: true, accept_reason: "x".repeat(301) })), "accept_reason");
  invalidField(() => api.parsePayment(paymentBody({ accept_reason: "[bank fee]" })), "accept_reason");
});

test("parseVoid, parseStatus, parseNote, parseAttention: shapes and limits", () => {
  assert.deepEqual(api.parseVoid({ payment_id: PAYMENT, reason: " [wrong row] " }), { payment_id: PAYMENT, reason: "[wrong row]" });
  invalidField(() => api.parseVoid({ payment_id: PAYMENT, reason: "ab" }), "reason");
  invalidField(() => api.parseVoid({ payment_id: PAYMENT, reason: "x".repeat(301) }), "reason");
  invalidField(() => api.parseVoid({ payment_id: PAYMENT, reason: "[why]", extra: 1 }), "extra");

  assert.deepEqual(api.parseStatus({ booking_id: BOOKING, action: "confirm", expected_status: "deposit_paid" }), { booking_id: BOOKING, action: "confirm", expected_status: "deposit_paid" });
  invalidField(() => api.parseStatus({ booking_id: BOOKING, action: "expire", expected_status: "deposit_paid" }), "action");
  invalidField(() => api.parseStatus({ booking_id: BOOKING, action: "cancel", expected_status: "x" }), "expected_status");

  assert.deepEqual(api.parseNote({ booking_id: BOOKING, body: " [note] " }), { booking_id: BOOKING, body: "[note]" });
  invalidField(() => api.parseNote({ booking_id: BOOKING, body: "  " }), "body");
  invalidField(() => api.parseNote({ booking_id: BOOKING, body: "x".repeat(2001) }), "body");
  assert.equal(api.parseNote({ booking_id: BOOKING, body: "ب".repeat(2000) }).body.length, 2000, "Arabic counted in characters");

  assert.deepEqual(api.parseAttention({ booking_id: BOOKING, note: " [checked] " }), { booking_id: BOOKING, note: "[checked]" });
  invalidField(() => api.parseAttention({ booking_id: BOOKING, note: "ok" }), "note");
  invalidField(() => api.parseAttention({ booking_id: BOOKING, note: "x".repeat(501) }), "note");
});

test("parseResend: receipt needs payment_id, request refuses it; ref normalised; kind receipt | request only", () => {
  assert.deepEqual(api.parseResend({ ref: " almar-abcdef ", kind: "receipt", payment_id: PAYMENT, request_id: REQUEST }), { ref: REF, kind: "receipt", payment_id: PAYMENT, request_id: REQUEST });
  assert.deepEqual(api.parseResend({ ref: REF, kind: "request", request_id: REQUEST }), { ref: REF, kind: "request", payment_id: null, request_id: REQUEST });
  invalidField(() => api.parseResend({ ref: REF, kind: "receipt", request_id: REQUEST }), "payment_id");
  invalidField(() => api.parseResend({ ref: REF, kind: "request", payment_id: PAYMENT, request_id: REQUEST }), "payment_id");
  invalidField(() => api.parseResend({ ref: REF, kind: "withdrawn", request_id: REQUEST }), "kind");
  invalidField(() => api.parseResend({ ref: REF, kind: "request" }), "request_id");
  invalidField(() => api.parseResend({ ref: "ALMAR-0000", kind: "request", request_id: REQUEST }), "ref");
});

// ---- record payment --------------------------------------------------------------------------------------------------

test("recordPayment: one ops_record_payment with p and p_actor; first time -> one view, receipt and owner notice by key", async () => {
  const db = fakeDb({ ops_record_payment: { data: recordAnswer({ flags: flags({ attention_reason: "overpaid" }) }), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier });
  const body = api.parsePayment(paymentBody());
  const out = await api.recordPayment({ owner: owner(db), body }, d.deps);

  assert.deepEqual(db.calls[0], {
    name: "ops_record_payment",
    args: {
      p: { booking_id: BOOKING, request_id: REQUEST, expected_status: "awaiting_payment", amount_fils: 31500, received_on: "2026-10-20", bank_reference: "[bank reference]", accept_short: false, accept_reason: null },
      p_actor: OWNER_ID,
    },
  });
  assert.deepEqual(d.views, [{ bookingId: BOOKING, opts: { isTest: true } }]);
  assert.deepEqual(d.links, [{ id: BOOKING, ref: REF, locale: "ar", isTest: true, linkVersion: 2 }]);

  assert.deepEqual(n.sent.map((s) => [s.name, s.key]), [
    ["paymentReceipt", `receipt/${PAYMENT}`],
    ["ownerPayment", `payment-owner/${PAYMENT}`],
  ]);
  const job = n.sent[0].job;
  assert.equal(job.bookingId, BOOKING);
  assert.equal(job.paymentId, PAYMENT);
  assert.equal(job.isTest, true);
  assert.equal(job.amountFils, DEPOSIT);
  assert.equal(job.receivedOn, "2026-10-20");
  assert.equal(job.statusBefore, "awaiting_payment");
  assert.equal(job.statusAfter, "deposit_paid");
  assert.equal(job.attentionReason, "overpaid");
  assert.equal(job.recordedByEmail, OWNER_EMAIL);
  assert.match(job.bookingUrl, /^https:\/\/preview\.almarprivatejourney\.com\//);
  assert.equal(job.view.ref, REF);

  // deliverMail writes one email event per mail, with its template and key.
  const events = db.calls.filter((c) => c.name === "log_booking_event").map((c) => [c.args.p_action, c.args.p_detail.template, c.args.p_detail.key]);
  assert.deepEqual(events, [
    ["email_sent", "payment_receipt", `receipt/${PAYMENT}`],
    ["email_sent", "payment_owner", `payment-owner/${PAYMENT}`],
  ]);

  assert.equal(out.status, undefined);
  assert.equal(out.body.ok, true);
  assert.deepEqual(out.body.mail, { receipt: "sent", owner: "sent" });
  assert.equal("link_version" in out.body.payment, false, "link_version stays on the server");
  assert.equal(out.body.payment.payment_id, PAYMENT);
  assert.equal("affects_site" in out.body, false);
});

test("recordPayment: a replay (first_time false) loads no view and sends nothing", async () => {
  const db = fakeDb({ ops_record_payment: { data: recordAnswer({ first_time: false }), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier });
  const out = await api.recordPayment({ owner: owner(db), body: api.parsePayment(paymentBody()) }, d.deps);
  assert.deepEqual(db.names(), ["ops_record_payment"]);
  assert.deepEqual(d.views, []);
  assert.deepEqual(n.sent, []);
  assert.deepEqual(out.body.mail, { receipt: "skipped", owner: "skipped" });
});

test("recordPayment: a sender that is not ready -> pending twice, email_pending events, the sender never called", async () => {
  const db = fakeDb({ ops_record_payment: { data: recordAnswer(), error: null } });
  const n = fakeNotifier({ ready: false });
  const out = await api.recordPayment({ owner: owner(db), body: api.parsePayment(paymentBody()) }, fakeDeps({ notifier: n.notifier }).deps);
  assert.deepEqual(out.body.mail, { receipt: "pending", owner: "pending" });
  assert.deepEqual(n.sent, []);
  assert.deepEqual(db.calls.filter((c) => c.name === "log_booking_event").map((c) => c.args.p_action), ["email_pending", "email_pending"]);
});

test("recordPayment: a null view, a throwing view or a throwing sender never changes the 200", async () => {
  for (const [label, d, expected] of [
    ["null view", fakeDeps({ viewValue: null }), { receipt: "skipped", owner: "skipped" }],
    ["throwing view", fakeDeps({ viewThrows: true }), { receipt: "skipped", owner: "skipped" }],
    ["throwing sender", fakeDeps({ notifier: fakeNotifier({ throws: true }).notifier }), { receipt: "failed", owner: "failed" }],
    ["refusing sender", fakeDeps({ notifier: fakeNotifier({ outcome: { ok: false, error: "http_429" } }).notifier }), { receipt: "failed", owner: "failed" }],
  ]) {
    const db = fakeDb({ ops_record_payment: { data: recordAnswer(), error: null } });
    const out = await api.recordPayment({ owner: owner(db), body: api.parsePayment(paymentBody()) }, d.deps);
    assert.equal(out.body.ok, true, label);
    assert.deepEqual(out.body.mail, expected, label);
  }
  // A throwing sender is written as email_failed with error threw (the wrapper's name), never its message.
  const db = fakeDb({ ops_record_payment: { data: recordAnswer(), error: null } });
  await api.recordPayment({ owner: owner(db), body: api.parsePayment(paymentBody()) }, fakeDeps({ notifier: fakeNotifier({ throws: true }).notifier }).deps);
  const failed = db.calls.filter((c) => c.name === "log_booking_event").map((c) => c.args.p_detail);
  assert.deepEqual(failed.map((d) => d.error), ["threw", "threw"]);
  assert.equal(JSON.stringify(failed).includes("sender down"), false);
});

test("recordPayment: refusals in words; amount_fils is reported as the wire's amount", async () => {
  const changed = fakeDb({ ops_record_payment: refusal("changed", '{"status":"deposit_paid"}') });
  const out = await api.recordPayment({ owner: owner(changed), body: api.parsePayment(paymentBody()) }, fakeDeps().deps);
  assert.equal(out.status, 409);
  assert.deepEqual(out.body.error.detail, { status: "deposit_paid" });

  const amount = fakeDb({ ops_record_payment: refusal("invalid", '{"field":"amount_fils"}') });
  const bad = await api.recordPayment({ owner: owner(amount), body: api.parsePayment(paymentBody()) }, fakeDeps().deps);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.field, "amount");

  const notOwner = fakeDb({ ops_record_payment: refusal("not_owner") });
  assert.equal((await api.recordPayment({ owner: owner(notOwner), body: api.parsePayment(paymentBody()) }, fakeDeps().deps)).status, 403);
  for (const code of ["not_requested", "nothing_to_write_off", "not_applicable", "nights_lost"]) {
    const db = fakeDb({ ops_record_payment: refusal(code) });
    const n = fakeNotifier();
    const r = await api.recordPayment({ owner: owner(db), body: api.parsePayment(paymentBody()) }, fakeDeps({ notifier: n.notifier }).deps);
    assert.equal(r.status, 409, code);
    assert.equal(r.body.error.code, code);
    assert.deepEqual(n.sent, [], `${code}: no mail`);
  }
});

// ---- void, status, note, attention -----------------------------------------------------------------------------------

test("voidPayment: one ops_void_payment { p_payment, p_reason, p_actor }; no mail; cancel_first is 409", async () => {
  const answer = { first_time: true, booking_id: BOOKING, ref: REF, payment_id: PAYMENT, status_before: "awaiting_payment", status_after: "awaiting_payment", paid_fils: 0, written_off_fils: 0, deadline: "2026-11-02T10:00:00.000Z", flags: flags() };
  const db = fakeDb({ ops_void_payment: { data: answer, error: null } });
  const out = await api.voidPayment({ owner: owner(db), body: api.parseVoid({ payment_id: PAYMENT, reason: "[wrong row]" }) });
  assert.deepEqual(db.calls, [{ name: "ops_void_payment", args: { p_payment: PAYMENT, p_reason: "[wrong row]", p_actor: OWNER_ID } }]);
  assert.deepEqual(out, { body: { ok: true, voided: answer } });

  const refused = fakeDb({ ops_void_payment: refusal("cancel_first", '{"floor_fils":31500,"settled_after_fils":0}') });
  const r = await api.voidPayment({ owner: owner(refused), body: api.parseVoid({ payment_id: PAYMENT, reason: "[wrong row]" }) });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.error, { code: "cancel_first", field: null, locale: null, detail: null });
});

test("setStatus: ops_lapse_holds first, then ops_set_booking_status with p_to from the action; closed_sessions dropped", async () => {
  for (const [action, to, from] of [["confirm", "confirmed", "deposit_paid"], ["complete", "completed", "confirmed"], ["cancel", "cancelled", "awaiting_payment"]]) {
    const db = fakeDb({ ops_set_booking_status: { data: { id: BOOKING, from, to, closed_sessions: ["[session]"] }, error: null } });
    const out = await api.setStatus({ owner: owner(db), body: api.parseStatus({ booking_id: BOOKING, action, expected_status: from }) });
    assert.deepEqual(db.names(), ["ops_lapse_holds", "ops_set_booking_status"], action);
    assert.deepEqual(db.calls[1].args, { p_booking: BOOKING, p_to: to, p_expected_from: from, p_actor: OWNER_ID });
    assert.deepEqual(out, { body: { ok: true, status: { from, to } } });
  }
});

test("setStatus: changed answers 409 with the status found; a lapse error stops before the change", async () => {
  const db = fakeDb({ ops_set_booking_status: refusal("changed", '{"status":"expired"}') });
  const out = await api.setStatus({ owner: owner(db), body: api.parseStatus({ booking_id: BOOKING, action: "cancel", expected_status: "awaiting_payment" }) });
  assert.equal(out.status, 409);
  assert.deepEqual(out.body.error, { code: "changed", field: null, locale: null, detail: { status: "expired" } });

  const notAllowed = fakeDb({ ops_set_booking_status: refusal("not_allowed", '{"from":"held","to":"confirmed"}') });
  const na = await api.setStatus({ owner: owner(notAllowed), body: api.parseStatus({ booking_id: BOOKING, action: "confirm", expected_status: "held" }) });
  assert.equal(na.status, 409);
  assert.equal(na.body.error.code, "not_allowed");

  const failing = fakeDb({ ops_lapse_holds: { data: null, error: { code: "57014", message: "[timeout]" } } });
  assert.ok("dbError" in (await api.setStatus({ owner: owner(failing), body: api.parseStatus({ booking_id: BOOKING, action: "cancel", expected_status: "awaiting_payment" }) })));
  assert.deepEqual(failing.names(), ["ops_lapse_holds"]);
});

test("addNote and resolveAttention: one RPC each with p_actor", async () => {
  const notes = fakeDb({ ops_add_booking_note: { data: { id: 7, at: "2026-10-21T08:00:00.000Z" }, error: null } });
  const note = await api.addNote({ owner: owner(notes), body: api.parseNote({ booking_id: BOOKING, body: "[note]" }) });
  assert.deepEqual(notes.calls, [{ name: "ops_add_booking_note", args: { p_booking: BOOKING, p_body: "[note]", p_actor: OWNER_ID } }]);
  assert.deepEqual(note, { body: { ok: true, note: { id: 7, at: "2026-10-21T08:00:00.000Z" } } });

  const flagsDb = fakeDb({ ops_resolve_attention: { data: { first_time: true, booking_id: BOOKING, note_id: 8 }, error: null } });
  const resolved = await api.resolveAttention({ owner: owner(flagsDb), body: api.parseAttention({ booking_id: BOOKING, note: "[checked]" }) });
  assert.deepEqual(flagsDb.calls, [{ name: "ops_resolve_attention", args: { p_booking: BOOKING, p_note: "[checked]", p_actor: OWNER_ID } }]);
  assert.deepEqual(resolved, { body: { ok: true, resolved: { first_time: true, note_id: 8 } } });

  const missing = fakeDb({ ops_add_booking_note: refusal("not_found") });
  assert.equal((await api.addNote({ owner: owner(missing), body: api.parseNote({ booking_id: BOOKING, body: "[note]" }) })).status, 404);
});

// ---- resend ----------------------------------------------------------------------------------------------------------

const resendBody = (over = {}) => api.parseResend({ ref: REF, kind: "receipt", payment_id: PAYMENT, request_id: REQUEST, ...over });
const requestBody = () => api.parseResend({ ref: REF, kind: "request", request_id: REQUEST });

test("resendMail receipt: lapse first, the detail, one resend_requested event, then the receipt with key resend/<booking>/<request>", async () => {
  const booking = detail({ status: "deposit_paid", payments: [paymentRow()], flags: flags({ attention_reason: "overpaid" }) });
  const db = fakeDb({ ops_get_booking: { data: booking, error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier, viewValue: view({ status: "deposit_paid", deadline: null }) });
  const out = await api.resendMail({ owner: owner(db), body: resendBody() }, d.deps);

  assert.equal(db.calls[0].name, "ops_lapse_holds", "ops_lapse_holds is the first rpc call");
  assert.deepEqual(db.calls[1], { name: "ops_get_booking", args: { p_ref: REF } });
  assert.deepEqual(db.calls[2], {
    name: "log_booking_event",
    args: { p_booking: BOOKING, p_actor: `owner:${OWNER_ID}`, p_action: "resend_requested", p_detail: { template: "payment_receipt", payment_id: PAYMENT, request_id: REQUEST } },
  });
  const key = `resend/${BOOKING}/${REQUEST}`;
  assert.deepEqual(db.calls[3].args.p_detail, { template: "payment_receipt", key });
  assert.equal(db.calls[3].args.p_action, "email_sent");
  assert.deepEqual(d.views, [{ bookingId: BOOKING, opts: { isTest: true } }]);

  assert.deepEqual(n.sent.map((s) => [s.name, s.key]), [["paymentReceipt", key]]);
  const job = n.sent[0].job;
  assert.equal(job.paymentId, PAYMENT);
  assert.equal(job.amountFils, 10000);
  assert.equal(job.receivedOn, "2026-10-20");
  assert.equal(job.statusBefore, "deposit_paid");
  assert.equal(job.statusAfter, "deposit_paid");
  assert.equal(job.attentionReason, null);
  assert.equal(job.recordedByEmail, "[recorder email]");
  assert.deepEqual(out, { body: { ok: true, mail: "sent" } });
});

test("resendMail receipt: an unknown or voided payment is 409 not_applicable; nothing written, nothing sent", async () => {
  for (const payments of [[], [paymentRow({ id: OTHER_PAYMENT })], [paymentRow({ status: "voided" })]]) {
    const db = fakeDb({ ops_get_booking: { data: detail({ payments }), error: null } });
    const n = fakeNotifier();
    const out = await api.resendMail({ owner: owner(db), body: resendBody() }, fakeDeps({ notifier: n.notifier }).deps);
    assert.equal(out.status, 409);
    assert.equal(out.body.error.code, "not_applicable");
    assert.deepEqual(db.names(), ["ops_lapse_holds", "ops_get_booking"]);
    assert.deepEqual(n.sent, []);
  }
});

test("resendMail: an unknown ref is 404; a lapse error stops before the read", async () => {
  const db = fakeDb({ ops_get_booking: { data: null, error: null } });
  const out = await api.resendMail({ owner: owner(db), body: requestBody() }, fakeDeps().deps);
  assert.equal(out.status, 404);

  const failing = fakeDb({ ops_lapse_holds: { data: null, error: { code: "57014", message: "[timeout]" } } });
  assert.ok("dbError" in (await api.resendMail({ owner: owner(failing), body: requestBody() }, fakeDeps().deps)));
  assert.deepEqual(failing.names(), ["ops_lapse_holds"]);
});

test("resendMail request: an unpaid request before its pay-by date -> request_received with the signed link", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier });
  const out = await api.resendMail({ owner: owner(db), body: requestBody() }, d.deps);
  const key = `resend/${BOOKING}/${REQUEST}`;
  assert.deepEqual(db.calls[2].args.p_detail, { template: "request_received", payment_id: null, request_id: REQUEST });
  assert.deepEqual(n.sent.map((s) => [s.name, s.key]), [["requestReceived", key]]);
  assert.deepEqual(Object.keys(n.sent[0].job).sort(), ["bookingId", "bookingUrl", "isTest", "view"]);
  assert.match(n.sent[0].job.bookingUrl, /^https:\/\/preview\.almarprivatejourney\.com\//);
  assert.deepEqual(d.links, [{ id: BOOKING, ref: REF, locale: "es", isTest: true, linkVersion: 2 }]);
  assert.deepEqual(out, { body: { ok: true, mail: "sent" } });
});

test("resendMail request, Q-18 (owner: yes): a part-paid request past its pay-by date is sent the request email again", async () => {
  // P-09: a part-paid request never lapses; booking_view keeps it awaiting_payment with its (past) deadline.
  const booking = detail({ payments: [paymentRow()], flags: flags({ part_received: true, deadline_passed: true, needs_attention: true, attention_reason: "deadline_passed_part_paid" }) });
  const db = fakeDb({ ops_get_booking: { data: booking, error: null } });
  const n = fakeNotifier();
  const past = view({ status: "awaiting_payment", deadline: "2026-10-01T10:00:00.000Z", flags: { partReceived: true, overpaid: false, writtenOff: false } });
  const out = await api.resendMail({ owner: owner(db), body: requestBody() }, fakeDeps({ notifier: n.notifier, viewValue: past }).deps);
  assert.deepEqual(out, { body: { ok: true, mail: "sent" } });
  assert.deepEqual(n.sent.map((s) => s.name), ["requestReceived"]);
  assert.ok(db.names().includes("log_booking_event"));
});

test("resendMail request: an unpaid request past its pay-by date, a null view or a view without a deadline writes and sends nothing", async () => {
  const cases = [
    ["unpaid, deadline passed", detail({ flags: flags({ deadline_passed: true }) }), view()],
    ["not awaiting payment", detail({ status: "deposit_paid" }), view()],
    ["null view", detail(), null],
    ["view without a deadline", detail(), view({ deadline: null })],
    ["view reads expired", detail(), view({ status: "expired", deadline: null })],
  ];
  for (const [label, booking, viewValue] of cases) {
    const db = fakeDb({ ops_get_booking: { data: booking, error: null } });
    const n = fakeNotifier();
    const out = await api.resendMail({ owner: owner(db), body: requestBody() }, fakeDeps({ notifier: n.notifier, viewValue }).deps);
    assert.equal(out.status, 409, label);
    assert.equal(out.body.error.code, "not_applicable", label);
    assert.equal(db.calls[0].name, "ops_lapse_holds", label);
    assert.equal(db.names().includes("log_booking_event"), false, `${label}: no event`);
    assert.deepEqual(n.sent, [], `${label}: no mail`);
  }
});

test("resendMail receipt: a null view is 409 not_applicable with nothing written", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail({ payments: [paymentRow()] }), error: null } });
  const n = fakeNotifier();
  const out = await api.resendMail({ owner: owner(db), body: resendBody() }, fakeDeps({ notifier: n.notifier, viewValue: null }).deps);
  assert.equal(out.status, 409);
  assert.equal(db.names().includes("log_booking_event"), false);
  assert.deepEqual(n.sent, []);
});

test("resendMail request: no link secret -> 503 unavailable, nothing written; a throwing view -> 503, nothing written", async () => {
  const noLink = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier, linkReady: false });
  const out = await api.resendMail({ owner: owner(noLink), body: requestBody() }, d.deps);
  assert.equal(out.status, 503);
  assert.equal(out.body.error.code, "unavailable");
  assert.deepEqual(d.views, [], "the view is not even read");
  assert.equal(noLink.names().includes("log_booking_event"), false);

  const signFails = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const unsigned = fakeDeps({ notifier: n.notifier, url: null });
  assert.equal((await api.resendMail({ owner: owner(signFails), body: requestBody() }, unsigned.deps)).status, 503);
  assert.equal(signFails.names().includes("log_booking_event"), false);

  const throwing = fakeDb({ ops_get_booking: { data: detail({ payments: [paymentRow()] }), error: null } });
  const res = await runOps({
    method: "POST",
    request: postRequest({ ref: REF, kind: "receipt", payment_id: PAYMENT, request_id: REQUEST }),
    decide: async () => ({ ok: true, owner: owner(throwing) }),
    parse: api.parseResend,
    handler: (ctx) => api.resendMail(ctx, fakeDeps({ notifier: n.notifier, viewThrows: true }).deps),
    nodeEnv: "production",
  });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, "unavailable");
  assert.equal(throwing.names().includes("log_booking_event"), false);
  assert.deepEqual(n.sent, []);
});

test("resendMail: a sender that is not ready -> 200 pending and one email_pending event with the resend key", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail({ payments: [paymentRow()] }), error: null } });
  const n = fakeNotifier({ ready: false });
  const out = await api.resendMail({ owner: owner(db), body: resendBody() }, fakeDeps({ notifier: n.notifier }).deps);
  assert.deepEqual(out, { body: { ok: true, mail: "pending" } });
  const events = db.calls.filter((c) => c.name === "log_booking_event").map((c) => [c.args.p_action, c.args.p_detail.key ?? null]);
  assert.deepEqual(events, [["resend_requested", null], ["email_pending", `resend/${BOOKING}/${REQUEST}`]]);
  assert.deepEqual(n.sent, []);
});

// ---- through runOps (the wrapper the routes use) -----------------------------------------------------------------------

function postRequest(body, headers = {}) {
  return new Request(`${OPS}/api/ops/booking/payment`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: OPS, host: "dashboard.almarprivatejourney.com", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let paymentSiteCalls = 0;
async function postPayment(request, db) {
  const res = await runOps({
    method: "POST",
    request,
    decide: async () => ({ ok: true, owner: owner(db) }),
    parse: api.parsePayment,
    handler: (ctx) => api.recordPayment(ctx, fakeDeps().deps),
    afterWrite: async () => { paymentSiteCalls += 1; return {}; },
    nodeEnv: "production",
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

test("through runOps: another Origin is 403, 70 KB is 413, a bad amount is 400 field amount; none reaches the RPC", async () => {
  for (const [request, status, code] of [
    [postRequest(paymentBody(), { origin: "https://evil.example" }), 403, "wrong_origin"],
    [postRequest(JSON.stringify({ ...paymentBody(), bank_reference: "x".repeat(70_000) })), 413, "too_large"],
    [postRequest(paymentBody({ amount: "1050.505" })), 400, "invalid"],
  ]) {
    const db = fakeDb();
    const out = await postPayment(request, db);
    assert.equal(out.status, status, code);
    assert.equal(out.body.error.code, code);
    assert.deepEqual(db.calls, [], `${code}: no rpc`);
  }
  const bad = await postPayment(postRequest(paymentBody({ amount: "1050.505" })), fakeDb());
  assert.equal(bad.body.error.field, "amount");
});

test("through runOps: a recording answers 200 JSON no-store with the payment and its mail", async () => {
  const db = fakeDb({ ops_record_payment: { data: recordAnswer(), error: null } });
  const out = await postPayment(postRequest(paymentBody()), db);
  assert.equal(out.status, 200);
  assert.equal(out.headers.get("cache-control"), "no-store");
  assert.equal(out.body.ok, true);
  assert.deepEqual(out.body.mail, { receipt: "sent", owner: "sent" });
  assert.equal("site" in out.body, false, "no site update: affects_site is never set");
  assert.equal(paymentSiteCalls, 0, "afterWrite is wired and never called");
});

test("through runOps: GET detail with a bad ref is 400 field ref", async () => {
  const url = `${OPS}/api/ops/booking?ref=nope`;
  const db = fakeDb();
  const res = await runOps({
    method: "GET",
    request: new Request(url),
    decide: async () => ({ ok: true, owner: owner(db) }),
    handler: ({ owner: o }) => api.getBooking({ owner: o, url: new URL(url) }),
    nodeEnv: "production",
  });
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).error, { code: "invalid", field: "ref", locale: null, detail: null });
  assert.deepEqual(db.calls, []);
});

// ---- source rules ----------------------------------------------------------------------------------------------------

test("source: bookings-api imports no Next and no Supabase at runtime, reads no environment, logs nothing, writes by RPC only", () => {
  assert.equal(/from "next|from "react/.test(SOURCE), false, "no Next import");
  assert.equal(/^import\s+(?!type\b)[^;]*from "@supabase/m.test(SOURCE), false, "no runtime Supabase import");
  assert.equal(/process\.env|SERVICE_ROLE|createSupabaseAdmin/.test(SOURCE), false, "no environment, no key, no admin client");
  assert.equal(/console\./.test(SOURCE), false, "no logging");
  assert.equal(/\.(from|insert|update|upsert|delete)\(/.test(SOURCE), false, "writes are RPCs only");
  assert.equal(/affects_site/.test(SOURCE.replace(/^\s*\/\/.*$/gm, "")), false, "no reply sets affects_site");
  assert.ok((SOURCE.match(/rpc\("ops_lapse_holds"/g) ?? []).length >= 4, "ops_lapse_holds inline in list, detail, status and resend");
  const f09 = ["r", "e_"].join("");
  assert.equal(SOURCE.includes(f09) || BINDINGS.includes(f09), false, "F-09");
});

test("source: nothing in the dashboard sends the owner withdrawal notice", () => {
  for (const [name, src] of [["lib/ops/bookings-api.ts", SOURCE], ["lib/ops/bookings.ts", BINDINGS]]) {
    assert.equal(/ownerWithdrawn|withdrawn-owner\/|request_withdrawn_owner/.test(src), false, name);
  }
});

test("source: the bindings use the real seam, view and link, and read no environment", () => {
  assert.match(BINDINGS, /notifier: getNotifier/);
  assert.match(BINDINGS, /bookingViewById\(/);
  assert.match(BINDINGS, /linkReady: bookingLinkConfigured/);
  assert.match(BINDINGS, /signBookingLink\(/);
  assert.equal(/process\.env|SERVICE_ROLE|createSupabaseAdmin|console\./.test(BINDINGS), false);
  for (const name of ["getBookingsRoute", "getBookingRoute", "postPaymentRoute", "postVoidRoute", "postStatusRoute", "postNoteRoute", "postAttentionRoute", "postResendRoute"]) {
    assert.match(BINDINGS, new RegExp(`export const ${name} =`), name);
  }
});

test("source: the eight route files are opsGet / opsPost over lib/ops/bookings", () => {
  const routes = {
    bookings: ["GET", "getBookingsRoute"],
    booking: ["GET", "getBookingRoute"],
    "booking/payment": ["POST", "postPaymentRoute"],
    "booking/void": ["POST", "postVoidRoute"],
    "booking/status": ["POST", "postStatusRoute"],
    "booking/note": ["POST", "postNoteRoute"],
    "booking/attention": ["POST", "postAttentionRoute"],
    "booking/resend": ["POST", "postResendRoute"],
  };
  for (const [path, [method, binding]] of Object.entries(routes)) {
    const src = readFileSync(`app/api/ops/${path}/route.ts`, "utf8");
    assert.match(src, /^export const dynamic = "force-dynamic";$/m, path);
    if (method === "GET") {
      assert.match(src, new RegExp(`^export const GET = opsGet\\(${binding}\\);$`, "m"), path);
      assert.equal(/export const POST/.test(src), false, `${path}: GET only`);
    } else {
      assert.match(src, new RegExp(`^export const POST = opsPost\\(parse\\w+, ${binding}\\);$`, "m"), path);
      assert.equal(/export const GET/.test(src), false, `${path}: POST only`);
    }
    for (const m of src.matchAll(/from "([^"]+)"/g)) assert.match(m[1], /^(\.\.\/)+lib\/ops\/(route|bookings)$/, `${path}: ${m[1]}`);
  }
});
