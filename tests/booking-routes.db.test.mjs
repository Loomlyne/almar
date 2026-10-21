// The booking routes end to end on a real local database (plans 04-02, Task 3, and 04-08, Task 4: request, view and
// withdraw, and the request gate on quote and hold): the handler functions are called with real Request objects, so the
// origin check, the size limits, the parsers, the status codes, the headers and the service-role client are the ones
// that ship. TEST comes from the Host header. Needs this worktree's own local Supabase stack
// (node tests/helpers/local-supabase.mjs start). Without one the cases are skipped with a printed reason; with
// ALMAR_REQUIRE_STACK=1 a missing stack fails. It talks only to the stack's own http://127.0.0.1 URL and removes what it
// made; the owner's bank details are put back as they were, and the owner user is deleted only when this file made it.
// Bank values are documentation examples only (GB82 WEST 1234 5698 7654 32, BIC TESTAEAA).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { lockStack } from "./helpers/local-supabase.mjs";
import { loadRoute } from "./helpers/load-route.mjs";

const ORIGIN = "https://preview.almarprivatejourney.com";
const PRODUCTION = { origin: "https://almarprivatejourney.com", host: "almarprivatejourney.com" };
const SECRET = "route-test-secret-".padEnd(48, "r");
const SAVED = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, link: process.env.BOOKING_LINK_SECRET };
const OWNER_EMAIL = "maria@almarprivatejourney.com";
const TEST_BANK = {
  account_name: "Almar Test Account",
  bank_name: "Test Bank",
  iban: "GB82WEST12345698765432",
  swift: "TESTAEAA",
  bank_address: "1 Test Street, Dubai",
  note_en: "All fees paid by the sender.",
};
const NO_BANK = { account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null };
let state = null;
let releaseStackLock = null; // the stack is shared with the other files of `node --test`: take turns
let madeOwner = null;
let bankBefore = null;

function dubaiDay(offset) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

async function waitReady(admin) {
  for (let i = 0, good = 0; i < 120 && good < 3; i += 1) {
    const r = await admin.rpc("booking_context", { p_stay_slug: "ready-probe", p_from: null, p_to: null, p_locale: "en" });
    if (!r.error) { good += 1; await new Promise((x) => setTimeout(x, 300)); continue; }
    good = 0;
    await new Promise((x) => setTimeout(x, 500));
  }
}

async function ownerId(admin) {
  const found = await admin.from("profiles").select("id, role").eq("email", OWNER_EMAIL).maybeSingle();
  assert.ifError(found.error);
  if (found.data) {
    assert.equal(found.data.role, "owner", "the owner email has the owner role");
    return found.data.id;
  }
  const created = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
  assert.ifError(created.error);
  madeOwner = created.data.user.id;
  const made = await admin.from("profiles").select("id, role").eq("id", madeOwner).single();
  assert.ifError(made.error);
  assert.equal(made.data.role, "owner", "the auth trigger gives the owner email the owner role");
  return made.data.id;
}

/** The owner's money Save (ops_save_money_settings), as the dashboard makes it. */
async function saveBank(s, bank) {
  const r = await s.admin.rpc("ops_save_money_settings", { p: { bank }, p_actor: s.ownerId });
  assert.ifError(r.error);
  return r.data;
}

async function seed(t) {
  if (state) return state;
  const locked = await lockStack(t);
  if (!locked) return null;
  releaseStackLock = locked.release;
  const stack = locked.stack;
  assert.match(stack.url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "this test only talks to a local stack");
  process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceKey;
  process.env.BOOKING_LINK_SECRET = SECRET;
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await waitReady(admin);
  const suffix = randomUUID().slice(0, 8);
  const ids = { destination: randomUUID(), stay: randomUUID() };
  let r = await admin.from("destinations").insert({ id: ids.destination, slug: `route-dest-${suffix}`, is_published: true });
  assert.ifError(r.error);
  r = await admin.from("stays").insert({ id: ids.stay, slug: `route-stay-${suffix}`, destination_id: ids.destination, max_guests: 6, min_nights: 1, base_nightly_rate_aed: 1000, is_published: true });
  assert.ifError(r.error);
  // A request needs complete bank details (P-08); a TEST booking gets the 35-minute window whatever the owner's (P-06).
  // The owner's Save fills them; they are put back as they were after.
  const bank = await admin.from("booking_bank_details").select("*").eq("id", 1).single();
  assert.ifError(bank.error);
  bankBefore = bank.data;
  state = {
    admin,
    ids,
    ownerId: await ownerId(admin),
    slug: `route-stay-${suffix}`,
    quote: await loadRoute("app/api/booking/quote/route.ts"),
    hold: await loadRoute("app/api/booking/hold/route.ts"),
    release: await loadRoute("app/api/booking/release/route.ts"),
    request: await loadRoute("app/api/booking/request/route.ts"),
    view: await loadRoute("app/api/booking/view/route.ts"),
    withdraw: await loadRoute("app/api/booking/withdraw/route.ts"),
  };
  const saved = await saveBank(state, TEST_BANK);
  assert.equal(saved.bank_complete, true, "the seeded bank details are complete");
  return state;
}

