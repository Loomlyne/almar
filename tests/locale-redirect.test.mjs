import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LEGACY_SECTIONS, ROOT_LOCALE_COOKIE, ROOT_REDIRECT_HEADERS, legacyLocaleTarget, rootLocaleTarget } from "../lib/locale-redirect.ts";
import { handle } from "../worker/handle.mjs";
import { matchRedirect, readRedirects, redirectTarget } from "./helpers/site-links.mjs";

// Job 21 (owner, 2026-10-21, decisions #7 and #13): "/" is the language redirect, every old unprefixed page is a 301 to
// its /en/ address. lib/locale-redirect.ts is the rule; worker/handle.mjs and middleware.ts apply it, and
// public/_redirects holds the same list for the asset layer. No build and no wrangler here.

// ---- rootLocaleTarget -------------------------------------------------------------------------------------------

test("rootLocaleTarget: no cookie, or no almar-locale among the cookies, is /en/", () => {
  assert.equal(rootLocaleTarget(null), "/en/");
  assert.equal(rootLocaleTarget(undefined), "/en/");
  assert.equal(rootLocaleTarget(""), "/en/");
  assert.equal(rootLocaleTarget("theme=dark; sb-x-auth-token=abc"), "/en/");
});

test("rootLocaleTarget: almar-locale ar, es and en go to their own home", () => {
  assert.equal(ROOT_LOCALE_COOKIE, "almar-locale");
  assert.equal(rootLocaleTarget("almar-locale=ar"), "/ar/");
  assert.equal(rootLocaleTarget("almar-locale=es"), "/es/");
  assert.equal(rootLocaleTarget("almar-locale=en"), "/en/");
});

test("rootLocaleTarget: other cookies around it do not matter", () => {
  assert.equal(rootLocaleTarget("theme=dark; almar-locale=ar"), "/ar/");
  assert.equal(rootLocaleTarget("almar-locale=es; theme=dark"), "/es/");
  assert.equal(rootLocaleTarget("a=1; almar-locale=ar; b=2"), "/ar/");
  assert.equal(rootLocaleTarget("almar-locale=ar;theme=dark"), "/ar/");
  assert.equal(rootLocaleTarget("almar-locale=ar ; theme=dark"), "/ar/");
});

test("rootLocaleTarget: anything but exactly en, ar or es is /en/, and a look-alike cookie name is not the cookie", () => {
  for (const value of ["fr", "AR", "ar/", "ar%2F", " ", "", "../ar", "ar,es", "arabic", "//evil.example"]) {
    assert.equal(rootLocaleTarget(`almar-locale=${value}`), "/en/", JSON.stringify(value));
  }
  assert.equal(rootLocaleTarget("x-almar-locale=ar"), "/en/");
  assert.equal(rootLocaleTarget("almar-locale-old=ar"), "/en/");
  assert.equal(rootLocaleTarget("almar-localex=ar"), "/en/");
  // The first almar-locale wins; it never reads a language from anything but the cookie.
  assert.equal(rootLocaleTarget("almar-locale=es; almar-locale=ar"), "/es/");
});

test("ROOT_REDIRECT_HEADERS: private, no-store, varies on Cookie, noindex", () => {
  assert.deepEqual({ ...ROOT_REDIRECT_HEADERS }, { "cache-control": "private, no-store", vary: "Cookie", "x-robots-tag": "noindex" });
});

// ---- legacyLocaleTarget -----------------------------------------------------------------------------------------

test("legacyLocaleTarget: an old unprefixed page, or anything below it, goes to the same path under /en", () => {
  assert.equal(legacyLocaleTarget("/about"), "/en/about");
  assert.equal(legacyLocaleTarget("/contact"), "/en/contact");
  assert.equal(legacyLocaleTarget("/destinations"), "/en/destinations");
  assert.equal(legacyLocaleTarget("/experiences"), "/en/experiences");
  assert.equal(legacyLocaleTarget("/private-stays"), "/en/private-stays");
  assert.equal(legacyLocaleTarget("/private-stays/getsemani-colonial-house"), "/en/private-stays/getsemani-colonial-house");
  assert.equal(legacyLocaleTarget("/blog"), "/en/blog");
  assert.equal(legacyLocaleTarget("/blog/some-post"), "/en/blog/some-post");
  assert.equal(legacyLocaleTarget("/login"), "/en/login");
  assert.equal(legacyLocaleTarget("/account"), "/en/account");
  assert.equal(legacyLocaleTarget("/bookings"), "/en/bookings");
  assert.equal(legacyLocaleTarget("/bookings/abc"), "/en/bookings/abc");
});

