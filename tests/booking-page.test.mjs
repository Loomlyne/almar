// Plan 04-05 (Task 2): the booking page model (bookingPageModel, one case per behaviour bullet), the page copy, the
// shared-helper rule and the PAY-07 source rule. Tasks 5 and 6 grow the source rules (meta, screen, withdraw call).
// Every amount is a symbolic fixture value in fils (tests/helpers/booking-view-fixtures.ts), never a price.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { bookingPageModel, stayPagePath } = await loadTs("app/bookings/trip/booking-page-model.ts");
const { BOOKING_PAGE_COPY } = await loadTs("lib/copy/booking-page.ts");
const { BOOKING_EMAIL_COPY } = await loadTs("lib/copy/booking-email.ts");
const fx = await loadTs("tests/helpers/booking-view-fixtures.ts");
const { viewFixture, FIXTURE_NOW, VIEW_STATES } = fx;

const LOCALES = ["en", "ar", "es"];

/** Comment lines dropped, as the plan's `nc` filter does. */
function nc(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join("\n");
}

function model(state, overrides = {}, nowMs = FIXTURE_NOW, locale = "en") {
  const view = { ...viewFixture(state, locale), ...overrides };
  return bookingPageModel(view, nowMs);
}

// ---------------------------------------------------------------- transfer block

test("transfer: shown for awaiting_payment (deadline kind) with the view's amount and pay-by time", () => {
  const view = viewFixture("awaiting", "en");
  const m = bookingPageModel(view, FIXTURE_NOW);
  assert.deepEqual(m.transfer, { kind: "deadline", amountFils: view.transfer.amountFils, payBy: view.transfer.payBy, dueBy: null });
});

test("transfer: balance kind on deposit_paid with the balance due date", () => {
  const view = viewFixture("deposit-balance", "en");
  const m = bookingPageModel(view, FIXTURE_NOW);
  assert.equal(m.transfer.kind, "balance");
  assert.equal(m.transfer.dueBy, view.transfer.dueBy);
  assert.equal(m.transfer.payBy, null);
});

test("transfer: shown on confirmed and completed when the view carries one (balance kind)", () => {
  for (const state of ["confirmed", "completed"]) {
    const base = viewFixture("deposit-balance", "en");
    const m = model(state, { transfer: base.transfer });
    assert.equal(m.transfer?.kind, "balance", state);
  }
});

test("transfer: never for paid_in_full, held, cancelled or expired, even when the view carries one (bite P2)", () => {
  const carried = viewFixture("awaiting", "en").transfer;
  for (const state of ["paid-full", "not-sent", "cancelled", "withdrawn", "expired"]) {
    assert.equal(model(state, { transfer: carried }).transfer, null, state);
  }
});

test("transfer: null when the view has none", () => {
  assert.equal(model("awaiting", { transfer: null }).transfer, null);
});

// ---------------------------------------------------------------- stay details (access)

test("showAccess: only confirmed and completed with access in the view", () => {
  assert.equal(model("confirmed").showAccess, true);
  assert.equal(model("completed").showAccess, true);
  assert.equal(model("confirmed", { access: null }).showAccess, false);
});

test("showAccess: a deposit_paid (or any other) view that carries access shows none (bite P1)", () => {
  const access = fx.accessFixture("en");
  for (const state of ["deposit-balance", "paid-full", "awaiting", "part-received", "cancelled", "expired", "not-sent"]) {
    assert.equal(model(state, { access }).showAccess, false, state);
  }
});

test("addressPending: when no access shows and the booking is neither cancelled nor expired", () => {
  assert.equal(model("awaiting").addressPending, true);
  assert.equal(model("paid-full").addressPending, true);
  assert.equal(model("not-sent").addressPending, true);
  assert.equal(model("confirmed").addressPending, false);
  assert.equal(model("cancelled").addressPending, false);
  assert.equal(model("expired").addressPending, false);
});

// ---------------------------------------------------------------- flag lines

