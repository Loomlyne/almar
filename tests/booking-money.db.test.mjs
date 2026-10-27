// Request and bank-transfer money on a real database (plan 04-08, Task 2): eight requests of one hold at the same moment
// make one request; eight records of one payment (one request id) make one row; eight records of different payments add
// up exactly; eight lapse email claims take each lapsed request once; eight withdraws of one request withdraw it once; a
// withdraw racing a record ends one way or the other, never cancelled with money on it; and request, withdraw, record,
// void and the lapse on two stays run together without a deadlock.
// Needs this worktree's own local Supabase stack (node tests/helpers/local-supabase.mjs start). Without one the cases
// are skipped with a printed reason; with ALMAR_REQUIRE_STACK=1 a missing stack fails. It talks only to the stack's
// own http://127.0.0.1 URL (checked below) and removes the rows it made, by id; the owner's bank details are put back
// as they were, and the owner user is deleted only when this file made it. Bank values are documentation examples only
// (GB82 WEST 1234 5698 7654 32, BIC TESTAEAA).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { lockStack } from "./helpers/local-supabase.mjs";

const OWNER_EMAIL = "maria@almarprivatejourney.com";
const TEST_BANK = {
  account_name: "Almar Test Account",
  bank_name: "Test Bank",
  iban: "GB82WEST12345698765432",
  swift: "TESTAEAA",
  bank_address: "1 Test Street, Dubai",
  note_en: "All fees paid by the sender.",
};
let state = null; // { admin, stack, ids, slugs, ownerId, vatBp, depositBp } once seeded
let seedError = null;
let releaseStackLock = null; // the stack is shared with the other files of `node --test`: take turns
let madeOwner = null;
let bankBefore = null;

function dubaiDay(offset) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

function nightsBetween(arrive, leave) {
  return Math.round((Date.parse(leave) - Date.parse(arrive)) / 86400000);
}

/** The payload lib/booking/server.ts snapshotRow() + the guest build, for a full-payment booking (symbolic numbers). */
function fullPayload({ slug, arrive, leave, email, vatBp, depositBp }) {
  const n = nightsBetween(arrive, leave);
  const rate = 100000;
  const nightsFils = n * rate;
  const subtotal = nightsFils;
  const vat = Math.floor((subtotal * vatBp + 5000) / 10000);
  const grand = subtotal + vat;
  const snapshot = Array.from({ length: n }, (_, i) => ({
    night: new Date(Date.parse(arrive) + i * 86400000).toISOString().slice(0, 10),
    rate_fils: rate,
    source: "base",
    rate_id: null,
  }));
  return {
    stay_slug: slug,
    arrive,
    leave,
    adults: 2,
    children: 0,
    infants: 0,
    guest_name: "Money Guest",
    email,
    phone: "+971501234567",
    locale: "en",
    airport: "DXB",
    plan: "full",
    is_test: true,
    nights_fils: nightsFils,
    addons_fils: 0,
    subtotal_fils: subtotal,
    vat_bp: vatBp,
    vat_fils: vat,
    grand_fils: grand,
    deposit_bp: depositBp,
    deposit_fils: 0,
    balance_fils: 0,
    due_now_fils: grand,
    nights_snapshot: snapshot,
    balance_due_date: null,
    lines: [],
    terms_version: "db-test",
    travellers: [
      { kind: "adult", full_name: "Money Booker", is_booker: true, not_staying: false },
      { kind: "adult", full_name: "Money Adult" },
    ],
  };
}

