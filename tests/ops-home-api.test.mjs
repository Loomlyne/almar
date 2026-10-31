// Plan 05-04 Task 1: the pure rules and the three handlers of Home, Customers and Profile, on a fake rpc, and the route
// files' shape. Every amount below is symbolic (a made-up number of fils, no real price). Written, not run (owner rule).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const rules = await loadTs("lib/ops/home-rules.ts");
const { getHome, getCustomers, getProfile } = await loadTs("lib/ops/home-api.ts");
const { LIST_LIMIT } = await loadTs("lib/ops/booking-rules.ts");

function owner(answers = {}, profile = {}) {
  const calls = [];
  return {
    calls,
    profile: { id: "00000000-0000-4000-8000-000000000002", email: "owner@example.com", firstName: "", lastName: "", ...profile },
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return answers[name] ?? { data: null, error: null };
      },
    },
  };
}
const url = (query) => new URL(`https://dashboard.almarprivatejourney.com/api/ops/x?${query}`);
const NUMBERS = { from: "2026-10-01", to: "2026-10-31", bookings: 3, received_fils: 1000, refunded_fils: 200, recorded_fils: 800, outstanding_fils: 500, outstanding_count: 2 };

// ---- rules ----------------------------------------------------------------------------------------------------------

test("homeRange: Dubai days, month and 30 days", () => {
  assert.deepEqual(rules.homeRange("month", new Date("2026-10-31T20:30:00Z")), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(rules.homeRange("30d", new Date("2026-10-31T08:00:00Z")), { from: "2026-10-02", to: "2026-10-31" });
});

test("parseHomeQuery: every accepted and refused shape", () => {
  const now = new Date("2026-10-31T08:00:00Z");
  const p = (q) => rules.parseHomeQuery(new URLSearchParams(q), now);
  assert.deepEqual(p("range=month"), { ok: true, from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(p("range=30d"), { ok: true, from: "2026-10-02", to: "2026-10-31" });
  assert.deepEqual(p("from=2026-10-05&to=2026-10-05"), { ok: true, from: "2026-10-05", to: "2026-10-05" });
  assert.deepEqual(p(""), { ok: false, field: "range" });
  assert.deepEqual(p("range=year"), { ok: false, field: "range" });
  assert.deepEqual(p("range=month&from=2026-10-01"), { ok: false, field: "range" });
  assert.deepEqual(p("range=month&to=2026-10-01"), { ok: false, field: "range" });
  assert.deepEqual(p("from=2026-10-01"), { ok: false, field: "to" });
  assert.deepEqual(p("to=2026-10-01"), { ok: false, field: "from" });
  assert.deepEqual(p("from=2026-02-30&to=2026-03-01"), { ok: false, field: "from" });
  assert.deepEqual(p("from=2026-03-01&to=nope"), { ok: false, field: "to" });
  assert.deepEqual(p("from=2026-10-06&to=2026-10-05"), { ok: false, field: "to" });
});

test("signedAed: a minus before the absolute value, never a throw", () => {
  assert.equal(rules.signedAed(-5000), "-AED 50.00");
  assert.equal(rules.signedAed(0), "AED 0.00");
  assert.equal(rules.signedAed(105000), "AED 1,050.00");
});

test("numberLinks: zero is plain, filled links; recorded can net to zero and still link", () => {
  const zero = { ...NUMBERS, bookings: 0, received_fils: 0, refunded_fils: 0, recorded_fils: 0, outstanding_fils: 0, outstanding_count: 0 };
  assert.deepEqual(rules.numberLinks(zero), { bookings: false, recorded: false, outstanding: false });
  assert.equal(rules.numberLinks({ ...zero, received_fils: 100, refunded_fils: 100 }).recorded, true);
  assert.equal(rules.numberLinks({ ...zero, outstanding_count: 1 }).outstanding, true);
  assert.equal(rules.numberLinks({ ...zero, outstanding_fils: 900 }).outstanding, false);
});

test("customerSearchText: 100 characters by code point", () => {
  assert.equal(rules.customerSearchText("a@example.com"), "a@example.com");
  const long = "😀".repeat(120);
  assert.equal(Array.from(rules.customerSearchText(long)).length, 100);
  assert.equal(rules.customerSearchText("x".repeat(100)), "x".repeat(100));
});

// ---- handlers -------------------------------------------------------------------------------------------------------

test("getHome: sends the days, answers the eight fields, a negative recorded passes", async () => {
  const o = owner({ ops_home_numbers: { data: { ...NUMBERS, recorded_fils: -300 }, error: null } });
  const out = await getHome({ owner: o, url: url("from=2026-10-01&to=2026-10-31") });
  assert.deepEqual(o.calls, [{ name: "ops_home_numbers", args: { p_from: "2026-10-01", p_to: "2026-10-31" } }]);
  assert.deepEqual(out.body, { ok: true, ...NUMBERS, recorded_fils: -300 });
});

test("getHome: unreadable answers, refusals and a bad query", async () => {
  for (const data of [null, "x", { ...NUMBERS, bookings: 1.5 }, { ...NUMBERS, from: 5 }]) {
    const out = await getHome({ owner: owner({ ops_home_numbers: { data, error: null } }), url: url("from=2026-10-01&to=2026-10-02") });
    assert.deepEqual(out, { dbError: { code: "unreadable" } });
  }
  const error = { code: "P0001", message: "almar:invalid", details: JSON.stringify({ field: "range" }) };
  const refused = await getHome({ owner: owner({ ops_home_numbers: { data: null, error } }), url: url("from=2026-10-01&to=2026-10-02") });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error.code, "invalid");
  assert.equal(refused.body.error.field, "range");
  const o = owner();
  const bad = await getHome({ owner: o, url: url("range=year") });
  assert.equal(bad.status, 400);
  assert.equal(o.calls.length, 0);
});

test("getCustomers: q, after and limit pass through; empty q is null; default limit; q over 100 refused", async () => {
  const page = { data: { items: [{ email: "a@example.com" }], next: "30" }, error: null };
  const o = owner({ ops_list_customers: page });
  const out = await getCustomers({ owner: o, url: url("") });
  assert.deepEqual(o.calls[0], { name: "ops_list_customers", args: { p_q: null, p_after: null, p_limit: LIST_LIMIT } });
  assert.deepEqual(out.body, { ok: true, items: [{ email: "a@example.com" }], next: "30" });
  const o2 = owner({ ops_list_customers: { data: { items: [], next: 5 }, error: null } });
  const out2 = await getCustomers({ owner: o2, url: url("q=ann&after=30&limit=10") });
  assert.deepEqual(o2.calls[0].args, { p_q: "ann", p_after: "30", p_limit: 10 });
  assert.equal(out2.body.next, null);
  const o3 = owner();
  const bad = await getCustomers({ owner: o3, url: url(`q=${"a".repeat(101)}`) });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.field, "q");
  assert.equal(o3.calls.length, 0);
});

test("getProfile: names joined and trimmed, null when empty, email from the session, no rpc", async () => {
  const o = owner({}, { firstName: "Ana", lastName: "Example" });
  assert.deepEqual((await getProfile({ owner: o })).body, { ok: true, name: "Ana Example", email: "owner@example.com" });
  assert.equal((await getProfile({ owner: owner({}, { firstName: "Ana" }) })).body.name, "Ana");
  assert.equal((await getProfile({ owner: owner() })).body.name, null);
  assert.equal(o.calls.length, 0);
});

// ---- route files ----------------------------------------------------------------------------------------------------

test("the three route files: force-dynamic, one GET through opsGet, no POST", () => {
  for (const name of ["home", "customers", "profile"]) {
    const source = readFileSync(`app/api/ops/${name}/route.ts`, "utf8");
    assert.match(source, /export const dynamic = "force-dynamic"/);
    assert.equal((source.match(/export const GET = opsGet\(/g) ?? []).length, 1);
    assert.doesNotMatch(source, /POST|PUT/);
  }
});
