// Plan 02-05 (addendum 2026-10-11): POST /api/preferences. Order: same-origin -> type and size -> JSON -> allow-list ->
// session. A refused request never reads the body or reaches the session; no reply carries request input; no session is
// a quiet 204; the write is her own row through her session (no service role).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const core = await loadTs("lib/preferences-route.ts");
const { handlePreferences, checkPreferencesOrigin, saveOwnPreferences, PREFERENCES_BODY_LIMIT } = core;

const SITE = "https://almarprivatejourney.com";
const HOST = "almarprivatejourney.com";

function post(body, headers = {}) {
  return new Request(`${SITE}/api/preferences`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE, "sec-fetch-site": "same-origin", host: HOST, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A request whose headers are exactly `headers` (no defaults), for the Origin / Sec-Fetch-Site matrix. */
function bare(headers, body = { locale: "ar" }) {
  return new Request(`${SITE}/api/preferences`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function deps({ cookie = true, user = true, saved = true, throws = false } = {}) {
  const calls = { session: 0, save: [] };
  return {
    calls,
    deps: {
      nodeEnv: "production",
      hasSessionCookie: cookie,
      session: async () => {
        calls.session += 1;
        if (throws) throw new Error("supabase down ar USD");
        if (!user) return null;
        return {
          save: async (fields) => {
            calls.save.push(fields);
            return saved;
          },
        };
      },
    },
  };
}

test("same-origin signed-in pick: 204, her fields saved, nothing in the reply", async () => {
  const { calls, deps: d } = deps();
  const res = await handlePreferences(post({ locale: "ar", currency: "USD" }), d);
  assert.equal(res.status, 204);
  assert.equal(await res.text(), "");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls.save, [{ locale: "ar", currency: "USD" }]);
});

test("cross-origin request is refused with 403 before the body or the session is touched", async () => {
  for (const headers of [
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    { origin: "https://evil.example" },
    { origin: "https://almarprivatejourney.com.evil.example", "sec-fetch-site": "cross-site" },
    { origin: "http://almarprivatejourney.com" },
    { origin: "https://dashboard.almarprivatejourney.com", "sec-fetch-site": "same-site" },
    { origin: "https://www.almarprivatejourney.com", "sec-fetch-site": "same-site" },
  ]) {
    const { calls, deps: d } = deps();
    const res = await handlePreferences(bare(headers), d);
    assert.equal(res.status, 403, JSON.stringify(headers));
    const body = await res.json();
    assert.equal(body.error.code, "wrong_origin");
    assert.equal(calls.session, 0);
    assert.equal(calls.save.length, 0);
  }
});

test("a forged matching Origin with Sec-Fetch-Site cross-site is refused", async () => {
  const { calls, deps: d } = deps();
  const res = await handlePreferences(bare({ origin: SITE, "sec-fetch-site": "cross-site" }), d);
  assert.equal(res.status, 403);
  assert.equal(calls.session, 0);
});

test("Origin: null (a no-referrer page) is accepted only with Sec-Fetch-Site: same-origin", async () => {
  const ok = deps();
  assert.equal((await handlePreferences(bare({ origin: "null", "sec-fetch-site": "same-origin" }), ok.deps)).status, 204);
  assert.equal(ok.calls.save.length, 1);

  for (const headers of [{ origin: "null" }, { origin: "null", "sec-fetch-site": "cross-site" }, { origin: "null", "sec-fetch-site": "none" }]) {
    const { calls, deps: d } = deps();
    assert.equal((await handlePreferences(bare(headers), d)).status, 403, JSON.stringify(headers));
    assert.equal(calls.session, 0);
  }
});

test("no Origin: accepted only with Sec-Fetch-Site: same-origin; neither header is a refusal", async () => {
  assert.equal((await handlePreferences(bare({ "sec-fetch-site": "same-origin" }), deps().deps)).status, 204);
  assert.equal((await handlePreferences(bare({}), deps().deps)).status, 403);
});

test("a host this endpoint does not serve is refused even when Origin matches it", async () => {
  for (const host of ["dashboard.almarprivatejourney.com", "evil.example", "almar.pages.dev", ""]) {
    const res = await handlePreferences(bare({ host, origin: `https://${host}`, "sec-fetch-site": "same-origin" }), deps().deps);
    assert.equal(res.status, 403, host);
  }
});

test("checkPreferencesOrigin: www and preview are their own origins; localhost only outside production", () => {
  const check = (origin, fetchSite, host, nodeEnv = "production") => checkPreferencesOrigin({ origin, fetchSite, host, nodeEnv });
  assert.equal(check("https://www.almarprivatejourney.com", "same-origin", "www.almarprivatejourney.com"), true);
  assert.equal(check("https://preview.almarprivatejourney.com", "same-origin", "preview.almarprivatejourney.com"), true);
  assert.equal(check("https://almarprivatejourney.com", "same-origin", "www.almarprivatejourney.com"), false);
  assert.equal(check("http://127.0.0.1:3010", "same-origin", "127.0.0.1:3010"), false);
  assert.equal(check("http://127.0.0.1:3010", "same-origin", "127.0.0.1:3010", "development"), true);
  assert.equal(check("http://127.0.0.1:3011", "same-origin", "127.0.0.1:3010", "development"), false);
  assert.equal(check("http://localhost:3010", undefined, "localhost:3010", "development"), true);
});

test("type, size and JSON are checked before the session", async () => {
  const cases = [
    [post("locale=ar", { "content-type": "application/x-www-form-urlencoded" }), 415],
    [post("{", {}), 400],
    [post(JSON.stringify({ locale: "ar", pad: "x".repeat(PREFERENCES_BODY_LIMIT) })), 413],
    [post({ locale: "fr" }), 400],
    [post({ currency: "GBP" }), 400],
    [post({ locale: "ar", role: "owner" }), 400],
    [post({}), 400],
    [post([]), 400],
  ];
  for (const [request, status] of cases) {
    const { calls, deps: d } = deps();
    const res = await handlePreferences(request, d);
    assert.equal(res.status, status);
    assert.equal(calls.session, 0);
  }
});

test("no session cookie: 204 without asking Supabase; no user or no Supabase: 204, nothing saved", async () => {
  const noCookie = deps({ cookie: false });
  assert.equal((await handlePreferences(post({ locale: "es" }), noCookie.deps)).status, 204);
  assert.equal(noCookie.calls.session, 0);

  const noUser = deps({ user: false });
  assert.equal((await handlePreferences(post({ locale: "es" }), noUser.deps)).status, 204);
  assert.equal(noUser.calls.session, 1);
  assert.equal(noUser.calls.save.length, 0);
});

test("a failed save or a thrown session is 503 with nothing from the request or the error in the reply", async () => {
  for (const options of [{ saved: false }, { throws: true }]) {
    const { deps: d } = deps(options);
    const original = console.error;
    console.error = () => undefined;
    try {
      const res = await handlePreferences(post({ locale: "ar", currency: "USD" }), d);
      assert.equal(res.status, 503);
      const text = await res.text();
      assert.equal(JSON.parse(text).error.code, "unavailable");
      for (const leak of ["ar", "USD", "supabase"]) assert.ok(!text.includes(`"${leak}"`) && !text.includes(leak + " "), text);
    } finally {
      console.error = original;
    }
  }
});

test("no reply echoes the request body", async () => {
  const marker = "zz-marker-zz";
  for (const body of [{ locale: marker }, { currency: marker }, { [marker]: "ar" }]) {
    const res = await handlePreferences(post(body), deps().deps);
    assert.ok(!(await res.text()).includes(marker));
  }
  const cross = await handlePreferences(bare({ origin: "https://evil.example" }, { locale: marker }), deps().deps);
  assert.ok(!(await cross.text()).includes(marker));
});

test("saveOwnPreferences: updates only the given user's row, only locale/currency, true for exactly one row", async () => {
  const seen = [];
  const client = (rows) => ({
    from(table) {
      return {
        update(values) {
          return {
            eq(column, value) {
              seen.push({ table, values, column, value });
              return { select: async () => ({ data: rows, error: null }) };
            },
          };
        },
      };
    },
  });
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(await saveOwnPreferences(client([{ id }]), id, { locale: "ar", role: "owner" }), true);
  assert.deepEqual(seen[0], { table: "profiles", values: { locale: "ar" }, column: "id", value: id });
  assert.equal(await saveOwnPreferences(client([]), id, { currency: "EUR" }), false, "zero rows is not saved");
  const failing = { from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: null, error: { code: "42501" } }) }) }) }) };
  assert.equal(await saveOwnPreferences(failing, id, { currency: "EUR" }), false);
});

