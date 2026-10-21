---
phase: 04-book-and-pay
plan: "08"
subsystem: database, api, worker
tags: [postgres, supabase, plpgsql, rls, pgtap, bank-transfer, cron, cloudflare-workers, route-handlers]

requires:
  - phase: 04-book-and-pay (04-02)
    provides: bookings spine 20261005110000 (booking_lock, place_hold, booking_by_ref, ops_lapse_holds, public_booked_nights), lib/booking/*, quote/hold/release routes
provides:
  - migration 20261019160000_booking_requests.sql (26 new functions, ops_lapse_holds and public_booked_nights replaced, 3 owner-only tables, 1 trigger)
  - POST /api/booking/request, /api/booking/view, /api/booking/withdraw on Worker almar
  - request gate (no Stripe key), email seam with a not-ready default, bank validators
  - scheduled lapse on almar-ops (cron */5)
affects: [04-03 request screens, 04-05 emails and booking page, 04-06 guest list, 04-09 dashboard money, 04-07 UAT]

key-files:
  created:
    - supabase/migrations/20261019160000_booking_requests.sql
    - supabase/tests/booking-requests.test.sql
    - supabase/tests/booking-payments.test.sql
    - tests/booking-money.db.test.mjs
    - lib/booking/{bank,notify,gate-server,lapse,lapse-worker}.ts
    - app/api/booking/{request,view,withdraw}/route.ts
    - tests/{booking-gate,bank-details,booking-request-api,booking-lapse}.test.mjs
    - tests/build/lapse-cron.spec.ts
  modified:
    - lib/booking/{types,origin,validate,server}.ts
    - app/api/booking/{hold,quote}/route.ts
    - app/api/booking/release/route.ts (comments only)
    - lib/booking/terms.ts, lib/money/fils.ts, lib/money/booking-price.ts (comments only)
    - lib/supabase/database.types.ts (HAND-WRITTEN, not generated)
    - worker/almar-ops.mjs, wrangler.ops.toml, playwright.build.config.ts
    - tests/{booking-api,booking-routes.db,server-runtime,ops-runtime}.test.mjs, tests/build/server-runtime.spec.ts, tests/helpers/load-route.mjs (comment)

duration: 2026-10-21 13:50-16:20 CET (restart session, job 16)
completed: 2026-10-21
---

# 04-08 SUMMARY: request, payments, lapse (database and server)

**Owner rule in force from 2026-10-21 (received after the 15:12 CET pgTAP run), relayed by the controller: "Direct, no test."** After that point nothing was
run except `npx tsc --noEmit` (the controller ruled a type-check is not a test). Before it, one run happened inside the
controller's slot: reset + pgTAP of Task 1 (see Checks).

## Migration

- File: `supabase/migrations/20261019160000_booking_requests.sql`, 2,086 lines,
  sha256 `3ba14152a70eaf6af45ddd459f93e63b4e3ef60d19ed3d2a992af7d2e326b97e` (at `b9463828`).
- Part B (Task 2) and the reviewer fix were **never applied to any database**. Part A applied cleanly on a local reset at `299d1107`.
- Skeleton counts: 28 `create or replace function public.` = 28 `security definer` = 28 grant = 28 revoke lines; the only
  non-revoke `to anon` is the `public_booked_nights` grant; `public.place_hold(` once (request_web_booking); no
  `drop constraint if exists`, no `delete from public.booking_payments`, no `re_`, no Stripe words, no literal IBAN/BIC.
- Function list for the read-back (the plan's 27 names; 26 new + ops_lapse_holds replaced; public_booked_nights also
  replaced): booking_assert_owner, booking_iban_ok, booking_bic_ok, booking_bank_complete, booking_window_minutes,
  booking_next_status, booking_flags, booking_gate, ops_get_money_settings, ops_save_money_settings, request_web_booking,
  booking_withdraw_request, booking_transfer_instructions, booking_view, guest_bookings, ops_record_payment,
  booking_deposit_floor, ops_void_payment, ops_resolve_attention, ops_add_booking_note, ops_list_booking_notes,
  ops_list_bookings, ops_get_booking, ops_lapse_holds, bookings_keep_paid_request (trigger fn), claim_lapse_emails,
  finish_lapse_email. Names match the plan; none differ.
