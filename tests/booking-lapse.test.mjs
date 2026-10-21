// Plan 04-08, Task 5: the scheduled lapse, its pure core on a fake rpc and a fake notifier, and the source rules of the
// two files. The cron entry itself (worker/almar-ops.mjs, wrangler.ops.toml) is pinned in tests/ops-runtime.test.mjs.
// Every value here is symbolic; no address, key or payload is real.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { runLapseCycle, LAPSE_EMAIL_BATCH } = await loadTs("lib/booking/lapse.ts");

const job = (n) => ({
  booking_id: `00000000-0000-4000-8000-00000000000${n}`,
  ref: `ALMAR-00000${n}`,
  email: `guest${n}@example.com`,
  guest_name: `Guest ${n}`,
  locale: "en",
  is_test: true,
  stay_slug: "stay-one",
  stay_title: "Stay One",
  arrive: "2027-01-10",
  leave: "2027-01-13",
  deadline: "2026-10-21T10:00:00.000Z",
});

/** A fake rpc: records every call, answers from `answers` by name (a function gets the args). */
function fakeRpc(answers) {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    const answer = answers[name];
    const out = typeof answer === "function" ? answer(args) : answer;
    return out ?? { data: null, error: null };
  };
  return { rpc, calls };
}

/** A fake notifier: requestLapsed answers per call from `outcomes` (an Error instance throws). */
function fakeNotifier({ ready = true, outcomes = [] } = {}) {
  const sent = [];
  return {
    sent,
    ready,
    async requestLapsed(j, opts) {
      sent.push({ job: j, opts });
      const outcome = outcomes[sent.length - 1] ?? { ok: true };
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
}

test("LAPSE_EMAIL_BATCH is 5", () => {
  assert.equal(LAPSE_EMAIL_BATCH, 5);
});

test("zero lapsed and nothing claimed sends nothing", async () => {
  const { rpc, calls } = fakeRpc({ ops_lapse_holds: { data: 0, error: null }, claim_lapse_emails: { data: [], error: null } });
  const notifier = fakeNotifier();
  const out = await runLapseCycle({ rpc, notifier });
  assert.deepEqual(out, { lapsed: 0, claimed: 0, sent: 0, failed: 0, mailReady: true });
  assert.equal(notifier.sent.length, 0);
  assert.deepEqual(calls.map((c) => c.name), ["ops_lapse_holds", "claim_lapse_emails"]);
  assert.deepEqual(calls[1].args, { p_limit: 5 });
});

test("a notifier that is not ready: the lapse runs, claim is never called", async () => {
  const { rpc, calls } = fakeRpc({ ops_lapse_holds: { data: 2, error: null } });
  const notifier = fakeNotifier({ ready: false });
  const out = await runLapseCycle({ rpc, notifier });
  assert.deepEqual(out, { lapsed: 2, claimed: 0, sent: 0, failed: 0, mailReady: false });
  assert.deepEqual(calls.map((c) => c.name), ["ops_lapse_holds"]);
  assert.equal(notifier.sent.length, 0);
});

test("three jobs: three sends with the key lapse/<id> and three finishes in order", async () => {
  const jobs = [job(1), job(2), job(3)];
  const { rpc, calls } = fakeRpc({ ops_lapse_holds: { data: 3, error: null }, claim_lapse_emails: { data: jobs, error: null } });
  const notifier = fakeNotifier();
  const out = await runLapseCycle({ rpc, notifier });
  assert.deepEqual(out, { lapsed: 3, claimed: 3, sent: 3, failed: 0, mailReady: true });
  assert.deepEqual(notifier.sent.map((s) => s.opts.idempotencyKey), jobs.map((j) => `lapse/${j.booking_id}`));
  assert.deepEqual(notifier.sent.map((s) => s.job.bookingId), jobs.map((j) => j.booking_id));
  assert.equal(notifier.sent[0].job.guestName, "Guest 1");
  assert.equal(notifier.sent[0].job.staySlug, "stay-one");
  assert.equal(notifier.sent[0].job.isTest, true);
  const finishes = calls.filter((c) => c.name === "finish_lapse_email");
  assert.deepEqual(finishes.map((c) => c.args), jobs.map((j) => ({ p_booking: j.booking_id, p_ok: true, p_error: null })));
});

test("a refused mail is finished with its error and the next job still sends", async () => {
  const jobs = [job(1), job(2), job(3)];
  const { rpc, calls } = fakeRpc({ ops_lapse_holds: { data: 3, error: null }, claim_lapse_emails: { data: jobs, error: null } });
  const notifier = fakeNotifier({ outcomes: [{ ok: true }, { ok: false, error: "http_429" }, { ok: true }] });
  const out = await runLapseCycle({ rpc, notifier });
  assert.equal(notifier.sent.length, 3, "the third still sends");
  assert.deepEqual(out, { lapsed: 3, claimed: 3, sent: 2, failed: 1, mailReady: true });
  const finishes = calls.filter((c) => c.name === "finish_lapse_email");
  assert.deepEqual(finishes[1].args, { p_booking: jobs[1].booking_id, p_ok: false, p_error: "http_429" });
  assert.equal(finishes[2].args.p_ok, true);
});

test("a send that throws counts as failed with the error name threw", async () => {
  const jobs = [job(1), job(2)];
  const { rpc, calls } = fakeRpc({ ops_lapse_holds: { data: 2, error: null }, claim_lapse_emails: { data: jobs, error: null } });
  const notifier = fakeNotifier({ outcomes: [new Error("secret detail: guest1@example.com"), { ok: true }] });
  const out = await runLapseCycle({ rpc, notifier });
  assert.deepEqual(out, { lapsed: 2, claimed: 2, sent: 1, failed: 1, mailReady: true });
  const finishes = calls.filter((c) => c.name === "finish_lapse_email");
  assert.deepEqual(finishes[0].args, { p_booking: jobs[0].booking_id, p_ok: false, p_error: "threw" });
});

test("an error from ops_lapse_holds throws", async () => {
  const { rpc } = fakeRpc({ ops_lapse_holds: { data: null, error: { message: "boom" } } });
  await assert.rejects(runLapseCycle({ rpc, notifier: fakeNotifier() }));
});

test("an error from claim_lapse_emails throws", async () => {
  const { rpc } = fakeRpc({ ops_lapse_holds: { data: 0, error: null }, claim_lapse_emails: { data: null, error: { message: "boom" } } });
  await assert.rejects(runLapseCycle({ rpc, notifier: fakeNotifier() }));
});

test("an unreadable claim answer throws", async () => {
  for (const data of [{ not: "a list" }, "text", null, [{ booking_id: 5 }], [{}]]) {
    const { rpc } = fakeRpc({ ops_lapse_holds: { data: 0, error: null }, claim_lapse_emails: { data, error: null } });
    await assert.rejects(runLapseCycle({ rpc, notifier: fakeNotifier() }), undefined, JSON.stringify(data));
  }
});

test("a finish that fails is counted and the loop goes on", async () => {
  const jobs = [job(1), job(2)];
  const { rpc, calls } = fakeRpc({
    ops_lapse_holds: { data: 2, error: null },
    claim_lapse_emails: { data: jobs, error: null },
    finish_lapse_email: (args) => (args.p_booking === jobs[0].booking_id ? { data: null, error: { message: "boom" } } : { data: null, error: null }),
  });
  const notifier = fakeNotifier();
  const out = await runLapseCycle({ rpc, notifier });
  assert.equal(notifier.sent.length, 2);
  assert.equal(calls.filter((c) => c.name === "finish_lapse_email").length, 2);
  assert.equal(out.claimed, 2);
  assert.equal(out.failed, 1, "the unfinished one counts as failed");
  assert.equal(out.sent, 1);
});

test("source: lapse.ts imports nothing from next, @supabase or lib/supabase and names no key or card word", () => {
  const source = readFileSync("lib/booking/lapse.ts", "utf8");
  assert.equal(/from "(next|@supabase)[^"]*"/.test(source), false);
  assert.equal(/lib\/supabase|\.\.\/supabase/.test(source), false);
  assert.equal(/SUPABASE_SERVICE_ROLE_KEY|process\.env/.test(source), false);
  assert.equal(/console\./.test(source), false, "the pure cycle logs nothing");
  assert.equal(/stripe|checkout session/i.test(source), false);
});

test("source: lapse-worker.ts names no key, calls createSupabaseAdmin, copies only string env values and logs counts once", () => {
  const source = readFileSync("lib/booking/lapse-worker.ts", "utf8");
  assert.equal(/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|BOOKING_LINK_SECRET/.test(source), false, "names no key");
  assert.match(source, /createSupabaseAdmin\(\)/);
  assert.match(source, /typeof value === "string"/);
  assert.match(source, /lapse: database not configured/);
  assert.equal((source.match(/console\.log\(/g) ?? []).length, 1);
  assert.equal(/stripe|checkout session/i.test(source), false);
});