test("partReceived: awaiting_payment with flags.partReceived only", () => {
  assert.equal(model("part-received").partReceived, true);
  assert.equal(model("awaiting").partReceived, false);
  assert.equal(model("paid-full", { flags: { partReceived: true, overpaid: false, writtenOff: false } }).partReceived, false);
});

test("nothingMoreDue: stillDue 0 on deposit_paid, paid_in_full, confirmed or completed", () => {
  assert.equal(model("paid-full").nothingMoreDue, true);
  assert.equal(model("confirmed").nothingMoreDue, true);
  assert.equal(model("completed").nothingMoreDue, true);
  assert.equal(model("deposit-balance").nothingMoreDue, false);
  const zero = (state) => {
    const view = viewFixture(state, "en");
    view.money.stillDueFils = 0;
    return bookingPageModel(view, FIXTURE_NOW).nothingMoreDue;
  };
  assert.equal(zero("deposit-balance"), true);
  assert.equal(zero("awaiting"), false);
  assert.equal(zero("cancelled"), false);
  assert.equal(zero("expired"), false);
});

test("acceptedAsPaid and overpaid follow the view's flags", () => {
  assert.equal(model("deposit-balance").acceptedAsPaid, true);
  assert.equal(model("paid-full").acceptedAsPaid, false);
  assert.equal(model("completed").overpaid, true);
  assert.equal(model("confirmed").overpaid, false);
});

test("moneyOnClosed: cancelled or expired with money paid", () => {
  assert.equal(model("cancelled").moneyOnClosed, true);
  assert.equal(model("withdrawn").moneyOnClosed, false);
  assert.equal(model("expired").moneyOnClosed, false);
  const view = viewFixture("expired", "en");
  view.money.paidFils = 111111;
  assert.equal(bookingPageModel(view, FIXTURE_NOW).moneyOnClosed, true);
  assert.equal(bookingPageModel(view, FIXTURE_NOW).status, "expired");
});

test("notSent and finishPath: held only, finishPath = the trip page in the language", () => {
  const m = model("not-sent");
  assert.equal(m.notSent, true);
  assert.equal(m.finishPath, "/en/booking/trip");
  assert.equal(bookingPageModel(viewFixture("not-sent", "ar"), FIXTURE_NOW).finishPath, "/ar/booking/trip");
  assert.equal(model("awaiting").notSent, false);
  assert.equal(model("awaiting").finishPath, null);
});

// ---------------------------------------------------------------- balance line and paths

test("balanceLine: deposit plan, still due, a due date, not awaiting_payment", () => {
  const view = viewFixture("deposit-balance", "en");
  assert.deepEqual(bookingPageModel(view, FIXTURE_NOW).balanceLine, { amountFils: view.money.stillDueFils, dueDate: view.balanceDueDate });
  assert.equal(model("awaiting").balanceLine, null);
  assert.equal(model("part-received").balanceLine, null);
  assert.equal(model("deposit-balance", { plan: "full" }).balanceLine, null);
  assert.equal(model("deposit-balance", { balanceDueDate: null }).balanceLine, null);
  assert.equal(model("cancelled").balanceLine, null);
});

test("stayPath: the stay page in the language; a slug that is not plain falls back to /private-stays", () => {
  assert.equal(model("awaiting").stayPath, "/en/private-stays/test-stay");
  assert.equal(bookingPageModel(viewFixture("awaiting", "es"), FIXTURE_NOW).stayPath, "/es/private-stays/test-stay");
  const odd = viewFixture("awaiting", "en");
  odd.stay = { ...odd.stay, slug: "../x?y" };
  assert.equal(bookingPageModel(odd, FIXTURE_NOW).stayPath, "/en/private-stays");
  assert.equal(stayPagePath("ar", "Bad Slug"), "/ar/private-stays");
});

test("stayPath follows the page language when given", () => {
  assert.equal(bookingPageModel(viewFixture("awaiting", "en"), FIXTURE_NOW, "ar").stayPath, "/ar/private-stays/test-stay");
});

