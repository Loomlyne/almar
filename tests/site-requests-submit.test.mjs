// Plan 06-05 Task 3: save, then email, on a fake admin and a fake mailer, and the three route files' shape. Written, not run
// (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { submitSiteRequest, bookConsultation, handleSiteRequestPost, handleConsultBookPost, handleConsultSlotsGet } = await loadTs("lib/site-requests/submit.ts");
const { REQUEST_ROUTE_KINDS, REQUEST_PREPARE } = await loadTs("lib/site-requests/route-kinds.ts");
const { REQUEST_FIELD: F } = await loadTs("lib/site-requests/validate.ts");

const HOST = "https://almarprivatejourney.com";

function fakeAdmin(answers = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      const answer = answers[name];
      if (typeof answer === "function") return answer(args);
      return answer ?? { data: null, error: null };
    },
  };
}

function deps(admin, { sendOk = true } = {}) {
  const sent = [];
  return {
    sent,
    admin,
    limiter: null,
    send: async (email, options) => {
      sent.push({ email, options });
      return sendOk;
    },
    brand: async () => null,
    now: () => new Date("2026-10-30T08:00:00.000Z"),
  };
}

const saved = { submit_site_request: { data: { id: "r-1" }, error: null } };
const PLAN = { [F.kind]: "plan", [F.locale]: "en", [F.name]: "Ana", [F.email]: "ana@example.com" };

function post(path, values, headers = {}) {
  const body = new URLSearchParams(values).toString();
  return new Request(`${HOST}${path}`, {
    method: "POST",
    headers: { origin: HOST, "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

// ---- submitSiteRequest -----------------------------------------------------------------------------------------------

test("submitSiteRequest: saves first, then sends with the idempotency key", async () => {
  const admin = fakeAdmin(saved);
  const d = deps(admin);
  const out = await submitSiteRequest(d, { kind: "plan", locale: "en", payload: { name: "Ana", email: "ana@example.com" } });
  assert.deepEqual(out, { ok: true, id: "r-1", emailed: true });
  assert.deepEqual(admin.calls, [{ name: "submit_site_request", args: { p_kind: "plan", p_locale: "en", p_payload: { name: "Ana", email: "ana@example.com" } } }]);
  assert.equal(d.sent[0].options.idempotencyKey, "site-request/r-1");
});

test("submitSiteRequest: a failed send is still ok, emailed false", async () => {
  const out = await submitSiteRequest(deps(fakeAdmin(saved), { sendOk: false }), { kind: "plan", locale: "en", payload: { name: "A", email: "a@b.co" } });
  assert.deepEqual(out, { ok: true, id: "r-1", emailed: false });
});

test("submitSiteRequest: no admin 503 with nothing written; almar:invalid 400; another refusal 503", async () => {
  assert.deepEqual(await submitSiteRequest(deps(null), { kind: "plan", locale: "en", payload: {} }), { ok: false, status: 503 });
  const invalid = deps(fakeAdmin({ submit_site_request: { data: null, error: { code: "P0001", message: "almar:invalid" } } }));
  assert.deepEqual(await submitSiteRequest(invalid, { kind: "package", locale: "en", payload: {} }), { ok: false, status: 400 });
  assert.equal(invalid.sent.length, 0);
  const other = deps(fakeAdmin({ submit_site_request: { data: null, error: { code: "XX000", message: "boom" } } }));
  assert.deepEqual(await submitSiteRequest(other, { kind: "plan", locale: "en", payload: {} }), { ok: false, status: 503 });
});

test("submitSiteRequest: emailLines reach the email after the payload lines", async () => {
  const d = deps(fakeAdmin(saved));
  await submitSiteRequest(d, { kind: "package", locale: "en", payload: { name: "A", email: "a@b.co", tier_slug: "t" }, emailLines: ["Extra line"] });
  const text = d.sent[0].email.text;
  assert.ok(text.indexOf("Extra line") > text.indexOf("Package: t"));
});

// ---- handleSiteRequestPost --------------------------------------------------------------------------------------------

const run = (request, d, prepare) => handleSiteRequestPost(request, d, REQUEST_ROUTE_KINDS, prepare);

test("the order: origin 403, type 415, size 413, rate limit 429, honeypot 400, fields 400, admin 503", async () => {
  const d = () => deps(fakeAdmin(saved));
  assert.equal((await run(post("/api/requests", PLAN, { origin: "https://evil.example" }), d())).status, 403);
  assert.equal((await run(post("/api/requests", PLAN, { "content-type": "application/json" }), d())).status, 415);
  assert.equal((await run(post("/api/requests", { ...PLAN, [F.tripNotes]: "x".repeat(17000) }), d())).status, 413);
  const limited = d();
  limited.limiter = { limit: async () => ({ success: false }) };
  assert.equal((await run(post("/api/requests", PLAN), limited)).status, 429);
  const trapped = d();
  assert.equal((await run(post("/api/requests", { ...PLAN, website: "x" }), trapped)).status, 400);
  assert.equal(trapped.admin.calls.length, 0);
  const bad = await run(post("/api/requests", { ...PLAN, [F.email]: "nope" }), d());
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { ok: false, errors: { email: "invalid" } });
  assert.equal((await run(post("/api/requests", PLAN), deps(null))).status, 503);
});

test("a kind outside the list is 400 and nothing is saved", async () => {
  const d = deps(fakeAdmin(saved));
  assert.equal((await run(post("/api/requests", { ...PLAN, [F.kind]: "consultation" }), d)).status, 400);
  assert.equal((await run(post("/api/requests", { ...PLAN, [F.kind]: "package" }), d)).status, 400);
  assert.equal(d.admin.calls.length, 0);
});

test("a good post answers ok and the reply repeats nothing submitted", async () => {
  const res = await run(post("/api/requests", PLAN), deps(fakeAdmin(saved)));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { ok: true, emailed: true });
});

test("the prepare hook runs once, after validation, before the rpc; a refusal saves and emails nothing", async () => {
  const d = deps(fakeAdmin(saved));
  let seen = 0;
  const refuse = { plan: async () => (seen++, { ok: false, errors: { tier_slug: "invalid" } }) };
  const res = await run(post("/api/requests", PLAN), d, refuse);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, errors: { tier_slug: "invalid" } });
  assert.equal(seen, 1);
  assert.equal(d.admin.calls.length, 0);
  assert.equal(d.sent.length, 0);
});

