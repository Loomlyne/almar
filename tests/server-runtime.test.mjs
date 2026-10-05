import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { HELD_PATHS, SERVER_PATHS_OUTSIDE_API, isHeldPath, serverPathsFrom } from "../lib/server-routes.ts";
import { JOB02_SERVER_PATHS } from "../lib/auth/server-paths.ts";
import { assembleOut, assertNoBundledEnv, assertNoPublicEnv, writeServerPaths } from "../scripts/assemble-cloudflare.mjs";
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
  assert.deepEqual(serverPathsFrom(TODAY, []), ["/api/health"]);
  assert.deepEqual(serverPathsFrom(["/api/b/route", "/api/a/b/route", "/api/b/route"], []), ["/api/a/b", "/api/b"]);
});

test("serverPathsFrom: pages, Framer routes and held handlers outside /api are ignored", () => {
  assert.deepEqual(serverPathsFrom(["/newsletter/route", "/fx/route", "/embed/hero-booker/route", "/about/route", "/login/page"], []), []);
  assert.deepEqual(serverPathsFrom(["/apiary/route"], []), []);
});

test("serverPathsFrom: a page under app/api stops the build", () => {
  assert.throws(() => serverPathsFrom(["/api/x/page"]), /\/api\/x\/page/);
});

test("serverPathsFrom: app/api/route.ts itself (/api) stops the build: run_worker_first covers /api/* only", () => {
  assert.throws(() => serverPathsFrom(["/api/route"]), /\/api\/route/);
});

test("serverPathsFrom: dynamic, catch-all, grouped and parallel segments under /api stop the build", () => {
  for (const key of ["/api/[id]/route", "/api/x/[...rest]/route", "/api/(group)/x/route", "/api/@slot/route"]) {
    assert.throws(() => serverPathsFrom([key]), new RegExp(key.replace(/[[\]().*+?^$|\\]/g, "\\$&")));
  }
});

