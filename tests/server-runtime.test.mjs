import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { HELD_PATHS, SERVER_PATHS_OUTSIDE_API, serverPathsFrom } from "../lib/server-routes.ts";
import { assembleOut, assertNoBundledEnv, writeServerPaths } from "../scripts/assemble-cloudflare.mjs";
import { handle } from "../worker/handle.mjs";

// Job 10 (plan 02-20): what may run on the server, and the Worker's request router. No build and no wrangler here;
// the built Worker is proven by tests/build/server-runtime.spec.ts.

// ---- serverPathsFrom ------------------------------------------------------------------------------------------

const TODAY = [
  "/_not-found/page",
  "/api/health/route",
  "/about/route",
  "/newsletter/route",
  "/fx/route",
  "/embed/font/[file]/route",
  "/embed/hero-booker/route",
  "/page",
  "/ar/page",
  "/ar/private-stays/[stay]/page",
  "/login/page",
  "/account/page",
  "/dashboard/(ops)/home/page",
  "/__harness/page",
];

test("serverPathsFrom: only the static app/api routes, without the /route suffix", () => {
  assert.deepEqual(serverPathsFrom(TODAY), ["/api/health"]);
  assert.deepEqual(serverPathsFrom(["/api/b/route", "/api/a/b/route", "/api/b/route"]), ["/api/a/b", "/api/b"]);
});

test("serverPathsFrom: pages, Framer routes and held handlers outside /api are ignored", () => {
  assert.deepEqual(serverPathsFrom(["/newsletter/route", "/fx/route", "/embed/hero-booker/route", "/about/route", "/login/page"]), []);
  assert.deepEqual(serverPathsFrom(["/apiary/route"]), []);
});

test("serverPathsFrom: a page under app/api stops the build", () => {
  assert.throws(() => serverPathsFrom(["/api/x/page"]), /\/api\/x\/page/);
});

test("serverPathsFrom: dynamic, catch-all, grouped and parallel segments under /api stop the build", () => {
  for (const key of ["/api/[id]/route", "/api/x/[...rest]/route", "/api/(group)/x/route", "/api/@slot/route"]) {
    assert.throws(() => serverPathsFrom([key]), new RegExp(key.replace(/[[\]().*+?^$|\\]/g, "\\$&")));
  }
});

test("HELD_PATHS is the prompt's nine sections; SERVER_PATHS_OUTSIDE_API is empty in job 10", () => {
  assert.deepEqual([...HELD_PATHS], ["/dashboard", "/account", "/login", "/booking", "/bookings", "/fx", "/newsletter", "/embed", "/__harness"]);
  assert.deepEqual([...SERVER_PATHS_OUTSIDE_API], []);
});

test("serverPathsFrom: an extra path outside /api is added; one under a held section stops the build", () => {
  assert.deepEqual(serverPathsFrom(TODAY, ["/subscribe"]), ["/api/health", "/subscribe"]);
  for (const held of ["/newsletter", "/login", "/dashboard/home", "/booking/trip", "/ar/login", "/es/dashboard", "/__harness"]) {
    assert.throws(() => serverPathsFrom(TODAY, [held]), /held/);
  }
});

test("serverPathsFrom: a malformed extra path stops the build", () => {
  for (const bad of ["subscribe", "/subscribe/", "/", "/a?b", "/a#b", "/a*", "/a/[b]", "//a", "/a/../b", "/a/./b", "/a%2Fb", "/api/x"]) {
    assert.throws(() => serverPathsFrom([], [bad]), Error, bad);
  }
});

test("serverPathsFrom: an app/api route can never shadow a held section", () => {
  // Not reachable from a real manifest today, but the guard holds whatever the list says.
  assert.throws(() => serverPathsFrom([], ["/bookings/export"]), /held/);
});

// ---- handle -----------------------------------------------------------------------------------------------------

