// Plan 04-08, Task 4: the guest's request, view and withdraw on a fake rpc and a fake notifier, and the three new
// routes for every path that never reaches the database (origin, content type, size, unknown key, no database, no
// link secret). Everything past the database is end to end in tests/booking-routes.db.test.mjs.
// Every value here is a symbolic test value: no real booking, price, account, address or secret.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadRoute } from "./helpers/load-route.mjs";

process.env.BOOKING_LINK_SECRET = "test-secret-".padEnd(48, "x");

const server = await loadTs("lib/booking/server.ts");
const linkModule = await loadTs("lib/booking/link.ts");
const media = await loadTs("lib/data/media.ts");
const { requestBooking, viewBooking, withdrawBooking, bookingViewById, listGuestBookings } = server;
const { signBookingLink } = linkModule;

const BOOKING_ID = "66666666-6666-4666-8666-666666666666";
const REF = "ALMAR-7K3QH9";
const UNKNOWN_REF = "ALMAR-AAAAAA";
const PREVIEW = "https://preview.almarprivatejourney.com";
const PRODUCTION = "https://almarprivatejourney.com";
const DEADLINE = "2026-10-05T10:35:00.000Z";

// ---------------------------------------------------------------- fakes

/** The booking_view answer (section B), snake_case, symbolic amounts in fils. */
const viewRow = (over = {}) => ({
  ref: REF,
  status: "awaiting_payment",
  locale: "es",
  guest_name: "Ann Guest",
  email: "ann@example.com",
  stay: { slug: "stay-one", title: "Stay one", destination_name: "Destination one", image_key: "stays/stay-one/hero.webp", image_alt: "A hero" },
  arrive: "2026-12-10",
  leave: "2026-12-13",
  nights: 3,
  adults: 2,
  children: 1,
  infants: 0,
  travellers: [
    { kind: "adult", full_name: "Ann Guest", age: null, is_booker: true, not_staying: false },
    { kind: "child", full_name: "Kid Guest", age: 7, is_booker: false, not_staying: false },
  ],
  lines: [{ name: "Breakfast", unit: "person", quantity: 3, unit_price_fils: 10000, line_fils: 30000 }],
  airport: "DXB",
  pickup_address: null,
  plan: "deposit",
  money: {
    nights_fils: 300000, addons_fils: 30000, subtotal_fils: 330000, vat_bp: 500, vat_fils: 16500, grand_fils: 346500,
    deposit_fils: 103950, balance_fils: 242550, paid_fils: 0, due_now_fils: 103950, still_due_fils: 346500,
  },
  hold_expires_at: null,
  deadline: DEADLINE,
  balance_due_date: "2026-11-10",
  flags: { part_received: false, overpaid: false, written_off: false },
  withdrawable: true,
  payments: [],
  transfer: {
    account_name: "Almar Test Account", bank_name: "Test Bank", iban: "GB82WEST12345698765432", swift: "TESTAEAA",
    bank_address: "1 Test Street, Dubai", note: "All fees paid by the sender.", currency: "AED", amount_fils: 103950,
    reference: REF, pay_by: DEADLINE, due_by: null,
  },
  access: null,
  ...over,
});

/** The same view as viewBooking answers it (camelCase, the image through mediaUrl). */
const viewMapped = () => ({
  ref: REF,
  status: "awaiting_payment",
  locale: "es",
  guest: { name: "Ann Guest", email: "ann@example.com" },
  stay: { slug: "stay-one", title: "Stay one", destinationName: "Destination one", image: { src: media.mediaUrl("stays/stay-one/hero.webp"), alt: "A hero" } },
  arrive: "2026-12-10",
  leave: "2026-12-13",
  nights: 3,
  adults: 2,
  children: 1,
  infants: 0,
  travellers: [
    { kind: "adult", fullName: "Ann Guest", age: null, isBooker: true, notStaying: false },
    { kind: "child", fullName: "Kid Guest", age: 7, isBooker: false, notStaying: false },
  ],
  lines: [{ name: "Breakfast", unit: "person", quantity: 3, unitPriceFils: 10000, lineFils: 30000 }],
  airport: "DXB",
  pickupAddress: null,
  plan: "deposit",
  money: {
    nightsFils: 300000, addonsFils: 30000, subtotalFils: 330000, vatBp: 500, vatFils: 16500, grandFils: 346500,
    depositFils: 103950, balanceFils: 242550, paidFils: 0, dueNowFils: 103950, stillDueFils: 346500,
  },
  holdExpiresAt: null,
  deadline: DEADLINE,
  balanceDueDate: "2026-11-10",
  flags: { partReceived: false, overpaid: false, writtenOff: false },
  withdrawable: true,
  payments: [],
  transfer: {
    accountName: "Almar Test Account", bankName: "Test Bank", iban: "GB82WEST12345698765432", swift: "TESTAEAA",
    bankAddress: "1 Test Street, Dubai", note: "All fees paid by the sender.", currency: "AED", amountFils: 103950,
    reference: REF, payBy: DEADLINE, dueBy: null,
  },
  access: null,
});

