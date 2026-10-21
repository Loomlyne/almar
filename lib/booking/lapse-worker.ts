// The scheduled glue on Worker `almar-ops` (plan 04-08, Task 5): worker/almar-ops.mjs imports this file lazily, from its
// `scheduled` handler only. A scheduled run has no request, so the Worker's secrets are copied from `env` into
// process.env (names are not listed: whatever the Worker holds, a name already set is kept) for createSupabaseAdmin and
// the notifier, which read process.env. The cycle itself is lib/booking/lapse.ts. Only counts are logged.
import { createSupabaseAdmin } from "../supabase/clients";
import { runLapseCycle } from "./lapse";
import { getNotifier } from "./notify";

export async function runScheduledLapse(env: Record<string, unknown>): Promise<void> {
  for (const [name, value] of Object.entries(env ?? {})) {
    if (typeof value === "string" && process.env[name] === undefined) process.env[name] = value;
  }
  const admin = createSupabaseAdmin();
  if (!admin) throw new Error("lapse: database not configured");
  const out = await runLapseCycle({ rpc: (name, args) => admin.rpc(name, args), notifier: getNotifier() });
  console.log(`lapse: lapsed=${out.lapsed} claimed=${out.claimed} sent=${out.sent} failed=${out.failed} mailReady=${out.mailReady}`);
}
