// Plan 06-05 Task 5: the validators and handlers of /api/ops/requests and /api/ops/consult, on a fake rpc, and the route files'
// shape. Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { parseRequestsQuery, parseRequestsAction, parseConsultAction } = await loadTs("lib/ops/validate-requests.ts");
const { getRequests, postRequests, getConsult, postConsult } = await loadTs("lib/ops/requests-handlers.ts");
const { OPS_LIVE_SECTIONS, isLiveOpsPath } = await loadTs("lib/ops-routes.ts");

const ID = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000002";

function owner(answers = {}) {
  const calls = [];
  return {
    calls,
    profile: { id: ACTOR },
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return answers[name] ?? { data: null, error: null };
      },
    },
  };
}

const invalid = (fn, field) =>
  assert.throws(fn, (error) => {
    assert.equal(error.field, field);
    return true;
  });

// ---- validators ------------------------------------------------------------------------------------------------------

test("parseRequestsQuery: kind and handled, absent means all, anything else refused", () => {
  assert.deepEqual(parseRequestsQuery(new URLSearchParams()), { kind: "all", handled: "all" });
  assert.deepEqual(parseRequestsQuery(new URLSearchParams("kind=consultation&handled=no")), { kind: "consultation", handled: "no" });
  invalid(() => parseRequestsQuery(new URLSearchParams("kind=spam")), "kind");
  invalid(() => parseRequestsQuery(new URLSearchParams("handled=maybe")), "handled");
});

test("parseRequestsAction: a uuid and a boolean, no other key", () => {
  assert.deepEqual(parseRequestsAction({ id: ID, handled: true }), { id: ID, handled: true });
  invalid(() => parseRequestsAction({ id: "x", handled: true }), "id");
  invalid(() => parseRequestsAction({ id: ID, handled: "yes" }), "handled");
  assert.throws(() => parseRequestsAction({ id: ID, handled: true, p_actor: ACTOR }));
});

test("parseConsultAction save: hours on :00 and :30, ends may be 24:00, starts before ends, no overlap", () => {
  const hours = [
    { weekday: 1, starts: "14:00", ends: "18:00" },
    { weekday: 1, starts: "18:00", ends: "24:00" },
    { weekday: 2, starts: "14:00", ends: "18:00" },
  ];
  assert.deepEqual(parseConsultAction({ action: "save", hours }), { action: "save", hours });
  invalid(() => parseConsultAction({ action: "save", hours: [{ weekday: 8, starts: "14:00", ends: "18:00" }] }), "hours.0.weekday");
  invalid(() => parseConsultAction({ action: "save", hours: [{ weekday: 1, starts: "14:15", ends: "18:00" }] }), "hours.0.starts");
  invalid(() => parseConsultAction({ action: "save", hours: [{ weekday: 1, starts: "18:00", ends: "14:00" }] }), "hours.0.ends");
  invalid(() => parseConsultAction({ action: "save", hours: [{ weekday: 1, starts: "14:00", ends: "18:00" }, { weekday: 1, starts: "17:00", ends: "19:00" }] }), "hours.1");
});

test("parseConsultAction save: days off distinct; notice and horizon whole numbers in bounds or null; no default is added", () => {
  assert.deepEqual(parseConsultAction({ action: "save" }), { action: "save" });
  assert.deepEqual(parseConsultAction({ action: "save", notice_hours: null, horizon_days: null }), { action: "save", notice_hours: null, horizon_days: null });
  assert.deepEqual(parseConsultAction({ action: "save", notice_hours: 0, horizon_days: 1, days_off: ["2026-11-17"] }), { action: "save", notice_hours: 0, horizon_days: 1, days_off: ["2026-11-17"] });
  invalid(() => parseConsultAction({ action: "save", notice_hours: 721 }), "notice_hours");
  invalid(() => parseConsultAction({ action: "save", horizon_days: 0 }), "horizon_days");
  invalid(() => parseConsultAction({ action: "save", horizon_days: 1.5 }), "horizon_days");
  invalid(() => parseConsultAction({ action: "save", days_off: ["2026-11-17", "2026-11-17"] }), "days_off");
  invalid(() => parseConsultAction({ action: "save", days_off: ["nope"] }), "days_off.0");
  assert.throws(() => parseConsultAction({ action: "save", slot_minutes: 15 }));
});

test("parseConsultAction cancel: a booking id only", () => {
  assert.deepEqual(parseConsultAction({ action: "cancel", booking_id: ID }), { action: "cancel", booking_id: ID });
  invalid(() => parseConsultAction({ action: "cancel", booking_id: "x" }), "booking_id");
  invalid(() => parseConsultAction({ action: "delete" }), "action");
});