test("startAgainPath: the stay page for expired only", () => {
  assert.equal(model("expired").startAgainPath, "/en/private-stays/test-stay");
  assert.equal(model("cancelled").startAgainPath, null);
  assert.equal(model("awaiting").startAgainPath, null);
});

// ---------------------------------------------------------------- withdraw (R2) and the part-paid pages (R1)

test("canWithdraw: an unpaid awaiting request the guest sent, before its deadline", () => {
  assert.equal(model("awaiting").canWithdraw, true);
});

test("canWithdraw: false once money is recorded (bite P8)", () => {
  const view = viewFixture("awaiting", "en");
  view.money.paidFils = 1;
  assert.equal(bookingPageModel(view, FIXTURE_NOW).canWithdraw, false);
  assert.equal(model("part-received").canWithdraw, false);
});

test("canWithdraw: false for an owner-made request, withdrawable false (bite P13)", () => {
  assert.equal(model("awaiting-owner-made").canWithdraw, false);
});

test("canWithdraw: false at or after the deadline, without a deadline, or with an unreadable one", () => {
  const view = viewFixture("awaiting", "en");
  assert.equal(bookingPageModel(view, Date.parse(view.deadline)).canWithdraw, false);
  assert.equal(bookingPageModel(view, Date.parse(view.deadline) + 1).canWithdraw, false);
  assert.equal(bookingPageModel(view, Date.parse(view.deadline) - 1).canWithdraw, true);
  assert.equal(bookingPageModel({ ...view, deadline: null }, FIXTURE_NOW).canWithdraw, false);
  assert.equal(bookingPageModel({ ...view, deadline: "not a time" }, FIXTURE_NOW).canWithdraw, false);
});

test("canWithdraw: with withdrawable forced true and the deadline ahead, only an unpaid awaiting request offers it", () => {
  for (const state of VIEW_STATES.filter((s) => s !== "awaiting")) {
    const m = model(state, { withdrawable: true, deadline: fx.DEADLINE_AHEAD });
    const expected = state === "awaiting-owner-made";
    assert.equal(m.canWithdraw, expected, state);
  }
});

test("partPaidContact: awaiting_payment with money paid", () => {
  assert.equal(model("part-received").partPaidContact, true);
  assert.equal(model("part-paid-late").partPaidContact, true);
  assert.equal(model("awaiting").partPaidContact, false);
  assert.equal(model("deposit-balance").partPaidContact, false);
});

test("ownerMadeContact: unpaid awaiting_payment that is not withdrawable", () => {
  assert.equal(model("awaiting-owner-made").ownerMadeContact, true);
  assert.equal(model("awaiting").ownerMadeContact, false);
  assert.equal(model("part-received").ownerMadeContact, false);
  assert.equal(model("expired").ownerMadeContact, false);
});

test("partPaidLate: part paid and the deadline passed; the transfer stays, deadline kind, past payBy (bite P11)", () => {
  const view = viewFixture("part-paid-late", "en");
  const m = bookingPageModel(view, FIXTURE_NOW);
  assert.equal(m.partPaidLate, true);
  assert.equal(m.status, "awaiting_payment");
  assert.deepEqual(m.transfer, { kind: "deadline", amountFils: view.transfer.amountFils, payBy: view.transfer.payBy, dueBy: null });
  assert.ok(Date.parse(m.transfer.payBy) < FIXTURE_NOW);
  assert.equal(m.partPaidContact, true);
  assert.equal(m.canWithdraw, false);
});

test("partPaidLate: false before the deadline and for an unpaid request past it", () => {
  assert.equal(model("part-received").partPaidLate, false);
  const unpaid = viewFixture("awaiting", "en");
  assert.equal(bookingPageModel(unpaid, Date.parse(unpaid.deadline) + 60_000).partPaidLate, false);
});

test("the model never derives a status from the clock: part paid far past its deadline stays awaiting_payment", () => {
  const view = viewFixture("part-paid-late", "en");
  const m = bookingPageModel(view, FIXTURE_NOW + 365 * 24 * 3600 * 1000);
  assert.equal(m.status, "awaiting_payment");
  assert.equal(m.startAgainPath, null);
  assert.notEqual(m.transfer, null);
});

