import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { allowHostOverride, isOpsHost, opsOrigin, routeFor } from "../lib/host.ts";

test("isOpsHost: only the ops host and dashboard.localhost", () => {
  assert.equal(isOpsHost("dashboard.almarprivatejourney.com"), true);
  assert.equal(isOpsHost("DASHBOARD.almarprivatejourney.com:443"), true);
  assert.equal(isOpsHost("dashboard.localhost:3010", "development"), true);
  assert.equal(isOpsHost("dashboard.localhost:3010", "production"), false);
  assert.equal(isOpsHost("dashboard.almarprivatejourney.com", "production"), true);
  for (const host of ["almarprivatejourney.com", "www.almarprivatejourney.com", "dashboard.almarprivatejourney.com.evil.com", "evil-dashboard.almarprivatejourney.com", "", null]) {
    assert.equal(isOpsHost(host), false, String(host));
  }
});

test("the x-almar-host override is off in production", () => {
  assert.equal(allowHostOverride("production"), false);
  assert.equal(allowHostOverride("development"), true);
  assert.equal(allowHostOverride("test"), true);
});

const ops = (path, isOwner = false) => routeFor({ host: "dashboard.almarprivatejourney.com", path, isOwner, production: true });
const pub = (path, production = true) => routeFor({ host: "almarprivatejourney.com", path, isOwner: true, production });

test("ops host: / is Home for the owner and the sign-in for anyone else", () => {
  assert.deepEqual(ops("/", true), { kind: "rewrite", path: "/dashboard/home" });
  assert.deepEqual(ops("/", false), { kind: "rewrite", path: "/dashboard" });
  assert.deepEqual(ops("/sign-in", true), { kind: "rewrite", path: "/dashboard" });
});

test("ops host: sections are served without /dashboard in the URL", () => {
  assert.deepEqual(ops("/bookings"), { kind: "rewrite", path: "/dashboard/bookings" });
  assert.deepEqual(ops("/catalog/stays"), { kind: "rewrite", path: "/dashboard/catalog/stays" });
  assert.deepEqual(ops("/dashboard/bookings"), { kind: "redirect", path: "/bookings" });
  assert.deepEqual(ops("/dashboard"), { kind: "redirect", path: "/" });
  assert.deepEqual(ops("/auth/confirm"), { kind: "next" });
  assert.deepEqual(ops("/auth/handoff"), { kind: "next" });
});

