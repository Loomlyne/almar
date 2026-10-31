---
phase: 05-ops-os
plan: 01
subsystem: database, money rules, contracts
tags: [bank-refunds, agreed-price, home-numbers, customers, migration-not-applied]
requires: []
provides:
  - supabase/migrations/20261031120000_ops_os.sql (additive, NOT applied)
  - priceAgreedBooking, splitAgreedFils, AgreedSnapshot
  - OwnerRefund, refundableFils, canRefund, canVoidRefund, refundPreview, refundMail
  - lib/ops/new-booking-contract.ts, refund-contract.ts, home-contract.ts (types only)
  - BookingView.refunds / money.refundedFils, refund_receipt seam, RequestMailJob.handMade
affects: [05-02, 05-03, 05-04]
requirements: [PAY-12, OPS-06, OPS-03, OPS-08]
key-files:
  created:
    - supabase/migrations/20261031120000_ops_os.sql
    - supabase/tests/ops-os.test.sql
    - tests/booking-price-agreed.test.mjs
    - tests/ops-refund-rules.test.mjs
    - lib/ops/new-booking-contract.ts
    - lib/ops/refund-contract.ts
    - lib/ops/home-contract.ts
  modified:
    - supabase/tests/booking-requests.test.sql
    - supabase/tests/booking-payments.test.sql
    - lib/supabase/database.types.ts
    - lib/money/booking-price.ts
    - lib/ops/booking-rules.ts
    - lib/booking/types.ts
    - lib/booking/notify.ts
    - lib/email/booking-notifier.ts
    - lib/booking/server.ts
    - lib/ops/bookings-api.ts
    - app/bookings/trip/booking-view-answer.ts
    - tests/helpers/booking-view-fixtures.ts
    - tests/helpers/ops-bookings-api.ts
    - tests/helpers/trip-request-api.ts
completed: 2026-10-31
---

# Phase 5 Plan 01: Ops OS base Summary

Migration `20261031120000_ops_os.sql` (number confirmed by the controller; additive, not applied, no hosted database touched) plus the agreed-price engine entry, the refund rules and the shared contracts that 05-02, 05-03 and 05-04 import.

## Commits

- `b3e47ea4` Task 1: migration, pgTAP, database types
- `919a9ff6` Task 2: agreed-price entry, refund rules, node tests (plus one fixture, see deviations)
- `6d0c3f50` Task 3: contracts, mail seam, view readers
- fix commit (hash in the report): restored a space the editor dropped in one `ops_get_booking` line, found by the diff check

## Checks run

- `npx tsc --noEmit`: clean after each commit.
- `npm run tokens:check`: "theme up to date".
- Task 1 greps: all ten functions once each; `booking_refunds_request_id_key` 2, `drop not null` 1; `booking_write` and `record_refund` not in the migration; no partial index; revokes 10, grants 10, `set search_path = ''` 10; `22, 'constraints` pin present.
- Task 2 greps: exports present; no r-e-underscore text in the two lib files; `booking-price.ts` is additions only (65 insertions, 0 deletions).
- Task 3 greps: three contract files types-only, no F-09 text, no card-provider text; no ungranted shared file in the diff.

## Written and not run (owner's no-test rule)

`supabase/tests/ops-os.test.sql` (plan(145), counted from the file), `tests/booking-price-agreed.test.mjs`, `tests/ops-refund-rules.test.mjs`. Edited pins in `booking-requests.test.sql` (20 to 22 actions, `refunds` in the view key list) and `booking-payments.test.sql` (`refunds` in the owner-detail key list). Nothing was run: no pgTAP, no node test, no build, no Playwright, no local Supabase.

## Replaced functions: diff against the source range (added/removed lines, from `diff`)

Each was copied with `sed -n` from the table's range (the ranges hold the function plus its revoke and grant lines; verified before copying).

| Function | Source | Added | Removed | What |
|---|---|---|---|---|
| booking_flags | 20261019160000:311-355 | 1 | 1 | overpaid net of refunded_fils |
| booking_view | 20261019160000:856-1002 | 12 | 0 | v_refunds declare/select, `refunded_fils` in money, `refunds` after payments |
| ops_get_booking | 20261019160000:1768-1918 | 23 | 0 | v_refunds declare/select, `refunded_fils`, `refunds` |
| ops_create_booking | 20261005110000:1248-1327 | 26 | 2 | three declares, the agreed-reason block, `p - 'agreed_reason'`, event detail merge |
| ops_record_payment | 20261019160000:1082-1337 | 1 | 1 | overpaid compare net of refunded_fils (line 1277) |
| ops_void_payment | 20261019160000:1374-1522 | 8 | 2 | refund_first guard, net compares in the clear condition |

