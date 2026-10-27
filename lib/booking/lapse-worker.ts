// The scheduled glue on Worker `almar-ops` (plan 04-08, Task 5): worker/almar-ops.mjs imports this file lazily, from its
// `scheduled` handler only. A scheduled run has no request, so the Worker's secrets are copied from `env` into
// process.env (names are not listed: whatever the Worker holds, a name already set is kept) for the notifier, which
// reads process.env. The database client is this file's own plain supabase-js client (PR #34 review): it never imports
// lib/supabase/clients, whose next/headers and @supabase/ssr imports have no place in the cron bundle. The cycle itself
// is lib/booking/lapse.ts. Only counts are logged.
import { createClient } from "@supabase/supabase-js";
import { runLapseCycle } from "./lapse";
import { getNotifier } from "./notify";

function envText(env: Record<string, unknown>, name: string): string | null {
  const value = env[name] ?? process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function runScheduledLapse(env: Record<string, unknown>): Promise<void> {
  for (const [name, value] of Object.entries(env ?? {})) {
    if (typeof value === "string" && process.env[name] === undefined) process.env[name] = value;
  }
  const url = envText(env ?? {}, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envText(env ?? {}, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("lapse: database not configured");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const out = await runLapseCycle({ rpc: (name, args) => admin.rpc(name, args), notifier: getNotifier() });
  console.log(`lapse: lapsed=${out.lapsed} claimed=${out.claimed} sent=${out.sent} failed=${out.failed} mailReady=${out.mailReady}`);
}
