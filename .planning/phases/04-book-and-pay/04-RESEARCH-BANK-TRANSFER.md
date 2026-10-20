# Phase 4: Book and request (bank transfer) - Research addendum

**Researched:** 2026-10-19
**Domain:** request to book, manual bank-transfer recording, scheduled lapse, owner-only bank details (Next.js 15.5 on OpenNext/Cloudflare Workers, Supabase Postgres, Resend)
**Confidence:** HIGH for repo facts and the SQL design (read from the live migration and the code). MEDIUM for how `scheduled` behaves on this Worker (the docs are silent on two points; a local test settles both). LOW for CPU numbers (unmeasured).
**Scope:** addendum to `04-RESEARCH.md` (Stripe era; not edited). For plans 04-08, 04-03, 04-09, 04-05, 04-06, 04-07. Planning only: nothing was run against Supabase or Cloudflare.

## Summary

The rewrite is small in the database and large in the dashboard. The live migration `20261005110000` already has the hold, the `awaiting_payment` status, the lapse function, the events log and the money snapshot. What is missing is one function that turns a `held` web booking into a timed request, two functions that record and void a bank payment, an owner-only table for the bank fields, a gate that no longer reads a Stripe key, and a way to run the lapse on time and email the guest once.

Four findings change the plans. (1) `tests/secrets.test.mjs:13-20` allows the service-role key name in only two files, so the scheduled handler must build its client through `lib/supabase/clients.ts`, never name the key in `worker/`. (2) `public_booked_nights()` (migration lines 1917-1918) would bake every `awaiting_payment` web request into the static calendar, and a baked date stays "booked" until the next rebuild: exclude web requests there. (3) `tests/phase-02-gates.test.mjs:7,50-52` fails any file in `app/`, `components/`, `lib/` that contains the text `re_` anywhere, so names such as `failure_`, `before_`, `more_`, `secure_` are banned in TypeScript and copy. (4) The email seam: 04-08 (routes, first) needs emails that 04-05 builds later; give 04-08 a notifier interface with a not-ready default.

**Primary recommendation:** Put the cron on `almar-ops` only (one trigger, every 5 minutes), claim lapsed-request emails with columns on `bookings` plus a lease, send with Resend idempotency key `lapse/<booking_id>`, keep all money rules in two SQL functions with a pure TypeScript mirror for the dashboard preview, store bank fields and the transfer window behind definer functions that only `service_role` may run, and use the two reserved migration files (`20261019160000` owner config, `20261019170000` booking state).

## User Constraints (from CONTEXT.md)

Source: `.planning/phases/04-book-and-pay/04-CONTEXT.md` (B-23..B-35 of 2026-10-19 win over the older B-decisions they supersede or reword) and `.planning/decisions/2026-10-19-request-to-book-bank-transfer.md` (signed 2026-10-19 16:18 CET).

### Locked Decisions

