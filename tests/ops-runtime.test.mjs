import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { OPS_AUTH_PATHS, OPS_LIVE_SECTIONS, OPS_PATH_HEADER, assertOpsPath, isLiveOpsPath, opsPathsFrom } from "../lib/ops-routes.ts";
import { OPS_API_PREFIX, serverPathsFrom } from "../lib/server-routes.ts";
import { assembleOut, writeOpsPaths, writeServerPaths } from "../scripts/assemble-cloudflare.mjs";
import { opsTestConfig } from "./build/make-ops-test-config.mjs";

// Plan 03.2-03: the second Worker, `almar-ops` (dashboard.almarprivatejourney.com). No build and no wrangler here;
// the built Worker is proven by tests/build/ops-runtime.spec.ts.

// Job 10's manifest keys of today, plus what 03.2-01 / 03.2-04 add.
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
const MANIFEST = [
  ...TODAY,
  "/dashboard/page",
  "/dashboard/(ops)/catalog/stays/page",
  "/auth/confirm/page",
  "/auth/handoff/route",
  "/auth/handoff/start/route",
  "/auth/sign-out/route",
  "/api/ops/stays/route",
  "/api/booking/quote/route",
];
const WANT = [
  "/",
  "/api/health",
  "/api/ops/stays",
  "/auth/confirm",
  "/auth/handoff",
  "/auth/sign-out",
  "/catalog/stays",
  "/dashboard",
  "/dashboard/catalog/stays",
  "/dashboard/home",
  "/home",
  "/sign-in",
];

// ---- opsPathsFrom ---------------------------------------------------------------------------------------------

test("opsPathsFrom: the exact sorted list for today's keys plus the 03.2 routes", () => {
  assert.deepEqual(opsPathsFrom(MANIFEST), WANT);
});

test("opsPathsFrom: never the marketing host's handoff start, a guest API, a marketing page or the harness", () => {
  const paths = opsPathsFrom(MANIFEST);
  for (const never of ["/auth/handoff/start", "/api/booking/quote", "/about", "/private-stays", "/login", "/account", "/__harness", "/ar", "/newsletter", "/fx"]) {
    assert.equal(paths.includes(never), false, never);
  }
  assert.equal(paths.some((p) => p.startsWith("/_next") || p.startsWith("/cdn-cgi")), false);
});

test("opsPathsFrom: a group segment is stripped, so a section is served as /dashboard/<section> and /<section>", () => {
  const paths = opsPathsFrom([...MANIFEST, "/dashboard/(ops)/content/team/page", "/dashboard/(ops)/bookings/page"]);
  for (const p of ["/dashboard/content/team", "/content/team", "/dashboard/bookings", "/bookings"]) assert.ok(paths.includes(p), p);
});

test("opsPathsFrom: the input order and duplicates change nothing", () => {
  assert.deepEqual(opsPathsFrom([...MANIFEST].reverse()), WANT);
  assert.deepEqual(opsPathsFrom([...MANIFEST, ...MANIFEST]), WANT);
});