// ---- handlers --------------------------------------------------------------------------------------------------------

test("getRequests: all is null to the function; yes and no are booleans", async () => {
  const o = owner({ ops_list_requests: { data: [{ id: ID }], error: null } });
  const out = await getRequests({ owner: o, url: new URL("https://x/api/ops/requests") });
  assert.deepEqual(out.body, { ok: true, items: [{ id: ID }] });
  assert.deepEqual(o.calls[0], { name: "ops_list_requests", args: { p_kind: null, p_handled: null } });
  await getRequests({ owner: o, url: new URL("https://x/api/ops/requests?kind=plan&handled=yes") });
  assert.deepEqual(o.calls[1].args, { p_kind: "plan", p_handled: true });
  await getRequests({ owner: o, url: new URL("https://x/api/ops/requests?handled=no") });
  assert.deepEqual(o.calls[2].args, { p_kind: null, p_handled: false });
});

test("postRequests: the actor is the session's; affects_site false", async () => {
  const o = owner({ ops_set_request_handled: { data: { id: ID, handled_at: "2026-10-30T08:00:00.000Z", handled_by: ACTOR }, error: null } });
  const out = await postRequests({ owner: o, body: { id: ID, handled: true } });
  assert.deepEqual(o.calls[0].args, { p_id: ID, p_handled: true, p_actor: ACTOR });
  assert.deepEqual(out.body, { ok: true, id: ID, handled_at: "2026-10-30T08:00:00.000Z", handled_by: ACTOR, affects_site: false });
});

test("getConsult and postConsult save: the setup, without the action key; affects_site false", async () => {
  const item = { notice_hours: null, horizon_days: null, hours: [], days_off: [] };
  const o = owner({ ops_get_consult: { data: item, error: null }, ops_save_consult: { data: item, error: null } });
  assert.deepEqual((await getConsult({ owner: o, url: new URL("https://x/") })).body, { ok: true, item });
  const saved = await postConsult({ owner: o, body: { action: "save", notice_hours: 24 } });
  assert.deepEqual(o.calls[1], { name: "ops_save_consult", args: { p: { notice_hours: 24 } } });
  assert.equal(saved.body.affects_site, false);
});

test("postConsult cancel: the booking id and the session's actor", async () => {
  const o = owner({ ops_cancel_consultation: { data: { id: ID, status: "cancelled" }, error: null } });
  const out = await postConsult({ owner: o, body: { action: "cancel", booking_id: ID } });
  assert.deepEqual(o.calls[0], { name: "ops_cancel_consultation", args: { p_id: ID, p_actor: ACTOR } });
  assert.deepEqual(out.body, { ok: true, id: ID, status: "cancelled", affects_site: false });
});

test("a database refusal goes back as dbError", async () => {
  const dbError = { code: "P0001", message: "almar:not_found" };
  const o = owner({ ops_set_request_handled: { data: null, error: dbError }, ops_cancel_consultation: { data: null, error: dbError } });
  assert.deepEqual(await postRequests({ owner: o, body: { id: ID, handled: true } }), { dbError });
  assert.deepEqual(await postConsult({ owner: o, body: { action: "cancel", booking_id: ID } }), { dbError });
});

// ---- routes and sections ---------------------------------------------------------------------------------------------

test("the two routes are the wrapper's, with no bodyLimit", () => {
  for (const file of ["app/api/ops/requests/route.ts", "app/api/ops/consult/route.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /^export const dynamic = "force-dynamic";$/m, file);
    assert.match(src, /^export const GET = opsGet\(/m, file);
    assert.match(src, /^export const POST = opsPost\(/m, file);
    assert.equal(/bodyLimit|createSupabaseAdmin|process\.env/.test(src), false, file);
  }
});

test("the two sections are live; the rail has Requests after Bookings and Consultation under Content", () => {
  for (const section of ["/requests", "/content/consultation"]) assert.ok(OPS_LIVE_SECTIONS.includes(section), section);
  assert.equal(isLiveOpsPath("/dashboard/requests"), true);
  const shell = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.ok(shell.indexOf('key: "requests"') > shell.indexOf('key: "bookings"'));
  assert.ok(shell.indexOf('key: "requests"') < shell.indexOf('key: "customers"'));
  assert.ok(shell.indexOf('key: "consultation"') > shell.indexOf('key: "content"'));
  assert.ok(shell.indexOf('key: "consultation"') < shell.indexOf('key: "settings"'));
});