- **B-23 (owner):** Last step is Request, not Pay. No card provider in Phase 4.
- **B-24 (owner):** Guest pays by bank transfer in AED with `ALMAR-XXXXXX` as the reference; the owner records it (PAY-19).
- **B-25:** `booking_payments.method` (`bank_transfer`; `card` later). Wrong records are voided with a reason, never deleted.
- **Superseded:** B-03, B-06, B-07, B-08, B-19, B-20. **Reworded:** B-02, B-09, B-11 (Pay -> Request); B-14 (receipt after the owner records); B-15 (balance by transfer instructions); B-18 (owner emailed on each request and each recorded payment).
- **B-26 (owner, Q1):** No accept step. The request email and the booking page carry the bank details at once; the owner can still Cancel an `awaiting_payment` request.
- **B-27 (owner, Q2):** Transfer window is the owner's number in Dashboard -> Settings -> Money; the field starts empty and live requests stay closed until it is set; floor 35 minutes; preview uses a test value.
- **B-28 (owner, Q3):** No receipt upload in v1. The guest replies to the booking email with the bank receipt; the owner checks the bank before recording.
- **B-29 (owner, Q4):** The guest pays all transfer fees ("all fees paid by sender", OUR). The email says so; the booking terms use the owner's own wording only.
- **B-30 (owner, Q5):** Bank fields: account name, bank, IBAN, SWIFT, bank address, and one note line; currency fixed to AED. The owner types the values in the dashboard (never in chat). The note line is typed in English and AR/ES are filled on Save (2026-10-14 auto-translate rule). Stored owner-only, outside `site_settings`.
- **B-31 (owner, Q6):** Recording refunds made from the bank is Phase 5 (record only, never more than paid).
- **B-32 (owner, Q7):** A recorded total below the deposit keeps the booking `awaiting_payment` with a "part received" flag; the nights stay held only to the deadline; the guest sees what is still due. Deposit paid starts at recorded total >= `deposit_fils`.
- **B-33 (owner, Q8):** No automatic tolerance. When recording, the owner can tick "Accept as paid" and type a reason; the gap is written off in the log and the status moves on.
- **B-34 (owner, Q9, chose this over the recommended re-claim):** Money recorded on an `expired` or `cancelled` booking never re-claims nights by itself. It is recorded, the booking is flagged `needs_attention` (`paid_after_expiry` / `paid_after_cancel`), and the owner re-books or refunds from the bank.
- **B-35 (owner, Q10):** Plan 04-09 builds the dashboard Bookings list and detail (with notes) and the money Settings (VAT %, deposit %, balance due days, transfer window, bank details) in Phase 4; 05-01 shrinks to match.
- Still in force from the older list: B-09 (30-minute hold while filling, in Postgres, no cron for the hold itself), B-10 (guest checkout without account, travellers), B-11 (airports, home pickup), B-12, B-13 (terms checkbox; live requests off until the owner's terms text exists), B-16 (booking page is the source of truth, signed link), B-17 (`ALMAR-XXXXXX`), B-21 (late booking: full only), B-22 (guest APIs on `almar`, dashboard on `almar-ops`).
- Decision record "What stays": money engine (04-01), database (04-02), booking page, signed link, `ALMAR-XXXXXX`, emails in the guest's language, terms gate. "Gate": built, not renamed; `is_test` from the host.

### Claude's Discretion

- Booking page URL shape, as long as it passes job 10's exact-path allow-list (query parameters allowed).
- Designs not on the canvas (Request step, booking page with transfer instructions, the emails, Bookings list and detail, Record payment and Void dialogs, money Settings and Bank details) get pictures for the owner's signature before code.

### Deferred Ideas (OUT OF SCOPE)

- Card payments and everything behind them (PAY-06, PAY-08, PAY-09, PAY-13, PAY-15; card part of PAY-10; PAY-07's card rules).
- Guest receipt upload on the booking page (Q3 option B).
- Coupons (PAY-05, OPS-12): deferred to v1.1 by 04-CONTEXT. See the conflict note in Validation Architecture.
- Damage hold, PDF receipt, FX lock, reminders and auto-cancel (PAY-11), refunds from our app (PAY-12 recording is Phase 5), guest add-ons after pay (ADDN-02), stay overlay inside `/booking/trip`, saved address book.

## Project Constraints (from CLAUDE.md, CLAUDE.local.md, connections.md, 00-common-rules.md)

There is no repo-root `CLAUDE.md`. The binding files are the owner's `CLAUDE.md` / `CLAUDE.local.md`, `.claude/rules/connections.md` and `.planning/prompts/00-common-rules.md`.

- Never invent prices, rates, fees, deadlines, bank details or legal wording. Owner values are typed in the dashboard; placeholders stay in brackets. The transfer window, bank fields, VAT, deposit, balance due days and the terms text are all his.
- EN, AR (RTL) and ES in the same pass for every component, text, email and alt. Square corners. Gold is a line only. No radio controls. Primary buttons: Teal fill, White text. Checked at 390, 834 and 1440.
- Design before code: pictures for the owner's signature for every screen and email the canvas does not have.
- A control that is shown works end to end, or it is not shown (the current dashboard Bookings screen shows fake fields and a fake "New booking": `app/dashboard/(ops)/bookings/bookings-screen.tsx:30-31,53-58`).
- Ask the controller for a migration number before writing a migration. Reserved for Phase 4: `20261019160000_<name>.sql` and `20261019170000_<name>.sql`; a third only from the controller (`.planning/CONTROL-BOARD.md:189` on `origin/main`). The live file `20261005110000` is never edited.
- Ask the controller before editing a shared file: `lib/copy/*.ts`, `package.json`, `wrangler*.toml`, `next.config.ts`, `app/globals.css`, `tokens.json`.
- No secret in a file, chat or log. Owner secret steps are numbered and then wait. `RESEND_API_KEY`, `BOOKING_LINK_SECRET`, the service-role key are Worker secrets set from his terminal.
- No deploy, no live SQL, no change to Cloudflare, DNS, Supabase settings or Resend from a work session. Live probes are plain GET only.
- Local gates: `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`; a dev server, build, Playwright or local Supabase stack needs the controller's "go" for that run, one lane at a time, `--workers=2` at most.
- Add files to git by name; never edit STATE, ROADMAP, CONTROL-BOARD, GOAL, decisions or prompts from a work session (put the change in the hand-over).

## Phase Requirements

<phase_requirements>

| ID | Description (REQUIREMENTS.md, reworded 2026-10-19) | Research Support |
|----|-----------------------------------------------------|------------------|
| BOOK-01 | Search from the hero, one destination, dates, guests, no charge | Landed server side (04-02); UI in 04-03. Nothing is charged anywhere in Phase 4. |
| BOOK-02 | `/booking/trip`: summary -> add-ons -> traveller details -> request; back until request | Q8: keep PayStep structure, replace `paymentArea` with a request area. |
| BOOK-03 | 30-minute hold on the request step; after Request the nights stay held to the transfer deadline | Q2: `request_web_booking` re-holds nights to now + window. |
| BOOK-04 | One destination per booking; a second city opens WhatsApp | Unchanged (04-03 summary step). |
| BOOK-08 | Approximate map publicly; exact address only after Confirmed | Q8: `booking_view` returns access only for `confirmed`/`completed`. |
| STAY-01, STAY-02 | Reasons shown, party within max | Landed (04-02 quote). Add reason `requests_closed` (Q5). |
| JOUR-01..04 | Airport, home pickup, inclusions | Landed server side; UI in 04-03. |
| ADDN-01 | Add-ons priced per night or per stay | Landed (04-02, 04-01). |
| IDEN-01, IDEN-02 | Guest details, terms, travellers | Landed server side; terms text gate in Q5. |
| PAY-01, PAY-02, PAY-03 | Breakdown, VAT/deposit from Settings, choose deposit or full before requesting | Landed (04-01). Settings editing in Q4. |
| PAY-05 | Coupon | Deferred to v1.1; conflict flagged in Validation Architecture. Do not plan. |
| PAY-07 | No gift cards, no BNPL | Nothing to build; one source-level test (Validation). |
| PAY-10 | Remainder and extras by transfer with the same instructions on the booking page | Q3 and Q8: instructions shown while a balance is due. |
| PAY-14 | `ALMAR-XXXXXX` | Landed (04-02). Used as the transfer reference. |
| PAY-17 | Receipt email after the owner records; ops can resend | Q6. |
| PAY-18 | Bank details and transfer window owner-only, shown only in the guest's own emails and page | Q4, Q5, Q8. |
| PAY-19 | Record (amount as received, date, bank reference, one confirm) and void; late/short/extra flagged, never refused; logged | Q3. |
| PAY-20 | Unpaid request lapses on schedule, frees nights, guest emailed | Q1. |
| AUTH-01 | Checkout without account; email remembers bookings | Landed (04-02 access rule); `/bookings` list in 04-06. |
| OPS-04 | Search and filter bookings | Q7. The signed Phase 5 list was a subset (search, status); see Open Questions. |
| OPS-10 | Stay access only after Confirmed | Q7, Q8. |
| OPS-13 | Booking page is the source of truth | Q8. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Request (held -> awaiting_payment, re-hold nights) | Database (one SQL function) | API on `almar` | The advisory lock, the nights and the status change must be one transaction. |
| Transfer window, bank fields | Database (owner-only table, definer functions) | API on `almar-ops` (owner), `almar` (guest read) | Must never reach anon or authenticated. |
| Record payment, Void, status recompute | Database | API on `almar-ops` | Money rules in one place; the route only checks owner, origin, shape. |
| Gate (open/closed, `is_test`) | API (pure function on host + env + one RPC) | Database (re-check in `request_web_booking`) | Host and secrets are runtime facts; SQL re-checks the owner values. |
| Lapse and lapse email | Scheduled Worker `almar-ops` | Database (claim, lease, events) | Needs Resend and service role; the database makes "exactly once" safe. |
| Request / receipt / owner emails | API (`almar` for request, `almar-ops` for record) | Resend | Sent after the commit, from the Worker that holds the action. |
| Booking page and instructions | Static shell (browser) + `POST /api/booking/view` | Database (`booking_view`) | Page stays static; data and bank details only after the access check. |
| Dashboard Bookings, Settings | Browser (client screens) | API `/api/ops/*` on `almar-ops` | Existing kit and owner guard. |
| Preview of Record payment result | Browser (pure mirror of the SQL rule) | Database (truth) | Owner sees the consequence before one confirm; SQL decides. |

## Standard Stack

No new package. [VERIFIED: package.json:20-45]

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| `@supabase/supabase-js` | 2.117.2 | RPC with the service-role client | `createSupabaseAdmin()` in `lib/supabase/clients.ts:42-49` |
| `resend` | 6.29.0 | Send mail with `idempotencyKey` | already used in `lib/contact-inquiry` route and `lib/auth/magic-link-server.ts` |
| `wrangler` | 4.146.0 | `[triggers]`, `--test-scheduled` | repo pin; the global `wrangler` on PATH is not the pin |
| `@opennextjs/cloudflare` | 1.20.6 | Custom worker entry with extra handlers | `worker/almar-ops.mjs` already is one |
| `@playwright/test` | 1.63.0 | Mocked UI specs, build specs on `wrangler dev` | existing configs |
| pgTAP, `node --test` | existing | `supabase/tests/*.test.sql`, `tests/*.test.mjs` | `node tests/helpers/local-supabase.mjs test` |

**Package Legitimacy Audit:** no package is added, so there is nothing to install or check. IBAN and BIC checks are about 25 lines of pure code (Q4); do not add `ibantools` or any other package. Removed: none. Flagged: none.

## Q1. Scheduled lapse (PAY-20, B-09 reworded)

### Answer in one paragraph

Add a `scheduled` handler to `worker/almar-ops.mjs` and one cron to `wrangler.ops.toml`. Do not add either to `worker/almar.mjs` or to `wrangler.toml` / `wrangler.preview.toml`. The handler calls `ops_lapse_holds()` and then claims the lapsed web requests that were never emailed, sends "request lapsed" once each, and marks them. The claim lives in new columns on `bookings`, not in the return value of `ops_lapse_holds()`, because `place_hold` also expires bookings.

### Which Worker

| Worker | Service role | `RESEND_API_KEY` | `BOOKING_LINK_SECRET` | Cron? |
|--------|--------------|------------------|-----------------------|-------|
| `almar-ops` | yes (set 2026-10-11 18:17, `STATE.md:60`) | yes (same line) | not recorded | **yes** |
| `almar` | not recorded | no: the Resend domain and the key on `almar` gate 3.3 part B (`STATE.md:46`) | no: "Holds stay closed until 04-03 and `BOOKING_LINK_SECRET`" (`STATE.md:64`) | no |
| `almar-preview` | no, on purpose (`wrangler.preview.toml:1-5`) | no | no | no |

- One cron on one Worker. Workers Free allows 5 Cron Triggers per account. [CITED: developers.cloudflare.com/workers/platform/limits/]
- The lapse email needs no link secret if it links to the stay page (recommended, Q6). So the cron needs only the Supabase names and `RESEND_API_KEY`, which `almar-ops` has today.
- The same cron sweeps test (preview-host) bookings too: the database is one. Their lapse mail links to the preview origin (`is_test` decides the origin, not `PUBLIC_ORIGIN`).
- Alternative considered: Supabase Cron (`pg_cron`) could run `ops_lapse_holds()` inside Postgres, with jobs from every second to once a year. [CITED: supabase.com/docs/guides/cron] The email still needs a Worker, enabling the extension is a Supabase settings step, and the decision record already chose a scheduled Worker. Not used.

### Config

```toml
# wrangler.ops.toml  (add at the end; "Deploying replaces previous triggers" [CITED: developers.cloudflare.com/workers/configuration/cron-triggers/])
[triggers]
crons = ["*/5 * * * *"]
```

- Cron runs in UTC, five fields, `* * * * *` is "at every minute", so one minute is the finest step. [CITED: developers.cloudflare.com/workers/configuration/cron-triggers/] Changes can take up to 15 minutes to propagate. [CITED: same page]
- Recommended every 5 minutes. Availability is already correct without the cron (`place_hold` sweeps, `booking_context.taken` ignores rows older than the 2-minute grace). The cron only changes status, frees nights nobody asked for, and sends the email. Five minutes is 288 runs a day; one minute is 1,440. [ASSUMED: lateness of up to 5 minutes plus the 2-minute grace is fine for the owner; confirm in UAT]
- Free plan limits per invocation. [CITED: developers.cloudflare.com/workers/platform/limits/]

| Limit | Free | Meaning here |
|-------|------|--------------|
| CPU time per Cron Trigger | 10 ms (Paid: 30 s under 1 hour interval) | Rendering mail is string work; keep the batch small and measure with `wrangler tail`. |
| Subrequests per invocation | 50 | One tick = lapse (1) + claim (1) + brand read (1) + per mail: send + finish (2). Batch 5 -> about 13. |
| Duration | 15 minutes for the promise returned by `scheduled()` [CITED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/] | Not a risk. |
| Cron Triggers per account | 5 | Use 1. |

CPU is the open risk (A4 in the Assumptions Log). If `wrangler tail --format json` shows `exceededCpu`, it goes to the owner as the Workers Paid question with the numbers (same rule as 04-02's CPU probe).

### Entry

```js
// worker/almar-ops.mjs  (sketch; the existing fetch stays as it is)
import { runScheduledLapse } from "../lib/booking/lapse-cron-server.ts";

export default {
  fetch: (request, env, ctx) => { /* unchanged */ },
  async scheduled(controller, env) {
    // The runtime waits for the promise returned here. A rejection shows in the Cron Trigger past events.
    await runScheduledLapse(env, new Date(controller.scheduledTime));
  },
};
```

- Handler signature `scheduled(controller, env, ctx)`; `controller.cron`, `controller.scheduledTime`; the runtime waits for the returned promise. [CITED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/] OpenNext documents exactly this: a custom worker re-uses the generated fetch handler and adds other handlers. [CITED: opennext.js.org/cloudflare/howtos/custom-worker]
- **Secrets gate:** `tests/secrets.test.mjs:13-20` fails if `SUPABASE_SERVICE_ROLE_KEY` is named anywhere in `app/`, `components/`, `lib/`, `scripts/`, `worker/` except `lib/supabase/clients.ts` and `scripts/import-catalog.mjs`. So `lib/booking/lapse-cron-server.ts` calls `createSupabaseAdmin()` and reads `RESEND_API_KEY` from `env`/`process.env`; it never names the service key.
- **`process.env` inside `scheduled`:** with `nodejs_compat` and a compatibility date on or after 2025-04-01, `process.env` holds the Worker's variables and secrets (`wrangler.ops.toml:15-16` has `nodejs_compat`, date 2026-09-23). [CITED: developers.cloudflare.com/workers/runtime-apis/nodejs/process/] The page does not say this holds in non-fetch handlers, and OpenNext's page says nothing about it. [ASSUMED]. Keep a 6-line fallback in `runScheduledLapse`: for each string value in `env`, set `process.env[key]` when it is undefined. It names no key. The build spec (below) proves the real behaviour.
- **Pins to update in the same commit** (they will fail otherwise): `tests/ops-runtime.test.mjs:236-249` (the import list of `worker/almar-ops.mjs` is pinned to exactly five modules) and `tests/ops-runtime.test.mjs:411-419` (the table list of `wrangler.ops.toml` is pinned to `[assets] [ai] [[r2_buckets]] [[routes]]`). Add one test: `wrangler.ops.toml` has exactly one cron, `wrangler.toml` and `wrangler.preview.toml` have none, `worker/almar.mjs` has no `scheduled`.
- Never add an HTTP route for the cron. `worker/handle.mjs:42` sends only exact allow-listed paths to Next, and `lib/ops-routes.ts:104` refuses `cdn-cgi`.

### Core as a pure function

```ts
// lib/booking/lapse-cron.ts  (no env, no Next; deps injected)
export const LAPSE_EMAIL_BATCH = 5;
export type LapseDeps = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  send(job: LapseJob, opts: { idempotencyKey: string }): Promise<{ ok: true } | { ok: false; error: string }>;
};
export async function runLapseCycle(deps: LapseDeps): Promise<{ lapsed: number; claimed: number; sent: number; failed: number }> {
  // 1. ops_lapse_holds(): int. A database error throws (the cron past events show it).
  // 2. claim_lapse_emails(p_limit => LAPSE_EMAIL_BATCH): jsonb list.
  // 3. for each job, in order: send with key `lapse/${job.booking_id}`; then finish_lapse_email(p_ok, p_error).
  //    One failed mail never stops the others; the error NAME only goes to the log row, never the payload.
}
```

`lib/booking/lapse-cron-server.ts` builds `rpc` from `createSupabaseAdmin()` and `send` from `new Resend(key).emails.send(message, { idempotencyKey })` plus the 04-05 template. No key present: record `email_failed` with error `no_key` and return (this makes the build spec deterministic without sending real mail).

### SQL: which bookings lapsed and still need their email

`ops_lapse_holds()` returns only a count (`...bookings_and_ops.sql:1392-1418`), and `place_hold` (lines 762-781) and `mark_session_expired` also set `expired`. So the cron must not rely on the count. It claims by state:

```sql
-- migration B (20261019170000), sketch
alter table public.bookings
  add column if not exists requested_at timestamptz,                 -- set by request_web_booking
  add column if not exists lapse_email_claimed_at timestamptz,
  add column if not exists lapse_email_sent_at timestamptz,
  add column if not exists lapse_email_attempts int not null default 0 check (lapse_email_attempts >= 0);

create index if not exists bookings_lapse_email_idx on public.bookings (hold_expires_at)
  where status = 'expired' and source = 'web' and requested_at is not null and lapse_email_sent_at is null;

create or replace function public.claim_lapse_emails(p_limit int default 5) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  with picked as (
    select b.id from public.bookings b
     where b.status = 'expired' and b.source = 'web' and b.requested_at is not null
       and b.paid_fils = 0                       -- money recorded: owner decides, no automatic mail (Open Question 1)
       and b.lapse_email_sent_at is null and b.lapse_email_attempts < 5
       and (b.lapse_email_claimed_at is null or b.lapse_email_claimed_at < now() - interval '10 minutes')
     order by b.hold_expires_at
     limit least(greatest(coalesce(p_limit, 5), 1), 10)
     for update skip locked                      -- [CITED: postgresql.org/docs/current/sql-select.html, SKIP LOCKED for queue-like tables]
  ), claimed as (
    update public.bookings b
       set lapse_email_claimed_at = now(), lapse_email_attempts = b.lapse_email_attempts + 1
      from picked where b.id = picked.id
    returning b.id, b.ref, b.email, b.guest_name, b.locale, b.is_test, b.stay_id, b.arrive, b.leave, b.hold_expires_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('booking_id', c.id, 'ref', c.ref, 'email', c.email, 'guest_name', c.guest_name,
           'locale', c.locale, 'is_test', c.is_test, 'stay_slug', s.slug, 'stay_title', /* locale title, else EN, else slug */ null,
           'arrive', c.arrive, 'leave', c.leave, 'deadline', c.hold_expires_at)), '[]'::jsonb)
    into v from claimed c join public.stays s on s.id = c.stay_id;
  return v;
end $$;
-- revoke execute from public, anon, authenticated; grant execute to service_role  (the file's one-grant-per-function rule)

-- finish_lapse_email(p_booking uuid, p_ok boolean, p_error text default null) returns void:
--   ok: lapse_email_sent_at = now(); event email_sent {template:'request_lapsed'}
--   not ok: event email_failed {template, error: left(p_error, 60)}; the lease expires on its own and the next tick retries (max 5 attempts)
```

- Lock order: the claim takes only the booking row lock and never waits for the per-stay advisory lock, so it cannot deadlock with `booking_lock` (rule at migration lines 23-24).
- "Exactly once": the sent timestamp ends it; the lease stops two ticks sending together; Resend's idempotency key stops a duplicate if the Worker dies after Resend accepted the mail but before `finish`. Keys last 24 hours, up to 256 characters, same key with another payload returns 409. [CITED: resend.com/docs/dashboard/emails/idempotency-keys] Node: `resend.emails.send(payload, { idempotencyKey })`. [CITED: same page]
- Why not use the count: a request swept by `place_hold` (a competing guest asks for the same nights) is expired without `ops_lapse_holds()` ever seeing it.
- Never email: a `held` booking that expired before Request (`requested_at is null`), an ops-made booking (`source = 'ops'`), an owner-cancelled booking (status `cancelled`).
- **Money recorded before the lapse** (B-32 part payment): a trigger flags it. `bookings_flag_expired_money` (BEFORE UPDATE OF status): when a `held`/`awaiting_payment` row becomes `expired` and `paid_fils > 0`, set `needs_attention = true`, `attention_reason = 'expired_with_payment'` and add a `needs_attention` event. A trigger covers every sweep path (`place_hold`, `ops_lapse_holds`, `mark_session_expired`, `booking_drop_hold`) without redefining those big functions. The claim skips these bookings (`paid_fils = 0`). This case is not in B-27..B-35; see Open Question 1.

### Tests

| Layer | What | Command |
|-------|------|---------|
| node, pure | `runLapseCycle` with fake deps: zero lapsed sends nothing; 3 claimed -> 3 sends with keys `lapse/<id>`; one send fails -> `finish(false)` and the rest go on; a database error on the claim throws; batch constant is 5 | `node --test tests/booking-lapse-cron.test.mjs` |
| node, source | one cron in `wrangler.ops.toml`, none in the other two; `scheduled` only in `worker/almar-ops.mjs`; service key name absent from `worker/` and the new lib files | `node --test tests/ops-runtime.test.mjs tests/secrets.test.mjs` |
| pgTAP | claim picks only expired web requested unsent; skips `paid_fils > 0`, ops source, never-requested; second claim returns none inside the lease; after lease it returns again; 5 attempts stop it; finish sets the flag; trigger flags money-at-expiry; anon cannot execute | `node tests/helpers/local-supabase.mjs test supabase/tests/bank-transfer-core.test.sql` |
| node + stack | 8 parallel claims give each booking to exactly one caller | `ALMAR_REQUIRE_STACK=1 node --test tests/booking-lapse.db.test.mjs` (takes `acquireStackLock`, 04-02 pattern) |
| Playwright build spec (later, stack + ops stack config) | start the ops Worker with `--test-scheduled`, seed an expired requested booking, `GET /cdn-cgi/local/scheduled?cron=*/5+*+*+*+*&format=json` | see below |

Local scheduled test, in the current docs: `wrangler dev --test-scheduled` exposes `/cdn-cgi/local/scheduled`; `?cron=` simulates a pattern, `?time=` overrides `scheduledTime`, `?format=json` returns the outcome; local dev never runs crons by itself. [CITED: developers.cloudflare.com/workers/wrangler/commands/workers/ and developers.cloudflare.com/workers/configuration/cron-triggers/] The older name `/__scheduled` appears in one Cloudflare Containers page; do not use it. `playwright.build.config.ts` starts `wrangler dev` without that flag (webServer command), so add `${process.env.PW_TEST_SCHEDULED === "1" ? " --test-scheduled" : ""}` (shared file: controller grant). Run: `PW_TEST_SCHEDULED=1 PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/lapse-cron.spec.ts --workers=1` after `make-ops-stack-config.mjs` (`tests/build/make-ops-stack-config.mjs:44-51` writes `.dev.vars` with the local stack names). Run it without `RESEND_API_KEY`: assert the booking is claimed (`lapse_email_attempts = 1`), an `email_failed` event with error `no_key` exists and the invocation outcome is ok. That proves secrets reach `process.env` in `scheduled` (A1) without sending real mail. Preview has no secrets on purpose, so there is no preview cron and nothing to test there.

### Deploy order (owner and controller steps)

Apply migration B first, then deploy `almar-ops`. A deployed cron with a missing function errors every tick (harmless but noisy). Set no other secret for the cron.

## Q2. Request function (B-23, B-26, B-27)

### What the live migration does today

| Place | Behaviour | Evidence |
|-------|-----------|----------|
| `create_web_booking` | booking `held`, `hold_expires_at = now() + 30 min`; nights placed with `hold + 1 minute` | `bookings_and_ops.sql:1199,1211-1212` |
| `place_hold` | one transaction under the stay advisory lock; sweeps rows whose `expires_at < now() - 2 minutes` (bookings `held`/`awaiting_payment` -> `expired`, event `hold_expired`); refuses ops blocks (`blocked`) and held nights (`sold_out`); upsert refreshes the booking's own nights | `:740-806` (grace `:767,779`; own-row upsert `:794-797`) |
| `ops_create_booking` | status `awaiting_payment`; `hold_until` must be more than 35 minutes ahead else `almar:hold_too_soon`; nights get exactly `hold_until` (no margin) | `:1288-1289,1308` |
| `ops_set_booking_status` | targets only `confirmed` (from `deposit_paid`/`paid_in_full`), `completed` (from `confirmed`), `cancelled` (from `held`...`confirmed`); there is no owner transition to `awaiting_payment`; Cancel deletes all nights | `:1355-1361,1371` |
| `ops_lapse_holds` | `held`/`awaiting_payment` with `hold_expires_at < now() - 2 minutes` -> `expired`, timed nights deleted, event | `:1392-1418` |
| `public_booked_nights` | lists permanent nights and nights of `awaiting_payment` bookings with `expires_at > now()` | `:1917-1918` |
| `booking_write` | `is_test` comes from the payload (default true); terms accepted at hold time; settings drift check; `due_now < 200` fils refused | `:934-939,1108-1128` |

### Proposed `request_web_booking`

Signature (sketch): `request_web_booking(p_booking uuid, p_expect_test boolean, p_test_window_minutes int default null) returns jsonb`. Definer, `search_path ''`, execute `service_role` only. Public-style answer: `{ ok: true, ... }` or `{ ok: false, reason }` for expected refusals (like `create_web_booking`); a malformed call raises `almar:invalid`.

Semantics, in order:

1. `v_b := booking_lock(p_booking)` (stay advisory lock, then the row). Unknown booking, `source <> 'web'`, or `is_test <> p_expect_test` -> `{ ok: false, reason: 'not_found' }` (the route answers the same 404 as a wrong token).
2. Already requested: `status = 'awaiting_payment' and requested_at is not null` -> `{ ok: true, first_time: false, deadline, ... }` and change nothing. This makes a double click and a retry safe, and the route sends mail only when `first_time` is true.
3. Must be `held` with `hold_expires_at > now()` (no grace). Else `{ ok: false, reason: 'hold_ended' }` (the guest restarts from the stay, as the decision record says).
4. Window: if `is_test` then `greatest(coalesce(p_test_window_minutes, 35), 35)`; else `site_settings.transfer_window_minutes`. Null window, or bank details incomplete -> `{ ok: false, reason: 'requests_closed' }`. This is the SQL half of the gate (Q5). The floor is the signed 35 minutes (B-27). Compare minutes, not timestamps (the existing check `hold_until <= now() + 35 min` is strict and would refuse an exact floor).
5. Optional cap on open requests per email: count `awaiting_payment` web bookings of the same email, other than this one; at or above the cap -> `{ ok: false, reason: 'too_many_open' }`. The number is the owner's call (Open Question 2).
6. `v_until := now() + make_interval(mins => v_window)`; `place_hold(booking, stay, arrive, leave, v_until)`; any answer but `ok` -> `{ ok: false, reason: <blocked|sold_out> }` with nothing written (place_hold writes nights only on `ok`).
7. `update bookings set status = 'awaiting_payment', requested_at = now(), hold_expires_at = v_until`; event `request_sent` with `from_status 'held'`, `to_status 'awaiting_payment'` and detail `{ window_minutes, deadline, plan, due_now_fils, is_test }`. Return everything the route needs for the mails (ref, email, locale, plan, `due_now_fils`, deadline, `is_test`).

After Request, `hold_expires_at` means "pay by". Do not add a second deadline column.

### Margins and graces without Stripe

| Item | Keep? | Why |
|------|-------|-----|
| 1-minute margin of nights over the 30-minute hold (`:1211-1212`) | Leave `create_web_booking` unchanged | It was for the Checkout Session; harmless now. Not worth touching a live function. |
| Same margin at Request | No margin: nights `expires_at = hold_expires_at` | The `ops_create_booking` precedent (`:1308`). |
| 2-minute sweep grace (`:767,779,1405`) | Keep | It is a jitter guard, not a Stripe rule. B-34 covers money after the grace. Do not lengthen it (no decision). |
| 35-minute floor | Keep as the lower bound of the window | Signed in B-27. `hold_too_soon` stays for hand-made bookings. |
| `due_now < 200` fils refusal (`:1127`) and `amount_fils >= 200` check (`:148`) | Leave | Stripe's minimum, but harmless; removing it is a needless change to a live function. |

### Two related changes in the same migration

- `public_booked_nights()`: add `b.source = 'ops'` to the awaiting branch, so the static calendar bakes permanent nights and the owner's hand-holds only. Without it every web request (hours or days long) is baked "booked" at the next publish rebuild and stays so after it lapses until another rebuild. The live quote still reports a web request as `sold_out` with a reason (B-02). `create or replace` with the same signature; the view `api_stay_blocked_days` keeps working.
- Do not set `affects_site: true` on Record payment, Void, Cancel or Confirm. The baked calendar is already allowed to be stale (04-02 design comment, `:1903-1906`); live availability is the quote.

### Tests

pgTAP (`bank-transfer-core.test.sql`): happy path (status, `requested_at`, `hold_expires_at`, nights' `expires_at` equal the deadline, event); idempotent second call; `hold_ended` after lapse; `requests_closed` for null window and for incomplete bank; test host uses the test window and the 35 floor; ops block added after the hold -> `blocked` with the booking still `held`; two requests racing give one winner state; `source = 'ops'` and `is_test` mismatch -> `not_found`; `public_booked_nights()` excludes a web request and includes an ops hand-hold. Node (`tests/booking-request.test.mjs`): route order and answers with a fake db. Commands as in Q9.

## Q3. Payment recording and void (PAY-19, B-25, B-31..B-34)

### What exists

`booking_payments` (`bookings_and_ops.sql:144-161`): `kind in ('deposit','full','balance')`, `amount_fils >= 200`, `status in ('open','succeeded','expired','failed')`, Stripe-only ids, `paid_at`. `bookings.paid_fils` is maintained by `record_payment` (`:1616-1706`); `needs_attention` is a boolean without a reason (`:87`); the reason lives only in the `needs_attention` event. `booking_events.action` has a check list (`:193`). `record_payment` re-claims nights (`:1663-1672`) and sets `deposit_paid` for any amount: both are wrong for transfers (B-32, B-34). Do not edit it; the new function is separate.

### Columns (migration B)

```sql
alter table public.bookings
  add column if not exists written_off_fils bigint not null default 0 check (written_off_fils >= 0),
  add column if not exists attention_reason text
    check (attention_reason in ('paid_after_expiry','paid_after_cancel','overpaid','expired_with_payment','nights_lost'));
alter table public.bookings add constraint bookings_attention_pair check (needs_attention or attention_reason is null) not valid;
alter table public.bookings validate constraint bookings_attention_pair;

alter table public.booking_payments
  add column if not exists method text not null default 'card' check (method in ('card','bank_transfer')),
  add column if not exists bank_reference text check (char_length(bank_reference) between 1 and 100),
  add column if not exists received_on date,
  add column if not exists recorded_by uuid,
  add column if not exists request_id uuid unique,            -- idempotency key from the dialog (like bookings.ops_request_id)
  add column if not exists write_off_fils bigint not null default 0 check (write_off_fils >= 0),
  add column if not exists write_off_reason text check (char_length(write_off_reason) between 3 and 300),
  add column if not exists void_reason text check (char_length(void_reason) between 3 and 300),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;
```

- `method` defaults to `'card'` on purpose: the only code that ever wrote a row before this migration is the parked Stripe path, so `'card'` is the truthful backfill; `ops_record_payment` always writes `'bank_transfer'` explicitly.
- `kind`: add `'transfer'` (any amount received by transfer; the booking's status says what it paid for). The alternative, plan-derived `deposit`/`full`/`balance`, mislabels a second part payment. Planner's call (A7). Receipts compute their wording from the booking state after recording, not from `kind`.
- Keep `amount_fils >= 200` (error `amount_too_small`).

### Check constraints on a table that may already have rows

Do not query live. Make the migration correct for 0 rows and for N rows:

```sql
alter table public.booking_payments drop constraint if exists booking_payments_status_check;
alter table public.booking_payments add constraint booking_payments_status_check
  check (status in ('open','succeeded','expired','failed','voided')) not valid;
alter table public.booking_payments validate constraint booking_payments_status_check;
-- same pattern for booking_payments_kind_check (+ 'transfer') and booking_events_action_check
-- (+ 'request_sent','payment_recorded','payment_voided','note_added','attention_resolved')
alter table public.booking_payments add constraint booking_payments_transfer_fields
  check (method <> 'bank_transfer' or (status in ('succeeded','voided') and received_on is not null and recorded_by is not null
         and request_id is not null and bank_reference is not null)) not valid;
alter table public.booking_payments validate constraint booking_payments_transfer_fields;
alter table public.booking_payments add constraint booking_payments_voided_fields
  check ((status = 'voided') = (voided_at is not null and voided_by is not null and void_reason is not null)) not valid;
alter table public.booking_payments validate constraint booking_payments_voided_fields;
```

- `NOT VALID` skips the scan on add, still checks new writes; `VALIDATE CONSTRAINT` then scans with only a `SHARE UPDATE EXCLUSIVE` lock. [CITED: postgresql.org/docs/current/sql-altertable.html] Widening a list can never fail validation; the two pair checks hold for old rows because their `method` is `'card'` and nothing is voided.
- `ADD COLUMN` with a constant default (or none) needs no table rewrite. [CITED: same page]
- The auto-names (`booking_payments_status_check`, `booking_payments_kind_check`, `booking_events_action_check`) are deterministic because the live migration created them inline. Add a pgTAP guard that the three names exist before the drop (`has_check` is not enough; select from `pg_constraint`), so a rename fails loudly in the local run.
- The migration changes nothing if the tables are empty and stays valid if they are not.

### Where the flags live

No jsonb. Derived from columns, computed once in the server read (`ops_get_booking`, `booking_view`) and returned as a `flags` object so no screen recomputes:

| Flag | Source |
|------|--------|
| part received | `status = 'awaiting_payment' and paid_fils > 0` |
| overpaid | `paid_fils > grand_fils` |
| written off | `written_off_fils > 0` (sum of `booking_payments.write_off_fils` of succeeded rows); per-row amount and reason stay on the payment row |
| needs attention | `needs_attention` + `attention_reason` (one text column; the event keeps the history) |
| settled | `paid_fils + written_off_fils` |
| amount due now | awaiting: `max(0, target - settled)` with target = `deposit_fils` for plan deposit, `grand_fils` for plan full; otherwise `max(0, grand_fils - settled)` while status is `deposit_paid`/`confirmed`/`completed`; else 0 |

`paid_fils` and `written_off_fils` are recomputed from the rows (`sum` over `status = 'succeeded'`) inside every record and void, never adjusted by arithmetic, so they cannot drift.

### `ops_record_payment(p jsonb, p_actor uuid)`

Payload keys (unknown keys refused, like `booking_write`): `ref` or `booking_id`, `amount_fils`, `received_on` (`YYYY-MM-DD`), `bank_reference`, `request_id` (uuid made when the dialog opens), `accept_short` (boolean), `accept_reason`. First: `assert_owner(p_actor)` (profile with `role = 'owner'`, the pattern of `save_site_settings` at `20261013120000...sql:114-116`; `ops_set_booking_status` has no such check, add it to the new functions). Then `booking_lock`. Idempotent: a row with the same `request_id` returns its stored result with `first_time: false`. Rules:

| Status before | Result after the row |
|---------------|----------------------|
| `held` | refuse `almar:not_requested` |
| `awaiting_payment`, plan deposit | settled < `deposit_fils`: stay, `part_received`; >= `deposit_fils`: `deposit_paid`; >= `grand_fils`: `paid_in_full` |
| `awaiting_payment`, plan full | settled < `grand_fils`: stay; else `paid_in_full` |
| `deposit_paid` | settled >= `grand_fils`: `paid_in_full`, else stay |
| `confirmed`, `completed`, `paid_in_full` | status unchanged |
| `expired` | row recorded; status and nights untouched; `needs_attention`, reason `paid_after_expiry` (B-34) |
| `cancelled` | same, reason `paid_after_cancel` |

- On moving to `deposit_paid` or `paid_in_full`: the booking's timed nights become permanent (`expires_at = null`). If a paid status is reached but the nights are gone (they cannot be, the lock and the grace prevent it) refuse `almar:nights_lost` rather than re-claim.
- Overpaid (`paid_fils > grand_fils`, any status that moves or stays): record in full, flag `overpaid`. Never refuse (PAY-19).
- "Accept as paid" (`accept_short`, reason 3-300 characters): allowed only where the status can move (`awaiting_payment`, `deposit_paid`, `confirmed`, `completed`); refused on `expired`, `cancelled`, `paid_in_full`, `held` (`almar:not_applicable`). The server recomputes the gap itself: target (deposit or grand for `awaiting_payment`, else grand) minus settled-after-this-row. Gap <= 0 -> `almar:nothing_to_write_off`. The gap is stored on this payment row (`write_off_fils`, `write_off_reason`) and in `bookings.written_off_fils`, so voiding the row reverses the write-off. There is no cap and no tolerance (B-33): the dialog must print the gap amount in the confirm sentence.
- `received_on`: not in the future (UAE date) and not before the booking's creation date. Amount 200 fils up to the `c_max` bound used in `booking_write`.
- Events: `payment_recorded` (detail: payment id, amount, `received_on`, `bank_reference`, `paid_fils` after, write-off amount and reason, status before/after) with `from_status`/`to_status`; when a flag is raised also a `needs_attention` event with the reason (existing action). `actor = 'owner:' || p_actor`.
- Return: booking id, ref, payment id, status after, flags, `first_time`, and what the route needs for mail.

### `ops_void_payment(p_payment uuid, p_reason text, p_actor uuid)`

`assert_owner`, lock the booking of the row. Only `status = 'succeeded' and method = 'bank_transfer'` (else `almar:not_voidable`; a second void is `already_voided`, no change). Set `status = 'voided'`, `void_reason`, `voided_at`, `voided_by`. Recompute `paid_fils` and `written_off_fils` from the rows. Then:

| Status before | After |
|---------------|-------|
| `deposit_paid`, `paid_in_full` | settled >= `grand_fils`: `paid_in_full`; plan deposit and settled >= `deposit_fils`: `deposit_paid`; else `awaiting_payment` with `hold_expires_at = now() + window` and the booking's nights timed again to that deadline (the cron email logic then applies if it lapses) |
| `confirmed`, `completed` | if settled after < the plan target (`deposit_fils` for plan deposit, `grand_fils` for full): refuse `almar:cancel_first`; else status unchanged |
| `awaiting_payment` | stays; flags recomputed |
| `expired`, `cancelled` | status unchanged; clear `needs_attention` only when its reason is one of the money reasons and no money remains |

Going back to `awaiting_payment` needs a window: test host -> test window; live -> `site_settings.transfer_window_minutes`; null -> refuse `almar:window_missing` (the owner sets the window first). Event `payment_voided` with reason, amounts, status before/after. No email to the guest on void (Open Question 6).

### `ops_resolve_attention(p_booking, p_note, p_actor)` (gap found)

Nothing in 04-02 clears `needs_attention`. B-34 says "the owner re-books or refunds from the bank"; afterwards the flag must go. Add a function that clears flag and reason, requires a note (3-500 characters, stored as a booking note) and writes `attention_resolved`. Without it the inbox fills with solved items.

### Notes

New table `booking_notes (id bigint identity pk, booking_id uuid fk cascade, at timestamptz default now(), actor text, body text check (char_length(body) between 1 and 2000))`, RLS on, all privileges revoked, no policy. Function `ops_add_booking_note(p_booking, p_body, p_actor)` writes the note and a `note_added` event (note id, no body). Append only in v1, no edit or delete. A table beats events here because notes are human free text that may hold personal data: a guest delete (IDEN-03, Phase 5) must be able to strip them, and events are a log that is never edited. Notes are never read by a guest function.

### Tests

pgTAP matrix over every row of both tables above, with symbolic numbers (the existing helper `pg_temp.pl` pattern, `bookings-and-ops.test.sql:21-46`): part, exact deposit, between deposit and grand, exact grand, over grand, short with write-off, write-off refused on expired, record on expired/cancelled flags and keeps nights gone, idempotent replay, parallel double record (8 sessions, one row), void each path, void reverses write-off, confirmed cannot drop below target, `assert_owner` refuses a guest profile, anon/authenticated cannot execute, `not_requested` on `held`. A parity test (`tests/payment-rules-parity.db.test.mjs`) runs a grid of inputs through the pure TypeScript `settle()` and through the SQL and compares status, flags and amounts (same idea as the 5,000-draw loop in 04-01).

## Q4. Owner-only bank details and money settings (PAY-18, B-27, B-30, B-35)

### What `site_settings` exposes (confirmed)

- The table has RLS on and no table-level grants (`platform_spine.sql:128-145`). `20261013120000_site_settings_brand.sql` then adds: the view `api_site_settings` (lines 35-41: maintenance, five colours, two faces, logo key), `grant select` on the view to `anon` (43-44), a column-level grant to `anon` on `(id, maintenance, teal, ..., body_face, logo_media_id)` (46-47) and the policy "anon reads the singleton" (49-50).
- So VAT, deposit and `balance_due_days` are not readable by anon today, and pgTAP proves it (`supabase/tests/site_settings_access.test.sql:26-28`). The risk is not today; it is that the table has a public row policy and a column-grant list that a later edit can widen. The owner already decided: bank details live outside it (B-30).
- `transfer_window_minutes` is not secret and is read only by definer functions. It can sit in `site_settings` beside VAT, deposit and balance days (no anon grant on the new column).

### Table and functions (migration A, `20261019160000`)

```sql
create table public.owner_bank_details (
  id int primary key default 1 check (id = 1),
  account_name text check (char_length(account_name) between 1 and 120),
  bank_name text check (char_length(bank_name) between 1 and 120),
  iban text check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  swift text check (swift ~ '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  bank_address text check (char_length(bank_address) between 1 and 300),
  note_en text check (char_length(note_en) between 1 and 300),
  note_ar text check (char_length(note_ar) between 1 and 300),
  note_es text check (char_length(note_es) between 1 and 300),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
-- currency is fixed AED: no column, a constant in the email and the page (B-30)
alter table public.owner_bank_details enable row level security;
revoke all on public.owner_bank_details from public, anon, authenticated;     -- no policy
insert into public.owner_bank_details (id) values (1) on conflict do nothing;  -- all null = incomplete
```

- Functions, all definer, `search_path ''`, `revoke execute from public, anon, authenticated`, `grant execute to service_role` (the file rule at `bookings_and_ops.sql:14-18`; Supabase says the same: functions are callable by every role by default, so revoke and grant back. [CITED: supabase.com/docs/guides/database/functions] RLS does not apply to functions. [CITED: supabase.com/docs/guides/api/securing-your-api]):
  - `ops_get_bank_details()` -> jsonb of all fields (owner route only).
  - `ops_save_bank_details(p jsonb, p_actor uuid)`: `assert_owner`, validates lengths, IBAN checksum and BIC shape in SQL as well as in TypeScript, writes `updated_by`, writes an audit row (below).
  - `booking_gate()` -> `{ window_minutes, bank_complete }` only; never any bank value.
  - `booking_transfer_instructions(p_booking uuid, p_locale text)` -> the bank fields plus the note in the guest's language (fallback English), `amount_due_fils`, `deadline`, **only** when the booking is `awaiting_payment` (or `deposit_paid`/`confirmed`/`completed` with a balance due); else null. The route calls it only after the signed-link or session check, but the function enforces the status rule itself.
- "Complete" = account name, bank name, IBAN, SWIFT, bank address and English note all set. The note line is part of B-30's field list; whether it is required is an owner call (Open Question 4). Recommended: required, so every email has the same shape.
- IBAN mod-97 in SQL: move four characters, map letters `A..Z` to `10..35` (`ascii(c) - 55`), `mod(digits::numeric, 97) = 1`. `numeric` is exact for 34 digits.
- Audit (recommended, small): `owner_bank_details_log (id, at, actor uuid, changed text[])` with field names only (never values), and one plain mail to `inquiries@` "bank details changed by X at T" with no values. This is the standard defence against someone swapping the account number. Owner decision in Open Question 3.

### Existing money settings, and how 04-09 extends them

| Value | Lives | Saved by |
|-------|-------|----------|
| VAT %, deposit % | `site_settings.vat_percent`, `deposit_percent` `numeric(5,2)`, checks 0..100 (`platform_spine.sql:136-137`; `20261013120000...sql:25-27`) | `POST /api/ops/settings` -> `lib/settings/handlers.ts:136-151` -> `save_site_settings` (14 parameters, `:62-135`) |
| balance due days | `site_settings.balance_due_days int` 0..365, column added by 04-02 (`bookings_and_ops.sql:32-33`), read by `booking_context` (`:537-542`) | **nothing**: no route or function writes it (grep of lib/app/supabase) |
| transfer window | does not exist | new |
| bank fields | do not exist | new |

How the existing path works: route file `app/api/ops/settings/route.ts` (`opsGet`/`opsPost`) -> `lib/ops/settings.ts` -> pure handlers `lib/settings/handlers.ts`, body parser `lib/settings/validate.ts` (`parseSettingsSave`, every key required, unknown keys refused), form rules `lib/settings/form.ts` (`isDirty`, `canSave`, `saveBody`), screen `app/dashboard/(ops)/settings/settings-screen.tsx` (money group at `:279-300`, copy in `lib/copy/ops-settings.ts`, group order pinned by `tests/phase-03-settings.test.mjs:27-29`). `affectsSite()` (`handlers.ts:100-107`) looks only at brand, maintenance, logo and faces, so money edits never request a site rebuild. Keep it that way.

Recommended for 04-09, extend, do not duplicate:

1. Add `balance_due_days` (int 0..365 or empty) and `transfer_window` to `SettingsView`, `SettingsSave`, `SettingsForm`, the parser and the screen's money group. Rename the group copy "VAT and deposit" to "Money" (shared copy file: controller grant). Update `tests/phase-03-settings.test.mjs` and `tests/ops-settings.spec.ts`.
2. Add a **16-parameter overload** of `save_site_settings` (the two new values, no defaults) and leave the 14-parameter one in place. Reason: the deployed `almar-ops` (`fd4a3419`) calls the 14-parameter version; dropping it in the migration breaks live Settings until the new Worker is deployed. Calls with 14 named arguments still resolve to the old one only if the new one has no defaults (avoids a PostgREST ambiguity). Drop the old one in a later cleanup migration. `database.types.ts` needs the new columns and functions.
3. Transfer window unit: store `transfer_window_minutes int check (null or >= 35)`; the field offers whole hours (the decision record says "[N] hours"). Minutes in the database keep the 35-minute floor and the preview test value expressible. The screen shows "not set" when empty and says what that does ("Requests stay closed").
4. Bank details get their **own card and its own Save** with a confirm dialog ("These details are sent to guests. Check the IBAN."): routes `GET/POST /api/ops/bank-details` (`opsGet`/`opsPost`; static path, no `[id]`), function `ops_get_bank_details`/`ops_save_bank_details`. Two Saves on one page are justified here: different table, different audit, no site rebuild. The existing dirty guard and the leave-page prompt must cover both forms.
5. Readiness block on Settings (read only): "Requests are closed because: transfer window not set / bank details incomplete / terms text not final". Terms is a code constant (`lib/booking/terms.ts:6-7`); the secret is not visible from `almar-ops`, so it is not listed.

### Note line translation

The pipeline is client-driven: the screen builds a plan with `planTranslation(...)`, calls `POST /api/ops/translate` once per target (`requestTranslations`, `components/ops/auto-translate.ts:150`), then posts all three texts to the save route. Field names are lowercase snake case (`lib/ops/translate.ts`, `FIELD_NAME`): use `bank_note`. The rule is the owner's decision of 2026-10-14 (`decisions/2026-10-14-auto-translate-and-panel-redesign.md` item 1): English only, AR/ES filled on Save, an "Edit translations" link for fixes. Send only the note to the model, never the IBAN, SWIFT or account name. If the AI fails, save the English note, leave AR/ES empty, say so in words ("Arabic and Spanish not updated; guests see English until you save again"), and let every reader fall back to English. The prompt keeps numbers and currency codes unchanged (`translate-prompt.ts`). Escape the translated text wherever it is shown.

### IBAN and BIC as pure functions

```ts
// lib/booking/bank.ts  (pure; mirrored in SQL)
const IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;       // 15..34 characters
export const normalizeIban = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!IBAN_SHAPE.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch; // A=10 .. Z=35
    for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}
const BIC_SHAPE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;  // 8 or 11
export const isValidBic = (raw: string) => BIC_SHAPE.test(raw.replace(/\s+/g, "").toUpperCase());
```

[VERIFIED: computed in this session] The function accepts the public documentation examples `GB82 WEST 1234 5698 7654 32`, `DE89 3704 0044 0532 0130 00`, `AE07 0331 2345 6789 0123 456` and rejects each with the last digit changed; the BIC shape accepts `DEUTDEFF`, `DEUTDEFF500`, `NBADAEAAXXX` and rejects `DEUTDEF`. The algorithm is ISO 13616 / ISO 9362 from training knowledge, not from an allowed doc source. [ASSUMED] Do not hard-code a per-country length table (the owner's bank country is not known yet; the decision record says so); use the checksum plus the 15-34 range. Test with documentation examples only, never real account data. Display the IBAN in groups of four with the stored value unchanged.

### pgTAP: anon and authenticated cannot read it

Follow `site_settings_access.test.sql` (set local role, `throws_ok(..., '42501')`):

- `select is(relrowsecurity, true)` for `owner_bank_details`; `policies_are('public', 'owner_bank_details', array[]::name[])`.
- `select is((select count(*) from information_schema.role_table_grants where table_name = 'owner_bank_details' and grantee in ('anon','authenticated','PUBLIC')), 0)`.
- As `anon` and as `authenticated`: `select * from public.owner_bank_details` and every column list -> `42501`; `insert`, `update`, `delete` -> `42501`.
- For each of `ops_get_bank_details()`, `ops_save_bank_details(jsonb, uuid)`, `booking_gate()`, `booking_transfer_instructions(uuid, text)`: `has_function_privilege('anon'|'authenticated', oid, 'execute')` is false, and calling it as those roles raises `42501`.
- `api_site_settings` still has exactly its nine columns (the existing assertion) and `site_settings` has no bank column (`hasnt_column`).
- `ops_save_bank_details` refuses a guest `p_actor`, a bad IBAN checksum, a 9-character BIC; `booking_transfer_instructions` returns null for `held`, `expired`, `cancelled`, `paid_in_full`.
- A node test greps the new route and lib files: no `console.log` of bank fields, `Cache-Control: no-store` on every bank-bearing answer.

## Q5. Rebuilt gate

### Today

`liveGate(stripeSecret, termsArePlaceholder)` (`lib/booking/server.ts:451-454`): `isTest = !secret.startsWith('sk_live_')`, `open = isTest || !termsArePlaceholder`. The hold route (`app/api/booking/hold/route.ts:31-35`) answers 503 unless the admin client, the limiter key, `bookingLinkConfigured()` and `gate.open`. With no Stripe key every hold on every host is `is_test = true` and open. The terms constants are `BOOKING_TERMS_VERSION = "placeholder"`, `BOOKING_TERMS_IS_PLACEHOLDER = true` (`lib/booking/terms.ts:6-7`). **Ordering rule:** do not set `BOOKING_LINK_SECRET` on production `almar` before the rebuilt gate is deployed, or real guests could create holds flagged TEST.

### Design

- `is_test` from the host, in `lib/booking/origin.ts` next to `bookingOrigin` (`:30-41`): `bookingIsTest(host, nodeEnv)` returns false only when `bookingOrigin(...)` is exactly `https://almarprivatejourney.com` or `https://www.almarprivatejourney.com`; preview, localhost and every other host are test. Read the host the same way `isAllowedPostOrigin` does. Never from the request body or a query.
- Pure gate in `lib/booking/gate.ts`:

```ts
export type GateReason = "terms_not_final" | "link_secret_missing" | "window_not_set" | "bank_incomplete";
export type Gate = { isTest: boolean; open: true; windowMinutes: number } | { isTest: boolean; open: false; reasons: GateReason[] };
export function requestGate(input: {
  isTest: boolean; termsArePlaceholder: boolean; linkSecretSet: boolean;
  db: { windowMinutes: number | null; bankComplete: boolean };
  testWindowMinutes: number;                       // a named constant >= 35, TEST ONLY
}): Gate
```

  Rules: live host needs all four (terms final, link secret, window set, bank complete). Test host needs link secret and bank complete; the terms placeholder is allowed on test (as TEST is allowed today); its window is `testWindowMinutes`. `testWindowMinutes` should be the floor itself (35) so no new number is invented (Open Question 3).
- One database read: `booking_gate()` (Q4), a single RPC returning `{ window_minutes, bank_complete }`. The hold route calls it before `createWebHold`; the request route calls it before `request_web_booking`; the quote route calls it in parallel with the quote and adds one reason.
- Where it closes: hold route (so a guest never fills four steps and holds nights for nothing), quote route (reason shown from the start), request route (defence), and SQL (`request_web_booking` re-checks window and bank, so a missing owner value can never produce a request even if a route forgets).
- Reason codes the guest sees: add `requests_closed` (one code, no detail: the guest has no use for "bank details missing") and `too_many_open` to `ReasonCode` (`lib/booking/types.ts:22-47`, "the signed list"); copy in three languages in `lib/copy/journey.ts` (shared file). `holdStatus` (`server.ts:438-445`) maps `requests_closed` to 503 so the page shows the closed state; `unavailable` stays 503. The owner sees the specific causes in the Settings readiness block (Q4). `GateReason` values never reach a browser.
- `HoldRequest` already requires `termsAccepted: true`; the terms checkbox stays on the step that places the hold (Q8).
- `liveGate` and its tests (`tests/booking-api.test.mjs`, mutants T9, T12) are replaced, not renamed. `STRIPE_SECRET_KEY` is no longer read anywhere.
- `PUBLIC_ORIGIN` (`origin.ts:5-6,39-40`) is one value on `almar-ops`, but `almar-ops` now serves test and real bookings. For any link inside an email choose the origin from the booking: `originForBooking(isTest)` -> preview or canonical. Stop relying on `PUBLIC_ORIGIN` for guest links.

### Tests

`tests/booking-gate.test.mjs`: table of (host, secret, terms, window, bank) -> gate; host mapping incl. `127.0.0.1` outside production, `www`, preview, an ops host; production never takes `isTest` from input. Route tests with a fake db: closed -> 503 `requests_closed` before any write. pgTAP: `request_web_booking` closed cases (Q2). Mutants to bite: gate ignoring the bank check; `isTest` true on `www`.

## Q6. Emails (B-14, B-18, B-29, PAY-17)

### What exists on `main`

| Piece | Where | Reuse |
|-------|-------|-------|
| Sender `ALMAR Private Journey <inquiries@almarprivatejourney.com>` | `lib/auth/magic-link-server.ts:24` (a private const); the address alone is `INQUIRY_ADDRESS` in `lib/contact-inquiry.ts:18` | put the sender in `lib/email/send.ts` and export it |
| Resend client | `new Resend(key).emails.send(...)`; key from `process.env.RESEND_API_KEY` (`app/api/contact/route.ts:98-102`); a missing key is 503, never a fake success | same; add the second argument `{ idempotencyKey }` |
| HTML shell | `lib/email/magic-link.ts`: table layout, inline styles, `dir="rtl"` for Arabic, square Teal button with White text, brand from `emailBrand()` (`lib/site-settings-read.ts:57-68`), `checkedBrand`, `escapeHtml` (both not exported) | build `lib/email/shell.ts` with key/value rows and a button; export `escapeHtml` from a new tiny module and let `magic-link.ts` import it (smallest edit), or duplicate its 6 lines |
| Brand read | `readSiteSettings(siteSettingsEnv())` with the anon key, cached 30 s | any Worker with the two public Supabase names |
| Plain-text fallback, subject cleaning | `composeInquiryEmail` uses `cleanLine` for the subject (`contact-inquiry.ts:169-184`) | copy the idea |
| Owner migration `20261019120000_owner_emails.sql` | only changes who may sign in to the dashboard (`maria@...`, `koussayzayeni@...`; same list as `OWNER_EMAILS`, `lib/auth/rules.ts:10`) | not the notice recipient. Notices go to `inquiries@almarprivatejourney.com` (B-18) |

### Templates (new copy for the owner's signature; pictures first; EN, AR RTL, ES)

| Template | To | Language | Sent by | Idempotency key | Content |
|----------|----|----------|---------|-----------------|---------|
| request received + transfer instructions | guest | booking `locale` | request route on `almar`, only when `first_time` | `request/<booking_id>` | reference, stay, dates, guests, amount due now in AED (stored snapshot, never recomputed), the bank block (account name, bank, IBAN, SWIFT, bank address, note line in the guest's language, fallback English), "put `ALMAR-XXXXXX` as the transfer reference", the deadline (UAE date and time), "all fees paid by sender" (B-29), "reply to this email with your bank receipt" (B-28), signed link to the booking page |
| request owner notice | `inquiries@` | EN | request route | `request-owner/<booking_id>` | ref, guest, stay, dates, amount, deadline, dashboard link `https://dashboard.almarprivatejourney.com/bookings/detail?ref=<ref>` (`OPS_HOSTNAME` in `lib/host.ts`; URL shape from 05-01), `[TEST]` in the subject when `is_test` |
| receipt after the owner records | guest | booking `locale` | record route on `almar-ops` | `receipt/<payment_id>` | amount received and date, total paid, what is still due and by when, or "paid in full"; part-received variant; link to the page |
| payment recorded owner notice | `inquiries@` | EN | record route | `payment-owner/<payment_id>` | who recorded, amount, new status, flags (B-18 reworded; a second pair of eyes) |
| request lapsed | guest | booking `locale` | cron on `almar-ops` | `lapse/<booking_id>` | "no payment was recorded by [deadline], the dates are free again", link to the stay page to start again (no booking link, so no link secret is needed) |
| resend | guest | booking `locale` | dashboard route | `resend/<booking_id>/<event_id>` | the receipt or the instructions again (PAY-17) |

- Mail is sent after the database commit. A failure never fails the action: write `email_failed` (error name only), the dashboard shows it and offers Resend. This is the 04-RESEARCH Q8 rule and still holds.
- Subject lines: built from the validated reference (`^ALMAR-[A-Z2-9]{6}$`) and fixed words; no guest-typed text. Guest names appear only in the body, through `escapeHtml`, and in the owner mail's plain-text part through the `cleanLine` idea. `to` comes from the booking's stored, validated address.
- `Idempotency-Key`: up to 256 characters, kept 24 hours, same key with another payload is 409. [CITED: resend.com/docs/dashboard/emails/idempotency-keys, resend.com/docs/api-reference/emails/send-email] "Resend" from the dashboard must use a new key, as 04-RESEARCH said.

### RESEND_API_KEY presence

`almar-ops`: set (STATE.md:60). `almar`: not yet; the request route cannot send mail there until the owner sets the key and the Resend domain is verified (both owner gates, `STATE.md:46`). `almar-preview`: none by design; preview UAT of the request mail needs the owner to set `NEXT_PUBLIC_SUPABASE_URL`, the anon key, the service key, `BOOKING_LINK_SECRET` and `RESEND_API_KEY` on preview first (04-02 summary, CPU probe precondition). The same `BOOKING_LINK_SECRET` value must be on all three Workers so a link made on one verifies on another (`lib/booking/link.ts:1-3`).

### The seam between plans

04-08 builds the routes first; 04-05 builds the mail later; 04-09 (parallel with 04-03) needs a receipt on Record payment. Give 04-08 `lib/booking/notify.ts`: an interface with `requestReceived`, `ownerRequest`, `paymentReceipt`, `ownerPayment`, `requestLapsed`, a default implementation that returns `{ ok: false, error: 'not_ready' }`, and routes that call it through one `getNotifier()`. 04-05 supplies the real one and flips the default. Tests in 04-08 and 04-09 use a fake notifier. The alternative is moving the mail half of 04-05 before 04-09: the controller's order, not research's.

## Q7. Dashboard Bookings list and detail, notes, Record payment, Void (04-09, OPS-04)

### What exists

- `app/dashboard/(ops)/bookings/bookings-screen.tsx` is a front-end shell: an empty `<tbody />`, hard-coded English headings, and a "New booking" Sidebar with four fake fields (`:28-31,53-58`). It breaks the "no fake controls" rule and must be replaced, not wired.
- `/bookings` is not in `OPS_LIVE_SECTIONS` (`lib/ops-routes.ts:36-55`), so the owner sees the "not ready" state. 04-09 adds `"/bookings"` in the commit that wires it (the section also covers `/bookings/detail`).
- No dynamic segment is allowed under `/dashboard` or `/api/ops` (`ops-routes.ts:118-125`, `assertNoSpecialSegments`), so the detail is `/bookings/detail?ref=ALMAR-XXXXXX` (the URL 05-01 chose) and the APIs take the reference in the query or body.
- Owner guard: every `/api/ops/*` route is `export const GET = opsGet(...)` / `POST = opsPost(parse, handler)` (`lib/ops/route.ts:24-46`); order: `requireOwner` (shell header, session, role and owner email, admin client: `lib/auth/require-owner.ts`) -> exact ops Origin (POST) -> JSON type and 64 KiB -> parse -> handler (`route-core.ts:264-310`, `checkOrigin :77-95`). The handler gets `owner.profile.id` for `p_actor` and `owner.admin` for RPCs. `tests/ops-route.test.mjs` refuses any other route shape.
- `mapDbError` maps only some `almar:*` codes (`route-core.ts:142-157`); anything else is 503. Business refusals of the new functions (`not_requested`, `amount_too_small`, `cancel_first`, `window_missing`, `changed`, `not_allowed`...) need a mapping to 409 with the code. Do it in the new handler module (a small `mapBookingRefusal`) instead of editing the shared file.
- Kit: `ListTable` (dense table from 768, cards below; `components/ops/list-table.tsx`), `Chip` (non-interactive, dense) for status (`StatusChip` is Published/Draft only), `Select`, `Field`, `Sidebar`, `ConfirmDialog`, `Toast`, `opsFetch`/`opsSend` (`components/ops/ops-client.ts`, the only `fetch` under `components/ops`), `useDashboardLocale`. `EditPage` is the entity editor with Save/Publish/translations: not for bookings.
- `ConfirmDialog` (`components/ui/confirm-dialog.tsx`): Escape and outside click are blocked, the confirm button is the `danger` variant, `cancelLabel` defaults to "Stay signed in" (always pass one), `description` is a `ReactNode` but there is no way to disable the confirm button. Void and "Accept as paid" need a required reason. Either add an additive `confirmDisabled?: boolean` prop (shared UI file: controller grant) or build a `ReasonDialog` from the same Radix `Dialog` in `components/ops/`. Record payment is a small form (amount, date, reference, "Accept as paid" + reason) with one final confirm: a dialog or the existing `Sidebar`; pictures decide. The confirm text must say the consequence from the pure `settle()` preview ("Deposit paid; the guest gets a receipt"; "AED x short will be written off").
- Copy-to-clipboard exists only for URLs (`components/ui/copy-link.tsx`); copying an IBAN needs a text variant (guest page, Q8).

### What 05-01 designed that 04-09 can take (`.planning/phases/05-ops-os/05-01-PLAN.md`)

Take: the list rules (search by reference prefix, name or email; status filter; upcoming arrivals first; "balance overdue" flag; default list hides expired web rows), the detail tabs Overview / Payments / History, `ownerActions(status)` as a pure map, `parseListQuery`, `formatFils`, `uaeDateTime`, handler modules with injected deps (`lib/ops/booking-rules.ts`, `lib/ops/bookings-api.ts`), routes `/api/ops/bookings` (GET), `/api/ops/booking` (GET `?ref=`), `/api/ops/booking/status` (POST), SQL `ops_list_bookings` / `ops_get_booking`, canvas boards `DashBookings` (7b), `DashBookingDetailA/B`, phone cards at 390, "call `ops_lapse_holds()` before every read", pictures first.

Change or drop:

| 05-01 / 05-CONTEXT item | Now |
|-------------------------|-----|
| O-04 "no offline payment recording; Record payment not shown" | Superseded by PAY-19: Record payment and Void are the point of 04-09 |
| "Internal notes OUT to v1.1" | Notes are in (B-35) |
| O-01 refunds in Stripe; Stripe payments table with brand and last 4; `expireCheckoutSessions` on Cancel | Gone. Payments tab shows method, `received_on`, amount, reference, recorder; voided rows struck through with reason |
| Resend confirmation | Becomes Resend receipt / Resend instructions |
| Settings screen rewritten to "Payments and taxes only" | Obsolete: 02-06 built the fuller Settings page; extend it (Q4) |
| `20261005120000_ops.sql` | Obsolete name; use the reserved `20261019160000` / `20261019170000` |
| `ops_get_money_settings` / `ops_save_money_settings` | Replaced by the 16-parameter `save_site_settings` |
| Detail URL `https://dashboard.almarprivatejourney.com/bookings/detail?ref=<ref>` | Keep (used in the owner mail) |

Actions in 04-09 (all through `assert_owner`-checked SQL): Record payment, Void, Add note, Resolve attention, Cancel (B-26 needs it for `awaiting_payment`), Confirm (OPS-10 is demonstrable only with it), Mark completed, Resend receipt/instructions. Tell 05-01's header edit to drop all of these and to mark O-01, O-02 (pay link), O-04 and the notes line of `05-CONTEXT.md` as superseded.

OPS-04 scope: REQUIREMENTS says search and filter by status, destination and dates; the signed list (`05-CONTEXT.md` "IN v1" item 1) is search by reference or guest, status filter, upcoming first, overdue flag. Recommended: build the signed subset plus two cheap SQL filters (destination, arrival from/to) only if the pictures include them; otherwise say "subset" in the plan and the traceability row (Open Question 8).

Default list ordering for a transfer business: needs-attention first, then `awaiting_payment` by deadline (soonest first), then upcoming arrivals. Do not rely on the owner mail alone: a lost mail (Pitfall 9) must not hide a request.

### SQL for the screens (migration B)

`ops_list_bookings(p_q, p_status, p_after, p_limit)` and `ops_get_booking(p_ref)` return jsonb including `flags` (Q3), payments (all rows, voided ones marked), events, notes, add-on lines, travellers, `is_test`, deadline, amounts due. Both start with `assert_owner` is not needed for reads through a service-only function, but the route must call `ops_lapse_holds()` first so statuses are current. Names avoid the text `re_` in TypeScript call sites only; SQL names may contain it, the TS strings may not.

### Tests

Node: `lib/ops/booking-rules.ts` (actions per status, query parsing, `settle()` preview, AED text -> fils without floats, Arabic-Indic digits), `lib/ops/bookings-api.ts` with fake deps (owner guard source check like `tests/ops-route.test.mjs`), refusal mapping. Playwright dev with `page.route` mocks (`tests/ops/bookings.spec.ts`, `booking-detail.spec.ts`): list states, record dialog preview text, void requires reason, confirm blocks Escape, 390/834/1440 in EN and AR. Pictures first (`tests/journey/scenes/*`, `ALMAR_PICTURES=1`).

## Q8. Guest side (04-03, 04-05, 04-06)

### What the old plans assumed from Stripe, and the change

| Old assumption (file) | Now |
|-----------------------|-----|
| `PayStep` ends in a `paymentArea` slot that 04-06 fills with `PaymentPanel` (04-03 header and Task 1; 04-06) | Keep `PayStep`'s structure and rename it Request: deposit/full cards, airport cards, terms checkbox, "Continue" (places the hold), `HoldTimer`, then a **request area**: a short "what happens next" and a "Send request" button. Nothing to pay on the page. |
| `HoldResponse.checkout?` (`types.ts:145`) | Remove; add `transferWindowMinutes: number` for the "what happens next" line (the owner's number, formatted by the page; never a typed-in "24 hours") |
| `/api/booking/pay`, `/api/booking/status`, `session_id` return, "confirming" state, `PaymentPanel`, `lib/stripe/*`, webhook (04-04, 04-05, 04-06) | Gone. New: `POST /api/booking/request {ref, t}` and `POST /api/booking/view {ref, t?, locale?}`; both on `almar`, served automatically (static `app/api` routes; no dynamic segments). Update the pinned lists in `tests/server-runtime.test.mjs:89-95` and `tests/build/server-runtime.spec.ts`. |
| 04-06 resumes payment after refresh through `/api/booking/pay` | Resume the Request step: read the stored `{ref, t, holdExpiresAt}`, ask `/api/booking/view`; `held` and alive -> same step; `awaiting_payment` -> go to the booking page; `expired` -> "start again". |
| Booking page "Pay balance" opens the checkout (04-05) | Shows the transfer instructions for the amount still due (PAY-10) |
| Receipt emailed when the webhook fulfils (04-05) | After the owner records (Q6) |
| `releaseWebHold` returns Stripe session ids (`server.ts:466-481`) | Always empty now; leave the code, remove the 04-04 expiry call. Release still works only for `held`; after Request a guest cannot withdraw (Open Question 5). |

What stays: `StepRail`, reason codes and `BookingReasons`, `HoldTimer` for the 30-minute hold, the quote/hold/release routes and their Origin/size/limiter rules, the signed link (`lib/booking/link.ts`, `access.ts`), booking page URL `/bookings/trip?ref=&t=` as a static shell in three languages with `Referrer-Policy: no-referrer` and noindex (04-RESEARCH Q7 and Q9 still apply: add `"/bookings/trip"` to `PUBLIC_PAGES`, `isHeldPath` stays false), the `/bookings` list for a signed-in guest (04-06; the current screen is a placeholder: `app/bookings/bookings-screen.tsx` shows `noBookingsYet` only).

### Request route (`POST /api/booking/request`)

Model it on the release route (`app/api/booking/release/route.ts`): Origin must equal the host's booking origin, JSON only, 4 KB, `parseReleaseRequest` reused for `{ref, t}`, `authorizeBookingAccess` (token is the only door when present), then gate (Q5), then `request_web_booking(id, expectTest = bookingIsTest(host))`, then mail only when `first_time`. A wrong token, an unknown or malformed reference all give the same 404 body. `cache-control: no-store`, nothing logged. Mail failure does not change the answer (200 with the booking page link).

### View route (`POST /api/booking/view`) and the booking page

Move `booking_view` (SQL) and the route into **04-08**, not 04-05, so 04-06's resume needs nothing from its sibling and 04-05 and 04-06 can run side by side. `booking_view(p_booking, p_locale)` returns the guest-safe view: reference, status, stay title and image in the locale, dates, guests, travellers' names, add-on lines, airport, pickup address, amounts (nights, add-ons, subtotal, VAT, grand, deposit, balance, paid, written off, due now), plan, deadline (only while `awaiting_payment`), balance due date, `flags` (part received, overpaid, written off), succeeded payments (date, method, amount, reference), `transfer` (= `booking_transfer_instructions`, null unless allowed), `access` (address, wifi, door code, notes from `stay_access`, **only** for `confirmed`/`completed`: BOOK-08, OPS-10). It never includes notes, events, the write-off reason, `needs_attention` or `is_test`.

Bank details appear only when (a) the signed link verifies or the signed-in email equals the booking's, and (b) the status allows (`awaiting_payment`, or a balance is due on `deposit_paid`/`confirmed`/`completed`). Never for `held`, `expired`, `cancelled`, `paid_in_full`. States to draw: awaiting (full), awaiting (part received), deposit paid with balance, paid in full, confirmed with access, expired, cancelled. The page shows amounts still due, the reference to put on the transfer, the deadline as a fixed date and time (no ticking timer), "all fees paid by sender", "reply to the email with your bank receipt", and a copy button for the IBAN (a text variant of `CopyLinkButton`). It prints cleanly. Wording for expired-with-money and cancelled-with-money is the owner's (pictures and signature).

### Responsibility split, in order

04-08 (database, gate, request + view routes, notifier seam, cron) -> 04-03 (Request step UI) and 04-09 (dashboard) side by side -> 04-05 (templates, booking page UI, real notifier) and 04-06 (submit, resume, `/bookings` list) -> 04-07 (UAT). If the plan checker finds 04-08 too large, split at the two reserved migrations: A (owner config: bank table, window, gate, Settings overload) and B (booking state: columns, request, record, void, notes, claim, trigger, views).

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Exactly-once email | In-memory flags, "sent" in a cookie | Lease columns + sent timestamp + Resend `idempotencyKey` | A Worker can die between send and mark; the key covers it for 24 hours |
| Queue claiming | `select` then `update` in two calls | one statement with `for update skip locked` | Concurrent ticks never pick the same row |
| Overlap and double booking | App-side checks | `place_hold` under the stay advisory lock (exists) | Primary key is the last guard |
| Status after a payment | Rules spread over routes and screens | `ops_record_payment` / `ops_void_payment` + one pure `settle()` mirror with a parity test | One truth, no drift |
| Money arithmetic | Floats, `parseFloat("12.50") * 100` | integer fils, `lib/money`; add `aedTextToFils` (string split, no float) beside `percentTextToBp` | Rounding bugs |
| Signed link | New token scheme | `lib/booking/link.ts` / `access.ts` | Landed, tested, constant-time |
| Owner check | Per-route role logic | `opsGet`/`opsPost` + `assert_owner` in SQL | Same path as every owner route |
| Cron entry | An HTTP route for the cron | `scheduled` handler | No URL to attack |
| Translation | Own translate call | `POST /api/ops/translate` + `auto-translate.ts` plan helpers | Owner's 2026-10-14 rule |

## Common Pitfalls

1. **Service-key name in `worker/` or a new lib file.** `tests/secrets.test.mjs:13-20` fails the whole suite. Build the client with `createSupabaseAdmin()`.
2. **The text `re_` anywhere in `app/`, `components/`, `lib/`** (`tests/phase-02-gates.test.mjs:7,50-52`, any file, comments included). Common English words trip it: `failure_`, `feature_`, `before_`, `more_`, `are_`, `secure_`, `store_`, `ignore_`, `core_`, `score_`, `measure_`, `configure_`. Reason codes such as `paid_before_expiry` are banned in TypeScript and copy. SQL files are outside the scan. Scan new TS before the hand-over: `grep -rn "re_" app components lib`.
3. **Pinned tests that must change together with their files:** `tests/ops-runtime.test.mjs:236-249,411-419` (Worker imports, toml tables); `tests/phase-03-settings.test.mjs:27-29` and `tests/ops-settings.spec.ts` (Settings groups and posted body); `tests/server-runtime.test.mjs:89-95` and `tests/build/server-runtime.spec.ts` (server path lists); `tests/booking-api.test.mjs` (`liveGate` mutants); `lib/supabase/database.types.ts` (new columns and functions).
4. **`public_booked_nights()` bakes web requests** (Q2). Fix in migration B.
5. **Dropping the 14-parameter `save_site_settings`** breaks live Settings until `almar-ops` is redeployed. Add an overload; drop later.
6. **Test bookings share nights with real ones.** One database, `is_test` only labels. A recorded preview booking holds its nights for good and the live quote says sold out. UAT (04-07) ends with Cancel on every test booking; list it as a numbered cleanup step. [VERIFIED: `booking_nights` has no `is_test`; `booking_context.taken` ignores it, `:589-596`]
7. **The 30-minute hold lapses between "Continue" and "Send request".** `request_web_booking` answers `hold_ended`; the page must show it and offer the restart, not a generic error.
8. **Cron CPU on Free (10 ms).** Keep the batch at 5, render lazily, measure with `wrangler tail --format json`; `exceededCpu` is the owner's Workers Paid question.
9. **A lost inline email.** If the Worker dies after the commit and before the send, the owner mail is lost and nothing retries it. The dashboard default ordering (Q7) is the safety net; an outbox for every template is a possible later upgrade, not in scope.
10. **`kind` for transfers.** Do not label a second part payment `balance`. Use `'transfer'` (or decide otherwise once, in the plan).
11. **Order of live steps.** Apply migrations A and B, then deploy `almar-ops` (Settings, Bookings, cron), then set secrets, then deploy `almar`. Never set `BOOKING_LINK_SECRET` on production before the rebuilt gate is live (Q5).
12. **`mapDbError` turns unknown `almar:*` codes into 503.** Map booking refusals yourself (Q7).
13. **Hand-made bookings (`source = 'ops'`) get no lapse mail** and are not baked out of the calendar differently from before; only web requests change.
14. **Preview window.** `request_web_booking` compares minutes, so the 35-minute floor works as a test window; a timestamp comparison `> now() + 35 min` would refuse it.
15. **Data in logs.** Never log bank fields, bodies, guest data. Log the error name only (`route-core.ts:202-208`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node --test` (pure modules, `.ts` loaded directly), pgTAP (local Supabase stack), Playwright 1.63.0 (dev config with mocks; build config on `wrangler dev`) |
| Config | `playwright.config.ts` (next dev, `PW_PORT`), `playwright.build.config.ts` (`PW_WRANGLER_CONFIG`, `PW_READY_PATH`), `tests/helpers/local-supabase.mjs` |
| Quick run | `npx tsc --noEmit && node --test tests/<file>.test.mjs` (no go needed) |
| DB run | `node tests/helpers/local-supabase.mjs test supabase/tests/<file>.test.sql` (local stack: controller's go) |
| Full suite | the hand-over set in `00-common-rules.md` (`npm ci`, `tsc`, `node --test tests/*.test.mjs`, `tokens:check`, `npm run build`, `npx playwright test --workers=2`) run by the controller |

### Phase Requirements -> Test Map

Landed plans (04-01, 04-02) already carry most server-side proof (634 pgTAP checks, `tests/booking-*.test.mjs`). The rows below name what the remaining plans add or must keep green.

| Req | Behaviour | Test type | Automated command | File |
|-----|-----------|-----------|-------------------|------|
| BOOK-01 | Hero search -> trip link; no charge anywhere | Playwright mocks + source test | `PW_PORT=<p> npx playwright test tests/booking-trip.spec.ts --workers=2` ; `node --test tests/booking-trip-state.test.mjs` | Wave 0 (04-03) |
| BOOK-02 | Steps Stay/Add-ons/Travellers/Request, back until Request | Playwright mocks | same spec | Wave 0 |
| BOOK-03 | 30-minute hold timer; after Request nights held to deadline | pgTAP + node | `node tests/helpers/local-supabase.mjs test supabase/tests/bank-transfer-core.test.sql` ; `node --test tests/booking-request.test.mjs` | Wave 0 (04-08) |
| BOOK-04 | Second city -> WhatsApp link | node + Playwright | `node --test tests/booking-trip-state.test.mjs` | Wave 0 |
| BOOK-08, OPS-10 | Access only for confirmed/completed | pgTAP + node | pgTAP `booking_view` rows; `node --test tests/booking-view.test.mjs` | Wave 0 (04-08) |
| STAY-01, STAY-02 | Reasons shown; party within max | node (landed) + Playwright | `node --test tests/booking-api.test.mjs` ; trip spec reasons | exists / Wave 0 |
| JOUR-01..04 | Airport, home pickup default, inclusions | Playwright mocks | trip spec | Wave 0 |
| ADDN-01 | Add-ons per night/stay | node (landed) | `node --test tests/booking-price.test.mjs tests/booking-api.test.mjs` | exists |
| IDEN-01, IDEN-02 | Required fields, terms box, traveller lines | node + Playwright | `node --test tests/booking-api.test.mjs` ; trip spec | exists / Wave 0 |
| PAY-01, PAY-02, PAY-03 | Breakdown order, VAT/deposit from Settings, choose plan | node (landed) + Playwright | `node --test tests/booking-price.test.mjs` ; trip spec | exists |
| PAY-05 | Coupon | none: deferred | see conflict note | - |
| PAY-07 | No gift card, no BNPL | source test | `node --test tests/trip-no-bnpl.test.mjs` (greps trip and booking-page copy for those options) | Wave 0 |
| PAY-10 | Balance by transfer, same instructions | pgTAP + Playwright mocks | `booking_transfer_instructions` rows; `tests/booking-page.spec.ts` | Wave 0 (04-05) |
| PAY-14 | `ALMAR-XXXXXX` | landed | `node --test tests/booking-api.test.mjs` | exists |
| PAY-17 | Receipt after record; resend; language | node (templates, notifier) | `node --test tests/booking-email.test.mjs` | Wave 0 (04-05) |
| PAY-18 | Bank fields owner-only; window | pgTAP + node | `supabase/tests/bank-transfer-config.test.sql` ; `node --test tests/bank-details.test.mjs tests/booking-gate.test.mjs` | Wave 0 (04-08) |
| PAY-19 | Record/void, flags, idempotency, owner-only | pgTAP + db node + parity | `bank-transfer-core.test.sql` ; `ALMAR_REQUIRE_STACK=1 node --test tests/ops-record-payment.db.test.mjs tests/payment-rules-parity.db.test.mjs` ; `node --test tests/payment-rules.test.mjs tests/ops-bookings-api.test.mjs` | Wave 0 (04-08/04-09) |
| PAY-20 | Lapse on schedule, mail once | node + pgTAP + db + build spec | `node --test tests/booking-lapse-cron.test.mjs tests/ops-runtime.test.mjs` ; pgTAP ; `tests/booking-lapse.db.test.mjs` ; `tests/build/lapse-cron.spec.ts` (`PW_TEST_SCHEDULED=1`) | Wave 0 (04-08) |
| AUTH-01 | Guest without account; email access | landed node + Playwright | `node --test tests/booking-link.test.mjs tests/booking-api.test.mjs` ; `tests/guest-bookings.spec.ts` | exists / Wave 0 (04-06) |
| OPS-04 | List search/filter | node + Playwright mocks | `node --test tests/ops-booking-rules.test.mjs` ; `tests/ops/bookings.spec.ts` | Wave 0 (04-09) |
| OPS-13 | Booking page is the source of truth | Playwright mocks + build spec | `tests/booking-page.spec.ts` ; `tests/build/booking-pages.spec.ts` (static, noindex, no-referrer) | Wave 0 (04-05) |
| Server paths | New `/api/booking/request`, `/view` served; no dynamic segment | node + build spec | `node --test tests/server-runtime.test.mjs` ; `PW_PORT=<p> npx playwright test -c playwright.build.config.ts tests/build/server-runtime.spec.ts --workers=1` | exists, update |

Stays manual (owner UAT, 04-07): the real Resend delivery and rendering of the five mails in EN/AR/ES; the owner reading a real bank statement and recording against it; the signature on every picture; CPU numbers from `wrangler tail` for request, view, record and one scheduled tick; the lapse of a real preview request with the test window; the cleanup Cancel of test bookings.

**PAY-05 conflict.** `ROADMAP.md:243` lists PAY-05 in Phase 4 and `REQUIREMENTS.md:233` (traceability) says "Phase 4", but `04-CONTEXT.md:15` and `:127` and `04-REWRITE-DRAFT.md:60` say deferred to v1.1, and B-05 says "No coupon line". The planner must not plan it. Proposed fix for the controller: move the PAY-05 traceability row to "v1.1" and drop it from the Phase 4 requirement list (or keep it listed with "deferred" in the plan). PAY-01's text still names a coupon line; leave it.

### Sampling Rate

- Per task commit: `npx tsc --noEmit` and the task's `node --test` file.
- Per wave merge: all `node --test tests/*.test.mjs`; pgTAP file(s) of the wave; the specs of the wave (controller's go).
- Phase gate: full suite green on the PR tip, then the UAT in 04-07, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `supabase/tests/bank-transfer-config.test.sql`, `supabase/tests/bank-transfer-core.test.sql` (new files; do not edit `bookings-and-ops.test.sql`'s plan count)
- [ ] `tests/bank-details.test.mjs`, `tests/booking-gate.test.mjs`, `tests/booking-request.test.mjs`, `tests/booking-lapse-cron.test.mjs`, `tests/payment-rules.test.mjs`, `tests/booking-view.test.mjs`
- [ ] DB tests: `tests/booking-lapse.db.test.mjs`, `tests/ops-record-payment.db.test.mjs`, `tests/payment-rules-parity.db.test.mjs` (take `acquireStackLock()`; wait for PostgREST after a reset)
- [ ] `tests/build/lapse-cron.spec.ts` and the `PW_TEST_SCHEDULED` switch in `playwright.build.config.ts`
- [ ] Update the pinned tests in Pitfall 3
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Owner: `requireOwner()` + `assert_owner(p_actor)` in SQL; guest: signed link or session email, never the reference alone |
| V3 Session Management | yes | No new session; the link is a capability with `link_version` revocation |
| V4 Access Control | yes | Tables: RLS on, all privileges revoked, no policy; functions: definer, `search_path ''`, execute for `service_role` only; bank details only through status-checked functions |
| V5 Input Validation | yes | Hand-written parsers (repo has no zod): unknown keys refused, bounds, `ref` regex, uuid, `YYYY-MM-DD`, AED text -> fils without floats, IBAN checksum, BIC shape |
| V6 Cryptography | yes | WebCrypto HMAC for the link (exists); nothing new; do not invent crypto for bank data (it is owner-only data, not a secret to hash) |
| V7 Error handling / logging | yes | Error names only; no body, guest data or bank field in any log |
| V8 Data protection | yes | `Cache-Control: no-store` on every bank-bearing answer; `Referrer-Policy: no-referrer` on the booking page; noindex |
| V13 API | yes | Exact Origin, JSON only, size caps, deny-by-default router |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Request abuse: many fake holds turned into long requests block dates for hours or days | DoS | Existing hold limiter (5 per email and 20 per IP per hour); one request per booking (idempotent); cap on open requests per email (`too_many_open`, number is the owner's: Open Question 2); owner Cancel; deadline. Residual: an attacker with many emails and IPs. [ASSUMED] |
| Booking enumeration by reference | Info disclosure | Ref alone grants nothing; wrong token, unknown and malformed ref give the same 404; 31^6 space plus HMAC |
| Bank details read by anon/authenticated or another guest | Info disclosure | Owner-only table, no grants, definer functions for `service_role`, pgTAP proofs, status rule inside the function, never in quote/hold/public view |
| Bank details swapped by an attacker (account fraud) | Tampering | Owner route only, exact Origin, confirm dialog, `updated_by`, audit row, notice mail with no values |
| Record/void by a non-owner | Elevation | `/api/ops/*` exists only on `almar-ops`; `requireOwner` (shell, session, role, owner email); Origin; SQL `assert_owner` |
| Replay or double click on Record payment | Tampering | `request_id` unique per dialog; same id returns the stored result; button disabled while busy |
| False payment recorded by an insider/compromised owner session | Repudiation | Void with reason (never delete); events with actor and time; owner mail on each recorded payment (B-18) goes to the shared inbox |
| Cron endpoint exposure | Elevation | No HTTP route; `--test-scheduled` is a dev flag only; router allow-list refuses `cdn-cgi` |
| Mail header or HTML injection | Tampering | Subject from validated ref and fixed words; every dynamic value through `escapeHtml`; AI-translated note escaped; `to` from the validated stored address |
| Email bombing a third party | DoS | Hold limiter per email/IP; one request mail per booking (`first_time` + idempotency key) |
| CSRF on request/record | Tampering | Exact Origin match, JSON content type, owner cookie SameSite |
| Link token leaked through Referer | Info disclosure | `Referrer-Policy: no-referrer` on `/bookings/trip`; token in the query only |
| Test and real mixed (host spoof) | Spoofing | `is_test` from the host, not input; `request_web_booking` refuses a mismatch |
| Guest-supplied text in the dashboard (names, requests) | XSS | React escaping; no `dangerouslySetInnerHTML` |
| Secret exposure in tests or bundles | Info disclosure | `tests/secrets.test.mjs`, the `re_`/`eyJ` gate |

## Code Examples

Resend with an idempotency key (the repo's call shape plus the documented option). [CITED: resend.com/docs/dashboard/emails/idempotency-keys]

```ts
const { data, error } = await new Resend(key).emails.send(
  { from: FROM, to: job.email, subject, html, text },
  { idempotencyKey: `lapse/${job.booking_id}` },
);
if (error || !data?.id) return { ok: false, error: typeof error?.name === "string" ? error.name : "no_id" };
```

pgTAP denial pattern (from `site_settings_access.test.sql:26-28`).

```sql
set local role anon;
select throws_ok($$select * from public.owner_bank_details$$, '42501', null, 'anon cannot read bank details');
select throws_ok($$select public.ops_get_bank_details()$$, '42501', null, 'anon cannot call the getter');
reset role;
```

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| `/__scheduled` test route | `wrangler dev --test-scheduled` exposes `/cdn-cgi/local/scheduled` (plus Local Explorer, Wrangler >= 4.139.0) | current docs, checked 2026-10-19 | repo pins 4.146.0; use the new route |
| `process.env` needed a flag | populated by default with `nodejs_compat` and compatibility date >= 2025-04-01; `nodejs_compat` itself default from 2026-08-04 | current docs | repo date is 2026-09-23 |
| Stripe Checkout Session margins (1-minute, 35-minute floor) | Only the 35-minute floor survives (owner-signed) | B-27 | Q2 table |
| Lapse "lazy only" (04-02) | Lazy sweep plus a 5-minute cron for status and mail | PAY-20 | availability unchanged |

**Deprecated here:** `liveGate`, `/api/booking/pay`, `/api/booking/status`, `PaymentPanel`, `PUBLIC_ORIGIN` for guest links, `record_payment`'s re-claim for transfers.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process.env` holds secrets inside `scheduled()` on this Worker | Q1 | Cron cannot reach Supabase/Resend; fallback copy of `env` into `process.env`; settled by the local `--test-scheduled` spec |
| A2 | A cron trigger works on a Worker that has static assets and `run_worker_first = true` | Q1 | Docs are silent; first deploy shows no run; fix is a config change |
| A3 | Cron every 5 minutes is soon enough | Q1 | Owner wants tighter: change the string (finest is every minute) |
| A4 | One scheduled tick fits the Free plan's 10 ms CPU with a batch of 5 | Q1 | `exceededCpu`; smaller batch or Workers Paid (owner's call) |
| A5 | No new anti-abuse number is needed beyond the existing hold limiter, plus a cap on open requests per email | Q2, Security | Abuse blocks dates; the number is the owner's |
| A6 | Voiding a transfer sends no mail to the guest | Q3 | Guest keeps a wrong receipt; owner would want a correction mail |
| A7 | `kind = 'transfer'` for bank rows | Q3 | Planner may prefer plan-derived kinds; no other effect |
| A8 | ISO 13616 mod-97 and ISO 9362 BIC shape, from training knowledge, checked by computation on documentation examples | Q4 | A bank with an unusual BIC length is refused; the owner sees a clear field error |
| A9 | The live database has few or no bookings; the migration is written to be safe either way | Q3 | None if the pattern is followed |
| A10 | Excluding web requests from `public_booked_nights()` is what the owner wants for the baked calendar | Q2 | Dates under a request look free on the static page until the quote says otherwise |
| A11 | The preview test window may be the 35-minute floor | Q2, Q5 | Owner may want another test value |
| A12 | A text copy button variant is acceptable on the booking page | Q8 | Design change only |

## Open Questions (RESOLVED)

These are the only items no file answers. None asks for a price, rate, fee, deadline or legal wording.
Each is resolved in a plan as recommended below and marked **[signature]** there: the owner confirms or changes it at
the plan gate (2026-10-20, plan-checker iteration 1); the controller writes his answer and the time into that row.

1. **A request lapses after part of the money was recorded (B-32).** **RESOLVED → 04-08 P-09.** Recommended: flag `needs_attention` (`expired_with_payment`), send no automatic "lapsed" mail (it would say nothing was paid), the owner contacts the guest and refunds or re-books. Needs the owner's yes. **Owner changed it 2026-10-20** (`.planning/decisions/2026-10-20-phase-4-rule-signatures.md`): a request with a recorded payment does not lapse; its nights stay held and it is flagged `deadline_passed_part_paid` for him to act on (04-08 P-09); `expired_with_payment` is gone.
2. **How many requests may one email keep open at once?** **RESOLVED → 04-08 P-05 (3).** An anti-abuse limit, not a business value. Recommended: a small number (3), or the owner says none. Needs the owner's number.
3. **Preview test window and the audit mail.** **RESOLVED → 04-08 P-06 (35-minute TEST window); 04-08 P-15 and 04-09 Q-16 (audit row, no notice mail).** (a) Recommended: the preview window is the 35-minute floor itself, so no new number exists. (b) Recommended: a plain mail to `inquiries@` when bank details change (no values). Both need a yes.
4. **Is the note line required for "bank details complete"?** **RESOLVED → 04-08 P-08 (note line required); bank reference required: 04-08 ops_record_payment and 04-09 Record payment.** Recommended: yes, so every mail has the same shape. Also: may "bank reference" be empty when recording? Recommended: required (PAY-19 lists it).
5. **Can the guest withdraw a sent request on the booking page?** **RESOLVED → 04-08 P-19 (no guest withdrawal; 04-06 P6-13 points to WhatsApp).** Today `booking_drop_hold` touches only `held`, so after Request only the owner Cancels (B-26) or it lapses. Recommended for v1: no guest withdrawal; the page shows how to reach the owner. **Owner changed it 2026-10-20** (`.planning/decisions/2026-10-20-phase-4-rule-signatures.md`): the guest can withdraw an unpaid request on the booking page and its nights free at once; a part-paid request cannot be withdrawn on the site and the page says to contact the owner (04-08 P-19 `booking_withdraw_request` and `/api/booking/withdraw`; 04-05 draws the control; 04-06 P6-13 points to it).
6. **Does Void email the guest?** **RESOLVED → 04-08 P-11 (no email).** Recommended: no; the owner writes to the guest if a receipt was wrong.
7. **What does the guest page say about a written-off gap?** **RESOLVED → 04-05 E-08 (receipt and page lines; the reason stays internal).** Recommended: only that nothing more is due; the owner's reason stays internal. Owner approves the line in the pictures.
8. **OPS-04 scope.** **RESOLVED → 04-09 builds the full OPS-04 (search, status, destination, arrival range; 04-08 ops_list_bookings).** Signed list = search and status; REQUIREMENTS text adds destination and dates. Recommended: build the signed list, add destination and arrival range only if the pictures show them, and mark the traceability row "subset".

Owner values still needed before any live request (not questions, already known to the plans): transfer window, bank fields, balance due days N (without it deposit plans are refused: `settings_missing`), booking terms text, per-stay `infants_count`, `BOOKING_LINK_SECRET` and `RESEND_API_KEY` on `almar`, the Resend domain.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, build | yes | 26.7.0 (repo needs >= 22.18) | - |
| npm | `npm ci` (no `node_modules` in this worktree) | yes | 11.19.0 | - |
| Supabase CLI | local stack, pgTAP | yes | 2.119.0 | - |
| colima, docker | local Supabase stack | binaries present; daemon not probed (planning only) | - | controller's slot |
| wrangler | `wrangler dev --test-scheduled`, `deploy --dry-run` | global at `~/.local/bin/wrangler`; the repo pin 4.146.0 arrives with `npm ci` | 4.146.0 pinned | use `./node_modules/.bin/wrangler` |
| AC power for long runs | detached lanes | yes (`pmset`: AC Power, 50% charging) | - | wait |
| Resend domain, `RESEND_API_KEY` on `almar` / preview | request mail, UAT | owner gate, not done | - | none for live; local tests use no key |
| `BOOKING_LINK_SECRET` on any Worker | holds, links | not set anywhere (`STATE.md:64`) | - | owner step |

**Missing with no fallback:** Resend setup on `almar` and preview, `BOOKING_LINK_SECRET`, the owner's values listed above.

## Standing-rule notes (global CLAUDE.md)

- GSD skill that fits next: `/gsd-plan-phase 4` (this file is its input); then `gsd-ui-phase` style pictures for 04-03, 04-05 and 04-09 before code.
- Jev: no decision fits inside Record payment, Void, the gate or the lapse (money, live database; Jev never replaces a gate). A possible advisory fit later, proposed only: classify the guest's reply email (bank receipt vs question) and route it to the owner.
- Automation agent, proposed only: an unattended agent that reads the owner's exported bank statement, matches lines to `ALMAR-XXXXXX` references of `awaiting_payment` bookings and drafts "Record payment" entries for the owner to confirm. It never records on its own.

## Sources

### Primary (HIGH confidence)

- Repo, read in this session: `supabase/migrations/20261005110000_bookings_and_ops.sql`, `20261013120000_site_settings_brand.sql`, `20261019120000_owner_emails.sql`, `20260925120000_platform_spine.sql`; `supabase/tests/site_settings_access.test.sql`, `bookings-and-ops.test.sql`; `worker/almar.mjs`, `worker/almar-ops.mjs`, `worker/handle.mjs`; `wrangler.toml`, `wrangler.preview.toml`, `wrangler.ops.toml`; `lib/server-routes.ts`, `lib/ops-routes.ts`; `lib/booking/*`, `app/api/booking/*`; `lib/ops/route.ts`, `route-core.ts`, `settings.ts`, `translate*.ts`; `lib/settings/*`; `components/ops/*`, `components/ui/confirm-dialog.tsx`; `lib/email/magic-link.ts`, `lib/auth/magic-link-server.ts`, `lib/contact-inquiry.ts`, `app/api/contact/route.ts`; `tests/secrets.test.mjs`, `tests/phase-02-gates.test.mjs`, `tests/ops-runtime.test.mjs`; `.planning/STATE.md`, `.planning/CONTROL-BOARD.md`, `04-CONTEXT.md`, decision record, `04-REWRITE-DRAFT.md`, `04-RESEARCH.md`, `04-01/02-SUMMARY.md`, `04-03/05/06/07-PLAN.md`, `05-CONTEXT.md`, `05-01-PLAN.md`.
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ (crons syntax, UTC, propagation, local testing)
- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/ (handler signature, waits for the promise)
- https://developers.cloudflare.com/workers/platform/limits/ (Free: 10 ms per Cron Trigger, 50 subrequests, 5 Cron Triggers per account)
- https://developers.cloudflare.com/workers/wrangler/commands/workers/ (`--test-scheduled` exposes `/cdn-cgi/local/scheduled`)
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/ (`process.env` population)
- https://opennext.js.org/cloudflare/howtos/custom-worker (extra handlers on the generated worker)
- https://resend.com/docs/dashboard/emails/idempotency-keys ; https://resend.com/docs/api-reference/emails/send-email
- https://www.postgresql.org/docs/current/sql-altertable.html (NOT VALID, VALIDATE CONSTRAINT, ADD COLUMN) ; https://www.postgresql.org/docs/current/sql-select.html (SKIP LOCKED)
- https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/docs/guides/cron

### Secondary (MEDIUM confidence)

- https://opennext.js.org/cloudflare/howtos/env-vars (silent on `process.env` population; used only to show the gap)

### Tertiary (LOW confidence)

- ISO 13616 and ISO 9362 rules (training knowledge, checked by computation on documentation examples only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new package, versions read from `package.json`.
- Architecture (SQL, gate, routes): HIGH, built on code and migration read line by line.
- Workers `scheduled` details: MEDIUM, docs silent on `process.env` in non-fetch handlers and on assets Workers.
- Pitfalls: HIGH for the repo gates and pins; MEDIUM for CPU.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (Cloudflare and Wrangler docs move fast; re-check the scheduled test route if Wrangler is bumped). The repo facts hold until the next change to the files named above.