/**
 * A fake database. The stored booking is REF with the TEST flag `isTest`: booking_view answers it only when the call's
 * p_expect_test is that flag (the SQL's TEST mismatch rule), else null. `handlers` replace any rpc.
 */
function fakeDb({ isTest = true, handlers = {}, view = viewRow } = {}) {
  const calls = [];
  const all = {
    booking_by_ref: (a) => (a.p_ref === REF ? { id: BOOKING_ID, email: "ann@example.com", link_version: 1, status: "awaiting_payment" } : null),
    booking_view: (a) => (a.p_booking === BOOKING_ID && a.p_expect_test === isTest ? view() : null),
    log_booking_event: () => null,
    ...handlers,
  };
  return {
    calls,
    names: () => calls.map((c) => c.name),
    args: (name) => calls.filter((c) => c.name === name).map((c) => c.args),
    events: () => calls.filter((c) => c.name === "log_booking_event").map((c) => ({ action: c.args.p_action, ...c.args.p_detail })),
    rpc: async (name, args) => {
      calls.push({ name, args });
      const h = all[name];
      if (!h) throw new Error(`unexpected rpc ${name}`);
      const out = await h(args);
      if (out && out.__error) return { data: null, error: out.__error };
      return { data: out, error: null };
    },
  };
}

