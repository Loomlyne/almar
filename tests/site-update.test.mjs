// Plan 03.2-05 Task 2: the hook request and the status read, with a fake service-role client and a fake fetch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { hookTarget, requestPublish, requestSiteUpdate, siteStatus, readLiveVersion, parseSiteUpdate, LIVE_VERSION_URL } = await loadTs("lib/ops/site-update.ts");

const HOOK = "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc123";
const NOW = new Date("2026-10-13T10:05:00.000Z");

/** A fake admin client holding the site_publish row; records every rpc. */
function fakeAdmin(over = {}) {
  const row = { requested_seq: 4, requested_at: null, last_hook_at: null, last_hook_result: null, last_build_uuid: null };
  const calls = [];
  const fail = over.fail ?? {};
  return {
    row,
    calls,
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      if (fail[fn]) return { data: null, error: { code: "XX000", message: "boom" } };
      if (fn === "site_request_update") {
        row.requested_seq += 1;
        row.requested_at = NOW.toISOString();
        return { data: { requested_seq: row.requested_seq, requested_at: row.requested_at }, error: null };
      }
      if (fn === "site_record_hook") {
        row.last_hook_at = NOW.toISOString();
        row.last_hook_result = args.p_result;
        row.last_build_uuid = args.p_build_uuid;
        return { data: null, error: null };
      }
      if (fn === "site_publish_state") return { data: { id: 1, ...row }, error: null };
      throw new Error(`unexpected rpc ${fn}`);
    },
  };
}

/** A fake fetch: the hook answers `hook`, the live site answers `live`. */
function fakeFetch({ hook = () => Response.json({ success: true, result: { build_uuid: "b-1" } }), live = () => Response.json({ seq: 4, built_at: "2026-10-13T09:00:00.000Z" }) } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", cache: init.cache, headers: init.headers, body: init.body, redirect: init.redirect });
    if (String(url) === LIVE_VERSION_URL) return live();
    if (String(url).startsWith("https://api.cloudflare.com/")) return hook();
    throw new Error(`unexpected fetch ${url}`);
  };
  fn.calls = calls;
  return fn;
}

const deps = (fetchImpl, hookUrl = HOOK) => ({ fetchImpl, hookUrl, now: () => NOW });

test("requestSiteUpdate: bumps the sequence, POSTs the hook once (no body, no auth), records ok, returns updating", async () => {
  const admin = fakeAdmin();
  const fetchImpl = fakeFetch();
  const site = await requestSiteUpdate(admin, deps(fetchImpl));
  assert.deepEqual(admin.calls.map((c) => c[0]), ["site_request_update", "site_record_hook", "site_publish_state"]);
  assert.deepEqual(admin.calls[1][1], { p_result: "ok", p_build_uuid: "b-1" });
  const hookCalls = fetchImpl.calls.filter((c) => c.url === HOOK);
  assert.equal(hookCalls.length, 1);
  assert.equal(hookCalls[0].method, "POST");
  assert.equal(hookCalls[0].body, undefined);
  assert.equal(hookCalls[0].headers, undefined, "no Authorization header: the URL is the credential");
  assert.equal(site.state, "updating");
  assert.equal(site.requested_seq, 5);
  assert.equal(site.live_seq, 4);
});

test("a hook answer with already_exists is recorded as already_exists (top level or under result)", async () => {
  for (const body of [{ already_exists: true }, { result: { already_exists: true, build_uuid: "b-2" } }]) {
    const admin = fakeAdmin();
    const site = await requestSiteUpdate(admin, deps(fakeFetch({ hook: () => Response.json(body) })));
    assert.equal(admin.calls[1][1].p_result, "already_exists");
    assert.equal(site.state, "updating");
  }
});

test("any 2xx is ok, even with a body that is not JSON", async () => {
  const admin = fakeAdmin();
  await requestSiteUpdate(admin, deps(fakeFetch({ hook: () => new Response("accepted", { status: 202 }) })));
  assert.deepEqual(admin.calls[1][1], { p_result: "ok", p_build_uuid: null });
});

test("hook 503: records error:503 and returns failed at once", async () => {
  const admin = fakeAdmin();
  const site = await requestSiteUpdate(admin, deps(fakeFetch({ hook: () => new Response("no", { status: 503 }) })));
  assert.equal(admin.calls[1][1].p_result, "error:503");
  assert.equal(site.state, "failed");
});

test("hook unreachable: error:network, failed; never throws into the save", async () => {
  const admin = fakeAdmin();
  const site = await requestSiteUpdate(
    admin,
    deps(
      fakeFetch({
        hook: () => {
          throw new TypeError("fetch failed");
        },
      }),
    ),
  );
  assert.equal(admin.calls[1][1].p_result, "error:network");
  assert.equal(site.state, "failed");
});

test("missing PUBLISH_DEPLOY_HOOK_URL: records error:no_hook, returns failed, makes no hook call", async () => {
  for (const hookUrl of [null, "", "  "]) {
    const admin = fakeAdmin();
    const fetchImpl = fakeFetch();
    const site = await requestSiteUpdate(admin, deps(fetchImpl, hookUrl));
    assert.equal(admin.calls[1][1].p_result, "error:no_hook");
    assert.equal(site.state, "failed");
    assert.equal(fetchImpl.calls.some((c) => c.method === "POST"), false);
  }
});

test("a hook URL that is not a Cloudflare deploy hook is never called (error:bad_hook)", async () => {
  const admin = fakeAdmin();
  const fetchImpl = fakeFetch();
  await requestSiteUpdate(admin, deps(fetchImpl, "https://evil.example/deploy_hooks/x"));
  assert.equal(admin.calls[1][1].p_result, "error:bad_hook");
  assert.equal(fetchImpl.calls.some((c) => c.method === "POST"), false);
});

