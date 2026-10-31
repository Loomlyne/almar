// Phase 5 plan 05-01 Task 2: the agreed-price entry of the money engine (P5-02): splitAgreedFils, priceAgreedBooking and
// snapshotRow taking its result. WRITTEN, NOT RUN under the owner's no-test rule (2026-10-21); the controller runs it.
// Every amount here is a symbolic test value in fils (1 AED = 100 fils), not a real price, rate or fee.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const dates = await loadTs("lib/money/dates.ts");
const fils = await loadTs("lib/money/fils.ts");
const { splitAgreedFils, priceAgreedBooking, priceBooking } = await loadTs("lib/money/booking-price.ts");
const { snapshotRow } = await loadTs("lib/booking/server.ts");
const { addDays } = dates;
const { MAX_AMOUNT_FILS, MIN_CHARGE_FILS } = fils;

const TODAY = "2026-10-05";
const FROM = addDays(TODAY, 60);

function agreed(over = {}) {
  return {
    from: FROM,
    to: addDays(FROM, 3),
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
    agreedNightsFils: 300000, // symbolic: 3000.00 AED for the stay before VAT
    ...over,
  };
}

/** The same stay priced the ordinary way: three nights at a symbolic 100000 fils. */
function rated(over = {}) {
  const { agreedNightsFils: _unused, ...rest } = agreed();
  return {
    ...rest,
    baseRateFils: 100000,
    nightRates: [0, 1, 2].map((i) => ({ night: addDays(FROM, i), rateFils: 100000, source: "base", rateId: null })),
    ...over,
  };
}

test("splitAgreedFils: the first night takes the remainder and the parts always add up", () => {
  assert.deepEqual(splitAgreedFils(100000, 3), [33334, 33333, 33333]);
  assert.deepEqual(splitAgreedFils(100000, 4), [25000, 25000, 25000, 25000]);
  assert.deepEqual(splitAgreedFils(2, 3), [2, 0, 0]);
  assert.deepEqual(splitAgreedFils(0, 2), [0, 0]);
  assert.deepEqual(splitAgreedFils(7, 1), [7]);
  for (const total of [1, 2, 3, 99, 100000, 123457, 987654321]) {
    for (const n of [1, 2, 3, 7, 30]) {
      const parts = splitAgreedFils(total, n);
      assert.equal(parts.length, n);
      assert.equal(parts.reduce((a, b) => a + b, 0), total, `${total} over ${n}`);
      assert.ok(parts.every((p) => Number.isSafeInteger(p) && p >= 0));
    }
  }
});

test("splitAgreedFils throws on a bad total or night count", () => {
  for (const bad of [-1, 1.5, Number.NaN, "100", null]) assert.throws(() => splitAgreedFils(bad, 3), undefined, `total ${String(bad)}`);
  for (const bad of [0, -1, 1.5, Number.NaN, "3", null]) assert.throws(() => splitAgreedFils(1000, bad), undefined, `nights ${String(bad)}`);
});

test("priceAgreedBooking: nights are agreed, with no rate id, and add up to the typed price", () => {
  const r = priceAgreedBooking(agreed());
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.snapshot.nightCount, 3);
  assert.equal(r.snapshot.nightsFils, 300000);
  assert.deepEqual(
    r.snapshot.nights.map((n) => [n.night, n.rateFils, n.source, n.rateId]),
    [0, 1, 2].map((i) => [addDays(FROM, i), 100000, "agreed", null]),
  );
});

test("priceAgreedBooking: VAT, deposit and balance come out exactly as for the same night sum at rates", () => {
  const a = priceAgreedBooking(agreed());
  const b = priceBooking(rated());
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const { nights: _an, ...aRest } = a.snapshot;
  const { nights: _bn, ...bRest } = b.snapshot;
  assert.deepEqual(aRest, bRest);
  assert.equal(a.snapshot.vatFils, 15000); // 5 % of 300000
  assert.equal(a.snapshot.grandFils, 315000);
  assert.equal(a.snapshot.dueNowFils, 94500); // 30 % of 315000
  assert.equal(a.snapshot.balanceFils, 220500);
  assert.equal(a.snapshot.balanceDueDate, addDays(FROM, -30));
});

