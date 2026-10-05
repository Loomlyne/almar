// Plan 04-01: the money engine in lib/money (B-05, B-06, B-21, PAY-01/02/03).
// Every amount here is a symbolic test value in fils (1 AED = 100 fils), not a real price, rate or fee.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const fils = await loadTs("lib/money/fils.ts");
const dates = await loadTs("lib/money/dates.ts");
const format = await loadTs("lib/money/format.ts");

const { pct, percentTextToBp, assertFils, MIN_CHARGE_FILS } = fils;
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