/** Right after a database reset PostgREST reconnects and reloads its schema; wait for it instead of failing the first case. */
async function waitReady(admin) {
  const transient = new Set(["PGRST001", "PGRST002", "PGRST202", "PGRST205"]);
  let last = null;
  let good = 0;
  for (let i = 0; i < 120 && good < 3; i += 1) {
    const rpc = await admin.rpc("booking_context", { p_stay_slug: "ready-probe", p_from: null, p_to: null, p_locale: "en" });
    const table = rpc.error ? rpc : await admin.from("booking_bank_details").select("id").eq("id", 1).single();
    if (!rpc.error && !table.error) {
      good += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      continue;
    }
    good = 0;
    last = rpc.error ?? table.error;
    if (!transient.has(last.code)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (good < 3) assert.fail(`the local API did not become ready: ${JSON.stringify(last)}`);
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
    const ids = { destination: randomUUID(), stays: [randomUUID(), randomUUID()] };
    const slugs = [`money-stay-a-${suffix}`, `money-stay-b-${suffix}`];
    const settings = await admin.from("site_settings").select("vat_percent, deposit_percent").eq("id", 1).single();
    assert.ifError(settings.error);
    assert.notEqual(settings.data.vat_percent, null, "settings are seeded by the migration (VAT)");
    assert.notEqual(settings.data.deposit_percent, null, "settings are seeded by the migration (deposit)");
    const vatBp = Math.round(Number(settings.data.vat_percent) * 100);
    const depositBp = Math.round(Number(settings.data.deposit_percent) * 100);
    let r = await admin.from("destinations").insert({ id: ids.destination, slug: `money-dest-${suffix}`, is_published: true });
    assert.ifError(r.error);
    for (let i = 0; i < 2; i += 1) {
      r = await admin.from("stays").insert({
        id: ids.stays[i], slug: slugs[i], destination_id: ids.destination, max_guests: 6, min_nights: 1,
        base_nightly_rate_aed: 1000, is_published: true,
      });
      assert.ifError(r.error);
    }
    // A request needs complete bank details (P-08); a TEST booking gets the 35-minute window (P-06). Put back after.
    const bank = await admin.from("booking_bank_details").select("*").eq("id", 1).single();
    assert.ifError(bank.error);
    bankBefore = bank.data;
    r = await admin.from("booking_bank_details").update(TEST_BANK).eq("id", 1);
    assert.ifError(r.error);
    const owner = await ownerId(admin);
    state = { admin, stack, ids, slugs, ownerId: owner, vatBp, depositBp };
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
    for (const stay of ids.stays) await admin.from("bookings").delete().eq("stay_id", stay);
    for (const stay of ids.stays) await admin.from("stays").delete().eq("id", stay);
    await admin.from("destinations").delete().eq("id", ids.destination);
    if (bankBefore) await admin.from("booking_bank_details").update(bankBefore).eq("id", 1);
    if (madeOwner) await admin.auth.admin.deleteUser(madeOwner);
  } finally {
    releaseStackLock?.();
  }
});

const email = (tag) => `${tag}-${randomUUID().slice(0, 8)}@example.com`;

async function hold(s, stay, arrive, leave, tag) {
  return s.admin.rpc("create_web_booking", {
    p: fullPayload({ slug: s.slugs[stay], arrive, leave, email: email(tag), vatBp: s.vatBp, depositBp: s.depositBp }),
  });
}

/** A held booking requested once; both must succeed. Returns the booking id. */
async function requested(s, stay, day, tag) {
  const h = await hold(s, stay, dubaiDay(day), dubaiDay(day + 3), tag);
  assert.equal(h.error, null, JSON.stringify(h.error));
  assert.equal(h.data.ok, true, JSON.stringify(h.data));
  const q = await s.admin.rpc("request_web_booking", { p_booking: h.data.booking_id, p_expect_test: true });
  assert.equal(q.error, null, JSON.stringify(q.error));
  assert.equal(q.data.first_time, true, JSON.stringify(q.data));
  return h.data.booking_id;
}

function record(s, bookingId, amount, { requestId = randomUUID(), expected = "awaiting_payment" } = {}) {
  return s.admin.rpc("ops_record_payment", {
    p: {
      booking_id: bookingId,
      request_id: requestId,
      expected_status: expected,
      amount_fils: amount,
      received_on: dubaiDay(0),
      bank_reference: `DB-${requestId.slice(0, 8)}`,
    },
    p_actor: s.ownerId,
  });
}