function harness(serverPaths = ["/api/health"]) {
  const calls = { assets: [], next: [] };
  const env = {
    ASSETS: {
      fetch: async (request) => {
        calls.assets.push(new URL(request.url).pathname);
        return new Response("asset", { status: 404, headers: { "content-type": "text/html; charset=utf-8", etag: '"a"' } });
      },
    },
  };
  const nextFetch = async (request, e, ctx) => {
    calls.next.push({ path: new URL(request.url).pathname, env: e, ctx });
    return new Response('{"ok":true}', { status: 200, statusText: "OK", headers: { "content-type": "application/json", "cache-control": "no-store" } });
  };
  const run = (url, init) => handle(new Request(`https://almarprivatejourney.com${url}`, init), env, { id: "ctx" }, { serverPaths: new Set(serverPaths), nextFetch });
  return { calls, env, run };
}

test("handle: a server path goes to Next with the same env and ctx, and gains x-robots-tag noindex", async () => {
  const { calls, env, run } = harness();
  const res = await run("/api/health");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"ok":true}');
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(calls.next.length, 1);
  assert.equal(calls.next[0].env, env);
  assert.deepEqual(calls.next[0].ctx, { id: "ctx" });
  assert.deepEqual(calls.assets, []);
});

test("handle: the query string does not change the decision", async () => {
  const { calls, run } = harness();
  await run("/api/health?x=1");
  assert.equal(calls.next.length, 1);
});

test("handle: every method on a server path goes to Next (Next answers 405 itself)", async () => {
  const { calls, run } = harness();
  await run("/api/health", { method: "POST", body: "a=1" });
  await run("/api/health", { method: "HEAD" });
  assert.equal(calls.next.length, 2);
});

test("handle: anything else goes back to the static assets untouched", async () => {
  const { calls, run } = harness();
  const paths = [
    "/dashboard", "/dashboard/home", "/account", "/login", "/booking/trip", "/bookings", "/fx", "/newsletter",
    "/embed/hero-booker", "/ar/login", "/nope", "/api/nope", "/api/health/", "/API/health", "/api/health%2F",
    "/api%2Fhealth", "/api/%68ealth", "//api/health", "/_next/image", "/cdn-cgi/image/x",
  ];
  for (const p of paths) {
    const res = await run(p);
    assert.equal(res.status, 404, p);
    assert.equal(res.headers.get("x-robots-tag"), null, p);
    assert.equal(res.headers.get("etag"), '"a"', p);
  }
  assert.equal(calls.next.length, 0);
  assert.equal(calls.assets.length, paths.length);
});

test("handle: a POST to a held path also goes to the static assets", async () => {
  const { calls, run } = harness();
  await run("/newsletter", { method: "POST", body: "Email=a@b.co" });
  assert.equal(calls.next.length, 0);
  assert.deepEqual(calls.assets, ["/newsletter"]);
});

test("handle: an error from Next propagates (Cloudflare answers 500; no page is invented)", async () => {
  const env = { ASSETS: { fetch: async () => new Response("asset") } };
  const nextFetch = async () => {
    throw new Error("boom");
  };
  await assert.rejects(
    handle(new Request("https://almarprivatejourney.com/api/health"), env, {}, { serverPaths: new Set(["/api/health"]), nextFetch }),
    /boom/,
  );
});

// ---- the assembler's job 10 refusals -------------------------------------------------------------------------

function scratchDir(files) {
  const base = mkdtempSync(join(tmpdir(), "almar-runtime-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), text);
  }
  return base;
}

function assembleFixture(appFiles) {
  const files = { "static/css/x.css": "body{}" };
  for (const f of appFiles) files[`app/${f}`] = `source:${f}`;
  const base = scratchDir(files);
  return () =>
    assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir: join(base, "out"), publicDir: join(base, "public") });
}

test("assembleOut: a held-section HTML source is still skipped silently", () => {
  const run = assembleFixture(["index.html", "login.html", "dashboard/home.html", "account.html"]);
  const report = run();
  assert.deepEqual(report.react.en, ["index.html"]);
});

