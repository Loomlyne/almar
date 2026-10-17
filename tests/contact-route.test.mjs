import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadTsInRepo } from "./helpers/load-ts-in-repo.mjs";

// Plan 03.3-26 Task 1: POST /api/contact with Resend stubbed at fetch (https://api.resend.com/emails) and the console
// spied, and lib/form-rate-limit.ts. The route is bundled twice: with the real @opennextjs/cloudflare (outside a Worker
// getCloudflareContext() throws, so there is no limiter and every post is allowed) and with a stand-in that binds a
// fake FORM_LIMITER (tests/helpers/load-ts-in-repo.mjs). No real email is ever sent: any other URL fails the test.

const ROUTE = "app/api/contact/route.ts";
const unbound = await loadTsInRepo(ROUTE);
const bound = await loadTsInRepo(ROUTE, { fakeCloudflare: true });
const limitUnbound = await loadTsInRepo("lib/form-rate-limit.ts");
const limitBound = await loadTsInRepo("lib/form-rate-limit.ts", { fakeCloudflare: true });
const inquiry = await loadTs("lib/contact-inquiry.ts");

const SITE = "https://almarprivatejourney.com";
const RESEND = "https://api.resend.com/emails";
const KEY = "test-key-not-real";
// Unique strings, so the echo and log checks are exact.
const VISITOR = {
  Name: "Qzx Visitorname Seven",
  Phone: "+57 300 777 1234",
  Email: "qzx.visitor.seven@example.org",
  "Journey Type": "Group Event",
  "Journey Details": "Qzx unique journey message, ten guests.",
  Locale: "ar",
};
const SECRETS = [VISITOR.Name, VISITOR.Phone, VISITOR.Email, VISITOR["Journey Details"], "Qzx", "qzx.visitor"];

let calls = [];
let answer = () => Response.json({ id: "email-id-1" });
let logged = [];
const realFetch = globalThis.fetch;
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };

test.beforeEach(() => {
  delete process.env.RESEND_BASE_URL;
  process.env.RESEND_API_KEY = KEY;
  calls = [];
  logged = [];
  answer = () => Response.json({ id: "email-id-1" });
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
  // Nothing the visitor typed is ever logged, in any case.
  const text = JSON.stringify(logged.map((l) => l.args.map(String)));
  for (const s of SECRETS) assert.equal(text.includes(s), false, `logged: ${s}`);
  for (const l of logged) assert.notEqual(l.method, "log");
});

function post({ fields = VISITOR, body, headers = {}, url = `${SITE}/api/contact` } = {}) {
  return new Request(url, {
    method: "POST",
    headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded", ...headers },
    body: body ?? new URLSearchParams(fields),
  });
}

/** Status, exact body text and the two headers; and the body never repeats a submitted value. */
async function send(route, request) {
  const res = await route.POST(request);
  const text = await res.text();
  for (const s of SECRETS) assert.equal(text.includes(s), false, `echoed: ${s}`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  return { status: res.status, text };
}

const without = (key) => Object.fromEntries(Object.entries(VISITOR).filter(([k]) => k !== key));

test("a valid inquiry: 200 {\"ok\":true} and exactly one plain-text email to ALMAR, reply-to the visitor", async () => {
  const { status, text } = await send(unbound, post());
  assert.equal(status, 200);
  assert.equal(text, '{"ok":true}');
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.url, RESEND);
  assert.equal(call.init.method, "POST");
  assert.equal(new Headers(call.init.headers).get("authorization"), `Bearer ${KEY}`);
  const sent = JSON.parse(call.init.body);
  const want = inquiry.composeInquiryEmail(
    inquiry.validateInquiry({
      name: VISITOR.Name,
      phone: VISITOR.Phone,
      email: VISITOR.Email,
      journeyType: VISITOR["Journey Type"],
      details: VISITOR["Journey Details"],
      locale: VISITOR.Locale,
    }).inquiry,
  );
  assert.equal(sent.from, "inquiries@almarprivatejourney.com");
  assert.deepEqual([sent.to].flat(), ["inquiries@almarprivatejourney.com"]);
  assert.deepEqual([sent.reply_to].flat(), [VISITOR.Email]);
  assert.equal(sent.subject, want.subject);
  assert.equal(sent.text, want.text);
  for (const key of ["html", "cc", "bcc", "headers", "attachments", "react"]) {
    assert.equal(sent[key] === undefined || sent[key] === null, true, `no ${key}`);
  }
});

