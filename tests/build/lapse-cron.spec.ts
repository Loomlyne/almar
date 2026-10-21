import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Plan 04-08, Task 5: the scheduled lapse on the BUILT ops Worker (almar-ops) through local `wrangler dev --test-scheduled`.
// It proves that the scheduled handler runs there, that the Worker's secrets reach process.env inside it (research A1) and
// that the bundle with the lazy import starts (A2). Runs only in Task 6, on the controller's go, with the ops stack copy:
//   node tests/helpers/local-supabase.mjs start && node tests/helpers/local-supabase.mjs reset
//   node scripts/assemble-cloudflare.mjs --target=ops
//   node tests/build/make-ops-test-config.mjs && node tests/build/make-ops-stack-config.mjs
//   PW_TEST_SCHEDULED=1 PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/lapse-cron.spec.ts --workers=1
// The notifier is not ready today, so the cycle lapses but claims no email: no email_* event is expected.
// Bank values are documentation examples only (GB82 WEST 1234 5698 7654 32, BIC TESTAEAA). Local rows only, removed by id.

const CONFIG = process.env.PW_WRANGLER_CONFIG ?? "";
const STACK_RUN = process.env.PW_TEST_SCHEDULED === "1" && /(^|\/)\.tmp\/ops-stack\/wrangler\.ops\.test\.toml$/.test(CONFIG);
test.skip(!STACK_RUN, "needs PW_TEST_SCHEDULED=1 and PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml (see the header)");

const OWNER_EMAIL = "maria@almarprivatejourney.com";
const TEST_BANK = {
  account_name: "Almar Test Account",
  bank_name: "Test Bank",
  iban: "GB82WEST12345698765432",
  swift: "TESTAEAA",
  bank_address: "1 Test Street, Dubai",
  note_en: "All fees paid by the sender.",
};