test("the prepare hook's lines reach the email; a kind without a hook skips it; an invalid post never calls it", async () => {
  const d = deps(fakeAdmin(saved));
  await run(post("/api/requests", PLAN), d, { plan: async () => ({ ok: true, emailLines: ["Hook line"] }) });
  assert.ok(d.sent[0].email.text.includes("Hook line"));
  let seen = 0;
  await run(post("/api/requests", { ...PLAN, [F.email]: "nope" }), deps(fakeAdmin(saved)), { plan: async () => (seen++, { ok: true, emailLines: [] }) });
  assert.equal(seen, 0);
  assert.equal((await run(post("/api/requests", PLAN), deps(fakeAdmin(saved)), {})).status, 200);
  assert.deepEqual(REQUEST_PREPARE, {});
  assert.deepEqual([...REQUEST_ROUTE_KINDS], ["plan", "list"]);
});

// ---- consultation ------------------------------------------------------------------------------------------------------

const BOOK = {
  [F.locale]: "es",
  [F.name]: "Ana",
  [F.email]: "ana@example.com",
  [F.phone]: "+34 600 000 000",
  [F.slot]: "2026-11-03T11:00:00.000Z",
  [F.timeZone]: "Europe/Madrid",
};
const booked = { book_consultation: { data: { request_id: "r-9", booking_id: "b-9", slot_start: "2026-11-03T11:00:00.000Z" }, error: null } };

test("bookConsultation: both emails, each with the .ics; reply-to inquiries@ on the guest's", async () => {
  const d = deps(fakeAdmin(booked));
  const out = await bookConsultation(d, {
    locale: "es",
    payload: { name: "Ana", email: "ana@example.com", phone: "+34 600 000 000", slot_start: "2026-11-03T11:00:00.000Z", time_zone: "Europe/Madrid" },
  });
  assert.equal(out.ok, true);
  assert.equal(out.emailed, true);
  assert.deepEqual(d.sent.map((s) => s.options.idempotencyKey), ["consult-guest/b-9", "consult-owner/b-9"]);
  const [guest, owner] = d.sent.map((s) => s.email);
  assert.equal(guest.to, "ana@example.com");
  assert.equal(guest.replyTo, "inquiries@almarprivatejourney.com");
  assert.equal(owner.to, "inquiries@almarprivatejourney.com");
  assert.equal(owner.replyTo, "ana@example.com");
  for (const email of [guest, owner]) {
    const [file] = email.attachments;
    assert.equal(file.filename, "almar-consultation.ics");
    assert.equal(file.contentType, "text/calendar; charset=utf-8; method=PUBLISH");
    assert.ok(Buffer.from(file.content, "base64").toString("utf-8").includes("UID:b-9@almarprivatejourney.com"));
  }
});

