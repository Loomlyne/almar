import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function namedSeed(dir, hits) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      namedSeed(path, hits);
      continue;
    }
    const stem = name.replace(/\.[^.]+$/, "");
    if (stem === "seed") hits.push(path);
  }
}

// 3.3 plan 04 (design 7.12, inverted): the home is a React page now, in all three locales. The Framer home
// route handler is gone; Next refuses a route.ts and a page.tsx in one segment.
test("app/page.tsx exists and renders the shared HomePage for English", () => {
  assert.equal(existsSync("app/page.tsx"), true);
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /<HomePage locale="en" \/>/);
  assert.match(page, /export const dynamic = "force-static"/);
  assert.match(page, /generateMetadata/);
});

test("app/route.ts does not exist", () => {
  assert.equal(existsSync("app/route.ts"), false);
});

test("no file under app/dashboard or lib is named seed", () => {
  const hits = [];
  namedSeed("app/dashboard", hits);
  namedSeed("lib", hits);
  assert.deepEqual(hits, []);
});

test("no home route file imports app/route.ts or ./route", () => {
  for (const file of ["app/page.tsx", "app/ar/page.tsx", "app/es/page.tsx"]) {
    assert.equal(existsSync(file), true, file);
    const page = readFileSync(file, "utf8");
    assert.equal(page.includes("app/route.ts") || page.includes("./route"), false, file);
  }
});
