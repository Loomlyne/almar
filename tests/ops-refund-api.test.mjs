// Plan 05-03 Task 2: the owner's refund endpoints (lib/ops/bookings-api.ts): record a bank refund, void a refund record,
// and the refund arm of resend. A fake `rpc`, a fake notifier, a fake view loader and a fake link signer, in the style of
// tests/ops-bookings-api.test.mjs. Amounts are symbolic fixture values in fils, ids are documentation examples and every
// name in brackets stands for a real value. Written and not run (the owner's no-test rule); the SQL itself is 05-01's.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const api = await loadTs("lib/ops/bookings-api.ts");
const SOURCE = readFileSync("lib/ops/bookings-api.ts", "utf8");
const BINDINGS = readFileSync("lib/ops/bookings.ts", "utf8");

const OWNER_ID = "0b0b0b0b-0000-4000-8000-000000000001";
const BOOKING = "11111111-1111-4111-8111-111111111111";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST = "55555555-5555-4555-8555-555555555555";
const REF = "ALMAR-ABCDEF";
const REFUND = 7;
const AMOUNT = 12345;

// ---- fakes ----------------------------------------------------------------------------------------------------------

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

function fakeNotifier({ ready = true, outcome = { ok: true }, throws = false } = {}) {
  const sent = [];
  const method = (name) => async (job, opts) => {
    sent.push({ name, job, key: opts.idempotencyKey });
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
      refundReceipt: method("refundReceipt"),
    },
  };
}

function view(over = {}) {
  return {
    ref: REF,
    status: "paid_in_full",
    locale: "es",
    guest: { name: "[Guest name]", email: "[guest email]" },
    money: { paidFils: 50000, refundedFils: 0 },
    refunds: [],
    ...over,
  };
}

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

const owner = (db) => ({ profile: { id: OWNER_ID, email: "[owner email]" }, admin: db });

function flags(over = {}) {
  return {
    needs_attention: false,
    attention_reason: null,
    part_received: false,
    overpaid: false,
    written_off: false,
    settled_fils: 0,
    due_now_fils: 0,
    still_due_fils: 0,
    balance_overdue: false,
    deadline_passed: false,
    ...over,
  };
}

function recordAnswer(over = {}) {
  return {
    first_time: true,
    booking_id: BOOKING,
    ref: REF,
    refund_id: REFUND,
    amount_fils: AMOUNT,
    refunded_on: "2026-11-03",
    paid_fils: 50000,
    refunded_fils: AMOUNT,
    refundable_fils: 50000 - AMOUNT,
    attention_cleared: false,
    flags: flags(),
    is_test: true,
    locale: "ar",
    link_version: 2,
    ...over,
  };
}

function refundRow(over = {}) {
  return {
    id: REFUND,
    method: "bank_transfer",
    status: "succeeded",
    amount_fils: AMOUNT,
    refunded_on: "2026-11-03",
    bank_reference: "[bank reference]",
    reason: "[reason]",
    recorded_by: OWNER_ID,
    recorded_by_email: "[owner email]",
    created_at: "2026-11-03T08:00:00.000Z",
    void_reason: null,
    voided_at: null,
    voided_by: null,
    voided_by_email: null,
    ...over,
  };
}

function detail(over = {}) {
  return {
    id: BOOKING,
    ref: REF,
    status: "paid_in_full",
    source: "web",
    is_test: true,
    link_version: 2,
    created_at: "2026-10-19T08:00:00.000Z",
    updated_at: "2026-10-19T08:00:00.000Z",
    requested_at: "2026-10-19T08:10:00.000Z",
    hold_expires_at: null,
    deadline: null,
    plan: "full",
    flags: flags(),
    payments: [],
    refunds: [refundRow()],
    notes: [],
    events: [],
    ...over,
  };
}

const body = (over = {}) => ({
  booking_id: BOOKING,
  request_id: REQUEST,
  amount: "123.45",
  refunded_on: "2026-11-03",
  bank_reference: "[bank reference]",
  reason: "[reason]",
  ...over,
});

const throwsInvalid = (fn, field) => assert.throws(fn, (e) => e instanceof Error && e.name === "OpsInvalid" && e.field === field, field);

// ---- parseRefund ----------------------------------------------------------------------------------------------------

test("parseRefund: the happy body reads the amount to fils and keeps the other five fields", () => {
  assert.deepEqual(api.parseRefund(body()), {
    booking_id: BOOKING,
    request_id: REQUEST,
    amount_fils: 12345,
    refunded_on: "2026-11-03",
    bank_reference: "[bank reference]",
    reason: "[reason]",
  });
});

