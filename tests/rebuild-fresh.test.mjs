// A second build in the same checkout must read the database again (review of plan 03.2-02).
//
// Next 15 stores every `fetch` of a build in .next/cache/fetch-cache with revalidate 31536000 (a year). The data layer reads
// the api_* views with fetch (supabase-js), so a later build in the same checkout found the old entries and rebuilt the
// OLD catalogue: a title changed in the database kept its old text in the output, until that folder was deleted.
// scripts/assemble-cloudflare.mjs deletes it before every build (clearFetchCache). The cheap pins are in
// tests/data-source.test.mjs; this is the real proof, run on this worktree's local stack.
//
// Opt-in: ALMAR_REBUILD_PROOF=1 (two real builds into out/, .next/ and .open-next/ of this worktree, about a minute;
// it would otherwise clobber the output other work in the checkout reads). With the stack down it skips, and with
// ALMAR_REQUIRE_STACK=1 it fails, like the other stack cases.
//
//   ALMAR_REBUILD_PROOF=1 ALMAR_REQUIRE_STACK=1 node --test tests/rebuild-fresh.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { requireStack, runSql } from "./helpers/local-supabase.mjs";
import { importIntoLocal, resetAndWait, underStackLock } from "./helpers/import-local.mjs";
import { buildEnv } from "../scripts/parity-build.mjs";

const SLUG = "getsemani-colonial-house";
const PAGE = `out/private-stays/${SLUG}.html`;
const TITLE = "Getsemaní Colonial House";
const MARK = " (rebuild proof)";

test("a stay title changed in the database between two builds is in the second build's output", { timeout: 1_200_000 }, async (t) => {
  if (process.env.ALMAR_REBUILD_PROOF !== "1") {
    t.skip("set ALMAR_REBUILD_PROOF=1: two real builds into out/ of this worktree, on the local stack");
    return;
  }
  await underStackLock(async () => {
    const stack = requireStack(t);
    if (!stack) return;
    const reset = await resetAndWait();
    assert.equal(reset.code, 0, reset.output.slice(-1500));
    importIntoLocal(stack);
    const env = buildEnv(process.env, {
      ALMAR_DATA_SOURCE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: stack.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    });
    const build = (label) => {
      const res = spawnSync(process.execPath, ["scripts/assemble-cloudflare.mjs", "--target=local"], {
        cwd: process.cwd(),
        env,
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
      });
      assert.equal(res.status, 0, `${label} build failed:\n${(res.stdout + res.stderr).slice(-3000)}`);
    };
    try {
      build("first");
      const first = readFileSync(PAGE, "utf8");
      assert.ok(first.includes(TITLE), `the first build holds "${TITLE}"`);
      assert.equal(first.includes(TITLE + MARK), false, "the mark is not there yet");

      const changed = runSql(
        `update public.stay_translations set title = title || '${MARK}' where locale = 'en' and stay_id = (select id from public.stays where slug = '${SLUG}') returning title`,
      );
      assert.equal(changed.code, 0, changed.output.slice(-1000));
      assert.deepEqual(changed.rows.map((r) => r.title), [TITLE + MARK], "one row changed in the database");

      build("second");
      const second = readFileSync(PAGE, "utf8");
      assert.ok(second.includes(TITLE + MARK), "the second build reads the changed title, not the cached old one");
    } finally {
      const after = await resetAndWait(); // leave the database empty for the pgTAP files
      assert.equal(after.code, 0, `local reset after the proof: ${after.output.slice(-1000)}`);
    }
  });
});
