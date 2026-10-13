// Plan 03.2-05 Task 2: the Workers Builds build command. Every effect is a fake: nothing sleeps, reads the network,
// builds or writes the repo. The assembler step is injected because 03.2-02b pins --target=production to the live
// Supabase host, so a production dry run against the local stack is refused by design (controller, 2026-10-13).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTLE_SECONDS, SITE_VERSION_FILE, buildLive, settleSeconds } from "../scripts/build-live.mjs";
import { assertTargetFiles, outDirNameFor, writeTargetFiles } from "../scripts/crawl-files.mjs";
import { cpSync } from "node:fs";

const NOW = new Date("2026-10-13T10:05:00.000Z");
const COMMIT = "0b6015e1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7";

function fakes(over = {}) {
  const calls = [];
  const files = {};
  const lines = [];
  const deps = {
    env: { ALMAR_PUBLISH_SETTLE_SECONDS: undefined },
    branch: () => "live",
    commit: () => COMMIT,
    sleep: async (ms) => calls.push(["sleep", ms]),
    readSeq: async () => {
      calls.push(["readSeq"]);
      return 7;
    },
    runAssemble: async () => {
      calls.push(["assemble"]);
      return 0;
    },
    writeFile: (file, text) => {
      calls.push(["write", file]);
      files[file] = text;
    },
    now: () => NOW,
    log: (line) => lines.push(line),
    ...over,
  };
  return { deps, calls, files, lines };
}

test("branch main: exit 1 'builds only from branch live' before sleeping, reading or building", async () => {
  const f = fakes({ branch: () => "main" });
  assert.equal(await buildLive(f.deps), 1);
  assert.deepEqual(f.calls, []);
  assert.match(f.lines.join("\n"), /builds only from branch live/);
});

test("a refused branch logs the WORKERS_CI* variable names present, never their values", async () => {
  const f = fakes({ branch: () => "HEAD", env: { WORKERS_CI_COMMIT_SHA: "abc123", WORKERS_CI_BUILD_UUID: "uuid-secretish", OTHER: "x" } });
  assert.equal(await buildLive(f.deps), 1);
  const all = f.lines.join("\n");
  assert.match(all, /WORKERS_CI\* variables in this build: WORKERS_CI_BUILD_UUID, WORKERS_CI_COMMIT_SHA/);
  assert.equal(all.includes("uuid-secretish"), false);
  assert.equal(all.includes("OTHER"), false);
});

test("an empty or detached branch (HEAD) is refused the same way", async () => {
  for (const branch of ["", "HEAD", "live-2", " Live "]) {
    const f = fakes({ branch: () => branch });
    assert.equal(await buildLive(f.deps), 1, JSON.stringify(branch));
    assert.deepEqual(f.calls, []);
  }
});

test("branch live: sleeps the settle seconds, reads the sequence BEFORE the assembler, then writes site-version.json", async () => {
  const f = fakes();
  assert.equal(await buildLive(f.deps), 0);
  assert.deepEqual(f.calls, [["sleep", DEFAULT_SETTLE_SECONDS * 1000], ["readSeq"], ["assemble"], ["write", SITE_VERSION_FILE]]);
  assert.equal(SITE_VERSION_FILE, join("out", "site-version.json"));
  assert.deepEqual(JSON.parse(f.files[SITE_VERSION_FILE]), { seq: 7, built_at: NOW.toISOString(), commit: COMMIT });
});