test("legacyLocaleTarget: a trailing slash is dropped", () => {
  assert.equal(legacyLocaleTarget("/about/"), "/en/about");
  assert.equal(legacyLocaleTarget("/private-stays/"), "/en/private-stays");
  assert.equal(legacyLocaleTarget("/blog/some-post/"), "/en/blog/some-post");
  assert.equal(legacyLocaleTarget("/about//"), "/en/about");
});

test("legacyLocaleTarget: null for \"/\", prefixed pages, API, auth, held and near-miss paths", () => {
  for (const path of [
    "/",
    "/en/",
    "/en/about",
    "/ar/about",
    "/es/login",
    "/ar/",
    "/api/health",
    "/auth/confirm",
    "/auth/sign-out",
    "/newsletter",
    "/dashboard",
    "/aboutus",
    "/about-us",
    "/blogger",
    "/loginx",
    "/accounts",
    "/services",
    "/_next/static/x.js",
    "/robots.txt",
    "",
  ]) {
    assert.equal(legacyLocaleTarget(path), null, JSON.stringify(path));
  }
});

test("legacyLocaleTarget: the query and hash are the caller's, and a result never leaves the site", () => {
  for (const section of LEGACY_SECTIONS) {
    for (const path of [section, `${section}/`, `${section}/x`]) {
      const target = legacyLocaleTarget(path);
      assert.ok(target?.startsWith("/en/"), path);
      assert.equal(target.startsWith("//"), false, path);
    }
  }
  assert.equal(legacyLocaleTarget("/about?x=1"), null, "a path with a query is not a pathname: the caller passes the pathname only");
});

// ---- public/_redirects agrees ------------------------------------------------------------------------------------

test("public/_redirects holds a 301 to /en/<section> for every legacy section, with and without a trailing slash", () => {
  const { rules, errors } = readRedirects();
  assert.deepEqual(errors, []);
  for (const section of LEGACY_SECTIONS) {
    for (const from of [section, `${section}/`]) {
      const rule = rules.find((r) => r.from === from);
      assert.ok(rule, `${from} has a rule`);
      assert.equal(rule.status, 301, from);
      assert.equal(rule.to, `/en${section}`, from);
    }
  }
});

test("public/_redirects: the rules that carry the rest of the path name legacy sections, and agree with legacyLocaleTarget", () => {
  const { rules } = readRedirects();
  const carrying = rules.filter((r) => r.splat && r.splatTo && r.to.startsWith("/en/"));
  assert.deepEqual(carrying.map((r) => r.from).sort(), ["/blog/*", "/bookings/*", "/private-stays/*"]);
  for (const rule of carrying) {
    const section = rule.from.slice(0, -2);
    assert.ok(LEGACY_SECTIONS.includes(section), `${section} is a legacy section`);
    for (const path of [`${section}/some-page`, `${section}/a/b`]) {
      const matched = matchRedirect(rules, path);
      assert.equal(matched, rule, path);
      assert.equal(redirectTarget(matched, path), legacyLocaleTarget(path), path);
    }
  }
});

test("public/_redirects: every redirect to /en/ is for a legacy section or the folded /services pages, and \"/\" has none", () => {
  const { rules } = readRedirects();
  assert.equal(rules.some((r) => r.from === "/"), false, "\"/\" depends on a cookie: only the Worker answers it");
  for (const rule of rules) {
    if (rule.from.startsWith("/services")) continue;
    const section = rule.from.replace(/\/\*?$/, "");
    assert.ok(LEGACY_SECTIONS.includes(section), `${rule.from} is a legacy section`);
  }
});

// ---- worker/handle.mjs, rootRedirect ----------------------------------------------------------------------------

function harness({ rootRedirect, serverPaths = ["/api/health", "/en/login"] } = {}) {
  const calls = { assets: [], next: [] };
  const env = {
    ASSETS: {
      fetch: async (request) => {
        calls.assets.push(`${request.method} ${new URL(request.url).pathname}`);
        return new Response("asset", { status: 404, headers: { etag: '"a"' } });
      },
    },
  };
  const nextFetch = async (request) => {
    calls.next.push(new URL(request.url).pathname);
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  };
  const options = { serverPaths: new Set(serverPaths), nextFetch, ...(rootRedirect === undefined ? {} : { rootRedirect }) };
  const run = (url, init) => handle(new Request(`https://almarprivatejourney.com${url}`, init), env, { id: "ctx" }, options);
  return { calls, run };
}

