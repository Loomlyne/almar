// Plan 04-09 Task 1: the pure booking rules the dashboard screens and the owner handlers share (lib/ops/booking-rules.ts)
// and the bookings copy (lib/copy/ops-bookings.ts). Symbolic fils only (105000, 31500), bracket names, no real account.
// The money rules mirror 04-08's SQL (20261019160000_booking_requests.sql: booking_next_status, booking_deposit_floor,
// booking_flags, ops_record_payment, ops_void_payment); Task 6's parity grid compares them on a stack.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const r = await loadTs("lib/ops/booking-rules.ts");
const { OPS_BOOKINGS_COPY } = await loadTs("lib/copy/ops-bookings.ts");
const SOURCE = readFileSync("lib/ops/booking-rules.ts", "utf8");

const BOOKING = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const OTHER_PAYMENT = "44444444-4444-4444-8444-444444444444";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST = "55555555-5555-4555-8555-555555555555";
const DESTINATION = "66666666-6666-4666-8666-666666666666";

const GRAND = 105000;
const DEPOSIT = 31500;

const flags = (over = {}) => ({
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
});

// ---------------------------------------------------------------- statuses and actions

test("BOOKING_STATUSES holds the eight statuses; STATUS_FILTERS adds all and attention", () => {
  assert.deepEqual([...r.BOOKING_STATUSES].sort(), [
    "awaiting_payment", "cancelled", "completed", "confirmed", "deposit_paid", "expired", "held", "paid_in_full",
  ]);
  assert.deepEqual([...r.STATUS_FILTERS], ["all", ...r.BOOKING_STATUSES, "attention"]);
});

test("statusActions: paid statuses confirm or cancel, confirmed completes or cancels, awaiting cancels, the rest none", () => {
  assert.deepEqual(r.statusActions("deposit_paid"), ["confirm", "cancel"]);
  assert.deepEqual(r.statusActions("paid_in_full"), ["confirm", "cancel"]);
  assert.deepEqual(r.statusActions("confirmed"), ["complete", "cancel"]);
  assert.deepEqual(r.statusActions("awaiting_payment"), ["cancel"]);
  for (const s of ["held", "completed", "cancelled", "expired"]) assert.deepEqual(r.statusActions(s), [], s);
});

test("targetStatus maps confirm, complete and cancel", () => {
  assert.equal(r.targetStatus("confirm"), "confirmed");
  assert.equal(r.targetStatus("complete"), "completed");
  assert.equal(r.targetStatus("cancel"), "cancelled");
});

test("canRecordPayment is false only for held", () => {
  for (const s of r.BOOKING_STATUSES) assert.equal(r.canRecordPayment(s), s !== "held", s);
});

test("canAcceptShort only for awaiting_payment, deposit_paid, confirmed, completed", () => {
  const yes = new Set(["awaiting_payment", "deposit_paid", "confirmed", "completed"]);
  for (const s of r.BOOKING_STATUSES) assert.equal(r.canAcceptShort(s), yes.has(s), s);
});

test("canVoid only a succeeded bank transfer row", () => {
  assert.equal(r.canVoid({ status: "succeeded", method: "bank_transfer" }), true);
  assert.equal(r.canVoid({ status: "succeeded", method: "card" }), false);
  assert.equal(r.canVoid({ status: "voided", method: "bank_transfer" }), false);
  assert.equal(r.canVoid({ status: "open", method: "bank_transfer" }), false);
});

test("canResendReceipt only for a succeeded row", () => {
  assert.equal(r.canResendReceipt({ status: "succeeded", method: "bank_transfer" }), true);
  assert.equal(r.canResendReceipt({ status: "voided", method: "bank_transfer" }), false);
  assert.equal(r.canResendReceipt({ status: "failed", method: "card" }), false);
});