test("settle seconds: unset 120, '0' 0, '600' 600; 'abc', '900', '-1', '1.5' refused before sleeping", async () => {
  assert.equal(settleSeconds(undefined), 120);
  assert.equal(settleSeconds(""), 120);
  assert.equal(settleSeconds("0"), 0);
  assert.equal(settleSeconds("600"), 600);
  for (const bad of ["abc", "900", "-1", "1.5", "1e2"]) {
    assert.equal(settleSeconds(bad), null, bad);
    const f = fakes({ env: { ALMAR_PUBLISH_SETTLE_SECONDS: bad } });
    assert.equal(await buildLive(f.deps), 1, bad);
    assert.deepEqual(f.calls, [], `${bad}: nothing runs`);
  }
  const zero = fakes({ env: { ALMAR_PUBLISH_SETTLE_SECONDS: "0" } });
  assert.equal(await buildLive(zero.deps), 0);
  assert.deepEqual(zero.calls[0], ["sleep", 0]);
});

test("the sequence read fails: exit 1, no assemble, no site-version.json (the deploy never runs)", async () => {
  const f = fakes({
    readSeq: async () => {
      throw new Error("api_site_version: HTTP 503");
    },
  });
  assert.equal(await buildLive(f.deps), 1);
  assert.deepEqual(f.calls.map((c) => c[0]), ["sleep"]);
  assert.deepEqual(f.files, {});
  assert.match(f.lines.at(-1), /publish sequence could not be read \(api_site_version: HTTP 503\)/);
});

test("a sequence that is not a whole number is refused", async () => {
  for (const seq of ["abc", -1, 1.5, null]) {
    const f = fakes({ readSeq: async () => seq });
    assert.equal(await buildLive(f.deps), 1, String(seq));
    assert.deepEqual(f.files, {});
  }
  const text = fakes({ readSeq: async () => "12" });
  assert.equal(await buildLive(text.deps), 0, "02b's reader returns the number as text");
  assert.equal(JSON.parse(text.files[SITE_VERSION_FILE]).seq, 12);
});

test("the assembler exits non-zero (Supabase error, empty stays, refusal, crash): exit 1 and nothing is written", async () => {
  for (const status of [1, 2, null]) {
    const f = fakes({ runAssemble: async () => status ?? 1 });
    assert.equal(await buildLive(f.deps), 1);
    assert.deepEqual(f.files, {});
    assert.match(f.lines.at(-1), /assemble --target=production failed/);
  }
});

test("a commit that is not a hex sha is written as null, never as text from the environment", async () => {
  const f = fakes({ commit: () => "main; rm -rf" });
  assert.equal(await buildLive(f.deps), 0);
  assert.equal(JSON.parse(f.files[SITE_VERSION_FILE]).commit, null);
});

test("the log never prints a key or the Supabase URL", async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example-host.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_SECRETISH" };
  const f = fakes({ env });
  await buildLive(f.deps);
  const all = f.lines.join("\n");
  assert.equal(all.includes("example-host"), false);
  assert.equal(all.includes("SECRETISH"), false);
});

test("source: build-live never runs wrangler and never reads a service key", () => {
  const src = readFileSync("scripts/build-live.mjs", "utf8");
  assert.equal(/wrangler/.test(src.replace(/^\/\/.*$/gm, "")), false, "no wrangler call outside comments");
  assert.equal(/SERVICE_ROLE/.test(src), false);
  assert.match(src, /--target=production/);
});

test("_headers: /site-version.json is served no-store on production and preview", () => {
  const root = mkdtempSync(join(tmpdir(), "almar-build-live-"));
  cpSync("_headers", join(root, "_headers"));
  cpSync("deploy", join(root, "deploy"), { recursive: true });
  mkdirSync(join(root, "public"));
  assert.match(readFileSync("_headers", "utf8"), /^\/site-version\.json\n {2}Cache-Control: no-store$/m);
  for (const target of ["production", "preview"]) {
    const outDir = join(root, outDirNameFor(target));
    mkdirSync(outDir, { recursive: true });
    writeTargetFiles({ outDir, target, root, htmlFiles: ["index.html"] });
    assertTargetFiles(outDir, target, { root });
    assert.match(readFileSync(join(outDir, "_headers"), "utf8"), /\/site-version\.json\n {2}Cache-Control: no-store/, target);
  }
});
