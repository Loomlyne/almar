// Fix-up job 02-05b (review of PR #6, findings 3 and 5). Two things the 02-05 tests only pinned by reading the source:
// 1. postPreferences, run for real against a fake fetch: a 503 is sent once more, nothing else is.
// 2. confirmSignIn, run for real with Next's own cookie serialiser: the Set-Cookie it writes for the "signed in" hint.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { loadTs } from "./helpers/load-ts.mjs";

// ---- 1. the 503 retry ----------------------------------------------------------------------------------------

const sync = await loadTs("components/site/account-sync.ts");

/** Runs postPreferences with `cookie` as document.cookie and fetch answering `answers` in order (a string = throw). */
async function post(cookie, answers, fields = { locale: "ar" }) {
  const saved = { document: globalThis.document, fetch: globalThis.fetch };
  const calls = [];
  globalThis.document = { cookie };
  globalThis.fetch = (url, init) => {
    calls.push({ url, init });
    const answer = answers[calls.length - 1] ?? 204;
    if (typeof answer === "string") return Promise.reject(new TypeError(answer));
    return Promise.resolve(new Response(answer === 204 ? null : "{}", { status: answer }));
  };
  try {
    sync.postPreferences(fields);
    // Let every .then run, including a retry's own fetch and its .then.
    for (let i = 0; i < 5; i += 1) await new Promise((done) => setImmediate(done));
  } finally {
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
  }
  return calls;
}

const HINT = "almar-locale=ar; almar-signed-in=1";

test("postPreferences: no hint, no request at all", async () => {
  assert.equal((await post("almar-locale=ar", [503])).length, 0);
});

test("postPreferences: a 503 is sent once more, with the same body and the same request options", async () => {
  const calls = await post(HINT, [503, 204], { currency: "EUR" });
  assert.equal(calls.length, 2);
  for (const { url, init } of calls) {
    assert.equal(url, "/api/preferences");
    assert.equal(init.method, "POST");
    assert.equal(init.body, JSON.stringify({ currency: "EUR" }));
    assert.equal(init.keepalive, true);
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.referrerPolicy, "same-origin");
  }
});

test("postPreferences: a second 503 is not retried again (one retry, not a loop)", async () => {
  assert.equal((await post(HINT, [503, 503, 503])).length, 2);
});

for (const status of [204, 400, 403, 413, 415, 500, 502]) {
  test(`postPreferences: a ${status} is not retried`, async () => {
    assert.equal((await post(HINT, [status, 204])).length, 1);
  });
}

test("postPreferences: a network error is not retried and does not throw", async () => {
  assert.equal((await post(HINT, ["offline", 204])).length, 1);
});

test("postPreferences: a network error on the retry is swallowed", async () => {
  assert.equal((await post(HINT, [503, "offline"])).length, 2);
});

// ---- 2. the hint's Set-Cookie from confirmSignIn ---------------------------------------------------------------

const require = createRequire(import.meta.url);
const { ResponseCookies } = require("next/dist/compiled/@edge-runtime/cookies");

const ACTIONS = resolve("app/auth/confirm/actions.ts");
const TOKEN_HASH = "a".repeat(56);

/**
 * Bundles app/auth/confirm/actions.ts with its outside world stubbed (Next's headers/cookies/redirect, Supabase, the
 * continue check and the account follow); everything else, the hint's name and options included, is the repo's own.
 */