test("parseRefund: an extra key is refused", () => {
  assert.throws(() => api.parseRefund({ ...body(), stripe_refund_id: "x" }));
  assert.throws(() => api.parseRefund({ ...body(), amount_fils: 5 }));
});

test("parseRefund: 1,050.50 is read to fils and a float is never used", () => {
  assert.equal(api.parseRefund(body({ amount: "1,050.50" })).amount_fils, 105050);
  assert.equal(api.parseRefund(body({ amount: "1050" })).amount_fils, 105000);
  throwsInvalid(() => api.parseRefund(body({ amount: 123.45 })), "amount");
  throwsInvalid(() => api.parseRefund(body({ amount: 12345 })), "amount");
});

test("parseRefund: a bad amount is refused with the field amount", () => {
  for (const amount of ["", "abc", "0", "-5", "1.234", "12 AED", null, undefined]) {
    throwsInvalid(() => api.parseRefund(body({ amount })), "amount");
  }
});

test("parseRefund: a future date passes the parser (the SQL decides); a non-date does not", () => {
  assert.equal(api.parseRefund(body({ refunded_on: "2099-01-01" })).refunded_on, "2099-01-01");
  for (const refunded_on of ["03/11/2026", "2026-02-30", "", null, 5]) throwsInvalid(() => api.parseRefund(body({ refunded_on })), "refunded_on");
});

test("parseRefund: the bank reference is 1..100 characters", () => {
  assert.equal(api.parseRefund(body({ bank_reference: "x".repeat(100) })).bank_reference.length, 100);
  throwsInvalid(() => api.parseRefund(body({ bank_reference: "" })), "bank_reference");
  throwsInvalid(() => api.parseRefund(body({ bank_reference: "x".repeat(101) })), "bank_reference");
});

test("parseRefund: the reason is null when absent or null, else 3..300 characters", () => {
  const { reason: _omit, ...without } = body();
  assert.equal(api.parseRefund(without).reason, null);
  assert.equal(api.parseRefund(body({ reason: null })).reason, null);
  assert.equal(api.parseRefund(body({ reason: "abc" })).reason, "abc");
  assert.equal(api.parseRefund(body({ reason: "x".repeat(300) })).reason.length, 300);
  throwsInvalid(() => api.parseRefund(body({ reason: "ab" })), "reason");
  throwsInvalid(() => api.parseRefund(body({ reason: "x".repeat(301) })), "reason");
});

test("parseRefund: the booking and the request id must be uuids", () => {
  throwsInvalid(() => api.parseRefund(body({ booking_id: "nope" })), "booking_id");
  throwsInvalid(() => api.parseRefund(body({ request_id: 5 })), "request_id");
});

test("parseRefundVoid: refund_id a safe integer of at least 1, reason 3..300", () => {
  assert.deepEqual(api.parseRefundVoid({ refund_id: 7, reason: "[reason]" }), { refund_id: 7, reason: "[reason]" });
  for (const refund_id of [0, -1, 1.5, "7", null, undefined, Number.MAX_SAFE_INTEGER + 2]) {
    throwsInvalid(() => api.parseRefundVoid({ refund_id, reason: "[reason]" }), "refund_id");
  }
  throwsInvalid(() => api.parseRefundVoid({ refund_id: 7, reason: "ab" }), "reason");
  throwsInvalid(() => api.parseRefundVoid({ refund_id: 7, reason: "x".repeat(301) }), "reason");
  assert.throws(() => api.parseRefundVoid({ refund_id: 7, reason: "[reason]", extra: 1 }));
});

// ---- recordRefund ---------------------------------------------------------------------------------------------------

test("recordRefund: one ops_record_refund with exactly p and p_actor", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer(), error: null } });
  await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.deepEqual(db.calls[0], {
    name: "ops_record_refund",
    args: {
      p: { booking_id: BOOKING, request_id: REQUEST, amount_fils: 12345, refunded_on: "2026-11-03", bank_reference: "[bank reference]", reason: "[reason]" },
      p_actor: OWNER_ID,
    },
  });
});