test("canResendRequest: awaiting_payment, and past the pay-by date only when part paid (owner Q-18 = yes, 2026-10-21)", () => {
  assert.equal(r.canResendRequest("awaiting_payment", flags()), true);
  // A part-paid request past its pay-by date never lapses (P-09 as changed): the owner may send the bank details again.
  assert.equal(r.canResendRequest("awaiting_payment", flags({ deadline_passed: true, part_received: true })), true);
  // An unpaid request past its pay-by date lapses at the next sweep: no resend.
  assert.equal(r.canResendRequest("awaiting_payment", flags({ deadline_passed: true, part_received: false })), false);
  for (const s of ["held", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"]) {
    assert.equal(r.canResendRequest(s, flags()), false, s);
  }
});

// ---------------------------------------------------------------- AED text to fils

test("parseAedAmount accepts plain, grouped and Arabic-Indic amounts as exact fils", () => {
  assert.equal(r.parseAedAmount("1050"), 105000);
  assert.equal(r.parseAedAmount("1050.5"), 105050);
  assert.equal(r.parseAedAmount("1,050.00"), 105000);
  assert.equal(r.parseAedAmount(" 12.30 "), 1230);
  assert.equal(r.parseAedAmount("0.01"), 1);
  assert.equal(r.parseAedAmount("١٠٥٠"), 105000);
  assert.equal(r.parseAedAmount("١٬٠٥٠٫٥٠"), 105050);
  assert.equal(r.parseAedAmount("۱۰۵۰"), 105000);
  assert.equal(r.parseAedAmount("10000000000"), 1000000000000);
  assert.equal(r.AED_MAX_FILS, 1_000_000_000_000);
});

test("parseAedAmount refuses everything else with null", () => {
  for (const text of [
    "", "0", "0.00", "1.234", "1e3", "-5", "+5", "1,05", "10,00.00", "1.", ".5", "10000000000.01", "AED 10", "1 050",
    "   ", "1,050,5", "Infinity", "NaN", "0x10", "1_000",
  ]) {
    assert.equal(r.parseAedAmount(text), null, JSON.stringify(text));
  }
});

test("source rule: no float parsing in booking-rules.ts", () => {
  assert.doesNotMatch(SOURCE, /parseFloat/);
  assert.doesNotMatch(SOURCE, /toFixed/);
  assert.doesNotMatch(SOURCE, /Number\([^)]*\.[^)]*\)/);
});

test("aedText writes fils as plain AED text for the amount field", () => {
  assert.equal(r.aedText(105050), "1050.50");
  assert.equal(r.aedText(5), "0.05");
  assert.equal(r.aedText(105000), "1050.00");
  assert.equal(r.parseAedAmount(r.aedText(105050)), 105050);
});

// ---------------------------------------------------------------- table C

function tableC(status, plan, grand, deposit, settled) {
  if (!["awaiting_payment", "deposit_paid", "paid_in_full"].includes(status)) return status;
  if (settled >= grand) return "paid_in_full";
  if (plan === "deposit" && settled >= deposit) return "deposit_paid";
  return "awaiting_payment";
}

test("nextStatus equals table C for every status x plan x settled", () => {
  for (const status of r.BOOKING_STATUSES) {
    for (const plan of ["deposit", "full"]) {
      const deposit = plan === "deposit" ? DEPOSIT : 0; // the table keeps deposit_fils 0 on a full plan
      for (const settled of [0, deposit - 1, deposit, GRAND - 1, GRAND, GRAND + 1]) {
        if (settled < 0) continue;
        assert.equal(r.nextStatus(status, plan, GRAND, deposit, settled), tableC(status, plan, GRAND, deposit, settled),
          `${status} ${plan} ${settled}`);
      }
    }
  }
  assert.equal(r.nextStatus("awaiting_payment", "deposit", GRAND, DEPOSIT, DEPOSIT - 1), "awaiting_payment");
  assert.equal(r.nextStatus("awaiting_payment", "deposit", GRAND, DEPOSIT, DEPOSIT), "deposit_paid");
  assert.equal(r.nextStatus("deposit_paid", "deposit", GRAND, DEPOSIT, GRAND), "paid_in_full");
  assert.equal(r.nextStatus("paid_in_full", "full", GRAND, 0, GRAND - 1), "awaiting_payment");
  assert.equal(r.nextStatus("confirmed", "deposit", GRAND, DEPOSIT, 0), "confirmed");
});

// ---------------------------------------------------------------- settlePreview

const settleBase = {
  status: "awaiting_payment",
  plan: "deposit",
  grandFils: GRAND,
  depositFils: DEPOSIT,
  paidFils: 0,
  writtenOffFils: 0,
  attentionReason: null,
  amountFils: 0,
  acceptShort: false,
};
const settle = (over) => r.settlePreview({ ...settleBase, ...over });

test("settlePreview: below the deposit stays awaiting_payment, part received, nights kept for good", () => {
  const p = settle({ amountFils: 10000 });
  assert.equal(p.refusal, null);
  assert.equal(p.statusAfter, "awaiting_payment");
  assert.equal(p.partReceived, true);
  assert.equal(p.gapFils, DEPOSIT - 10000);
  assert.equal(p.nightsKept, true);
  assert.equal(p.writeOffFils, 0);
  assert.equal(p.overpaidFils, 0);
  assert.equal(p.attention, null);
  assert.equal(p.settledAfterFils, 10000);
  assert.equal(p.stillDueFils, GRAND - 10000);
  assert.equal(p.depositLeftFils, DEPOSIT - 10000);
  assert.equal(p.attentionCleared, false);
});

