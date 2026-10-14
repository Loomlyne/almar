import test from "node:test";
import assert from "node:assert/strict";
import { loadTsInRepo } from "./helpers/load-ts-in-repo.mjs";

// Review fix (3.3 part B): lib/form-rate-limit.ts still fails open, but not silently on a Worker. One PII-free line,
// `console.error("form-limiter: unavailable")`, per request when a Cloudflare context has no FORM_LIMITER or when
// limit() throws; nothing at all without a Cloudflare context (next dev, node). The stand-in OpenNext package of
// tests/helpers/load-ts-in-repo.mjs throws while globalThis.__almarTestCloudflareEnv is unset, as the real one does.

const real = await loadTsInRepo("lib/form-rate-limit.ts");
const fake = await loadTsInRepo("lib/form-rate-limit.ts", { fakeCloudflare: true });

const IP = "203.0.113.77";
const req = () => new Request("https://almarprivatejourney.com/newsletter", { method: "POST", headers: { "cf-connecting-ip": IP } });

let logged = [];
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };

test.beforeEach(() => {
  logged = [];
  for (const method of Object.keys(realConsole)) console[method] = (...args) => logged.push({ method, args });
  delete globalThis.__almarTestCloudflareEnv;
});

test.afterEach(() => {
  Object.assign(console, realConsole);
  delete globalThis.__almarTestCloudflareEnv;
  // Whatever was logged names no address and no key.
  const text = JSON.stringify(logged.map((l) => l.args.map(String)));
  assert.equal(text.includes(IP), false);
  assert.equal(/contact:|newsletter:/.test(text), false);
});

const unavailable = () => logged.filter((l) => l.method === "error" && l.args.length === 1 && l.args[0] === "form-limiter: unavailable");

test("no Cloudflare context (next dev, node): allowed, nothing logged", async () => {
  assert.equal(await real.allowFormPost(req(), "newsletter"), true);
  assert.equal(await fake.allowFormPost(req(), "contact"), true, "the stand-in with no env set: no context either");
  assert.deepEqual(logged, []);
});

test("a Cloudflare context without FORM_LIMITER: allowed, exactly one line per request", async () => {
  globalThis.__almarTestCloudflareEnv = {};
  assert.equal(await fake.allowFormPost(req(), "newsletter"), true);
  assert.equal(unavailable().length, 1);
  assert.equal(logged.length, 1);
  assert.equal(await fake.allowFormPost(req(), "contact"), true);
  assert.equal(unavailable().length, 2, "one more for the second request");
});

test("limit() throws: allowed (fail open), exactly one line, no error text", async () => {
  globalThis.__almarTestCloudflareEnv = {
    FORM_LIMITER: {
      limit: async () => {
        throw new Error(`limiter down for ${IP}`);
      },
    },
  };
  assert.equal(await fake.allowFormPost(req(), "newsletter"), true);
  assert.equal(unavailable().length, 1);
  assert.equal(logged.length, 1);
});

test("a working limiter logs nothing, whether it says yes or no; an injected limiter is used as is", async () => {
  let allow = true;
  globalThis.__almarTestCloudflareEnv = { FORM_LIMITER: { limit: async () => ({ success: allow }) } };
  assert.equal(await fake.allowFormPost(req(), "newsletter"), true);
  allow = false;
  assert.equal(await fake.allowFormPost(req(), "newsletter"), false);
  assert.equal(await real.allowFormPost(req(), "contact", null), true, "explicit null: no limiter, not a broken one");
  const throwing = { limit: async () => { throw new Error("x"); } };
  assert.equal(await real.allowFormPost(req(), "contact", throwing), true);
  assert.equal(unavailable().length, 1, "only the throwing injected limiter logged");
});

test("formLimiter() is unchanged: null without context or binding, the binding otherwise", () => {
  assert.equal(real.formLimiter(), null);
  globalThis.__almarTestCloudflareEnv = {};
  assert.equal(fake.formLimiter(), null);
  const binding = { limit: async () => ({ success: true }) };
  globalThis.__almarTestCloudflareEnv = { FORM_LIMITER: binding };
  assert.equal(fake.formLimiter(), binding);
  assert.deepEqual(logged, []);
});