test("recordRefund: the first time sends one email with key refund-receipt/<id>, date and amount only", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer(), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier });
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, d.deps);
  assert.deepEqual(n.sent.map((s) => [s.name, s.key]), [["refundReceipt", `refund-receipt/${REFUND}`]]);
  const job = n.sent[0].job;
  assert.equal(job.refundId, REFUND);
  assert.equal(job.amountFils, AMOUNT);
  assert.equal(job.refundedOn, "2026-11-03");
  assert.equal(job.isTest, true);
  assert.equal("bankReference" in job || "bank_reference" in job || "reason" in job, false, "the job never carries the bank reference or the reason");
  assert.deepEqual(d.views, [{ bookingId: BOOKING, opts: { isTest: true } }]);
  assert.deepEqual(d.links, [{ id: BOOKING, ref: REF, locale: "ar", isTest: true, linkVersion: 2 }]);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.mail, "sent");
  assert.equal(out.body.refund.refund_id, REFUND);
  const events = db.calls.filter((c) => c.name === "log_booking_event").map((c) => [c.args.p_action, c.args.p_detail.template]);
  assert.deepEqual(events, [["email_sent", "refund_receipt"]]);
});

test("recordRefund: a replay (first_time false) sends no email and answers skipped", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer({ first_time: false }), error: null } });
  const n = fakeNotifier();
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: n.notifier }).deps);
  assert.deepEqual(n.sent, []);
  assert.equal(out.body.mail, "skipped");
  assert.equal(db.names().includes("log_booking_event"), false);
});

test("recordRefund: no view answers skipped with 200 and sends nothing", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer(), error: null } });
  const n = fakeNotifier();
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: n.notifier, viewValue: null }).deps);
  assert.equal(out.status, undefined);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.mail, "skipped");
  assert.deepEqual(n.sent, []);
});

test("recordRefund: a throwing view, a throwing notifier or a failing send never fails the record", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer(), error: null } });
  const viewOut = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ viewThrows: true }).deps);
  assert.equal(viewOut.body.ok, true);
  assert.equal(viewOut.body.mail, "skipped");
  const thrown = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: fakeNotifier({ throws: true }).notifier }).deps);
  assert.equal(thrown.body.ok, true);
  assert.equal(thrown.body.mail, "failed");
  const failed = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: fakeNotifier({ outcome: { ok: false, error: "send_error" } }).notifier }).deps);
  assert.equal(failed.body.mail, "failed");
  const notReady = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: fakeNotifier({ ready: false }).notifier }).deps);
  assert.equal(notReady.body.mail, "pending");
});

test("recordRefund: an answer with a wrong type skips the mail and still replies ok", async () => {
  const db = fakeDb({ ops_record_refund: { data: recordAnswer({ refund_id: "7" }), error: null } });
  const n = fakeNotifier();
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps({ notifier: n.notifier }).deps);
  assert.equal(out.body.mail, "skipped");
  assert.deepEqual(n.sent, []);
});

test("recordRefund: above_paid, nothing_to_refund, not_voidable and changed are 409 with their code", async () => {
  for (const code of ["above_paid", "nothing_to_refund", "not_voidable", "changed"]) {
    const db = fakeDb({ ops_record_refund: refusal(code) });
    const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps().deps);
    assert.equal(out.status, 409, code);
    assert.equal(out.body.error.code, code);
  }
});

