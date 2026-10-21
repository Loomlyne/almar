// The scheduled lapse, pure (plan 04-08, Task 5; section B "Lapse job"). One cycle: ops_lapse_holds expires the unpaid
// requests whose deadline has passed (and flags the part-paid ones, P-09), then, when the email sender is ready, the
// lapse mails are claimed (at most LAPSE_EMAIL_BATCH, once each, with a lease) and sent, and each outcome is reported
// back. It talks to the database through the rpc it is given and sends through the notifier it is given: it imports
// nothing from next or supabase, reads no environment and logs nothing (never an address or a payload).
import { mailKey, type BookingNotifier, type LapseMailJob } from "./notify";
import type { BookingDb } from "./server";

/** How many lapse emails one cycle claims (the cron runs every 5 minutes). */
export const LAPSE_EMAIL_BATCH = 5;

export type LapseDeps = { rpc: BookingDb["rpc"]; notifier: BookingNotifier };

export type LapseCycle = { lapsed: number; claimed: number; sent: number; failed: number; mailReady: boolean };

type Raw = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** One claimed row -> the notifier's job; null when a field the mail needs is missing. */
function toJob(row: unknown): LapseMailJob | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Raw;
  const bookingId = str(r.booking_id);
  const ref = str(r.ref);
  const email = str(r.email);
  const guestName = str(r.guest_name);
  const locale = str(r.locale);
  const staySlug = str(r.stay_slug);
  const stayTitle = str(r.stay_title);
  const arrive = str(r.arrive);
  const leave = str(r.leave);
  const deadline = str(r.deadline);
  if (!bookingId || !ref || !email || !guestName || !locale || !staySlug || !stayTitle || !arrive || !leave || !deadline) return null;
  return { bookingId, ref, email, guestName, locale, isTest: r.is_test === true, staySlug, stayTitle, arrive, leave, deadline };
}

/** Lapse, then (sender ready) claim and send the lapse mails. A database error or an unreadable claim answer throws. */
export async function runLapseCycle(deps: LapseDeps): Promise<LapseCycle> {
  const { rpc, notifier } = deps;
  const lapse = await rpc("ops_lapse_holds");
  if (lapse.error) throw new Error("lapse: ops_lapse_holds failed");
  const lapsed = typeof lapse.data === "number" ? lapse.data : 0;
  if (!notifier.ready) return { lapsed, claimed: 0, sent: 0, failed: 0, mailReady: false };

  const claim = await rpc("claim_lapse_emails", { p_limit: LAPSE_EMAIL_BATCH });
  if (claim.error) throw new Error("lapse: claim_lapse_emails failed");
  if (!Array.isArray(claim.data)) throw new Error("lapse: unreadable claim answer");
  const jobs = claim.data.map(toJob);
  if (jobs.some((job) => job === null)) throw new Error("lapse: unreadable claim answer");

  let sent = 0;
  let failed = 0;
  for (const job of jobs as LapseMailJob[]) {
    let ok = false;
    let error: string | null = null;
    try {
      const outcome = await notifier.requestLapsed(job, { idempotencyKey: mailKey("requestLapsed", job.bookingId) });
      ok = outcome.ok === true;
      error = outcome.ok === true ? null : outcome.error;
    } catch {
      error = "threw";
    }
    let finished = false;
    try {
      const done = await rpc("finish_lapse_email", { p_booking: job.bookingId, p_ok: ok, p_error: error });
      finished = !done.error;
    } catch {
      finished = false;
    }
    if (ok && finished) sent += 1;
    else failed += 1;
  }
  return { lapsed, claimed: jobs.length, sent, failed, mailReady: true };
}
