---
phase: 05-ops-os
plan: 03
subsystem: ops dashboard, booking money, guest mail, guest booking page
tags: [refund, bank-record, guest-email, next-dynamic, nothing-run]
requires: [05-01, 05-02]
provides:
  - POST /api/ops/booking/refund and /api/ops/booking/refund-void (owner only, opsPost)
  - resend kind refund on POST /api/ops/booking/resend
  - renderRefundReceiptEmail (EN, AR, ES), refundReceipt live in the notifier, mail key refund-receipt/<id>
  - guest booking page Refunds block (date and amount), moneyOnClosed net of refunds
  - Record refund, Refunds list, Void refund and Resend refund email on the booking detail (lazy chunk)
affects: []
requirements: [PAY-12]
key-files:
  created:
    - app/api/ops/booking/refund/route.ts
    - app/api/ops/booking/refund-void/route.ts
    - app/dashboard/(ops)/bookings/detail/booking-refunds.tsx
    - lib/copy/ops-refunds.ts
    - tests/ops-refund-api.test.mjs
  modified:
    - lib/ops/bookings-api.ts
    - lib/ops/bookings.ts
    - lib/email/booking-guest-mail.ts
    - lib/email/booking-notifier.ts
    - lib/copy/booking-email.ts
    - lib/copy/booking-page.ts
    - lib/copy/ops-bookings.ts
    - app/bookings/trip/booking-page-model.ts
    - app/bookings/trip/booking-page-view.tsx
    - app/dashboard/(ops)/bookings/bookings-errors.ts
    - app/dashboard/(ops)/bookings/detail/booking-detail.tsx
    - app/dashboard/(ops)/bookings/detail/booking-dialogs.tsx
    - app/dashboard/(ops)/bookings/detail/booking-detail-screen.tsx
    - tests (see Tests)
completed: 2026-10-31
---

# Phase 5 Plan 03: Record refund, refund email, guest page line Summary

The owner records a bank refund he already made, voids a wrong record with a reason, and resends the guest's refund email; the guest sees "Refunded on {date}" with the amount on the booking page and gets one email in the booking's language. No control or sentence moves money.

## Commits

- `bbb9fb11` Task 1: refund email, notifier wiring, guest page line, tests and scenes
- `fd34bde7` Task 2: parsers, `recordRefund`, `voidRefund`, resend arm, two routes, `tests/ops-refund-api.test.mjs`
- `723151ed` Task 3: copy, lazy refund chunk, detail and screen, helper mock routes, spec

## What was built