/** A notifier that records every call. mode: "ok" (sent), "fails" (refused with a short name), "throws". */
function fakeNotifier({ ready = true, mode = "ok", modes = {} } = {}) {
  const calls = [];
  const method = (kind) => async (job, opts) => {
    calls.push({ kind, job, opts });
    const m = modes[kind] ?? mode;
    if (m === "throws") throw new Error("sender down");
    if (m === "fails") return { ok: false, error: "http_429" };
    return { ok: true };
  };
  return {
    calls,
    kinds: () => calls.map((c) => c.kind),
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

const token = () => signBookingLink(BOOKING_ID, 1);
const requested = (over = {}) => ({
  ok: true, first_time: true, booking_id: BOOKING_ID, ref: REF, status: "awaiting_payment", deadline: DEADLINE,
  window_minutes: 35, locale: "es", is_test: true, ...over,
});
const withdrawn = (over = {}) => ({ ok: true, first_time: true, ref: REF, status: "cancelled", ...over });

// ================================================================ requestBooking

test("request: one request_web_booking with the booking and the host's TEST flag; the first time mails the guest and the owner", async () => {
  const t = await token();
  const db = fakeDb({ handlers: { request_web_booking: () => requested() } });
  const n = fakeNotifier();
  const out = await requestBooking(db, { ref: REF, t }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
  assert.equal(out.status, 200);
  assert.deepEqual(out.response, { ok: true, ref: REF, status: "awaiting_payment", deadline: DEADLINE, firstTime: true, emailSent: true });
  assert.deepEqual(db.args("request_web_booking"), [{ p_booking: BOOKING_ID, p_expect_test: true }]);
  assert.deepEqual(db.args("booking_view"), [{ p_booking: BOOKING_ID, p_locale: null, p_expect_test: true }], "the mails use the booking's own language");
  assert.deepEqual(n.kinds(), ["requestReceived", "ownerRequest"]);
  assert.deepEqual(n.calls.map((c) => c.opts), [{ idempotencyKey: `request/${BOOKING_ID}` }, { idempotencyKey: `request-owner/${BOOKING_ID}` }]);
  const job = n.calls[0].job;
  assert.equal(job.bookingId, BOOKING_ID);
  assert.equal(job.isTest, true);
  assert.deepEqual(job.view, viewMapped());
  assert.equal(job.bookingUrl, `${PREVIEW}/es/bookings/trip?ref=${REF}&t=${t}`, "the guest's link carries the token, on the TEST origin");
  assert.deepEqual(n.calls[1].job, job, "the owner's notice gets the same job");
  assert.deepEqual(db.events(), [
    { action: "email_sent", template: "request_received", key: `request/${BOOKING_ID}` },
    { action: "email_sent", template: "request_owner", key: `request-owner/${BOOKING_ID}` },
  ]);
  assert.equal(JSON.stringify(out.response).includes(BOOKING_ID), false, "the booking id is never part of the answer");
});

test("request (T1): a second request answers firstTime false and sends nothing, reads no view and writes no event", async () => {
  const db = fakeDb({ handlers: { request_web_booking: () => requested({ first_time: false }) } });
  const n = fakeNotifier();
  const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
  assert.equal(out.status, 200);
  assert.deepEqual(out.response, { ok: true, ref: REF, status: "awaiting_payment", deadline: DEADLINE, firstTime: false, emailSent: false });
  assert.deepEqual(n.calls, []);
  assert.deepEqual(db.names(), ["booking_by_ref", "request_web_booking"]);
});

test("request: a sender that is not ready is never called; two email_pending events and emailSent false", async () => {
  const db = fakeDb({ handlers: { request_web_booking: () => requested() } });
  const n = fakeNotifier({ ready: false });
  const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
  assert.equal(out.status, 200);
  assert.equal(out.response.emailSent, false);
  assert.deepEqual(n.calls, []);
  assert.deepEqual(db.events(), [
    { action: "email_pending", template: "request_received", key: `request/${BOOKING_ID}` },
    { action: "email_pending", template: "request_owner", key: `request-owner/${BOOKING_ID}` },
  ]);
});

test("request (T2): a guest mail that fails or throws never changes the answer: still 200, emailSent false, the owner still told", async () => {
  for (const mode of ["fails", "throws"]) {
    const db = fakeDb({ handlers: { request_web_booking: () => requested() } });
    const n = fakeNotifier({ modes: { requestReceived: mode } });
    const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
    assert.equal(out.status, 200, mode);
    assert.deepEqual(out.response, { ok: true, ref: REF, status: "awaiting_payment", deadline: DEADLINE, firstTime: true, emailSent: false }, mode);
    assert.deepEqual(n.kinds(), ["requestReceived", "ownerRequest"], mode);
    assert.deepEqual(db.events().map((e) => `${e.action}:${e.template}`), ["email_failed:request_received", "email_sent:request_owner"], mode);
  }
});

test("request: emailSent follows the guest's mail only; a failing owner notice leaves it true", async () => {
  const db = fakeDb({ handlers: { request_web_booking: () => requested() } });
  const n = fakeNotifier({ modes: { ownerRequest: "throws" } });
  const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
  assert.equal(out.status, 200);
  assert.equal(out.response.emailSent, true);
});

test("request: a view that cannot be read (null, or a failed read) sends no mail; the answer stays 200 with emailSent false", async () => {
  for (const view of [() => null, () => ({ __error: { message: "down" } })]) {
    const db = fakeDb({ handlers: { request_web_booking: () => requested(), booking_view: view } });
    const n = fakeNotifier();
    const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
    assert.equal(out.status, 200);
    assert.equal(out.response.emailSent, false);
    assert.equal(out.response.firstTime, true);
    assert.deepEqual(n.calls, []);
    assert.deepEqual(db.events(), []);
  }
});

test("request: a real booking's link points at the production origin the route passes", async () => {
  const t = await token();
  const db = fakeDb({ isTest: false, handlers: { request_web_booking: () => requested({ is_test: false }) } });
  const n = fakeNotifier();
  await requestBooking(db, { ref: REF, t }, { isTest: false, notifier: n.notifier, origin: PRODUCTION });
  assert.deepEqual(db.args("request_web_booking"), [{ p_booking: BOOKING_ID, p_expect_test: false }]);
  assert.equal(n.calls[0].job.bookingUrl, `${PRODUCTION}/es/bookings/trip?ref=${REF}&t=${t}`);
  assert.equal(n.calls[0].job.isTest, false);
});

test("request: each refusal of the database is its status and one reason; not_found is the bare 404; nothing is mailed", async () => {
  const cases = [
    ["not_found", 404, { ok: false }],
    ["hold_ended", 409, { ok: false, reasons: [{ code: "hold_ended" }] }],
    ["blocked", 409, { ok: false, reasons: [{ code: "blocked" }] }],
    ["sold_out", 409, { ok: false, reasons: [{ code: "sold_out" }] }],
    ["too_many_open", 429, { ok: false, reasons: [{ code: "too_many_open" }] }],
    ["requests_closed", 503, { ok: false, reasons: [{ code: "requests_closed" }] }],
  ];
  for (const [reason, status, body] of cases) {
    const db = fakeDb({ handlers: { request_web_booking: () => ({ ok: false, reason }) } });
    const n = fakeNotifier();
    const out = await requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier, origin: PREVIEW });
    assert.equal(out.status, status, reason);
    assert.deepEqual(out.response, body, reason);
    assert.deepEqual(n.calls, [], reason);
    assert.equal(db.names().includes("booking_view"), false, reason);
  }
});

test("request: link only. A wrong token, another link version, an unknown or malformed ref and no token are the same 404, and nothing is requested", async () => {
  const other = await signBookingLink(BOOKING_ID, 2);
  const answers = [];
  for (const input of [
    { ref: REF, t: "A".repeat(43) },
    { ref: REF, t: other },
    { ref: UNKNOWN_REF, t: await token() },
    { ref: "nope", t: await token() },
    { ref: REF },
  ]) {
    const db = fakeDb({ handlers: { request_web_booking: () => requested() } });
    const out = await requestBooking(db, input, { isTest: true, notifier: fakeNotifier().notifier, origin: PREVIEW });
    assert.equal(out.status, 404, JSON.stringify(input));
    assert.equal(db.names().includes("request_web_booking"), false, JSON.stringify(input));
    answers.push(out.response);
  }
  for (const answer of answers) assert.deepEqual(answer, { ok: false });
});

test("request: an unreadable answer or a database error is thrown (the route answers 503); the message names the function only", async () => {
  for (const answer of [null, "x", [], { ok: true }, { ok: true, first_time: "yes", ref: REF, status: "awaiting_payment", deadline: null }, requested({ status: "paid" }), requested({ ref: "nope" }), { ok: false, reason: "weird" }, { ok: "maybe" }, { __error: { message: "down", details: "ann@example.com" } }]) {
    const db = fakeDb({ handlers: { request_web_booking: () => answer } });
    await assert.rejects(
      async () => requestBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: fakeNotifier().notifier, origin: PREVIEW }),
      (error) => /request_web_booking/.test(error.message) && !error.message.includes("ann@example.com"),
      JSON.stringify(answer),
    );
  }
});