test("priceAgreedBooking: the full plan adds up the same way", () => {
  const a = priceAgreedBooking(agreed({ plan: "full" }));
  const b = priceBooking(rated({ plan: "full" }));
  assert.equal(a.ok, true);
  assert.equal(a.snapshot.plan, "full");
  assert.equal(a.snapshot.dueNowFils, b.snapshot.dueNowFils);
  assert.equal(a.snapshot.dueNowFils, 315000);
  assert.equal(a.snapshot.balanceFils, 0);
});

test("priceAgreedBooking: add-ons price as usual and VAT is on the subtotal", () => {
  const offers = [{ id: "boat", unit: "person", priceFils: 25000 }]; // symbolic
  const picks = [{ id: "boat", quantity: 2 }];
  const a = priceAgreedBooking(agreed({ offers, picks }));
  const b = priceBooking(rated({ offers, picks }));
  assert.equal(a.ok, true);
  assert.equal(a.snapshot.addonsFils, 50000);
  assert.equal(a.snapshot.subtotalFils, 350000);
  assert.equal(a.snapshot.grandFils, b.snapshot.grandFils);
  assert.deepEqual(a.snapshot.lines, b.snapshot.lines);
});

test("priceAgreedBooking never answers no_rate, whatever the total", () => {
  for (const total of [1, 2, 199, 300000, MAX_AMOUNT_FILS, MAX_AMOUNT_FILS + 1]) {
    const r = priceAgreedBooking(agreed({ agreedNightsFils: total }));
    assert.ok(!r.reasons.some((x) => x.code === "no_rate"), `total ${total}`);
  }
});

test("priceAgreedBooking: bad or reversed dates are dates_invalid and never throw", () => {
  const cases = [
    { from: "2026-13-40" },
    { to: FROM }, // zero nights
    { to: addDays(FROM, -1) }, // reversed
    { from: addDays(TODAY, -1), to: TODAY }, // in the past
    { from: "not a day" },
  ];
  for (const over of cases) {
    let r;
    assert.doesNotThrow(() => (r = priceAgreedBooking(agreed(over))), JSON.stringify(over));
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, [{ code: "dates_invalid" }]);
    assert.equal(r.snapshot, null);
  }
});

test("priceAgreedBooking: settings missing is refused with no snapshot", () => {
  const r = priceAgreedBooking(agreed({ vatBp: null }));
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.code === "settings_missing"));
  assert.equal(r.snapshot, null);
  const d = priceAgreedBooking(agreed({ depositBp: null }));
  assert.ok(d.reasons.some((x) => x.code === "settings_missing"));
});

test("priceAgreedBooking: above MAX_AMOUNT_FILS is too_large with no snapshot", () => {
  const r = priceAgreedBooking(agreed({ agreedNightsFils: MAX_AMOUNT_FILS + 1 }));
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.code === "too_large" && x.field === "amount"));
  assert.equal(r.snapshot, null);
  assert.equal(priceAgreedBooking(agreed({ agreedNightsFils: MAX_AMOUNT_FILS })).snapshot !== undefined, true);
});

test("priceAgreedBooking: below the 2.00 AED floor is below_minimum_charge, with the snapshot for display", () => {
  const r = priceAgreedBooking(agreed({ agreedNightsFils: 100, plan: "full" })); // 100 + 5 VAT = 105 fils due now
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.code === "below_minimum_charge"));
  assert.ok(r.snapshot && r.snapshot.dueNowFils < MIN_CHARGE_FILS);
  assert.ok(r.snapshot.nights.every((n) => n.source === "agreed" && n.rateId === null));
});

test("priceAgreedBooking throws a RangeError on a zero, negative or non-integer total", () => {
  for (const bad of [0, -1, -100000, 1.5, 100000.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "300000", null, undefined]) {
    assert.throws(() => priceAgreedBooking(agreed({ agreedNightsFils: bad })), RangeError, `total ${String(bad)}`);
  }
});

test("snapshotRow takes an agreed snapshot: rate_id null, source agreed, no throw", () => {
  const r = priceAgreedBooking(agreed());
  assert.equal(r.ok, true);
  let row;
  assert.doesNotThrow(() => (row = snapshotRow(r.snapshot, [])));
  assert.equal(row.nights_fils, 300000);
  assert.equal(row.grand_fils, 315000);
  assert.equal(row.nights_snapshot.length, 3);
  for (const n of row.nights_snapshot) {
    assert.equal(n.source, "agreed");
    assert.equal(n.rate_id, null);
    assert.ok(Number.isSafeInteger(n.rate_fils));
  }
  assert.equal(row.nights_snapshot.reduce((a, n) => a + n.rate_fils, 0), row.nights_fils);
});