test("settlePreview: depositLeftFils is what is left of the amount due by the pay-by date, 0 once the request moves on", () => {
  assert.equal(settle({ amountFils: 10000 }).depositLeftFils, DEPOSIT - 10000);
  assert.equal(settle({ paidFils: 10000, amountFils: 5000 }).depositLeftFils, DEPOSIT - 15000);
  assert.equal(settle({ amountFils: DEPOSIT }).depositLeftFils, 0);
  assert.equal(settle({ amountFils: GRAND }).depositLeftFils, 0);
  assert.equal(settle({ plan: "full", depositFils: 0, amountFils: 10000 }).depositLeftFils, GRAND - 10000);
  assert.equal(settle({ status: "expired", amountFils: 10000 }).depositLeftFils, 0);
  assert.equal(settle({ status: "confirmed", paidFils: GRAND, amountFils: 100 }).depositLeftFils, 0);
});

test("settlePreview: exactly the deposit is deposit_paid; the total or more is paid_in_full", () => {
  const atDeposit = settle({ amountFils: DEPOSIT });
  assert.equal(atDeposit.statusAfter, "deposit_paid");
  assert.equal(atDeposit.nightsKept, true);
  assert.equal(atDeposit.partReceived, false);
  assert.equal(atDeposit.gapFils, 0);
  assert.equal(atDeposit.stillDueFils, GRAND - DEPOSIT);
  assert.equal(settle({ amountFils: DEPOSIT - 1 }).statusAfter, "awaiting_payment");
  assert.equal(settle({ amountFils: GRAND }).statusAfter, "paid_in_full");
  assert.equal(settle({ status: "deposit_paid", paidFils: DEPOSIT, amountFils: GRAND - DEPOSIT }).statusAfter, "paid_in_full");
  assert.equal(settle({ plan: "full", depositFils: 0, amountFils: GRAND }).statusAfter, "paid_in_full");
  assert.equal(settle({ plan: "full", depositFils: 0, amountFils: GRAND - 1 }).statusAfter, "awaiting_payment");
});

test("settlePreview: money above the total is flagged overpaid; write-offs never count toward overpaid", () => {
  const over = settle({ amountFils: GRAND + 5000 });
  assert.equal(over.statusAfter, "paid_in_full");
  assert.equal(over.overpaidFils, 5000);
  assert.equal(over.attention, "overpaid");
  assert.equal(over.partReceived, false);
  // 100000 paid + 5000 written off settles the total; 3000 more makes 103000 paid: not above the total.
  const off = settle({ status: "paid_in_full", plan: "full", depositFils: 0, paidFils: 100000, writtenOffFils: 5000, amountFils: 3000 });
  assert.equal(off.overpaidFils, 0);
  assert.equal(off.attention, null);
  assert.equal(off.settledAfterFils, 108000);
});

test("settlePreview: a record to deposit_paid or paid_in_full clears deadline_passed_part_paid; a part payment keeps it", () => {
  const reason = "deadline_passed_part_paid";
  assert.equal(settle({ paidFils: 10000, attentionReason: reason, amountFils: DEPOSIT - 10000 }).attentionCleared, true);
  assert.equal(settle({ paidFils: 10000, attentionReason: reason, amountFils: GRAND - 10000 }).attentionCleared, true);
  assert.equal(settle({ plan: "full", depositFils: 0, paidFils: 10000, attentionReason: reason, amountFils: GRAND - 10000 }).attentionCleared, true);
  const part = settle({ paidFils: 10000, attentionReason: reason, amountFils: 5000 });
  assert.equal(part.statusAfter, "awaiting_payment");
  assert.equal(part.partReceived, true);
  assert.equal(part.attentionCleared, false);
  assert.equal(settle({ paidFils: 10000, attentionReason: "overpaid", amountFils: DEPOSIT }).attentionCleared, false);
  assert.equal(settle({ amountFils: DEPOSIT }).attentionCleared, false);
});

