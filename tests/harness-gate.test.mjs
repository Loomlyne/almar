import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const page = readFileSync("app/%5F%5Fharness/page.tsx", "utf8");
const assemble = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
const pw = readFileSync("playwright.config.ts", "utf8");
const client = readFileSync("app/%5F%5Fharness/harness-client.tsx", "utf8");

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

// ---- plan 03.2-12 (3.1 leftover 5): the harness test code stays out of the production build ----------------------

test("harness-client imports no test code at the top; fixtures and scenes load only inside a NODE_ENV !== production branch", () => {
  assert.equal(/^import [^;]*from ["'][^"']*tests\//m.test(client.replace(/^import type .*$/gm, "")), false, "a value import from tests/ at module top");
  const gate = client.indexOf('if (process.env.NODE_ENV !== "production") {');
  assert.ok(gate > -1, "the dev-only branch is missing");
  const branch = client.slice(gate);
  assert.match(branch, /await import\("\.\.\/\.\.\/tests\/journey\/fixtures"\)/);
  assert.match(branch, /await import\(`\.\.\/\.\.\/tests\/journey\/scenes\/\$\{c\}`\)/);
  // Outside that branch neither import appears.
  const outside = client.slice(0, gate);
  assert.equal(/import\([^)]*tests\/journey/.test(outside), false);
  assert.equal(/tests\/journey\/fixtures/.test(outside.replace(/^import type .*$/gm, "")), false);
  // In production the component renders the unknown-scene line.
  assert.match(client, /data-testid="harness-unknown"/);
});

test("after a production build, no harness scene and no test fixture is in .next/ (skips without one)", (t) => {
  const built = existsSync(".next/BUILD_ID") && !existsSync(".next/static/development");
  if (!built) return t.skip("no production build in .next/ (run npm run build first)");
  // A string unique to the _smoke scene, one from a scene state name, and one from fixtures.ts.
  const needles = ["Smoke heading", "harness-smoke", "ALMAR-000000", "tests/journey/fixtures"];
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "cache" && dir === ".next") continue; // webpack's build cache keeps sources; it is not shipped
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs|json|html|rsc|body|txt|map)$/.test(name)) {
        const text = readFileSync(full, "utf8");
        for (const needle of needles) if (text.includes(needle)) hits.push(`${full}: ${needle}`);
      }
    }
  };
  for (const d of [".next/static", ".next/server"]) if (existsSync(d)) walk(d);
  assert.deepEqual(hits, []);
});
