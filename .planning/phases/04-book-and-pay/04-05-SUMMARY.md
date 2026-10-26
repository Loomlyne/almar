---
phase: 04-book-and-pay
plan: "05"
subsystem: emails, guest booking page
tags: [email, resend, booking-page, withdraw, i18n]
requires:
  - phase: 04-book-and-pay (04-08)
    provides: notify seam (deliverMail, six notifier methods), booking view / withdraw routes, link signer
  - 04-09 (owner records payments -> receipts), 04-03 (journey copy, bookingStatus, trip-format)
provides:
  - six booking emails (guest EN/AR/ES, owner English) sent through Resend; getNotifier() live when the Worker has RESEND_API_KEY
  - the guest booking page /en|ar|es/bookings/trip with Withdraw
affects: [04-06 guest list, 04-07 UAT; almar-ops deploy starts real mail]
duration: 2026-10-26 16:58-17:54 CET (job 25)
completed: 2026-10-26
---

# 04-05 SUMMARY: booking emails and the guest booking page

**Owner rule: "Direct, no test."** Only `npx tsc --noEmit` and `npm run tokens:check` ran. Every node test, Playwright spec, scene, build spec and bite check is written and **not run**; no picture was shot.

## Owner signature (2026-10-26; plan section "Owner signature, 2026-10-26"; decision file `.planning/decisions/2026-10-26-04-05-pictures-signed.md`)

- Pictures: one HTML page `.planning/phases/04-book-and-pay/pictures/04-05/index.html` (`f95a35e5`), 39 states; 15 email states built (the Arabic owner notice dropped by E-11).
- E-11 = A: owner notices English only. E-31: one receipt per payment; a receipt for money received after the pay-by date drops the past "Pay by" sentence (owner 6b; the picture drew it, controller ruling 2026-10-26). Everything else approved as drawn.

## Commits

| Commit | What |
|---|---|
| `066d8193`, `d4a68c44` | Resend sender (lazy `import("resend")`, Idempotency-Key, 8 s timeout), notifier (six methods), withdraw client, `/bookings/trip` path, page meta |
| `0ca499c8`, `85006efa` | `bookingPagePath` writes `/en/bookings/trip` for English (#33) |
| `a0c6c7c3`, `b5aacb00` | email and page copy (EN + model-translated AR/ES; owner copy English), display text, page model, fixtures |
| `f95a35e5` | signature pictures page |
| `a8b3a291` | owner signature in the plan |
| `c4731201` | email shell and the six renderers |
| `9559f865` | emails send: `getNotifier()` returns the live notifier when the key is set |
| `1c25d237` | email scenes and pictures spec |
| `0ca9709e` | notify.ts header comment |
| `ab166cd7`, `e3069eb5`, `1945edef`, `e42afed6`, `ed641dde` | booking page view, three static pages + view call, Withdraw live, print check |
| `c74b7f36` | late receipt drops the past Pay by sentence (6b) |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 at `ed641dde` / `c74b7f36` (17:53 CET) |
| `npm run tokens:check` | "theme up to date" |
| Plan acceptance greps (Tasks 1, 2, 4, 5, 6) | run, clean (grep only) |
| node tests (booking-mail, booking-notifier, booking-withdraw, booking-page, booking-api, booking-gate, locale-path) | not run (owner: no test) |
| Playwright (booking-emails, booking-page incl. withdraw flow, build/booking-pages, slice2 sweep) | not run |
| pictures (135 email + 279 page) | not shot; the signed HTML page replaces them |
| bite checks M1-M7, N1-N6, P1-P13 | not run |
| Different-model review | not done (the controller's lane decides) |

## Deviations

- Sender uses the `resend` package (lazy import), as the plan's grep needs, not raw fetch; 8 s timeout answers `timeout` (a late success may log `email_failed timeout`; the Idempotency-Key stops a duplicate).
- Notifier is `createBookingNotifier({ send, brand, mail })` with a `BookingMailRenderers<C>` object; owner renderers take `{ brand, copy? }` (no locale, E-11). Owner nights row uses the English nights word from the guest copy.
- Arabic mails: values in `<span dir="ltr">` inside sentences; EN/ES plain text.
- Page model takes an optional page `locale` (links follow the page's language); `balanceLine` only on settled statuses (not cancelled/expired).
- Pages at `app/en|ar|es/bookings/trip/page.tsx` (no unprefixed page; `app/[locale]/bookings` has no child, so no shadowing; `run_worker_first` lists only `/en|ar|es/bookings`, the trip page is a static file).
- New pure file `app/bookings/trip/booking-view-answer.ts` (checks every value before display). Try again is the secondary button (as drawn; plan said primary). Back link only with no token and status confirmed/completed. VAT `[RATE]` filled from `vatBp`. Print hides nav/footer with one inline print style scoped to `data-booking-page`.
- Build spec: `/en/bookings/trip/x` 404, `/bookings/trip` 301 (existing `/bookings/*` rule).
