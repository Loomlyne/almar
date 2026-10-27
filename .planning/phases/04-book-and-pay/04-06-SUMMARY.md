---
phase: 04-book-and-pay
plan: "06"
subsystem: guest trip page (send request, resume), guest bookings list
tags: [nextjs, react, state-machine, supabase, rls, i18n, rtl]
requires:
  - phase: 04-book-and-pay (04-03, 04-05, 04-08, 04-09)
provides:
  - Send request on /<locale>/booking/trip with every refusal, the sent state and resume through /api/booking/view
  - /<locale>/bookings: the signed-in guest's bookings by session email, tabs Upcoming / Past / Cancelled
key-files:
  created:
    - lib/booking/after-request.ts, lib/booking/request-client.ts, lib/booking/guest-list.ts
    - components/journey/request-sent.tsx, lib/copy/guest-bookings.ts
    - tests/trip-request-state.test.mjs, tests/guest-bookings.test.mjs, tests/trip-request.spec.ts, tests/guest-bookings.spec.ts
    - tests/helpers/trip-request-api.ts, tests/journey/scenes/trip-request.tsx, tests/journey/scenes/guest-bookings.tsx
    - .planning/phases/04-book-and-pay/pictures/04-06/index.html
  modified:
    - app/booking/trip/trip-screen.tsx, app/[locale]/bookings/page.tsx, app/[locale]/bookings/bookings-screen.tsx
    - lib/copy/journey.ts (group afterRequest), tests/journey/scenes/guest-account.tsx, tests/booking-trip.spec.ts (one view mock)
duration: 2026-10-26 to 2026-10-27 13:56 +0100 (job 25)
completed: 2026-10-27
---

# 04-06 SUMMARY: send the request, resume, and the guest's bookings list

Owner rule in force: "No test. Direct, no test." Only `npx tsc --noEmit` and `npm run tokens:check` ran (both exit 0 at
`2ae15102`). Every node test and Playwright spec below is written and has never run.

## Signature

Owner, controller question form, 2026-10-27 13:15 +0100 (decision file `.planning/decisions/2026-10-27-04-06-pictures-signed.md`,
main `26d24eba`), on `pictures/04-06/index.html` at `977081ac` (one HTML page instead of 162 PNGs: owner, no shoot):
P6-07 option 1 (a "Paid AED …" line on cards with a payment); P6-09 option 1 (a trip under way stays Upcoming until its
departure day); P6-02, P6-13, P6-14, P6-08 approved as drawn; every review state and the 58 AR/ES drafts approved.

## Differs from the plan (the code wins)

1. The list is `app/[locale]/bookings` (job 21, owner decision 13): locale from the route; a language pick navigates
   (`goToLocale`), so P6-11's cookie + `router.refresh()` is gone; signed out -> `/<locale>/login?return=bookings`.
2. Card links are `/<locale>/bookings/trip?ref=` (English prefixed too), no token.
3. 04-03 names: `RequestStep` takes `refusal { at, reasons }` (no `reasons` prop), `held` has no `balance`; PublicFrame
   draws Login/Account itself; request refusals reuse 04-03's `refused` action.
4. After a request the rail stays (as the signed pictures draw it) but is locked: no Change after sent, moved on, ended,
   taken, or while sending. Taken also disables "Hold my dates"; its link is 04-03's "Start again from the stay".
5. The screen reads the stored trip with `readTripState` (04-03's `loadTripState` would end a stored hold on the device
   clock), so every stored hold goes to the server first; quotes wait during the check and stop after a sent or
   moved-on resume; the server's hold end (keyed by ref) drives the countdown and Send.
6. Components take the whole journey copy; the WhatsApp URL is built from `ALMAR_WHATSAPP_NUMBER`.
7. No pictures blocks in the specs (owner: no shoot). Scene `upcoming` has no Paid line (as drawn); every other list
   state uses the signed option 1; `past-in-progress` (option 2) is not built.
8. `/bookings` wraps `toGuestCards` in try/catch: a bad row shows Try again, never a crash.
9. Extra exports: `RequestSentOutcome`, `RequestAnswer`, `SummaryView`, `REQUEST_PATH`, `VIEW_PATH`; `postView` uses
   the same 20 s timeout. View fixtures are functions (`viewHeld()`, ...), clocks follow the test.

## Reviews (deep tier by `jev-review`: security 0.71, subtle 0.94; Opus wrote it)

- Pass 1, Sonnet (fix first; no auth or token leak): fixed in `58877431`: (1) the resumed hold end leaked to later holds
  (now keyed by ref); (2) `role="status"` on the sent h2 removed its heading role (removed); (3) resume judged against the
  raw device clock (now device + stored offset); (4) Change clickable while sending; (5) the retry note remounted the
  step. Kept: the failed check still says "Checking your booking…" (signed picture); a repeat send shows "The bank
  details are on your booking page" (true either way); a tab with a sent request shows it again until it lapses.
- Pass 2, Fable (owner approved; fix first; no auth or token leak): fixed in `2ae15102`: (1) the rail's Change was
  still live while sending (now `move()` refuses and the rail locks); (2) a quote after a resumed sent/moved-on showed a
  live price (now no quote); (4) three spec reads of storage now poll. Kept: (3) live regions that mount with content
  (04-03's existing pattern; a11y follow-up); (5) a lost answer then the hold's end lets the guest re-hold (the plan's
  behaviour; `too_many_open` bounds it). Suggested follow-up: `import "server-only"` in `lib/booking/server.ts`.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` at `2ae15102` | exit 0 |
| `npm run tokens:check` at `2ae15102` | theme up to date |
| Task 1a/1b/3/4 acceptance greps (money, card/bank words, storage, `postRequest(` once, `postView(`, token hrefs, `re_`/`eyJ`, type-only `GuestCard`) | clean (grep only) |
| node tests (trip-request-state, guest-bookings, copy, phase-02-gates, phase-03-guest, locale, secrets) | not run (owner: no test) |
| Playwright (trip-request, guest-bookings, booking-trip, phase-02-guest-nav, phase-03-whatsapp) | not run (owner: no test) |
| build, assemble, build specs | not run (owner: no build) |
| 162 PNG pictures | replaced by one HTML page (owner) |

## AR/ES drafts (signed 2026-10-27)

`JOURNEY_COPY.afterRequest` (18 keys) and 11 keys of `GUEST_BOOKINGS_COPY`; table at the end of the pictures page.