test("every fixture state gives a model without throwing, in every language", () => {
  for (const state of VIEW_STATES) for (const locale of LOCALES) bookingPageModel(viewFixture(state, locale), FIXTURE_NOW);
});

// ---------------------------------------------------------------- copy

function leaves(value, path = "") {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object" && typeof value.other === "string") return [[path, value.other]];
  return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

function keyTree(value) {
  if (typeof value === "string") return "s";
  if (value && typeof value === "object" && typeof value.other === "string") return "plural";
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, keyTree(value[k])]));
}

test("copy: BOOKING_PAGE_COPY has the same key tree in en, ar and es, every value a clean non-empty string", () => {
  const en = keyTree(BOOKING_PAGE_COPY.en);
  for (const locale of LOCALES) {
    assert.deepEqual(keyTree(BOOKING_PAGE_COPY[locale]), en, locale);
    for (const [path, value] of leaves(BOOKING_PAGE_COPY[locale])) {
      assert.ok(value.trim().length > 0, `${locale}.${path} is empty`);
      assert.equal(/\[object|undefined|NaN/.test(value), false, `${locale}.${path}`);
    }
  }
});

test("copy: Arabic and Spanish are written, not English copies (brand words and slots aside)", () => {
  const same = ["contactWhatsapp", "concierge.whatsapp", "transfer.iban", "transfer.swift", "money.subtotal", "money.total", "addons.line"];
  const en = Object.fromEntries(leaves(BOOKING_PAGE_COPY.en));
  for (const locale of ["ar", "es"]) {
    for (const [path, value] of leaves(BOOKING_PAGE_COPY[locale])) {
      if (same.includes(path) || path.startsWith("airport.names")) continue;
      assert.notEqual(value, en[path], `${locale}.${path} is the English text`);
    }
  }
  for (const [path, value] of leaves(BOOKING_PAGE_COPY.ar)) {
    if (["contactWhatsapp", "transfer.swift", "addons.line"].includes(path)) continue;
    assert.match(value, /[؀-ۿ]/, `ar.${path} has no Arabic letter`);
  }
});

test("copy: the R2 and R1 strings are the plan's English, verbatim", () => {
  const en = BOOKING_PAGE_COPY.en;
  assert.equal(en.withdrawHint, "You can withdraw this request until a payment is recorded. If you withdraw, its nights are released at once.");
  assert.equal(en.withdrawAction, "Withdraw request");
  assert.equal(en.withdrawConfirmTitle, "Withdraw this request?");
  assert.equal(en.withdrawConfirmBody, "The nights are released at once and this request cannot be restored. To book later, send a new request.");
  assert.equal(en.withdrawConfirmAction, "Withdraw request");
  assert.equal(en.withdrawKeep, "Keep my request");
  assert.equal(en.withdrawFailed, "We could not confirm the withdrawal. Please try again: trying again is safe.");
  assert.equal(en.withdrawRetry, "Try again");
  assert.equal(en.withdrawDone, "Your request is withdrawn. The nights are free again.");
  assert.equal(en.withdrawStartAgain, "Start again from the stay page");
  assert.equal(en.withdrawRefusedPartPaid, "A payment was recorded on this request in the meantime, so it can no longer be withdrawn here.");
  assert.equal(en.withdrawRefusedNotWithdrawable, "This request can no longer be withdrawn here.");
  assert.equal(en.contactToChange, "To change or cancel this request, contact us:");
  assert.equal(en.partPaidLate, "The pay-by date, {date} at {time} UAE time, has passed. Your nights are still held, and we will contact you.");
  for (const locale of LOCALES) {
    assert.equal(BOOKING_PAGE_COPY[locale].contactWhatsapp, "WhatsApp", locale);
    assert.match(BOOKING_PAGE_COPY[locale].partPaidLate, /\{date\}/, locale);
    assert.match(BOOKING_PAGE_COPY[locale].partPaidLate, /\{time\}/, locale);
    assert.notEqual(BOOKING_PAGE_COPY[locale].withdrawKeep, "Stay signed in", locale);
  }
});

test("copy: the canvas GuestTrip strings are verbatim in all three languages", () => {
  const canvas = readFileSync(".planning/design/2026-10-01-canvas/boards/GuestTrip.dc.html", "utf8");
  const pick = (k) => JSON.parse(canvas.match(new RegExp(`"${k}":(\\{[^}]*\\})`))[1]);
  const pairs = [
    ["k58", (c) => c.backToBookings],
    ["k65", (c) => c.stay],
    ["k67", (c) => c.addressPending],
    ["k89", (c) => c.money.balanceDue],
    ["k90", (c) => c.money.balanceDueBy],
    ["k92", (c) => c.money.subtotal],
    ["k93", (c) => c.money.vat],
    ["k94", (c) => c.money.total],
    ["k95", (c) => c.money.paid],
    ["k96", (c) => c.concierge.heading],
    ["k97", (c) => c.concierge.line],
  ];
  for (const [k, get] of pairs) {
    const entry = pick(k);
    for (const locale of LOCALES) assert.equal(get(BOOKING_PAGE_COPY[locale]), entry[locale], `${k} ${locale}`);
  }
});

test("copy: the E-08, E-09 and E-15 lines are the plan's English", () => {
  const en = BOOKING_PAGE_COPY.en;
  assert.equal(en.flags.moneyOnClosed, "We have received {amount}. We will contact you about it.");
  assert.equal(en.flags.overpaid, "We received more than the total. We will contact you about the difference.");
  assert.equal(en.flags.acceptedAsPaid, "The amount received was accepted as paid.");
  assert.equal(en.notFoundSignIn, "If this is your booking, open the link in your email or sign in with the email you booked with.");
  assert.equal(en.testBanner, "TEST booking from the preview site. Do not send money.");
  for (const locale of LOCALES) assert.match(BOOKING_PAGE_COPY[locale].flags.moneyOnClosed, /\{amount\}/, locale);
});

test("copy: no bank value, price or fee amount is typed into the page copy", () => {
  const source = readFileSync("lib/copy/booking-page.ts", "utf8");
  assert.equal(/AE\d{2}\s?\d{4}|TESTAEAA|GB82|\bAED\s?\d/.test(source), false);
  assert.equal(/\d+\s?%/.test(source.replace(/\[RATE\]/g, "")), false, "no typed rate");
});

// ---------------------------------------------------------------- shared helpers (cross-plan decision 6)

function hasKey(value, names) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([k, v]) => names.includes(k) || hasKey(v, names));
}

