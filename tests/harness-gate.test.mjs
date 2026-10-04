import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const page = readFileSync("app/%5F%5Fharness/page.tsx", "utf8");
const assemble = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
const pw = readFileSync("playwright.config.ts", "utf8");

test("page calls notFound() unless ALMAR_HARNESS is 1, and is force-dynamic", () => {
  const gate = page.indexOf('process.env.ALMAR_HARNESS !== "1"');
  assert.ok(gate > -1);
  assert.match(page.slice(gate, gate + 80), /notFound\(\)/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.equal((page.match(/ALMAR_HARNESS/g) ?? []).length, 1);
  // The gate runs before any data is read.
  assert.ok(gate < page.indexOf("await searchParams"));
});

test("page imports no scene or fixture data at module top", () => {
  assert.equal(/^import .*(tests\/|fixtures)/m.test(page), false);
});

test("assemble step never names the harness, copies .body files, and copies .html only for public pages", () => {
  assert.equal(/harness/i.test(assemble), false);
  assert.match(assemble, /endsWith\("\.body"\)/);
  assert.equal((assemble.match(/copyFileSync/g) ?? []).length >= 1, true);
  assert.match(assemble, /matchPublicPage/);
});

test("ALMAR_HARNESS is set only inside webServer.env", () => {
  assert.equal((pw.match(/ALMAR_HARNESS/g) ?? []).length, 1);
  assert.match(pw, /webServer:\s*\{[\s\S]*env:\s*\{\s*ALMAR_HARNESS: "1"/);
});

test("nothing outside the harness folder and tests links to /__harness", () => {
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".git", "out", "tests", ".planning", "test-results"].includes(name)) continue;
      const full = path.join(dir, name);
      if (full === path.join("app", "%5F%5Fharness")) continue;
      // Job 10: lib/server-routes.ts names the harness in HELD_PATHS, a deny-list entry, not a link.
      if (full === path.join("lib", "server-routes.ts")) continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(tsx?|mjs|cjs|js|json|html|xml|txt)$/.test(name) && readFileSync(full, "utf8").includes("__harness")) hits.push(full);
    }
  };
  for (const d of ["app", "components", "lib", "scripts", "public"]) {
    try { walk(d); } catch {}
  }
  assert.deepEqual(hits, []);
});