New functions: ops_record_refund, ops_void_refund, ops_home_numbers, ops_list_customers. Each has security definer, empty search_path, execute revoked from public/anon/authenticated and granted to service_role.

## Decisions Made

- Agreed reason: stored in the `created` event detail with `agreed_nights_fils`, read by `ops_create_booking` and removed before the single `booking_write` call, as specified. Mixed sources are `invalid` with field `nights_snapshot`; the key without agreed nights is `invalid` field `agreed_reason`. Detected with `jsonb_exists` rather than the `?` operator.
- Reversed home range is `invalid` field `to`; over 3660 days is `invalid` field `range`.
- `ops_record_refund` validation order: replay, lock, money rule (`nothing_to_refund`, `above_paid`), then field checks (`refunded_on`, `bank_reference`, `reason`). A blank reason string is `invalid`; absent or JSON null is stored as null.
- `refundPreview().refundableFils` is the most that could be refunded before this record (paid minus refunded).

## Deviations from Plan

1. **[Rule 1 - judgment] `ops_void_payment` deadline flag clear.** The plan says the line-1483 compare uses paid minus refunded for the "money-flag" clears. That line also holds `deadline_passed_part_paid`. I split it so `paid_after_expiry`/`paid_after_cancel` use paid minus refunded = 0 and `deadline_passed_part_paid` still uses `v_paid = 0`, because a part-paid request with a refund recorded must not lose its deadline flag. `voidPreview` mirrors this. If the controller wants the literal reading, it is one condition in the migration and one in `voidPreview`.
2. **[Rule 3] `snapshotRow` rateId throw.** Widening the parameter to `PriceSnapshot | AgreedSnapshot` made `n.rateId === undefined` narrow to `never` and fail `tsc`. Changed to `(n.rateId as string | null | undefined) === undefined`; same runtime behavior (fires only on undefined, not on null).
3. **[Rule 3] Fixture timing.** `tests/helpers/ops-bookings-api.ts` (granted, a Task 3 file) got `refunded_fils: 0` and `refunds: []` in the Task 2 commit, because adding the fields to `OwnerDetail` broke `tsc` there. Not a new file touched.
4. **Commit branch.** The executor prompt's worktree guard expects a `worktree-agent-*` branch; this worktree is on `claude/phase-05-ops-os-d47554` as the controller instructed (not a protected ref). Committed there.
5. **`SUMMARY.md` placeholders:** none. `STATE`, `ROADMAP`, `CONTROL-BOARD`, `REQUIREMENTS` untouched per the controller.

## Fixtures not granted, for the controller

Two test files spell out a whole `BookingView` and now lack `refundedFils` in money and `refunds` at the top level; any of their paths that pass the guest page guard (`isBookingView`) will refuse the view:

- `tests/trip-request-state.test.mjs` (view literal around lines 40-75: add `refundedFils: 0` after `paidFils`, and `refunds: []` after `payments: []`)
- `tests/booking-request-api.test.mjs` (view literal around lines 85-100, same two additions)

`tests/ops-bookings-api.test.mjs` line 100 has a view literal too, but it feeds a fake loader and does not pass the guard. `tests/booking-page.test.mjs` and the others use the granted fixture helpers.

## Not verified

- The migration was never applied or parsed by Postgres: its SQL is checked by reading and by the diff/grep checks only. The six copied functions are line-identical to source apart from the counted lines.
- None of the three new test files was run; `plan(145)` is counted by grep of assertion lines, not by a run. Some pgTAP expectations depend on behavior of existing functions I read but could not execute (for example the window rule for real hand-made bookings, which the test sets to 120 minutes before the Home section).
- Worker size: no build was run; the plan's 10 KiB margin is unmeasured. No new import was added to any runtime file (`notify.ts` and `server.ts` add types and a few lines; `booking-price.ts` already imported `eachNight`, `isIsoDate`, `assertFils`).
- The F-09 check is a grep over the changed lib/app files, not `tests/phase-02-gates.test.mjs` itself.

## Known Stubs

`refundReceipt` in `lib/email/booking-notifier.ts` answers `{ ok: false, error: "not_ready" }` on purpose; 05-03 replaces it with its renderer (wording signed on the plan-gate pictures). `MAIL_KEY` in the same file does not yet accept the `refund-receipt` key prefix; 05-03 owns that.

## Reviewer

Reviewer: pending, run by the orchestrator.

## Threat Flags

None beyond the plan's register. The migration is additive and owner/service-role only.

## Grant beyond the plan's table

The controller granted (2026-10-31) `tests/trip-request-state.test.mjs` and `tests/booking-request-api.test.mjs`, only to add `refundedFils: 0` and `refunds: []` to their BookingView fixtures. Done, not run.