test("opsPathsFrom: every OPS_AUTH_PATHS entry (a route or a page) and the /api/health route must be in the manifest", () => {
  assert.deepEqual([...OPS_AUTH_PATHS], ["/auth/confirm", "/auth/handoff", "/auth/sign-out"]);
  // /auth/confirm is a page in app/ (the Continue screen); the other two are route handlers.
  for (const missing of ["/auth/confirm/page", "/auth/handoff/route", "/auth/sign-out/route", "/api/health/route"]) {
    const stem = missing.replace(/\/(route|page)$/, "");
    assert.throws(() => opsPathsFrom(MANIFEST.filter((k) => k !== missing)), new RegExp(stem.replace(/\//g, "\\/")), missing);
  }
  // Either form counts for an auth path, and the answer is the same.
  assert.deepEqual(opsPathsFrom([...MANIFEST.filter((k) => k !== "/auth/confirm/page"), "/auth/confirm/route"]), WANT);
  // The health path must be a route handler: a page of that name is not enough.
  assert.throws(() => opsPathsFrom([...MANIFEST.filter((k) => k !== "/api/health/route"), "/api/health/page"]), /api\/health/);
});

test("opsPathsFrom: a dynamic, catch-all, parallel or intercepting segment under /dashboard or /api/ops stops the build", () => {
  for (const key of [
    "/dashboard/(ops)/catalog/[id]/page",
    "/dashboard/(ops)/x/[...rest]/page",
    "/dashboard/(ops)/@slot/page",
    "/dashboard/(ops)/(.)photo/page",
    "/api/ops/[id]/route",
    "/api/ops/x/[...rest]/route",
    "/api/ops/(group)/x/route",
    "/api/ops/@slot/route",
  ]) {
    assert.throws(() => opsPathsFrom([...MANIFEST, key]), /dynamic|catch-all|parallel|intercept|group/, key);
  }
});

test("opsPathsFrom: a page under /api/ops, and /api/ops itself, stop the build", () => {
  assert.throws(() => opsPathsFrom([...MANIFEST, "/api/ops/x/page"]), /\/api\/ops\/x\/page/);
  assert.throws(() => opsPathsFrom([...MANIFEST, "/api/ops/route"]), /\/api\/ops\/route/);
});

test("opsPathsFrom: a section named like a server prefix stops the build", () => {
  for (const section of ["api", "auth", "_next", "cdn-cgi", "dashboard", "__harness"]) {
    assert.throws(() => opsPathsFrom([...MANIFEST, `/dashboard/(ops)/${section}/page`]), /section/, section);
  }
});

// ---- the live-section gate --------------------------------------------------------------------------------------

test("OPS_LIVE_SECTIONS is empty in this plan, so no section is live; the header name is fixed", () => {
  assert.deepEqual([...OPS_LIVE_SECTIONS], []);
  assert.equal(isLiveOpsPath("/catalog/stays"), false);
  assert.equal(isLiveOpsPath("/"), false);
  assert.equal(OPS_PATH_HEADER, "x-almar-ops-path");
});

test("isLiveOpsPath: a listed section and what is under it; never a near miss or its parent", () => {
  const live = ["/catalog/stays"];
  assert.equal(isLiveOpsPath("/catalog/stays", live), true);
  assert.equal(isLiveOpsPath("/catalog/stays/x", live), true);
  assert.equal(isLiveOpsPath("/catalog/stays/", live), true);
  assert.equal(isLiveOpsPath("/catalog/stays-old", live), false);
  assert.equal(isLiveOpsPath("/catalog", live), false);
  assert.equal(isLiveOpsPath("/", live), false);
  assert.equal(isLiveOpsPath("", live), false);
  assert.equal(isLiveOpsPath("/Catalog/stays", live), false);
});

test("isLiveOpsPath: the rewrite target /dashboard/<section> gives the same answer as the browser path", () => {
  const live = ["/catalog/stays", "/bookings"];
  for (const path of ["/catalog/stays", "/bookings", "/bookings/x"]) {
    assert.equal(isLiveOpsPath(`/dashboard${path}`, live), isLiveOpsPath(path, live), path);
    assert.equal(isLiveOpsPath(`/dashboard${path}`, live), true, path);
  }
  assert.equal(isLiveOpsPath("/dashboard/settings", live), false);
  assert.equal(isLiveOpsPath("/dashboard", live), false);
});

test("isLiveOpsPath: the root section opens only the root", () => {
  assert.equal(isLiveOpsPath("/", ["/"]), true);
  assert.equal(isLiveOpsPath("/home", ["/"]), false);
});

// ---- assertOpsPath ----------------------------------------------------------------------------------------------

test("assertOpsPath: accepts exactly the shapes opsPathsFrom produces", () => {
  for (const path of WANT) assertOpsPath(path, WANT);
  assertOpsPath("/auth/handoff");
  assertOpsPath("/api/ops/stays");
});

test("assertOpsPath: refuses a malformed path, a prefix of the static layer, a public or guest path and a held section", () => {
  for (const bad of [
    "dashboard",
    "/dashboard/",
    "/a?b",
    "/a#b",
    "/a*",
    "/a/[b]",
    "//a",
    "/a/../b",
    "/a%2Fb",
    "/_next/static/x.js",
    "/_next/image",
    "/cdn-cgi/image/x",
    "/ar",
    "/ar/about",
    "/es/",
    "/booking/trip",
    "/embed/hero-booker",
    "/__harness",
    "/login",
    "/account",
    "/auth/handoff/start",
    "/auth/confirm/x",
    "/api/nope",
    "/api/booking/quote",
    "/api/stripe/webhook",
    "/api/ops",
    "/api/health/",
  ]) {
    assert.throws(() => assertOpsPath(bad), /ops/i, bad);
  }
});

test("assertOpsPath: a bare section is served only when its /dashboard twin is listed too", () => {
  assert.throws(() => assertOpsPath("/about", WANT), /twin|\/dashboard\/about/);
  assert.throws(() => assertOpsPath("/private-stays", ["/private-stays"]), /\/dashboard\/private-stays/);
  assertOpsPath("/home", WANT);
});

// ---- the public Worker never serves /api/ops --------------------------------------------------------------------

test("serverPathsFrom: /api/ops/* routes are skipped (served by almar-ops only), /api/health stays", () => {
  assert.equal(OPS_API_PREFIX, "/api/ops/");
  assert.deepEqual(serverPathsFrom(["/api/ops/stays/route", "/api/ops/route", "/api/health/route"], []), ["/api/health"]);
  assert.deepEqual(serverPathsFrom(MANIFEST, []), ["/api/booking/quote", "/api/health"]);
});

test("serverPathsFrom: a near miss of the prefix is still an ordinary /api route", () => {
  assert.deepEqual(serverPathsFrom(["/api/operations/route", "/api/ops-x/route"], []), ["/api/operations", "/api/ops-x"]);
});

test("serverPathsFrom: a malformed /api/ops route still stops the build", () => {
  assert.throws(() => serverPathsFrom(["/api/ops/x/page"]), /\/api\/ops\/x\/page/);
  assert.throws(() => serverPathsFrom(["/api/ops/[id]/route"]), /dynamic/);
});

// ---- the entry and the config -----------------------------------------------------------------------------------

test("worker/almar-ops.mjs imports exactly the OpenNext worker, the generated list, the ops rules, the host rule and the router", () => {
  const source = readFileSync("worker/almar-ops.mjs", "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, [
    "../.open-next/worker.js",
    "../.open-next/almar-ops-routes.json",
    "../lib/ops-routes.ts",
    "../lib/host.ts",
    "./handle.mjs",
  ]);
  // The startup check runs before the list becomes the Set the router uses.
  assert.ok(source.indexOf("assertOpsPath(") > -1 && source.indexOf("assertOpsPath(") < source.indexOf("new Set("));
  assert.match(source, /serverPaths: OPS_PATHS, nextFetch/);
});

// ---- the Worker itself, run for real on a scratch copy (Fable review of 7527f88) --------------------------------
// worker/almar-ops.mjs imports a build output (.open-next/) that unit tests do not have, so each test copies the real
// Worker, the real lib/ops-routes.ts, lib/host.ts and worker/handle.mjs into a scratch folder and puts a fake OpenNext
// worker and a route list where the build would. Only the one JSON import is rewritten (Node wants an import attribute
// for it; wrangler's bundler does not).

async function opsWorker(routes = WANT) {
  const base = mkdtempSync(join(tmpdir(), "almar-ops-worker-"));
  for (const dir of ["worker", "lib", ".open-next"]) mkdirSync(join(base, dir));
  writeFileSync(join(base, "package.json"), '{"type":"module"}');
  for (const file of ["lib/ops-routes.ts", "lib/host.ts", "worker/handle.mjs"]) copyFileSync(file, join(base, file));
  const source = readFileSync("worker/almar-ops.mjs", "utf8").replace('"../.open-next/almar-ops-routes.json"', '"../.open-next/almar-ops-routes.mjs"');
  assert.notEqual(source, readFileSync("worker/almar-ops.mjs", "utf8"), "the JSON import is the one line the harness rewrites");
  writeFileSync(join(base, "worker/almar-ops.mjs"), source);
  writeFileSync(join(base, ".open-next/almar-ops-routes.mjs"), `export default ${JSON.stringify(routes)};\n`);
  writeFileSync(
    join(base, ".open-next/worker.js"),
    `export default { async fetch(request, env, ctx) {
  globalThis.__opsNext.push({ path: new URL(request.url).pathname, headers: Object.fromEntries(request.headers), body: await request.text() });
  return new Response("next", { status: 200 });
} };\n`,
  );
  globalThis.__opsNext = [];
  const mod = await import(pathToFileURL(join(base, "worker/almar-ops.mjs")).href);
  const next = globalThis.__opsNext;
  const assets = [];
  const env = { ASSETS: { fetch: async (request) => (assets.push(new URL(request.url).pathname), new Response("asset", { status: 404 })) } };
  const run = (url, init) => mod.default.fetch(new Request(url, init), env, {});
  return { next, assets, run };
}

const OPS_URL = "https://dashboard.almarprivatejourney.com";
const MARKETING_URL = "https://almarprivatejourney.com";

test("the ops Worker: on the ops host a listed path goes to Next and anything else to the static assets", async () => {
  const { next, assets, run } = await opsWorker();
  await run(`${OPS_URL}/sign-in`);
  await run(`${OPS_URL}/api/health`);
  await run(`${OPS_URL}/about`);
  await run(`${OPS_URL}/api/ops/not-written-yet`);
  assert.deepEqual(next.map((c) => c.path), ["/sign-in", "/api/health"]);
  assert.deepEqual(assets, ["/about", "/api/ops/not-written-yet"]);
});

test("the ops Worker: a request whose host is not the ops host never reaches Next, except /api/health", async () => {
  const { next, assets, run } = await opsWorker();
  const paths = ["/", "/sign-in", "/home", "/bookings", "/dashboard", "/dashboard/home", "/auth/confirm", "/auth/handoff", "/auth/sign-out", "/catalog/stays", "/api/ops/stays"];
  for (const host of [MARKETING_URL, "https://www.almarprivatejourney.com", "https://preview.almarprivatejourney.com", "http://127.0.0.1:8787", "https://dashboard.almarprivatejourney.com.evil.com", "https://evil-dashboard.almarprivatejourney.com", "http://dashboard.localhost:3010"]) {
    for (const path of paths) await run(`${host}${path}`);
  }
  assert.deepEqual(next, [], "nothing from a foreign host is handed to Next");
  assert.equal(assets.length, 7 * paths.length, "every one of them is answered by the static assets");
  const before = assets.length;
  const health = await run(`${MARKETING_URL}/api/health`);
  assert.equal(health.status, 200, "the readiness poll of the Playwright runs still reaches Next");
  assert.deepEqual(next.map((c) => c.path), ["/api/health"]);
  assert.equal(assets.length, before);
  // Only that exact path is excused.
  await run(`${MARKETING_URL}/api/health/`);
  await run(`${MARKETING_URL}/API/health`);
  await run(`${MARKETING_URL}/api/healthz`);
  assert.equal(next.length, 1);
});

test("the ops Worker: the URL host and the Host header must both be the ops host (fail closed on a mismatch)", async () => {
  const { next, assets, run } = await opsWorker();
  await run(`${OPS_URL}/sign-in`, { headers: { host: "almarprivatejourney.com" } });
  await run(`${MARKETING_URL}/sign-in`, { headers: { host: "dashboard.almarprivatejourney.com" } });
  assert.deepEqual(next, []);
  assert.equal(assets.length, 2);
  await run(`${OPS_URL}/sign-in`, { headers: { host: "dashboard.almarprivatejourney.com" } });
  assert.deepEqual(next.map((c) => c.path), ["/sign-in"]);
});

test("the ops Worker: a trailing dot on the ops host is still the ops host", async () => {
  const { next, assets, run } = await opsWorker();
  await run("https://dashboard.almarprivatejourney.com./sign-in");
  await run("https://dashboard.almarprivatejourney.com.:443/", { headers: { host: "dashboard.almarprivatejourney.com.:443" } });
  assert.deepEqual(next.map((c) => c.path), ["/sign-in", "/"]);
  assert.deepEqual(assets, []);
  // Two dots is not the ops host.
  await run("https://dashboard.almarprivatejourney.com../sign-in");
  assert.equal(next.length, 2);
});

test("the ops Worker: a client-sent x-almar-ops-path never reaches Next; x-almar-shell is left alone; the body survives", async () => {
  const { next, run } = await opsWorker();
  await run(`${OPS_URL}/api/health`, {
    method: "POST",
    body: "a=1&b=2",
    headers: { "x-almar-ops-path": "/catalog/stays", "X-Almar-Ops-Path": "/settings", "x-almar-shell": "ops", "content-type": "text/plain", "cf-connecting-ip": "203.0.113.7" },
  });
  await run(`${OPS_URL}/sign-in`, { headers: { "x-almar-ops-path": "/catalog/stays" } });
  assert.equal(next.length, 2);
  for (const call of next) assert.equal("x-almar-ops-path" in call.headers, false, call.path);
  assert.equal(next[0].headers["x-almar-shell"], "ops", "the shell header is the middleware's business, not stripped here");
  assert.equal(next[0].body, "a=1&b=2");
  assert.equal(next[0].headers["x-forwarded-for"], "203.0.113.7", "handle()'s own header rules still apply");
});

test("the ops Worker: a route list that holds a marketing page stops it at startup", async () => {
  await assert.rejects(opsWorker([...WANT, "/about"]), /ops path "\/about"/);
  await assert.rejects(opsWorker([...WANT, "/auth/handoff/start"]), /ops path/);
  await assert.rejects(opsWorker([...WANT, "/api/booking/quote"]), /ops path/);
});

const OPS = readFileSync("wrangler.ops.toml", "utf8");

function topKey(text, key) {
  const m = new RegExp(`^${key} = (.*)$`, "m").exec(text.split(/^\[/m)[0]);
  return m ? m[1] : undefined;
}

function block(text, header) {
  const lines = text.split("\n");
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, `${header} is missing`);
  const out = [];
  for (let i = start + 1; i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("["); i += 1) {
    if (!lines[i].startsWith("#")) out.push(lines[i]);
  }
  return out;
}

test("wrangler.ops.toml: Worker almar-ops in the ALMAR account, no workers.dev, no preview URLs, the same runtime flags", () => {
  const live = readFileSync("wrangler.toml", "utf8");
  assert.equal(topKey(OPS, "name"), '"almar-ops"');
  assert.equal(topKey(OPS, "account_id"), '"f1d9a1fa3abdda98c15161b00b40385c"');
  assert.equal(topKey(OPS, "main"), '"worker/almar-ops.mjs"');
  assert.equal(topKey(OPS, "workers_dev"), "false");
  assert.equal(topKey(OPS, "preview_urls"), "false");
  for (const key of ["compatibility_date", "compatibility_flags", "account_id"]) assert.equal(topKey(OPS, key), topKey(live, key), key);
  assert.match(OPS, /global_fetch_strictly_public/);
});

test("wrangler.ops.toml: assets ./out-ops, binding ASSETS, every request runs the Worker first, branded 404", () => {
  assert.deepEqual(block(OPS, "[assets]"), ['directory = "./out-ops"', 'binding = "ASSETS"', "run_worker_first = true", 'not_found_handling = "404-page"']);
  assert.equal((OPS.match(/^html_handling/gm) ?? []).length, 0, "html_handling is left at its default: no page HTML ships");
});

test("wrangler.ops.toml: exactly three bindings (ASSETS, AI, MEDIA on almar-media), no [vars], nothing key-like", () => {
  assert.deepEqual(block(OPS, "[ai]"), ['binding = "AI"']);
  assert.equal((OPS.match(/^\[\[r2_buckets\]\]$/gm) ?? []).length, 1);
  assert.deepEqual(block(OPS, "[[r2_buckets]]"), ['binding = "MEDIA"', 'bucket_name = "almar-media"']);
  const tables = OPS.split("\n").filter((l) => /^\[/.test(l));
  assert.deepEqual(tables, ["[assets]", "[ai]", "[[r2_buckets]]", "[[routes]]"]);
  assert.equal(/^\[vars\]/m.test(OPS), false);
  assert.equal(/eyJ|re_[A-Za-z0-9]{8,}|sk_(live|test)_|sb_secret_|sb_publishable_/.test(OPS), false, "nothing that looks like a key");
});

test("wrangler.ops.toml: one route, the dashboard host as a custom domain", () => {
  assert.equal((OPS.match(/^\[\[routes\]\]$/gm) ?? []).length, 1);
  assert.deepEqual(block(OPS, "[[routes]]"), ['pattern = "dashboard.almarprivatejourney.com"', "custom_domain = true"]);
  assert.deepEqual(OPS.split("\n").filter((l) => l.startsWith("pattern = ")), ['pattern = "dashboard.almarprivatejourney.com"']);
});

test("the two public Worker files bind only ASSETS and never name almar-ops or the dashboard host", () => {
  for (const file of ["wrangler.toml", "wrangler.preview.toml"]) {
    const text = readFileSync(file, "utf8");
    assert.equal(/almar-ops|dashboard\.almarprivatejourney|out-ops|almar-ops-routes/.test(text), false, file);
    assert.equal(/^\[ai\]|^\[\[r2_buckets\]\]|MEDIA/m.test(text), false, file);
    assert.equal(topKey(text, "main"), '"worker/almar.mjs"', file);
  }
});

test("the public Worker entry refuses an /api/ops path at startup and imports its constant from lib/server-routes.ts", () => {
  const source = readFileSync("worker/almar.mjs", "utf8");
  assert.match(source, /OPS_API_PREFIX/);
  assert.match(source, /path === "\/api\/ops" \|\| path\.startsWith\(OPS_API_PREFIX\)/);
  assert.ok(source.indexOf("OPS_API_PREFIX)") < source.indexOf("new Set(serverPaths)"));
});

test("lib/ops-routes.ts is a leaf module (no imports), so node tests, the assembler and the Worker load it directly", () => {
  const source = readFileSync("lib/ops-routes.ts", "utf8");
  assert.equal(/^import\s/m.test(source), false);
  assert.equal(/^export .*from /m.test(source), false);
});

// ---- the ops build target (Task 2) ------------------------------------------------------------------------------

function scratchDir(files) {
  const base = mkdtempSync(join(tmpdir(), "almar-ops-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), text);
  }
  return base;
}

function filesUnder(dir, base = dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, base, found);
    else found.push(full.slice(base.length + 1));
  }
  return found.sort();
}

/** A build output with pages, Framer bodies, the dashboard, public/ and static, as `next build` leaves it. */
function fixture() {
  return scratchDir({
    "app/index.html": "home",
    "app/ar.html": "home ar",
    "app/es.html": "home es",
    "app/private-stays.html": "stays",
    "app/ar/private-stays.html": "stays ar",
    "app/es/private-stays.html": "stays es",
    "app/about.body": "framer about",
    "app/dashboard.html": "dashboard",
    "app/dashboard/home.html": "dashboard home",
    "static/css/x.css": "body{}",
    "static/chunks/a.js": "1",
    "public/assets/logo.svg": "<svg/>",
    "public/favicon.ico": "x",
    "public/_redirects": "/services /experiences 301\n",
    "_headers": "/assets/*\n  Cache-Control: public\n",
  });
}

test("assembleOut({ pages: false }): public/ without its marketing _redirects, _next/static, the three branded 404s and _headers; no .html or .body page at all", () => {
  const base = fixture();
  const outDir = join(base, "out-ops");
  const report = assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir, publicDir: join(base, "public"), headersFile: join(base, "_headers"), pages: false });
  assert.deepEqual(filesUnder(outDir), [
    "404.html",
    "_headers",
    "_next/static/chunks/a.js",
    "_next/static/css/x.css",
    "ar/404.html",
    "assets/logo.svg",
    "es/404.html",
    "favicon.ico",
  ]);
  assert.deepEqual(report.framer, []);
  assert.deepEqual(report.react, { en: [], ar: [], es: [] });
  assert.deepEqual(report.notFound, ["404.html", "ar/404.html", "es/404.html"]);
  assert.equal(report.total, 3);
  assert.equal(readFileSync(join(outDir, "404.html"), "utf8").includes("<html"), true);
  assert.equal(existsSync(join(outDir, "_redirects")), false, "/services is the branded 404 on the ops host, not a redirect");
});