// ================================================================ viewBooking

test("view: with the token, one booking_view with the booking, no locale and the host's TEST flag; the camelCase view", async () => {
  const db = fakeDb();
  const out = await viewBooking(db, { ref: REF, t: await token() }, { isTest: true });
  assert.deepEqual(out, { ok: true, booking: viewMapped() });
  assert.deepEqual(db.args("booking_view"), [{ p_booking: BOOKING_ID, p_locale: null, p_expect_test: true }]);
  assert.equal(JSON.stringify(out).includes(BOOKING_ID), false, "the booking id is never part of the view");
});

test("view: the page's language is passed through", async () => {
  const db = fakeDb();
  await viewBooking(db, { ref: REF, t: await token(), locale: "ar" }, { isTest: true });
  assert.equal(db.args("booking_view")[0].p_locale, "ar");
});

test("view (T4): a wrong token, another link version, an unknown ref and a malformed ref are the identical { ok: false }; no view is read", async () => {
  for (const input of [
    { ref: REF, t: "A".repeat(43) },
    { ref: REF, t: await signBookingLink(BOOKING_ID, 2) },
    { ref: UNKNOWN_REF, t: await token() },
    { ref: "nope", t: await token() },
  ]) {
    const db = fakeDb();
    assert.deepEqual(await viewBooking(db, input, { isTest: true }), { ok: false }, JSON.stringify(input));
    assert.equal(db.names().includes("booking_view"), false, JSON.stringify(input));
  }
});

test("view (T5): a TEST booking asked for on the production host is refused with the same { ok: false }", async () => {
  const db = fakeDb({ isTest: true });
  const out = await viewBooking(db, { ref: REF, t: await token() }, { isTest: false });
  assert.deepEqual(out, { ok: false });
  assert.deepEqual(db.args("booking_view"), [{ p_booking: BOOKING_ID, p_locale: null, p_expect_test: false }], "the host's flag goes to the SQL, which decides");
  const real = fakeDb({ isTest: false });
  assert.deepEqual(await viewBooking(real, { ref: REF, t: await token() }, { isTest: true }), { ok: false }, "and a real booking on a TEST host");
});