test("settlePreview: Accept as paid writes off the gap and moves to the status at the target", () => {
  const awaiting = settle({ amountFils: 30000, acceptShort: true });
  assert.equal(awaiting.refusal, null);
  assert.equal(awaiting.gapFils, 1500);
  assert.equal(awaiting.writeOffFils, 1500);
  assert.equal(awaiting.statusAfter, "deposit_paid");
  assert.equal(awaiting.settledAfterFils, DEPOSIT);
  const paid = settle({ status: "deposit_paid", paidFils: DEPOSIT, amountFils: 70000, acceptShort: true });
  assert.equal(paid.writeOffFils, 3500);
  assert.equal(paid.statusAfter, "paid_in_full");
  const confirmed = settle({ status: "confirmed", paidFils: DEPOSIT, amountFils: 70000, acceptShort: true });
  assert.equal(confirmed.writeOffFils, 3500);
  assert.equal(confirmed.statusAfter, "confirmed");
  const full = settle({ plan: "full", depositFils: 0, amountFils: 100000, acceptShort: true });
  assert.equal(full.writeOffFils, 5000);
  assert.equal(full.statusAfter, "paid_in_full");
});

test("settlePreview: Accept as paid with nothing short is refused nothing_to_write_off", () => {
  assert.equal(settle({ amountFils: DEPOSIT, acceptShort: true }).refusal, "nothing_to_write_off");
  assert.equal(settle({ amountFils: 40000, acceptShort: true }).refusal, "nothing_to_write_off");
  assert.equal(settle({ status: "deposit_paid", paidFils: DEPOSIT, amountFils: GRAND - DEPOSIT, acceptShort: true }).refusal, "nothing_to_write_off");
});

test("settlePreview: Accept as paid on expired, cancelled or paid_in_full is refused not_applicable", () => {
  for (const status of ["expired", "cancelled", "paid_in_full"]) {
    assert.equal(settle({ status, paidFils: status === "paid_in_full" ? GRAND : 0, amountFils: 100, acceptShort: true }).refusal, "not_applicable", status);
  }
});

test("settlePreview: a held booking is refused not_requested", () => {
  assert.equal(settle({ status: "held", amountFils: 10000 }).refusal, "not_requested");
  assert.equal(settle({ status: "held", amountFils: 10000, acceptShort: true }).refusal, "not_requested");
});

test("settlePreview: money on an expired or cancelled booking keeps the status, is flagged, takes no nights", () => {
  const expired = settle({ status: "expired", amountFils: 10000 });
  assert.equal(expired.refusal, null);
  assert.equal(expired.statusAfter, "expired");
  assert.equal(expired.attention, "paid_after_expiry");
  assert.equal(expired.nightsKept, false);
  assert.equal(expired.partReceived, false);
  assert.equal(expired.stillDueFils, 0);
  const cancelled = settle({ status: "cancelled", amountFils: GRAND + 1 });
  assert.equal(cancelled.statusAfter, "cancelled");
  assert.equal(cancelled.attention, "paid_after_cancel");
  assert.equal(cancelled.nightsKept, false);
});

// ---------------------------------------------------------------- deposit floor and void

test("depositFloor mirrors booking_deposit_floor: the deposit on a deposit plan, pct() of the total on a full plan", () => {
  assert.equal(r.depositFloor("deposit", GRAND, DEPOSIT, 3000), DEPOSIT);
  assert.equal(r.depositFloor("full", 105000, 0, 3000), 31500);
  assert.equal(r.depositFloor("full", 99, 0, 5000), 50);
  assert.equal(r.depositFloor("full", 1, 0, 5000), 1);
  assert.equal(r.depositFloor("full", 1, 0, 4999), 0);
  assert.equal(r.depositFloor("full", GRAND, 0, 0), 0);
  assert.notEqual(r.depositFloor("full", GRAND, 0, 3000), GRAND);
});

const voidBase = {
  status: "confirmed",
  plan: "full",
  grandFils: GRAND,
  depositFils: 0,
  depositBp: 3000,
  paidFils: GRAND,
  writtenOffFils: 0,
  attentionReason: null,
  payment: { amountFils: GRAND, writeOffFils: 0 },
};
const voidOf = (over) => r.voidPreview({ ...voidBase, ...over });

test("voidPreview: confirmed or completed below the deposit floor is cancel_first, on every plan", () => {
  assert.equal(voidOf({}).refusal, "cancel_first");
  const kept = voidOf({ payment: { amountFils: 60000, writeOffFils: 0 } });
  assert.equal(kept.refusal, null);
  assert.equal(kept.statusAfter, "confirmed");
  assert.equal(kept.settledAfterFils, 45000);
  assert.equal(kept.deadline, null);
  assert.equal(kept.nights, "kept");
  const atFloor = voidOf({ payment: { amountFils: 73500, writeOffFils: 0 } });
  assert.equal(atFloor.settledAfterFils, 31500);
  assert.equal(atFloor.refusal, null);
  assert.equal(voidOf({ status: "completed" }).refusal, "cancel_first");
  const completed = voidOf({ status: "completed", payment: { amountFils: 60000, writeOffFils: 0 } });
  assert.equal(completed.refusal, null);
  assert.equal(completed.statusAfter, "completed");
  assert.equal(completed.nights, "kept");
  assert.equal(
    voidOf({ plan: "deposit", depositFils: DEPOSIT, paidFils: DEPOSIT + 10000, payment: { amountFils: DEPOSIT, writeOffFils: 0 } }).refusal,
    "cancel_first",
  );
  // A write-off on the voided row goes with it.
  assert.equal(voidOf({ paidFils: 101000, writtenOffFils: 4000, payment: { amountFils: 70000, writeOffFils: 4000 } }).refusal, "cancel_first");
});

