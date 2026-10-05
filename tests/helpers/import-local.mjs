// Fills this worktree's local Supabase stack from the fixtures with scripts/import-catalog.mjs --apply --local (plan
// 03.2-02). The service-role key it needs is the local stack's own; it goes to the child's environment only and is never
// printed. Used by tests/data-parity.test.mjs and scripts/parity-build.mjs. Call it under the stack lock.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
