// Security fix (job 02): her Supabase session cookie (sb-<ref>-auth-token: access + refresh token) must be HttpOnly,
// SameSite=Lax, Path=/ and Secure in production. @supabase/ssr's own defaults are httpOnly false and no Secure.
// Three layers: the helper's values, the source of every createServerClient call, and the two real code paths
// (middleware refresh and createSupabaseServer) run against a fake Supabase API and a fake cookie store.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { sessionCookieOptions } from "../lib/supabase/cookie-options.ts";

// ---- the helper -----------------------------------------------------------------------------------------------

test("sessionCookieOptions: HttpOnly, Lax, path /, Secure exactly when NODE_ENV is production", () => {
  assert.deepEqual(sessionCookieOptions("production"), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  assert.deepEqual(sessionCookieOptions("development"), { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  assert.deepEqual(sessionCookieOptions("test"), { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  assert.deepEqual(sessionCookieOptions(undefined), { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
});

test("sessionCookieOptions reads NODE_ENV when called, not when imported", () => {
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(sessionCookieOptions().secure, true);
    process.env.NODE_ENV = "development";
    assert.equal(sessionCookieOptions().secure, false);
  } finally {
    process.env.NODE_ENV = before;
  }
});

// ---- the source -----------------------------------------------------------------------------------------------

function files(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) acc.push(path);
  }
  return acc;
}

const CALL = /createServerClient\(\s*url,\s*(?:anonKey|settings\.anonKey)\s*,\s*\{\s*cookieOptions:\s*sessionCookieOptions\(\)\s*,/;

test("both createServerClient call sites pass cookieOptions: sessionCookieOptions()", () => {
  const clients = readFileSync("lib/supabase/clients.ts", "utf8");
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(clients, /createServerClient\(\s*settings\.url,\s*settings\.anonKey,\s*\{\s*cookieOptions:\s*sessionCookieOptions\(\)\s*,/);
  assert.match(middleware, /createServerClient\(\s*url,\s*anonKey,\s*\{\s*cookieOptions:\s*sessionCookieOptions\(\)\s*,/);
  assert.ok(clients.includes('from "./cookie-options"'));
  assert.ok(middleware.includes('from "./lib/supabase/cookie-options"'));
});

test("no createServerClient call anywhere is made without cookieOptions; there is no browser client", () => {
  const all = ["app", "components", "lib", "worker"].flatMap((dir) => files(dir)).concat(["middleware.ts"]);
  const calls = all.filter((path) => /createServerClient\(/.test(readFileSync(path, "utf8")));
  assert.deepEqual(calls.sort(), [join("lib", "supabase", "clients.ts"), "middleware.ts"]);
  for (const path of calls) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.match(/createServerClient\(/g).length, 1, path);
    assert.match(text, /cookieOptions:\s*sessionCookieOptions\(\)/, path);
  }
  // httpOnly would break a browser client, which reads its own cookie. None exists; adding one must be a decision.
  const browser = all.filter((path) => /createBrowserClient/.test(readFileSync(path, "utf8")));
  assert.deepEqual(browser, []);
});

// ---- the real code paths --------------------------------------------------------------------------------------

const REF = "testref";
const URL_BASE = `https://${REF}.supabase.co`;
const COOKIE = `sb-${REF}-auth-token`;
const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const jwt = (exp) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "user-1", aud: "authenticated", role: "authenticated", exp })}.${b64("sig")}`;
const USER = { id: "user-1", aud: "authenticated", role: "authenticated", email: "guest@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const NOW = () => Math.floor(Date.now() / 1000);

function session(exp, refresh) {
  return { access_token: jwt(exp), token_type: "bearer", expires_in: exp - NOW(), expires_at: exp, refresh_token: refresh, user: USER };
}
/** A session that expired an hour ago: the next getUser must refresh it, which makes Supabase write the cookie. */
function expiredCookieValue() {
  return `base64-${b64(session(NOW() - 3600, "old-refresh"))}`;
}

const calls = [];
function fakeFetch(input, init) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") return Promise.resolve(json(session(NOW() + 3600, "new-refresh")));
  if (url.pathname === "/auth/v1/user") return Promise.resolve(json(USER));
  return Promise.resolve(new Response(JSON.stringify({ message: `unexpected ${url.pathname}` }), { status: 500 }));
}

const require = createRequire(import.meta.url);
let counter = 0;
/** Bundles one repo file with everything inline (next/server included) and imports it; `next/headers` is a stub. */
async function load(entry, extra = "") {
  const stub = {
    name: "stub-next-headers",
    setup(b) {
      b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "next-headers-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export async function cookies() { return globalThis.__fakeCookieStore; }", loader: "js" }));
    },
  };
  const out = await build({
    stdin: { contents: `export * from ${JSON.stringify(`./${entry}`)};\n${extra}`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
    plugins: [stub],
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-auth-cookies-"));
  const file = join(dir, `module-${counter++}.cjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return require(file);
}

async function withEnv(nodeEnv, run) {
  const saved = { NODE_ENV: process.env.NODE_ENV, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, fetch: globalThis.fetch };
  process.env.NODE_ENV = nodeEnv;
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL_BASE;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-a-secret";
  globalThis.fetch = fakeFetch;
  calls.length = 0;
  try {
    return await run();
  } finally {
    process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
    globalThis.fetch = saved.fetch;
  }
}

function attributes(setCookie) {
  const [pair, ...rest] = setCookie.split(";").map((part) => part.trim());
  return { name: pair.slice(0, pair.indexOf("=")), flags: rest.map((part) => part.toLowerCase()) };
}

const middlewareMod = await load("middleware.ts", 'export { NextRequest } from "next/server";');
const clientsMod = await load("lib/supabase/clients.ts");

for (const [env, secure] of [["production", true], ["development", false]]) {
  test(`middleware refresh (${env}): every session Set-Cookie is HttpOnly, SameSite=lax, Path=/${secure ? ", Secure" : ", not Secure"}`, async () => {
    await withEnv(env, async () => {
      const request = new middlewareMod.NextRequest("https://almarprivatejourney.com/", {
        headers: { cookie: `${COOKIE}=${expiredCookieValue()}` },
      });
      const response = await middlewareMod.middleware(request);
      assert.ok(calls.some((call) => call.startsWith("POST /auth/v1/token?grant_type=refresh_token")), `refresh path ran: ${calls.join(", ")}`);
      const written = response.headers.getSetCookie().map(attributes).filter(({ name }) => name.startsWith(COOKIE));
      assert.ok(written.length >= 1, "the refresh wrote the session cookie");
      for (const { name, flags } of written) {
        assert.ok(flags.includes("httponly"), `${name} HttpOnly: ${flags}`);
        assert.ok(flags.includes("samesite=lax"), `${name} SameSite=lax: ${flags}`);
        assert.ok(flags.includes("path=/"), `${name} Path=/: ${flags}`);
        assert.equal(flags.includes("secure"), secure, `${name} Secure=${secure}: ${flags}`);
        assert.equal(flags.some((flag) => flag.startsWith("domain=")), false, `${name} has no Domain`);
      }
    });
  });
}

for (const [env, secure] of [["production", true], ["development", false]]) {
  test(`createSupabaseServer refresh (${env}): the cookie store is written with httpOnly true, lax, path /, secure ${secure}`, async () => {
    await withEnv(env, async () => {
      const writes = [];
      globalThis.__fakeCookieStore = {
        getAll: () => [{ name: COOKIE, value: expiredCookieValue() }],
        set: (name, value, options) => writes.push({ name, value, options }),
      };
      try {
        const supabase = await clientsMod.createSupabaseServer();
        const { data, error } = await supabase.auth.getUser();
        assert.equal(error, null);
        assert.equal(data.user.email, "guest@example.com");
      } finally {
        delete globalThis.__fakeCookieStore;
      }
      const session = writes.filter(({ name }) => name.startsWith(COOKIE));
      assert.ok(session.length >= 1, "the refresh wrote the session cookie");
      for (const { name, options } of session) {
        assert.equal(options.httpOnly, true, name);
        assert.equal(options.sameSite, "lax", name);
        assert.equal(options.path, "/", name);
        assert.equal(options.secure, secure, name);
        assert.equal(options.domain, undefined, name);
      }
    });
  });
}