function withdraw(s, bookingId) {
  return s.admin.rpc("booking_withdraw_request", { p_booking: bookingId, p_expect_test: true });
}

async function booking(s, id) {
  const b = await s.admin.from("bookings").select("status, plan, paid_fils, written_off_fils, grand_fils, deposit_fils, arrive, leave").eq("id", id).single();
  assert.ifError(b.error);
  return b.data;
}

async function nightsOf(s, id) {
  const n = await s.admin.from("booking_nights").select("night, expires_at").eq("booking_id", id);
  assert.ifError(n.error);
  return n.data;
}

async function eventCount(s, id, action) {
  const e = await s.admin.from("booking_events").select("id").eq("booking_id", id).eq("action", action);
  assert.ifError(e.error);
  return e.data.length;
}

/** The deadline (and the timed nights) moved back, as if time had passed. */
async function lapse(s, id, minutes) {
  const ended = new Date(Date.now() - minutes * 60000).toISOString();
  assert.ifError((await s.admin.from("booking_nights").update({ expires_at: ended }).eq("booking_id", id).not("expires_at", "is", null)).error);
  assert.ifError((await s.admin.from("bookings").update({ hold_expires_at: ended }).eq("id", id)).error);
}

test("eight requests of one hold at the same moment make exactly one request", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const h = await hold(s, 0, dubaiDay(300), dubaiDay(303), "rq8");
  assert.equal(h.error, null);
  assert.equal(h.data.ok, true);
  const calls = await Promise.all(
    Array.from({ length: 8 }, () => s.admin.rpc("request_web_booking", { p_booking: h.data.booking_id, p_expect_test: true })),
  );
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  for (const c of calls) assert.equal(c.data.ok, true, JSON.stringify(c.data));
  assert.equal(calls.filter((c) => c.data.first_time === true).length, 1, "exactly one call is the first time");
  assert.equal(new Set(calls.map((c) => c.data.deadline)).size, 1, "every answer carries the same deadline");
  assert.equal(await eventCount(s, h.data.booking_id, "request_sent"), 1, "one request_sent event");
  assert.equal((await booking(s, h.data.booking_id)).status, "awaiting_payment");
});

test("eight records of one payment (one request id) at once make one row and the same answer", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const id = await requested(s, 0, 310, "rec1");
  const requestId = randomUUID();
  const calls = await Promise.all(Array.from({ length: 8 }, () => record(s, id, 1000, { requestId })));
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  assert.equal(calls.filter((c) => c.data.first_time === true).length, 1, "exactly one call wrote the row");
  assert.equal(new Set(calls.map((c) => c.data.payment_id)).size, 1, "all eight answers name the same payment");
  const rows = await s.admin.from("booking_payments").select("id, amount_fils, status").eq("booking_id", id);
  assert.ifError(rows.error);
  assert.equal(rows.data.length, 1, "one row");
  assert.equal((await booking(s, id)).paid_fils, 1000, "the money counted once");
  assert.equal(await eventCount(s, id, "payment_recorded"), 1);
});

test("eight records of different payments at once add up exactly, under the one status rule", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const id = await requested(s, 0, 320, "rec8");
  const amounts = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
  const calls = await Promise.all(amounts.map((amount) => record(s, id, amount)));
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  assert.equal(calls.filter((c) => c.data.first_time === true).length, 8);
  const sum = amounts.reduce((a, b) => a + b, 0);
  const b = await booking(s, id);
  assert.equal(b.paid_fils, sum, "paid_fils is the sum of the rows");
  const next = await s.admin.rpc("booking_next_status", {
    p_status: "awaiting_payment", p_plan: b.plan, p_grand: b.grand_fils, p_deposit: b.deposit_fils, p_settled: sum,
  });
  assert.equal(next.error, null);
  assert.equal(b.status, next.data, "the status is booking_next_status of that sum");
  const nights = await nightsOf(s, id);
  assert.equal(nights.length, 3);
  assert.ok(nights.every((n) => n.expires_at === null), "the first payment made every night permanent (P-09)");
  assert.equal(await eventCount(s, id, "payment_recorded"), 8);
});

