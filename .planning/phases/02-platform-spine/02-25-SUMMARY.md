---
phase: 02-platform-spine
plan: 25
subsystem: guest-nav-and-ops-profile
tags: [auth, nav, profile, sign-out]
requires: [02-23]
provides: [W6 Profile sign-out wired, W7 real nav links on /account and /bookings, W8 no currency on /bookings]
key-files:
  created:
    - components/site/page-links.ts
    - tests/phase-02-guest-nav.spec.ts
    - tests/journey/scenes/ops-profile.tsx
  modified:
    - app/dashboard/(ops)/profile/profile-screen.tsx
    - app/account/account-screen.tsx
    - app/bookings/bookings-screen.tsx
    - components/pages/private-stays-page.tsx
metrics:
  completed: 2026-10-05
---

# Phase 02 Plan 25: W6-W8 sign-in page open items Summary

Profile Sign out posts a hidden form to `/auth/sign-out`, Sign out everywhere calls `signOutEverywhere()` (same pattern as ops-shell); `/account` and `/bookings` pass the four real public links to SiteNav; `/bookings` hides the currency control.

## Commits

- f5f397a feat(02-25): Profile sign-out wired, real header links, no currency on /bookings
- 04ff461 test(02-25): header hrefs per locale, no currency on bookings, Profile sign-out form

## What changed

- W6: `profile-screen.tsx` — hidden `<form action="/auth/sign-out" method="post">`; confirm submits it. Logout-all confirm calls `signOutEverywhere()`. Dialogs and words unchanged.
- W7: new `components/site/page-links.ts` (`PAGE_LINKS`, `pageLinks(locale, nav)`) extracted from `private-stays-page.tsx`, which now uses it (same output). Both guest screens pass `links={pageLinks(locale, nav)}`; labels from the nav copy already used.
- W8: `/bookings` passes `currency={false}`; `/account` unchanged.

## Tests

- `tests/phase-02-guest-nav.spec.ts`: 8 Playwright tests, all pass (hub and bookings x en/ar/es hrefs, no currency on bookings and one on account, Profile form action/method and dialog wording, source assertion for the two actions).
- `tests/review-fixes.spec.ts` + `tests/account-select.spec.ts`: green (19 passed total with the new spec, workers=1, port 3064).
- Node: phase-03-settings, phase-03-guest, public-frame, site-nav-tone, phase-03-screens, section-head, site-footer-copy: 41 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- No existing test asserted the old `#anchors` or the no-op dialog, so none was changed.

## Deviations from Plan

- **Locale hrefs are the same in every language.** The brief expected `/ar/destinations`, `/es/destinations`. `siteHref` returns `/destinations`, `/experiences`, `/about`, `/contact` unchanged in all three locales because they are English-only Framer pages today (comment in the code says so). The guest pages now match the React public pages exactly, which is the plan's stated check. The test derives expected hrefs from `siteHref`, so it follows if those pages get localized later.
- Added a harness scene `tests/journey/scenes/ops-profile.tsx` so the Profile form can be checked in a browser.
- `home-page.tsx` and `stay-detail-page.tsx` still build the same four links inline; not touched (out of scope).

## Not verified

- Actual sign-out round trip against a live session (no Supabase here); that is his UAT step.
- Screens at 390/834/1440 EN/AR for UAT were not captured in this run.

## Self-Check: PASSED