test("voidPreview: deposit_paid or paid_in_full back to awaiting_payment gets a fresh pay-by date", () => {
  const toZero = voidOf({ status: "deposit_paid", plan: "deposit", depositFils: DEPOSIT, paidFils: DEPOSIT, payment: { amountFils: DEPOSIT, writeOffFils: 0 } });
  assert.equal(toZero.refusal, null);
  assert.equal(toZero.statusAfter, "awaiting_payment");
  assert.equal(toZero.deadline, "fresh");
  assert.equal(toZero.nights, "until_deadline");
  assert.equal(toZero.paidAfterFils, 0);
  const left = voidOf({ status: "deposit_paid", plan: "deposit", depositFils: DEPOSIT, paidFils: 40000, payment: { amountFils: 10000, writeOffFils: 0 } });
  assert.equal(left.statusAfter, "awaiting_payment");
  assert.equal(left.deadline, "fresh");
  assert.equal(left.nights, "kept");
  const fullPlan = voidOf({ status: "paid_in_full", payment: { amountFils: 45000, writeOffFils: 0 } });
  assert.equal(fullPlan.statusAfter, "awaiting_payment");
  assert.equal(fullPlan.deadline, "fresh");
  assert.equal(fullPlan.nights, "kept");
});

test("voidPreview: paid_in_full to deposit_paid keeps the nights and has no pay-by date", () => {
  const p = voidOf({ status: "paid_in_full", plan: "deposit", depositFils: DEPOSIT, payment: { amountFils: 45000, writeOffFils: 0 } });
  assert.equal(p.statusAfter, "deposit_paid");
  assert.equal(p.deadline, null);
  assert.equal(p.nights, "kept");
});

test("voidPreview: awaiting_payment with money left keeps its date; voided to 0 it is an unpaid request again", () => {
  const left = voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, paidFils: 20000, payment: { amountFils: 10000, writeOffFils: 0 } });
  assert.equal(left.statusAfter, "awaiting_payment");
  assert.equal(left.deadline, "unchanged");
  assert.equal(left.nights, "kept");
  const zero = voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, paidFils: 10000, payment: { amountFils: 10000, writeOffFils: 0 } });
  assert.equal(zero.statusAfter, "awaiting_payment");
  assert.equal(zero.deadline, "later_of");
  assert.equal(zero.nights, "until_deadline");
  assert.equal(zero.paidAfterFils, 0);
});

test("voidPreview: expired and cancelled keep their status, no date, no nights", () => {
  for (const status of ["expired", "cancelled"]) {
    const p = voidOf({ status, paidFils: 10000, payment: { amountFils: 10000, writeOffFils: 0 } });
    assert.equal(p.refusal, null, status);
    assert.equal(p.statusAfter, status);
    assert.equal(p.deadline, null);
    assert.equal(p.nights, "none");
  }
});

test("voidPreview: attentionCleared when no money is left on a money flag, or overpaid ends", () => {
  const one = { paidFils: 10000, payment: { amountFils: 10000, writeOffFils: 0 } };
  assert.equal(voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, attentionReason: "deadline_passed_part_paid", ...one }).attentionCleared, true);
  assert.equal(voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, attentionReason: "deadline_passed_part_paid", paidFils: 20000, payment: { amountFils: 10000, writeOffFils: 0 } }).attentionCleared, false);
  assert.equal(voidOf({ status: "expired", attentionReason: "paid_after_expiry", ...one }).attentionCleared, true);
  assert.equal(voidOf({ status: "cancelled", attentionReason: "paid_after_cancel", ...one }).attentionCleared, true);
  assert.equal(voidOf({ status: "paid_in_full", attentionReason: "overpaid", paidFils: GRAND + 5000, payment: { amountFils: 5000, writeOffFils: 0 } }).attentionCleared, true);
  assert.equal(voidOf({ status: "paid_in_full", attentionReason: "overpaid", paidFils: GRAND + 10000, payment: { amountFils: 5000, writeOffFils: 0 } }).attentionCleared, false);
  assert.equal(voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, attentionReason: "overpaid", ...one }).attentionCleared, true);
  assert.equal(voidOf({ status: "awaiting_payment", plan: "deposit", depositFils: DEPOSIT, attentionReason: null, ...one }).attentionCleared, false);
});

