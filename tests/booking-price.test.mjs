// Plan 04-01: the money engine in lib/money (B-05, B-06, B-21, PAY-01/02/03).
// Every amount here is a symbolic test value in fils (1 AED = 100 fils), not a real price, rate or fee.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const fils = await loadTs("lib/money/fils.ts");
const dates = await loadTs("lib/money/dates.ts");
const format = await loadTs("lib/money/format.ts");

const { pct, percentTextToBp, assertFils, MIN_CHARGE_FILS, MAX_AMOUNT_FILS } = fils;
const { isIsoDate, addDays, daysBetween, eachNight, dubaiToday } = dates;
const { formatAed } = format;

// ---------------------------------------------------------------- fils.ts

test("assertFils accepts non-negative safe integers and names the label when it throws", () => {
  assert.doesNotThrow(() => assertFils(0, "zero"));
  assert.doesNotThrow(() => assertFils(Number.MAX_SAFE_INTEGER, "max"));
  for (const bad of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", null, undefined]) {
    assert.throws(() => assertFils(bad, "grand"), /grand/, `assertFils(${String(bad)})`);
  }
});

test("pct rounds half-up on integer fils, once", () => {
  assert.equal(pct(100000, 500), 5000);
  assert.equal(pct(33333, 500), 1667); // 1666.65 -> up
  assert.equal(pct(10010, 500), 501); // 500.5 -> half-up
  assert.equal(pct(10001, 500), 500); // 500.05 -> down
  assert.equal(pct(0, 3000), 0);
  for (const n of [0, 1, 199, 200, 105000, 987654321]) assert.equal(pct(n, 10000), n);
  assert.equal(pct(105000, 3000), 31500);
  assert.equal(pct(12345, 0), 0);
});

test("pct matches a BigInt reference at the top of the safe range", () => {
  assert.equal(pct(900719925473, 10000), 900719925473); // 900719925473 * 10000 + 5000 < 2^53
  const ref = (a, b) => Number((BigInt(a) * BigInt(b) + 5000n) / 10000n);
  // a * b + 5000 ends in 9999: the quotient is just below a whole number, the worst case for a float division.
  const edges = [
    [900810005001, 9999],
    [900990221667, 9997],
    [9007199254724999, 1],
    [1801800210001, 4999],
    [1158184289287, 7777],
    [1000688723999, 9001],
  ];
  for (const [a, b] of edges) assert.equal(pct(a, b), ref(a, b), `pct(${a}, ${b})`);
});

test("pct throws on an unsafe product, a bad basis-point value or a bad amount", () => {
  assert.throws(() => pct(Number.MAX_SAFE_INTEGER, 2), /safe/);
  assert.throws(() => pct(900719925475, 10000), /safe/);
  for (const bp of [-1, 10001, 1.5, Number.NaN, "500", null]) {
    assert.throws(() => pct(1000, bp), undefined, `bp ${String(bp)}`);
  }
  for (const amount of [-1, 0.5, Number.NaN, "1000"]) {
    assert.throws(() => pct(amount, 500), undefined, `amount ${String(amount)}`);
  }
});

test("percentTextToBp parses decimal text into basis points without float multiplication", () => {
  assert.equal(percentTextToBp("5"), 500);
  assert.equal(percentTextToBp("5.00"), 500);
  assert.equal(percentTextToBp("5.5"), 550);
  assert.equal(percentTextToBp("30"), 3000);
  assert.equal(percentTextToBp("0"), 0);
  assert.equal(percentTextToBp("100"), 10000);
  assert.equal(percentTextToBp("100.00"), 10000);
  assert.equal(percentTextToBp("0.01"), 1);
  assert.equal(percentTextToBp("4.35"), 435); // 4.35 * 100 is 434.99999999999994 as a float
  assert.equal(percentTextToBp("33.33"), 3333);
  for (const bad of ["5.555", "-1", "101", "100.01", "abc", "", " 5", "5 ", "5.", ".5", "1e2", "+5", "5,5"]) {
    assert.throws(() => percentTextToBp(bad), undefined, `percentTextToBp(${JSON.stringify(bad)})`);
  }
});

test("percentTextToBp accepts a JSON number whose String() form passes the same rule", () => {
  assert.equal(percentTextToBp(5), 500);
  assert.equal(percentTextToBp(5.5), 550);
  assert.equal(percentTextToBp(30), 3000);
  assert.equal(percentTextToBp(4.35), 435);
  assert.equal(percentTextToBp(0), 0);
  for (const bad of [5.555, -1, 101, Number.NaN, Infinity, 1e21, null, undefined, true]) {
    assert.throws(() => percentTextToBp(bad), undefined, `percentTextToBp(${String(bad)})`);
  }
});

test("MIN_CHARGE_FILS is Stripe's AED minimum, 2.00 AED", () => {
  assert.equal(MIN_CHARGE_FILS, 200);
});

// ---------------------------------------------------------------- dates.ts