test("handle with rootRedirect: GET / with the almar-locale cookie is a 302 to that language's home, query kept", async () => {
  const { calls, run } = harness({ rootRedirect: true });
  const res = await run("/?q=1", { headers: { cookie: "theme=dark; almar-locale=ar" } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/ar/?q=1");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("vary"), "Cookie");
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(await res.text(), "");
  assert.deepEqual(calls, { assets: [], next: [] }, "neither the asset layer nor Next ran");
});

test("handle with rootRedirect: no cookie, an unknown cookie value and es", async () => {
  const { calls, run } = harness({ rootRedirect: true });
  assert.equal((await run("/")).headers.get("location"), "/en/");
  assert.equal((await run("/", { headers: { cookie: "almar-locale=fr" } })).headers.get("location"), "/en/");
  assert.equal((await run("/", { headers: { cookie: "almar-locale=es" } })).headers.get("location"), "/es/");
  assert.equal((await run("/?a=1&b=2")).headers.get("location"), "/en/?a=1&b=2");
  assert.deepEqual(calls, { assets: [], next: [] });
});

test("handle with rootRedirect: HEAD / is the same 302; POST, PUT and DELETE of / go to the assets", async () => {
  const { calls, run } = harness({ rootRedirect: true });
  const head = await run("/", { method: "HEAD", headers: { cookie: "almar-locale=ar" } });
  assert.equal(head.status, 302);
  assert.equal(head.headers.get("location"), "/ar/");
  for (const method of ["POST", "PUT", "DELETE"]) {
    const res = await run("/", { method, body: method === "DELETE" ? undefined : "a=1" });
    assert.equal(res.status, 404, method);
  }
  assert.deepEqual(calls.assets, ["POST /", "PUT /", "DELETE /"]);
  assert.deepEqual(calls.next, []);
});

test("handle without rootRedirect (the ops Worker, any other caller): \"/\" goes to the assets, whatever the cookie", async () => {
  for (const { run, calls } of [harness(), harness({ rootRedirect: false })]) {
    const res = await run("/?q=1", { headers: { cookie: "almar-locale=ar" } });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("location"), null);
    assert.equal(res.headers.get("etag"), '"a"');
    assert.deepEqual(calls, { assets: ["GET /"], next: [] });
  }
});

test("handle with rootRedirect: an old unprefixed page is a 301 to /en/, query kept (the fallback behind public/_redirects)", async () => {
  const { calls, run } = harness({ rootRedirect: true });
  const res = await run("/about?x=1");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/en/about?x=1");
  const slashed = await run("/private-stays/some-stay/?a=1");
  assert.equal(slashed.status, 301);
  assert.equal(slashed.headers.get("location"), "/en/private-stays/some-stay?a=1");
  const login = await run("/login");
  assert.equal(login.headers.get("location"), "/en/login");
  const head = await run("/about", { method: "HEAD" });
  assert.equal(head.status, 301);
  assert.deepEqual(calls, { assets: [], next: [] });
});

test("handle with rootRedirect: a POST to an old page, a prefixed page and everything else behave as before", async () => {
  const { calls, run } = harness({ rootRedirect: true });
  assert.equal((await run("/about", { method: "POST", body: "a=1" })).status, 404, "a POST is never redirected");
  assert.equal((await run("/en/about")).status, 404, "a prefixed page is the asset layer's");
  assert.equal((await run("/ar/")).status, 404);
  assert.equal((await run("/nope")).status, 404);
  assert.deepEqual(calls.assets, ["POST /about", "GET /en/about", "GET /ar/", "GET /nope"]);
  assert.deepEqual(calls.next, []);
  const api = await run("/api/health");
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("x-robots-tag"), "noindex");
  assert.equal((await run("/en/login")).status, 200);
  assert.deepEqual(calls.next, ["/api/health", "/en/login"]);
});

test("handle without rootRedirect: an old unprefixed page is not redirected by the Worker", async () => {
  const { calls, run } = harness();
  assert.equal((await run("/about")).status, 404);
  assert.deepEqual(calls.assets, ["GET /about"]);
});

test("only worker/almar.mjs turns rootRedirect on (the public and preview Worker); the ops Worker never does", () => {
  assert.match(readFileSync("worker/almar.mjs", "utf8"), /rootRedirect: true/);
  assert.equal(/rootRedirect/.test(readFileSync("worker/almar-ops.mjs", "utf8")), false);
});
