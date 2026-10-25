// Plan 04-09 Task 6: every owner booking handler (lib/ops/bookings-api.ts) and the money handlers (lib/ops/money-settings.ts)
// against 04-08's real SQL on this worktree's own local Supabase stack, through runOps exactly as lib/ops/route.ts builds
// it (Origin, JSON, parse, handler, refusal mapping); only requireOwner() is replaced by a decide that answers the owner
// (tests/ops-api-local.test.mjs pattern). Plus the two parity grids: nextStatus vs public.booking_next_status and
// depositFloor vs public.booking_deposit_floor.
//
// lockStack(t): skipped without a stack, FAILS under ALMAR_REQUIRE_STACK=1. Seeded the way tests/booking-money.db.test.mjs
// seeds (a destination and a stay, create_web_booking, request_web_booking); rows are removed by id, the bank details and
// balance due days are put back, then the stack is reset and PostgREST waited for (memory ops-api-local-testing). It
// talks only to the stack's own http://127.0.0.1 URL (checked). Symbolic fils, bracket names, and for the bank only the
// documentation example IBAN AE07 0331 2345 6789 0123 456 and BIC TESTAEAAXXX. Runs only on the controller's slot go.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./helpers/load-ts.mjs";
import { lockStack, resetLocal } from "./helpers/local-supabase.mjs";

const api = await loadTs("lib/ops/bookings-api.ts");
const money = await loadTs("lib/ops/money-settings.ts");
const rules = await loadTs("lib/ops/booking-rules.ts");
const { runOps } = await loadTs("lib/ops/route-core.ts");
const { bookingViewById } = await loadTs("lib/booking/server.ts");
const { NOT_READY_NOTIFIER } = await loadTs("lib/booking/notify.ts");

const OPS = "https://dashboard.almarprivatejourney.com";
const OWNER_EMAIL = "maria@almarprivatejourney.com";
const DAYS = 14;
const TEST_BANK = {
  account_name: "[Account name]",
  bank_name: "[Bank name]",
  iban: "AE070331234567890123456",
  swift: "TESTAEAAXXX",
  bank_address: "[Bank address]",
  note_en: "[Note line]",
};

let state = null; // { admin, ids, slug, owner, guest, vatBp, depositBp } once seeded
let seedError = null;
let releaseStackLock = null;
let madeUsers = [];
let bankBefore = null;
let daysBefore;
const bookings = [];

// ---- stack plumbing ----------------------------------------------------------------------------------------------------

