// Phase 5 plan 05-01 Task 2: the refund rules of lib/ops/booking-rules.ts (P5-06, P5-07, B-25, B-31): refundableFils,
// canRefund, canVoidRefund, refundPreview, refundMail, and the optional refundedFils of settlePreview and voidPreview.
// WRITTEN, NOT RUN under the owner's no-test rule (2026-10-21); the controller runs it.
// They mirror ops_record_refund / ops_void_refund / ops_record_payment / ops_void_payment of 20261031120000_ops_os.sql.
// Every amount is a symbolic test value in fils (a 105000 total, a 31500 deposit), not a real price or fee.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const r = await loadTs("lib/ops/booking-rules.ts");

const BOOKING = "11111111-1111-4111-8111-111111111111";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST = "55555555-5555-4555-8555-555555555555";

const GRAND = 105000;
const DEPOSIT = 31500;

test("refundableFils is paid minus refunded and never below 0", () => {
  assert.equal(r.refundableFils(105000, 0), 105000);
  assert.equal(r.refundableFils(105000, 5000), 100000);
  assert.equal(r.refundableFils(105000, 105000), 0);
  assert.equal(r.refundableFils(0, 0), 0);
  assert.equal(r.refundableFils(1000, 2000), 0);
});

test("canRefund is true on every status while paid minus refunded is above 0", () => {
  assert.equal(r.canRefund({ paid_fils: 31500, refunded_fils: 0 }), true);
  assert.equal(r.canRefund({ paid_fils: 31500, refunded_fils: 31499 }), true);
  assert.equal(r.canRefund({ paid_fils: 31500, refunded_fils: 31500 }), false);
  assert.equal(r.canRefund({ paid_fils: 0, refunded_fils: 0 }), false);
  // The rule takes no status: expired and cancelled bookings with late money are covered (P5-07).
  assert.equal(r.canRefund.length, 1);
});

test("canVoidRefund is true only for a succeeded row", () => {
  assert.equal(r.canVoidRefund({ status: "succeeded" }), true);
  assert.equal(r.canVoidRefund({ status: "voided" }), false);
});

const refund = (over = {}) => ({
  status: "deposit_paid",
  grandFils: GRAND,
  paidFils: DEPOSIT,
  refundedFils: 0,
  attentionReason: null,
  amountFils: 10000,
  ...over,
});

test("refundPreview: nothing left is nothing_to_refund", () => {
  const p = r.refundPreview(refund({ paidFils: 0, amountFils: 1 }));
  assert.equal(p.refusal, "nothing_to_refund");
  assert.equal(p.refundableFils, 0);
  assert.equal(p.refundedAfterFils, 0);
  const all = r.refundPreview(refund({ refundedFils: DEPOSIT, amountFils: 1 }));
  assert.equal(all.refusal, "nothing_to_refund");
  assert.equal(all.refundedAfterFils, DEPOSIT);
});

test("refundPreview: above paid minus refunded is above_paid, and the exact amount is allowed", () => {
  const over = r.refundPreview(refund({ refundedFils: 1000, amountFils: DEPOSIT - 1000 + 1 }));
  assert.equal(over.refusal, "above_paid");
  assert.equal(over.refundableFils, DEPOSIT - 1000);
  assert.equal(over.refundedAfterFils, 1000, "a refusal changes nothing");
  const exact = r.refundPreview(refund({ refundedFils: 1000, amountFils: DEPOSIT - 1000 }));
  assert.equal(exact.refusal, null);
  assert.equal(exact.refundedAfterFils, DEPOSIT);
  assert.equal(exact.netPaidAfterFils, 0);
});

test("refundPreview: the status after is always the status given (P5-06)", () => {
  for (const status of ["awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"]) {
    assert.equal(r.refundPreview(refund({ status })).statusAfter, status, status);
  }
  // Even refunding everything does not move a booking.
  assert.equal(r.refundPreview(refund({ status: "confirmed", amountFils: DEPOSIT })).statusAfter, "confirmed");
});

test("refundPreview: overpaid clears once paid minus refunded is within the total", () => {
  const base = { status: "paid_in_full", paidFils: 140000, attentionReason: "overpaid" };
  const part = r.refundPreview(refund({ ...base, amountFils: 10000 })); // net 130000 > 105000
  assert.equal(part.overpaidAfter, true);
  assert.equal(part.attentionCleared, false);
  const edge = r.refundPreview(refund({ ...base, amountFils: 35000 })); // net 105000 = total
  assert.equal(edge.overpaidAfter, false);
  assert.equal(edge.attentionCleared, true);
  assert.equal(edge.netPaidAfterFils, GRAND);
});