// ---------------------------------------------------------------- list query

const DEFAULT_QUERY = { q: "", status: "all", destination: null, from: null, to: null, after: null, limit: 30 };
const parse = (init) => r.parseListQuery(new URLSearchParams(init));

test("parseListQuery: empty params give the defaults", () => {
  assert.deepEqual(parse(""), { ok: true, query: DEFAULT_QUERY });
  assert.equal(r.LIST_LIMIT, 30);
});

test("parseListQuery: q trimmed, Arabic-Indic digits Western, over 100 characters refused", () => {
  assert.equal(parse({ q: "  ALMAR-ABCDEF " }).query.q, "ALMAR-ABCDEF");
  assert.equal(parse({ q: "٢٠٢٦" }).query.q, "2026");
  assert.equal(parse({ q: "a".repeat(100) }).ok, true);
  assert.deepEqual(parse({ q: "a".repeat(101) }), { ok: false, field: "q" });
});

test("parseListQuery: status, destination, arrival, after and limit are checked by field", () => {
  assert.deepEqual(parse({ status: "bogus" }), { ok: false, field: "status" });
  assert.equal(parse({ status: "attention" }).query.status, "attention");
  assert.equal(parse({ status: "deposit_paid" }).query.status, "deposit_paid");
  assert.deepEqual(parse({ destination: "cartagena" }), { ok: false, field: "destination" });
  assert.equal(parse({ destination: DESTINATION }).query.destination, DESTINATION);
  assert.deepEqual(parse({ from: "2026-10-20", to: "2026-10-19" }), { ok: false, field: "arrive" });
  assert.deepEqual(parse({ from: "2026-02-30" }), { ok: false, field: "arrive" });
  assert.deepEqual(parse({ to: "tomorrow" }), { ok: false, field: "arrive" });
  assert.equal(parse({ from: "2026-10-19", to: "2026-10-19" }).ok, true);
  assert.deepEqual(parse({ after: "abc" }), { ok: false, field: "after" });
  assert.deepEqual(parse({ after: "1234567" }), { ok: false, field: "after" });
  assert.equal(parse({ after: "30" }).query.after, "30");
  for (const limit of ["0", "61", "abc", "1.5", "-1"]) assert.deepEqual(parse({ limit }), { ok: false, field: "limit" }, limit);
  assert.equal(parse({ limit: "60" }).query.limit, 60);
  assert.equal(parse({ limit: "1" }).query.limit, 1);
});

test("listSearch round-trips and leaves the defaults out", () => {
  assert.equal(r.listSearch(DEFAULT_QUERY).toString(), "");
  const query = { q: "[Guest name]", status: "awaiting_payment", destination: DESTINATION, from: "2026-11-01", to: "2026-11-30", after: "30", limit: 60 };
  assert.deepEqual(r.parseListQuery(r.listSearch(query)), { ok: true, query });
  const some = { ...DEFAULT_QUERY, status: "attention" };
  assert.equal(r.listSearch(some).toString(), "status=attention");
  assert.deepEqual(r.parseListQuery(r.listSearch(some)), { ok: true, query: some });
});

test("listRpcArgs sends the seven p_ keys, p_status null for all", () => {
  assert.deepEqual(r.listRpcArgs(DEFAULT_QUERY), {
    p_q: null, p_status: null, p_destination: null, p_arrive_from: null, p_arrive_to: null, p_after: null, p_limit: 30,
  });
  assert.deepEqual(
    r.listRpcArgs({ q: "[Guest name]", status: "attention", destination: DESTINATION, from: "2026-11-01", to: "2026-11-30", after: "30", limit: 10 }),
    { p_q: "[Guest name]", p_status: "attention", p_destination: DESTINATION, p_arrive_from: "2026-11-01", p_arrive_to: "2026-11-30", p_after: "30", p_limit: 10 },
  );
});

// ---------------------------------------------------------------- UAE time

test("uaeDateTimeText, uaeDate and dubaiDayOf use the Asia/Dubai day", () => {
  assert.equal(r.uaeDateTimeText("2026-10-10T20:30:00Z"), "11/10/2026 00:30");
  assert.equal(r.uaeDateTimeText("2026-10-19T08:05:00.000Z"), "19/10/2026 12:05");
  assert.equal(r.uaeDate("2026-10-19"), "19/10/2026");
  assert.equal(r.dubaiDayOf("2026-10-19T19:59:59Z"), "2026-10-19");
  assert.equal(r.dubaiDayOf("2026-10-19T20:00:00Z"), "2026-10-20");
});

