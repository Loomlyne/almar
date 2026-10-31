---
phase: 05-ops-os
plan: 02
subsystem: ops dashboard, booking money, guest mail
tags: [new-booking, agreed-price, hand-made-mail, next-dynamic, nothing-run]
requires: [05-01]
provides:
  - POST /api/ops/booking/availability, /quote, /create (owner only)
  - priceOwnerQuote, stayAvailability, ownerRequestGates
  - request_received handMade heading, first line and lapse sentence (EN, AR, ES), also on resend
  - /dashboard/bookings/new, five steps and a summary rail, in a browser-only chunk
  - New booking button on the Bookings list; Make a booking on Plan, Package and Consultation requests
affects: [05-03, 05-04]
requirements: [OPS-06, PAY-03, PAY-04]
key-files:
  created:
    - lib/ops/new-booking-api.ts
    - lib/ops/new-booking.ts
    - lib/ops/new-booking-rules.ts
    - lib/copy/ops-new-booking.ts
    - app/api/ops/booking/availability/route.ts
    - app/api/ops/booking/quote/route.ts
    - app/api/ops/booking/create/route.ts
    - app/dashboard/(ops)/bookings/new/page.tsx
    - app/dashboard/(ops)/bookings/new/new-booking-loader.tsx
    - app/dashboard/(ops)/bookings/new/new-booking-screen.tsx
    - app/dashboard/(ops)/bookings/new/new-booking-steps.tsx
    - app/dashboard/(ops)/bookings/new/new-booking-summary.tsx
    - tests/ops-new-booking-api.test.mjs
    - tests/booking-guest-mail-handmade.test.mjs
    - tests/ops-new-booking-rules.test.mjs
    - tests/ops-new-booking.spec.ts
  modified:
    - lib/booking/server.ts
    - lib/booking/gate-server.ts
    - lib/email/booking-guest-mail.ts
    - lib/copy/booking-email.ts
    - lib/ops/bookings-api.ts
    - lib/copy/ops-bookings.ts
    - lib/copy/ops-requests.ts
    - app/dashboard/(ops)/bookings/detail/booking-detail.tsx
    - app/dashboard/(ops)/bookings/bookings-list.tsx
    - app/dashboard/(ops)/requests/request-detail.tsx
    - tests/ops-route.test.mjs
completed: 2026-10-31
---

# Phase 5 Plan 02: New booking by hand Summary

