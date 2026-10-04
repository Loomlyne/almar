import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WORKER_GZIP_LIMIT_KIB, assertWorkerSize, gzipSizeKiB } from "../scripts/worker-size.mjs";

// Job 10 pre-landing review: the built Worker's gzip size is checked at build time, with a margin under the Workers
// Free plan's 3,072 KiB. Fake files only; the real bundle is measured by scripts/assemble-cloudflare.mjs.

const KIB = 1024;
const MIB_OF_ZEROS = 1024 * KIB;

function scratch(files = {}) {
  const base = mkdtempSync(join(tmpdir(), "almar-size-"));
  for (const [name, bytes] of Object.entries(files)) {
    mkdirSync(join(base, name, ".."), { recursive: true });
    writeFileSync(join(base, name), bytes);
  }
  return base;
}

test("the limit is 2,560 KiB, 512 KiB under the Free plan's 3,072 KiB", () => {
  assert.equal(WORKER_GZIP_LIMIT_KIB, 2560);
});

test("gzipSizeKiB: counts gzipped bytes, not raw bytes", () => {
  const base = scratch({ "w.js": Buffer.alloc(MIB_OF_ZEROS), "r.js": randomBytes(40 * KIB) });
  assert.ok(gzipSizeKiB(join(base, "w.js")) < 4, "a megabyte of zeros gzips to a few KiB");
  const noise = gzipSizeKiB(join(base, "r.js"));
  assert.ok(noise > 40 && noise < 41, `40 KiB of noise stays about 40 KiB (got ${noise})`);
});

test("gzipSizeKiB: a folder adds up its module files (.js .mjs .cjs .wasm) and ignores maps and notes", () => {
  const base = scratch({
    "almar.js": randomBytes(10 * KIB),
    "sub/chunk.mjs": randomBytes(10 * KIB),
    "sub/old.cjs": randomBytes(10 * KIB),
    "sub/engine.wasm": randomBytes(10 * KIB),
    "almar.js.map": randomBytes(500 * KIB),
    "README.md": randomBytes(500 * KIB),
  });
  const total = gzipSizeKiB(base);
  assert.ok(total > 40 && total < 42, `four 10 KiB modules, nothing else (got ${total})`);
});

test("gzipSizeKiB: a path that is not there, or a folder with no module, is null", () => {
  assert.equal(gzipSizeKiB(join(tmpdir(), "almar-size-does-not-exist")), null);
  assert.equal(gzipSizeKiB(scratch({ "a.map": "x", "README.md": "x" })), null);
});

test("assertWorkerSize: under the limit returns the size; over it stops the build and names the file and the limit", () => {
  const file = join(scratch({ "almar.js": randomBytes(300 * KIB) }), "almar.js");
  const kib = assertWorkerSize(file, 400);
  assert.ok(kib > 300 && kib < 301, String(kib));
  assert.throws(
    () => assertWorkerSize(file, 200),
    (error) => {
      assert.match(error.message, /^the built Worker is 30\d KiB gzipped, over the 200 KiB limit \(/);
      assert.ok(error.message.includes(file));
      return true;
    },
  );
});

test("assertWorkerSize: the size exactly at the limit passes; one byte over does not", () => {
  const base = scratch({ "almar.js": randomBytes(64 * KIB) });
  const exact = gzipSizeKiB(base);
  assert.equal(assertWorkerSize(base, exact), exact);
  assert.throws(() => assertWorkerSize(base, exact - 1 / KIB), /over the/);
});

test("assertWorkerSize: with no limit given it uses 2,560 KiB (2,400 KiB passes, 2,600 KiB fails)", () => {
  const under = scratch({ "almar.js": randomBytes(2400 * KIB) });
  assert.ok(assertWorkerSize(under) > 2400);
  const over = scratch({ "almar.js": randomBytes(2600 * KIB) });
  assert.throws(() => assertWorkerSize(over), /over the 2560 KiB limit/);
});

test("assertWorkerSize: nothing to measure is null, not a failure", () => {
  assert.equal(assertWorkerSize(join(tmpdir(), "almar-size-does-not-exist")), null);
});

test("the assembler measures the real bundle through a dry run only: no upload, no login, bundle removed afterwards", () => {
  const source = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  // Every wrangler call in the assembler is a dry run; there is no other `deploy` or `upload` argument.
  assert.match(source, /\["deploy", "--dry-run", "--config", config, "--outdir", bundleDir\]/);
  assert.equal([...source.matchAll(/"(?:deploy|upload|versions|secret|publish)"/g)].length, 1);
  assert.match(source, /assertWorkerSize\(bundleDir\)/);
  assert.match(source, /fs\.rmSync\(bundleDir, \{ recursive: true, force: true \}\)/);
});
