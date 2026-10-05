import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OPS_AUTH_PATHS, OPS_LIVE_SECTIONS, OPS_PATH_HEADER, assertOpsPath, isLiveOpsPath, opsPathsFrom } from "../lib/ops-routes.ts";
import { OPS_API_PREFIX, serverPathsFrom } from "../lib/server-routes.ts";

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
  "/auth/confirm/route",
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

test("opsPathsFrom: every OPS_AUTH_PATHS route and /api/health must be in the manifest", () => {
  assert.deepEqual([...OPS_AUTH_PATHS], ["/auth/confirm", "/auth/handoff", "/auth/sign-out"]);
  for (const missing of ["/auth/confirm/route", "/auth/handoff/route", "/auth/sign-out/route", "/api/health/route"]) {
    assert.throws(() => opsPathsFrom(MANIFEST.filter((k) => k !== missing)), new RegExp(missing.replace(/\//g, "\\/")), missing);
  }
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

test("worker/almar-ops.mjs imports exactly the OpenNext worker, the generated list, the ops rules and the router", () => {
  const source = readFileSync("worker/almar-ops.mjs", "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../.open-next/worker.js", "../.open-next/almar-ops-routes.json", "../lib/ops-routes.ts", "./handle.mjs"]);
  // The startup check runs before the list becomes the Set the router uses.
  assert.ok(source.indexOf("assertOpsPath(") > -1 && source.indexOf("assertOpsPath(") < source.indexOf("new Set("));
  assert.match(source, /handle\(request, env, ctx, \{ serverPaths: OPS_PATHS, nextFetch: openNext\.fetch\.bind\(openNext\) \}\)/);
  // No host check in the Worker: only the custom domain routes to it.
  assert.equal(/\.hostname|\.host\b|headers\.get\("host"\)/.test(source), false);
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
