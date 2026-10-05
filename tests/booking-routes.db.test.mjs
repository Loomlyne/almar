// The three booking routes end to end on a real local database (plan 04-02, Task 3): the handler functions are called
// with real Request objects, so the origin check, the size limits, the parsers, the status codes, the headers and the
// service-role client are the ones that ship. Needs this worktree's own local Supabase stack
// (node tests/helpers/local-supabase.mjs start). Without one the cases are skipped with a printed reason; with
// ALMAR_REQUIRE_STACK=1 a missing stack fails. It talks only to the stack's own http://127.0.0.1 URL and removes what it made.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { acquireStackLock, requireStack } from "./helpers/local-supabase.mjs";
import { loadRoute } from "./helpers/load-route.mjs";

const ORIGIN = "https://preview.almarprivatejourney.com";
const SECRET = "route-test-secret-".padEnd(48, "r");
const SAVED = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, link: process.env.BOOKING_LINK_SECRET, stripe: process.env.STRIPE_SECRET_KEY };
let state = null;
let releaseStackLock = null; // the stack is shared with the other files of `node --test`: take turns

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

async function seed(t) {
  if (state) return state;
  const stack = requireStack(t);
  if (!stack) return null;
  assert.match(stack.url, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, "this test only talks to a local stack");
  releaseStackLock = await acquireStackLock();
  process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = stack.serviceKey;
  process.env.BOOKING_LINK_SECRET = SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await waitReady(admin);
  const suffix = randomUUID().slice(0, 8);
  const ids = { destination: randomUUID(), stay: randomUUID() };
  let r = await admin.from("destinations").insert({ id: ids.destination, slug: `route-dest-${suffix}`, is_published: true });
  assert.ifError(r.error);
  r = await admin.from("stays").insert({ id: ids.stay, slug: `route-stay-${suffix}`, destination_id: ids.destination, max_guests: 6, min_nights: 1, base_nightly_rate_aed: 1000, is_published: true });
  assert.ifError(r.error);
  state = {
    admin,
    ids,
    slug: `route-stay-${suffix}`,
    quote: await loadRoute("app/api/booking/quote/route.ts"),
    hold: await loadRoute("app/api/booking/hold/route.ts"),
    release: await loadRoute("app/api/booking/release/route.ts"),
  };
  return state;
}

after(async () => {
  for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", SAVED.url], ["SUPABASE_SERVICE_ROLE_KEY", SAVED.key], ["BOOKING_LINK_SECRET", SAVED.link], ["STRIPE_SECRET_KEY", SAVED.stripe]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    if (!state) return;
    await state.admin.from("bookings").delete().eq("stay_id", state.ids.stay);
    await state.admin.from("stays").delete().eq("id", state.ids.stay);
    await state.admin.from("destinations").delete().eq("id", state.ids.destination);
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
  assert.deepEqual(Object.keys(body).sort(), ["breakdown", "holdExpiresAt", "linkToken", "ok", "ref"]);
  assert.match(body.ref, /^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.match(body.linkToken, /^[A-Za-z0-9_-]{43}$/);
  const row = await s.admin.from("bookings").select("id, status, is_test, hold_expires_at, email").eq("ref", body.ref).single();
  assert.ifError(row.error);
  assert.equal(row.data.status, "held");
  assert.equal(row.data.is_test, true, "no live Stripe key: TEST");
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

test("hold route: 503 without the link secret, with a live Stripe key while the terms are the placeholder, and without the database; nothing is created", async (t) => {
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
  process.env.STRIPE_SECRET_KEY = "sk_live_not_a_real_key";
  try {
    assert.deepEqual(await expectJson(await post(s.hold, body), 503), { ok: false, reasons: [{ code: "unavailable" }] }, "live stays closed while the terms are a placeholder");
  } finally {
    delete process.env.STRIPE_SECRET_KEY;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    assert.equal((await post(s.hold, body)).status, 503);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }
  assert.equal(await count(), before, "no booking was created by any of the three refusals");

  process.env.STRIPE_SECRET_KEY = "sk_test_not_a_real_key";
  try {
    assert.equal((await post(s.hold, body)).status, 200, "a test key is fine");
  } finally {
    delete process.env.STRIPE_SECRET_KEY;
  }
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

test("the routes never log: no console output while a hold, a quote and a release run", async (t) => {
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
    await post(s.release, { ref: held.ref, t: held.linkToken });
  } finally {
    for (const level of Object.keys(originals)) console[level] = originals[level];
  }
  assert.deepEqual(seen, [], "nothing was logged");
});
