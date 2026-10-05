// The dev Playwright config (playwright.config.ts) must list browser specs only. Without a testMatch, Playwright's default
// pattern also loads tests/*.test.mjs (the node:test files) as browser tests; they fail on relative paths and bundling
// ("ENOENT tokens.json", "Could not resolve react") and the run ends with 0 tests, so a bare `npx playwright test` ran nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function walk(dir, found = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walk(full, found);
    else found.push(relative(join(ROOT, "tests"), full).split("\\").join("/"));
  }
  return found;
}

/** The testMatch regular expression literal and the testIgnore globs, read out of the config text. */
function readConfig(file) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const m = /testMatch:\s*\/(.+)\/([a-z]*)\s*,/.exec(text);
  const ignore = /testIgnore:\s*\[([^\]]*)\]/.exec(text);
  return {
    testMatch: m ? new RegExp(m[1], m[2]) : null,
    testIgnore: ignore ? [...ignore[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [],
  };
}

const files = walk(join(ROOT, "tests"));
const outsideBuild = files.filter((f) => !f.startsWith("build/"));

test("playwright.config.ts sets testMatch, so the node:test files are not loaded as browser tests", () => {
  const { testMatch } = readConfig("playwright.config.ts");
  assert.ok(testMatch, "playwright.config.ts has no testMatch regular expression");
  const nodeTests = outsideBuild.filter((f) => f.endsWith(".test.mjs"));
  assert.ok(nodeTests.length > 50, `expected the node test files, saw ${nodeTests.length}`);
  assert.deepEqual(nodeTests.filter((f) => testMatch.test(f)), [], "a node:test file matches testMatch");
});

test("playwright.config.ts matches every spec file outside tests/build and keeps build/** ignored", () => {
  const { testMatch, testIgnore } = readConfig("playwright.config.ts");
  assert.ok(testMatch);
  const specs = outsideBuild.filter((f) => /\.spec\.[a-z]+$/.test(f));
  assert.ok(specs.length >= 20, `expected the dev specs, saw ${specs.length}`);
  assert.deepEqual(specs.filter((f) => !testMatch.test(f)), [], "a spec file is not matched by testMatch");
  assert.ok(testIgnore.includes("build/**"), "testIgnore must keep build/**");
});

test("the only spec extension outside tests/build is .spec.ts (testMatch lists exactly that)", () => {
  const exts = new Set(outsideBuild.filter((f) => /\.spec\./.test(f)).map((f) => f.replace(/^.*\.spec/, ".spec")));
  assert.deepEqual([...exts], [".spec.ts"]);
});

test("playwright.build.config.ts has the same guard: testMatch on specs, under tests/build", () => {
  const { testMatch } = readConfig("playwright.build.config.ts");
  assert.ok(testMatch, "playwright.build.config.ts has no testMatch regular expression");
  const inBuild = files.filter((f) => f.startsWith("build/"));
  assert.deepEqual(inBuild.filter((f) => f.endsWith(".test.mjs") && testMatch.test(f)), []);
  assert.deepEqual(inBuild.filter((f) => f.endsWith(".spec.ts") && !testMatch.test(f)), []);
});
