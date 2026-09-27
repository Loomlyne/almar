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

test("app/page.tsx does not exist", () => {
  assert.equal(existsSync("app/page.tsx"), false);
});

test("app/route.ts is the GET handler for /", () => {
  assert.equal(existsSync("app/route.ts"), true);
  const source = readFileSync("app/route.ts", "utf8");
  assert.match(source, /export (async )?function GET\b/);
  assert.match(source, /new Response\(/);
});

test("no file under app/dashboard or lib is named seed", () => {
  const hits = [];
  namedSeed("app/dashboard", hits);
  namedSeed("lib", hits);
  assert.deepEqual(hits, []);
});

test("app/route.ts is not imported by a new app/page.tsx", () => {
  assert.equal(existsSync("app/page.tsx"), false);
  if (existsSync("app/page.tsx")) {
    const page = readFileSync("app/page.tsx", "utf8");
    assert.equal(page.includes("app/route.ts") || page.includes("./route"), false);
  }
});