- **Email (P5-03).** `refundReceipt` group (EN/AR/ES, AR and ES marked model-translated), `renderRefundReceiptEmail`: heading, greeting, intro with the reference left to right, Amount refunded and Refunded on rows, then the View booking button or `paymentReceipt.noLink`, then the help footer. Nothing else is printed (no status, total, amount still due, bank value, reason or time promise). The notifier's `refundReceipt` now sends to the guest with inquiries@ as reply-to; `MAIL_KEY` accepts `refund-receipt`; the 05-01 `not_ready` line is gone.
- **Guest page.** `refunds` group in `booking-page.ts`; the model carries `refunds` and `closedNetFils`; `moneyOnClosed` is on only while paid minus refunded is above 0 and names that net. Section `data-testid="refunds"` after Payments, date through `Ltr`/`formatIsoDate`, amount in `strong`. Status, Paid, Still due and the transfer block untouched.
- **Routes.** `parseRefund` (six keys, amount via `parseAedAmount`, reason null or 3..300), `parseRefundVoid`, `recordRefund` (one `ops_record_refund`; `amount_fils` renamed `amount`; mail only on `first_time === true` through `refundMailFor`, never throws), `voidRefund` (no mail). Resend `kind: "refund"`: row looked up in `booking.refunds`, a voided or unknown row is 409 `not_applicable`, works with no link secret (`bookingUrl` null), event detail `{ template: "refund_receipt", refund_id: <number>, request_id }`; old kinds keep their detail unchanged and now refuse a `refund_id`.
- **Screen.** Record refund (secondary button, no status check, `canRefund`), Refunded and Net received rows only while `refunded_fils > 0`, "Refunded on {date}: {amount}" lines under What the guest sees, History cases `refund_recorded` and `refund_voided`. Lazy chunk `booking-refunds.tsx` (`RefundsBlock`, `RecordRefundDialog`, `VoidRefundDialog`) loaded with `next/dynamic` and `ssr: false`; the words are in `lib/copy/ops-refunds.ts`, imported only by that chunk. `request_id` is made when the dialog opens and kept for retries; `write` takes a fourth `speak` argument; `REFRESH_CODES` (above_paid, nothing_to_refund, refund_first) keep the dialog open with its sentence and re-read the booking. `refundedFils` is passed to `settlePreview` and `voidPreview` (also in `confirmRecord`'s `base`); `refund_first` shows its own words in the void payment dialog.

## Tests (written, not run)

`tests/ops-refund-api.test.mjs` (new), added cases in `tests/booking-mail.test.mjs`, `tests/booking-notifier.test.mjs` (seventh method, refund key, seam line gone), `tests/booking-page.test.mjs`, `tests/ops-booking-detail.spec.ts` (the old `/Refund/` pin replaced), mock routes and `succeededRefund()` in `tests/helpers/ops-bookings-api.ts` (store now also derives `overpaid` from paid minus refunded and refuses `refund_first`), scenes `refund-receipt`, `refund-receipt-test` (`booking-emails.tsx`) and `refunded` (`booking-page.tsx`).

## Verification

- `npx tsc --noEmit`: clean at the end (one transient error in `new-booking-screen.tsx`, another plan's file, cleared on re-run).
- `npm run tokens:check`: "theme up to date".
- Acceptance greps of the three tasks run and read as the plan expects (routes, `first_time === true`, `data-booking-refunds`, `ssr: false` twice per file, no static import of `./booking-refunds` except `import type`, the count of `ops-refunds` importers outside the chunk is 0, no `rounded`/`underline`/gold/radio in the chunk, no `re_` in the new and edited app/lib files).

## Not verified (owner's no-test rule; belongs to the controller's build and UAT)

No test, no build, no dev server, no Playwright, no pgTAP was run. Unverified: the email in a real inbox, the dialogs in a browser, RTL by eye, that the lazy chunk really loads and stays out of the server bundle, the Worker size, and all written tests. Pictures: none were requested or looked up (no `pictures/05-03/` folder exists); the words are the plan's Words tables.

## Deviations from Plan

1. **[Rule 1] Acceptance grep versus a signed label.** The plan's no-money-words check (`send refund`) matches the signed resend label "Resend refund email" (inside "Resend"). I kept the signed label and made the spec's own regex `\bsend refund|refund now|issue refund` so only a standalone "Send refund" is refused. The plan's literal grep on `lib/copy/ops-refunds.ts` will print that one line; it is the signed Resend label.
2. **Words differ from the signed pictures: none to report.** No picture folder exists; every sentence is the plan's Words table. `errors.refund_date` has no token, so the date field's error does not name the first day.
3. **Order check 3: no fix needed.** `refundMail` in `lib/ops/booking-rules.ts` already compares `String(named) === String(refundId)` and accepts a number or a string. That file was not touched.
4. **`RefundsBlock`/dialogs take `locale`.** The plan's `RefundsBlock` props had `locale`; the two dialogs also receive `locale` (the eager copy object carries no locale) so the chunk can pick `OPS_REFUNDS_COPY[locale]`.
5. **Dialog mounting.** The two lazy dialogs are rendered only while their kind is open, with `open` always true; the close animation of the kit `Dialog` is therefore not played for these two.
6. **Test fixtures.** The mail test builds its job inline from `viewFixture("paid-full", …)` because `tests/helpers/booking-view-fixtures.ts` is not in the grant.

## Files wanted but not touched

None required. (`lib/ops-routes.ts` needed nothing: `tests/ops-route.test.mjs` already lists `booking/refund` and `booking/refund-void`.)

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: both routes go through `opsPost` (owner, Origin, 64 KiB); the refund job and the guest page model carry date and amount only; the tests assert marker reference and reason never print.

## Worker size: the controller's two checks at its build

1. Read the `Worker N KiB gzip` line (was 2,550 against the 2,560 refusal; shared margin with 05-02 and 05-04; this plan estimates 3 to 5 KiB on the server, Arabic compresses poorly, so the limit may be crossed).
2. `grep -rl "data-booking-refunds" .next/server`: a hit under a server bundle means the chunk was not dropped (it still works; it only costs those bytes).

## Reviewer

Reviewer: pending, run by the orchestrator. The money part for the reviewer: `parseRefund`, `recordRefund`, `refundMailFor`, the resend arm, `RecordRefundDialog` and its preview inputs, the `refundedFils` passes, request_id life in the screen, `closedNetFils`, whether any guest surface can show a reference or reason, and every Words sentence for wording that implies the site sends money.

## Self-Check: PASSED

Files and commits `bbb9fb11`, `fd34bde7`, `723151ed` exist on `claude/phase-05-ops-os-d47554`.
