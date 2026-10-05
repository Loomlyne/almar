// A cross-process lock for the node tests that reset or fill this worktree's local Supabase stack (plan 03.2-02).
//
// WHY: `node --test tests/*.test.mjs` runs test files in parallel processes, and the stack is one database per worktree.
// tests/import-catalog.test.mjs and tests/data-parity.test.mjs both reset it and import into it; without a lock one
// file's reset lands in the middle of the other's reads. Hold the lock for the whole of a section that depends on the
// database being in the state you put it in, including the reset that leaves it empty for the pgTAP files.
//
//   await withStackLock(async () => { ...reset, import, read... });
//
// The lock is a directory next to the stack's own work folder (supabase/.temp/stack, ignored by git). A lock whose
// owner process is gone is taken over; waiting longer than `timeoutMs` throws instead of hanging a run.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { workdir } from "./local-supabase.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function lockDir() {
  return join(dirname(workdir()), "node-tests.lock");
}

function isStale(dir) {
  let pid = NaN;
  try {
    pid = Number(readFileSync(join(dir, "pid"), "utf8"));
  } catch {
    // The owner has made the directory but not yet written its pid: a lock is that young for a few milliseconds only.
    try {
      return Date.now() - statSync(dir).mtimeMs > 10_000;
    } catch {
      return true;
    }
  }
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}

export async function withStackLock(fn, { timeoutMs = 30 * 60 * 1000 } = {}) {
  const dir = lockDir();
  mkdirSync(dirname(dir), { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, "pid"), String(process.pid));
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (isStale(dir)) {
        rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - started > timeoutMs) throw new Error(`timed out after ${Math.round(timeoutMs / 1000)} s waiting for the local stack lock (${dir})`);
      await sleep(250);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