function dubaiDay(offset) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Right after a database reset PostgREST reconnects and reloads its schema; wait for it. */
async function waitReady(admin) {
  const transient = new Set(["PGRST001", "PGRST002", "PGRST202", "PGRST205"]);
  let last = null;
  let good = 0;
  for (let i = 0; i < 120 && good < 3; i += 1) {
    const rpc = await admin.rpc("ops_get_money_settings");
    if (!rpc.error) {
      good += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      continue;
    }
    good = 0;
    last = rpc.error;
    if (!transient.has(last.code)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (good < 3) assert.fail(`the local API did not become ready: ${JSON.stringify(last)}`);
}

async function profileId(admin, email, role) {
  const found = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
  assert.ifError(found.error);
  if (found.data) {
    assert.equal(found.data.role, role, `${email} has the ${role} role`);
    return found.data.id;
  }
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(created.error);
  madeUsers.push(created.data.user.id);
  const made = await admin.from("profiles").select("id, role").eq("id", created.data.user.id).single();
  assert.ifError(made.error);
  assert.equal(made.data.role, role, `the auth trigger gives ${email} the ${role} role`);
  return made.data.id;
}

async function seed(t) {
  if (state || seedError) return state;
  const locked = await lockStack(t);
  if (!locked) return null;
  releaseStackLock = locked.release;
  const stack = locked.stack;
  assert.match(stack.url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "this test only talks to a local stack");
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await waitReady(admin);
    const suffix = randomUUID().slice(0, 8);
    const ids = { destination: randomUUID(), stay: randomUUID() };
    const slug = `ops-pay-stay-${suffix}`;
    const settings = await admin.from("site_settings").select("vat_percent, deposit_percent, balance_due_days").eq("id", 1).single();
    assert.ifError(settings.error);
    assert.notEqual(settings.data.vat_percent, null, "settings are seeded by the migration (VAT)");
    assert.notEqual(settings.data.deposit_percent, null, "settings are seeded by the migration (deposit)");
    daysBefore = settings.data.balance_due_days;
    const vatBp = Math.round(Number(settings.data.vat_percent) * 100);
    const depositBp = Math.round(Number(settings.data.deposit_percent) * 100);
    assert.ok(depositBp > 0, "a deposit percentage above 0 (the cancel_first case needs a floor)");
    let r = await admin.from("destinations").insert({ id: ids.destination, slug: `ops-pay-dest-${suffix}`, is_published: true });
    assert.ifError(r.error);
    r = await admin.from("stays").insert({
      id: ids.stay, slug, destination_id: ids.destination, max_guests: 6, min_nights: 1, base_nightly_rate_aed: 1000, is_published: true,
    });
    assert.ifError(r.error);
    // A request needs complete bank details (P-08) and a deposit plan needs balance due days: fixture values, put back after.
    const bank = await admin.from("booking_bank_details").select("*").eq("id", 1).single();
    assert.ifError(bank.error);
    bankBefore = bank.data;
    r = await admin.from("booking_bank_details").update(TEST_BANK).eq("id", 1);
    assert.ifError(r.error);
    r = await admin.from("site_settings").update({ balance_due_days: DAYS }).eq("id", 1);
    assert.ifError(r.error);
    const ownerId = await profileId(admin, OWNER_EMAIL, "owner");
    const guestId = await profileId(admin, `ops-pay-guest-${suffix}@example.com`, "guest");
    state = {
      admin,
      ids,
      slug,
      vatBp,
      depositBp,
      owner: { profile: { id: ownerId, email: OWNER_EMAIL }, admin },
      guest: { profile: { id: guestId, email: "[guest email]" }, admin },
    };
  } catch (error) {
    seedError = error;
    throw error;
  }
  return state;
}

after(async () => {
  try {
    if (!state) return;
    const { admin, ids } = state;
    // Local rows only, by id. Bookings first (their nights, travellers, payments, notes and history cascade).
    for (const id of bookings) await admin.from("bookings").delete().eq("id", id);
    await admin.from("bookings").delete().eq("stay_id", ids.stay);
    await admin.from("stays").delete().eq("id", ids.stay);
    await admin.from("destinations").delete().eq("id", ids.destination);
    if (bankBefore) await admin.from("booking_bank_details").update(bankBefore).eq("id", 1);
    if (daysBefore !== undefined) await admin.from("site_settings").update({ balance_due_days: daysBefore }).eq("id", 1);
    for (const id of madeUsers) await admin.auth.admin.deleteUser(id);
    // Leave the database as the migrations make it, and the API ready for the next file that takes the lock.
    resetLocal();
    await waitReady(admin);
  } finally {
    releaseStackLock?.();
  }
});

// ---- bookings on the stack ---------------------------------------------------------------------------------------------

/** The payload lib/booking/server.ts snapshotRow() builds (symbolic numbers), deposit or full plan, three nights. */
function payload(s, { arrive, plan, email }) {
  const leave = addDays(arrive, 3);
  const rate = 100000;
  const nightsFils = 3 * rate;
  const vat = Math.floor((nightsFils * s.vatBp + 5000) / 10000);
  const grand = nightsFils + vat;
  const deposit = plan === "deposit" ? Math.floor((grand * s.depositBp + 5000) / 10000) : 0;
  return {
    stay_slug: s.slug,
    arrive,
    leave,
    adults: 2,
    children: 0,
    infants: 0,
    guest_name: "[Guest name]",
    email,
    phone: "+971500000000",
    locale: "en",
    airport: "DXB",
    plan,
    is_test: true,
    nights_fils: nightsFils,
    addons_fils: 0,
    subtotal_fils: nightsFils,
    vat_bp: s.vatBp,
    vat_fils: vat,
    grand_fils: grand,
    deposit_bp: s.depositBp,
    deposit_fils: deposit,
    balance_fils: plan === "deposit" ? grand - deposit : 0,
    due_now_fils: plan === "deposit" ? deposit : grand,
    nights_snapshot: [0, 1, 2].map((i) => ({ night: addDays(arrive, i), rate_fils: rate, source: "base", rate_id: null })),
    balance_due_date: plan === "deposit" ? addDays(arrive, -DAYS) : null,
    lines: [],
    terms_version: "db-test",
    travellers: [
      { kind: "adult", full_name: "[Booker]", is_booker: true, not_staying: false },
      { kind: "adult", full_name: "[Adult]" },
    ],
  };
}

let nextDay = 200;

/** A held booking requested once (awaiting_payment). Returns { id, ref, arrive, grand, deposit }. */
async function requested(s, { plan = "deposit", tag = "rq" } = {}) {
  const arrive = dubaiDay(nextDay);
  nextDay += 5;
  const body = payload(s, { arrive, plan, email: `${tag}-${randomUUID().slice(0, 8)}@example.com` });
  const h = await s.admin.rpc("create_web_booking", { p: body });
  assert.equal(h.error, null, JSON.stringify(h.error));
  assert.equal(h.data.ok, true, JSON.stringify(h.data));
  bookings.push(h.data.booking_id);
  const q = await s.admin.rpc("request_web_booking", { p_booking: h.data.booking_id, p_expect_test: true });
  assert.equal(q.error, null, JSON.stringify(q.error));
  assert.equal(q.data.ok, true, JSON.stringify(q.data));
  return { id: h.data.booking_id, ref: h.data.ref, arrive, grand: body.grand_fils, deposit: body.deposit_fils };
}

/** Fixture step on this stack only: the request's deadline (and its timed nights) moved `minutes` into the past. */
async function pastDeadline(s, id, minutes) {
  const ended = new Date(Date.now() - minutes * 60000).toISOString();
  assert.ifError((await s.admin.from("booking_nights").update({ expires_at: ended }).eq("booking_id", id).not("expires_at", "is", null)).error);
  assert.ifError((await s.admin.from("bookings").update({ hold_expires_at: ended }).eq("id", id)).error);
}

async function nightsOf(s, id) {
  const n = await s.admin.from("booking_nights").select("night, expires_at").eq("booking_id", id);
  assert.ifError(n.error);
  return n.data;
}

// ---- runOps with a fake owner decide ---------------------------------------------------------------------------------

const deps = {
  notifier: () => NOT_READY_NOTIFIER,
  view: (db, bookingId, opts) => bookingViewById(db, bookingId, opts),
  bookingUrl: async () => null,
  linkReady: () => false,
};

async function get(who, handler, query) {
  const url = `${OPS}/api/ops/x?${query}`;
  const res = await runOps({
    method: "GET",
    request: new Request(url),
    decide: async () => ({ ok: true, owner: who }),
    handler: ({ owner }) => handler({ owner, url: new URL(url) }),
    nodeEnv: "production",
  });
  return { status: res.status, body: await res.json() };
}

async function post(who, parse, handler, body) {
  const res = await runOps({
    method: "POST",
    request: new Request(`${OPS}/api/ops/x`, { method: "POST", headers: { "content-type": "application/json", origin: OPS }, body: JSON.stringify(body) }),
    decide: async () => ({ ok: true, owner: who }),
    parse,
    handler: (ctx) => handler(ctx, deps),
    nodeEnv: "production",
  });
  return { status: res.status, body: await res.json() };
}

const aed = (fils) => rules.aedText(fils);
const detailOf = (s, ref) => get(s.owner, api.getBooking, `ref=${ref}`);
const list = (s, query) => get(s.owner, api.listBookings, query);

function recordBody(b, amountFils, { expected = "awaiting_payment", requestId = randomUUID(), accept = null } = {}) {
  return {
    booking_id: b.id,
    request_id: requestId,
    expected_status: expected,
    amount: aed(amountFils),
    received_on: dubaiDay(0),
    bank_reference: `[ref ${requestId.slice(0, 8)}]`,
    ...(accept ? { accept_short: true, accept_reason: accept } : {}),
  };
}

const record = (s, b, amountFils, opts) => post(s.owner, api.parsePayment, api.recordPayment, recordBody(b, amountFils, opts));

// ---- parity grids ------------------------------------------------------------------------------------------------------

test("parity: nextStatus agrees with public.booking_next_status on every status x plan x settled grid", async (t) => {
  const s = await seed(t);
  if (!s) return;
  let compared = 0;
  const mismatches = [];
  for (const [grand, deposit] of [[105000, 31500], [99, 30]]) {
    const settled = [0, 1, deposit - 1, deposit, deposit + 1, grand - 1, grand, grand + 1, 2 * grand];
    for (const status of rules.BOOKING_STATUSES) {
      for (const plan of ["deposit", "full"]) {
        for (const value of settled) {
          const sql = await s.admin.rpc("booking_next_status", { p_status: status, p_plan: plan, p_grand: grand, p_deposit: deposit, p_settled: value });
          assert.equal(sql.error, null, JSON.stringify(sql.error));
          const ts = rules.nextStatus(status, plan, grand, deposit, value);
          if (sql.data !== ts) mismatches.push({ status, plan, grand, deposit, settled: value, sql: sql.data, ts });
          compared += 1;
        }
      }
    }
  }
  t.diagnostic(`booking_next_status parity: ${compared} comparisons`);
  assert.ok(compared >= 288, `at least 288 comparisons, got ${compared}`);
  assert.deepEqual(mismatches, []);
});

test("parity: depositFloor agrees with public.booking_deposit_floor on the 80-case grid (P-21 as changed)", async (t) => {
  const s = await seed(t);
  if (!s) return;
  let compared = 0;
  const mismatches = [];
  for (const plan of ["deposit", "full"]) {
    for (const bp of [0, 1, 2500, 3000, 10000]) {
      for (const grand of [1, 99, 105000, 999999]) {
        for (const deposit of [0, 31500]) {
          const sql = await s.admin.rpc("booking_deposit_floor", { p_plan: plan, p_grand: grand, p_deposit: deposit, p_deposit_bp: bp });
          assert.equal(sql.error, null, JSON.stringify(sql.error));
          const ts = rules.depositFloor(plan, grand, deposit, bp);
          if (Number(sql.data) !== ts) mismatches.push({ plan, bp, grand, deposit, sql: sql.data, ts });
          compared += 1;
        }
      }
    }
  }
  t.diagnostic(`booking_deposit_floor parity: ${compared} comparisons`);
  assert.equal(compared, 80);
  assert.deepEqual(mismatches, []);
});

// ---- list and detail ---------------------------------------------------------------------------------------------------

test("list: q by ref prefix and by folded name, status attention, destination, arrival range, next page; detail 404", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const a = await requested(s, { tag: "lista" });
  const b = await requested(s, { tag: "listb" });
  const c = await requested(s, { tag: "listc" });
  const all = [a, b, c];

  const byRef = await list(s, `q=${encodeURIComponent(a.ref.slice(0, 9).toLowerCase())}`);
  assert.equal(byRef.status, 200);
  assert.ok(byRef.body.items.some((i) => i.ref === a.ref), "a ref prefix in any case finds it");

  const byName = await list(s, `q=${encodeURIComponent("[GUEST NAME]")}&destination=${s.ids.destination}`);
  assert.equal(byName.status, 200);
  for (const x of all) assert.ok(byName.body.items.some((i) => i.ref === x.ref), `folded name finds ${x.ref}`);
  assert.ok(byName.body.items.every((i) => i.destination_id === s.ids.destination), "the destination filter holds");

  const range = await list(s, `destination=${s.ids.destination}&from=${b.arrive}&to=${b.arrive}`);
  assert.deepEqual(range.body.items.map((i) => i.ref), [b.ref], "the arrival range holds");

  const page1 = await list(s, `destination=${s.ids.destination}&limit=2`);
  assert.equal(page1.body.items.length, 2);
  assert.equal(typeof page1.body.next, "string");
  const page2 = await list(s, `destination=${s.ids.destination}&limit=2&after=${page1.body.next}`);
  assert.ok(page2.body.items.length >= 1, "Show more loads the next page");
  const refs = [...page1.body.items, ...page2.body.items].map((i) => i.ref);
  assert.equal(new Set(refs).size, refs.length, "no row on two pages");

  const missing = await detailOf(s, "ALMAR-ZZZZZZ");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "not_found");
});