test("a phone left empty is sent as '-' and still 200", async () => {
  const { status } = await send(unbound, post({ fields: { ...VISITOR, Phone: "" } }));
  assert.equal(status, 200);
  assert.ok(JSON.parse(calls[0].init.body).text.includes("\nPhone / WhatsApp: -\n"));
});

test("CR/LF in the name cannot add a header: the subject is one line", async () => {
  const { status } = await send(unbound, post({ fields: { ...VISITOR, Name: "Qzx\r\nBcc: evil@example.com" } }));
  assert.equal(status, 200);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(/[\r\n]/.test(sent.subject), false);
  assert.equal(sent.bcc, undefined);
  assert.deepEqual([sent.to].flat(), ["inquiries@almarprivatejourney.com"]);
});

test("each of the 11 honeypots filled: 400 {\"ok\":false}, no send", async () => {
  for (const field of inquiry.HONEYPOT_FIELDS) {
    const { status, text } = await send(unbound, post({ fields: { ...VISITOR, [field]: "bot" } }));
    assert.equal(status, 400, field);
    assert.equal(text, '{"ok":false}', field);
  }
  const blank = await send(unbound, post({ fields: { ...VISITOR, website: "  " } }));
  assert.equal(blank.status, 200, "an empty or blank trap is fine");
  assert.equal(calls.length, 1);
});

test("bad fields: 400 with the error codes keyed by field, no send", async () => {
  const { status, text } = await send(
    unbound,
    post({ fields: { ...VISITOR, Email: "a@b", "Journey Type": "Cruise", "Journey Details": "", Phone: "call me" } }),
  );
  assert.equal(status, 400);
  assert.deepEqual(JSON.parse(text), {
    ok: false,
    errors: { phone: "invalid", email: "invalid", journeyType: "invalid", details: "required" },
  });
  const missing = await send(unbound, post({ fields: without("Name") }));
  assert.deepEqual(JSON.parse(missing.text), { ok: false, errors: { name: "required" } });
  const locale = await send(unbound, post({ fields: { ...VISITOR, Locale: "fr" } }));
  assert.deepEqual(JSON.parse(locale.text), { ok: false, errors: { locale: "invalid" } });
  const long = await send(unbound, post({ fields: { ...VISITOR, "Journey Details": "x".repeat(4001) } }));
  assert.deepEqual(JSON.parse(long.text), { ok: false, errors: { details: "tooLong" } });
  const empty = await send(unbound, post({ body: "" }));
  assert.equal(empty.status, 400);
  assert.equal(calls.length, 0);
});

test("Origin absent, null, another host or not http(s): 403, no send", async () => {
  const cases = [
    {},
    { origin: "null" },
    { origin: "https://evil.example" },
    { origin: "https://almarprivatejourney.com.evil.example" },
    { origin: "ftp://almarprivatejourney.com" },
    { origin: "not a url" },
  ];
  for (const headers of cases) {
    const req = post({ headers });
    if (!("origin" in headers)) {
      const h = new Headers(req.headers);
      h.delete("origin");
      const bare = new Request(req.url, { method: "POST", headers: h, body: new URLSearchParams(VISITOR) });
      const res = await send(unbound, bare);
      assert.equal(res.status, 403, "no Origin");
      continue;
    }
    const { status, text } = await send(unbound, req);
    assert.equal(status, 403, headers.origin);
    assert.equal(text, '{"ok":false}');
  }
  // The request's own host via the Host header (a proxy that rewrites the URL) is accepted.
  const viaHost = await send(
    unbound,
    post({ url: "http://127.0.0.1:8787/api/contact", headers: { origin: "https://www.almarprivatejourney.com", host: "www.almarprivatejourney.com" } }),
  );
  assert.equal(viaHost.status, 200);
  assert.equal(calls.length, 1);
});