test("shared helpers: neither copy table has a status or payBy key", () => {
  for (const locale of LOCALES) {
    assert.equal(hasKey(BOOKING_PAGE_COPY[locale], ["status", "payBy", "bookingStatus"]), false, `page ${locale}`);
    assert.equal(hasKey(BOOKING_EMAIL_COPY[locale], ["status", "payBy", "bookingStatus"]), false, `email ${locale}`);
  }
});

function pageAndMailFiles() {
  const files = readdirSync("app/bookings/trip").filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `app/bookings/trip/${f}`);
  for (const f of readdirSync("lib/email")) if (/^booking-.*\.ts$/.test(f)) files.push(`lib/email/${f}`);
  for (const f of ["lib/email/shell.ts", "lib/booking/display-text.ts"]) if (existsSync(f)) files.push(f);
  return files;
}

test("shared helpers: no page or mail file defines its own day, time or status helper", () => {
  const files = pageAndMailFiles();
  assert.ok(files.includes("app/bookings/trip/booking-page-model.ts"));
  for (const file of files) {
    const source = nc(readFileSync(file, "utf8"));
    assert.equal(
      /(function|const|let)\s+(uaeDateTime|formatIsoDate|dayText|uaeDateTimeParts)\b/.test(source),
      false,
      `${file} defines a shared helper of its own`,
    );
  }
});