// ---- record payment --------------------------------------------------------------------------------------------------

test("record: below the deposit -> awaiting_payment part_received; to the deposit -> deposit_paid; a replay records once", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "rec" });
  const part = await record(s, b, 1000);
  assert.equal(part.status, 200, JSON.stringify(part.body));
  assert.equal(part.body.payment.status_after, "awaiting_payment");
  assert.equal(part.body.payment.flags.part_received, true);
  assert.equal("link_version" in part.body.payment, false);
  assert.deepEqual(part.body.mail, { receipt: "pending", owner: "pending" }, "the sender is not ready: pending, never an error");
  const nights = await nightsOf(s, b.id);
  assert.equal(nights.length, 3);
  assert.ok(nights.every((n) => n.expires_at === null), "the first payment makes the nights permanent (P-09)");

  const requestId = randomUUID();
  const rest = await record(s, b, b.deposit - 1000, { requestId });
  assert.equal(rest.status, 200, JSON.stringify(rest.body));
  assert.equal(rest.body.payment.status_after, "deposit_paid");
  const replay = await record(s, b, b.deposit - 1000, { requestId });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.payment.first_time, false);
  assert.deepEqual(replay.body.mail, { receipt: "skipped", owner: "skipped" });
  const rows = await s.admin.from("booking_payments").select("id").eq("booking_id", b.id);
  assert.ifError(rows.error);
  assert.equal(rows.data.length, 2, "the replay made no row");

  const stale = await record(s, b, 500, { expected: "awaiting_payment" });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body.error, { code: "changed", field: null, locale: null, detail: { status: "deposit_paid" } });
});