test("refundPreview: money on an expired or cancelled booking clears only at 0", () => {
  for (const reason of ["paid_after_expiry", "paid_after_cancel"]) {
    const status = reason === "paid_after_expiry" ? "expired" : "cancelled";
    const part = r.refundPreview(refund({ status, attentionReason: reason, amountFils: DEPOSIT - 1 }));
    assert.equal(part.attentionCleared, false, `${reason} part`);
    const all = r.refundPreview(refund({ status, attentionReason: reason, amountFils: DEPOSIT }));
    assert.equal(all.attentionCleared, true, `${reason} all`);
    assert.equal(all.statusAfter, status);
  }
});

test("refundPreview: deadline_passed_part_paid is kept, and a refusal clears nothing", () => {
  const kept = r.refundPreview(refund({ status: "awaiting_payment", attentionReason: "deadline_passed_part_paid", amountFils: DEPOSIT }));
  assert.equal(kept.attentionCleared, false);
  const refused = r.refundPreview(refund({ attentionReason: "overpaid", paidFils: 0, amountFils: 1 }));
  assert.equal(refused.attentionCleared, false);
});

// settlePreview and voidPreview: refundedFils is optional and defaults to 0, so existing callers answer as before.

const settle = (over = {}) => ({
  status: "deposit_paid",
  plan: "deposit",
  grandFils: GRAND,
  depositFils: DEPOSIT,
  paidFils: DEPOSIT,
  writtenOffFils: 0,
  attentionReason: null,
  amountFils: 10000,
  acceptShort: false,
  ...over,
});

test("settlePreview with refundedFils omitted answers exactly as with 0", () => {
  for (const over of [{}, { status: "expired", paidFils: 0 }, { amountFils: 200000 }, { acceptShort: true, status: "awaiting_payment", paidFils: 0 }]) {
    assert.deepEqual(r.settlePreview(settle(over)), r.settlePreview(settle({ ...over, refundedFils: 0 })), JSON.stringify(over));
  }
});

test("settlePreview: overpaid reads paid minus refunded above the total", () => {
  const plain = r.settlePreview(settle({ paidFils: 100000, amountFils: 20000 })); // paid 120000 > 105000
  assert.equal(plain.overpaidFils, 15000);
  assert.equal(plain.attention, "overpaid");
  const netted = r.settlePreview(settle({ paidFils: 100000, amountFils: 20000, refundedFils: 15000 })); // net 105000
  assert.equal(netted.overpaidFils, 0);
  assert.equal(netted.attention, null);
  const one = r.settlePreview(settle({ paidFils: 100000, amountFils: 20000, refundedFils: 14999 }));
  assert.equal(one.overpaidFils, 1);
  assert.equal(one.attention, "overpaid");
  // Money on a cancelled booking stays paid_after_cancel, over overpaid.
  assert.equal(r.settlePreview(settle({ status: "cancelled", paidFils: 100000, amountFils: 20000, refundedFils: 5000 })).attention, "paid_after_cancel");
  // A refund never raises what is still due (P-06): the figure is unchanged by refundedFils.
  assert.equal(r.settlePreview(settle({ refundedFils: 0 })).stillDueFils, r.settlePreview(settle({ refundedFils: 20000 })).stillDueFils);
});

const voided = (over = {}) => ({
  status: "deposit_paid",
  plan: "deposit",
  grandFils: GRAND,
  depositFils: DEPOSIT,
  depositBp: 3000,
  paidFils: DEPOSIT,
  writtenOffFils: 0,
  attentionReason: null,
  payment: { amountFils: DEPOSIT, writeOffFils: 0 },
  ...over,
});

test("voidPreview with refundedFils omitted answers exactly as with 0", () => {
  for (const over of [{}, { status: "expired", attentionReason: "paid_after_expiry" }, { status: "awaiting_payment", paidFils: 50000, payment: { amountFils: 20000, writeOffFils: 0 } }]) {
    assert.deepEqual(r.voidPreview(voided(over)), r.voidPreview(voided({ ...over, refundedFils: 0 })), JSON.stringify(over));
  }
});

test("voidPreview refuses refund_first when paid after the void is below the refunds recorded", () => {
  const p = r.voidPreview(voided({ refundedFils: 10000 })); // paid after = 0 < 10000
  assert.equal(p.refusal, "refund_first");
  assert.equal(p.statusAfter, "deposit_paid", "nothing changes");
  assert.equal(p.paidAfterFils, 0);
  assert.equal(p.attentionCleared, false);
  // Exactly equal is allowed.
  const eq = r.voidPreview(voided({ paidFils: 50000, payment: { amountFils: 20000, writeOffFils: 0 }, refundedFils: 30000 }));
  assert.equal(eq.refusal, null);
  // refund_first comes before cancel_first.
  const both = r.voidPreview(voided({ status: "confirmed", refundedFils: 10000 }));
  assert.equal(both.refusal, "refund_first");
});

