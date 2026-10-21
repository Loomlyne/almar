// Job 20 (2026-10-21): Next.js 16 on OpenNext Cloudflare. Research: .planning/quick/261021-next16-upgrade/RESEARCH.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const assemble = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");

test("Next 16 is supported by OpenNext: the build never passes the unsupported-version flag (PR #27's stopgap is gone)", () => {
  assert.match(pkg.dependencies.next, /^16\./);
  assert.equal(assemble.includes("dangerouslyUseUnsupportedNextVersion"), false);
  assert.equal(assemble.includes("dangerously-use-unsupported-next-version"), false);
});

test("next.config.ts keeps a webpack rule (markup SVGs), so next dev and next build run webpack, not Turbopack", () => {
  assert.match(readFileSync("next.config.ts", "utf8"), /webpack\(config\)/);
  // OpenNext runs `npm run build`; a bare `next build` on Next 16 picks Turbopack and fails on a webpack config.
  assert.equal(pkg.scripts.build, "next build --webpack");
  assert.equal(pkg.scripts.dev, "next dev --webpack");
});

test("middleware.ts stays (edge runtime): proxy.ts is Node-only, which OpenNext Cloudflare runs only experimentally", () => {
  assert.equal(existsSync("middleware.ts"), true);
  assert.equal(existsSync("proxy.ts"), false);
  const source = readFileSync("middleware.ts", "utf8");
  assert.match(source, /export async function middleware\(/);
  assert.equal(/export const runtime/.test(source), false, "a runtime export would make it Node middleware");
});