after(async () => {
  for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", SAVED.url], ["SUPABASE_SERVICE_ROLE_KEY", SAVED.key], ["BOOKING_LINK_SECRET", SAVED.link]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    if (!state) return;
    await state.admin.from("bookings").delete().eq("stay_id", state.ids.stay);
    await state.admin.from("stays").delete().eq("id", state.ids.stay);
    await state.admin.from("destinations").delete().eq("id", state.ids.destination);
    if (bankBefore) await state.admin.from("booking_bank_details").update(bankBefore).eq("id", 1);
    if (madeOwner) await state.admin.auth.admin.deleteUser(madeOwner);
  } finally {
    releaseStackLock?.();
  }
});

// A fresh visitor address for every call, so the limiter (twenty holds an hour per address) never counts one run's holds
// against the next run's; only the email limiter is exercised on purpose, with one email.
const visitor = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

function post(handler, body, headers = {}) {
  return handler.POST(new Request(`${ORIGIN}/api/booking/x`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "preview.almarprivatejourney.com", "x-forwarded-for": visitor(), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

const quoteBody = (s, over = {}) => ({ stay: s.slug, from: dubaiDay(2000), to: dubaiDay(2003), adults: 2, children: 0, infants: 0, addons: [], plan: "full", locale: "en", ...over });
const holdBody = (s, email, over = {}) => ({
  ...quoteBody(s),
  contact: { name: "Route Guest", email, phone: "+971 50 123 4567" },
  travellers: [{ kind: "adult", fullName: "Route Guest", isBooker: true, notStaying: false }, { kind: "adult", fullName: "Other Adult", isBooker: false, notStaying: false }],
  airport: "DXB",
  termsAccepted: true,
  ...over,
});
const email = () => `route-${randomUUID().slice(0, 8)}@example.com`;

async function expectJson(res, status) {
  assert.equal(res.status, status);
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  return res.json();
}

test("every route: a foreign or missing Origin is 403, a body that is not JSON is 400, an oversized body is 413", async (t) => {
  const s = await seed(t);
  if (!s) return;
  for (const [name, handler, limit] of [["quote", s.quote, 32 * 1024], ["hold", s.hold, 32 * 1024], ["release", s.release, 4 * 1024]]) {
    for (const origin of ["https://evil.example", "null", ""]) {
      const body = await expectJson(await post(handler, {}, { origin }), 403);
      assert.deepEqual(body, { ok: false, reasons: [{ code: "invalid", field: "origin" }] }, `${name} origin ${origin}`);
    }
    const noOrigin = new Request(`${ORIGIN}/api/booking/x`, { method: "POST", headers: { "content-type": "application/json", host: "preview.almarprivatejourney.com" }, body: "{}" });
    assert.equal((await handler.POST(noOrigin)).status, 403, `${name}: no Origin header at all`);
    assert.equal((await post(handler, "{}", { host: "evil.example" })).status, 403, `${name}: the host decides which origin is allowed`);
    assert.equal((await post(handler, "{}", { origin: "https://almarprivatejourney.com", host: "almarprivatejourney.com" })).status, 400, `${name}: the production origin is allowed on its own host`);
    assert.equal((await post(handler, "plain", { "content-type": "text/plain" })).status, 400, `${name}: not JSON`);
    assert.equal((await post(handler, "{not json")).status, 400, `${name}: bad JSON`);
    assert.equal((await post(handler, "[]")).status, 400, `${name}: an array is not a request`);
    assert.equal((await post(handler, "x".repeat(limit + 1))).status, 413, `${name}: streamed bytes over the limit`);
    assert.equal((await post(handler, "{}", { "content-length": String(limit + 1) })).status, 413, `${name}: declared length over the limit`);
    assert.equal((await post(handler, `{"a":"${"x".repeat(limit - 20)}"}`)).status, 400, `${name}: just under the limit is read (and refused as unknown key)`);
    const get = handler.GET;
    assert.equal(get, undefined, `${name} exports no GET`);
  }
});

test("quote route: 200 with the answer, also when it says not bookable; 400 names the field", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const ok = await expectJson(await post(s.quote, quoteBody(s)), 200);
  assert.equal(ok.ok, true, JSON.stringify(ok.reasons));
  assert.equal(ok.breakdown.nightsFils, 300000);
  assert.equal(ok.stay.slug, s.slug);
  const missing = await expectJson(await post(s.quote, quoteBody(s, { stay: "no-such-stay" })), 200);
  assert.deepEqual(missing.reasons, [{ code: "stay_unavailable" }]);
  assert.equal(missing.ok, false);
  const bad = await expectJson(await post(s.quote, { ...quoteBody(s), price: 1 }), 400);
  assert.deepEqual(bad, { ok: false, reasons: [{ code: "invalid", field: "price" }] });
  const badField = await expectJson(await post(s.quote, quoteBody(s, { adults: 0 })), 400);
  assert.deepEqual(badField.reasons, [{ code: "invalid", field: "adults" }]);
});

test("quote route: 503 when the database is not configured", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const body = await expectJson(await post(s.quote, quoteBody(s)), 503);
    assert.deepEqual(body, { ok: false, reasons: [{ code: "unavailable" }] });
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }
});