test("record: Accept as paid with a reason writes the gap off and moves the status on", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "acc" });
  const out = await record(s, b, b.deposit - 300, { accept: "[bank fee]" });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.payment.status_after, "deposit_paid");
  assert.equal(out.body.payment.write_off_fils, 300);
  assert.equal(out.body.payment.flags.written_off, true);
  const nothing = await record(s, b, b.grand, { expected: "deposit_paid", accept: "[too much]" });
  assert.equal(nothing.status, 409);
  assert.equal(nothing.body.error.code, "nothing_to_write_off");
});

test("record on expired: flagged paid_after_expiry, no night taken back; resolve clears the flag; notes in the detail", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "exp" });
  await pastDeadline(s, b.id, 4);
  const lapsed = await detailOf(s, b.ref);
  assert.equal(lapsed.body.booking.status, "expired", "GET detail runs ops_lapse_holds first");
  const out = await record(s, b, 1000, { expected: "expired" });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.payment.status_after, "expired");
  assert.equal(out.body.payment.flags.needs_attention, true);
  assert.equal(out.body.payment.flags.attention_reason, "paid_after_expiry");
  assert.equal((await nightsOf(s, b.id)).length, 0, "no night row (B-34)");

  const note = await post(s.owner, api.parseNote, api.addNote, { booking_id: b.id, body: "[called the guest]" });
  assert.equal(note.status, 200, JSON.stringify(note.body));
  const resolved = await post(s.owner, api.parseAttention, api.resolveAttention, { booking_id: b.id, note: "[refund from the bank]" });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.resolved.first_time, true);
  const after1 = (await detailOf(s, b.ref)).body.booking;
  assert.equal(after1.flags.needs_attention, false);
  assert.deepEqual(after1.notes.map((n) => n.body), ["[refund from the bank]", "[called the guest]"], "newest first");
});