test("isIsoDate accepts real YYYY-MM-DD days only", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-2-28"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("2026-10-05T00:00:00Z"), false);
  assert.equal(isIsoDate(" 2026-10-05"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate(null), false);
  assert.equal(isIsoDate(20261005), false);
});

test("addDays moves across months, years and leap days in UTC", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(addDays("2026-10-10", 0), "2026-10-10");
  assert.equal(addDays("2026-11-30", -30), "2026-10-31");
  assert.throws(() => addDays("2026-02-30", 1));
  assert.throws(() => addDays("2026-10-10", 1.5));
});

test("daysBetween counts whole days, negative when reversed", () => {
  assert.equal(daysBetween("2026-10-10", "2026-10-13"), 3);
  assert.equal(daysBetween("2026-10-13", "2026-10-10"), -3);
  assert.equal(daysBetween("2026-10-10", "2026-10-10"), 0);
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
  assert.throws(() => daysBetween("2026-10-10", "2026-10-32"));
});

test("eachNight lists the nights in [from, to) and refuses an empty or reversed stay", () => {
  assert.deepEqual(eachNight("2026-10-10", "2026-10-13"), ["2026-10-10", "2026-10-11", "2026-10-12"]);
  assert.deepEqual(eachNight("2026-12-31", "2027-01-01"), ["2026-12-31"]);
  assert.throws(() => eachNight("2026-10-10", "2026-10-10"));
  assert.throws(() => eachNight("2026-10-13", "2026-10-10"));
  assert.throws(() => eachNight("2026-10-10", "nope"));
});

test("dubaiToday reads the calendar day in Asia/Dubai (UTC+4, no daylight saving)", () => {
  assert.equal(dubaiToday(new Date("2026-10-05T20:30:00Z")), "2026-10-06");
  assert.equal(dubaiToday(new Date("2026-10-05T19:59:59Z")), "2026-10-05");
  assert.equal(dubaiToday(new Date("2026-10-05T20:00:00Z")), "2026-10-06");
  assert.equal(dubaiToday(new Date("2026-12-31T20:00:00Z")), "2027-01-01");
  assert.equal(dubaiToday(new Date("2026-06-30T19:59:59Z")), "2026-06-30");
  assert.throws(() => dubaiToday(new Date("nope")));
});

// ---------------------------------------------------------------- format.ts

test("formatAed prints integer fils as AED with Western digits and two decimals", () => {
  assert.equal(formatAed(105000), "AED 1,050.00");
  assert.equal(formatAed(0), "AED 0.00");
  assert.equal(formatAed(5), "AED 0.05");
  assert.equal(formatAed(50), "AED 0.50");
  assert.equal(formatAed(31500), "AED 315.00");
  assert.equal(formatAed(73501), "AED 735.01");
  assert.equal(formatAed(123456789), "AED 1,234,567.89");
  assert.equal(formatAed(Number.MAX_SAFE_INTEGER), "AED 90,071,992,547,409.91");
  assert.match(formatAed(98765432), /^AED [0-9,]+\.[0-9]{2}$/);
  assert.throws(() => formatAed(1.5));
  assert.throws(() => formatAed(-100));
});

// ---------------------------------------------------------------- booking-price.ts (cases 1-17 of plan 04-01)

const { priceBooking } = await loadTs("lib/money/booking-price.ts");

const TODAY = "2026-10-05";

/** One stay. `rates`: one entry per night, a number (rated from the base) or a full NightRate. */
function stay({ from = addDays(TODAY, 60), rates = [100000], base = 100000 } = {}) {
  const nightRates = rates.map((r, i) => {
    const night = addDays(from, i);
    if (r === null) return { night, rateFils: null, source: null, rateId: null };
    if (typeof r === "number") return { night, rateFils: r, source: "base", rateId: null };
    return { night, ...r };
  });
  return { from, to: addDays(from, rates.length), baseRateFils: base, nightRates };
}

function input(over = {}) {
  return {
    today: TODAY,
    adults: 2,
    children: 0,
    infants: 0,
    offers: [],
    picks: [],
    vatBp: 500,
    depositBp: 3000,
    balanceDueDays: 30,
    plan: "deposit",
    ...stay(),
    ...over,
  };
}

const codes = (result) => result.reasons.map((r) => r.code);

test("case 1: PAY-02's example, subtotal 1000 AED, VAT 5 %, deposit 30 %", () => {
  const i = input();
  const r = priceBooking(i);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  const s = r.snapshot;
  assert.equal(s.nightCount, 1);
  assert.equal(s.nightsFils, 100000);
  assert.equal(s.addonsFils, 0);
  assert.equal(s.subtotalFils, 100000);
  assert.equal(s.vatBp, 500);
  assert.equal(s.vatFils, 5000);
  assert.equal(s.grandFils, 105000);
  assert.equal(s.depositBp, 3000);
  assert.equal(s.depositBlock, null);
  assert.deepEqual(s.deposit, { dueNowFils: 31500, balanceFils: 73500, balanceDueDate: addDays(i.from, -30) });
  assert.deepEqual(s.full, { dueNowFils: 105000 });
  assert.equal(s.plan, "deposit");
  assert.equal(s.dueNowFils, 31500);
  assert.equal(s.balanceFils, 73500);
  assert.equal(s.balanceDueDate, addDays(i.from, -30));
  assert.equal(formatAed(s.vatFils), "AED 50.00");
  assert.equal(formatAed(s.grandFils), "AED 1,050.00");
  assert.equal(formatAed(s.dueNowFils), "AED 315.00");
  assert.equal(formatAed(s.balanceFils), "AED 735.00");
});