test("hold route: 200 with the reference, the end of the hold and a signed link and nothing that names the booking id", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const guest = email();
  const body = await expectJson(await post(s.hold, holdBody(s, guest, { from: dubaiDay(2100), to: dubaiDay(2102) })), 200);
  assert.deepEqual(Object.keys(body).sort(), ["breakdown", "holdExpiresAt", "linkToken", "ok", "ref", "transferWindowMinutes"]);
  assert.equal(body.transferWindowMinutes, 35, "the preview host is TEST: the 35-minute window (P-06)");
  assert.match(body.ref, /^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.match(body.linkToken, /^[A-Za-z0-9_-]{43}$/);
  const row = await s.admin.from("bookings").select("id, status, is_test, hold_expires_at, email").eq("ref", body.ref).single();
  assert.ifError(row.error);
  assert.equal(row.data.status, "held");
  assert.equal(row.data.is_test, true, "the preview host: TEST");
  assert.equal(row.data.email, guest);
  assert.equal(JSON.stringify(body).includes(row.data.id), false, "the booking id is never sent to the browser");
  assert.ok(Math.abs(Date.parse(body.holdExpiresAt) - Date.parse(row.data.hold_expires_at)) < 1000, "the answer's hold end is the stored one");
  // The same nights again: 409 with the reason.
  const again = await expectJson(await post(s.hold, holdBody(s, email(), { from: dubaiDay(2100), to: dubaiDay(2102) })), 409);
  assert.deepEqual(again, { ok: false, reasons: [{ code: "sold_out", nights: [dubaiDay(2100), dubaiDay(2101)] }] });
  // The page's own quote of its own hold is ok with the token.
  const own = await expectJson(await post(s.quote, quoteBody(s, { from: dubaiDay(2100), to: dubaiDay(2102), hold: { ref: body.ref, t: body.linkToken } })), 200);
  assert.equal(own.ok, true);
  // Release: wrong token and unknown reference are the same 404; the right token frees the nights.
  const wrong = await expectJson(await post(s.release, { ref: body.ref, t: "A".repeat(43) }), 404);
  const unknown = await expectJson(await post(s.release, { ref: "ALMAR-AAAAAA", t: body.linkToken }), 404);
  assert.deepEqual(wrong, { ok: false });
  assert.deepEqual(unknown, wrong, "a wrong token and an unknown reference cannot be told apart");
  assert.equal((await s.admin.from("bookings").select("status").eq("ref", body.ref).single()).data.status, "held");
  assert.deepEqual(await expectJson(await post(s.release, { ref: body.ref, t: body.linkToken }), 200), { ok: true });
  assert.equal((await s.admin.from("bookings").select("status").eq("ref", body.ref).single()).data.status, "expired");
  assert.deepEqual(await expectJson(await post(s.release, { ref: body.ref, t: body.linkToken }), 200), { ok: true }, "releasing twice is harmless");
  assert.equal((await post(s.release, { ref: body.ref, t: body.linkToken, extra: 1 })).status, 400);
  assert.equal((await post(s.release, { ref: body.ref })).status, 400, "a release without a token is not a request");
});

