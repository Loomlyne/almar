# HANDOVER: Phase 5 discuss and plan (2026-10-31 14:13 +0100)

- **Branch:** `claude/phase-05-ops-os-plan-e8e15b`, base `main` `d34e599a`. Commit: the one adding this file. Planning files only; no code, test, build, deploy or live write. Live reads: read-only selects.
- **Signed:** `decisions/2026-10-31-phase-5-discuss.md`, `decisions/2026-10-31-phase-5-plan-signed.md`.
- **Method:** the discussion and planning were run by hand with `gsd-planner` (Opus, one per plan, interfaces first) and `gsd-plan-checker` (Sonnet), not through the `/gsd-plan-phase` command. No research or UI-spec step.

## Plans (order)

| Wave | Plan | Builds |
|---|---|---|
| 1 | 05-01 | Migration, pgTAP, types, contracts, agreed price |
| 2 | 05-02 | New booking, hand-made email, Make a booking on a Request |
| 2 | 05-04 | Home, Customers, Profile; live sections |
| 3 | 05-03 | Record refund, refund email, guest page line (after 05-02) |

## Migration reserved (controller confirms the number)

`supabase/migrations/20261031120000_ops_os.sql`: bank refunds on `booking_refunds`, `bookings.refunded_fils`, two event actions, `ops_record_refund`, `ops_void_refund`, `ops_home_numbers`, `ops_list_customers`; replaces `booking_flags`, `booking_view`, `ops_get_booking`, `ops_create_booking`, `ops_record_payment`, `ops_void_payment`. Written in 05-01, applied live only by the controller.

## Shared files to grant before each worker

- 05-02: `lib/copy/booking-email.ts`, `lib/copy/ops-bookings.ts`, `lib/copy/ops-requests.ts`, new `lib/copy/ops-new-booking.ts`.
- 05-03, after 05-02: `lib/copy/booking-email.ts`, `lib/copy/booking-page.ts`, `lib/copy/ops-bookings.ts`, new `lib/copy/ops-refunds.ts`.
- 05-04: `lib/copy/dashboard.ts`, new `lib/copy/ops-home.ts`; `lib/ops-routes.ts`, `bookings-screen.tsx` and `tests/phase-03-dashboard-lists.test.mjs` are its alone in wave 2.
- Each plan's full list is its "Shared files granted" section.

## Not verified

- Nothing was built or run. Migration SQL, `next/dynamic` with `ssr: false` (new to this repo) and the Worker size are unproven; size estimate 10-17 KiB against a 10 KiB margin.
- `BOOKING_LINK_SECRET` and the mail sender on `almar-ops` were not read; check before first use.

## Known limits the plans keep

- UAT needs Settings first: bank details incomplete, `balance_due_days` null, 0 stays with rates, so an agreed price is the only way to price today.
- A hand-made booking records no guest terms acceptance and has no travellers (P5-13).
- Prefill from a Request reads the newest 500 requests. Customers count leaves out TEST; the Bookings search it opens does not.
- `.planning/prompts/00-common-rules.md` still names retired controller `local_2a268540-…`; its hand-over check set conflicts with the no-test rule. Proposed: controller updates it.

## Proposed for the controller

ROADMAP Phase 5 plans list and criteria; REQUIREMENTS: OPS-03 and OPS-08 narrowed, rest v1.1 per 05-CONTEXT; STATE and CONTROL-BOARD.

Jev: fits none of these plans today (the money rules are fixed code; no probability was used). Automation to consider later: an unattended agent that nudges the owner when a request has no reply for a day; proposal only.