test("wrong content type: 415, no send", async () => {
  for (const type of ["application/json", "multipart/form-data; boundary=x", "text/plain", "application/x-www-form-urlencodedx"]) {
    const { status } = await send(unbound, post({ headers: { "content-type": type } }));
    assert.equal(status, 415, type);
  }
  const charset = await send(unbound, post({ headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } }));
  assert.equal(charset.status, 200, "a charset parameter is fine");
  assert.equal(calls.length, 1);
});

test("too large: 413 by Content-Length and by the bytes read; a malformed length is 400; no send", async () => {
  const declared = await send(unbound, post({ headers: { "content-length": "16385" } }));
  assert.equal(declared.status, 413);
  const big = new URLSearchParams({ ...VISITOR, "Journey Details": "x".repeat(16400) }).toString();
  const read = await send(unbound, post({ body: big }));
  assert.equal(read.status, 413);
  const malformed = await send(unbound, post({ headers: { "content-length": "12abc" } }));
  assert.equal(malformed.status, 400);
  assert.equal(calls.length, 0);
});

test("no key (unset or whitespace): 503 after validation, no send", async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await send(unbound, post())).status, 503);
  process.env.RESEND_API_KEY = "   ";
  assert.equal((await send(unbound, post())).status, 503);
  assert.equal((await send(unbound, post({ fields: { ...VISITOR, Email: "bad" } }))).status, 400, "fields first");
  assert.equal(calls.length, 0);
});

test("Resend fails (422, 500, not JSON, throws, no id, empty id): 502, one error line naming no value", async () => {
  const failures = [
    () => Response.json({ name: "validation_error", message: "Invalid.", statusCode: 422 }, { status: 422 }),
    () => Response.json({ name: "application_error", message: "Boom.", statusCode: 500 }, { status: 500 }),
    () => new Response("<html>down</html>", { status: 500 }),
    () => {
      throw new TypeError("network down");
    },
    () => Response.json({}),
    () => Response.json({ id: "" }),
  ];
  for (const failure of failures) {
    answer = failure;
    logged = [];
    const { status, text } = await send(unbound, post());
    assert.equal(status, 502);
    assert.equal(text, '{"ok":false}');
    const mine = logged.filter((l) => l.args[0] === "contact: send failed");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].method, "error");
    assert.equal(mine[0].args.length, 2);
    assert.equal(typeof mine[0].args[1], "string");
  }
  assert.equal(calls.length, failures.length, "one try per request, never a second send");
});

test("rate limit, binding present: over the limit is 429 {\"ok\":false} with no send; the key is contact:<CF-Connecting-IP>", async () => {
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
  // The limit comes before the honeypots and the fields, after origin, type and size.
  assert.equal((await send(bound, post({ fields: { ...VISITOR, website: "bot" } }))).status, 429);
  assert.equal((await send(bound, post({ headers: { origin: "https://evil.example" } }))).status, 403);
  assert.equal((await send(bound, post({ headers: { "content-type": "text/plain" } }))).status, 415);
  assert.deepEqual(keys, ["contact:203.0.113.9", "contact:unknown"]);
  assert.equal(calls.length, 0);

  allow = true;
  assert.equal((await send(bound, post({ headers: { "cf-connecting-ip": "203.0.113.9" } }))).status, 200);
  assert.equal(calls.length, 1);
});

test("rate limit: a limiter that throws lets the post through (fail open, documented in lib/form-rate-limit.ts)", async () => {
  globalThis.__almarTestCloudflareEnv = { FORM_LIMITER: { limit: async () => { throw new Error("limiter down"); } } };
  assert.equal((await send(bound, post())).status, 200);
});