test("hold route: 400 for a body that is not a hold, 409 for blocked or unknown stays, 429 on the sixth in an hour", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const noTerms = await expectJson(await post(s.hold, holdBody(s, email(), { termsAccepted: false })), 400);
  assert.deepEqual(noTerms.reasons, [{ code: "invalid", field: "termsAccepted" }]);
  const quoteShape = await expectJson(await post(s.hold, quoteBody(s)), 400);
  assert.deepEqual(quoteShape.reasons, [{ code: "invalid", field: "contact" }]);
  const unknown = await expectJson(await post(s.hold, holdBody(s, email(), { stay: "no-such-stay" })), 409);
  assert.deepEqual(unknown.reasons, [{ code: "stay_unavailable" }]);
  const block = await s.admin.rpc("ops_add_block", { p: { scope: "stay", stay_id: s.ids.stay, starts_on: dubaiDay(2200), ends_on: dubaiDay(2200) } });
  assert.ifError(block.error);
  const blocked = await expectJson(await post(s.hold, holdBody(s, email(), { from: dubaiDay(2199), to: dubaiDay(2202) })), 409);
  assert.deepEqual(blocked.reasons, [{ code: "blocked", nights: [dubaiDay(2200)] }]);

  const spammer = email();
  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    const res = await post(s.hold, holdBody(s, spammer, { from: dubaiDay(2300 + i * 3), to: dubaiDay(2302 + i * 3) }));
    statuses.push(res.status);
    if (res.status === 429) assert.deepEqual(await res.json(), { ok: false, reasons: [{ code: "hold_limit" }] });
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test("hold route: 503 without the link secret and without the database; nothing is created", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const count = async () => (await s.admin.from("bookings").select("id", { count: "exact", head: true }).eq("stay_id", s.ids.stay)).count;
  const before = await count();
  const body = holdBody(s, email(), { from: dubaiDay(2400), to: dubaiDay(2402) });

  delete process.env.BOOKING_LINK_SECRET;
  try {
    assert.deepEqual(await expectJson(await post(s.hold, body), 503), { ok: false, reasons: [{ code: "unavailable" }] });
  } finally {
    process.env.BOOKING_LINK_SECRET = SECRET;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    assert.equal((await post(s.hold, body)).status, 503);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }
  assert.equal(await count(), before, "no booking was created by either refusal");
});

test("the request gate: the production host is closed while the terms are the placeholder; cleared bank details close the preview host; nothing is created", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const count = async () => (await s.admin.from("bookings").select("id", { count: "exact", head: true }).eq("stay_id", s.ids.stay)).count;
  const before = await count();
  const body = holdBody(s, email(), { from: dubaiDay(2450), to: dubaiDay(2452) });
  const closed = { ok: false, reasons: [{ code: "requests_closed" }] };

  assert.deepEqual(await expectJson(await post(s.hold, body, PRODUCTION), 503), closed, "production: placeholder terms, sender not ready");
  const quote = await expectJson(await post(s.quote, quoteBody(s, { from: dubaiDay(2450), to: dubaiDay(2452) }), PRODUCTION), 200);
  assert.equal(quote.ok, false);
  assert.deepEqual(quote.reasons, [{ code: "requests_closed" }], "the quote shows the closed state as one reason");
  assert.equal(quote.breakdown.nightsFils, 200000, "and keeps its price");

  await saveBank(s, NO_BANK);
  try {
    assert.deepEqual(await expectJson(await post(s.hold, body), 503), closed, "preview: bank details incomplete");
    const previewQuote = await expectJson(await post(s.quote, quoteBody(s, { from: dubaiDay(2450), to: dubaiDay(2452) })), 200);
    assert.deepEqual(previewQuote.reasons, [{ code: "requests_closed" }]);
  } finally {
    await saveBank(s, TEST_BANK);
  }
  assert.equal(await count(), before, "no booking was created while requests were closed");
  assert.equal((await post(s.hold, body)).status, 200, "complete bank details open the preview host again");
});