test("view: without a token the signed-in email decides (any case); another email or no session is refused; with a token the session is never read", async () => {
  const ok = await viewBooking(fakeDb(), { ref: REF }, { isTest: true, readSession: async () => ({ email: "Ann@Example.com" }) });
  assert.equal(ok.ok, true);
  assert.deepEqual(await viewBooking(fakeDb(), { ref: REF }, { isTest: true, readSession: async () => ({ email: "bob@example.com" }) }), { ok: false });
  assert.deepEqual(await viewBooking(fakeDb(), { ref: REF }, { isTest: true, readSession: async () => null }), { ok: false });
  assert.deepEqual(await viewBooking(fakeDb(), { ref: REF }, { isTest: true }), { ok: false }, "no session reader: refused");
  let read = 0;
  const viaToken = await viewBooking(fakeDb(), { ref: REF, t: "A".repeat(43) }, { isTest: true, readSession: async () => { read += 1; return { email: "ann@example.com" }; } });
  assert.deepEqual(viaToken, { ok: false }, "a wrong token is not rescued by a matching session");
  assert.equal(read, 0);
});

test("view: payments, a confirmed booking's access and a balance due map to camelCase", async () => {
  const db = fakeDb({
    view: () => viewRow({
      status: "confirmed",
      deadline: null,
      withdrawable: false,
      payments: [{ received_on: "2026-10-06", method: "bank_transfer", amount_fils: 103950 }, { received_on: null, method: "card", amount_fils: 500 }],
      transfer: { ...viewRow().transfer, amount_fils: 242550, pay_by: null, due_by: "2026-11-10" },
      access: { address: "Street one", wifi_name: "net", wifi_password: "pass", door_code: "1234", notes: null },
      stay: { ...viewRow().stay, image_key: null, image_alt: null },
    }),
  });
  const out = await viewBooking(db, { ref: REF, t: await token() }, { isTest: true });
  assert.equal(out.ok, true);
  assert.equal(out.booking.status, "confirmed");
  assert.equal(out.booking.stay.image, null);
  assert.deepEqual(out.booking.payments, [{ receivedOn: "2026-10-06", method: "bank_transfer", amountFils: 103950 }, { receivedOn: null, method: "card", amountFils: 500 }]);
  assert.deepEqual(out.booking.transfer.payBy, null);
  assert.deepEqual(out.booking.transfer.dueBy, "2026-11-10");
  assert.deepEqual(out.booking.access, { address: "Street one", wifiName: "net", wifiPassword: "pass", doorCode: "1234", notes: null });
});

test("view: an unreadable view is thrown (the route answers 503), naming the function and the field only", async () => {
  const bad = [
    viewRow({ status: "paid" }),
    viewRow({ money: { ...viewRow().money, paid_fils: "0" } }),
    viewRow({ travellers: [{ kind: "pet", full_name: "x", age: null, is_booker: true, not_staying: false }] }),
    viewRow({ transfer: { ...viewRow().transfer, currency: "USD" } }),
    viewRow({ payments: [{ received_on: null, method: "cash", amount_fils: 1 }] }),
    viewRow({ withdrawable: "yes" }),
    viewRow({ stay: null }),
    viewRow({ locale: "fr" }),
    "x",
  ];
  for (const answer of bad) {
    const db = fakeDb({ view: () => answer });
    await assert.rejects(
      async () => viewBooking(db, { ref: REF, t: await token() }, { isTest: true }),
      (error) => /booking_view/.test(error.message) && !error.message.includes("Ann"),
      JSON.stringify(answer).slice(0, 80),
    );
  }
});

// ================================================================ bookingViewById and listGuestBookings

test("bookingViewById: the view by id, null for a null answer, a throw for an answer that is not an object", async () => {
  const db = fakeDb();
  assert.deepEqual(await bookingViewById(db, BOOKING_ID, { isTest: true }), viewMapped());
  assert.deepEqual(db.args("booking_view"), [{ p_booking: BOOKING_ID, p_locale: null, p_expect_test: true }]);
  const withLocale = fakeDb();
  await bookingViewById(withLocale, BOOKING_ID, { locale: "en", isTest: true });
  assert.equal(withLocale.args("booking_view")[0].p_locale, "en");
  assert.equal(await bookingViewById(fakeDb({ view: () => null }), BOOKING_ID, { isTest: true }), null);
  assert.equal(await bookingViewById(fakeDb(), BOOKING_ID, { isTest: false }), null, "a TEST mismatch is null");
  for (const answer of ["x", 1, [], true]) {
    await assert.rejects(() => bookingViewById(fakeDb({ view: () => answer }), BOOKING_ID, { isTest: true }), /booking_view/, JSON.stringify(answer));
  }
});

const guestItem = (over = {}) => ({
  ref: REF, status: "awaiting_payment", stay_title: "Stay one", destination_name: "Destination one", image_key: "stays/stay-one/hero.webp",
  image_alt: "A hero", arrive: "2026-12-10", leave: "2026-12-13", plan: "deposit", grand_fils: 346500, paid_fils: 50000,
  still_due_fils: 296500, deadline: DEADLINE, ...over,
});