// ---- void and status ---------------------------------------------------------------------------------------------------

test("void: the row is kept and the status recomputed; confirm; cancel of awaiting_payment", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "void" });
  const paid = await record(s, b, b.deposit);
  assert.equal(paid.body.payment.status_after, "deposit_paid");
  const voided = await post(s.owner, api.parseVoid, api.voidPayment, { payment_id: paid.body.payment.payment_id, reason: "[typed twice]" });
  assert.equal(voided.status, 200, JSON.stringify(voided.body));
  assert.equal(voided.body.voided.status_after, "awaiting_payment");
  const rows = await s.admin.from("booking_payments").select("status, void_reason").eq("booking_id", b.id);
  assert.ifError(rows.error);
  assert.deepEqual(rows.data, [{ status: "voided", void_reason: "[typed twice]" }], "nothing is deleted");

  const again = await record(s, b, b.deposit);
  assert.equal(again.body.payment.status_after, "deposit_paid");
  const confirmed = await post(s.owner, api.parseStatus, api.setStatus, { booking_id: b.id, action: "confirm", expected_status: "deposit_paid" });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.deepEqual(confirmed.body.status, { from: "deposit_paid", to: "confirmed" });

  const c = await requested(s, { tag: "cancel" });
  const cancelled = await post(s.owner, api.parseStatus, api.setStatus, { booking_id: c.id, action: "cancel", expected_status: "awaiting_payment" });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.deepEqual(cancelled.body.status, { from: "awaiting_payment", to: "cancelled" });
  assert.equal((await nightsOf(s, c.id)).length, 0);
});