test("cases 2-4: VAT and deposit each rounded half-up once, balance by subtraction", () => {
  const cases = [
    [33333, { vat: 1667, grand: 35000, deposit: 10500, balance: 24500 }],
    [10010, { vat: 501, grand: 10511, deposit: 3153, balance: 7358 }],
    [10001, { vat: 500, grand: 10501, deposit: 3150, balance: 7351 }],
  ];
  for (const [subtotal, want] of cases) {
    const r = priceBooking(input(stay({ rates: [subtotal] })));
    assert.equal(r.ok, true, `subtotal ${subtotal}`);
    const s = r.snapshot;
    assert.equal(s.subtotalFils, subtotal);
    assert.equal(s.vatFils, want.vat, `vat on ${subtotal}`);
    assert.equal(s.grandFils, want.grand, `grand on ${subtotal}`);
    assert.equal(s.deposit.dueNowFils, want.deposit, `deposit on ${subtotal}`);
    assert.equal(s.deposit.balanceFils, want.balance, `balance on ${subtotal}`);
    assert.equal(s.dueNowFils + s.balanceFils, s.grandFils);
  }
});

test("case 5: each night's rate as 3.2 resolved it, summed in night order with its source and range id", () => {
  const rates = [
    { rateFils: 150000, source: "range", rateId: "range-b" },
    { rateFils: 120000, source: "range", rateId: "range-a" },
    { rateFils: 100000, source: "base", rateId: null },
  ];
  const s0 = stay({ rates, base: 100000 });
  const r = priceBooking(input(s0));
  assert.equal(r.ok, true);
  assert.equal(r.snapshot.nightCount, 3);
  assert.equal(r.snapshot.nightsFils, 370000);
  assert.deepEqual(r.snapshot.nights, [
    { night: s0.from, rateFils: 150000, source: "range", rateId: "range-b" },
    { night: addDays(s0.from, 1), rateFils: 120000, source: "range", rateId: "range-a" },
    { night: addDays(s0.from, 2), rateFils: 100000, source: "base", rateId: null },
  ]);
});

test("case 6: no base rate, or any night without a rate, is no_rate with no snapshot (C-12)", () => {
  const ranged = { rateFils: 120000, source: "range", rateId: "range-a" };
  const noBase = priceBooking(input(stay({ rates: [ranged, ranged], base: null })));
  assert.equal(noBase.ok, false);
  assert.deepEqual(noBase.reasons, [{ code: "no_rate" }]);
  assert.equal(noBase.snapshot, null);

  const gap = priceBooking(input(stay({ rates: [100000, null, 100000], base: 100000 })));
  assert.equal(gap.ok, false);
  assert.deepEqual(gap.reasons, [{ code: "no_rate" }]);
  assert.equal(gap.snapshot, null);
});

test("case 6b: night rows that do not match the stay's nights are a caller error and throw", () => {
  const s0 = stay({ rates: [100000, 100000, 100000] });
  const [a, b, c] = s0.nightRates;
  const extra = { ...c, night: addDays(c.night, 1) };
  for (const nightRates of [[a, b], [a, b, c, extra], [a, c, b], [b, a, c], [a, b, extra], []]) {
    assert.throws(() => priceBooking(input({ ...s0, nightRates })), /night/);
  }
});