test("recordRefund: not_found is 404 and not_owner is 403", async () => {
  const missing = await api.recordRefund({ owner: owner(fakeDb({ ops_record_refund: refusal("not_found") })), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.equal(missing.status, 404);
  const stranger = await api.recordRefund({ owner: owner(fakeDb({ ops_record_refund: refusal("not_owner") })), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.equal(stranger.status, 403);
});

test("recordRefund: an invalid amount_fils from the SQL is renamed to the wire's amount", async () => {
  const db = fakeDb({ ops_record_refund: refusal("invalid", JSON.stringify({ field: "amount_fils" })) });
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.equal(out.status, 400);
  assert.equal(out.body.error.code, "invalid");
  assert.equal(out.body.error.field, "amount");
  const date = await api.recordRefund({ owner: owner(fakeDb({ ops_record_refund: refusal("invalid", JSON.stringify({ field: "refunded_on" })) })), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.equal(date.body.error.field, "refunded_on");
});

test("recordRefund: an unknown error is dbError with no database text; a non-row answer is unreadable", async () => {
  const db = fakeDb({ ops_record_refund: { data: null, error: { code: "XX000", message: "[secret database text]", details: null, hint: null } } });
  const out = await api.recordRefund({ owner: owner(db), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.ok("dbError" in out);
  const unreadable = await api.recordRefund({ owner: owner(fakeDb({ ops_record_refund: { data: "x", error: null } })), body: api.parseRefund(body()) }, fakeDeps().deps);
  assert.ok("dbError" in unreadable);
});

// ---- voidRefund -----------------------------------------------------------------------------------------------------

test("voidRefund: one ops_void_refund with p_refund, p_reason and p_actor; the reply is the row; no mail", async () => {
  const row = { first_time: true, booking_id: BOOKING, ref: REF, refund_id: REFUND, amount_fils: AMOUNT, paid_fils: 50000, refunded_fils: 0, attention_raised: false, flags: flags() };
  const db = fakeDb({ ops_void_refund: { data: row, error: null } });
  const out = await api.voidRefund({ owner: owner(db), body: api.parseRefundVoid({ refund_id: REFUND, reason: "[reason]" }) });
  assert.deepEqual(db.calls, [{ name: "ops_void_refund", args: { p_refund: REFUND, p_reason: "[reason]", p_actor: OWNER_ID } }]);
  assert.deepEqual(out, { body: { ok: true, void: row } });
  assert.equal(api.voidRefund.length <= 1, true, "the handler takes no dependencies, so it has no notifier to call");
});

test("voidRefund: not_voidable is 409, not_found 404, an unknown error dbError", async () => {
  const input = api.parseRefundVoid({ refund_id: REFUND, reason: "[reason]" });
  assert.equal((await api.voidRefund({ owner: owner(fakeDb({ ops_void_refund: refusal("not_voidable") })), body: input })).status, 409);
  assert.equal((await api.voidRefund({ owner: owner(fakeDb({ ops_void_refund: refusal("not_found") })), body: input })).status, 404);
  assert.ok("dbError" in (await api.voidRefund({ owner: owner(fakeDb({ ops_void_refund: { data: null, error: { code: "XX000", message: "[x]" } } })), body: input })));
});

// ---- resend, the refund arm -----------------------------------------------------------------------------------------

const refundResend = (over = {}) => api.parseResend({ ref: REF, kind: "refund", refund_id: REFUND, request_id: REQUEST, ...over });

test("parseResend: a refund kind needs refund_id and refuses a payment_id; the old kinds refuse a refund_id", () => {
  assert.deepEqual(refundResend(), { ref: REF, kind: "refund", refund_id: REFUND, request_id: REQUEST });
  throwsInvalid(() => api.parseResend({ ref: REF, kind: "refund", request_id: REQUEST }), "refund_id");
  throwsInvalid(() => refundResend({ refund_id: 0 }), "refund_id");
  throwsInvalid(() => refundResend({ refund_id: "7" }), "refund_id");
  throwsInvalid(() => refundResend({ payment_id: "22222222-2222-4222-8222-222222222222" }), "payment_id");
  throwsInvalid(() => api.parseResend({ ref: REF, kind: "receipt", payment_id: "22222222-2222-4222-8222-222222222222", refund_id: REFUND, request_id: REQUEST }), "refund_id");
  throwsInvalid(() => api.parseResend({ ref: REF, kind: "request", refund_id: REFUND, request_id: REQUEST }), "refund_id");
});

test("resendMail refund: the event names the refund by a number, then the refund email with key resend/<booking>/<request>", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier });
  const out = await api.resendMail({ owner: owner(db), body: refundResend() }, d.deps);
  assert.equal(db.calls[0].name, "ops_lapse_holds");
  assert.deepEqual(db.calls[1], { name: "ops_get_booking", args: { p_ref: REF } });
  assert.deepEqual(db.calls[2], {
    name: "log_booking_event",
    args: { p_booking: BOOKING, p_actor: `owner:${OWNER_ID}`, p_action: "resend_requested", p_detail: { template: "refund_receipt", refund_id: REFUND, request_id: REQUEST } },
  });
  assert.equal(typeof db.calls[2].args.p_detail.refund_id, "number");
  assert.deepEqual(d.links, [{ id: BOOKING, ref: REF, locale: "es", isTest: true, linkVersion: 2 }]);
  const key = `resend/${BOOKING}/${REQUEST}`;
  assert.deepEqual(n.sent.map((s) => [s.name, s.key]), [["refundReceipt", key]]);
  assert.equal(n.sent[0].job.refundId, REFUND);
  assert.equal(n.sent[0].job.amountFils, AMOUNT);
  assert.equal(n.sent[0].job.refundedOn, "2026-11-03");
  assert.deepEqual(out, { body: { ok: true, mail: "sent" } });
});

test("resendMail refund: a voided row is 409 not_applicable, no event and no mail", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail({ refunds: [refundRow({ status: "voided", void_reason: "[reason]" })] }), error: null } });
  const n = fakeNotifier();
  const out = await api.resendMail({ owner: owner(db), body: refundResend() }, fakeDeps({ notifier: n.notifier }).deps);
  assert.equal(out.status, 409);
  assert.equal(out.body.error.code, "not_applicable");
  assert.equal(db.names().includes("log_booking_event"), false);
  assert.deepEqual(n.sent, []);
});

test("resendMail refund: an unknown refund id, another booking's refund and an absent list are 409 not_applicable", async () => {
  for (const data of [detail({ refunds: [refundRow({ id: 99 })] }), detail({ refunds: [] }), (() => { const d = detail(); delete d.refunds; return d; })()]) {
    const db = fakeDb({ ops_get_booking: { data, error: null } });
    const n = fakeNotifier();
    const out = await api.resendMail({ owner: owner(db), body: refundResend() }, fakeDeps({ notifier: n.notifier }).deps);
    assert.equal(out.status, 409);
    assert.equal(db.names().includes("log_booking_event"), false);
    assert.deepEqual(n.sent, []);
  }
});

test("resendMail refund: the link not configured still sends, with bookingUrl null", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const n = fakeNotifier();
  const d = fakeDeps({ notifier: n.notifier, linkReady: false, url: null });
  const out = await api.resendMail({ owner: owner(db), body: refundResend() }, d.deps);
  assert.equal(out.body.mail, "sent");
  assert.equal(n.sent[0].job.bookingUrl, null);
});