test("listGuestBookings: one guest_bookings call with the email, the language and the host's flag; paid_fils becomes paidFils", async () => {
  const db = fakeDb({ handlers: { guest_bookings: () => ({ items: [guestItem(), guestItem({ ref: UNKNOWN_REF, status: "confirmed", image_key: null, deadline: null })] }) } });
  const list = await listGuestBookings(db, { email: "ann@example.com", locale: "ar", isTest: true });
  assert.deepEqual(db.args("guest_bookings"), [{ p_email: "ann@example.com", p_locale: "ar", p_is_test: true }]);
  assert.deepEqual(list, [
    {
      ref: REF, status: "awaiting_payment", stayTitle: "Stay one", destinationName: "Destination one",
      image: { src: media.mediaUrl("stays/stay-one/hero.webp"), alt: "A hero" }, arrive: "2026-12-10", leave: "2026-12-13",
      plan: "deposit", grandFils: 346500, paidFils: 50000, stillDueFils: 296500, deadline: DEADLINE,
    },
    {
      ref: UNKNOWN_REF, status: "confirmed", stayTitle: "Stay one", destinationName: "Destination one", image: null,
      arrive: "2026-12-10", leave: "2026-12-13", plan: "deposit", grandFils: 346500, paidFils: 50000, stillDueFils: 296500, deadline: null,
    },
  ]);
  assert.deepEqual(await listGuestBookings(fakeDb({ handlers: { guest_bookings: () => ({ items: [] }) } }), { email: "x@example.com", locale: "en", isTest: false }), []);
});

test("listGuestBookings: an item without paid_fils, or any other unreadable answer, is thrown", async () => {
  const { paid_fils: _drop, ...noPaid } = guestItem();
  for (const answer of [{ items: [noPaid] }, { items: [guestItem({ paid_fils: "1" })] }, { items: [guestItem({ status: "paid" })] }, { items: "x" }, null, [], { __error: { message: "down" } }]) {
    const db = fakeDb({ handlers: { guest_bookings: () => answer } });
    await assert.rejects(() => listGuestBookings(db, { email: "ann@example.com", locale: "en", isTest: true }), /guest_bookings/, JSON.stringify(answer));
  }
});

// ================================================================ withdrawBooking (P-19)

test("withdraw: with the token, one booking_withdraw_request; the first time the owner gets one notice and the guest none", async () => {
  const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn() } });
  const n = fakeNotifier();
  const out = await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier });
  assert.equal(out.status, 200);
  assert.deepEqual(out.response, { ok: true, ref: REF, status: "cancelled", firstTime: true });
  assert.deepEqual(db.args("booking_withdraw_request"), [{ p_booking: BOOKING_ID, p_expect_test: true }]);
  assert.deepEqual(db.args("booking_view"), [{ p_booking: BOOKING_ID, p_locale: null, p_expect_test: true }]);
  assert.deepEqual(n.kinds(), ["ownerWithdrawn"], "no guest mail (04-05's row)");
  assert.deepEqual(n.calls[0].opts, { idempotencyKey: `withdrawn-owner/${BOOKING_ID}` });
  assert.equal(n.calls[0].job.bookingId, BOOKING_ID);
  assert.equal(n.calls[0].job.isTest, true);
  assert.equal(n.calls[0].job.bookingUrl, `${PREVIEW}/es/bookings/trip?ref=${REF}`, "the owner's link carries no token");
  assert.deepEqual(db.events(), [{ action: "email_sent", template: "request_withdrawn_owner", key: `withdrawn-owner/${BOOKING_ID}` }]);
  assert.equal(JSON.stringify(out.response).includes(BOOKING_ID), false);
});

test("withdraw: a real booking's notice links to the production origin", async () => {
  const db = fakeDb({ isTest: false, handlers: { booking_withdraw_request: () => withdrawn() } });
  const n = fakeNotifier();
  await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: false, notifier: n.notifier });
  assert.deepEqual(db.args("booking_withdraw_request"), [{ p_booking: BOOKING_ID, p_expect_test: false }]);
  assert.equal(n.calls[0].job.bookingUrl, `${PRODUCTION}/es/bookings/trip?ref=${REF}`);
});

test("withdraw (T7): a second withdraw answers firstTime false and sends nothing", async () => {
  const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn({ first_time: false }) } });
  const n = fakeNotifier();
  const out = await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier });
  assert.equal(out.status, 200);
  assert.deepEqual(out.response, { ok: true, ref: REF, status: "cancelled", firstTime: false });
  assert.deepEqual(n.calls, []);
  assert.deepEqual(db.names(), ["booking_by_ref", "booking_withdraw_request"]);
});