test("source rule: dubaiToday is imported from lib/money/dates.ts, never declared or re-exported here", () => {
  assert.match(SOURCE, /import \{[^}]*dubaiToday[^}]*\} from "\.\.\/money\/dates"/);
  assert.doesNotMatch(SOURCE, /function dubaiToday/);
  assert.doesNotMatch(SOURCE, /export \{[^}]*dubaiToday/);
  assert.doesNotMatch(SOURCE, /type BookingStatus *=/);
  assert.equal("dubaiToday" in r, false);
});

// ---------------------------------------------------------------- mail state

const ev = (id, action, detail) => ({ id, at: `2026-10-19T08:0${id}:00.000Z`, actor: "system", action, from_status: null, to_status: null, detail });
const detailOf = (events) => ({ id: BOOKING, events });

test("receiptMail: the newest email event on receipt/<payment_id> decides; none is none", () => {
  const key = `receipt/${PAYMENT}`;
  assert.equal(r.receiptMail(detailOf([]), PAYMENT), "none");
  assert.equal(r.receiptMail(detailOf([ev(1, "email_sent", { template: "payment_receipt", key })]), PAYMENT), "sent");
  assert.equal(r.receiptMail(detailOf([ev(1, "email_pending", { template: "payment_receipt", key })]), PAYMENT), "pending");
  assert.equal(r.receiptMail(detailOf([ev(1, "email_failed", { template: "payment_receipt", key, error: "x" })]), PAYMENT), "failed");
  const twice = [ev(5, "email_sent", { key }), ev(3, "email_failed", { key })];
  assert.equal(r.receiptMail(detailOf(twice), PAYMENT), "sent");
  assert.equal(r.receiptMail(detailOf([...twice].reverse()), PAYMENT), "sent");
  assert.equal(r.receiptMail(detailOf([ev(5, "email_failed", { key }), ev(3, "email_sent", { key })]), PAYMENT), "failed");
});

test("receiptMail: a resend of that payment counts; another payment's resend does not", () => {
  const events = [
    ev(4, "email_sent", { template: "payment_receipt", key: `resend/${BOOKING}/${REQUEST}` }),
    ev(3, "resend_requested", { template: "payment_receipt", payment_id: PAYMENT, request_id: REQUEST }),
    ev(2, "email_failed", { template: "payment_receipt", key: `receipt/${PAYMENT}` }),
  ];
  assert.equal(r.receiptMail(detailOf(events), PAYMENT), "sent");
  const other = [
    ev(4, "email_sent", { template: "payment_receipt", key: `resend/${BOOKING}/${OTHER_REQUEST}` }),
    ev(3, "resend_requested", { template: "payment_receipt", payment_id: OTHER_PAYMENT, request_id: OTHER_REQUEST }),
    ev(2, "email_failed", { template: "payment_receipt", key: `receipt/${PAYMENT}` }),
  ];
  assert.equal(r.receiptMail(detailOf(other), PAYMENT), "failed");
});

test("receiptMail and requestMail ignore an email event without a key or with another key", () => {
  const events = [
    ev(6, "email_sent", { template: "payment_receipt" }),
    ev(5, "email_sent", null),
    ev(4, "email_sent", { key: `payment-owner/${PAYMENT}` }),
    ev(3, "email_sent", { key: `request-owner/${BOOKING}` }),
    ev(2, "email_failed", { key: `receipt/${PAYMENT}` }),
    ev(1, "email_failed", { key: `request/${BOOKING}` }),
  ];
  assert.equal(r.receiptMail(detailOf(events), PAYMENT), "failed");
  assert.equal(r.requestMail(detailOf(events)), "failed");
});

test("requestMail: request/<booking_id> plus resends of the request email; reads the key, never the email's template", () => {
  assert.equal(r.requestMail(detailOf([])), "none");
  assert.equal(r.requestMail(detailOf([ev(1, "email_pending", { template: "request_received", key: `request/${BOOKING}` })])), "pending");
  // The email event's own template is never read: the key decides.
  assert.equal(r.requestMail(detailOf([ev(1, "email_sent", { template: "payment_receipt", key: `request/${BOOKING}` })])), "sent");
  const resent = [
    ev(3, "email_sent", { template: "request_received", key: `resend/${BOOKING}/${REQUEST}` }),
    ev(2, "resend_requested", { template: "request_received", payment_id: null, request_id: REQUEST }),
    ev(1, "email_failed", { template: "request_received", key: `request/${BOOKING}` }),
  ];
  assert.equal(r.requestMail(detailOf(resent)), "sent");
  const receiptResend = [
    ev(3, "email_sent", { template: "payment_receipt", key: `resend/${BOOKING}/${REQUEST}` }),
    ev(2, "resend_requested", { template: "payment_receipt", payment_id: PAYMENT, request_id: REQUEST }),
    ev(1, "email_failed", { template: "request_received", key: `request/${BOOKING}` }),
  ];
  assert.equal(r.requestMail(detailOf(receiptResend)), "failed");
});

