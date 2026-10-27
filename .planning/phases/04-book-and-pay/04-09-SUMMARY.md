---
phase: 04-book-and-pay
plan: "09"
subsystem: dashboard, api
tags: [ops-dashboard, bookings, bank-transfer, money-settings, route-handlers]
requires:
  - phase: 04-book-and-pay (04-08)
    provides: request/payment/lapse SQL, notify seam, booking view, link signer
provides:
  - owner endpoints /api/ops/bookings, /api/ops/booking, /api/ops/booking/{payment,void,status,note,attention,resend}, /api/ops/money
  - dashboard Bookings list and detail (record, void, status, note, resolve, resend) and the Bank transfer section in Settings
affects: [04-05 emails (real notifier replaces the not-ready seam), 04-07 UAT]
duration: 2026-10-25 22:28-23:00 CET (job 25)
completed: 2026-10-25
---

# 04-09 SUMMARY: owner bookings and money in the dashboard

**Owner rule in force: "Direct, no test."** Only `npx tsc --noEmit` and `npm run tokens:check` ran. Every test, spec, bite check, stack run, build and Playwright shoot below is written and **not run**.

## Owner answers and signature (all 2026-10-25 unless noted)

- Q-18 (job 25 brief): yes, Resend request email also on a part-paid request past its pay-by date. `canResendRequest` = awaiting_payment and (not deadline_passed or part_received); the resend handler uses the same rule. Plan text updated (`af4f11fa`).
- E-31 (job 25 brief): every payment gets its own receipt (key `receipt/<payment_id>`).
- Pictures: one HTML page instead of PNG shoots, `.planning/phases/04-book-and-pay/pictures/04-09/index.html` (`e83aae66`), 49 states. Signed in the controller's question form: **all option A** (Q-05 stacked sections, Q-09 Resend request kept, Q-06 number + unit, Q-07 confirm before a bank change, Q-13 readiness list). The B alternatives were never built.
- Record payment stays on cancelled, withdrawn and expired (late money); item 14 updated: withdrawn shows only that button.
- The record review's still-due line shows what is left of the deposit by the pay-by date (`depositLeftFils`; on a full plan the target is the total).
- Missing copy added in EN/AR/ES: detail.adults/children/infants/language/travellerKinds/lineUnit/quantity, money.confirm.noEmailNote; also list.arrival and status.changed.
- Recorded in the plan: "Owner signature, 2026-10-25" (`e84a996c`).

## Commits (after the origin/main merge `15584a24`)

| Commit | What |
|---|---|
| `caffedd7`, `93214299` | Task 1: booking rules, money form, copy (before this session's restart) |
| `e83aae66` | signature pictures page |
| `628c947d`, `8a5524b0` | Task 5: eight owner booking routes, handlers, pinned lists |
| `e84a996c` | owner signature recorded in the plan |
| `f8ea3ea9`, `e85f261a` | Task 6: money endpoint, stack proofs (grids 288 + 80) |
| `cbcc7d6b`, `fa26e6b2` | Task 2: list, detail, dialogs (signed A), depositLeftFils |
| `9d8bfdb4`, `438eecbd` | Task 3: money section (signed A) |
| `44c41b18`, `872358ca` | Task 8: money settings wired into Settings |
| `af4f11fa` | reviewer nits (comment, afterWrite spies, Q-18 plan text) |
| `13c13d4b`, `fbca17bb` | Task 7: bookings wired (list, detail, live section, /bookings route) |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 on every feat commit and on `fbca17bb` (23:00 CET) |
| `npm run tokens:check` | "theme up to date" |
| Plan acceptance greps (Tasks 2, 3, 5, 6, 7, 8) | run, clean (grep only) |
| node tests (ops-booking-rules, ops-money-form, ops-bookings-api, ops-money-settings, ops-route, host-gate, phase-03-*) | not run (owner: no test) |
| stack test `ops-record-payment.db.test.mjs` (parity grids, behaviour list) | not run (owner: no test; needs the controller's slot) |
| Playwright specs (ops-bookings, ops-booking-detail, ops-money-settings, ops-settings incl. B10 double click and B12 one "Save", phase-03-dashboard, build/ops-api) | not run |
| harness scenes / PNG pictures | replaced by the signed HTML page |
| Different-model review of Tasks 5–6 (Sonnet `reviewer`, read-only, Opus wrote it) | **no blocker, no should-fix**; 5 nits: 1 and 2 fixed (`af4f11fa`), 3–5 accepted (HANDOVER) |
| Tasks 2–3 and 7–8 (UI) review | not done (Sonnet wrote them; the controller's lane decides) |

## Deviations

- Task 5: reply shapes the plan left open: void `{voided}`, note `{note:{id,at}}`, attention `{resolved:{first_time,note_id}}`. `amount` must be a JSON string; a resend with a link that cannot be signed answers 503 with nothing written; the mail job is built before `log_booking_event` so no refusal leaves an event.
- Task 5 pinned lists: ops-route `EXPECTED_ROUTES` 21 (old list also lacked media, settings), build/ops-api `ROUTES` 23 sorted, GET_ONLY / POST_ONLY sets.
- Task 6 stack test moves deadlines with `admin.from().update` on the local stack (as 04-08's db test does), not `runSql`.
- Task 2 props: BookingsList without kitCopy; BookingDetail has onBack, no today; dialogs take closeLabel; Cancel uses ConfirmDialog (busy guarded in the handler). One arrival DateRangeField (`list.arrival`), the picture drew two.
- Task 7: new `bookings-errors.ts` (refusal code → sentence); on changed / not_allowed / not_found the dialog closes and the detail reloads, other refusals keep the dialog open with the same request_id. Record keeps one request_id per open dialog; each Resend click a fresh one; a sync in-flight ref stops a double post.
- Task 8: a failed money save shows the kit's errorText in the section's status line; only the note goes to auto-translate; option-B copy (windowHours…) removed.
- No harness scenes or PNG shoots anywhere in the plan (owner: no test, no shoot).

## Owner steps (controller)

Unchanged from the plan: after landing, the owner saves the transfer window, bank details, balance due days and terms in Settings → Bank transfer. `almar-ops` needs `BOOKING_LINK_SECRET` for Resend request email (without it: 503) and for links in receipts.