test("withdraw: part_paid and not_withdrawable are 409 with the reason; not_found is the bare 404; nothing is mailed", async () => {
  for (const [reason, status, body] of [
    ["part_paid", 409, { ok: false, reason: "part_paid" }],
    ["not_withdrawable", 409, { ok: false, reason: "not_withdrawable" }],
    ["not_found", 404, { ok: false }],
  ]) {
    const db = fakeDb({ handlers: { booking_withdraw_request: () => ({ ok: false, reason }) } });
    const n = fakeNotifier();
    const out = await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier });
    assert.equal(out.status, status, reason);
    assert.deepEqual(out.response, body, reason);
    assert.deepEqual(n.calls, [], reason);
  }
});

test("withdraw (T8): a wrong token, another link version, an unknown or malformed ref and no session are the identical 404; nothing is withdrawn", async () => {
  for (const [input, deps] of [
    [{ ref: REF, t: "A".repeat(43) }, {}],
    [{ ref: REF, t: await signBookingLink(BOOKING_ID, 2) }, {}],
    [{ ref: UNKNOWN_REF, t: await token() }, {}],
    [{ ref: "nope", t: await token() }, {}],
    [{ ref: REF }, {}],
    [{ ref: REF }, { readSession: async () => ({ email: "bob@example.com" }) }],
    [{ ref: REF, t: "A".repeat(43) }, { readSession: async () => ({ email: "ann@example.com" }) }],
  ]) {
    const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn() } });
    const out = await withdrawBooking(db, input, { isTest: true, notifier: fakeNotifier().notifier, ...deps });
    assert.equal(out.status, 404, JSON.stringify(input));
    assert.deepEqual(out.response, { ok: false }, JSON.stringify(input));
    assert.equal(db.names().includes("booking_withdraw_request"), false, JSON.stringify(input));
  }
});

test("withdraw: without a token the signed-in guest with the booking's email may withdraw", async () => {
  const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn() } });
  const out = await withdrawBooking(db, { ref: REF }, { isTest: true, notifier: fakeNotifier().notifier, readSession: async () => ({ email: "ANN@example.com" }) });
  assert.equal(out.status, 200);
  assert.equal(out.response.ok, true);
});

test("withdraw: a notice that is pending, fails or throws never changes the answer; a view that cannot be read sends nothing", async () => {
  const pending = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn() } });
  const out = await withdrawBooking(pending, { ref: REF, t: await token() }, { isTest: true, notifier: fakeNotifier({ ready: false }).notifier });
  assert.equal(out.status, 200);
  assert.deepEqual(pending.events(), [{ action: "email_pending", template: "request_withdrawn_owner", key: `withdrawn-owner/${BOOKING_ID}` }]);
  for (const mode of ["fails", "throws"]) {
    const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn() } });
    const r = await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: fakeNotifier({ mode }).notifier });
    assert.deepEqual(r, { status: 200, response: { ok: true, ref: REF, status: "cancelled", firstTime: true } }, mode);
    assert.equal(db.events()[0].action, "email_failed", mode);
  }
  for (const view of [() => null, () => ({ __error: { message: "down" } })]) {
    const db = fakeDb({ handlers: { booking_withdraw_request: () => withdrawn(), booking_view: view } });
    const n = fakeNotifier();
    const r = await withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: n.notifier });
    assert.equal(r.status, 200);
    assert.deepEqual(n.calls, []);
  }
});

test("withdraw: an unreadable answer or a database error is thrown (the route answers 503)", async () => {
  for (const answer of [null, "x", { ok: true }, withdrawn({ status: "expired" }), withdrawn({ first_time: 1 }), withdrawn({ ref: "nope" }), { ok: false, reason: "weird" }, { __error: { message: "down" } }]) {
    const db = fakeDb({ handlers: { booking_withdraw_request: () => answer } });
    await assert.rejects(
      async () => withdrawBooking(db, { ref: REF, t: await token() }, { isTest: true, notifier: fakeNotifier().notifier }),
      /booking_withdraw_request/,
      JSON.stringify(answer),
    );
  }
});

// ================================================================ the three routes, before the database

const ROUTES = {
  request: await loadRoute("app/api/booking/request/route.ts"),
  view: await loadRoute("app/api/booking/view/route.ts"),
  withdraw: await loadRoute("app/api/booking/withdraw/route.ts"),
};
const GOOD_BODY = { request: { ref: REF, t: "A".repeat(43) }, view: { ref: REF, t: "A".repeat(43), locale: "en" }, withdraw: { ref: REF, t: "A".repeat(43) } };