async function loadConfirm() {
  const stubs = {
    "next/headers":
      "export async function cookies() { return globalThis.__confirm.store; }\n" +
      "export async function headers() { return globalThis.__confirm.headers; }",
    "next/navigation": "export function redirect(path) { throw Object.assign(new Error('NEXT_REDIRECT'), { path }); }",
    clients:
      "export const authSigningKey = (label) => Buffer.from('test-key-' + label);\n" +
      "export const createSupabaseAdmin = () => ({ rpc: async () => ({ data: true, error: null }) });\n" +
      "export const createSupabaseServer = async () => ({ auth: { verifyOtp: async () => globalThis.__confirm.verify } });",
    continue: `export * from ${JSON.stringify(resolve("lib/auth/continue.ts"))};\nexport const checkContinue = () => "ok";`,
    follow: "export async function followAccount() { return null; }",
  };
  const plugin = {
    name: "confirm-stubs",
    setup(b) {
      b.onResolve({ filter: /^next\/(headers|navigation)$/ }, (args) => ({ path: args.path, namespace: "stub" }));
      b.onResolve({ filter: /lib\/(supabase\/clients|auth\/continue|account-follow)$/ }, (args) => {
        if (args.importer !== ACTIONS) return undefined;
        const name = args.path.endsWith("clients") ? "clients" : args.path.endsWith("continue") ? "continue" : "follow";
        return { path: name, namespace: "stub" };
      });
      b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "js", resolveDir: process.cwd() }));
    },
  };
  const out = await build({
    entryPoints: [ACTIONS],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
    plugins: [plugin],
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-confirm-hint-"));
  const file = join(dir, "actions.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return require(file);
}

const confirm = await loadConfirm();

/**
 * One Continue press. The cookie store is Next's own ResponseCookies (what a server action's cookies().set writes
 * through), so the result is the exact Set-Cookie text the browser would get.
 */
async function press({ nodeEnv = "production", shell = null, verified = true } = {}) {
  const responseHeaders = new Headers();
  const store = new ResponseCookies(responseHeaders);
  const requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7" });
  if (shell) requestHeaders.set("x-almar-shell", shell);
  globalThis.__confirm = {
    store,
    headers: requestHeaders,
    verify: verified
      ? { data: { user: { id: "user-1", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: "2026-10-12T00:00:00Z" } }, error: null }
      : { data: { user: null }, error: { message: "expired" } },
  };
  const form = new FormData();
  form.set("token_hash", TOKEN_HASH);
  form.set("type", "magiclink");
  const savedEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  let redirected = null;
  try {
    await confirm.confirmSignIn({ status: "idle" }, form);
  } catch (error) {
    if (!error || !("path" in error)) throw error;
    redirected = error.path;
  } finally {
    process.env.NODE_ENV = savedEnv;
    delete globalThis.__confirm;
  }
  return { redirected, hint: responseHeaders.getSetCookie().filter((line) => line.startsWith("almar-signed-in=")) };
}

test("the shell header name the stub sends is the one the action reads", async () => {
  const { SHELL_HEADER } = await loadTs("lib/host.ts");
  assert.equal(SHELL_HEADER, "x-almar-shell");
});

test("confirmSignIn (production, public host): one Set-Cookie almar-signed-in=1, Path=/, 400 days, Secure, SameSite=lax, not HttpOnly", async () => {
  const { redirected, hint } = await press();
  assert.ok(redirected, "the action ends in a redirect");
  assert.equal(hint.length, 1, hint.join(" | "));
  const [pair, ...attributes] = hint[0].split(";").map((part) => part.trim());
  assert.equal(pair, "almar-signed-in=1");
  const flags = attributes.map((part) => part.toLowerCase());
  assert.ok(flags.includes("path=/"), flags.join(", "));
  assert.ok(flags.includes(`max-age=${400 * 24 * 60 * 60}`), flags.join(", "));
  assert.ok(flags.includes("secure"), flags.join(", "));
  assert.ok(flags.includes("samesite=lax"), flags.join(", "));
  assert.equal(flags.includes("httponly"), false, "a page script must be able to read it");
  assert.equal(flags.some((flag) => flag.startsWith("domain=")), false, "host-only");
});

test("confirmSignIn (development): the hint has no Secure flag (plain http dev)", async () => {
  const { hint } = await press({ nodeEnv: "development" });
  assert.equal(hint.length, 1);
  assert.equal(/;\s*Secure/i.test(hint[0]), false, hint[0]);
});

test("confirmSignIn on the ops host: no hint", async () => {
  const { redirected, hint } = await press({ shell: "ops" });
  assert.ok(redirected);
  assert.deepEqual(hint, []);
});

test("confirmSignIn with a failed verifyOtp: no hint, back to the expired page", async () => {
  const { redirected, hint } = await press({ verified: false });
  assert.equal(redirected, "/login?expired=1");
  assert.deepEqual(hint, []);
});