test("HELD_PATHS is the five sections still held (/booking left it with plan 04-02); SERVER_PATHS_OUTSIDE_API is job 02's six sign-in paths (02-23 task 3)", () => {
  assert.deepEqual([...HELD_PATHS], ["/dashboard", "/fx", "/newsletter", "/embed", "/__harness"]);
  assert.deepEqual([...SERVER_PATHS_OUTSIDE_API], ["/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]);
});

test("three places agree: JOB02_SERVER_PATHS, SERVER_PATHS_OUTSIDE_API and run_worker_first in both Worker files; none is held", () => {
  assert.deepEqual([...SERVER_PATHS_OUTSIDE_API], [...JOB02_SERVER_PATHS]);
  for (const file of ["wrangler.toml", "wrangler.preview.toml"]) {
    const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("run_worker_first"));
    const list = JSON.parse(line.replace(/^run_worker_first = /, ""));
    assert.deepEqual(list.slice(1), [...JOB02_SERVER_PATHS], file);
    assert.equal(list[0], "/api/*", file);
  }
  for (const path of JOB02_SERVER_PATHS) {
    assert.equal(isHeldPath(path), false, path);
    assert.equal(isHeldPath(`/ar${path}`), false, `/ar${path}`);
  }
  // Only the exact path opens: a child, a locale prefix or the ops-host handoff stay out of the list.
  for (const path of ["/login/x", "/account/x", "/auth/handoff", "/auth/confirm/x", "/ar/login", "/es/account"]) {
    assert.equal(SERVER_PATHS_OUTSIDE_API.includes(path), false, path);
  }
});

test("serverPathsFrom: an extra path outside /api is added; one under a held section stops the build", () => {
  assert.deepEqual(serverPathsFrom(TODAY, ["/subscribe"]), ["/api/health", "/subscribe"]);
  assert.deepEqual(serverPathsFrom(TODAY), ["/api/health", ...[...JOB02_SERVER_PATHS].sort()].sort());
  for (const held of ["/newsletter", "/dashboard/home", "/es/dashboard", "/ar/fx", "/__harness"]) {
    assert.throws(() => serverPathsFrom(TODAY, [held]), /held/);
  }
});

test("plan 04-02: /booking is no longer held, and the three booking endpoints are served", () => {
  assert.equal(isHeldPath("/booking"), false);
  assert.equal(isHeldPath("/booking/trip"), false);
  assert.equal(isHeldPath("/es/booking"), false);
  assert.deepEqual(
    serverPathsFrom(["/api/booking/quote/route", "/api/booking/hold/route", "/api/booking/release/route", "/api/health/route"], []),
    ["/api/booking/hold", "/api/booking/quote", "/api/booking/release", "/api/health"],
  );
});

test("serverPathsFrom: a malformed extra path stops the build", () => {
  for (const bad of ["subscribe", "/subscribe/", "/", "/a?b", "/a#b", "/a*", "/a/[b]", "//a", "/a/../b", "/a/./b", "/a%2Fb", "/api/x"]) {
    assert.throws(() => serverPathsFrom([], [bad]), Error, bad);
  }
});

test("serverPathsFrom: an app/api route can never shadow a held section", () => {
  // Not reachable from a real manifest today, but the guard holds whatever the list says.
  assert.throws(() => serverPathsFrom([], ["/fx/export"]), /held/);
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
    calls.next.push({ path: new URL(request.url).pathname, env: e, ctx, headers: new Headers(request.headers), body: await request.text() });
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
    "/dashboard", "/dashboard/home", "/booking/trip", "/booking", "/fx", "/newsletter", "/login/x", "/account/x",
    "/auth/handoff", "/auth/confirm/x", "/embed/hero-booker", "/ar/login", "/es/account", "/nope", "/api/nope", "/api/health/", "/API/health", "/api/health%2F",
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

test("handle: dot segments are resolved by the URL parser before the decision, so what is decided is what Next gets", async () => {
  // Cloudflare passes the Worker the same normalised URL that `new Request(url)` holds: `..` and `%2e%2e` segments are
  // already folded away (an encoded slash or a `;` is not). The router decides on that pathname and forwards that URL.
  const cases = [
    // [as sent, pathname handle() sees, goes to Next]
    ["/api/%2e%2e/dashboard", "/dashboard", false],
    ["/api/%2E%2E/dashboard", "/dashboard", false],
    ["/api/.%2e/dashboard", "/dashboard", false],
    ["/api/health/%2e%2e/%2e%2e/dashboard", "/dashboard", false],
    ["/api/health/../../login", "/login", false],
    ["/api\\..\\dashboard", "/dashboard", false],
    ["/api/health/..", "/api/", false],
    ["/api/..%2fdashboard", "/api/..%2fdashboard", false],
    ["/api/..;/dashboard", "/api/..;/dashboard", false],
    ["/api/health/.", "/api/health/", false],
    ["/dashboard/../api/health", "/api/health", true],
    ["/api/./health", "/api/health", true],
  ];
  for (const [sent, seen, toNext] of cases) {
    const { calls, run } = harness();
    assert.equal(new URL(`https://almarprivatejourney.com${sent}`).pathname, seen, `${sent}: the pathname Cloudflare would pass`);
    const res = await run(sent);
    if (toNext) {
      assert.deepEqual(calls.next.map((c) => c.path), [seen], sent);
      assert.deepEqual(calls.assets, [], sent);
      assert.equal(res.headers.get("x-robots-tag"), "noindex", sent);
    } else {
      assert.deepEqual(calls.next, [], `${sent}: nothing is forwarded to Next`);
      assert.deepEqual(calls.assets, [seen], sent);
      assert.equal(res.status, 404, sent);
      assert.equal(res.headers.get("x-robots-tag"), null, sent);
    }
    // Whatever was forwarded is a server path, and exactly the path that was decided on; no held section ever is.
    for (const call of calls.next) assert.ok(call.path === "/api/health" && !isHeldPath(call.path), sent);
  }
});

test("handle: with job 02's six sign-in paths on the list, dot segments fold first and only the exact path goes to Next", async () => {
  // Same rule as above (decide on the pathname the URL parser holds, forward that URL), now that /login, /account and
  // the rest are server paths: a dot segment may land on one of them, never on a held section or a near miss.
  const cases = [
    // [as sent, pathname handle() sees, goes to Next]
    ["/api/%2e%2e/login", "/login", true],
    ["/dashboard/../account", "/account", true],
    ["/api/health/../../bookings", "/bookings", true],
    ["/auth/./confirm", "/auth/confirm", true],
    ["/api/%2e%2e/dashboard", "/dashboard", false],
    ["/login/../dashboard", "/dashboard", false],
    ["/auth/handoff/start/..", "/auth/handoff/", false],
    ["/auth/confirm/..", "/auth/", false],
    ["/login/.", "/login/", false],
    ["/login%2F", "/login%2F", false],
    ["/auth/..%2fconfirm", "/auth/..%2fconfirm", false],
  ];
  for (const [sent, seen, toNext] of cases) {
    const { calls, run } = harness(["/api/health", ...JOB02_SERVER_PATHS]);
    assert.equal(new URL(`https://almarprivatejourney.com${sent}`).pathname, seen, `${sent}: the pathname Cloudflare would pass`);
    const res = await run(sent);
    if (toNext) {
      assert.deepEqual(calls.next.map((c) => c.path), [seen], sent);
      assert.deepEqual(calls.assets, [], sent);
      assert.equal(res.headers.get("x-robots-tag"), "noindex", sent);
    } else {
      assert.deepEqual(calls.next, [], `${sent}: nothing is forwarded to Next`);
      assert.deepEqual(calls.assets, [seen], sent);
      assert.equal(res.headers.get("x-robots-tag"), null, sent);
    }
    for (const call of calls.next) assert.ok(!isHeldPath(call.path), sent);
  }
});

test("handle: Next never sees a visitor's x-forwarded-host, and x-forwarded-for comes from Cloudflare only", async () => {
  const { calls, run } = harness();
  await run("/api/health", {
    method: "POST",
    body: "a=1",
    headers: { "x-forwarded-host": "evil.example", "x-forwarded-for": "6.6.6.6", "cf-connecting-ip": "203.0.113.7", "content-type": "text/plain" },
  });
  await run("/api/health", { headers: { "x-forwarded-for": "6.6.6.6" } });
  assert.equal(calls.next[0].headers.get("x-forwarded-host"), null);
  assert.equal(calls.next[0].headers.get("x-forwarded-for"), "203.0.113.7");
  assert.equal(calls.next[0].headers.get("content-type"), "text/plain");
  assert.equal(calls.next[0].body, "a=1", "the body still reaches Next");
  assert.equal(calls.next[1].headers.get("x-forwarded-for"), null, "no Cloudflare address: none at all");
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
  const run = assembleFixture(["index.html", "booking.html", "dashboard/home.html", "fx.html"]);
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

test("assembleOut: a public/ file under /api or a held section stops the build before out/ is written", () => {
  for (const f of ["api/health", "api/x.json", "fx.html", "dashboard/index.html", "ar/newsletter.html", "embed/x.js"]) {
    const base = scratchDir({ [`public/${f}`]: "x", "app/index.html": "home", "static/css/x.css": "body{}" });
    const outDir = join(base, "out");
    assert.throws(
      () => assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir, publicDir: join(base, "public") }),
      /only the Worker may answer/,
      f,
    );
    assert.equal(existsSync(outDir), false, f);
  }
  const ok = scratchDir({ "public/assets/x.webp": "x", "public/apiary.txt": "x", "app/index.html": "home", "static/css/x.css": "body{}" });
  assembleOut({ appDir: join(ok, "app"), staticDir: join(ok, "static"), outDir: join(ok, "out"), publicDir: join(ok, "public") });
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

test("assertNoPublicEnv: a NEXT_PUBLIC_* variable in the build shell stops the build, naming the variable only", () => {
  // The build shell's environment is handed to OpenNext; Next would inline every NEXT_PUBLIC_* value into the browser bundle.
  assertNoPublicEnv({});
  assertNoPublicEnv({ PATH: "/usr/bin", HOME: "/Users/x", PUBLIC_NEXT: "1", next_public_lower: "1", XNEXT_PUBLIC_A: "1" });
  assert.throws(
    () => assertNoPublicEnv({ PATH: "/usr/bin", NEXT_PUBLIC_B: "value-xyz", NEXT_PUBLIC_A: "value-abc" }),
    (error) => {
      assert.match(error.message, /^NEXT_PUBLIC_\* in the build shell would be inlined into the browser bundle: NEXT_PUBLIC_A, NEXT_PUBLIC_B$/);
      assert.equal(error.message.includes("value-"), false, "the value is never printed");
      return true;
    },
  );
  // An empty value is still inlined (as an empty string), so it stops the build too.
  assert.throws(() => assertNoPublicEnv({ NEXT_PUBLIC_EMPTY: "" }), /NEXT_PUBLIC_EMPTY/);
});

test("writeServerPaths: writes the sorted list next to the OpenNext worker; refuses without the worker", () => {
  const base = scratchDir({
    "app-paths-manifest.json": JSON.stringify({ "/api/health/route": "x", "/about/route": "x", "/page": "x" }),
    ".open-next/worker.js": "export default {}",
  });
  const want = ["/api/health", ...JOB02_SERVER_PATHS].sort();
  assert.deepEqual(writeServerPaths({ manifestFile: join(base, "app-paths-manifest.json"), openNextDir: join(base, ".open-next") }), want);
  assert.equal(readFileSync(join(base, ".open-next/almar-server-routes.json"), "utf8"), `${JSON.stringify(want)}\n`);
  const empty = scratchDir({ "app-paths-manifest.json": "{}" });
  assert.throws(() => writeServerPaths({ manifestFile: join(empty, "app-paths-manifest.json"), openNextDir: join(empty, ".open-next") }), /did not finish/);
});

// ---- the two Worker files, the scripts, .gitignore -----------------------------------------------------------

const WORKER_FILES = ["wrangler.toml", "wrangler.preview.toml"];

function topKey(text, key) {
  const m = new RegExp(`^${key} = (.*)$`, "m").exec(text.split(/^\[/m)[0]);
  return m ? m[1] : undefined;
}

test("both Worker files run the same script with the same flags, date and ASSETS binding", () => {
  const [live, preview] = WORKER_FILES.map((f) => readFileSync(f, "utf8"));
  for (const key of ["main", "compatibility_flags", "compatibility_date", "account_id", "workers_dev", "preview_urls"]) {
    assert.ok(topKey(live, key) !== undefined, `wrangler.toml ${key}`);
    assert.equal(topKey(preview, key), topKey(live, key), key);
  }
  assert.equal(topKey(live, "main"), '"worker/almar.mjs"');
  assert.equal(topKey(live, "compatibility_flags"), '["nodejs_compat", "global_fetch_strictly_public"]');
  assert.equal(topKey(live, "preview_urls"), "false");
  for (const text of [live, preview]) {
    assert.match(text, /^binding = "ASSETS"$/m);
    assert.match(text, /^html_handling = "auto-trailing-slash"$/m);
    assert.match(text, /^not_found_handling = "404-page"$/m);
  }
  assert.match(live, /^directory = "\.\/out"$/m);
  assert.match(preview, /^directory = "\.\/out-preview"$/m);
});

test("both Worker files run the script first only for /api/* and the paths served outside /api", () => {
  const want = JSON.stringify(["/api/*", ...SERVER_PATHS_OUTSIDE_API]);
  for (const file of WORKER_FILES) {
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.startsWith("run_worker_first"));
    assert.equal(lines.length, 1, file);
    assert.equal(JSON.stringify(JSON.parse(lines[0].replace(/^run_worker_first = /, ""))), want, file);
  }
});

test("neither Worker file binds a variable, store, queue, service or object", () => {
  for (const file of WORKER_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/^\[vars\]|^\[\[?(kv_namespaces|r2_buckets|d1_databases|durable_objects|services|queues|hyperdrive|vectorize|ai|browser|images|analytics_engine_datasets|send_email|secrets_store_secrets)/m.test(text), false, file);
    assert.equal(/eyJ|re_[A-Za-z0-9]{8,}|sk_(live|test)_/.test(text), false, `${file} holds something that looks like a key`);
  }
});

test("wrangler.toml keeps its two custom domains and never names the preview Worker or host", () => {
  const live = readFileSync("wrangler.toml", "utf8");
  assert.deepEqual(live.split("\n").filter((l) => l.startsWith("pattern = ")), ['pattern = "almarprivatejourney.com"', 'pattern = "www.almarprivatejourney.com"']);
  assert.equal(/almar-preview|preview\.almarprivatejourney/i.test(live), false);
});

test("no package.json script deploys or uploads; the two build scripts only build", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const [name, command] of Object.entries(pkg.scripts)) {
    assert.equal(/wrangler\s+(deploy|versions\s+upload|secret)|opennextjs-cloudflare\s+(deploy|upload|preview)|vercel/.test(command), false, `${name}: ${command}`);
  }
  assert.equal(pkg.scripts["host:cloudflare"], undefined);
  assert.equal(pkg.scripts["build:cloudflare"], "node scripts/assemble-cloudflare.mjs --target=production");
  assert.equal(pkg.scripts["build:preview"], "node scripts/assemble-cloudflare.mjs --target=preview");
});

test(".gitignore keeps the OpenNext build out of git", () => {
  assert.ok(readFileSync(".gitignore", "utf8").split("\n").includes("/.open-next/"));
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

test("worker/almar.mjs imports only the OpenNext worker, the generated list, the held list and the router", () => {
  const source = readFileSync("worker/almar.mjs", "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../.open-next/worker.js", "../.open-next/almar-server-routes.json", "../lib/server-routes.ts", "./handle.mjs"]);
  // The startup check runs before the list becomes the Set the router uses.
  assert.ok(source.indexOf("isHeldPath(path)") > -1 && source.indexOf("isHeldPath(path)") < source.indexOf("new Set(serverPaths)"));
});

test("open-next.config.ts sets no cache override and no static export", () => {
  const source = readFileSync("open-next.config.ts", "utf8");
  assert.match(source, /export default defineCloudflareConfig\(\{\}\);/);
  assert.equal(/output\s*:/.test(source), false);
});