function post(handler, body, headers = {}) {
  return handler.POST(new Request(`${PREVIEW}/api/booking/x`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: PREVIEW, host: "preview.almarprivatejourney.com", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

async function expectJson(res, status, what) {
  assert.equal(res.status, status, what);
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/, what);
  assert.equal(res.headers.get("cache-control"), "no-store", what);
  return res.json();
}

/** Runs `fn` with these environment values (undefined deletes), then puts every one back. */
async function withEnv(values, fn) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("routes: a foreign, missing or null Origin is 403 before anything is read", async () => {
  for (const [name, handler] of Object.entries(ROUTES)) {
    for (const origin of ["https://evil.example", "null", ""]) {
      assert.deepEqual(await expectJson(await post(handler, GOOD_BODY[name], { origin }), 403, `${name} ${origin}`), { ok: false, reasons: [{ code: "invalid", field: "origin" }] });
    }
    assert.equal((await post(handler, GOOD_BODY[name], { host: "evil.example" })).status, 403, `${name}: the host decides the origin`);
  }
});

test("routes: a body that is not JSON is 400, a body over 4 KB is 413 (declared or streamed), an unknown key is 400 naming it", async () => {
  for (const [name, handler] of Object.entries(ROUTES)) {
    assert.deepEqual(await expectJson(await post(handler, "plain", { "content-type": "text/plain" }), 400, `${name} type`), { ok: false, reasons: [{ code: "invalid", field: "body" }] });
    assert.equal((await post(handler, "{not json")).status, 400, `${name} bad JSON`);
    assert.equal((await post(handler, "x".repeat(5 * 1024))).status, 413, `${name}: 5 KB streamed`);
    assert.equal((await post(handler, "{}", { "content-length": String(5 * 1024) })).status, 413, `${name}: 5 KB declared`);
    const extra = await expectJson(await post(handler, { ...GOOD_BODY[name], extra: 1 }), 400, `${name} extra`);
    assert.deepEqual(extra, { ok: false, reasons: [{ code: "invalid", field: "extra" }] });
    const isTest = await expectJson(await post(handler, { ...GOOD_BODY[name], is_test: false }), 400, `${name} is_test`);
    assert.deepEqual(isTest.reasons, [{ code: "invalid", field: "is_test" }], `${name}: the TEST flag can never be sent`);
  }
});

test("routes: without the database, or without the link secret, a good body is 503 unavailable", async () => {
  for (const [name, handler] of Object.entries(ROUTES)) {
    await withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
      assert.deepEqual(await expectJson(await post(handler, GOOD_BODY[name]), 503, `${name} no db`), { ok: false, reasons: [{ code: "unavailable" }] });
    });
    // A client to a closed local port: the route stops at the missing secret before any call is made.
    await withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key", BOOKING_LINK_SECRET: undefined }, async () => {
      assert.deepEqual(await expectJson(await post(handler, GOOD_BODY[name]), 503, `${name} no secret`), { ok: false, reasons: [{ code: "unavailable" }] });
    });
  }
});

test("routes: POST only", () => {
  for (const [name, handler] of Object.entries(ROUTES)) {
    assert.equal(typeof handler.POST, "function", name);
    assert.equal(handler.dynamic, "force-dynamic", name);
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD"]) assert.equal(handler[method], undefined, `${name} ${method}`);
  }
});

test("routes: the booking id stays in lib; the request route reads the gate before it requests; view and withdraw take TEST from the host", () => {
  for (const name of Object.keys(ROUTES)) {
    const source = readFileSync(`app/api/booking/${name}/route.ts`, "utf8");
    assert.doesNotMatch(source, /booking_id|bookingId/, name);
  }
  const request = readFileSync("app/api/booking/request/route.ts", "utf8");
  assert.ok(request.indexOf("currentRequestGate(") > 0 && request.indexOf("currentRequestGate(") < request.indexOf("requestBooking("), "the gate comes first");
  assert.match(request, /isTest: gate\.isTest/);
  assert.match(request, /originForBooking\(gate\.isTest\)/);
  for (const name of ["view", "withdraw"]) {
    const source = readFileSync(`app/api/booking/${name}/route.ts`, "utf8");
    assert.match(source, /isTestHost\(request\.headers\.get\("host"\)\)/, name);
    assert.doesNotMatch(source, /currentRequestGate/, `${name}: no request gate`);
  }
});
