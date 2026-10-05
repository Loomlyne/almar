// The hold on a real database (plan 04-02, Task 1): ten guests ask for the same nights at the same moment and exactly one
// gets them; overlapping ranges never share a night; two calls that report the same payment count it once; cancel,
// payment, lapse, release and new holds on one stay run together without a deadlock.
// Needs this worktree's own local Supabase stack (node tests/helpers/local-supabase.mjs start). Without one the cases
// are skipped with a printed reason; with ALMAR_REQUIRE_STACK=1 a missing stack fails. It talks only to the stack's
// own http://127.0.0.1 URL (checked below) and removes the rows it made, by id.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireStack } from "./helpers/local-supabase.mjs";

const OWNER = "00000000-0000-4000-8000-00000000f0a1";
let state = null; // { admin, stack, ids } once seeded
let seedError = null;

function dubaiDay(offset) {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

function nightsBetween(arrive, leave) {
  return Math.round((Date.parse(leave) - Date.parse(arrive)) / 86400000);
}

/** The payload lib/booking/server.ts snapshotRow() + the guest build, for a full-payment booking (symbolic numbers). */
function fullPayload({ slug, arrive, leave, email, vatBp, depositBp, lines = [], pickup }) {
  const n = nightsBetween(arrive, leave);
  const rate = 100000;
  const nightsFils = n * rate;
  const addonsFils = lines.reduce((sum, l) => sum + l.line_fils, 0);
  const subtotal = nightsFils + addonsFils;
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
    guest_name: "Race Guest",
    email,
    phone: "+971501234567",
    locale: "en",
    airport: "DXB",
    ...(pickup ? { pickup_address: pickup } : {}),
    plan: "full",
    is_test: true,
    nights_fils: nightsFils,
    addons_fils: addonsFils,
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
    lines,
    terms_version: "db-test",
    travellers: [
      { kind: "adult", full_name: "Race Booker", is_booker: true, not_staying: false },
      { kind: "adult", full_name: "Race Adult" },
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
    const table = rpc.error ? rpc : await admin.from("site_settings").select("id").eq("id", 1).single();
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

async function seed(t) {
  if (state || seedError) return state;
  const stack = requireStack(t);
  if (!stack) return null;
  assert.match(stack.url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "this test only talks to a local stack");
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await waitReady(admin);
    const suffix = randomUUID().slice(0, 8);
    const ids = { destination: randomUUID(), stay: randomUUID(), item: null, ownItem: false };
    const settings = await admin.from("site_settings").select("vat_percent, deposit_percent").eq("id", 1).single();
    assert.ifError(settings.error);
    assert.notEqual(settings.data.vat_percent, null, "settings are seeded by the migration (VAT)");
    assert.notEqual(settings.data.deposit_percent, null, "settings are seeded by the migration (deposit)");
    const vatBp = Math.round(Number(settings.data.vat_percent) * 100);
    const depositBp = Math.round(Number(settings.data.deposit_percent) * 100);
    let r = await admin.from("destinations").insert({ id: ids.destination, slug: `race-dest-${suffix}`, is_published: true });
    assert.ifError(r.error);
    r = await admin.from("stays").insert({
      id: ids.stay, slug: `race-stay-${suffix}`, destination_id: ids.destination, max_guests: 6, min_nights: 1,
      base_nightly_rate_aed: 1000, is_published: true,
    });
    assert.ifError(r.error);
    // The home-pickup add-on (is_home_pickup = true): one row may exist; reuse it when it does.
    const existing = await admin.from("catalog_items").select("id").eq("is_home_pickup", true).maybeSingle();
    assert.ifError(existing.error);
    if (existing.data) {
      ids.item = existing.data.id;
    } else {
      ids.item = randomUUID();
      ids.ownItem = true;
      r = await admin.from("catalog_items").insert({
        id: ids.item, slug: `race-pickup-${suffix}`, kind: "service", unit: "trip", price_aed: 150, is_uae: true, is_home_pickup: true, is_published: true,
      });
      assert.ifError(r.error);
    }
    state = { admin, stack, ids, slug: `race-stay-${suffix}`, vatBp, depositBp };
  } catch (error) {
    seedError = error;
    throw error;
  }
  return state;
}

after(async () => {
  if (!state) return;
  const { admin, ids } = state;
  // Local rows only, by id. Bookings first (their nights, travellers, lines, payments and history cascade).
  await admin.from("bookings").delete().eq("stay_id", ids.stay);
  await admin.from("stays").delete().eq("id", ids.stay);
  await admin.from("destinations").delete().eq("id", ids.destination);
  if (ids.ownItem) await admin.from("catalog_items").delete().eq("id", ids.item);
});

async function hold(s, args) {
  return s.admin.rpc("create_web_booking", { p: fullPayload({ slug: s.slug, vatBp: s.vatBp, depositBp: s.depositBp, ...args }) });
}

test("ten guests ask for the same three nights at once: exactly one holds them", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const arrive = dubaiDay(400);
  const leave = dubaiDay(403);
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => hold(s, { arrive, leave, email: `race${i}-${randomUUID().slice(0, 6)}@example.com` })),
  );
  for (const r of results) assert.equal(r.error, null, `no call may fail: ${JSON.stringify(r.error)}`);
  const winners = results.filter((r) => r.data.ok === true);
  const losers = results.filter((r) => r.data.ok === false);
  assert.equal(winners.length, 1, "exactly one of ten holds the nights");
  assert.equal(losers.length, 9);
  for (const r of losers) assert.equal(r.data.reason, "sold_out");
  const winner = winners[0].data;
  assert.match(winner.ref, /^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  const bookings = await s.admin.from("bookings").select("id, status").eq("stay_id", s.ids.stay).gte("arrive", arrive).lte("arrive", arrive);
  assert.ifError(bookings.error);
  assert.equal(bookings.data.length, 1, "the nine refused holds left no booking row");
  assert.equal(bookings.data[0].status, "held");
  const nights = await s.admin.from("booking_nights").select("night, booking_id").eq("stay_id", s.ids.stay).gte("night", arrive).lt("night", leave);
  assert.ifError(nights.error);
  assert.equal(nights.data.length, 3);
  assert.ok(nights.data.every((n) => n.booking_id === winner.booking_id));
});