test("case 7: a person add-on counts adults, children and infants (D-46)", () => {
  const offers = [{ id: "addon-person", unit: "person", priceFils: 10000 }];
  const guests = { adults: 2, children: 1, infants: 1 };
  const r = priceBooking(input({ ...guests, offers, picks: [{ id: "addon-person", quantity: 4 }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.snapshot.lines, [
    { id: "addon-person", unit: "person", unitPriceFils: 10000, quantity: 4, lineFils: 40000 },
  ]);
  assert.equal(r.snapshot.addonsFils, 40000);
  assert.equal(r.snapshot.subtotalFils, 140000);
  assert.equal(r.snapshot.vatFils, 7000); // VAT on the subtotal, nights and add-ons together

  const over = priceBooking(input({ ...guests, offers, picks: [{ id: "addon-person", quantity: 5 }] }));
  assert.equal(over.ok, false);
  assert.deepEqual(over.reasons, [{ code: "addon_quantity", id: "addon-person", max: 4 }]);
  assert.deepEqual(over.snapshot.lines, []);
});

test("case 8: a night add-on is capped at the nights, a trip add-on at one", () => {
  const offers = [
    { id: "addon-night", unit: "night", priceFils: 5000 },
    { id: "addon-trip", unit: "trip", priceFils: 7000 },
  ];
  const three = stay({ rates: [100000, 100000, 100000] });
  const ok = priceBooking(input({ ...three, offers, picks: [{ id: "addon-night", quantity: 3 }, { id: "addon-trip", quantity: 1 }] }));
  assert.equal(ok.ok, true);
  assert.equal(ok.snapshot.addonsFils, 3 * 5000 + 7000);

  const night = priceBooking(input({ ...three, offers, picks: [{ id: "addon-night", quantity: 4 }] }));
  assert.deepEqual(night.reasons, [{ code: "addon_quantity", id: "addon-night", max: 3 }]);

  const trip = priceBooking(input({ ...three, offers, picks: [{ id: "addon-trip", quantity: 2 }] }));
  assert.deepEqual(trip.reasons, [{ code: "addon_quantity", id: "addon-trip", max: 1 }]);
});

test("case 9: unknown or repeated picks are unavailable, zero picks are dropped, bad quantities refused", () => {
  const offers = [
    { id: "addon-person", unit: "person", priceFils: 10000 },
    { id: "addon-trip", unit: "trip", priceFils: 7000 },
  ];
  const unknown = priceBooking(input({ offers, picks: [{ id: "addon-gone", quantity: 1 }] }));
  assert.equal(unknown.ok, false);
  assert.deepEqual(unknown.reasons, [{ code: "addon_unavailable", id: "addon-gone" }]);
  assert.notEqual(unknown.snapshot, null);

  const twice = priceBooking(input({
    offers,
    picks: [{ id: "addon-trip", quantity: 1 }, { id: "addon-person", quantity: 1 }, { id: "addon-trip", quantity: 1 }],
  }));
  assert.deepEqual(twice.reasons, [{ code: "addon_unavailable", id: "addon-trip" }]);
  assert.deepEqual(twice.snapshot.lines.map((l) => l.id), ["addon-person"]);

  const zero = priceBooking(input({ offers, picks: [{ id: "addon-person", quantity: 0 }, { id: "addon-trip", quantity: 1 }] }));
  assert.equal(zero.ok, true);
  assert.deepEqual(zero.snapshot.lines.map((l) => [l.id, l.quantity]), [["addon-trip", 1]]);

  for (const quantity of [-1, 1.5, Number.NaN, "1"]) {
    const bad = priceBooking(input({ offers, picks: [{ id: "addon-person", quantity }] }));
    assert.equal(bad.ok, false, `quantity ${String(quantity)}`);
    assert.deepEqual(bad.reasons, [{ code: "addon_quantity", id: "addon-person", max: 2 }]);
  }
});

test("case 10: plan full charges the grand total now; the deposit option is still computed", () => {
  const r = priceBooking(input({ plan: "full" }));
  assert.equal(r.ok, true);
  const s = r.snapshot;
  assert.equal(s.plan, "full");
  assert.equal(s.dueNowFils, 105000);
  assert.equal(s.balanceFils, 0);
  assert.equal(s.balanceDueDate, null);
  assert.deepEqual(s.full, { dueNowFils: 105000 });
  assert.deepEqual(s.deposit, { dueNowFils: 31500, balanceFils: 73500, balanceDueDate: addDays(input().from, -30) });
});

test("case 11: a missing VAT % or deposit % is settings_missing, never a default of 0", () => {
  for (const over of [{ vatBp: null }, { depositBp: null }, { vatBp: null, depositBp: null }]) {
    const r = priceBooking(input(over));
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, [{ code: "settings_missing" }]);
    assert.equal(r.snapshot, null);
  }
  const both = priceBooking(input({ vatBp: null, ...stay({ base: null }) }));
  assert.deepEqual(codes(both), ["settings_missing", "no_rate"]);
  assert.equal(both.snapshot, null);
});

test("case 12: no balance-due days blocks the deposit (no_due_days) and leaves full payment open", () => {
  const full = priceBooking(input({ balanceDueDays: null, plan: "full" }));
  assert.equal(full.ok, true);
  assert.equal(full.snapshot.deposit, null);
  assert.equal(full.snapshot.depositBlock, "no_due_days");
  assert.equal(full.snapshot.dueNowFils, 105000);

  const deposit = priceBooking(input({ balanceDueDays: null, plan: "deposit" }));
  assert.equal(deposit.ok, false);
  assert.deepEqual(deposit.reasons, [{ code: "deposit_unavailable", cause: "no_due_days" }]);
  assert.equal(deposit.snapshot.deposit, null);
  assert.equal(deposit.snapshot.depositBlock, "no_due_days");
});

test("case 13: B-21, arrival sooner than the balance-due days means full payment only", () => {
  const close = stay({ from: addDays(TODAY, 29) });
  const tooClose = priceBooking(input({ ...close, plan: "full" }));
  assert.equal(tooClose.ok, true);
  assert.equal(tooClose.snapshot.depositBlock, "too_close_to_arrival");
  assert.equal(tooClose.snapshot.deposit, null);
  const asked = priceBooking(input({ ...close, plan: "deposit" }));
  assert.deepEqual(asked.reasons, [{ code: "deposit_unavailable", cause: "too_close_to_arrival" }]);

  const exact = priceBooking(input(stay({ from: addDays(TODAY, 30) })));
  assert.equal(exact.ok, true);
  assert.equal(exact.snapshot.depositBlock, null);
  assert.equal(exact.snapshot.deposit.balanceDueDate, TODAY);
  assert.equal(exact.snapshot.balanceDueDate, TODAY);
});

test("case 14: a 0 % deposit is not a deposit (zero_deposit)", () => {
  const r = priceBooking(input({ depositBp: 0, plan: "full" }));
  assert.equal(r.ok, true);
  assert.equal(r.snapshot.depositBlock, "zero_deposit");
  assert.equal(r.snapshot.deposit, null);
  assert.equal(r.snapshot.depositBp, 0);
});

test("case 15: no deposit or balance under the minimum charge; due now under it is refused", () => {
  const smallDeposit = priceBooking(input({ ...stay({ rates: [500] }), vatBp: 0, plan: "full" })); // deposit 150
  assert.equal(smallDeposit.ok, true);
  assert.equal(smallDeposit.snapshot.depositBlock, "balance_below_minimum");

  const smallBalance = priceBooking(input({ ...stay({ rates: [10000] }), vatBp: 0, depositBp: 9900, plan: "full" })); // balance 100
  assert.equal(smallBalance.snapshot.depositBlock, "balance_below_minimum");

  const whole = priceBooking(input({ depositBp: 10000, plan: "full" })); // balance 0
  assert.equal(whole.snapshot.depositBlock, "balance_below_minimum");

  const atMinimum = priceBooking(input({ ...stay({ rates: [MIN_CHARGE_FILS] }), vatBp: 0, plan: "full" }));
  assert.equal(atMinimum.ok, true);
  assert.equal(atMinimum.snapshot.dueNowFils, 200);

  const under = priceBooking(input({ ...stay({ rates: [150] }), vatBp: 0, plan: "full" }));
  assert.equal(under.ok, false);
  assert.deepEqual(under.reasons, [{ code: "below_minimum_charge" }]);
  assert.notEqual(under.snapshot, null);

  const zero = priceBooking(input({ ...stay({ rates: [0] }), base: 0, plan: "full" }));
  assert.deepEqual(codes(zero), ["below_minimum_charge"]);
});

test("deposit blocks are checked in the plan's order", () => {
  const block = (over) => priceBooking(input({ plan: "full", ...over })).snapshot.depositBlock;
  assert.equal(block({ balanceDueDays: null, depositBp: 0 }), "no_due_days");
  assert.equal(block({ depositBp: 0, ...stay({ from: addDays(TODAY, 1) }) }), "zero_deposit");
  assert.equal(block({ ...stay({ from: addDays(TODAY, 1), rates: [100] }) }), "too_close_to_arrival");
});

test("case 16: dates that are not ISO, not in order, or before today are dates_invalid; arrival today is fine", () => {
  const bad = [
    { from: "2026-12-5", to: "2026-12-07", nightRates: [] },
    { from: "2026-12-05", to: "2026-12-32", nightRates: [] },
    { from: "2026-12-05", to: "2026-12-05", nightRates: [] },
    { from: "2026-12-06", to: "2026-12-05", nightRates: [] },
    stay({ from: addDays(TODAY, -1) }),
  ];
  for (const over of bad) {
    const r = priceBooking(input(over));
    assert.equal(r.ok, false, JSON.stringify([over.from, over.to]));
    assert.deepEqual(r.reasons, [{ code: "dates_invalid" }]);
    assert.equal(r.snapshot, null);
  }
  const arrivingToday = priceBooking(input({ ...stay({ from: TODAY }), plan: "full" }));
  assert.equal(arrivingToday.ok, true);
  assert.equal(arrivingToday.snapshot.depositBlock, "too_close_to_arrival");
});

test("several reasons come back together", () => {
  const offers = [{ id: "addon-trip", unit: "trip", priceFils: 7000 }];
  const r = priceBooking(input({
    ...stay({ from: addDays(TODAY, 10) }),
    offers,
    picks: [{ id: "addon-trip", quantity: 2 }, { id: "addon-gone", quantity: 1 }],
    plan: "deposit",
  }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons, [
    { code: "addon_quantity", id: "addon-trip", max: 1 },
    { code: "addon_unavailable", id: "addon-gone" },
    { code: "deposit_unavailable", cause: "too_close_to_arrival" },
  ]);
  // A refused deposit leaves a snapshot that describes the only payable plan: full.
  assert.equal(r.snapshot.plan, "full");
  assert.equal(r.snapshot.dueNowFils, r.snapshot.grandFils);
  assert.equal(r.snapshot.balanceFils, 0);
  assert.equal(r.snapshot.balanceDueDate, null);
});

test("caller errors throw instead of pricing: guests, today, offers, settings shapes, plan", () => {
  const offer = { id: "addon-trip", unit: "trip", priceFils: 7000 };
  const bad = [
    { adults: -1 },
    { children: 1.5 },
    { infants: Number.NaN },
    { today: "2026-10-5" },
    { offers: [offer, offer] },
    { offers: [{ ...offer, unit: "stay" }] },
    { offers: [{ ...offer, priceFils: -1 }] },
    { offers: [{ ...offer, priceFils: 10.5 }] },
    { vatBp: 10001 },
    { depositBp: 1.5 },
    { balanceDueDays: -1 },
    { balanceDueDays: 2.5 },
    { plan: "half" },
    { baseRateFils: -100 },
    stay({ rates: [{ rateFils: 100000, source: null, rateId: null }] }),
    stay({ rates: [{ rateFils: 1.5, source: "base", rateId: null }] }),
  ];
  for (const over of bad) assert.throws(() => priceBooking(input(over)), undefined, JSON.stringify(over));
});

test("WR-01: a malformed pick from the browser is addon_unavailable with String(id), never a throw", () => {
  const offers = [{ id: "addon-trip", unit: "trip", priceFils: 7000 }];
  const cases = [
    [[null], ["null"]],
    [[{ id: 5, quantity: 1 }], ["5"]],
    [[{ id: 5, quantity: 0 }], ["5"]],
    [[7, "addon-trip", true], ["7", "addon-trip", "true"]],
    [[{ quantity: 1 }, [1], undefined], ["undefined"]],
    [[{ id: null, quantity: 1 }, { id: { x: 1 }, quantity: 1 }], ["null", "[object Object]"]],
  ];
  for (const [picks, ids] of cases) {
    let r;
    assert.doesNotThrow(() => {
      r = priceBooking(input({ offers, picks }));
    }, JSON.stringify(picks));
    assert.equal(r.ok, false, JSON.stringify(picks));
    assert.deepEqual(r.reasons, ids.map((id) => ({ code: "addon_unavailable", id })), JSON.stringify(picks));
    assert.notEqual(r.snapshot, null);
    assert.deepEqual(r.snapshot.lines, []);
  }

  const mixed = priceBooking(input({ offers, picks: [null, { id: "addon-trip", quantity: 1 }] }));
  assert.deepEqual(mixed.reasons, [{ code: "addon_unavailable", id: "null" }]);
  assert.deepEqual(mixed.snapshot.lines.map((l) => l.id), ["addon-trip"]);

  // The list itself must be an array: 04-02 builds it from its parsed request body (contract note in 04-01-SUMMARY).
  assert.throws(() => priceBooking(input({ picks: null })), /picks/);
  assert.throws(() => priceBooking(input({ picks: { id: "addon-trip", quantity: 1 } })), /picks/);
});

test("WR-02: a guest total beyond exact arithmetic is too_large (guests), never a throw", () => {
  const tooMany = [{ code: "too_large", field: "guests", max: Number.MAX_SAFE_INTEGER }];
  for (const over of [
    { adults: Number.MAX_SAFE_INTEGER, children: 1 },
    { adults: 9e15, children: 9e15, infants: 9e15 },
  ]) {
    let r;
    assert.doesNotThrow(() => {
      r = priceBooking(input(over));
    }, JSON.stringify(over));
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, tooMany);
    assert.equal(r.snapshot, null);
  }
  // At the bound the guests are counted; the business limit (1..99, 0..99) is 04-02's request check.
  const atBound = priceBooking(input({ adults: Number.MAX_SAFE_INTEGER - 2, children: 1, infants: 1, plan: "full" }));
  assert.equal(atBound.ok, true);
  const person = [{ id: "addon-person", unit: "person", priceFils: 10000 }];
  const big = priceBooking(input({ adults: 9e15, offers: person, picks: [{ id: "addon-person", quantity: 2 }] }));
  assert.equal(big.ok, true);
  assert.equal(big.snapshot.addonsFils, 20000);
});

test("WR-02: an amount above MAX_AMOUNT_FILS is too_large (amount), never a throw or a wrong rounding", () => {
  const M = MAX_AMOUNT_FILS;
  assert.equal(M, 450359962736);
  assert.ok(Number.isSafeInteger(2 * M * 10000 + 5000), "a grand total of 2 M still goes through pct()");
  assert.equal(Number.isSafeInteger((2 * M + 2) * 10000 + 5000), false);

  const tooLarge = [{ code: "too_large", field: "amount", max: M }];
  const person = (priceFils) => [{ id: "addon-person", unit: "person", priceFils }];
  const cases = {
    "one night above M": input({ ...stay({ rates: [M + 1] }), plan: "full" }),
    "nights summed above M": input({ ...stay({ rates: [M, 1] }), plan: "full" }),
    "a person line above M": input({ adults: 9e15, offers: person(10000), picks: [{ id: "addon-person", quantity: 9e15 }] }),
    "a line whose product is not even safe": input({
      adults: 4,
      offers: person(Number.MAX_SAFE_INTEGER),
      picks: [{ id: "addon-person", quantity: 4 }],
    }),
    "add-ons summed above M": input({
      ...stay({ rates: [0] }),
      offers: [{ id: "a", unit: "trip", priceFils: M }, { id: "b", unit: "trip", priceFils: 1 }],
      picks: [{ id: "a", quantity: 1 }, { id: "b", quantity: 1 }],
    }),
    "nights plus add-ons above M": input({
      ...stay({ rates: [M] }),
      offers: [{ id: "c", unit: "trip", priceFils: 1 }],
      picks: [{ id: "c", quantity: 1 }],
    }),
  };
  for (const [label, i] of Object.entries(cases)) {
    let r;
    assert.doesNotThrow(() => {
      r = priceBooking(i);
    }, label);
    assert.equal(r.ok, false, label);
    assert.deepEqual(r.reasons, tooLarge, label);
    assert.equal(r.snapshot, null, label);
  }

  // A subtotal of exactly M prices exactly, even at 100 % VAT and a 100 % deposit.
  const top = priceBooking(input({ ...stay({ rates: [M] }), vatBp: 10000, depositBp: 10000, plan: "full" }));
  assert.equal(top.ok, true);
  assert.equal(top.snapshot.grandFils, 2 * M);
  assert.equal(top.snapshot.depositBlock, "balance_below_minimum");
});

// ---------------------------------------------------------------- case 17: property loop against a BigInt reference

const DAY = 86_400_000;
/** `day` + `n` days, written here with Date.UTC so the reference does not lean on lib/money/dates.ts. */
const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const bigPct = (amount, bp) => (amount * BigInt(bp) + 5000n) / 10000n;

/** The whole price worked out again in BigInt from the plan's rules (B-05, B-15, B-21, D-46). */
function referencePrice(i, lead) {
  const MIN = BigInt(MIN_CHARGE_FILS);
  const nightCount = i.nightRates.length;
  const nightsFils = i.nightRates.reduce((t, n) => t + BigInt(n.rateFils), 0n);
  const guests = i.adults + i.children + i.infants;
  const offers = new Map(i.offers.map((o) => [o.id, o]));
  const reasons = [];
  const lines = [];
  let addonsFils = 0n;
  for (const p of i.picks) {
    if (p.quantity === 0) continue;
    const o = offers.get(p.id);
    const max = o.unit === "person" ? guests : o.unit === "night" ? nightCount : 1;
    if (p.quantity > max) {
      reasons.push({ code: "addon_quantity", id: p.id, max });
      continue;
    }
    const lineFils = BigInt(o.priceFils) * BigInt(p.quantity);
    addonsFils += lineFils;
    lines.push({ id: o.id, unit: o.unit, unitPriceFils: o.priceFils, quantity: p.quantity, lineFils: Number(lineFils) });
  }
  const subtotalFils = nightsFils + addonsFils;
  const vatFils = bigPct(subtotalFils, i.vatBp);
  const grandFils = subtotalFils + vatFils;
  const depositFils = bigPct(grandFils, i.depositBp);
  const restFils = grandFils - depositFils;
  const N = i.balanceDueDays;
  let depositBlock = null;
  if (N === null) depositBlock = "no_due_days";
  else if (i.depositBp === 0) depositBlock = "zero_deposit";
  else if (lead < N) depositBlock = "too_close_to_arrival";
  else if (depositFils < MIN || restFils < MIN) depositBlock = "balance_below_minimum";
  const deposit =
    depositBlock === null
      ? { dueNowFils: Number(depositFils), balanceFils: Number(restFils), balanceDueDate: shift(i.from, -N) }
      : null;
  const onDeposit = i.plan === "deposit" && deposit !== null;
  if (i.plan === "deposit" && !onDeposit) reasons.push({ code: "deposit_unavailable", cause: depositBlock });
  const dueNow = onDeposit ? depositFils : grandFils;
  if (dueNow < MIN) reasons.push({ code: "below_minimum_charge" });
  return {
    reasons,
    snapshot: {
      nights: i.nightRates.map((n) => ({ night: n.night, rateFils: n.rateFils, source: n.source, rateId: n.rateId })),
      nightCount,
      nightsFils: Number(nightsFils),
      lines,
      addonsFils: Number(addonsFils),
      subtotalFils: Number(subtotalFils),
      vatBp: i.vatBp,
      vatFils: Number(vatFils),
      grandFils: Number(grandFils),
      depositBp: i.depositBp,
      deposit,
      depositBlock,
      full: { dueNowFils: Number(grandFils) },
      plan: onDeposit ? "deposit" : "full",
      dueNowFils: Number(dueNow),
      balanceFils: onDeposit ? Number(restFils) : 0,
      balanceDueDate: onDeposit ? deposit.balanceDueDate : null,
    },
  };
}

test("case 17: seeded property loop, 5,000 draws of whole bookings against a BigInt reference", () => {
  let state = 0x04012026;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  // Scale by the high bits: the low bits of a power-of-two LCG repeat with a short period, so `% small` would cycle.
  const draw = (lo, hi) => lo + Math.floor((next() / 4294967296) * (hi - lo + 1));
  const pickOne = (list) => list[draw(0, list.length - 1)];
  const TODAYS = ["2026-10-05", "2026-12-31", "2027-02-27", "2028-02-28"];
  const units = ["person", "night", "trip"];
  const seen = { units: new Set(), leadVsN: new Set(), blocks: new Set(), addonVat: 0 };

  for (let k = 0; k < 5000; k += 1) {
    const today = pickOne(TODAYS);
    const N = pickOne([null, 0, 1, 7, 30, 30, 60, draw(1, 120)]);
    const lead = Math.max(0, N === null ? pickOne([0, 29, 30, 31]) : pickOne([N - 1, N, N + 1, 0]));
    const from = shift(today, lead);
    const nightCount = draw(1, 5);
    const nightRates = [];
    for (let n = 0; n < nightCount; n += 1) {
      const rateFils = pickOne([0, 1, 199, 200, 33333, 10001, draw(0, 2e8), draw(0, 2e8)]);
      const ranged = draw(0, 1) === 1;
      nightRates.push({ night: shift(from, n), rateFils, source: ranged ? "range" : "base", rateId: ranged ? `range-${n}` : null });
    }
    const adults = draw(1, 6);
    const children = draw(0, 4);
    const infants = draw(0, 3);
    const offers = [];
    const picks = [];
    const offerCount = draw(0, 3);
    for (let o = 0; o < offerCount; o += 1) {
      const unit = units[(o + draw(0, 2)) % 3];
      const id = `addon-${o}`;
      offers.push({ id, unit, priceFils: pickOne([0, 1, 100, 7000, draw(0, 1e7)]) });
      const max = unit === "person" ? adults + children + infants : unit === "night" ? nightCount : 1;
      picks.push({ id, quantity: Math.max(0, pickOne([max, max, max - 1, max + 1, 0])) });
      seen.units.add(unit);
    }
    const i = {
      from,
      to: shift(from, nightCount),
      today,
      adults,
      children,
      infants,
      baseRateFils: pickOne([0, 100000, draw(0, 2e8)]),
      nightRates,
      offers,
      picks,
      vatBp: pickOne([0, 1, 500, 9999, 10000, draw(0, 10000)]),
      depositBp: pickOne([0, 1, 3000, 9999, 10000, draw(1, 10000)]),
      balanceDueDays: N,
      plan: draw(0, 1) === 0 ? "deposit" : "full",
    };
    const label = JSON.stringify({ ...i, nightRates: nightRates.map((n) => n.rateFils) });
    const got = priceBooking(i);
    const want = referencePrice(i, lead);
    assert.notEqual(got.snapshot, null, label);
    for (const key of ["nightsFils", "addonsFils", "subtotalFils", "vatFils", "grandFils", "dueNowFils", "balanceFils"]) {
      assert.ok(Number.isSafeInteger(got.snapshot[key]) && got.snapshot[key] >= 0, `${key} ${label}`);
    }
    assert.deepEqual(got.snapshot, want.snapshot, label);
    assert.deepEqual(got.reasons, want.reasons, label);
    assert.equal(got.ok, want.reasons.length === 0, label);
    assert.equal(got.snapshot.dueNowFils + got.snapshot.balanceFils, got.snapshot.grandFils, label);
    if (got.snapshot.deposit) {
      assert.equal(got.snapshot.deposit.dueNowFils + got.snapshot.deposit.balanceFils, got.snapshot.grandFils, label);
    }

    if (N !== null) seen.leadVsN.add(lead < N ? "before" : lead === N ? "at" : "after");
    seen.blocks.add(String(got.snapshot.depositBlock));
    if (got.snapshot.addonsFils > 0 && i.vatBp > 0) seen.addonVat += 1;
  }

  // The draws reached what they are meant to reach.
  assert.deepEqual([...seen.units].sort(), ["night", "person", "trip"]);
  assert.deepEqual([...seen.leadVsN].sort(), ["after", "at", "before"]);
  assert.deepEqual(
    [...seen.blocks].sort(),
    ["balance_below_minimum", "no_due_days", "null", "too_close_to_arrival", "zero_deposit"],
  );
  assert.ok(seen.addonVat > 1000, `VAT on add-ons exercised ${seen.addonVat} times`);
});

test("case 17 edges: one night at the extremes of subtotal and percent", () => {
  for (const [subtotal, vatBp, depositBp] of [[0, 0, 1], [0, 10000, 10000], [1e9, 10000, 10000], [1e9, 0, 1], [1, 10000, 1]]) {
    for (const plan of ["deposit", "full"]) {
      const i = input({ ...stay({ rates: [subtotal] }), vatBp, depositBp, plan });
      const got = priceBooking(i);
      const want = referencePrice(i, daysBetween(TODAY, i.from));
      assert.deepEqual(got.snapshot, want.snapshot, `${subtotal} ${vatBp} ${depositBp} ${plan}`);
      assert.deepEqual(got.reasons, want.reasons, `${subtotal} ${vatBp} ${depositBp} ${plan}`);
    }
  }
});
