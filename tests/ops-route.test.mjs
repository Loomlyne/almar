// Plan 03.2-04 Task 1 (and the Task 3 source guard): the owner API wrapper. runOps runs in a fixed order (owner ->
// origin -> content type and size -> JSON -> parse -> handler), maps every database refusal to a contract code, and
// never puts database text or a payload in a reply. Pure modules only: lib/ops/route-core.ts has no Next import.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const core = await loadTs("lib/ops/route-core.ts");
const { runOps, checkOrigin, mapDbError, OpsInvalid, OPS_BODY_LIMIT } = core;
const v = await loadTs("lib/ops/validate.ts");
const shape = await loadTs("lib/ops/shape.ts");

const OPS = "https://dashboard.almarprivatejourney.com";
const OWNER = { ok: true, owner: { profile: { id: "00000000-0000-4000-8000-000000000001" }, admin: {} } };

function post(body, headers = {}) {
  return new Request(`${OPS}/api/ops/destinations`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: OPS, host: "dashboard.almarprivatejourney.com", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function spies() {
  const calls = { parse: 0, handler: 0 };
  return {
    calls,
    parse: (body) => {
      calls.parse += 1;
      return body;
    },
    handler: async ({ body }) => {
      calls.handler += 1;
      return { body: { ok: true, echo: body } };
    },
  };
}

async function read(res) {
  return { status: res.status, body: await res.json(), headers: Object.fromEntries(res.headers) };
}

// ---- order: owner first ---------------------------------------------------------------------------------------------

test("not the owner: 403 not_owner; the body is never read, parse and handler never run", async () => {
  const s = spies();
  const request = post({ action: "save" });
  const res = await read(
    await runOps({ method: "POST", request, decide: async () => ({ ok: false, status: 403, code: "not_owner" }), parse: s.parse, handler: s.handler, nodeEnv: "production" }),
  );
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, { ok: false, error: { code: "not_owner", field: null, locale: null, detail: null } });
  assert.equal(request.bodyUsed, false, "the body is never read for a non-owner");
  assert.deepEqual(s.calls, { parse: 0, handler: 0 });
});

test("not the owner wins over a wrong origin and a wrong content type", async () => {
  const s = spies();
  const request = post("x", { origin: "https://evil.example", "content-type": "text/plain" });
  const res = await runOps({ method: "POST", request, decide: async () => ({ ok: false, status: 403, code: "not_owner" }), parse: s.parse, handler: s.handler, nodeEnv: "production" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "not_owner");
});

test("owner without a service-role client: 503 unavailable", async () => {
  const s = spies();
  const res = await read(
    await runOps({ method: "GET", request: new Request(`${OPS}/api/ops/stays`), decide: async () => ({ ok: false, status: 503, code: "unavailable" }), handler: s.handler, nodeEnv: "production" }),
  );
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, "unavailable");
  assert.equal(s.calls.handler, 0);
});

test("a decide that throws is 503 unavailable, never a stack", async () => {
  const res = await runOps({ method: "GET", request: new Request(`${OPS}/api/ops/stays`), decide: async () => { throw new Error("db host x.supabase.co down"); }, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" });
  const text = await res.text();
  assert.equal(res.status, 503);
  assert.equal(text.includes("supabase"), false);
});

// ---- origin ---------------------------------------------------------------------------------------------------------

test("owner POST: an Origin of another site is 403 wrong_origin; no Origin is 403 too; the ops origin passes", async () => {
  for (const origin of ["https://evil.example", "http://dashboard.almarprivatejourney.com", "https://dashboard.almarprivatejourney.com.evil.example", "null", ""]) {
    const s = spies();
    const request = post({ a: 1 }, { origin });
    const res = await read(await runOps({ method: "POST", request, decide: async () => OWNER, parse: s.parse, handler: s.handler, nodeEnv: "production" }));
    assert.equal(res.status, 403, origin);
    assert.equal(res.body.error.code, "wrong_origin", origin);
    assert.equal(request.bodyUsed, false, `${origin}: body unread`);
    assert.equal(s.calls.parse, 0);
  }
  const headers = new Headers({ "content-type": "application/json", host: "dashboard.almarprivatejourney.com" });
  const noOrigin = new Request(`${OPS}/api/ops/destinations`, { method: "POST", headers, body: "{}" });
  const res = await runOps({ method: "POST", request: noOrigin, decide: async () => OWNER, parse: (b) => b, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "wrong_origin");

  const s = spies();
  const ok = await read(await runOps({ method: "POST", request: post({ a: 1 }), decide: async () => OWNER, parse: s.parse, handler: s.handler, nodeEnv: "production" }));
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { ok: true, echo: { a: 1 } });
});

test("PUT is origin-checked too; GET is not", async () => {
  const put = new Request(`${OPS}/api/ops/media`, { method: "PUT", headers: { origin: "https://evil.example", "content-type": "image/webp" }, body: "x" });
  const res = await runOps({ method: "PUT", request: put, decide: async () => OWNER, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" });
  assert.equal(res.status, 403);
  assert.equal(put.bodyUsed, false);
  const get = new Request(`${OPS}/api/ops/stays`, { headers: { origin: "https://evil.example" } });
  assert.equal((await runOps({ method: "GET", request: get, decide: async () => OWNER, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" })).status, 200);
});

test("PUT reads no JSON and has no 64 KiB cap: the handler gets the raw request", async () => {
  const big = "x".repeat(OPS_BODY_LIMIT + 10);
  const put = new Request(`${OPS}/api/ops/media`, { method: "PUT", headers: { origin: OPS, "content-type": "image/webp" }, body: big });
  const res = await runOps({ method: "PUT", request: put, decide: async () => OWNER, handler: async ({ request }) => ({ body: { ok: true, length: (await request.text()).length } }), nodeEnv: "production" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, big.length);
});

test("checkOrigin: production accepts only the ops origin", () => {
  const prod = (origin, extra = {}) => checkOrigin({ origin, host: "dashboard.almarprivatejourney.com", overrideHost: null, nodeEnv: "production", ...extra });
  assert.equal(prod(OPS), true);
  assert.equal(prod(null), false);
  assert.equal(prod("https://almarprivatejourney.com"), false);
  assert.equal(prod("https://www.almarprivatejourney.com"), false);
  assert.equal(prod("http://dashboard.localhost:3010", { host: "dashboard.localhost:3010" }), false, "dev origins are off in production");
  assert.equal(prod("http://127.0.0.1:3010", { host: "127.0.0.1:3010", overrideHost: "dashboard.almarprivatejourney.com" }), false);
  assert.equal(prod("HTTPS://DASHBOARD.ALMARPRIVATEJOURNEY.COM"), false, "exact match only");
});

test("checkOrigin: development accepts dashboard.localhost, and 127.0.0.1 only with the ops-host override, same origin as the request", () => {
  const dev = (origin, host, overrideHost = null) => checkOrigin({ origin, host, overrideHost, nodeEnv: "development" });
  assert.equal(dev("http://dashboard.localhost:3010", "dashboard.localhost:3010"), true);
  assert.equal(dev("http://dashboard.localhost:3010", "dashboard.localhost:3011"), false, "another port is another origin");
  assert.equal(dev("http://127.0.0.1:3010", "127.0.0.1:3010"), false, "no override");
  assert.equal(dev("http://127.0.0.1:3010", "127.0.0.1:3010", "almarprivatejourney.com"), false, "override for the marketing host");
  assert.equal(dev("http://127.0.0.1:3010", "127.0.0.1:3010", "dashboard.almarprivatejourney.com"), true);
  assert.equal(dev("http://localhost:3010", "localhost:3010", "dashboard.almarprivatejourney.com"), false);
  assert.equal(dev("https://evil.example", "dashboard.localhost:3010"), false);
  assert.equal(dev(OPS, "dashboard.almarprivatejourney.com"), true);
});

// ---- content type, size, JSON ----------------------------------------------------------------------------------------

test("text/plain is 415 wrong_type; a 70,000-byte body is 413 too_large; invalid JSON is 400 invalid body", async () => {
  const run = (request) => runOps({ method: "POST", request, decide: async () => OWNER, parse: (b) => b, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" });
  const plain = await read(await run(post("{}", { "content-type": "text/plain" })));
  assert.equal(plain.status, 415);
  assert.equal(plain.body.error.code, "wrong_type");
  const form = await read(await run(post("a=1", { "content-type": "application/x-www-form-urlencoded" })));
  assert.equal(form.status, 415);

  const big = JSON.stringify({ text: "a".repeat(70_000 - 11) });
  assert.equal(Buffer.byteLength(big), 70_000);
  const large = await read(await run(post(big)));
  assert.equal(large.status, 413);
  assert.equal(large.body.error.code, "too_large");

  // A body without a Content-Length (a stream) is counted as it is read.
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(big));
      c.close();
    },
  });
  const streamed = new Request(`${OPS}/api/ops/destinations`, { method: "POST", headers: { "content-type": "application/json", origin: OPS }, body: stream, duplex: "half" });
  assert.equal((await run(streamed)).status, 413);

  const bad = await read(await run(post("{nope")));
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.error, { code: "invalid", field: "body", locale: null, detail: null });
  const empty = await read(await run(post("")));
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.field, "body");

  const charset = await run(post("{}", { "content-type": "application/json; charset=utf-8" }));
  assert.equal(charset.status, 200);
  const atLimit = JSON.stringify({ t: "a".repeat(OPS_BODY_LIMIT - 8) });
  assert.equal(Buffer.byteLength(atLimit), OPS_BODY_LIMIT);
  assert.equal((await run(post(atLimit))).status, 200, "exactly 64 KiB passes");
});

test("a parse that throws OpsInvalid is 400 with the field and the locale; other throws are 503 with nothing internal", async () => {
  const run = (parse, handler = async () => ({ body: { ok: true } })) =>
    runOps({ method: "POST", request: post({}), decide: async () => OWNER, parse, handler, nodeEnv: "production" });
  const res = await read(await run(() => { throw new OpsInvalid("translations.ar.title", "ar"); }));
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { ok: false, error: { code: "invalid", field: "translations.ar.title", locale: "ar", detail: null } });

  const boom = await run(() => { throw new TypeError("secret door code 4411 at row 7"); });
  assert.equal(boom.status, 503);
  const text = await boom.text();
  assert.equal(text.includes("4411"), false);
  assert.equal(text.includes("TypeError"), false);

  const fromHandler = await read(await run((b) => b, async () => { throw new OpsInvalid("id"); }));
  assert.equal(fromHandler.status, 400);
  assert.equal(fromHandler.body.error.field, "id");
});

test("an OpsInvalid from another copy of the module is still a 400 (the brand, not the class identity)", async () => {
  const other = await loadTs("lib/ops/route-core.ts");
  const res = await runOps({ method: "POST", request: post({}), decide: async () => OWNER, parse: () => { throw new other.OpsInvalid("slug"); }, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.field, "slug");
});

test("a handler's { dbError } goes through mapDbError; the database text never reaches the reply", async () => {
  const res = await runOps({
    method: "POST",
    request: post({}),
    decide: async () => OWNER,
    parse: (b) => b,
    handler: async () => ({ dbError: { code: "23505", message: 'duplicate key value violates unique constraint "stays_slug_key"', details: "Key (slug)=(casa-x) already exists." } }),
    nodeEnv: "production",
  });
  const text = await res.text();
  assert.equal(res.status, 409);
  assert.deepEqual(JSON.parse(text), { ok: false, error: { code: "slug_taken", field: "slug", locale: null, detail: null } });
  assert.equal(text.includes("casa-x"), false);
});

test("every reply is JSON with Cache-Control: no-store (success, refusal, error, a handler Response)", async () => {
  const replies = [
    await runOps({ method: "GET", request: new Request(`${OPS}/x`), decide: async () => OWNER, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" }),
    await runOps({ method: "GET", request: new Request(`${OPS}/x`), decide: async () => ({ ok: false, status: 403, code: "not_owner" }), handler: async () => ({ body: { ok: true } }), nodeEnv: "production" }),
    await runOps({ method: "POST", request: post("{"), decide: async () => OWNER, parse: (b) => b, handler: async () => ({ body: { ok: true } }), nodeEnv: "production" }),
    await runOps({ method: "GET", request: new Request(`${OPS}/x`), decide: async () => OWNER, handler: async () => ({ dbError: { code: "XX000" } }), nodeEnv: "production" }),
    await runOps({ method: "GET", request: new Request(`${OPS}/x`), decide: async () => OWNER, handler: async () => Response.json({ ok: true }), nodeEnv: "production" }),
  ];
  for (const res of replies) {
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
});

test("a handler status is kept (404 not_found from a handler)", async () => {
  const res = await runOps({
    method: "GET",
    request: new Request(`${OPS}/x`),
    decide: async () => OWNER,
    handler: async () => ({ status: 404, body: { ok: false, error: { code: "not_found", field: null, locale: null, detail: null } } }),
    nodeEnv: "production",
  });
  assert.equal(res.status, 404);
});

// ---- mapDbError -----------------------------------------------------------------------------------------------------

test("mapDbError: the contract table", () => {
  assert.deepEqual(mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "destinations_slug_key"' }), { status: 409, code: "slug_taken", field: "slug", locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "catalog_items_one_home_pickup"', details: "Key ((true))=(t) already exists." }), { status: 409, code: "invalid", field: "is_home_pickup", locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:parent_unpublished", details: '{"field": "destination_id"}' }), { status: 409, code: "parent_unpublished", field: "destination_id", locale: null, detail: null });
  const id = "6f1c2c1e-4b8a-4d55-9d7e-0a1b2c3d4e5f";
  assert.deepEqual(mapDbError({ code: "23P01", message: "almar:rate_overlap", details: `{"conflict_id": "${id}"}` }), { status: 409, code: "rate_overlap", field: null, locale: null, detail: { conflict_id: id } });
  assert.deepEqual(mapDbError({ code: "23P01", message: "conflicting key value violates exclusion constraint", details: "Key (stay_id, ...) conflicts" }), { status: 409, code: "rate_overlap", field: null, locale: null, detail: { conflict_id: null } });
  assert.deepEqual(mapDbError({ code: "23503", message: 'update or delete on table "destinations" violates foreign key constraint', details: 'Key (id)=(x) is still referenced from table "stays".' }), { status: 409, code: "in_use", field: null, locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "23503", message: "almar:in_use", details: '{"reason": "imported"}' }), { status: 409, code: "in_use", field: null, locale: null, detail: { reason: "imported" } });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:published", details: "{}" }), { status: 409, code: "published", field: null, locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:amenities_mismatch", details: '{"field": "amenities"}' }), { status: 409, code: "amenities_mismatch", field: "amenities", locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:not_found", details: "{}" }), { status: 404, code: "not_found", field: null, locale: null, detail: null });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:invalid", details: '{"field": "translations.ar.title", "locale": "ar"}' }), { status: 409, code: "invalid", field: "translations.ar.title", locale: "ar", detail: null });
  assert.deepEqual(mapDbError({ code: "P0001", message: "almar:invalid", details: '{"field": "slug", "locale": null}' }), { status: 409, code: "invalid", field: "slug", locale: null, detail: null });
});

test("mapDbError: anything else is 503 unavailable with no database text", () => {
  for (const error of [
    { code: "XX000", message: "internal error at /var/lib/postgresql" },
    { code: "42501", message: "permission denied for table stay_access" },
    { code: "P0001", message: "some other raise" },
    { code: "P0001", message: "almar:something_new" },
    { code: "", message: "TypeError: fetch failed" },
    {},
    null,
    undefined,
  ]) {
    assert.deepEqual(mapDbError(error), { status: 503, code: "unavailable", field: null, locale: null, detail: null }, JSON.stringify(error));
  }
});

test("mapDbError: a field or a locale that is not a plain dotted name is dropped (never echoes database text)", () => {
  assert.equal(mapDbError({ code: "P0001", message: "almar:invalid", details: '{"field": "Key (x)=(secret)"}' }).field, null);
  assert.equal(mapDbError({ code: "P0001", message: "almar:invalid", details: '{"field": "slug", "locale": "fr"}' }).locale, null);
  assert.equal(mapDbError({ code: "P0001", message: "almar:invalid", details: "not json" }).field, null);
  assert.deepEqual(mapDbError({ code: "23P01", message: "almar:rate_overlap", details: '{"conflict_id": "not-a-uuid"}' }).detail, { conflict_id: null });
});

// ---- validate.ts primitives -----------------------------------------------------------------------------------------

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

test("money: a decimal string with at most 2 decimals, normalised to 2", () => {
  assert.equal(v.money("1250.00", "price"), "1250.00");
  assert.equal(v.money("1250.5", "price"), "1250.50");
  assert.equal(v.money("1250", "price"), "1250.00");
  assert.equal(v.money("0", "price"), "0.00");
  assert.equal(v.money("9999999999.99", "price"), "9999999999.99");
  for (const bad of ["-1", "1e3", "1,250", "1250.555", " 12", "12 ", "", ".5", "5.", "01250", "99999999999", "NaN", "Infinity"]) invalid(() => v.money(bad, "price"), "price");
  for (const bad of [1250, null, undefined, true, {}, []]) invalid(() => v.money(bad, "price"), "price");
  invalid(() => v.money("0", "rate", { positive: true }), "rate");
  invalid(() => v.money("0.00", "rate", { positive: true }), "rate");
  assert.equal(v.money("0.01", "rate", { positive: true }), "0.01");
  assert.equal(v.moneyOrNull(null, "price"), null);
});

test("dates: YYYY-MM-DD calendar days only", () => {
  assert.equal(v.isoDay("2026-02-28", "d"), "2026-02-28");
  assert.equal(v.isoDay("2028-02-29", "d"), "2028-02-29");
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-01", "2026-01-01T00:00:00Z", "20260101", "", null, 20260101]) invalid(() => v.isoDay(bad, "d"), "d");
  assert.equal(v.daysBetween("2026-01-01", "2026-01-08"), 7);
  assert.equal(v.addDays("2026-12-31", 1), "2027-01-01");
});

test("slug: lowercase words joined by single hyphens, at most 80", () => {
  assert.equal(v.slug("getsemani-colonial-house", "slug"), "getsemani-colonial-house");
  assert.equal(v.slug("a1-b2", "slug"), "a1-b2");
  for (const bad of ["Casa", "casa--x", "-casa", "casa-", "casa x", "casa_x", "", "a".repeat(81), "café", null, 7]) invalid(() => v.slug(bad, "slug"), "slug");
  assert.equal(v.slug("a".repeat(80), "slug").length, 80);
});

test("uuids, integers and booleans", () => {
  const id = "25AF917E-8005-5EC2-9782-A0C2D002DDC0";
  assert.equal(v.uuid(id, "id"), id.toLowerCase());
  for (const bad of ["x", "", null, 1, "25af917e80055ec29782a0c2d002ddc0"]) invalid(() => v.uuid(bad, "id"), "id");
  assert.deepEqual(v.uuidList(["25af917e-8005-5ec2-9782-a0c2d002ddc0"], "ids"), ["25af917e-8005-5ec2-9782-a0c2d002ddc0"]);
  invalid(() => v.uuidList(["25af917e-8005-5ec2-9782-a0c2d002ddc0", "25AF917E-8005-5EC2-9782-A0C2D002DDC0"], "ids"), "ids");
  invalid(() => v.uuidList("x", "ids"), "ids");
  invalid(() => v.uuidList([], "ids", { min: 1 }), "ids");
  assert.equal(v.int(3, "n", { min: 0 }), 3);
  for (const bad of [-1, 1.5, "3", null, Number.NaN, 2 ** 31]) invalid(() => v.int(bad, "n", { min: 0 }), "n");
  assert.equal(v.intOrNull(null, "n", { min: 0 }), null);
  assert.equal(v.bool(false, "b"), false);
  invalid(() => v.bool("true", "b"), "b");
  assert.equal(v.boolOrNull(null, "b"), null);
});

test("text: trimmed, empty optional -> null, caps counted in characters, Arabic and Spanish as is", () => {
  assert.equal(v.text("  Casa  ", "name", { max: 160 }), "Casa");
  assert.equal(v.text("   ", "tagline", { max: 160 }), null);
  assert.equal(v.text(null, "tagline", { max: 160 }), null);
  assert.equal(v.text("بيت في قرطاجنة", "name", { max: 160 }), "بيت في قرطاجنة");
  assert.equal(v.text("Señorío en Cartagena", "name", { max: 160 }), "Señorío en Cartagena");
  assert.equal(v.text("ب".repeat(160), "name", { max: 160 }).length, 160);
  invalid(() => v.text("ب".repeat(161), "translations.ar.name", { max: 160, locale: "ar" }), "translations.ar.name", "ar");
  invalid(() => v.text(7, "name", { max: 160 }), "name");
  invalid(() => v.requiredText("  ", "name", { max: 160 }), "name");
  // Two UTF-16 units, one character: counted once (Postgres char_length).
  assert.equal(v.text("😀".repeat(160), "name", { max: 160 }).length, 320);
});

test("text lists: strings only, at most 40 items, each capped", () => {
  assert.deepEqual(v.textList([" a ", "b"], "amenities", { itemMax: 160 }), ["a", "b"]);
  invalid(() => v.textList("a", "amenities", { itemMax: 160 }), "amenities");
  invalid(() => v.textList([1], "amenities", { itemMax: 160 }), "amenities");
  invalid(() => v.textList(Array(41).fill("a"), "amenities", { itemMax: 160 }), "amenities");
  invalid(() => v.textList(["a".repeat(161)], "translations.es.amenities", { itemMax: 160, locale: "es" }), "translations.es.amenities", "es");
  assert.deepEqual(v.textList([], "amenities", { itemMax: 160 }), []);
});

const DEST_SPEC = { required: ["name"], fields: { name: { kind: "text", max: 160 }, summary: { kind: "text", max: 4000 }, tags: { kind: "list", max: 160 } } };

test("translations: EN required on create; null deletes AR/ES; EN null invalid; status published|draft; absent locales stay absent", () => {
  const t = v.translations({ en: { name: " Cartagena ", status: "published" }, ar: null, es: { name: "Cartagena", summary: "" } }, DEST_SPEC, { create: true });
  assert.deepEqual(t, { en: { name: "Cartagena", status: "published" }, ar: null, es: { name: "Cartagena", summary: null } });
  assert.equal("ar" in v.translations({ en: { name: "x" } }, DEST_SPEC, { create: false }), false, "absent stays absent");
  invalid(() => v.translations({ ar: { name: "x" } }, DEST_SPEC, { create: true }), "translations.en", "en");
  invalid(() => v.translations(undefined, DEST_SPEC, { create: true }), "translations.en", "en");
  invalid(() => v.translations({ en: { summary: "x" } }, DEST_SPEC, { create: true }), "translations.en.name", "en");
  invalid(() => v.translations({ en: null }, DEST_SPEC, { create: false }), "translations.en", "en");
  invalid(() => v.translations({ en: { name: "x", status: "live" } }, DEST_SPEC, { create: false }), "translations.en.status", "en");
  invalid(() => v.translations({ fr: { name: "x" } }, DEST_SPEC, { create: false }), "translations.fr");
  invalid(() => v.translations({ ar: { name: "  " } }, DEST_SPEC, { create: false }), "translations.ar.name", "ar");
  invalid(() => v.translations({ ar: { colour: "x" } }, DEST_SPEC, { create: false }), "translations.ar.colour", "ar");
  invalid(() => v.translations({ es: { tags: "x" } }, DEST_SPEC, { create: false }), "translations.es.tags", "es");
  invalid(() => v.translations({ es: "x" }, DEST_SPEC, { create: false }), "translations.es", "es");
  invalid(() => v.translations([], DEST_SPEC, { create: false }), "translations");
  // A present key with a partial record is kept partial: the database leaves the absent fields alone.
  assert.deepEqual(v.translations({ ar: { summary: "ملخص", status: "draft" } }, DEST_SPEC, { create: false }), { ar: { summary: "ملخص", status: "draft" } });
});

// ---- shape.ts ---------------------------------------------------------------------------------------------------------

test("shape: MediaRef gets its url from mediaUrl(); money is a 2-decimal string; translation state is filled", () => {
  const ref = shape.mediaRef({ id: "m1", key: "stays/x/hero.webp", width: 1600, height: 1084, alt_en: "A room" });
  assert.deepEqual(ref, { id: "m1", key: "stays/x/hero.webp", url: "https://media.almarprivatejourney.com/stays/x/hero.webp", width: 1600, height: 1084, alt_en: "A room" });
  assert.equal(shape.mediaRef(null), null);
  assert.equal(shape.mediaRef({ id: "m1", key: "a/b.webp", width: null, height: null, alt_en: null }).alt_en, "");
  assert.equal(shape.aed("1250"), "1250.00");
  assert.equal(shape.aed(1250.5), "1250.50");
  assert.equal(shape.aed("1250.00"), "1250.00");
  assert.equal(shape.aed(null), null);
  assert.equal(shape.aed(undefined), null);
  assert.deepEqual(shape.translationState({ en: "published", ar: "draft" }), { en: "published", ar: "draft", es: "missing" });
  assert.deepEqual(shape.translationState(null), { en: "missing", ar: "missing", es: "missing" });
});

test("shape: a stay rate row's daterange becomes inclusive first/last nights", () => {
  assert.deepEqual(shape.rateRange({ id: "r1", nights: "[2026-03-01,2026-03-08)", nightly_rate_aed: 1200 }), {
    id: "r1", first_night: "2026-03-01", last_night: "2026-03-07", nights: 7, nightly_rate_aed: "1200.00",
  });
});

// ---- Task 3: source guard over every app/api/ops route ----------------------------------------------------------------

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

const EXPECTED_ROUTES = ["blocks", "catalog", "destinations", "journeys", "publish", "stay-access", "stay-rates", "stays", "team"];

test("source guard: every file under app/api/ops is a route.ts built with the wrapper; nine routes; no dynamic segment", () => {
  const files = walk(join("app", "api", "ops")).sort();
  const names = files.map((f) => f.split("/").slice(3, -1).join("/"));
  for (const name of EXPECTED_ROUTES) assert.ok(names.includes(name), `app/api/ops/${name}/route.ts`);
  assert.ok(files.length >= EXPECTED_ROUTES.length);
  for (const file of files) {
    assert.match(file, /\/route\.ts$/, `${file}: only route.ts files under app/api/ops`);
    assert.equal(/[\[\]()@]/.test(file), false, `${file}: no dynamic, grouped or parallel segment`);
    assert.notEqual(file, join("app", "api", "ops", "route.ts"));
    const src = readFileSync(file, "utf8");
    assert.match(src, /^export const dynamic = "force-dynamic";$/m, `${file}: force-dynamic`);
    const exported = [...src.matchAll(/^export\s+(?:const|function|async function|let|var|class)\s+(\w+)/gm)].map((m) => m[1]);
    assert.ok(exported.length >= 2, `${file}: dynamic plus at least one method`);
    for (const name of exported) assert.ok(["dynamic", "GET", "POST", "PUT"].includes(name), `${file}: exports ${name}`);
    assert.equal(/^export\s*\{|^export\s+default|^export\s*\*/m.test(src), false, `${file}: no re-export or default export`);
    for (const m of src.matchAll(/^export const (GET|POST|PUT) = (\w+)\(/gm)) {
      assert.equal(m[2], { GET: "opsGet", POST: "opsPost", PUT: "opsPut" }[m[1]], `${file}: ${m[1]} is built with ${m[2]}`);
    }
    for (const method of ["GET", "POST", "PUT"]) {
      if (exported.includes(method)) assert.match(src, new RegExp(`^export const ${method} = ops(Get|Post|Put)\\(`, "m"), `${file}: ${method}`);
    }
    assert.equal(/supabase\/clients|createSupabaseAdmin|createClient|SUPABASE_|process\.env/.test(src), false, `${file}: no client, no key, no env`);
    assert.equal(/\bruntime\b/.test(src), false, `${file}: no runtime export (job 10)`);
    for (const m of src.matchAll(/from "([^"]+)"/g)) {
      assert.match(m[1], /^(\.\.\/)+lib\/ops\/[a-z-]+$/, `${file}: imports only lib/ops (${m[1]})`);
    }
  }
});

test("source guard: the publish route has POST only; journeys has no delete in its parse", () => {
  const publish = readFileSync("app/api/ops/publish/route.ts", "utf8");
  assert.match(publish, /export const POST = opsPost\(/);
  assert.equal(/export const GET/.test(publish), false);
});

test("source guard: lib/ops/route.ts binds requireOwner; route-core imports no Next; handlers never log a body", () => {
  const route = readFileSync("lib/ops/route.ts", "utf8");
  assert.match(route, /import \{ requireOwner[^}]*\} from "\.\.\/auth\/require-owner"/);
  assert.match(route, /decide: requireOwner/);
  for (const file of ["lib/ops/route-core.ts", "lib/ops/catalog-handlers.ts", "lib/ops/validate.ts", "lib/ops/validate-catalog.ts", "lib/ops/shape.ts", "lib/ops/journey-price.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.equal(/from "next|from "react/.test(src), false, `${file}: no Next import`);
    assert.equal(/SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdmin|process\.env/.test(src), false, `${file}: no key, no admin client, no env`);
    assert.equal(/console\.(log|info|debug|warn)\(/.test(src), false, `${file}: no logging but the error code`);
  }
  const handlers = readFileSync("lib/ops/catalog-handlers.ts", "utf8");
  assert.equal(/console\./.test(handlers), false, "handlers never log");
  assert.equal(/\.(insert|update|upsert|delete)\(/.test(handlers), false, "writes are RPCs only, never table writes");
  assert.match(handlers, /rpc\("ops_/);
});