- **P-21:** a 0 % deposit setting gives a `cancel_first` floor of 0 (`booking_deposit_floor('full', g, 0, 0) = 0`).

## Checks

| Check | Result |
|---|---|
| Task 1: local reset + pgTAP booking-requests (221), bookings-and-ops (352), site_settings_access, save_site_settings at `299d1107` | **PASS, 4 files, 615 tests** (2026-10-21 15:12 CET, before the owner's rule) |
| pgTAP booking-payments (plan 237), and every pgTAP file after Task 2 | not run (owner: no test) |
| `tests/booking-money.db.test.mjs`, `tests/booking-hold.db.test.mjs`, `tests/booking-routes.db.test.mjs` | not run (owner: no test) |
| `node --test tests/*.test.mjs` (incl. booking-gate, bank-details, booking-api, booking-request-api, booking-lapse, ops-runtime, server-runtime, secrets, phase-02-gates, worker-size) | not run (owner: no test) |
| `npx tsc --noEmit` | clean after Task 4 (exit 0), after Task 5 (exit 0, executor), and at hand-over (see HANDOVER) |
| `npm run tokens:check`, `npm run build`, `assemble-cloudflare` (prod/preview/ops) and worker sizes | not run (owner: no test; no build) |
| Playwright build specs (server-runtime, lapse-cron, ops-runtime, ops-api) | not run (owner: no test) |
| types regenerated from a stack and diffed | not run: `lib/supabase/database.types.ts` is hand-written (no stack allowed) |
| Bite checks S1-S37, U1-U7, N1-N4, T1-T8, L1-L3, W1-W2 | **all not run (owner: no test)** |
| Plan acceptance greps (every task) | run and clean (grep only) |
| Different-model review (Sonnet `reviewer`, read-only, money/db/access diff to `a41939bc`) | **no blocker**; 1 should-fix fixed (`b9463828`), 1 decision and 4 nits listed in HANDOVER |
| Lapse-cron spec A1/A2 (secrets reach process.env; bundle with the lazy import starts) | not settled: spec written, not run |

## Deviations (each with its reason; full list from the executors in HANDOVER)

- Task order kept (1, 2, 3, 4, 5); the SQL bite checks were moved to the end so they would hit the finished file, then
  dropped by the owner's rule.
- `database.types.ts` hand-written in the generator's layout (no stack); the trigger function is omitted as the generator omits
  existing ones. `booking_view` / `guest_bookings` `p_locale` is typed `string` though the code may pass null.
- `request_web_booking`: per-email advisory lock before the 3-open count (reviewer finding 1; not in the plan).
- `ops_record_payment`: replay checked before the lock, under the lock and after a unique_violation (so 8 parallel calls
  replay instead of answering `changed`); inline-lapse event actor `system`; write-off gap computed before the insert.
- `ops_lapse_holds`: lapse and flag in one loop in stay order (no deadlock between two calls); flag event from/to null.
- `finish_lapse_email` idempotent on success; `ops_add_booking_note` takes no booking lock (does not change the booking).
- `deliverMail` stores an error only when it is wholly `[a-z0-9_]+` (cut to 60), else `unknown`.
- `requestBooking` / `withdrawBooking`: a view read that throws for the mail is caught, no mail, answer stays 200.
- Hold route: missing link secret still answers 503 `unavailable` before the gate (existing test body kept).
- `runLapseCycle`: a mail sent whose finish failed counts as failed (lease + idempotency key make the retry safe).
- Extra exports: `BookingLocale`, `MailOptions`, `MailKind`, `MailRequest`, `BookingGateState`, `RequestGateInput`,
  `RequestContext`, `ViewDeps`, `WithdrawDeps`, `LapseCycle`.

## Owner steps

Unchanged from the plan's `<owner_steps>` 1-6 and the live read-back SQL (controller only; migration first, `almar-ops`
second; `BOOKING_LINK_SECRET` on `almar` only after `almar` runs this gate). Because part B never ran on any database, the
first apply anywhere (local or live) is its first compile.