test("assembleOut({ pages: false }): _next/static is copied unconditionally, and a missing static folder stops the build", () => {
  const base = scratchDir({ "app/index.html": "home", "public/a.txt": "x" });
  const outDir = join(base, "out-ops");
  assert.throws(() => assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir, publicDir: join(base, "public"), pages: false }), /static/);
});

test("assembleOut({ pages: false }): public/ may still hold nothing under /api or a held section", () => {
  const base = scratchDir({ "app/index.html": "home", "static/css/x.css": "b", "public/api/x.json": "{}" });
  assert.throws(
    () => assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir: join(base, "out-ops"), publicDir: join(base, "public"), pages: false }),
    /only the Worker may answer/,
  );
});

test("assembleOut: with pages omitted it behaves exactly as before (the pages, the home link and index.html are required)", () => {
  const base = fixture();
  const outDir = join(base, "out");
  const report = assembleOut({ appDir: join(base, "app"), staticDir: join(base, "static"), outDir, publicDir: join(base, "public") });
  assert.ok(existsSync(join(outDir, "index.html")));
  assert.ok(existsSync(join(outDir, "private-stays.html")));
  assert.ok(existsSync(join(outDir, "_redirects")), "the public folder keeps its redirects");
  assert.equal(existsSync(join(outDir, "dashboard.html")), false, "the dashboard never reaches the public folder");
  assert.deepEqual(report.framer, ["about.html"]);
  const none = scratchDir({ "static/css/x.css": "b", "app/private-stays.html": "x" });
  assert.throws(() => assembleOut({ appDir: join(none, "app"), staticDir: join(none, "static"), outDir: join(none, "out"), publicDir: join(none, "public") }), /index\.html|English home/);
});