test("the bump fails: requestSiteUpdate throws (runOps attaches a failed status); the hook is never called", async () => {
  const admin = fakeAdmin({ fail: { site_request_update: true } });
  const fetchImpl = fakeFetch();
  await assert.rejects(requestSiteUpdate(admin, deps(fetchImpl)), { name: "SiteStateError" });
  assert.equal(fetchImpl.calls.length, 0);
});

test("the record fails: the reply still says what the hook call did", async () => {
  const admin = fakeAdmin({ fail: { site_record_hook: true } });
  const site = await requestSiteUpdate(admin, deps(fakeFetch({ hook: () => new Response("", { status: 500 }) })));
  assert.equal(site.state, "failed");
  assert.equal(site.last_hook_result, "error:500");
});

test("siteStatus: database request vs the live sequence; no hook call, no bump", async () => {
  const admin = fakeAdmin();
  admin.row.requested_seq = 4;
  const fetchImpl = fakeFetch();
  const site = await siteStatus(admin, deps(fetchImpl));
  assert.equal(site.state, "up_to_date");
  assert.equal(site.built_at, "2026-10-13T09:00:00.000Z");
  assert.deepEqual(admin.calls.map((c) => c[0]), ["site_publish_state"]);
  assert.deepEqual(fetchImpl.calls.map((c) => [c.url, c.method, c.cache]), [[LIVE_VERSION_URL, "GET", "no-store"]]);
});

test("siteStatus: the state read fails -> throws (the route answers 503 unavailable)", async () => {
  await assert.rejects(siteStatus(fakeAdmin({ fail: { site_publish_state: true } }), deps(fakeFetch())), { name: "SiteStateError" });
});

test("readLiveVersion: 404 is seq 0; 500, a non-JSON body, a bad seq and a network error are null", async () => {
  const live = (fn) => readLiveVersion(fakeFetch({ live: fn }));
  assert.deepEqual(await live(() => new Response("", { status: 404 })), { seq: 0, built_at: null });
  assert.equal(await live(() => new Response("", { status: 500 })), null);
  assert.equal(await live(() => new Response("<html>", { status: 200 })), null);
  assert.equal(await live(() => Response.json({ seq: -1 })), null);
  assert.equal(await live(() => Response.json({ seq: "x" })), null);
  assert.equal(
    await live(() => {
      throw new TypeError("fetch failed");
    }),
    null,
  );
  assert.deepEqual(await live(() => Response.json({ seq: 9, built_at: "2026-10-13T09:00:00.000Z", commit: "abc" })), {
    seq: 9,
    built_at: "2026-10-13T09:00:00.000Z",
  });
  assert.equal(LIVE_VERSION_URL, "https://almarprivatejourney.com/site-version.json");
});

test("parseSiteUpdate accepts only {}", () => {
  assert.deepEqual(parseSiteUpdate({}), {});
  for (const bad of [null, [], "x", 1, { force: true }]) {
    assert.throws(() => parseSiteUpdate(bad), { name: "OpsInvalid" });
  }
});

test("source: the hook URL is read only in lib/ops/site-update.ts, never logged or put in a reply", () => {
  const src = readFileSync("lib/ops/site-update.ts", "utf8");
  assert.match(src, /process\.env\.PUBLISH_DEPLOY_HOOK_URL/);
  assert.equal(/console\./.test(src), false, "site-update.ts never logs");
  for (const file of ["lib/ops/route.ts", "lib/ops/route-core.ts", "lib/ops/site-status.ts", "app/api/ops/site-status/route.ts", "app/api/ops/site-update/route.ts"]) {
    assert.equal(readFileSync(file, "utf8").includes("PUBLISH_DEPLOY_HOOK_URL"), false, file);
  }
});

test("requestPublish({ admin }) is the stable entry point for 02-06: one bump, one hook call (no hook set here: error:no_hook)", async () => {
  const saved = process.env.PUBLISH_DEPLOY_HOOK_URL;
  delete process.env.PUBLISH_DEPLOY_HOOK_URL;
  try {
    const admin = fakeAdmin();
    const site = await requestPublish({ admin });
    assert.deepEqual(admin.calls.map((c) => c[0]), ["site_request_update", "site_record_hook", "site_publish_state"]);
    assert.equal(admin.calls[1][1].p_result, "error:no_hook");
    assert.equal(site.state, "failed");
  } finally {
    if (saved !== undefined) process.env.PUBLISH_DEPLOY_HOOK_URL = saved;
  }
});

test("hookTarget: only https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<id>, nothing near it (review finding 9)", () => {
  assert.equal(hookTarget(HOOK), HOOK);
  for (const bad of [
    "http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc",
    "https://api.cloudflare.com.evil.example/client/v4/workers/builds/deploy_hooks/abc",
    "https://api.cloudflare.com:8443/client/v4/workers/builds/deploy_hooks/abc",
    "https://user:pw@api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/../../accounts/x",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/%2e%2e/x",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc?x=1",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/abc#x",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/",
    "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/a/b",
    "not a url",
  ]) {
    assert.equal(hookTarget(bad), null, bad);
  }
});

test("the hook POST never follows a redirect; a 3xx is recorded as an error", async () => {
  const admin = fakeAdmin();
  const fetchImpl = fakeFetch({ hook: () => new Response(null, { status: 302, headers: { location: "https://elsewhere.example/" } }) });
  const site = await requestSiteUpdate(admin, deps(fetchImpl));
  assert.equal(fetchImpl.calls.find((c) => c.method === "POST").redirect, "manual");
  assert.equal(admin.calls[1][1].p_result, "error:302");
  assert.equal(site.state, "failed");
});