test("source guard: the route uses her session client only, the core has no Next import", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const route = strip(readFileSync("app/api/preferences/route.ts", "utf8"));
  const coreSource = strip(readFileSync("lib/preferences-route.ts", "utf8"));
  assert.match(route, /createSupabaseServer\(\)/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.doesNotMatch(route, /createSupabaseAdmin|SERVICE_ROLE|service_role/);
  assert.doesNotMatch(coreSource, /createSupabaseAdmin|SERVICE_ROLE|service_role/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(route, /export (async )?function (GET|PUT|DELETE|PATCH)/);
  assert.doesNotMatch(coreSource, /from "next\//);
});

test("source guard: callers fire and forget; login and account selects do not call the endpoint", () => {
  const sync = readFileSync("components/site/account-sync.ts", "utf8");
  assert.match(sync, /keepalive: true/);
  assert.match(sync, /referrerPolicy: "same-origin"/);
  assert.match(sync, /\.catch\(\(\) => undefined\)/);
  const select = readFileSync("components/ui/locale-select.tsx", "utf8");
  const follow = select.slice(select.indexOf("if (hrefs) {"), select.indexOf("window.location.assign(target)"));
  assert.match(follow, /postPreferences\(\{ locale: next \}\)/, "posted only on the public (hrefs) path, before navigating");
  assert.doesNotMatch(select, /await postPreferences/);
  assert.equal((select.match(/postPreferences\(/g) ?? []).length, 1);
  const provider = readFileSync("components/pages/home/currency-choice.tsx", "utf8");
  assert.match(provider, /postPreferences\(\{ currency: checked \}\)/);
});

test("source guard: the sign-in sets the hint to \"1\" on the public host only; both sign-outs clear it", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const confirm = strip(readFileSync("app/auth/confirm/actions.ts", "utf8"));
  assert.match(confirm, /if \(!ops\) store\.set\(SIGNED_IN_HINT_COOKIE, "1", signedInHintOptions\(process\.env\.NODE_ENV === "production"\)\);/);
  assert.ok(confirm.indexOf("verifyOtp(") < confirm.indexOf("SIGNED_IN_HINT_COOKIE, \"1\""), "set only after a successful verifyOtp");
  assert.equal((confirm.match(/SIGNED_IN_HINT_COOKIE, "/g) ?? []).length, 1, "the only value ever written is 1");
  const signOut = strip(readFileSync("app/auth/sign-out/route.ts", "utf8"));
  assert.match(signOut, /response\.cookies\.set\(SIGNED_IN_HINT_COOKIE, "", signedInHintOptions\([^)]*, 0\)\)/);
  const everywhere = strip(readFileSync("app/dashboard/actions.ts", "utf8"));
  const body = everywhere.slice(everywhere.indexOf("export async function signOutEverywhere"));
  assert.match(body, /\.set\(SIGNED_IN_HINT_COOKIE, "", signedInHintOptions\([^)]*, 0\)\)/);
});

test("source guard: postPreferences sends nothing without the hint, before any fetch", () => {
  const sync = readFileSync("components/site/account-sync.ts", "utf8");
  const fn = sync.slice(sync.indexOf("export function postPreferences"));
  assert.ok(fn.indexOf("if (!hasSignedInHint()) return;") >= 0);
  assert.ok(fn.indexOf("if (!hasSignedInHint()) return;") < fn.indexOf("fetch("));
});