test("rate limit, no binding (next dev, node): allowed; a context without FORM_LIMITER: allowed", async () => {
  assert.equal((await send(unbound, post())).status, 200);
  globalThis.__almarTestCloudflareEnv = {};
  assert.equal((await send(bound, post())).status, 200);
  assert.equal(calls.length, 2);
});

test("lib/form-rate-limit.ts: key, binding lookup and the injected limiter", async () => {
  const req = (ip) => new Request(`${SITE}/api/contact`, { method: "POST", headers: ip ? { "cf-connecting-ip": ip } : {} });
  assert.equal(limitUnbound.formRateKey(req("198.51.100.4"), "contact"), "contact:198.51.100.4");
  assert.equal(limitUnbound.formRateKey(req(" 2001:db8::1 "), "newsletter"), "newsletter:2001:db8::1");
  assert.equal(limitUnbound.formRateKey(req(), "contact"), "contact:unknown");
  assert.equal(limitUnbound.formLimiter(), null, "outside a Worker getCloudflareContext() throws: no limiter");
  assert.equal(await limitUnbound.allowFormPost(req(), "contact"), true);
  assert.equal(await limitUnbound.allowFormPost(req(), "contact", null), true);

  const seen = [];
  const fake = (success) => ({ limit: async (o) => (seen.push(o), { success }) });
  assert.equal(await limitUnbound.allowFormPost(req("198.51.100.4"), "contact", fake(false)), false);
  assert.equal(await limitUnbound.allowFormPost(req("198.51.100.4"), "newsletter", fake(true)), true);
  assert.deepEqual(seen, [{ key: "contact:198.51.100.4" }, { key: "newsletter:198.51.100.4" }]);

  const binding = fake(false);
  globalThis.__almarTestCloudflareEnv = { FORM_LIMITER: binding };
  assert.equal(limitBound.formLimiter(), binding);
  assert.equal(await limitBound.allowFormPost(req("192.0.2.1"), "contact"), false);
});

test("source guards: POST, runtime and dynamic only; one send; the key from process.env; nothing that logs or leaks", () => {
  const source = readFileSync(ROUTE, "utf8");
  const exported = [...source.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((x) => x[1]).sort();
  assert.deepEqual(exported, ["POST", "dynamic", "runtime"]);
  assert.deepEqual(Object.keys(unbound).sort(), ["POST", "dynamic", "runtime"]);
  assert.equal(unbound.runtime, "nodejs");
  assert.equal(unbound.dynamic, "force-dynamic");
  assert.equal(source.split("emails.send(").length - 1, 1);
  assert.match(source, /process\.env\.RESEND_API_KEY/);
  assert.match(source, /from "\.\.\/\.\.\/\.\.\/lib\/contact-inquiry"/);
  assert.match(source, /honeypotTripped\(/);
  assert.match(source, /allowFormPost\(request, "contact"\)/);
  assert.equal(/html:|console\.(log|info|warn)|contacts\.create|NODE_ENV/.test(source), false);
  assert.equal(/re_[A-Za-z0-9]{10,}/.test(source), false);
  assert.equal(source.includes("re_"), false);
  const limiter = readFileSync("lib/form-rate-limit.ts", "utf8");
  assert.match(limiter, /getCloudflareContext\(\)\.env\.FORM_LIMITER/);
  assert.equal(limiter.includes("re_"), false);
});

test("both Worker files bind FORM_LIMITER: 5 posts a minute, the same block", () => {
  const block = (file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    const at = lines.indexOf("[[ratelimits]]");
    assert.notEqual(at, -1, `${file}: [[ratelimits]]`);
    assert.equal(lines.filter((l) => l === "[[ratelimits]]").length, 1, file);
    return lines.slice(at + 1, at + 4);
  };
  const want = ['name = "FORM_LIMITER"', 'namespace_id = "1001"', "simple = { limit = 5, period = 60 }"];
  assert.deepEqual(block("wrangler.toml"), want);
  assert.deepEqual(block("wrangler.preview.toml"), want);
});
