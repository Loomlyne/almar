// PLAT-03 (plan 06-02 Task 5): no app route.ts serves a page. Every route.ts under app/ is an API, auth or newsletter
// handler: none outside app/api/**, app/auth/** and app/newsletter/route.ts; none answers text/html; none reads a .html
// file (the old Framer route.ts pages did both). Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

function routeFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...routeFiles(path));
    else if (name === "route.ts" || name === "route.tsx" || name === "route.js") out.push(relative(".", path).split(sep).join("/"));
  }
  return out;
}

const ROUTES = routeFiles("app");
const allowed = (file) => file.startsWith("app/api/") || file.startsWith("app/auth/") || file === "app/newsletter/route.ts";

test("every route file lives under app/api, app/auth or is app/newsletter/route.ts", () => {
  assert.ok(ROUTES.length > 0);
  assert.deepEqual(ROUTES.filter((file) => !allowed(file)), []);
});

test("no route file answers text/html or reads a .html file", () => {
  for (const file of ROUTES) {
    const src = readFileSync(file, "utf8");
    assert.equal(/text\/html/i.test(src), false, `${file}: answers text/html`);
    assert.equal(/\.html["'`]/.test(src), false, `${file}: reads a .html file`);
  }
});
