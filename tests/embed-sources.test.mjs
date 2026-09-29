import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ENTRY = "lib/framer-hero-booker-mount.tsx";
const ROUTE = "app/embed/hero-booker/route.ts";

function resolveRelative(from, spec) {
  const base = path.normalize(path.join(path.dirname(from), spec));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

export function reachable(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    const re = /(?:import|export)\s[^"';]*?from\s*["'](\.[^"']*)["']|import\s*["'](\.[^"']*)["']/g;
    for (const m of text.matchAll(re)) {
      const target = resolveRelative(file, m[1] ?? m[2]);
      if (target) queue.push(target);
    }
  }
  return [...seen].sort();
}

export function listedSources(routeText) {
  const block = routeText.match(/const SOURCES = \[([\s\S]*?)\];/);
  assert.ok(block, "SOURCES array not found");
  return new Set([...block[1].matchAll(/"([^"]+\.tsx?)"/g)].map((m) => m[1]));
}

test("every file the embed bundle imports is listed in SOURCES", () => {
  const listed = listedSources(readFileSync(ROUTE, "utf8"));
  for (const file of reachable(ENTRY)) {
    if (file === ENTRY) continue;
    assert.ok(listed.has(file), `${file} is imported by the bundle but missing from SOURCES`);
  }
});

test("the check fails when lib/cn.ts is dropped from SOURCES", () => {
  const text = readFileSync(ROUTE, "utf8").replace(/^.*"lib\/cn\.ts".*\n/m, "");
  const listed = listedSources(text);
  assert.equal(listed.has("lib/cn.ts"), false);
  assert.ok(reachable(ENTRY).includes("lib/cn.ts"));
});
