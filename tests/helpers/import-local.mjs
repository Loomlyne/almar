// Fills this worktree's local Supabase stack from the fixtures with scripts/import-catalog.mjs --apply --local (plan
// 03.2-02). The service-role key it needs is the local stack's own; it goes to the child's environment only and is never
// printed. Used by tests/data-parity.test.mjs and scripts/parity-build.mjs. Call it under the stack lock.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireStackLock } from "./local-supabase.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Throws with the (key-free) tail of the output when the import fails. Returns the script's stdout. */
export function importIntoLocal(stack) {
  const res = spawnSync(process.execPath, ["scripts/import-catalog.mjs", "--apply", "--local"], {
    cwd: ROOT,
    env: { ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`.replaceAll(stack.serviceKey, "<key>");
  if (res.status !== 0) throw new Error(`import-catalog --apply --local failed (exit ${res.status}):\n${output.slice(-3000)}`);
  return output;
}

/**
 * Runs `fn` while holding the stack's cross-process lock. There is ONE lock mechanism: acquireStackLock() in
 * tests/helpers/local-supabase.mjs (plan 04-02), which tests/import-catalog.test.mjs and the booking database tests use
 * too; this is only try/finally around it. Hold it for the whole of a section that depends on the database being in the
 * state you put it in, including `requireStack(t)` (`supabase status` fails while another file resets the database, and
 * localStack() remembers a failure) and the reset that leaves the database empty for the pgTAP files.
 */
export async function underStackLock(fn, { timeoutMs = 30 * 60 * 1000 } = {}) {
  const release = await acquireStackLock({ timeoutMs });
  try {
    return await fn();
  } finally {
    release();
  }
}
