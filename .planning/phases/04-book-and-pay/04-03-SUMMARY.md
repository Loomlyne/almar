---
phase: 04-book-and-pay
plan: "03"
subsystem: guest booking trip
tags: [booking, journey, i18n, hold, bank-transfer]
requires:
  - phase: 04-book-and-pay (04-08)
    provides: quote / hold / release / request routes, request gate, booking types
  - job 21 (#33): /en /ar /es on every page
provides:
  - Book on the stay page -> /en|ar|es/booking/trip (Stay, Add-ons, Travellers, Request) with server prices, the 30-minute hold and its countdown
affects: [04-05 booking page and emails, 04-06 guest list, 04-07 UAT]
duration: 2026-10-25 23:00 - 2026-10-26 16:56 CET (job 25; Mac sleep and a network drop in between)
completed: 2026-10-26
---

# 04-03 SUMMARY: guest booking trip

**Owner rule: "Direct, no test."** Only `npx tsc --noEmit` and `npm run tokens:check` ran. Every node test, Playwright spec, harness scene and build spec is written and **not run**; no PNG was shot.

## Owner signature (2026-10-25 23:16 CET; plan section "Owner signature"; decision file `.planning/decisions/2026-10-25-04-03-pictures-signed.md`)

- Pictures: one HTML page `.planning/phases/04-book-and-pay/pictures/04-03/index.html` (`996460c0`), 29 states.
- **Q-01 = B:** Travellers first; the 30-minute hold starts when Request opens. Built as the only path (no A).
- Q-10, Q-02, Q-04, Q-12, Q-03, Q-08 approved as drawn, incl. reason links (Back to the stay / WhatsApp / Start again) and the phone dock's Continue replacing the in-step one.
- British "Travellers" in English. Added copy: `travellers.errors.summary`, `request.windowNote` ("[N] hours", owner value).
- Shared-file grants (controller, 2026-10-25): `lib/copy/journey.ts`, `lib/locale-path.ts`.

## Commits

| Commit | What |
|---|---|
| `94d04ed2`, `e85e12de` | Task 1a: trip-format helpers, kit optional props, journey copy (EN + model-translated AR/ES) |
| `996460c0` | signature pictures page |
| `ce1e5dc5` | owner signature recorded in the plan |
| `43ea917a` | signed copy: Q-01 B, Travellers, errors summary, window line |
| `e4976369`, `2b89c1ed` | trip state (Q-01 B), client, trip link, locale path, trip metadata |
| `9266d8c7` | RED: trip screens, Book, page specs |
| `748fe0af` | trip components |
| `16d05f0a` | slice A: Book -> trip Stay and Add-ons |
| `093c6f45` | slice B: Travellers -> hold -> Request |
| `bcaabf2d` | build specs (server-runtime, screens-before-after) |
| (Task 5 agent) | remaining build specs, see HANDOVER |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 before every feat commit and at `bcaabf2d` |
| `npm run tokens:check` | "theme up to date" |
| Plan acceptance greps (Tasks 1a, 3, 4) | run, clean; `choices=` in scenes matches once (one shared component), not per state |
| node tests (booking-trip-state, locale-path, assemble-locales, stay-detail-source, phase-03-*) | not run (owner: no test) |
| Playwright (booking-trip.spec, cart-team, build specs) | not run |
| harness scenes / 243 PNGs / baselines | scenes written (29 states), not shot; replaced by the signed HTML page |
| `npm run build`, `assemble-cloudflare` | not run: the move of `/booking/trip` to `/en|ar|es/booking/trip` (old unprefixed page deleted) is unbuilt |
| Different-model review | not done (the controller's lane decides) |

## Deviations

- Q-01 B in the state: `go(4)` needs clean Travellers fields and the payment choice (choices sit at the end of Travellers); one `postHold` per `holdAttempt`; `retryHold` action; reload at step 4 without a hold returns to step 3; release clears the terms box (each hold accepts terms anew); `refused` action stores reasons (04-06 can reuse it for too_many_open).
- English is prefixed (`/en/booking/trip`), as #33; `app/booking/trip/page.tsx` deleted, pages at `app/en|ar|es/booking/trip/page.tsx` (`force-static`); `trip-screen.tsx`, `trip-meta.ts` stay in `app/booking/trip/`.
- Pickup need is read from the cart's add-ons (`isHomePickup`), not the last quote's lines (no 300 ms lag).
- New kit props (optional; absent = as before): `JourneyCart.continueDisabled`, `JourneySheet.finalActionStacked`, `StayBooking.initialSheet` (harness), `data-bar-segment="when"`. New file `components/journey/addons-step.tsx` (shared by page and scenes).
- `trip-meta.ts` comment reworded (it contained "no-referrer"). phase-03-guest pin updated: since job 21 PublicFrame shows Login.
- Picture details: "[Booking terms]" plain text (no link exists yet); booker line 1 read-only copy of the name; no bold (token rule).
- `request.announce` reads "1 minutes left" at the 1-minute mark (screen reader only; the copy has no plural form). `travellers.heading` unused (the picture uses `trip.stepTitle.travellers`).
- Book spec seeds dates through `almar-journey-choice` storage, and imports `lib/data/stays` inside Playwright for the slug.