test("overlapping ranges asked for at once never share a night, and every winner holds all of its nights", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const base = 420;
  const ranges = [
    [0, 3], [2, 5], [4, 7], [0, 7], [1, 2], [6, 9], [3, 4], [8, 10], [0, 1], [9, 12], [5, 6], [2, 3],
  ];
  const results = await Promise.all(
    ranges.map(([a, b], i) => hold(s, { arrive: dubaiDay(base + a), leave: dubaiDay(base + b), email: `ov${i}-${randomUUID().slice(0, 6)}@example.com` })),
  );
  for (const r of results) assert.equal(r.error, null, JSON.stringify(r.error));
  const won = results.map((r, i) => ({ i, r: r.data })).filter((x) => x.r.ok === true);
  assert.ok(won.length >= 1);
  const rows = await s.admin.from("booking_nights").select("night, booking_id").eq("stay_id", s.ids.stay).gte("night", dubaiDay(base)).lt("night", dubaiDay(base + 12));
  assert.ifError(rows.error);
  const seen = new Set();
  for (const row of rows.data) {
    assert.equal(seen.has(row.night), false, `night ${row.night} is held twice`);
    seen.add(row.night);
  }
  for (const { i, r } of won) {
    const [a, b] = ranges[i];
    assert.equal(rows.data.filter((n) => n.booking_id === r.booking_id).length, b - a, `winner ${i} holds every one of its ${b - a} nights`);
  }
  assert.equal(rows.data.length, won.reduce((sum, { i }) => sum + (ranges[i][1] - ranges[i][0]), 0), "no night is held by anybody who did not win");
});

test("the same payment reported eight times at once is counted once", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const h = await hold(s, { arrive: dubaiDay(450), leave: dubaiDay(452), email: `pay-${randomUUID().slice(0, 6)}@example.com` });
  assert.equal(h.error, null);
  assert.equal(h.data.ok, true);
  const open = await s.admin.rpc("open_payment", { p_booking: h.data.booking_id, p_kind: "full", p_terms_version: null });
  assert.equal(open.error, null);
  assert.equal(open.data.ok, true);
  const session = `cs_db_${randomUUID().replaceAll("-", "")}`;
  assert.equal((await s.admin.rpc("attach_checkout_session", { p_payment: open.data.payment_id, p_session: session })).error, null);
  const calls = await Promise.all(
    Array.from({ length: 8 }, (_, i) => s.admin.rpc("record_payment", { p_session: session, p_payment_intent: `pi_db_${session.slice(-8)}`, p_actor: `stripe:evt_race_${i}` })),
  );
  for (const c of calls) assert.equal(c.error, null, JSON.stringify(c.error));
  assert.equal(calls.filter((c) => c.data.first_time === true).length, 1, "exactly one call is the first time");
  const booking = await s.admin.from("bookings").select("status, paid_fils, grand_fils, needs_attention").eq("id", h.data.booking_id).single();
  assert.equal(booking.data.status, "paid_in_full");
  assert.equal(booking.data.paid_fils, booking.data.grand_fils, "the money is counted once");
  assert.equal(booking.data.needs_attention, false);
  const events = await s.admin.from("booking_events").select("id").eq("booking_id", h.data.booking_id).eq("action", "payment");
  assert.equal(events.data.length, 1);
});