test("a full-plan confirmed booking paid by one row: voiding it is 409 cancel_first and nothing changes", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { plan: "full", tag: "full" });
  const paid = await record(s, b, b.grand);
  assert.equal(paid.body.payment.status_after, "paid_in_full");
  const confirmed = await post(s.owner, api.parseStatus, api.setStatus, { booking_id: b.id, action: "confirm", expected_status: "paid_in_full" });
  assert.equal(confirmed.status, 200);
  const refused = await post(s.owner, api.parseVoid, api.voidPayment, { payment_id: paid.body.payment.payment_id, reason: "[wrong row]" });
  assert.equal(refused.status, 409);
  assert.deepEqual(refused.body.error, { code: "cancel_first", field: null, locale: null, detail: null });
  const after1 = (await detailOf(s, b.ref)).body.booking;
  assert.equal(after1.status, "confirmed");
  assert.equal(after1.money.paid_fils, b.grand);
  assert.ok(after1.payments.every((p) => p.status === "succeeded"));
});

// ---- P-09 as changed 2026-10-20 -------------------------------------------------------------------------------------

test("a part-paid request past its pay-by date stays awaiting_payment, is flagged, found by attention; the rest clears it", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "ppd" });
  assert.equal((await record(s, b, 1000)).status, 200);
  await pastDeadline(s, b.id, 3);
  const flagged = (await detailOf(s, b.ref)).body.booking;
  assert.equal(flagged.status, "awaiting_payment", "a part-paid request never lapses");
  assert.equal((await nightsOf(s, b.id)).length, 3, "its nights are kept");
  assert.equal(flagged.flags.needs_attention, true);
  assert.equal(flagged.flags.attention_reason, "deadline_passed_part_paid");
  const attention = await list(s, `status=attention&destination=${s.ids.destination}`);
  assert.ok(attention.body.items.some((i) => i.ref === b.ref), "the attention list finds it");

  const rest = await record(s, b, b.deposit - 1000);
  assert.equal(rest.status, 200, JSON.stringify(rest.body));
  assert.equal(rest.body.payment.status_after, "deposit_paid");
  assert.equal(rest.body.payment.flags.needs_attention, false, "the record cleared the flag");
});

test("voiding the only payment of a flagged part-paid request: unpaid again, a deadline later than now, the flag cleared", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "ppv" });
  const paid = await record(s, b, 1000);
  await pastDeadline(s, b.id, 3);
  assert.equal((await detailOf(s, b.ref)).body.booking.flags.attention_reason, "deadline_passed_part_paid");
  const voided = await post(s.owner, api.parseVoid, api.voidPayment, { payment_id: paid.body.payment.payment_id, reason: "[not ours]" });
  assert.equal(voided.status, 200, JSON.stringify(voided.body));
  assert.equal(voided.body.voided.status_after, "awaiting_payment");
  assert.equal(voided.body.voided.paid_fils, 0);
  assert.ok(Date.parse(voided.body.voided.deadline) > Date.now(), "the later of the old deadline and now + the window");
  assert.equal(voided.body.voided.flags.needs_attention, false);
});

test("Q-18 (owner: yes): the request email of a part-paid request past its pay-by date passes every check but the link", async (t) => {
  // deps.linkReady is false on the stack (no link secret here): the handler stops at 503 after canResendRequest, with
  // nothing written. An unpaid request past its pay-by date stops earlier, at 409 not_applicable.
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "q18" });
  assert.equal((await record(s, b, 1000)).status, 200);
  await pastDeadline(s, b.id, 3);
  const out = await post(s.owner, api.parseResend, api.resendMail, { ref: b.ref, kind: "request", request_id: randomUUID() });
  assert.equal(out.status, 503, JSON.stringify(out.body));
  assert.equal(out.body.error.code, "unavailable");

  const u = await requested(s, { tag: "q18u" });
  await pastDeadline(s, u.id, 1); // past the deadline, inside the 2-minute grace: still awaiting_payment, deadline_passed
  const unpaid = await post(s.owner, api.parseResend, api.resendMail, { ref: u.ref, kind: "request", request_id: randomUUID() });
  assert.equal(unpaid.status, 409, JSON.stringify(unpaid.body));
  assert.equal(unpaid.body.error.code, "not_applicable");
  const events = await s.admin.from("booking_events").select("action").in("booking_id", [b.id, u.id]).eq("action", "resend_requested");
  assert.ifError(events.error);
  assert.equal(events.data.length, 0, "no refusal writes an event");
});

// ---- resend, withdraw, money, not the owner ------------------------------------------------------------------------------