test("request and view end to end on the preview host: one request, one pair of pending emails, then the view by token only", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const held = await expectJson(await post(s.hold, holdBody(s, email(), { from: dubaiDay(2600), to: dubaiDay(2602) })), 200);
  const row = await s.admin.from("bookings").select("id").eq("ref", held.ref).single();
  assert.ifError(row.error);
  const id = row.data.id;
  const events = async () => {
    const r = await s.admin.from("booking_events").select("action, detail").eq("booking_id", id).order("id");
    assert.ifError(r.error);
    return r.data;
  };

  const first = await expectJson(await post(s.request, { ref: held.ref, t: held.linkToken }), 200);
  assert.deepEqual(Object.keys(first).sort(), ["deadline", "emailSent", "firstTime", "ok", "ref", "status"]);
  assert.equal(first.ok, true);
  assert.equal(first.ref, held.ref);
  assert.equal(first.status, "awaiting_payment");
  assert.equal(first.firstTime, true);
  assert.equal(first.emailSent, false, "the default sender is not ready");
  assert.ok(Date.parse(first.deadline) > Date.now() + 30 * 60 * 1000, "the TEST window is 35 minutes");
  assert.equal(JSON.stringify(first).includes(id), false, "the booking id is never sent to the browser");
  const stored = await s.admin.from("bookings").select("status, requested_at").eq("id", id).single();
  assert.equal(stored.data.status, "awaiting_payment");
  assert.notEqual(stored.data.requested_at, null);
  const afterFirst = await events();
  assert.deepEqual(afterFirst.filter((e) => e.action === "email_pending").map((e) => e.detail), [
    { template: "request_received", key: `request/${id}` },
    { template: "request_owner", key: `request-owner/${id}` },
  ]);
  assert.equal(afterFirst.filter((e) => e.action === "request_sent").length, 1);

  const again = await expectJson(await post(s.request, { ref: held.ref, t: held.linkToken }), 200);
  assert.equal(again.firstTime, false);
  assert.equal(again.deadline, first.deadline, "the stored deadline");
  assert.equal(again.emailSent, false);
  assert.equal((await events()).length, afterFirst.length, "a second request writes nothing");

  const view = await expectJson(await post(s.view, { ref: held.ref, t: held.linkToken }), 200);
  assert.equal(view.ok, true);
  assert.equal(view.booking.ref, held.ref);
  assert.equal(view.booking.status, "awaiting_payment");
  assert.equal(view.booking.deadline, first.deadline);
  assert.equal(view.booking.withdrawable, true);
  assert.equal(view.booking.access, null, "no stay access before the booking is confirmed");
  assert.notEqual(view.booking.transfer, null, "the transfer details while money is due");
  assert.equal(view.booking.transfer.iban, TEST_BANK.iban);
  assert.equal(view.booking.transfer.reference, held.ref);
  assert.equal(view.booking.transfer.currency, "AED");
  assert.equal(view.booking.transfer.amountFils, view.booking.money.dueNowFils);
  assert.equal(JSON.stringify(view).includes(id), false, "the view never names the booking id");

  const wrong = await expectJson(await post(s.view, { ref: held.ref, t: "A".repeat(43) }), 404);
  const unknown = await expectJson(await post(s.view, { ref: "ALMAR-AAAAAA", t: held.linkToken }), 404);
  const production = await expectJson(await post(s.view, { ref: held.ref, t: held.linkToken }, PRODUCTION), 404);
  assert.deepEqual(wrong, { ok: false });
  assert.deepEqual(unknown, wrong, "an unknown reference and a wrong token cannot be told apart");
  assert.deepEqual(production, wrong, "a TEST booking on the production host is the same 404");
  assert.deepEqual(await expectJson(await post(s.view, { ref: held.ref }), 404), wrong, "no token and no session");
  assert.deepEqual(await expectJson(await post(s.request, { ref: held.ref, t: "A".repeat(43) }), 404), wrong, "request with a wrong token");
});