test("bookConsultation: the refusals", async () => {
  const refused = async (code) =>
    bookConsultation(deps(fakeAdmin({ book_consultation: { data: null, error: { code: "P0001", message: `almar:${code}` } } })), { locale: "en", payload: {} });
  assert.deepEqual(await refused("slot_taken"), { ok: false, status: 409, reason: "slot_taken" });
  assert.deepEqual(await refused("consult_closed"), { ok: false, status: 409, reason: "closed" });
  for (const code of ["slot_outside_hours", "slot_too_soon", "slot_too_far"]) assert.deepEqual(await refused(code), { ok: false, status: 409, reason: "unavailable" });
  assert.deepEqual(await refused("invalid"), { ok: false, status: 400, reason: "invalid" });
});

test("handleConsultBookPost: a failed mail keeps the booking, emailed false; a taken slot answers its reason; no key 503", async () => {
  const quiet = await handleConsultBookPost(post("/api/consult/book", BOOK), deps(fakeAdmin(booked), { sendOk: false }));
  assert.equal(quiet.status, 200);
  assert.deepEqual(await quiet.json(), { ok: true, slot_start: "2026-11-03T11:00:00.000Z", emailed: false });
  const taken = await handleConsultBookPost(post("/api/consult/book", BOOK), deps(fakeAdmin({ book_consultation: { data: null, error: { message: "almar:slot_taken" } } })));
  assert.equal(taken.status, 409);
  assert.deepEqual(await taken.json(), { ok: false, reason: "slot_taken" });
  assert.equal((await handleConsultBookPost(post("/api/consult/book", BOOK), deps(null))).status, 503);
  assert.equal((await handleConsultBookPost(post("/api/consult/book", { ...BOOK, comments: "x" }), deps(fakeAdmin(booked)))).status, 400);
});

const slotsUrl = (from, to) => new URL(`${HOST}/api/consult/slots?from=${from}&to=${to}`);

test("handleConsultSlotsGet: a bad date or a range over 31 days is 400, before any rpc", async () => {
  const admin = fakeAdmin();
  for (const [from, to] of [["nope", "2026-11-01"], ["2026-02-31", "2026-03-01"], ["2026-11-02", "2026-11-01"], ["2026-11-01", "2026-12-03"]]) {
    assert.equal((await handleConsultSlotsGet(slotsUrl(from, to), { admin })).status, 400, `${from} ${to}`);
  }
  assert.equal(admin.calls.length, 0);
});

test("handleConsultSlotsGet: closed while notice or horizon is null; no slot read, no setting leaves", async () => {
  const admin = fakeAdmin({ ops_get_consult: { data: { notice_hours: 24, horizon_days: null, hours: [{ weekday: 1 }] }, error: null } });
  const res = await handleConsultSlotsGet(slotsUrl("2026-11-01", "2026-11-30"), { admin });
  assert.deepEqual(await res.json(), { ok: true, open: false, slots: [], time_zone: "Asia/Dubai" });
  assert.deepEqual(admin.calls.map((c) => c.name), ["ops_get_consult"]);
});

test("handleConsultSlotsGet: open answers ISO starts only, no-store; no admin 503", async () => {
  const admin = fakeAdmin({
    ops_get_consult: { data: { notice_hours: 1, horizon_days: 2, upcoming: [{ name: "Secret" }] }, error: null },
    consult_slots: { data: [{ slot_start: "2026-11-03T10:00:00+00:00" }], error: null },
  });
  const res = await handleConsultSlotsGet(slotsUrl("2026-11-01", "2026-12-02"), { admin });
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.deepEqual(body, { ok: true, open: true, slots: ["2026-11-03T10:00:00.000Z"], time_zone: "Asia/Dubai" });
  assert.deepEqual(admin.calls[1], { name: "consult_slots", args: { p_from: "2026-11-01", p_to: "2026-12-02" } });
  assert.equal((await handleConsultSlotsGet(slotsUrl("2026-11-01", "2026-11-30"), { admin: null })).status, 503);
});

// ---- the route files ----------------------------------------------------------------------------------------------------

test("the three route files: force-dynamic, nodejs, their handler, nothing from lib/ops", () => {
  for (const [file, handler] of [
    ["app/api/requests/route.ts", "handleSiteRequestPost"],
    ["app/api/consult/slots/route.ts", "handleConsultSlotsGet"],
    ["app/api/consult/book/route.ts", "handleConsultBookPost"],
  ]) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /^export const dynamic = "force-dynamic";$/m, file);
    assert.match(src, /^export const runtime = "nodejs";$/m, file);
    assert.ok(src.includes(handler), file);
    assert.equal(/lib\/ops\//.test(src), false, file);
    assert.equal(/process\.env|createSupabaseAdmin/.test(src), false, file);
  }
  assert.match(readFileSync("app/api/requests/route.ts", "utf8"), /handleSiteRequestPost\(request, realDeps\(\), REQUEST_ROUTE_KINDS, REQUEST_PREPARE\)/);
});