test("ops host never falls through to the marketing pages", () => {
  for (const path of ["/private-stays", "/login", "/account", "/contact"]) {
    assert.equal(ops(path).kind, "rewrite", path);
    assert.match(ops(path).path, /^\/dashboard\//, path);
  }
});

test("marketing host: /dashboard and /ops are 404 in production, open on the dev server", () => {
  for (const path of ["/dashboard", "/dashboard/home", "/Dashboard/bookings", "/ops", "/ops/anything"]) {
    assert.deepEqual(pub(path), { kind: "not-found" }, path);
  }
  assert.deepEqual(pub("/dashboard/bookings", false), { kind: "next" });
  assert.deepEqual(pub("/"), { kind: "next" });
  assert.deepEqual(pub("/operations-guide"), { kind: "next" });
  assert.deepEqual(pub("/dashboards"), { kind: "next" });
});

test("the handoff only ever targets the ops host", () => {
  assert.equal(opsOrigin("almarprivatejourney.com", "production"), "https://dashboard.almarprivatejourney.com");
  assert.equal(opsOrigin("127.0.0.1:3010", "production"), "https://dashboard.almarprivatejourney.com");
  assert.equal(opsOrigin("evil.com", "development"), "https://dashboard.almarprivatejourney.com");
  assert.equal(opsOrigin("127.0.0.1:3010", "development"), "http://dashboard.localhost:3010");
});

test("middleware reads Host, sets the shell header itself, and drops a client copy", () => {
  const source = readFileSync("middleware.ts", "utf8");
  assert.match(source, /allowHostOverride\(nodeEnv\) \? request\.headers\.get\(HOST_OVERRIDE_HEADER\) : null/);
  assert.match(source, /forwarded\.delete\(SHELL_HEADER\)/);
  assert.match(source, /routeFor\(/);
});

test("no /ops route exists and wrangler files name no ops host", () => {
  assert.equal(existsSync("app/ops"), false);
  for (const path of ["wrangler.toml", "wrangler.preview.toml"]) {
    assert.equal(/dashboard\./.test(readFileSync(path, "utf8")), false, path);
  }
});

test("the (ops) layout is the owner gate and pages carry no gate of their own", () => {
  const layout = readFileSync("app/dashboard/(ops)/layout.tsx", "utf8");
  assert.equal(layout.includes("use client"), false);
  assert.match(layout, /isOwnerProfile\(await readSessionProfile\(\)\)/);
  assert.match(layout, /redirect\("\/sign-in"\)/);
  assert.match(layout, /if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/);
  // Plan 03.2-03: a section's page renders only when lib/ops-routes.ts lists it; else job 02's "Not ready." state.
  assert.match(layout, /<OpsShell mode="ops">\{isLiveOpsPath\(path\) \? children : null\}<\/OpsShell>/);
  const shell = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.match(shell, /copy\.notReady/);
});

test("a rewrite target that comes back through middleware is served, not redirected again", () => {
  const again = routeFor({ host: "dashboard.almarprivatejourney.com", path: "/dashboard/bookings", isOwner: false, production: true, rewritten: true });
  assert.deepEqual(again, { kind: "next" });
});

// ---- plan 03.2-03: the API on the ops host, the third wall on the marketing host, the live-section gate ---------

test("ops host: /api/* is served as it is (a pass-through), not rewritten to /dashboard/api/*", () => {
  for (const path of ["/api/ops/stays", "/api/ops/publish", "/api/health", "/api/anything", "/api"]) {
    assert.deepEqual(ops(path, true), { kind: "next" }, path);
    assert.deepEqual(ops(path, false), { kind: "next" }, path);
  }
  // Only the exact prefix: these are still sections of the dashboard.
  for (const path of ["/apiary", "/apis", "/api-keys"]) assert.equal(ops(path).kind, "rewrite", path);
});

test("marketing host: /api/ops and /api/ops/* are 404 in production (third wall), open on the dev server", () => {
  for (const path of ["/api/ops", "/api/ops/stays", "/api/ops/publish", "/API/ops/stays", "/api/ops/a/b"]) {
    assert.deepEqual(pub(path), { kind: "not-found" }, path);
    assert.deepEqual(pub(path, false), { kind: "next" }, `${path} on the dev server`);
  }
  for (const host of ["www.almarprivatejourney.com", "preview.almarprivatejourney.com", "127.0.0.1:3010"]) {
    assert.deepEqual(routeFor({ host, path: "/api/ops/stays", isOwner: true, production: true }), { kind: "not-found" }, host);
  }
  // Every other /api path is untouched.
  for (const path of ["/api/health", "/api/operations", "/api/ops-x", "/api/booking/quote", "/api/stripe/webhook"]) {
    assert.deepEqual(pub(path), { kind: "next" }, path);
  }
});

test("routeFor: the existing ops-host and marketing-host cases are unchanged by the /api rules", () => {
  assert.deepEqual(ops("/", true), { kind: "rewrite", path: "/dashboard/home" });
  assert.deepEqual(ops("/bookings"), { kind: "rewrite", path: "/dashboard/bookings" });
  assert.deepEqual(ops("/dashboard/bookings"), { kind: "redirect", path: "/bookings" });
  assert.deepEqual(ops("/auth/confirm"), { kind: "next" });
  assert.deepEqual(pub("/dashboard/home"), { kind: "not-found" });
  assert.deepEqual(pub("/ops"), { kind: "not-found" });
});

test("lib/host.ts stays import-free (the middleware, the layout and the node tests load it directly)", () => {
  assert.equal(/^import\s/m.test(readFileSync("lib/host.ts", "utf8")), false);
});

test("middleware sets x-almar-ops-path on the ops host to the browser path before any rewrite, and drops a client copy on every host", () => {
  const source = readFileSync("middleware.ts", "utf8");
  assert.match(source, /import \{ OPS_PATH_HEADER \} from "\.\/lib\/ops-routes";/);
  const del = source.indexOf("forwarded.delete(OPS_PATH_HEADER)");
  const shellDel = source.indexOf("forwarded.delete(SHELL_HEADER)");
  const set = source.indexOf("forwarded.set(OPS_PATH_HEADER, request.nextUrl.pathname)");
  const route = source.indexOf("routeFor(");
  assert.ok(shellDel > -1 && del > shellDel, "the client copy is dropped with the shell header's");
  assert.ok(set > del && set < route, "set after the delete, before the route is computed");
  // The set is inside the ops-host branch, never unconditional.
  assert.match(source, /if \(isOpsHost\(host\)\) \{\s*forwarded\.set\(SHELL_HEADER, "ops"\);\s*forwarded\.set\(OPS_PATH_HEADER, request\.nextUrl\.pathname\);\s*\}/);
});

test("the (ops) layout renders a section's page only when isLiveOpsPath says so, and keeps the other two branches", () => {
  const layout = readFileSync("app/dashboard/(ops)/layout.tsx", "utf8");
  assert.match(layout, /import \{ OPS_PATH_HEADER, isLiveOpsPath \} from "\.\.\/\.\.\/\.\.\/lib\/ops-routes";/);
  assert.match(layout, /const requestHeaders = await headers\(\);/);
  assert.match(layout, /const path = requestHeaders\.get\(OPS_PATH_HEADER\) \?\? "";/);
  // Order: owner gate first, then the live check; the preview shell and the production 404 are untouched.
  assert.ok(layout.indexOf('redirect("/sign-in")') < layout.indexOf("isLiveOpsPath(path)"));
  assert.match(layout, /<OpsShell mode="preview">\{children\}<\/OpsShell>/);
  assert.match(layout, /if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/);
  assert.equal((layout.match(/\{children\}/g) ?? []).length, 1, "children are rendered bare in the preview branch only");
  assert.equal((layout.match(/\? children : null/g) ?? []).length, 1, "and behind the live-section gate on the ops host, nowhere else");
});

test("no ops section is live in this plan: OPS_LIVE_SECTIONS is empty, so the owner sees Not ready everywhere", async () => {
  const { OPS_LIVE_SECTIONS, isLiveOpsPath } = await import("../lib/ops-routes.ts");
  assert.deepEqual([...OPS_LIVE_SECTIONS], []);
  for (const path of ["/", "/home", "/bookings", "/catalog/stays", "/dashboard/settings"]) assert.equal(isLiveOpsPath(path), false, path);
});

// ---- Fable review of 7527f88: a trailing dot is the same host --------------------------------------------------

test("isOpsHost: one trailing dot (and a port after it) is still the ops host; nothing else becomes it", () => {
  for (const host of ["dashboard.almarprivatejourney.com.", "DASHBOARD.almarprivatejourney.com.", "dashboard.almarprivatejourney.com.:443", " dashboard.almarprivatejourney.com. "]) {
    assert.equal(isOpsHost(host, "production"), true, JSON.stringify(host));
    assert.equal(isOpsHost(host), true, JSON.stringify(host));
  }
  // The fail-closed direction stays: only one dot, only this name.
  for (const host of [
    "dashboard.almarprivatejourney.com..",
    "dashboard.almarprivatejourney.com..:443",
    ".dashboard.almarprivatejourney.com",
    ".",
    "dashboard.almarprivatejourney.com.evil.com",
    "dashboard.almarprivatejourney.com.evil.com.",
    "evil.dashboard.almarprivatejourney.com.",
    "almarprivatejourney.com.",
    "www.almarprivatejourney.com.",
  ]) {
    assert.equal(isOpsHost(host, "production"), false, JSON.stringify(host));
  }
  // dashboard.localhost stays a dev and test name only, with or without the dot.
  assert.equal(isOpsHost("dashboard.localhost.", "production"), false);
  assert.equal(isOpsHost("dashboard.localhost.:3010", "development"), true);
});

test("routeFor: a trailing-dot ops host is routed as the ops host, a trailing-dot marketing host as the marketing host", () => {
  const dotted = (path, isOwner = false) => routeFor({ host: "dashboard.almarprivatejourney.com.", path, isOwner, production: true });
  assert.deepEqual(dotted("/", true), { kind: "rewrite", path: "/dashboard/home" });
  assert.deepEqual(dotted("/catalog/stays"), { kind: "rewrite", path: "/dashboard/catalog/stays" });
  assert.deepEqual(dotted("/api/health"), { kind: "next" });
  assert.deepEqual(dotted("/dashboard/bookings"), { kind: "redirect", path: "/bookings" });
  assert.deepEqual(routeFor({ host: "almarprivatejourney.com.", path: "/dashboard", isOwner: true, production: true }), { kind: "not-found" });
  assert.deepEqual(routeFor({ host: "almarprivatejourney.com.", path: "/api/ops/stays", isOwner: true, production: true }), { kind: "not-found" });
});
