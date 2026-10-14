import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTsInRepo } from "./helpers/load-ts-in-repo.mjs";

// Plan 03.3-27 (owner's hardening, 2026-10-14): POST /newsletter with Resend stubbed at fetch
// (https://api.resend.com/contacts) and the console spied. The route is bundled twice: with the real
// @opennextjs/cloudflare (outside a Worker there is no limiter, so every post is allowed) and with the stand-in that
// binds a fake FORM_LIMITER (tests/helpers/load-ts-in-repo.mjs). No real contact is ever created: any other URL fails
// the test, and no answer or console call may carry the address or the Resend contact id.

const ROUTE = "app/newsletter/route.ts";
const unbound = await loadTsInRepo(ROUTE);
const bound = await loadTsInRepo(ROUTE, { fakeCloudflare: true });

const SITE = "https://almarprivatejourney.com";
const RESEND = "https://api.resend.com/contacts";
const KEY = "test-key-not-real";
const ADDRESS = "qzx.newsletter.nine@example.org";
const CONTACT_ID = "qzx-contact-id-4711";
const HONEYPOTS = ["title", "website", "company", "message", "subject", "description", "feedback", "notes", "details", "remarks", "comments"];
const NEVER = [ADDRESS, "qzx.newsletter", CONTACT_ID, "qzx-contact"];

let calls = [];
let answer = () => Response.json({ object: "contact", id: CONTACT_ID });
let logged = [];
const realFetch = globalThis.fetch;
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };

test.beforeEach(() => {
  delete process.env.RESEND_BASE_URL;
  process.env.RESEND_API_KEY = KEY;
  calls = [];
  logged = [];
  answer = () => Response.json({ object: "contact", id: CONTACT_ID });
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });
    if (url !== RESEND) throw new Error(`unexpected fetch to ${url}`);
    return answer();
  };
  for (const method of Object.keys(realConsole)) console[method] = (...args) => logged.push({ method, args });
  delete globalThis.__almarTestCloudflareEnv;
});

test.afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(console, realConsole);
  delete process.env.RESEND_API_KEY;
  delete globalThis.__almarTestCloudflareEnv;
  // Neither the address nor the contact id is ever logged, in any case; and nothing is logged at log level.
  const text = JSON.stringify(logged.map((l) => l.args.map(String)));
  for (const s of NEVER) assert.equal(text.includes(s), false, `logged: ${s}`);
  for (const l of logged) assert.equal(l.method, "error");
});

/** The FormData the footer sends: Email plus the 11 traps, empty unless given. */
function form(fields = {}) {
  const data = new FormData();
  data.set("Email", ADDRESS);
  for (const name of HONEYPOTS) data.set(name, "");
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) data.delete(k);
    else data.set(k, v);
  }
  return data;
}

/** A multipart request like the browser's: the boundary content type comes from the FormData body (read to bytes). */
async function post({ fields, body, headers = {}, url = `${SITE}/newsletter`, origin = SITE } = {}) {
  const base = new Request(url, { method: "POST", body: body ?? form(fields) });
  const h = new Headers(base.headers);
  if (origin !== null) h.set("origin", origin);
  for (const [k, v] of Object.entries(headers)) {
    if (v === null) h.delete(k);
    else h.set(k, v);
  }
  return new Request(url, { method: "POST", headers: h, body: new Uint8Array(await base.arrayBuffer()) });
}

/** Status and exact body text; every answer is JSON, no-store, and repeats neither the address nor the id. */
async function send(route, pending) {
  const res = await route.POST(await pending);
  const text = await res.text();
  for (const s of NEVER) assert.equal(text.includes(s), false, `echoed: ${s}`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  return { status: res.status, text };
}

test("a valid address: 200 exactly {\"ok\":true} (no contact id) and exactly one contacts.create with that address", async () => {
  const { status, text } = await send(unbound, post());
  assert.equal(status, 200);
  assert.equal(text, '{"ok":true}');
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.url, RESEND);
  assert.equal(call.init.method, "POST");
  assert.equal(new Headers(call.init.headers).get("authorization"), `Bearer ${KEY}`);
  const sent = JSON.parse(call.init.body);
  assert.equal(sent.email, ADDRESS);
  assert.equal(sent.unsubscribed, false);
  for (const key of ["audience_id", "segments", "topics", "first_name", "last_name", "properties", "from", "to"]) {
    assert.equal(sent[key] === undefined || sent[key] === null, true, `no ${key}`);
  }
  assert.equal(logged.length, 0);
});