test("writeOpsPaths: writes opsPathsFrom's list next to the OpenNext worker as almar-ops-routes.json; refuses without the worker", () => {
  const base = scratchDir({
    "app-paths-manifest.json": JSON.stringify(Object.fromEntries(MANIFEST.map((k) => [k, "x"]))),
    ".open-next/worker.js": "export default {}",
  });
  const got = writeOpsPaths({ manifestFile: join(base, "app-paths-manifest.json"), openNextDir: join(base, ".open-next") });
  assert.deepEqual(got, WANT);
  assert.equal(readFileSync(join(base, ".open-next/almar-ops-routes.json"), "utf8"), `${JSON.stringify(WANT)}\n`);
  assert.equal(existsSync(join(base, ".open-next/almar-server-routes.json")), false, "the public list is a different file");
  const empty = scratchDir({ "app-paths-manifest.json": "{}" });
  assert.throws(() => writeOpsPaths({ manifestFile: join(empty, "app-paths-manifest.json"), openNextDir: join(empty, ".open-next") }), /did not finish/);
});

test("writeServerPaths and writeOpsPaths split one manifest: the public list holds no /api/ops path, the ops list no guest API", () => {
  const base = scratchDir({
    "app-paths-manifest.json": JSON.stringify(Object.fromEntries(MANIFEST.map((k) => [k, "x"]))),
    ".open-next/worker.js": "export default {}",
  });
  const args = { manifestFile: join(base, "app-paths-manifest.json"), openNextDir: join(base, ".open-next") };
  const pub = writeServerPaths(args);
  const ops = writeOpsPaths(args);
  assert.equal(pub.some((p) => p.startsWith("/api/ops")), false);
  assert.ok(pub.includes("/api/booking/quote") && pub.includes("/api/health"));
  assert.equal(ops.includes("/api/booking/quote"), false);
  assert.ok(ops.includes("/api/ops/stays") && ops.includes("/api/health"));
});