The owner can make a booking from the dashboard: three owner-only routes price the stay on the server (the stay's rates, or an agreed price with a reason), `ops_create_booking` is called once with the server's own snapshot, and the guest gets the request mail with its own "Your booking is ready" heading. Nothing was run and nothing is live.

## Commits

- `d58672c4` Task 1: availability, quote and create routes, server price only
- `fdebef2a` Task 2: hand-made mail and its resend, agreed price in History, the two ways in
- `90ff6ae7` Task 3: the New booking screen, five steps and summary, browser-only chunk

## Checks run

- `npx tsc --noEmit`: clean after each commit (a transient error in `customers-screen.tsx` seen once during Task 1 was 05-04's work in progress and was gone by the next run).
- `npm run tokens:check`: "theme up to date".
- Task 1 greps: three route files hold `force-dynamic` and `opsPost(`; `handMade: true` and `locale: "en"` present in `new-booking-api.ts`; none of `ownerRequest`, `travellers`, `terms_version`, `isTestHost`, `copy/ops-new-booking`, `from "next` on non-comment lines; `booking/create` in `tests/ops-route.test.mjs`; `scripts/worker-size.mjs` and the contract unchanged.
- Task 2 greps: four `handMade: {` blocks (type plus three languages), `job.handMade`, `handMade: booking.source === "ops"`, four `createdAgreed`, `bookings/new?request=` in the request detail, `dashboard/bookings/new` in the list, and no name, email or phone in that URL.
- Task 3 greps: `ssr: false` in the loader; `ops-new-booking` absent from `page.tsx` and the loader; no import of the copy from `lib/ops` or `app/api`; no radio, underline, rounded-sm..full, raw hex or out-of-scope words in the five `.tsx` files; `crypto.randomUUID` in the screen; `lib/ops-routes.ts`, `scripts/worker-size.mjs`, the contract, `package.json` and the lockfile unchanged by this plan.
- F-09: no run of the three characters r, e, underscore in any file I wrote.

## Written and not run (owner's no-test rule)

`tests/ops-new-booking-api.test.mjs`, `tests/booking-guest-mail-handmade.test.mjs`, `tests/ops-new-booking-rules.test.mjs`, `tests/ops-new-booking.spec.ts`, and the three names added to `EXPECTED_ROUTES` in `tests/ops-route.test.mjs`. No node test, pgTAP, Playwright, build, assemble, dev server or local Supabase was run.

## What was built

- **Routes.** `postAvailability`, `postQuote`, `postCreate` with parsers (`parseAvailability`, `parseQuote`, `parseCreate`) and injected deps. `postCreate` follows the plan's seven steps: gate for this `is_test` (B-13), `priceOwnerQuote` in English, any reason but blocked and sold_out refuses with no rpc, home-pickup address check, one `ops_create_booking` with `snapshotRow` plus the ops keys (no traveller or terms key), SQL refusals as 409 with their code, then the mail (`handMade: true`, key `request/<id>`, no owner notice; a replay finds that key in the booking's events and sends nothing; a missing view or link is logged as `email_failed` with `no_view` or `no_link`).
- **Server price.** `priceOwnerQuote` (rates, or `priceAgreedBooking` for an agreed price, same reason order as `priceQuote`), `stayAvailability` (has_rate false when no base rate or any night without a rate), `ownerRequestGates` (real and TEST gate from one read of the terms and one of `booking_gate()`, no Host).
- **Mail.** `requestReceived.handMade` in EN, AR, ES; `renderRequestReceivedEmail` uses it when `job.handMade`; `resendMail` sets `handMade` from `booking.source === "ops"`; output without `handMade` is unchanged.
- **History.** `history.createdAgreed` in three languages; `eventLine` reads only `agreed_reason` and `agreed_nights_fils`.
- **Ways in.** New booking `LinkButton` in the list header (word `DASHBOARD_COPY[locale].newBooking`); Make a booking `LinkButton` on non-List requests with only the request id in the URL.
- **Screen.** Five steps, summary rail from `lg`, phone bar (`StickyDock`) with Total and the step's action, `ConfirmDialog` on Close when something was typed, request prefill through `/api/ops/requests`, 300 ms quote with latest-ticket and no stale figures, request id kept in a ref against a JSON fingerprint, `router.replace` to the detail on success, focus on the step heading on each step change. Only `OPS_NEW_BOOKING_COPY` words; amounts only through `formatAed` from the quote.
- **Worker size.** `next/dynamic` with `ssr: false` in the loader; `page.tsx` (11 lines) and the loader (14 lines) import nothing of the screen graph except through the dynamic import. The screen, steps, summary, copy and rules are in the browser chunk. No new dependency; `scripts/worker-size.mjs` untouched.

## Deviations from Plan

1. **[Judgment] Stay titles in English.** `/api/ops/stays` summaries carry `title_en` only, so the Stays list and the summary show the English title in every dashboard language (the quote's stay card, which is English too, is used once a quote exists). Destination names are localised as in the Bookings list.
2. **[Judgment] Replay of blocked or booked nights.** The plan lets blocked and sold_out go to the SQL so a replay works. On the screen, Create stays enabled with those two reasons only for a retry of the identical form (same fingerprint as an earlier attempt); a fresh form with unavailable nights is blocked on the screen as well as by the SQL.
3. **[Judgment] Extra words.** Beyond the signed list I added short field-error sentences (name, email, phone, amount, reason, pickup), "Nothing matches.", "Step {n} / 5 · {name}", the plan sentence for deposit unavailable for causes other than no due days, and `quoteFailed`, `saveFailed`, `loadFailed`, `unavailable`, `settings_*` and similar problem sentences. All three languages; AR and ES are model-translated drafts. They are listed below for the owner's signature.
4. **[Judgment] Add-on stepper label.** The remove label of the stepper uses the kit's "Remove" word plus the add-on name.
5. **Branch.** Committed on `claude/phase-05-ops-os-d47554` as instructed (not a `worktree-agent-*` name).
6. **Reviewer.** Not spawned, per the controller: Reviewer: pending, run by the orchestrator. The plan's money review of `server.ts`, `gate-server.ts`, `new-booking-api.ts`, `new-booking-rules.ts`, the resend line and their tests is still to do.

## New words for the owner's signature

The signed EN list of the plan (Booking language and hint, Blocked or booked, These nights are not available, Choose a stay and dates, Hold until, Date, Time UAE, hold hint and floor, Agreed price block, Reason and hint, no-rate sentence, Airport, No airport, Pickup address, Due now, Test booking and hint, email line, Deposit and Full payment lines, the two gate sentences, deposit closed, request unreadable, Leave dialog) plus the extra words in deviation 3, the hand-made mail words (`requestReceived.handMade`), `history.createdAgreed`, and `makeBooking`. All new AR and ES are drafts; dashboard Spanish is usted, guest mail Spanish is tú.

## Stored screenshots that went stale

The Bookings list (new button in the header row) and the Request detail (new button in the actions row) for Plan, Package and Consultation requests. Baselines were not located or regenerated.

## Files wanted but not touched

None needed. Possible pins outside my grant that may need a one-line update when tests run: `tests/ops-bookings-api.test.mjs` if it deep-equals the request resend job (it now carries `handMade`), and any fixture that spells out the `requestReceived` copy tree.

## Not verified

- No test of mine ran; the node tests, the Playwright spec and the pgTAP of 05-01 are all unrun. The 390, 834 and 1440 walks in EN and AR are for the controller or UAT.
- The migration from 05-01 is not applied; `ops_create_booking`'s error shape (`P0001`, `almar:<code>`) and answer fields were read from the migration file, not exercised.
- `DateRangePanel` and `GuestPanel` were used inline with `footer={false}` as the plan says; their look inside the 1-month inline layout is unseen.
- Worker size is unmeasured. Controller's checks at the first landing build: (1) `node scripts/worker-size.mjs` on the ops bundle, number in the hand-over; (2) `grep -rl "Links go to the preview site" .next/server/` must find nothing.

## Known Stubs

None. Customer search, pay later, draft, record offline, payment link, notify switch and internal note are not rendered.

## Threat Flags

None beyond the plan's register: three owner-only POST routes behind `opsPost`, no money from the browser, only the request id in the URL.

## Reviewer

Reviewer: pending, run by the orchestrator.
