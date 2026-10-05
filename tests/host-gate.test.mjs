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
  assert.match(layout, /<OpsShell mode="ops">\{null\}<\/OpsShell>/);
  const shell = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.match(shell, /copy\.notReady/);
});

test("a rewrite target that comes back through middleware is served, not redirected again", () => {
  const again = routeFor({ host: "dashboard.almarprivatejourney.com", path: "/dashboard/bookings", isOwner: false, production: true, rewritten: true });
  assert.deepEqual(again, { kind: "next" });
});