test("assembleOut: a prerendered file under /api or a held section stops the build before out/ is written", () => {
  for (const f of ["api/x.body", "api/health.body", "fx.body", "newsletter.body", "embed/hero-booker.body", "ar/api/x.body"]) {
    const base = scratchDir({ [`app/${f}`]: "x", "app/index.html": "home", "static/css/x.css": "body{}" });
    const outDir = join(base, "out");
    assert.throws(
      () => assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir, publicDir: join(base, "public") }),
      /must be force-dynamic/,
      f,
    );
    assert.equal(existsSync(outDir), false, f);
  }
});

test("assertNoBundledEnv: empty blocks pass; any value in any mode stops the build, naming the variable only", () => {
  const ok = scratchDir({ "next-env.mjs": "export const production = {};\nexport const development = {};\nexport const test = {};\n" });
  assertNoBundledEnv(join(ok, "next-env.mjs"));
  const bad = scratchDir({ "next-env.mjs": 'export const production = {"SECRET_NAME":"value-xyz"};\nexport const development = {};\n' });
  assert.throws(() => assertNoBundledEnv(join(bad, "next-env.mjs")), (error) => {
    assert.match(error.message, /SECRET_NAME/);
    assert.equal(error.message.includes("value-xyz"), false, "the value is never printed");
    return true;
  });
  assert.throws(() => assertNoBundledEnv(join(ok, "missing.mjs")), /did not finish/);
});

test("writeServerPaths: writes the sorted list next to the OpenNext worker; refuses without the worker", () => {
  const base = scratchDir({
    "app-paths-manifest.json": JSON.stringify({ "/api/health/route": "x", "/about/route": "x", "/page": "x" }),
    ".open-next/worker.js": "export default {}",
  });
  assert.deepEqual(writeServerPaths({ manifestFile: join(base, "app-paths-manifest.json"), openNextDir: join(base, ".open-next") }), ["/api/health"]);
  assert.equal(readFileSync(join(base, ".open-next/almar-server-routes.json"), "utf8"), '["/api/health"]\n');
  const empty = scratchDir({ "app-paths-manifest.json": "{}" });
  assert.throws(() => writeServerPaths({ manifestFile: join(empty, "app-paths-manifest.json"), openNextDir: join(empty, ".open-next") }), /did not finish/);
});

// ---- source guards ----------------------------------------------------------------------------------------------

function filesUnder(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else found.push(full);
  }
  return found;
}

test("app/api/health/route.ts exports exactly dynamic and GET, and reads no environment", () => {
  const source = readFileSync("app/api/health/route.ts", "utf8");
  const exported = [...source.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(exported, ["GET", "dynamic"]);
  assert.match(source, /export const dynamic = "force-dynamic";/);
  assert.equal(/process\.env/.test(source), false);
});

test("every app/api route is force-dynamic, so none is prerendered into out/", () => {
  const files = filesUnder("app/api");
  const routes = files.filter((f) => /route\.tsx?$/.test(f));
  assert.ok(routes.length >= 1);
  for (const file of routes) assert.match(readFileSync(file, "utf8"), /export const dynamic = "force-dynamic";/, file);
  assert.deepEqual(files.filter((f) => !/route\.tsx?$/.test(f)), [], "only route files under app/api");
});

test("no file under app/ asks for the edge runtime (OpenNext serves the nodejs runtime only)", () => {
  const hits = filesUnder("app").filter((f) => /\.tsx?$/.test(f) && /runtime\s*=\s*["']edge["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(hits, []);
});

test("app/newsletter/route.ts no longer gates itself on NODE_ENV (the Worker holds it)", () => {
  assert.equal(readFileSync("app/newsletter/route.ts", "utf8").includes("NODE_ENV"), false);
});

test("worker/almar.mjs imports only the OpenNext worker, the generated list and the router", () => {
  const source = readFileSync("worker/almar.mjs", "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../.open-next/worker.js", "../.open-next/almar-server-routes.json", "./handle.mjs"]);
});

test("open-next.config.ts sets no cache override and no static export", () => {
  const source = readFileSync("open-next.config.ts", "utf8");
  assert.match(source, /export default defineCloudflareConfig\(\{\}\);/);
  assert.equal(/output\s*:/.test(source), false);
});