test("model source: imports types and localePath only; no fetch, storage, cookie or console", () => {
  const source = nc(readFileSync("app/bookings/trip/booking-page-model.ts", "utf8"));
  const imports = source.match(/^import .*$/gm) ?? [];
  for (const line of imports) {
    assert.ok(/^import type /.test(line) || /lib\/locale-path"/.test(line), `unexpected import: ${line}`);
  }
  assert.equal(/fetch\(|localStorage|sessionStorage|document\.cookie|console\./.test(source), false);
});

// ---------------------------------------------------------------- PAY-07 (no card form, no Pay button, no gift card, no BNPL)

const PAY07 =
  /stripe|paymentpanel|payment-panel|pay balance|pay now|gift ?cards?|tarjetas? de regalo|بطاقة هدية|bnpl|buy now|pay later|paga después|ادفع لاحقا|tabby|tamara|klarna|afterpay|card number|cvc|cvv|apple pay|checkout/i;

test("PAY-07: no page, mail or copy file of this plan names a card provider, a Pay button, a gift card or BNPL", () => {
  const files = [...pageAndMailFiles(), "lib/copy/booking-email.ts", "lib/copy/booking-page.ts"];
  for (const file of files) {
    const source = nc(readFileSync(file, "utf8"));
    const hit = source.match(PAY07);
    assert.equal(hit, null, `${file} matches PAY-07: ${hit?.[0]}`);
  }
});

test("secrets gate: no re_ or eyJ in this plan's lib and app files (unfiltered)", () => {
  for (const file of [...pageAndMailFiles(), "lib/copy/booking-email.ts", "lib/copy/booking-page.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("re_") || source.includes("eyJ"), false, file);
  }
});

// ================================================================ Task 2: the page view's source rules

test("view source: presentational (no fetch, storage, cookie or console), the model called, ConfirmDialog with one cancelLabel", () => {
  const source = nc(readFileSync("app/bookings/trip/booking-page-view.tsx", "utf8"));
  assert.equal(/fetch\(|localStorage|sessionStorage|document\.cookie|console\./.test(source), false);
  assert.match(source, /bookingPageModel\(/);
  assert.match(source, /<ConfirmDialog/);
  assert.equal((source.match(/cancelLabel=/g) ?? []).length, 1, "the one ConfirmDialog always passes withdrawKeep");
  assert.match(source, /cancelLabel=\{copy\.withdrawKeep\}/);
  assert.match(source, /variant="secondary"[\s\S]{0,200}data-testid="withdraw"|data-testid="withdraw"[\s\S]{0,200}variant="secondary"/, "Withdraw is the secondary button");
  assert.match(source, /JOURNEY_COPY\[locale\]\.bookingStatus/, "status words and the Pay-by sentence come from 04-03's group");
  assert.match(source, /formatAed\(/);
  assert.match(source, /formatIban\(/);
  assert.match(source, /normalizeIban\(/);
  assert.equal(/https?:\/\/(?!wa\.me\/971563883302)[a-z]/i.test(source), false, "no link to another origin but the WhatsApp link");
});

// ================================================================ Task 5: the view answer, the screen and the three pages

const { viewAnswer, isBookingView, viewRequestBody } = await loadTs("app/bookings/trip/booking-view-answer.ts");
const { REF_ALPHABET } = await loadTs("lib/booking/ref.ts");

test("viewAnswer: 200 ok with a well-formed view of the asked ref is ready, in every state and language", () => {
  for (const state of VIEW_STATES) {
    for (const locale of LOCALES) {
      const view = viewFixture(state, locale);
      assert.equal(isBookingView(view), true, `${state} ${locale}`);
      assert.deepEqual(viewAnswer(200, { ok: true, booking: view }, view.ref), { kind: "ready", view }, `${state} ${locale}`);
    }
  }
});

test("viewAnswer: 404 and 400 are not found; every other status, network error or odd body is unavailable", () => {
  const view = viewFixture("awaiting", "en");
  assert.deepEqual(viewAnswer(404, { ok: false }, view.ref), { kind: "not_found" });
  assert.deepEqual(viewAnswer(404, null, view.ref), { kind: "not_found" });
  assert.deepEqual(viewAnswer(400, { ok: false }, view.ref), { kind: "not_found" });
  for (const status of [0, 201, 204, 301, 403, 409, 413, 429, 500, 502, 503]) {
    assert.deepEqual(viewAnswer(status, { ok: true, booking: view }, view.ref), { kind: "unavailable" }, String(status));
  }
  for (const body of [null, "x", 1, {}, { ok: false }, { ok: true }, { ok: true, booking: null }, { ok: "true", booking: view }]) {
    assert.deepEqual(viewAnswer(200, body, view.ref), { kind: "unavailable" }, JSON.stringify(body));
  }
});

test("viewAnswer: a view of another ref is unavailable, never shown", () => {
  const view = viewFixture("awaiting", "en");
  assert.deepEqual(viewAnswer(200, { ok: true, booking: view }, "ALMAR-ZZZZZZ"), { kind: "unavailable" });
});

test("isBookingView: every value the page formats is checked first (fils, days, instants, statuses, shapes)", () => {
  const breakers = [
    (v) => { v.status = "paid"; },
    (v) => { v.locale = "fr"; },
    (v) => { v.ref = 42; },
    (v) => { v.money.paidFils = -1; },
    (v) => { v.money.grandFils = 1.5; },
    (v) => { v.money.vatBp = "500"; },
    (v) => { v.money.stillDueFils = Number.MAX_SAFE_INTEGER + 2; },
    (v) => { v.arrive = "10/12/2026"; },
    (v) => { v.leave = null; },
    (v) => { v.deadline = "tomorrow"; },
    (v) => { v.deadline = "2026-11-03T08:00:00"; },
    (v) => { v.holdExpiresAt = 5; },
    (v) => { v.balanceDueDate = "2026-11-26T00:00:00Z"; },
    (v) => { v.plan = "monthly"; },
    (v) => { v.airport = "JFK"; },
    (v) => { v.pickupAddress = 3; },
    (v) => { v.nights = -1; },
    (v) => { v.adults = "2"; },
    (v) => { v.travellers = null; },
    (v) => { v.travellers[0].kind = "pet"; },
    (v) => { v.travellers[2].age = "7"; },
    (v) => { v.lines = [{ name: "x", unit: "week", quantity: 1, unitPriceFils: 1, lineFils: 1 }]; },
    (v) => { v.lines[0].lineFils = -5; },
    (v) => { v.payments = [{ receivedOn: "yesterday", method: "bank_transfer", amountFils: 1 }]; },
    (v) => { v.payments = [{ receivedOn: null, method: "cash", amountFils: 1 }]; },
    (v) => { v.flags = { partReceived: "no", overpaid: false, writtenOff: false }; },
    (v) => { v.withdrawable = "true"; },
    (v) => { v.guest = null; },
    (v) => { v.stay.slug = null; },
    (v) => { v.stay.image = { src: 1, alt: "x" }; },
    (v) => { v.transfer.amountFils = "222222"; },
    (v) => { v.transfer.iban = null; },
    (v) => { v.transfer.currency = "USD"; },
    (v) => { v.transfer.payBy = "soon"; },
    (v) => { v.transfer.dueBy = "26/11/2026"; },
    (v) => { v.access = { address: 1, wifiName: null, wifiPassword: null, doorCode: null, notes: null }; },
  ];
  for (const [i, breakIt] of breakers.entries()) {
    const view = structuredClone(viewFixture("awaiting", "en"));
    breakIt(view);
    assert.equal(isBookingView(view), false, `breaker ${i}: ${breakIt.toString()}`);
  }
  for (const value of [null, undefined, "x", 1, [], {}]) assert.equal(isBookingView(value), false, JSON.stringify(value));
});

test("viewRequestBody: exactly { ref, t, locale }, t left out when absent or empty", () => {
  assert.deepEqual(viewRequestBody("ALMAR-TEST22", "tok", "ar"), { ref: "ALMAR-TEST22", t: "tok", locale: "ar" });
  assert.deepEqual(Object.keys(viewRequestBody("ALMAR-TEST22", "tok", "ar")), ["ref", "t", "locale"]);
  assert.deepEqual(viewRequestBody("ALMAR-TEST22", undefined, "es"), { ref: "ALMAR-TEST22", locale: "es" });
  assert.deepEqual(viewRequestBody("ALMAR-TEST22", "", "en"), { ref: "ALMAR-TEST22", locale: "en" });
  assert.ok(!REF_ALPHABET.includes("0"));
});

test("booking-view-answer.ts: pure (no fetch, storage, cookie or console; no React)", () => {
  const source = nc(readFileSync("app/bookings/trip/booking-view-answer.ts", "utf8"));
  assert.equal(/fetch\(|localStorage|sessionStorage|document\.cookie|console\.|from "react"/.test(source), false);
  assert.equal(/^"use client"/m.test(source), false);
});

test("screen source: no storage, cookie or console; one fetch, to /api/booking/view; the answer read by viewAnswer", () => {
  const raw = readFileSync("app/bookings/trip/booking-trip-screen.tsx", "utf8");
  const source = nc(raw);
  assert.match(raw, /^"use client"/m);
  assert.equal(/localStorage|sessionStorage|document\.cookie|console\./.test(source), false);
  const fetches = [...source.matchAll(/\bfetch\(([^,)]*)/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ["VIEW_PATH"], "the screen's only fetch is the view call");
  assert.equal((source.match(/const VIEW_PATH = "\/api\/booking\/view";/g) ?? []).length, 1);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /credentials: "same-origin"/);
  assert.match(source, /viewAnswer\(/);
  assert.match(source, /isBookingRef\(/);
  assert.match(source, /isTestHost\(window\.location\.host\)/);
  assert.match(source, /bookingPagePath\(/, "localeHrefs keep ref and t (bite P5)");
  assert.match(source, /useSearchParams\(/);
});

test("screen source (Task 6): the withdraw call through postWithdraw, an in-flight ref, the view read again", () => {
  const source = nc(readFileSync("app/bookings/trip/booking-trip-screen.tsx", "utf8"));
  assert.match(source, /postWithdraw\(/);
  assert.match(source, /useRef\(false\)/, "the in-flight guard");
  assert.match(source, /withdraw=\{/);
  assert.doesNotMatch(source, /request-client/, "never 04-06's client");
});

test("the three pages: force-static, their locale's metadata, a Suspense with the loading view around the screen", () => {
  for (const locale of LOCALES) {
    const file = `app/${locale}/bookings/trip/page.tsx`;
    const source = nc(readFileSync(file, "utf8"));
    assert.match(source, /export const dynamic = "force-static"/, file);
    assert.equal((source.match(new RegExp(`bookingPageMetadata\\("${locale}"\\)`, "g")) ?? []).length, 1, file);
    assert.match(source, /<Suspense/, file);
    assert.match(source, /kind: "loading"/, file);
    assert.match(source, new RegExp(`<BookingTripScreen locale="${locale}"`), file);
    assert.doesNotMatch(source, /no-referrer/, file);
    assert.doesNotMatch(readFileSync(file, "utf8"), /^"use client"/m, file);
  }
  assert.equal(existsSync("app/bookings/trip/page.tsx"), false, "no unprefixed page: every page is /en|ar|es/… (#33)");
  assert.equal(existsSync("app/[locale]/bookings/trip"), false, "the static pages are not under the dynamic [locale] route");
});

test("booking-page-meta.ts: the title comes from the page copy", () => {
  const source = nc(readFileSync("app/bookings/trip/booking-page-meta.ts", "utf8"));
  assert.match(source, /title: BOOKING_PAGE_COPY\[locale\]\.pageTitle/);
  assert.doesNotMatch(source, /TODO/);
});