test("voidPreview: overpaid and the money flags clear on paid after minus refunded", () => {
  // overpaid: paid 140000, void a 20000 row, refunded 15000: net 105000 is within the total.
  const over = r.voidPreview(
    voided({ status: "paid_in_full", paidFils: 140000, attentionReason: "overpaid", payment: { amountFils: 20000, writeOffFils: 0 }, refundedFils: 15000 }),
  );
  assert.equal(over.refusal, null);
  assert.equal(over.attentionCleared, true);
  const stillOver = r.voidPreview(
    voided({ status: "paid_in_full", paidFils: 140000, attentionReason: "overpaid", payment: { amountFils: 20000, writeOffFils: 0 }, refundedFils: 14999 }),
  );
  assert.equal(stillOver.attentionCleared, false);
  // paid_after_cancel: paid 40000, void 10000, refunded 30000: net 0.
  const cancelled = r.voidPreview(
    voided({ status: "cancelled", paidFils: 40000, attentionReason: "paid_after_cancel", payment: { amountFils: 10000, writeOffFils: 0 }, refundedFils: 30000 }),
  );
  assert.equal(cancelled.attentionCleared, true);
  const some = r.voidPreview(
    voided({ status: "cancelled", paidFils: 40000, attentionReason: "paid_after_cancel", payment: { amountFils: 10000, writeOffFils: 0 }, refundedFils: 29999 }),
  );
  assert.equal(some.attentionCleared, false);
  // deadline_passed_part_paid still needs nothing paid after.
  const part = r.voidPreview(
    voided({ status: "awaiting_payment", paidFils: 20000, attentionReason: "deadline_passed_part_paid", payment: { amountFils: 20000, writeOffFils: 0 } }),
  );
  assert.equal(part.attentionCleared, true);
  // Paid above 0 with net 0: the deadline flag stays, the money flags would have cleared (symbolic amounts).
  const netZero = r.voidPreview(
    voided({ status: "awaiting_payment", paidFils: 70000, attentionReason: "deadline_passed_part_paid", payment: { amountFils: 50000, writeOffFils: 0 }, refundedFils: 20000 }),
  );
  assert.equal(netZero.attentionCleared, false);
});

// refundMail --------------------------------------------------------------------------------------------------------

const ev = (id, action, detail) => ({ id, at: "2026-10-31T10:00:00.000Z", actor: "system", action, from_status: null, to_status: null, detail });
const detailOf = (events) => ({ id: BOOKING, events });

test("refundMail is none with no email event", () => {
  assert.equal(r.refundMail(detailOf([]), 7), "none");
  assert.equal(r.refundMail(detailOf([ev(1, "refund_recorded", { refund_id: 7 })]), 7), "none");
});

test("refundMail reads the refund-receipt key of that refund only", () => {
  const events = [ev(1, "email_sent", { template: "refund_receipt", key: "refund-receipt/7" })];
  assert.equal(r.refundMail(detailOf(events), 7), "sent");
  assert.equal(r.refundMail(detailOf(events), 8), "none");
  const states = { email_pending: "pending", email_failed: "failed", email_unknown: "unknown" };
  for (const [action, want] of Object.entries(states)) {
    assert.equal(r.refundMail(detailOf([ev(1, action, { key: "refund-receipt/7" })]), 7), want, action);
  }
});

test("refundMail follows the newest event and counts a resend that names this refund", () => {
  const resend = ev(2, "resend_requested", { template: "refund_receipt", refund_id: 7, request_id: REQUEST });
  const failed = ev(3, "email_failed", { template: "refund_receipt", key: `resend/${BOOKING}/${REQUEST}` });
  const sent = ev(1, "email_sent", { key: "refund-receipt/7" });
  assert.equal(r.refundMail(detailOf([sent, resend, failed]), 7), "failed");
  const later = ev(4, "email_sent", { key: `resend/${BOOKING}/${REQUEST}` });
  assert.equal(r.refundMail(detailOf([sent, resend, failed, later]), 7), "sent");
  // A resend for another refund, or one that names a string id, is read by its refund_id.
  const other = ev(5, "resend_requested", { template: "refund_receipt", refund_id: 9, request_id: OTHER_REQUEST });
  const otherSent = ev(6, "email_sent", { key: `resend/${BOOKING}/${OTHER_REQUEST}` });
  assert.equal(r.refundMail(detailOf([sent, other, otherSent]), 7), "sent", "the other refund's mail does not move this one past its own receipt");
  assert.equal(r.refundMail(detailOf([other, otherSent]), 7), "none");
  const asText = ev(7, "resend_requested", { refund_id: "7", request_id: REQUEST });
  assert.equal(r.refundMail(detailOf([asText, ev(8, "email_pending", { key: `resend/${BOOKING}/${REQUEST}` })]), 7), "pending");
});