test("eight lapse email claims at once take each lapsed request exactly once", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push(await requested(s, 1, 330 + i * 4, `claim${i}`));
  for (const id of ids) await lapse(s, id, 4);
  const swept = await s.admin.rpc("ops_lapse_holds");
  assert.equal(swept.error, null, JSON.stringify(swept.error));
  assert.ok(swept.data >= 5, "the five lapsed requests were swept");
  for (const id of ids) assert.equal((await booking(s, id)).status, "expired");
  const calls = await Promise.all(Array.from({ length: 8 }, () => s.admin.rpc("claim_lapse_emails", { p_limit: 10 })));
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  const claimed = calls.flatMap((c) => c.data.map((job) => job.booking_id)).filter((id) => ids.includes(id));
  for (const id of ids) assert.equal(claimed.filter((x) => x === id).length, 1, `request ${id} is claimed exactly once`);
  const rows = await s.admin.from("bookings").select("id, lapse_email_attempts").in("id", ids);
  assert.ifError(rows.error);
  assert.ok(rows.data.every((r) => r.lapse_email_attempts === 1), "one try counted each");
});

test("eight withdraws of one unpaid request at once withdraw it exactly once", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const id = await requested(s, 0, 400, "wd8");
  const calls = await Promise.all(Array.from({ length: 8 }, () => withdraw(s, id)));
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  for (const c of calls) assert.equal(c.data.ok, true, JSON.stringify(c.data));
  assert.equal(calls.filter((c) => c.data.first_time === true).length, 1, "exactly one call withdrew it");
  assert.equal(await eventCount(s, id, "request_withdrawn"), 1, "one request_withdrawn event");
  assert.equal((await booking(s, id)).status, "cancelled");
  assert.equal((await nightsOf(s, id)).length, 0, "no nights left");
});

test("a withdraw racing a record ends one way or the other, never cancelled with the payment", async (t) => {
  const s = await seed(t);
  if (!s) return;
  for (let round = 0; round < 10; round += 1) {
    const id = await requested(s, 1, 420 + round * 4, `wr${round}`);
    const [w, r] = await Promise.all([withdraw(s, id), record(s, id, 1000)]);
    assert.equal(w.error, null, JSON.stringify(w.error));
    const b = await booking(s, id);
    if (b.status === "cancelled") {
      assert.equal(b.paid_fils, 0, `round ${round}: cancelled means no payment on it`);
      assert.equal(w.data.first_time, true, `round ${round}: the withdraw went first`);
      assert.equal(r.error?.message, "almar:changed", `round ${round}: the record answered changed`);
      assert.equal((await nightsOf(s, id)).length, 0);
    } else {
      assert.equal(b.status, "awaiting_payment", `round ${round}: otherwise the request stays awaiting_payment`);
      assert.equal(b.paid_fils, 1000, `round ${round}: part-paid`);
      assert.equal(r.error, null, JSON.stringify(r.error));
      assert.equal(w.data.ok, false);
      assert.equal(w.data.reason, "part_paid", `round ${round}: the withdraw answered part_paid`);
      const nights = await nightsOf(s, id);
      assert.equal(nights.length, 3);
      assert.ok(nights.every((n) => n.expires_at === null), `round ${round}: its nights are permanent`);
    }
  }
});

