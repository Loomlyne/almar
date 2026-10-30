// Plan 06-07 Task 3: GET, POST and DELETE /api/saved-stays with fake deps. Order on a write: method -> Origin -> type and size -> JSON
// -> slug -> session. Plus source checks of the route file, the Supabase binding and the login page. Written, not run (owner rule
// 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { handleSavedStays, SAVED_STAYS_BODY_LIMIT } = await loadTs("lib/saved-stays/route.ts");

const SITE = "https://almarprivatejourney.com";
const HOST = "almarprivatejourney.com";
const SAME = { origin: SITE, "sec-fetch-site": "same-origin", host: HOST };

const get = () => new Request(`${SITE}/api/saved-stays`, { headers: { host: HOST } });
const post = (body, headers = {}) =>
  new Request(`${SITE}/api/saved-stays`, {
    method: "POST",
    headers: { "content-type": "application/json", ...SAME, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const del = (query = "?stay=casa-loma", headers = {}) => new Request(`${SITE}/api/saved-stays${query}`, { method: "DELETE", headers: { ...SAME, ...headers } });

function deps({ cookie = true, user = true, throws = false, saveAnswer = "saved", stays = ["casa-loma"] } = {}) {
  const calls = { session: 0, list: 0, save: [], remove: [] };
  const fail = () => {
    throw new Error("supabase down casa-loma 00000000-user");
  };
  return {
    calls,
    deps: {
      nodeEnv: "production",
      hasSessionCookie: cookie,
      session: async () => {
        calls.session += 1;
        if (!user) return null;
        return {
          list: async () => {
            calls.list += 1;
            if (throws) fail();
            return stays;
          },
          save: async (slug) => {
            calls.save.push(slug);
            if (throws) fail();
            return saveAnswer;
          },
          remove: async (slug) => {
            calls.remove.push(slug);
            if (throws) fail();
          },
        };
      },
    },
  };
}

async function quietly(run) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    return { result: await run(), logged };
  } finally {
    console.error = original;
  }
}

const code = async (res) => (await res.json()).error.code;

test("GET without an auth cookie: 200 signedIn false, the session is never asked", async () => {
  const { calls, deps: d } = deps({ cookie: false });
  const res = await handleSavedStays(get(), d);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, signedIn: false });
  assert.equal(calls.session, 0);
});

test("GET with a cookie and no user: 200 signedIn false, never a 401", async () => {
  const res = await handleSavedStays(get(), deps({ user: false }).deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, signedIn: false });
});

test("GET with a user: 200 with her slugs, in the order the session gave", async () => {
  const res = await handleSavedStays(get(), deps({ stays: ["b-stay", "a-stay"] }).deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, signedIn: true, stays: ["b-stay", "a-stay"] });
});

test("GET when the list throws: 503, and the log names neither a slug nor a user", async () => {
  const { result: res, logged } = await quietly(() => handleSavedStays(get(), deps({ throws: true }).deps));
  assert.equal(res.status, 503);
  assert.equal(await code(res), "unavailable");
  assert.deepEqual(logged, ["[saved-stays] list failed"]);
});

test("every answer is Cache-Control private, no-store", async () => {
  const answers = [
    await handleSavedStays(get(), deps({ cookie: false }).deps),
    await handleSavedStays(get(), deps().deps),
    await handleSavedStays(post({ stay: "casa-loma" }), deps().deps),
    await handleSavedStays(del(), deps().deps),
    await handleSavedStays(post({ stay: "casa-loma" }, { "sec-fetch-site": "cross-site" }), deps().deps),
    await handleSavedStays(post("{"), deps().deps),
    await handleSavedStays(del(), deps({ user: false }).deps),
    (await quietly(() => handleSavedStays(get(), deps({ throws: true }).deps))).result,
  ];
  for (const res of answers) assert.equal(res.headers.get("cache-control"), "private, no-store");
});

test("POST from another site: 403 before the body or the session is touched", async () => {
  for (const headers of [
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    { origin: "https://evil.example" },
    { "sec-fetch-site": "cross-site", origin: "" },
    { origin: "https://almarprivatejourney.com.evil.example" },
    { origin: "https://dashboard.almarprivatejourney.com", "sec-fetch-site": "same-site" },
  ]) {
    const { calls, deps: d } = deps();
    const request = post({ stay: "casa-loma" }, headers);
    const res = await handleSavedStays(request, d);
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.equal(await code(res), "wrong_origin");
    assert.equal(calls.session, 0);
    assert.equal(request.bodyUsed, false, "the body was never read");
  }
});

test("POST with no Origin and no Sec-Fetch-Site is refused", async () => {
  const request = new Request(`${SITE}/api/saved-stays`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST },
    body: JSON.stringify({ stay: "casa-loma" }),
  });
  assert.equal((await handleSavedStays(request, deps().deps)).status, 403);
});

test("POST with a bad body: 400 invalid, and the session is never asked", async () => {
  const big = JSON.stringify({ stay: "x".repeat(SAVED_STAYS_BODY_LIMIT) });
  const bodies = [
    post({ stay: "casa-loma" }, { "content-type": "text/plain" }),
    post({ stay: "casa-loma" }, { "content-type": "application/x-www-form-urlencoded" }),
    post(big),
    post("{"),
    post("null"),
    post([]),
    post({}),
    post({ stay: "casa-loma", user_id: "someone-else" }),
    post({ stay: "Casa/Loma" }),
    post({ stay: 7 }),
  ];
  assert.equal(SAVED_STAYS_BODY_LIMIT, 256);
  for (const request of bodies) {
    const { calls, deps: d } = deps();
    const res = await handleSavedStays(request, d);
    assert.equal(res.status, 400);
    assert.equal(await code(res), "invalid");
    assert.equal(calls.session, 0);
  }
});