test("resendMail refund: a null view is 409 not_applicable with nothing written", async () => {
  const db = fakeDb({ ops_get_booking: { data: detail(), error: null } });
  const n = fakeNotifier();
  const out = await api.resendMail({ owner: owner(db), body: refundResend() }, fakeDeps({ notifier: n.notifier, viewValue: null }).deps);
  assert.equal(out.status, 409);
  assert.equal(db.names().includes("log_booking_event"), false);
  assert.deepEqual(n.sent, []);
});

test("resendMail receipt: the old detail is unchanged byte for byte (no refund_id key)", async () => {
  const PAYMENT = "22222222-2222-4222-8222-222222222222";
  const payment = {
    id: PAYMENT, kind: "transfer", method: "bank_transfer", status: "succeeded", amount_fils: 10000, received_on: "2026-10-20", bank_reference: "[bank reference]",
    recorded_by: OWNER_ID, recorded_by_email: "[recorder email]", created_at: "2026-10-20T08:00:00.000Z", write_off_fils: 0, write_off_reason: null,
    void_reason: null, voided_at: null, voided_by: null, voided_by_email: null, card_brand: null, card_last4: null,
  };
  const db = fakeDb({ ops_get_booking: { data: detail({ payments: [payment] }), error: null } });
  await api.resendMail({ owner: owner(db), body: api.parseResend({ ref: REF, kind: "receipt", payment_id: PAYMENT, request_id: OTHER_REQUEST }) }, fakeDeps().deps);
  assert.deepEqual(db.calls[2].args.p_detail, { template: "payment_receipt", payment_id: PAYMENT, request_id: OTHER_REQUEST });
});

// ---- source rules ---------------------------------------------------------------------------------------------------

test("source: the routes and bindings have the allowed shape and the new code names no card provider", () => {
  const record = readFileSync("app/api/ops/booking/refund/route.ts", "utf8");
  const voided = readFileSync("app/api/ops/booking/refund-void/route.ts", "utf8");
  assert.match(record, /export const dynamic = "force-dynamic";\nexport const POST = opsPost\(parseRefund, postRefundRoute\);/);
  assert.match(voided, /export const dynamic = "force-dynamic";\nexport const POST = opsPost\(parseRefundVoid, postRefundVoidRoute\);/);
  assert.match(BINDINGS, /postRefundRoute/);
  assert.match(BINDINGS, /postRefundVoidRoute/);
  for (const file of [record, voided]) assert.equal(/stripe|card/i.test(file), false);
  const code = SOURCE.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
  const refundCode = code.slice(code.indexOf("export type RefundInput"));
  assert.equal(/stripe|card_|cardBrand/i.test(refundCode.slice(0, refundCode.indexOf("export type StatusBody"))), false);
  assert.equal(/re_|eyJ/.test(SOURCE), false);
});