test("package.json gains exactly build:ops, which only builds; the other scripts are unchanged", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["build:ops"], "node scripts/assemble-cloudflare.mjs --target=ops");
  assert.equal(pkg.scripts["build:cloudflare"], "node scripts/assemble-cloudflare.mjs --target=production");
  assert.equal(pkg.scripts["build:preview"], "node scripts/assemble-cloudflare.mjs --target=preview");
  for (const [name, command] of Object.entries(pkg.scripts)) {
    assert.equal(/wrangler\s+(deploy|versions\s+upload|secret)|opennextjs-cloudflare\s+(deploy|upload|preview)|vercel/.test(command), false, `${name}: ${command}`);
  }
});

test(".gitignore keeps out-ops/ and the scratch .tmp/ out of git", () => {
  const lines = readFileSync(".gitignore", "utf8").split("\n");
  assert.ok(lines.includes("/out-ops/"));
  assert.ok(lines.includes("/.tmp/"));
});

test("the assembler builds the ops target from wrangler.ops.toml, with no pages, and writes the ops list instead of the public one", () => {
  const source = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  assert.match(source, /"wrangler\.ops\.toml"/);
  assert.match(source, /pages: target !== "ops"/);
  assert.match(source, /almar-ops-routes\.json/);
  assert.match(source, /target === "ops" \? writeOpsPaths\(/);
});

test("opsTestConfig: wrangler.ops.toml without [ai] and without the route, paths relative to .tmp/, R2 and ASSETS kept", () => {
  const copy = opsTestConfig(OPS);
  assert.equal(/^\[ai\]/m.test(copy) || /AI/.test(copy.replace(/^#.*$/gm, "")), false, "no AI binding in the local copy");
  assert.equal(/^\[\[routes\]\]|custom_domain|pattern = /m.test(copy), false, "no route in the local copy");
  assert.match(copy, /^main = "\.\.\/worker\/almar-ops\.mjs"$/m);
  assert.match(copy, /^directory = "\.\.\/out-ops"$/m);
  assert.match(copy, /^binding = "ASSETS"$/m);
  assert.match(copy, /^run_worker_first = true$/m);
  assert.deepEqual(block(copy, "[[r2_buckets]]"), ['binding = "MEDIA"', 'bucket_name = "almar-media"']);
  assert.equal(topKey(copy, "name"), '"almar-ops"');
  // Everything else is the real file's: same flags, date and account.
  for (const key of ["compatibility_date", "compatibility_flags", "account_id", "workers_dev", "preview_urls"]) assert.equal(topKey(copy, key), topKey(OPS, key), key);
});

test("opsTestConfig: a wrangler.ops.toml that lost the lines it rewrites stops the script instead of writing a wrong copy", () => {
  assert.throws(() => opsTestConfig(OPS.replace('main = "worker/almar-ops.mjs"', 'main = "worker/other.mjs"')), /rewrites/);
  assert.throws(() => opsTestConfig(OPS.replace('directory = "./out-ops"', 'directory = "./out"')), /rewrites/);
  assert.throws(() => opsTestConfig(OPS.replace('binding = "MEDIA"', 'binding = "OTHER"')), /MEDIA/);
});