test("a payment, a cancel, a lapse, a release and new holds on one stay run together without a deadlock", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const failures = [];
  for (let round = 0; round < 24; round += 1) {
    const day = 480 + round * 10;
    const h = await hold(s, { arrive: dubaiDay(day), leave: dubaiDay(day + 2), email: `mix${round}-${randomUUID().slice(0, 6)}@example.com` });
    assert.equal(h.error, null);
    assert.equal(h.data.ok, true);
    const open = await s.admin.rpc("open_payment", { p_booking: h.data.booking_id, p_kind: "full", p_terms_version: null });
    assert.equal(open.data.ok, true);
    const session = `cs_mix_${randomUUID().replaceAll("-", "")}`;
    await s.admin.rpc("attach_checkout_session", { p_payment: open.data.payment_id, p_session: session });
    // Half of the rounds: the hold ended more than two minutes ago, so a new hold's sweep, the lapse, the cancel and the
    // payment all want the same lapsed booking at once (the lock order stay -> booking -> nights is what keeps them apart).
    if (round % 2 === 0) {
      const ended = new Date(Date.now() - 4 * 60000).toISOString();
      assert.ifError((await s.admin.from("booking_nights").update({ expires_at: ended }).eq("booking_id", h.data.booking_id)).error);
      assert.ifError((await s.admin.from("bookings").update({ hold_expires_at: ended }).eq("id", h.data.booking_id)).error);
    }
    const settled = await Promise.allSettled([
      s.admin.rpc("record_payment", { p_session: session, p_payment_intent: `pi_${session.slice(-10)}`, p_actor: "stripe:evt_mix" }),
      s.admin.rpc("ops_set_booking_status", { p_booking: h.data.booking_id, p_to: "cancelled", p_expected_from: "held", p_actor: OWNER }),
      s.admin.rpc("ops_lapse_holds"),
      s.admin.rpc("booking_drop_hold", { p_booking: h.data.booking_id, p_actor: "guest" }),
      s.admin.rpc("mark_session_expired", { p_session: session, p_actor: "stripe:evt_mix_exp" }),
      hold(s, { arrive: dubaiDay(day + 1), leave: dubaiDay(day + 4), email: `mixb${round}-${randomUUID().slice(0, 6)}@example.com` }),
      s.admin.rpc("ops_add_block", { p: { scope: "stay", stay_id: s.ids.stay, starts_on: dubaiDay(day + 6), ends_on: dubaiDay(day + 6) } }),
    ]);
    for (const x of settled) {
      if (x.status === "rejected") failures.push(String(x.reason));
      else if (x.value.error && !/^almar:/.test(x.value.error.message ?? "")) failures.push(JSON.stringify(x.value.error));
    }
  }
  assert.deepEqual(failures, [], "every outcome is a normal answer or an almar: refusal, never a deadlock or a crash");
  // Whatever order they ran in, no night is held twice and no paid booking lost money.
  const bad = await s.admin.from("bookings").select("ref, status, paid_fils, grand_fils").eq("stay_id", s.ids.stay).eq("status", "paid_in_full");
  for (const b of bad.data) assert.equal(b.paid_fils, b.grand_fils, `${b.ref} paid in full means the full amount`);
});

test("a home-pickup line is stored with the address, and the address is required without it", async (t) => {
  const s = await seed(t);
  if (!s) return;
  const item = await s.admin.from("catalog_items").select("price_aed").eq("id", s.ids.item).single();
  const price = Math.round(Number(item.data.price_aed) * 100);
  const line = { catalog_item_id: s.ids.item, name: "Home pickup", unit: "trip", is_uae: true, is_home_pickup: true, unit_price_fils: price, quantity: 1, line_fils: price };
  const without = await hold(s, { arrive: dubaiDay(900), leave: dubaiDay(902), email: `hp1-${randomUUID().slice(0, 6)}@example.com`, lines: [line] });
  assert.ok(without.error, "a home-pickup line without an address is refused");
  assert.match(without.error.message, /almar:invalid/);
  const withAddress = await hold(s, { arrive: dubaiDay(900), leave: dubaiDay(902), email: `hp2-${randomUUID().slice(0, 6)}@example.com`, lines: [line], pickup: "Villa 1, Dubai" });
  assert.equal(withAddress.error, null);
  assert.equal(withAddress.data.ok, true);
  const lines = await s.admin.from("booking_lines").select("catalog_item_id, quantity, line_fils").eq("booking_id", withAddress.data.booking_id);
  assert.equal(lines.data.length, 1);
  assert.equal(lines.data[0].line_fils, price);
});