test("the owner withdrawal notice (withdrawn-owner/<booking_id>) changes neither mail state", () => {
  const base = [
    ev(2, "email_failed", { template: "payment_receipt", key: `receipt/${PAYMENT}` }),
    ev(1, "email_pending", { template: "request_received", key: `request/${BOOKING}` }),
  ];
  const withdrawn = [ev(9, "email_sent", { template: "request_withdrawn_owner", key: `withdrawn-owner/${BOOKING}` }), ...base];
  assert.equal(r.receiptMail(detailOf(withdrawn), PAYMENT), r.receiptMail(detailOf(base), PAYMENT));
  assert.equal(r.requestMail(detailOf(withdrawn)), r.requestMail(detailOf(base)));
  assert.equal(r.requestMail(detailOf(withdrawn)), "pending");
});

test("actorKind: owner:<uuid>, system, guest, anything else system", () => {
  assert.equal(r.actorKind(`owner:${PAYMENT}`), "owner");
  assert.equal(r.actorKind("system"), "system");
  assert.equal(r.actorKind("guest"), "guest");
  assert.equal(r.actorKind("owner"), "system");
  assert.equal(r.actorKind("webhook"), "system");
  assert.equal(r.actorKind(""), "system");
});

// ---------------------------------------------------------------- copy

function leaves(value, path = []) {
  if (typeof value === "string") return [[path.join("."), value]];
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${path.join(".")} is an object`);
  return Object.keys(value).flatMap((key) => leaves(value[key], [...path, key]));
}
const tokens = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function checkCopy(copy, name) {
  assert.deepEqual(Object.keys(copy).sort(), ["ar", "en", "es"], name);
  const en = new Map(leaves(copy.en));
  for (const locale of ["ar", "es"]) {
    const other = new Map(leaves(copy[locale]));
    assert.deepEqual([...other.keys()].sort(), [...en.keys()].sort(), `${name}.${locale} keys`);
    for (const [path, text] of other) assert.deepEqual(tokens(text), tokens(en.get(path)), `${name}.${locale}.${path} tokens`);
  }
  for (const locale of ["en", "ar", "es"]) {
    for (const [path, text] of leaves(copy[locale])) {
      assert.ok(text.trim().length > 0, `${name}.${locale}.${path} empty`);
      for (const bad of ["[object", "undefined", "NaN"]) assert.ok(!text.includes(bad), `${name}.${locale}.${path} has ${bad}`);
    }
  }
}

test("OPS_BOOKINGS_COPY: same keys in en, ar and es at every depth, every leaf a string, tokens in all three", () => {
  checkCopy(OPS_BOOKINGS_COPY, "OPS_BOOKINGS_COPY");
});

test("OPS_BOOKINGS_COPY: four attention reasons, request_withdrawn in history, exactly the seven templates", () => {
  for (const locale of ["en", "ar", "es"]) {
    const c = OPS_BOOKINGS_COPY[locale];
    assert.deepEqual(new Set(Object.keys(c.flags.reasons)), new Set(["paid_after_expiry", "paid_after_cancel", "overpaid", "deadline_passed_part_paid"]));
    assert.equal(typeof c.history.request_withdrawn, "string");
    assert.deepEqual(new Set(Object.keys(c.templates)), new Set([
      "request_received", "request_owner", "payment_receipt", "payment_owner", "request_lapsed", "request_withdrawn_owner", "refund_receipt",
    ]));
    assert.deepEqual(new Set(Object.keys(c.statuses)), new Set(r.BOOKING_STATUSES));
  }
  assert.equal(OPS_BOOKINGS_COPY.en.flags.reasons.deadline_passed_part_paid,
    "Pay-by date passed, part paid. The nights stay held until you act: record the rest, cancel the booking, or resolve this.");
  assert.equal(OPS_BOOKINGS_COPY.en.history.request_withdrawn, "Withdrawn by the guest");
  assert.equal(OPS_BOOKINGS_COPY.en.statuses.deposit_paid, "Deposit paid");
  assert.equal(OPS_BOOKINGS_COPY.en.list.empty, "No bookings yet");
});