test("the address is trimmed before it is added", async () => {
  const { status } = await send(unbound, post({ fields: { Email: `  ${ADDRESS}\n` } }));
  assert.equal(status, 200);
  assert.equal(JSON.parse(calls[0].init.body).email, ADDRESS);
});

test("each of the 11 honeypots filled: 400 {\"ok\":false}, nothing added; a blank trap is fine", async () => {
  for (const field of HONEYPOTS) {
    const { status, text } = await send(unbound, post({ fields: { [field]: "bot" } }));
    assert.equal(status, 400, field);
    assert.equal(text, '{"ok":false}', field);
  }
  const blank = await send(unbound, post({ fields: { website: "   " } }));
  assert.equal(blank.status, 200);
  assert.equal(calls.length, 1);
});

test("a missing, empty or malformed address: 400 {\"ok\":false}, nothing added", async () => {
  for (const Email of [undefined, "", "   ", "no-at-sign", "a@b", "two@@example.com", "a b@example.com", "<a@example.com>", `${"x".repeat(250)}@example.com`]) {
    const { status, text } = await send(unbound, post({ fields: { Email } }));
    assert.equal(status, 400, String(Email));
    assert.equal(text, '{"ok":false}');
  }
  const urlencoded = new URLSearchParams({ Email: ADDRESS }).toString();
  assert.equal((await send(unbound, post({ body: "--x\r\nnot multipart\r\n", headers: { "content-type": "multipart/form-data; boundary=zzz" } }))).status, 400, "a body that is not the declared multipart");
  assert.equal((await send(unbound, post({ body: urlencoded, headers: { "content-type": "multipart/form-data; boundary=zzz" } }))).status, 400);
  assert.equal(calls.length, 0);
});

test("Origin absent, null, another host, a lookalike, not http(s) or not a URL: 403, nothing added", async () => {
  for (const origin of [null, "null", "https://evil.example", "https://almarprivatejourney.com.evil.example", "ftp://almarprivatejourney.com", "not a url"]) {
    const { status, text } = await send(unbound, post({ origin }));
    assert.equal(status, 403, String(origin));
    assert.equal(text, '{"ok":false}');
  }
  // The request's own host via the Host header (a proxy that rewrites the URL) is accepted; http too (wrangler dev).
  const viaHost = await send(
    unbound,
    post({ url: "http://127.0.0.1:8787/newsletter", origin: "https://www.almarprivatejourney.com", headers: { host: "www.almarprivatejourney.com" } }),
  );
  assert.equal(viaHost.status, 200);
  assert.equal(calls.length, 1);
});

test("a content type other than multipart/form-data: 415, nothing added", async () => {
  for (const type of ["application/x-www-form-urlencoded", "application/json", "text/plain", "multipart/form-data", "multipart/mixed; boundary=x", "multipart/form-dataX; boundary=x"]) {
    const { status } = await send(unbound, post({ body: `Email=${encodeURIComponent(ADDRESS)}`, headers: { "content-type": type } }));
    assert.equal(status, 415, type);
  }
  assert.equal((await send(unbound, post({ headers: { "content-type": null } }))).status, 415, "no content type");
  assert.equal(calls.length, 0);
});

test("too large: 413 by Content-Length and by the bytes read; a malformed length is 400; nothing added", async () => {
  assert.equal((await send(unbound, post({ headers: { "content-length": "8193" } }))).status, 413);
  assert.equal((await send(unbound, post({ fields: { comments: "x".repeat(9000) } }))).status, 413);
  assert.equal((await send(unbound, post({ headers: { "content-length": "12abc" } }))).status, 400);
  assert.equal(calls.length, 0);
});