test("request, withdraw, record, void and the lapse on two stays run together without a deadlock", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const failures = [];
  const made = [];
  const rounds = 30;
  for (let round = 0; round < rounds; round += 1) {
    const day = 500 + round * 10;
    const a = await requested(s, 0, day, `mixa${round}`);
    const b = await requested(s, 1, day, `mixb${round}`);
    made.push(a, b);
    const paid = await record(s, b, 1000);
    assert.equal(paid.error, null, JSON.stringify(paid.error));
    // Two of every three rounds: a's deadline passed more than two minutes ago, so the sweep of a new hold, the lapse, the
    // record's inline lapse, the withdraw and the request all want the same lapsed request at once.
    if (round % 3 !== 2) await lapse(s, a, 4);
    const settled = await Promise.allSettled([
      s.admin.rpc("request_web_booking", { p_booking: a, p_expect_test: true }),
      s.admin.rpc("request_web_booking", { p_booking: b, p_expect_test: true }),
      withdraw(s, a),
      withdraw(s, b),
      record(s, a, 2000),
      record(s, a, 3000),
      record(s, b, 4000),
      s.admin.rpc("ops_void_payment", { p_payment: paid.data.payment_id, p_reason: "Typed twice", p_actor: s.ownerId }),
      s.admin.rpc("ops_lapse_holds"),
      s.admin.rpc("ops_lapse_holds"),
      hold(s, 0, dubaiDay(day + 1), dubaiDay(day + 4), `mixh${round}`),
      hold(s, 1, dubaiDay(day + 1), dubaiDay(day + 4), `mixi${round}`),
    ]);
    for (const x of settled) {
      if (x.status === "rejected") failures.push(String(x.reason));
      else if (x.value.error && (!/^almar:/.test(x.value.error.message ?? "") || x.value.error.message === "almar:paid_request_kept")) {
        failures.push(JSON.stringify(x.value.error));
      }
    }
  }
  assert.deepEqual(failures, [], "every outcome is a normal answer or an almar: refusal, never a deadlock, a crash or the guard");

  // Whatever order they ran in: paid_fils and written_off_fils are the sums of the succeeded rows; a withdrawn request
  // has no money on it; a part-paid request keeps every night for good.
  for (let i = 0; i < made.length; i += 40) {
    const chunk = made.slice(i, i + 40);
    const rows = await s.admin.from("bookings").select("id, ref, status, paid_fils, written_off_fils, arrive, leave").in("id", chunk);
    assert.ifError(rows.error);
    const pays = await s.admin.from("booking_payments").select("booking_id, amount_fils, write_off_fils, status").in("booking_id", chunk);
    assert.ifError(pays.error);
    const withdrawn = await s.admin.from("booking_events").select("booking_id").eq("action", "request_withdrawn").in("booking_id", chunk);
    assert.ifError(withdrawn.error);
    const nights = await s.admin.from("booking_nights").select("booking_id, expires_at").in("booking_id", chunk);
    assert.ifError(nights.error);
    for (const b of rows.data) {
      const ok = pays.data.filter((p) => p.booking_id === b.id && p.status === "succeeded");
      assert.equal(b.paid_fils, ok.reduce((sum, p) => sum + p.amount_fils, 0), `${b.ref}: paid_fils is the sum of its rows`);
      assert.equal(b.written_off_fils, ok.reduce((sum, p) => sum + p.write_off_fils, 0), `${b.ref}: written_off_fils is the sum of its rows`);
      if (withdrawn.data.some((e) => e.booking_id === b.id)) assert.equal(b.paid_fils, 0, `${b.ref}: withdrawn with no money on it`);
      if (b.status === "awaiting_payment" && b.paid_fils > 0) {
        const own = nights.data.filter((n) => n.booking_id === b.id);
        assert.equal(own.length, nightsBetween(b.arrive, b.leave), `${b.ref}: a part-paid request keeps every night`);
        assert.ok(own.every((n) => n.expires_at === null), `${b.ref}: for good`);
      }
    }
  }
});
