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

// PR #28 finding 4: OpenNext 1.20.12 reads the project's .env files with @dotenvx/dotenvx 2.x (1.20.6: 1.x) and writes
// .open-next/cloudflare/next-env.mjs, the file assertNoBundledEnv reads. Run the installed compiler, not a copy.
test("OpenNext's next-env.mjs: no .env file → empty blocks pass the guard; shell variables never enter it; a .env value stops the build", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { assertNoBundledEnv } = await import("../scripts/assemble-cloudflare.mjs");
  const { compileEnvFiles } = await import(
    pathToFileURL(resolve("node_modules/@opennextjs/cloudflare/dist/cli/build/open-next/compile-env-files.js")).href
  );
  const compile = (files) => {
    const app = mkdtempSync(join(tmpdir(), "almar-next-env-"));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(app, name), body);
    compileEnvFiles({ outputDir: join(app, ".open-next"), monorepoRoot: app, appPath: app });
    return join(app, ".open-next", "cloudflare", "next-env.mjs");
  };
  const saved = process.env.ALMAR_JOB20_SHELL;
  process.env.ALMAR_JOB20_SHELL = "shell-value-xyz";
  try {
    // .env.example is not one of the files OpenNext reads (.env, .env.<mode>, .env.local, .env.<mode>.local).
    const clean = compile({ ".env.example": "ALMAR_JOB20_EXAMPLE=1\nALMAR_JOB20_SHELL=x\n" });
    assertNoBundledEnv(clean);
    assert.equal(readFileSync(clean, "utf8").includes("shell-value-xyz"), false, "the build shell is not copied into next-env.mjs");
    for (const name of [".env", ".env.local", ".env.production", ".env.production.local", ".env.development"]) {
      const file = compile({ [name]: "ALMAR_JOB20_SECRET=value-abc\n" });
      assert.throws(() => assertNoBundledEnv(file), /ALMAR_JOB20_SECRET/, `${name} must stop the build`);
    }
  } finally {
    if (saved === undefined) delete process.env.ALMAR_JOB20_SHELL;
    else process.env.ALMAR_JOB20_SHELL = saved;
  }
});