test("no key (unset or whitespace): 503 after the checks, nothing added", async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await send(unbound, post())).status, 503);
  process.env.RESEND_API_KEY = "   ";
  assert.equal((await send(unbound, post())).status, 503);
  assert.equal((await send(unbound, post({ fields: { Email: "bad" } }))).status, 400, "the address first");
  assert.equal(calls.length, 0);
});

test("Resend fails (422, 500, not JSON, throws, no id, empty id): 502, one error line naming no value", async () => {
  const failures = [
    () => Response.json({ name: "validation_error", message: `Invalid ${ADDRESS}.`, statusCode: 422 }, { status: 422 }),
    () => Response.json({ name: "application_error", message: "Boom.", statusCode: 500 }, { status: 500 }),
    () => new Response(`<html>down ${ADDRESS}</html>`, { status: 500 }),
    () => {
      throw new TypeError("network down");
    },
    () => Response.json({ object: "contact" }),
    () => Response.json({ object: "contact", id: "" }),
  ];
  for (const failure of failures) {
    answer = failure;
    logged = [];
    const { status, text } = await send(unbound, post());
    assert.equal(status, 502);
    assert.equal(text, '{"ok":false}');
    const mine = logged.filter((l) => l.args[0] === "newsletter: add failed");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].method, "error");
    assert.equal(mine[0].args.length, 2);
    assert.equal(typeof mine[0].args[1], "string");
  }
  assert.equal(calls.length, failures.length, "one try per request");
});

test("rate limit, binding present: over the limit is 429 {\"ok\":false}, nothing added; key newsletter:<CF-Connecting-IP>; after origin, type and size", async () => {
  const keys = [];
  let allow = false;
  globalThis.__almarTestCloudflareEnv = {
    FORM_LIMITER: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: allow };
      },
    },
  };
  const over = await send(bound, post({ headers: { "cf-connecting-ip": "203.0.113.9" } }));
  assert.equal(over.status, 429);
  assert.equal(over.text, '{"ok":false}');
  assert.equal((await send(bound, post({ fields: { website: "bot" } }))).status, 429, "before the honeypots");
  assert.equal((await send(bound, post({ origin: "https://evil.example" }))).status, 403);
  assert.equal((await send(bound, post({ headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal((await send(bound, post({ headers: { "content-length": "9000" } }))).status, 413);
  assert.deepEqual(keys, ["newsletter:203.0.113.9", "newsletter:unknown"]);
  assert.equal(calls.length, 0);

  allow = true;
  assert.equal((await send(bound, post({ headers: { "cf-connecting-ip": "203.0.113.9" } }))).status, 200);
  assert.equal(calls.length, 1);
});

test("rate limit: no binding allows the post; a limiter that throws allows it too (fail open, lib/form-rate-limit.ts)", async () => {
  assert.equal((await send(unbound, post())).status, 200);
  globalThis.__almarTestCloudflareEnv = { FORM_LIMITER: { limit: async () => { throw new Error("limiter down"); } } };
  assert.equal((await send(bound, post())).status, 200);
  assert.equal(calls.length, 2);
});

test("source guards: POST, runtime and dynamic only; contacts.create once; never emails.send; the key from process.env", () => {
  const source = readFileSync(ROUTE, "utf8");
  const exported = [...source.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((x) => x[1]).sort();
  assert.deepEqual(exported, ["POST", "dynamic", "runtime"]);
  assert.deepEqual(Object.keys(unbound).sort(), ["POST", "dynamic", "runtime"]);
  assert.equal(unbound.runtime, "nodejs");
  assert.equal(unbound.dynamic, "force-dynamic");
  // GET and HEAD are not handlers: Next answers them 405, never a page (tests/build/server-runtime.spec.ts on the Worker).
  assert.equal("GET" in unbound || "HEAD" in unbound, false);
  assert.equal(source.split("contacts.create(").length - 1, 1);
  assert.equal(source.includes("emails.send"), false);
  assert.match(source, /process\.env\.RESEND_API_KEY/);
  assert.equal(/re_[A-Za-z0-9]{10,}/.test(source) || source.includes("re_"), false);
});
