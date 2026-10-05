// Fills this worktree's local Supabase stack from the fixtures with scripts/import-catalog.mjs --apply --local (plan
// 03.2-02). The service-role key it needs is the local stack's own; it goes to the child's environment only and is never
// printed. Used by tests/data-parity.test.mjs and scripts/parity-build.mjs. Call it under the stack lock.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireStackLock, localStack, resetLocal, runSql } from "./local-supabase.mjs";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `resetLocal()`, then waits until PostgREST can call what the migrations just created. `supabase db reset` returns before
 * PostgREST has a good schema cache again: it is restarted by the reset, fails to load while the database is coming back
 * (503, "Attempting to reconnect to the database in 32 seconds"), and loads partial caches while the migrations run. Under
 * load an import or a read straight after the reset failed with "Could not find the function public.import_catalog(p) in
 * the schema cache". Asks for a reload, then calls import_catalog with an empty payload (a no-op: every table is read from
 * an empty list) until it answers 200 twice, a second apart. The probe is the call the import makes, so a passing probe is
 * the same proof the import needs. Returns { code, output } like resetLocal; code 1 when PostgREST is not ready after
 * `timeoutMs`. Call it under the stack lock.
 */
export async function resetAndWait({ timeoutMs = 120_000 } = {}) {
  const reset = resetLocal();
  if (reset.code !== 0) return reset;
  const stack = localStack({ fresh: true });
  if (!stack) return { code: 1, output: `${reset.output}\nno local stack after the reset` };
  runSql("notify pgrst, 'reload schema'");
  const deadline = Date.now() + timeoutMs;
  let good = 0;
  for (;;) {
    let ok = false;
    try {
      const res = await fetch(`${stack.url}/rest/v1/rpc/import_catalog`, {
        method: "POST",
        headers: { apikey: stack.serviceKey, authorization: `Bearer ${stack.serviceKey}`, "content-type": "application/json" },
        body: JSON.stringify({ p: {} }),
      });
      ok = res.status === 200;
    } catch {
      // the API is still restarting: try again
    }
    good = ok ? good + 1 : 0;
    if (good >= 2) return reset;
    if (Date.now() > deadline) return { code: 1, output: `${reset.output}\nPostgREST could not call import_catalog ${Math.round(timeoutMs / 1000)} s after the reset` };
    await sleep(ok ? 1000 : 500);
  }
}
