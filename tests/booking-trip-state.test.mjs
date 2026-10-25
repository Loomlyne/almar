// Plan 04-03, Task 1a: trip-format helpers, the bookingStatus copy pin, and the PAY-07 / re_ source rules.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const fmt = await loadTs("lib/booking/trip-format.ts");
const { JOURNEY_COPY } = await loadTs("lib/copy/journey.ts");
const { formatBp, formatIsoDate, holdMsLeft, countdownParts, liveMinute, windowParts, uaeDateTime } = fmt;

test("formatBp: basis points as a percentage", () => {
  assert.equal(formatBp(500), "5");
  assert.equal(formatBp(525), "5.25");
  assert.equal(formatBp(550), "5.5");
  assert.equal(formatBp(0), "0");
  assert.throws(() => formatBp(-1));
  assert.throws(() => formatBp(5.5));
});

test("formatIsoDate: dd/mm/yyyy", () => {
  assert.equal(formatIsoDate("2026-11-02"), "02/11/2026");
  assert.throws(() => formatIsoDate("02/11/2026"));
  assert.throws(() => formatIsoDate("2026-11-02T10:00:00Z"));
});

test("holdMsLeft: capped at 30 minutes, floored at 0", () => {
  const now = Date.parse("2026-11-02T08:00:00Z");
  assert.equal(holdMsLeft("2026-11-02T08:10:00Z", now), 10 * 60 * 1000);
  assert.equal(holdMsLeft("2026-11-02T09:00:00Z", now), 30 * 60 * 1000);
  assert.equal(holdMsLeft("2026-11-02T07:00:00Z", now), 0);
  assert.equal(holdMsLeft("nonsense", now), 0);
});

test("countdownParts: seconds round up", () => {
  assert.deepEqual(countdownParts(1_781_000), { minutes: 29, seconds: 41, text: "29:41" });
  assert.equal(countdownParts(0).text, "00:00");
  assert.equal(countdownParts(1).text, "00:01");
});

test("liveMinute: 10, 5, 1 and the end", () => {
  assert.equal(liveMinute(10 * 60_000), 10);
  assert.equal(liveMinute(5 * 60_000), 5);
  assert.equal(liveMinute(60_000), 1);
  assert.equal(liveMinute(0), 0);
  assert.equal(liveMinute(7 * 60_000), null);
  assert.equal(liveMinute(30 * 60_000), null);
});

test("windowParts: largest whole unit", () => {
  assert.deepEqual(windowParts(35), { unit: "minute", count: 35 });
  assert.deepEqual(windowParts(1440), { unit: "day", count: 1 });
  assert.deepEqual(windowParts(2880), { unit: "day", count: 2 });
  assert.deepEqual(windowParts(120), { unit: "hour", count: 2 });
  assert.deepEqual(windowParts(90), { unit: "minute", count: 90 });
  assert.throws(() => windowParts(0));
  assert.throws(() => windowParts(1.5));
});

test("uaeDateTime: Asia/Dubai date and time from an instant", () => {
  assert.deepEqual(uaeDateTime("2026-11-02T08:05:00Z"), { date: "02/11/2026", time: "12:05" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:30:00Z"), { date: "03/11/2026", time: "00:30" });
  assert.deepEqual(uaeDateTime("2026-12-31T21:15:00.000Z"), { date: "01/01/2027", time: "01:15" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:00:00+00:00"), { date: "03/11/2026", time: "00:00" });
  assert.deepEqual(uaeDateTime("2026-11-02T20:30:00.123456+00:00"), { date: "03/11/2026", time: "00:30" });
  assert.deepEqual(uaeDateTime("2026-11-02T10:00:00+04:00"), { date: "02/11/2026", time: "10:00" });
  for (const iso of ["2026-11-02T08:05:00Z", "2026-11-02T20:30:00Z", "2026-12-31T21:15:00.000Z"]) {
    const r = uaeDateTime(iso);
    assert.match(r.date, /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/);
    assert.match(r.time, /^[0-9]{2}:[0-9]{2}$/);
  }
  for (const bad of ["2026-11-02", "2026-11-02T10:00:00", "", "not a date"]) {
    assert.throws(() => uaeDateTime(bad), bad);
  }
});

test("bookingStatus copy pin", () => {
  const keys = ["held", "awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired", "payBy"];
  assert.deepEqual(Object.keys(JOURNEY_COPY.en.bookingStatus).sort(), [...keys].sort());
  assert.deepEqual(JOURNEY_COPY.en.bookingStatus, {
    held: "Not sent yet",
    awaiting_payment: "Awaiting payment",
    deposit_paid: "Deposit paid",
    paid_in_full: "Paid in full",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Request lapsed",
    payBy: "Pay by {date}, {time} UAE time",
  });
  assert.equal(JOURNEY_COPY.ar.bookingStatus.confirmed, "مؤكد");
  assert.equal(JOURNEY_COPY.es.bookingStatus.confirmed, "Confirmado");
  for (const l of ["en", "ar", "es"]) {
    assert.ok(JOURNEY_COPY[l].bookingStatus.payBy.includes("{date}"), l);
    assert.ok(JOURNEY_COPY[l].bookingStatus.payBy.includes("{time}"), l);
  }
});

test("source rules: PAY-07 words and re_", () => {
  const banned =
    /stripe|gift ?cards?|tarjetas? de regalo|بطاقة هدية|bnpl|buy now|pay later|paga después|ادفع لاحقا|tabby|tamara|klarna|afterpay|card number|cvc|cvv|apple pay|checkout/i;
  const files = ["lib/copy/journey.ts"];
  for (const dir of ["components/journey", "components/pages/stay-detail"]) {
    for (const f of readdirSync(dir)) files.push(`${dir}/${f}`);
  }
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, banned, f);
    assert.ok(!text.includes("re_"), `${f} contains re_`);
  }
});
