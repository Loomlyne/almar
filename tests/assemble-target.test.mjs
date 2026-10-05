import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Plan 03.3-08, Task 3: what scripts/assemble-cloudflare.mjs does with --target, run as a real process on a scratch
// copy of the scripts and lib folders. No build runs (a refused target stops before the OpenNext build), nothing is
// deployed, and the real out/ and out-preview/ are never touched.

const SOURCE = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");

function scratch({ placeholder = false, publicFile = null } = {}) {
  // realpath: the assembler runs main() only when argv[1] equals its own resolved path, and /var is a link to /private/var.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "almar-target-")));
  cpSync("scripts", join(root, "scripts"), { recursive: true });
  cpSync("lib", join(root, "lib"), { recursive: true });
  cpSync("deploy", join(root, "deploy"), { recursive: true });
  cpSync("_headers", join(root, "_headers"));
  mkdirSync(join(root, "public"));
  if (publicFile) writeFileSync(join(root, "public", publicFile), "x");
  // A build must not be reachable from here: no node_modules, so the OpenNext binary (job 10) cannot run.
  if (placeholder) {
    const file = join(root, "lib", "data", "media.ts");
    const text = readFileSync(file, "utf8")
      .replace(/^export const MEDIA_BASE_URL = "[^"]*";/m, 'export const MEDIA_BASE_URL = "https://media-pending.invalid";')
      .replace(/^export const MEDIA_BASE_URL_IS_PLACEHOLDER = (true|false);/m, "export const MEDIA_BASE_URL_IS_PLACEHOLDER = true;");
    writeFileSync(file, text);
  }
  return root;
}

// Plan 03.2-02: an assembled target now also needs the two public Supabase names in the shell (dataSourceFor). These tests
// are about the older refusals (media host, public/ files), so the child gets a shell that holds exactly those two names
// (dummy public values, nothing is ever called) and nothing else of ALMAR_*, NEXT_PUBLIC_* or service-role. The refusal
// for a missing name has its own tests in tests/data-source.test.mjs.
function childEnv() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("ALMAR_") || name.startsWith("NEXT_PUBLIC_") || /SERVICE_ROLE/i.test(name)) delete env[name];
  }
  return { ...env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1", NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-public-value" };
}

function run(root, args) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "assemble-cloudflare.mjs"), ...args], { cwd: root, encoding: "utf8", timeout: 60_000, env: childEnv() });
  return { status: result.status, text: `${result.stdout}\n${result.stderr}`, root };
}

const folders = (root) => ({ out: existsSync(join(root, "out")), preview: existsSync(join(root, "out-preview")) });

test("a mistyped target stops the assembler before any build or folder", () => {
  const root = scratch();
  const result = run(root, ["--target=previw"]);
  assert.notEqual(result.status, 0);
  assert.match(result.text, /previw/);
  assert.doesNotMatch(result.text, /npm run build|opennextjs-cloudflare|Creating an optimized/);
  assert.deepEqual(folders(root), { out: false, preview: false });
});

test("an unknown option stops the assembler too", () => {
  const result = run(scratch(), ["--traget=preview"]);
  assert.notEqual(result.status, 0);
  assert.match(result.text, /--traget=preview/);
});

for (const target of ["preview", "production"]) {
  test(`--target=${target} is refused while the media host is a placeholder, before any build or folder`, () => {
    const root = scratch({ placeholder: true });
    const result = run(root, [`--target=${target}`]);
    assert.notEqual(result.status, 0);
    assert.match(result.text, /media host is a placeholder/);
    assert.doesNotMatch(result.text, /npm run build|opennextjs-cloudflare|Creating an optimized/);
    assert.deepEqual(folders(root), { out: false, preview: false }, "a refused run leaves no folder");
  });
}

test("--target=local does not run the media check (it gets as far as the build, which this scratch copy cannot run)", () => {
  const result = run(scratch({ placeholder: true }), []);
  assert.notEqual(result.status, 0, "the scratch copy has no package.json, so the build step fails");
  assert.doesNotMatch(result.text, /media host is a placeholder/);
  // Job 10: the build step is the OpenNext build, whose binary this scratch copy does not have.
  assert.match(result.text, /opennextjs-cloudflare ENOENT/, "it reached the build step");
});

for (const name of ["robots.txt", "sitemap.xml", "_headers"]) {
  for (const target of ["local", "preview", "production"]) {
    test(`public/${name} stops --target=${target} before any build`, () => {
      const result = run(scratch({ publicFile: name }), [`--target=${target}`]);
      assert.notEqual(result.status, 0);
      assert.match(result.text, new RegExp(`public/ must not hold .*${name.replace(".", "\\.")}`));
      assert.doesNotMatch(result.text, /Creating an optimized/);
    });
  }
}

test("the order in the source: target, public check, media check, then the build; the folder follows the target", () => {
  const at = (needle) => {
    const i = SOURCE.indexOf(needle);
    assert.notEqual(i, -1, needle);
    return i;
  };
  assert.ok(at("parseTarget(argv)") < at("assertPublicClean(root)"));
  assert.ok(at("assertPublicClean(root)") < at('if (target !== "local") assertMediaReady()'));
  assert.ok(at('if (target !== "local") assertMediaReady()') < at('execFileSync("./node_modules/.bin/opennextjs-cloudflare"'));
  assert.ok(at('execFileSync("./node_modules/.bin/opennextjs-cloudflare"') < at("outDirNameFor(target)"));
  assert.ok(at("writeTargetFiles({") < at("assertTargetFiles(outDir, target"));
  assert.equal(SOURCE.includes("headersFile:"), false, "_headers is written by writeTargetFiles, never copied by the assembler");
});