test("resend receipt with the not-ready notifier: 200 pending and one email_pending event with the resend key", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "rsd" });
  const paid = await record(s, b, 1000);
  const requestId = randomUUID();
  const out = await post(s.owner, api.parseResend, api.resendMail, { ref: b.ref, kind: "receipt", payment_id: paid.body.payment.payment_id, request_id: requestId });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.deepEqual(out.body, { ok: true, mail: "pending" });
  const key = `resend/${b.id}/${requestId}`;
  const events = await s.admin.from("booking_events").select("action, actor, detail").eq("booking_id", b.id).in("action", ["resend_requested", "email_pending"]);
  assert.ifError(events.error);
  assert.equal(events.data.filter((e) => e.action === "resend_requested" && e.detail.request_id === requestId && e.actor === `owner:${s.owner.profile.id}`).length, 1);
  assert.equal(events.data.filter((e) => e.action === "email_pending" && e.detail.key === key && e.detail.template === "payment_receipt").length, 1);
  const detail = (await detailOf(s, b.ref)).body.booking;
  assert.equal(rules.receiptMail(detail, paid.body.payment.payment_id), "pending");
});

test("a request withdrawn through booking_withdraw_request: the detail shows cancelled and one request_withdrawn by guest", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "wd" });
  const w = await s.admin.rpc("booking_withdraw_request", { p_booking: b.id, p_expect_test: true });
  assert.equal(w.error, null, JSON.stringify(w.error));
  assert.equal(w.data.ok, true);
  const detail = (await detailOf(s, b.ref)).body.booking;
  assert.equal(detail.status, "cancelled");
  const withdrawn = detail.events.filter((e) => e.action === "request_withdrawn");
  assert.equal(withdrawn.length, 1);
  assert.equal(withdrawn[0].actor, "guest");
  assert.equal(rules.actorKind(withdrawn[0].actor), "guest");
});

test("money: save then get round-trips (IBAN and BIC normalized); a wrong check digit is 400 bank.iban", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const save = {
    transfer_window_minutes: 1440,
    balance_due_days: DAYS,
    bank: { ...TEST_BANK, iban: "AE07 0331 2345 6789 0123 456", swift: "testaeaaxxx" },
  };
  const saved = await post(s.owner, money.parseMoneySave, (ctx) => money.postMoneyRoute(ctx), save);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const read = await get(s.owner, (ctx) => money.getMoneyRoute(ctx), "");
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.money, saved.body.money, "GET answers what the save answered");
  assert.equal(read.body.money.transfer_window_minutes, 1440);
  assert.equal(read.body.money.balance_due_days, DAYS);
  assert.equal(read.body.money.bank.iban, TEST_BANK.iban);
  assert.equal(read.body.money.bank.swift, TEST_BANK.swift);
  assert.equal(read.body.money.bank_complete, true);
  assert.equal(typeof read.body.terms_final, "boolean");

  const bad = await post(s.owner, money.parseMoneySave, (ctx) => money.postMoneyRoute(ctx), { bank: { ...TEST_BANK, iban: "AE08 0331 2345 6789 0123 456" } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.field, "bank.iban");
});

test("a guest profile as p_actor is 403 not_owner on record, void, note, resolve and money save", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const b = await requested(s, { tag: "guest" });
  const paid = await record(s, b, 1000);
  const checks = [
    ["record", await post(s.guest, api.parsePayment, api.recordPayment, recordBody(b, 1000))],
    ["void", await post(s.guest, api.parseVoid, api.voidPayment, { payment_id: paid.body.payment.payment_id, reason: "[not mine]" })],
    ["note", await post(s.guest, api.parseNote, api.addNote, { booking_id: b.id, body: "[note]" })],
    ["resolve", await post(s.guest, api.parseAttention, api.resolveAttention, { booking_id: b.id, note: "[resolve]" })],
    ["money", await post(s.guest, money.parseMoneySave, (ctx) => money.postMoneyRoute(ctx), { balance_due_days: DAYS })],
  ];
  for (const [label, out] of checks) {
    assert.equal(out.status, 403, `${label}: ${JSON.stringify(out.body)}`);
    assert.equal(out.body.error.code, "not_owner", label);
  }
  const rows = await s.admin.from("booking_payments").select("id, status").eq("booking_id", b.id);
  assert.ifError(rows.error);
  assert.deepEqual(rows.data.map((r) => r.status), ["succeeded"], "nothing the guest sent was written");
});