test("withdraw end to end on the preview host: an unpaid request is cancelled once with its nights freed; a part-paid one is refused", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const requestOne = async (from) => {
    const held = await expectJson(await post(s.hold, holdBody(s, email(), { from: dubaiDay(from), to: dubaiDay(from + 2) })), 200);
    assert.equal((await expectJson(await post(s.request, { ref: held.ref, t: held.linkToken }), 200)).firstTime, true);
    const row = await s.admin.from("bookings").select("id").eq("ref", held.ref).single();
    assert.ifError(row.error);
    return { ...held, id: row.data.id };
  };
  const eventsOf = async (id) => {
    const r = await s.admin.from("booking_events").select("action, detail").eq("booking_id", id).order("id");
    assert.ifError(r.error);
    return r.data;
  };
  const nightsOf = async (id) => (await s.admin.from("booking_nights").select("night", { count: "exact", head: true }).eq("booking_id", id)).count;

  const one = await requestOne(2700);
  assert.equal(await nightsOf(one.id), 2);
  const before = (await eventsOf(one.id)).length;
  const first = await expectJson(await post(s.withdraw, { ref: one.ref, t: one.linkToken }), 200);
  assert.deepEqual(first, { ok: true, ref: one.ref, status: "cancelled", firstTime: true });
  assert.equal((await s.admin.from("bookings").select("status").eq("id", one.id).single()).data.status, "cancelled");
  assert.equal(await nightsOf(one.id), 0, "the nights are free at once");
  const added = (await eventsOf(one.id)).slice(before);
  assert.deepEqual(added.filter((e) => e.action === "email_pending").map((e) => e.detail), [{ template: "request_withdrawn_owner", key: `withdrawn-owner/${one.id}` }]);
  assert.equal(added.filter((e) => e.action === "request_withdrawn").length, 1);
  assert.equal(added.filter((e) => e.action.startsWith("email_") && e.detail.template !== "request_withdrawn_owner").length, 0, "no guest email");
  const afterFirst = (await eventsOf(one.id)).length;
  assert.deepEqual(await expectJson(await post(s.withdraw, { ref: one.ref, t: one.linkToken }), 200), { ok: true, ref: one.ref, status: "cancelled", firstTime: false });
  assert.equal((await eventsOf(one.id)).length, afterFirst, "a second withdraw writes nothing");
  const view = await expectJson(await post(s.view, { ref: one.ref, t: one.linkToken }), 200);
  assert.equal(view.booking.status, "cancelled");
  assert.equal(view.booking.transfer, null);
  assert.equal(view.booking.withdrawable, false);

  const paid = await requestOne(2710);
  const record = await s.admin.rpc("ops_record_payment", {
    p: { booking_id: paid.id, request_id: randomUUID(), expected_status: "awaiting_payment", amount_fils: 100, received_on: dubaiDay(0), bank_reference: "ROUTE-TEST-1" },
    p_actor: s.ownerId,
  });
  assert.ifError(record.error);
  assert.deepEqual(await expectJson(await post(s.withdraw, { ref: paid.ref, t: paid.linkToken }), 409), { ok: false, reason: "part_paid" });
  assert.equal((await s.admin.from("bookings").select("status").eq("id", paid.id).single()).data.status, "awaiting_payment", "nothing changed");

  const wrong = await expectJson(await post(s.withdraw, { ref: paid.ref, t: "A".repeat(43) }), 404);
  const production = await expectJson(await post(s.withdraw, { ref: paid.ref, t: paid.linkToken }, PRODUCTION), 404);
  assert.deepEqual(wrong, { ok: false });
  assert.deepEqual(production, wrong, "a TEST booking on the production host is the same 404");
  assert.deepEqual(await expectJson(await post(s.withdraw, { ref: "ALMAR-AAAAAA", t: paid.linkToken }), 404), wrong);
});

test("release route: 503 without the database", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    assert.deepEqual(await expectJson(await post(s.release, { ref: "ALMAR-AAAAAA", t: "A".repeat(43) }), 503), { ok: false, reasons: [{ code: "unavailable" }] });
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }
});

test("the routes never log: no console output while a hold, a quote, a request, a view, a withdraw and a release run", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const seen = [];
  const originals = {};
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    originals[level] = console[level];
    console[level] = (...args) => seen.push([level, args.map(String).join(" ")]);
  }
  try {
    const guest = email();
    const held = await (await post(s.hold, holdBody(s, guest, { from: dubaiDay(2500), to: dubaiDay(2502) }))).json();
    await post(s.quote, quoteBody(s, { from: dubaiDay(2500), to: dubaiDay(2502) }));
    await post(s.hold, "{bad");
    await post(s.request, { ref: held.ref, t: held.linkToken });
    await post(s.view, { ref: held.ref, t: held.linkToken });
    await post(s.view, { ref: held.ref, t: "A".repeat(43) });
    await post(s.withdraw, { ref: held.ref, t: held.linkToken });
    await post(s.release, { ref: held.ref, t: held.linkToken });
  } finally {
    for (const level of Object.keys(originals)) console[level] = originals[level];
  }
  assert.deepEqual(seen, [], "nothing was logged");
});