test("POST with no user: 401 signed_out, with or without a cookie", async () => {
  for (const options of [{ user: false }, { cookie: false }]) {
    const res = await handleSavedStays(post({ stay: "casa-loma" }), deps(options).deps);
    assert.equal(res.status, 401);
    assert.equal(await code(res), "signed_out");
  }
});

test("POST of a stay that is not published: 404 not_found", async () => {
  const res = await handleSavedStays(post({ stay: "casa-loma" }), deps({ saveAnswer: "not_found" }).deps);
  assert.equal(res.status, 404);
  assert.equal(await code(res), "not_found");
});

test("POST saved: 200 saved true, and a second save answers the same", async () => {
  const { calls, deps: d } = deps();
  for (let round = 0; round < 2; round += 1) {
    const res = await handleSavedStays(post({ stay: "casa-loma" }), d);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, saved: true });
  }
  assert.deepEqual(calls.save, ["casa-loma", "casa-loma"]);
});

test("POST when the save throws: 503, and the log names neither a slug nor a user", async () => {
  const { result: res, logged } = await quietly(() => handleSavedStays(post({ stay: "casa-loma" }), deps({ throws: true }).deps));
  assert.equal(res.status, 503);
  assert.deepEqual(logged, ["[saved-stays] write failed"]);
});

test("DELETE: the same Origin rule, a good slug, a user; then 200 saved false", async () => {
  const cross = deps();
  assert.equal((await handleSavedStays(del("?stay=casa-loma", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }), cross.deps)).status, 403);
  assert.equal(cross.calls.session, 0);

  for (const query of ["", "?stay=", "?stay=Casa", "?stay=a%2Fb", "?stay=..", "?other=casa-loma"]) {
    const bad = deps();
    const res = await handleSavedStays(del(query), bad.deps);
    assert.equal(res.status, 400, query);
    assert.equal(bad.calls.session, 0);
  }

  assert.equal((await handleSavedStays(del(), deps({ user: false }).deps)).status, 401);

  const good = deps();
  const res = await handleSavedStays(del(), good.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, saved: false });
  assert.deepEqual(good.calls.remove, ["casa-loma"]);
});

test("any other method is refused", async () => {
  const res = await handleSavedStays(new Request(`${SITE}/api/saved-stays`, { method: "PUT", headers: SAME, body: "{}" }), deps().deps);
  assert.equal(res.status, 405);
});

test("the route file: three methods, force-dynamic, getUser, and no service role", () => {
  const route = readFileSync("app/api/saved-stays/route.ts", "utf8");
  for (const method of ["GET", "POST", "DELETE"]) assert.match(route, new RegExp(`export async function ${method}\\(`));
  assert.match(route, /export const dynamic = "force-dynamic";/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.equal(/getSession\(\)/.test(route), false);
  for (const file of ["app/api/saved-stays/route.ts", "lib/saved-stays/route.ts", "lib/saved-stays/server.ts", "lib/saved-stays/rules.ts"]) {
    const text = readFileSync(file, "utf8");
    assert.equal(/createSupabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/.test(text), false, file);
  }
});

test("the handler module imports neither next nor supabase, and checks the Origin with the rule of /api/preferences", () => {
  const core = readFileSync("lib/saved-stays/route.ts", "utf8");
  assert.equal(/from "(?:next|@supabase)/.test(core), false);
  assert.match(core, /checkPreferencesOrigin\(/);
});

test("the binding reads her rows through her session and the stays through the published views only", () => {
  const server = readFileSync("lib/saved-stays/server.ts", "utf8");
  assert.match(server, /supabase\s*\.from\("saved_stays"\)|supabase\.from\("saved_stays"\)/);
  assert.equal(/anon\s*\.from\("saved_stays"\)/.test(server), false, "the anon client never reads saved_stays");
  assert.equal(/\.from\("stays"\)/.test(server), false, "never the stays table");
  assert.equal(/loadSource|readSource/.test(server), false, "no build-time read at request time");
  assert.match(server, /ignoreDuplicates: true/);
});

test("the login page: return=stay goes through the slug rule, the other keys are unchanged", () => {
  const page = readFileSync("app/[locale]/login/page.tsx", "utf8");
  assert.match(page, /key === "stay" \? stayReturnPath\(locale, query\.stay\) : null/);
  assert.match(page, /stayPath \?\? \(Object\.hasOwn\(RETURN_KEYS, key\)/);
  assert.match(page, /const RETURN_KEYS: Record<string, string> = \{ account: "\/account", bookings: "\/bookings" \};/);
  assert.match(page, /localizedReturnPath\(safeReturnPath\(store\.get\(returnCookieName\(\)\)\?\.value\), locale\)/);
  assert.match(page, /stay\?: string/);
});

test("Account: the page reads her cards through her session and survives a failed read; the screen removes, never toggles", () => {
  const page = readFileSync("app/[locale]/account/page.tsx", "utf8");
  assert.match(page, /savedStayCards\(supabase, anon, locale\)/);
  assert.match(page, /catch \{\s*console\.error\("\[saved-stays\] account read failed"\);\s*return \[\];/);
  assert.equal(/createSupabaseAdmin/.test(page), false);
  const screen = readFileSync("app/[locale]/account/account-screen.tsx", "utf8");
  assert.match(screen, /await setSaved\(slug, false\)/);
  assert.equal(/\btoggle\(/.test(screen.replace(/^\s*\/\/.*$/gm, "")), false);
  assert.match(screen, /href="#saved"/);
  const list = readFileSync("components/site/saved-stays-list.tsx", "utf8");
  assert.match(list, /id="saved"/);
  assert.match(list, /role="status"/);
});