function stackFromDevVars() {
  const vars = new Map<string, string>();
  for (const line of readFileSync(CONFIG.replace(/wrangler\.ops\.test\.toml$/, ".dev.vars"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars.set(m[1], m[2]);
  }
  const stack = { url: vars.get("NEXT_PUBLIC_SUPABASE_URL") ?? "", serviceKey: vars.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(stack.url) || !stack.serviceKey) throw new Error("the .dev.vars beside the config is not a local stack");
  return stack;
}

function dubaiDay(offset: number): string {
  const text = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

function payload(slug: string, arrive: string, leave: string, email: string, vatBp: number, depositBp: number) {
  const n = Math.round((Date.parse(leave) - Date.parse(arrive)) / 86400000);
  const rate = 100000;
  const subtotal = n * rate;
  const vat = Math.floor((subtotal * vatBp + 5000) / 10000);
  const grand = subtotal + vat;
  return {
    stay_slug: slug, arrive, leave, adults: 2, children: 0, infants: 0, guest_name: "Cron Guest", email, phone: "+971501234567",
    locale: "en", airport: "DXB", plan: "full", is_test: true, nights_fils: subtotal, addons_fils: 0, subtotal_fils: subtotal,
    vat_bp: vatBp, vat_fils: vat, grand_fils: grand, deposit_bp: depositBp, deposit_fils: 0, balance_fils: 0, due_now_fils: grand,
    nights_snapshot: Array.from({ length: n }, (_, i) => ({ night: new Date(Date.parse(arrive) + i * 86400000).toISOString().slice(0, 10), rate_fils: rate, source: "base", rate_id: null })),
    balance_due_date: null, lines: [], terms_version: "cron-test",
    travellers: [{ kind: "adult", full_name: "Cron Booker", is_booker: true, not_staying: false }, { kind: "adult", full_name: "Cron Adult" }],
  };
}

async function requested(admin: SupabaseClient, slug: string, day: number, vatBp: number, depositBp: number): Promise<string> {
  const email = `cron-${randomUUID().slice(0, 8)}@example.com`;
  const held = await admin.rpc("create_web_booking", { p: payload(slug, dubaiDay(day), dubaiDay(day + 3), email, vatBp, depositBp) });
  expect(held.error, JSON.stringify(held.error)).toBeNull();
  expect(held.data.ok, JSON.stringify(held.data)).toBe(true);
  const asked = await admin.rpc("request_web_booking", { p_booking: held.data.booking_id, p_expect_test: true });
  expect(asked.error, JSON.stringify(asked.error)).toBeNull();
  expect(asked.data.first_time, JSON.stringify(asked.data)).toBe(true);
  return held.data.booking_id as string;
}

/** The deadline (and the timed nights) moved ten minutes back, as if time had passed. */
async function tenMinutesAgo(admin: SupabaseClient, id: string) {
  const ended = new Date(Date.now() - 10 * 60000).toISOString();
  expect((await admin.from("booking_nights").update({ expires_at: ended }).eq("booking_id", id).not("expires_at", "is", null)).error).toBeNull();
  expect((await admin.from("bookings").update({ hold_expires_at: ended }).eq("id", id)).error).toBeNull();
}

test("the scheduled handler lapses an unpaid request and flags a part-paid one, with no email while the notifier is not ready", async ({ request }) => {
  const stack = stackFromDevVars();
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const destination = randomUUID();
  const stay = randomUUID();
  const slug = `cron-stay-${suffix}`;
  let bankBefore: Record<string, unknown> | null = null;
  let madeOwner: string | null = null;
  try {
    const settings = await admin.from("site_settings").select("vat_percent, deposit_percent").eq("id", 1).single();
    expect(settings.error).toBeNull();
    const vatBp = Math.round(Number(settings.data!.vat_percent) * 100);
    const depositBp = Math.round(Number(settings.data!.deposit_percent) * 100);
    expect((await admin.from("destinations").insert({ id: destination, slug: `cron-dest-${suffix}`, is_published: true })).error).toBeNull();
    expect((await admin.from("stays").insert({ id: stay, slug, destination_id: destination, max_guests: 6, min_nights: 1, base_nightly_rate_aed: 1000, is_published: true })).error).toBeNull();
    const bank = await admin.from("booking_bank_details").select("*").eq("id", 1).single();
    expect(bank.error).toBeNull();
    bankBefore = bank.data;
    expect((await admin.from("booking_bank_details").update(TEST_BANK).eq("id", 1)).error).toBeNull();
    const found = await admin.from("profiles").select("id, role").eq("email", OWNER_EMAIL).maybeSingle();
    let owner = found.data?.id as string | undefined;
    if (!owner) {
      const created = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
      expect(created.error).toBeNull();
      madeOwner = created.data.user!.id;
      owner = madeOwner;
    }

    const unpaid = await requested(admin, slug, 400, vatBp, depositBp);
    const partPaid = await requested(admin, slug, 410, vatBp, depositBp);
    const record = await admin.rpc("ops_record_payment", {
      p: { booking_id: partPaid, request_id: randomUUID(), expected_status: "awaiting_payment", amount_fils: 1000, received_on: dubaiDay(0), bank_reference: "CRON-1" },
      p_actor: owner,
    });
    expect(record.error, JSON.stringify(record.error)).toBeNull();
    await tenMinutesAgo(admin, unpaid);
    await tenMinutesAgo(admin, partPaid);

    const fired = await request.get("/cdn-cgi/local/scheduled?cron=*/5+*+*+*+*&format=json");
    expect(fired.ok(), await fired.text()).toBe(true);
    const outcome = await fired.json();
    expect(JSON.stringify(outcome)).toMatch(/ok/i);

    const first = await admin.from("bookings").select("status").eq("id", unpaid).single();
    expect(first.data!.status).toBe("expired");
    const firstNights = await admin.from("booking_nights").select("night").eq("booking_id", unpaid).not("expires_at", "is", null);
    expect(firstNights.data).toEqual([]);
    const firstEvents = await admin.from("booking_events").select("action, detail").eq("booking_id", unpaid);
    expect(firstEvents.data!.filter((e) => e.action === "hold_expired" && e.detail?.swept_by === "ops_lapse_holds")).toHaveLength(1);
    expect(firstEvents.data!.filter((e) => String(e.action).startsWith("email_") && e.action !== "email_pending")).toEqual([]);
    expect(firstEvents.data!.filter((e) => e.action === "email_sent" || e.action === "email_failed")).toEqual([]);

    const second = await admin.from("bookings").select("status").eq("id", partPaid).single();
    expect(second.data!.status).toBe("awaiting_payment");
    const secondNights = await admin.from("booking_nights").select("night").eq("booking_id", partPaid);
    expect(secondNights.data!.length).toBe(3);
    const secondEvents = await admin.from("booking_events").select("action, detail").eq("booking_id", partPaid);
    expect(secondEvents.data!.filter((e) => e.action === "needs_attention" && e.detail?.reason === "deadline_passed_part_paid")).toHaveLength(1);
  } finally {
    await admin.from("bookings").delete().eq("stay_id", stay);
    await admin.from("stays").delete().eq("id", stay);
    await admin.from("destinations").delete().eq("id", destination);
    if (bankBefore) await admin.from("booking_bank_details").update(bankBefore).eq("id", 1);
    if (madeOwner) await admin.auth.admin.deleteUser(madeOwner);
  }
});
