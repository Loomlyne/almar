---
phase: 02-platform-spine
plan: 24
subsystem: auth
tags: [magic-link, hmac, continue-page, rtl]
requires: [02-23]
provides: [continue-page, signed-masked-email-link]
affects: [app/auth/confirm, app/login, lib/auth, lib/copy/guest.ts]
key-files:
  created: [lib/auth/continue.ts, app/login/auth-frame.tsx, app/auth/confirm/page.tsx, app/auth/confirm/actions.ts, tests/auth-continue.test.mjs, tests/auth-continue.spec.ts]
  modified: [lib/auth/send-link.ts, lib/auth/magic-link-server.ts, lib/copy/guest.ts, app/login/sign-in-screen.tsx, app/auth/confirm/continue-screen.tsx, tests/journey/scenes/auth-continue.tsx, tests/auth-magic-link.test.mjs]
  deleted: [app/auth/confirm/route.ts]
requirements-completed: [AUTH-01]
---

# Phase 2 Plan 24: Continue page Summary

Opening the sign-in link now only shows a signed Continue page; `verifyOtp` runs only in the `confirmSignIn` server action when Continue is pressed.

## Commits
- b9ee3a3 feat(02-24): Continue page (helpers, link, page, action, copy, shared frame, route.ts removed)
- feb4c87 test(02-24): node tests, Playwright spec, harness scenes `signed` and `no-email`

## What changed
- `lib/auth/continue.ts`: `maskEmail`, `signContinue`, `verifyContinue` (HMAC-SHA256, base64url, `timingSafeEqual` after a length check), `isConfirmType`. Key is `SUPABASE_SERVICE_ROLE_KEY`; no key means no signature and the page shows the no-email line.
- `sendMagicLink` takes an optional injected `continueProof` dep (kept out of `send-link.ts` imports so the file stays import-free for node tests); the server wiring supplies it. The link carries `m` and `s` only when signed.
- `app/auth/confirm/page.tsx` (force-dynamic, noindex, `referrer: no-referrer`): bad or missing params redirect to `/login?expired=1` (`/sign-in?expired=1` on ops). Email is shown only when the signature verifies.
- `actions.ts` `confirmSignIn`: same allow-list, return-cookie redirect, expired redirect on any failure.
- `AuthFrame` extracted from `SignInScreen`; markup unchanged.
- Copy in `GUEST_COPY[locale].auth.continue` (additions only), EN/AR/ES.

## Verification
- Node: `auth-continue.test.mjs` 8 tests; with `auth-magic-link` and `host-gate` 36 pass, 0 fail. Related `public-frame`, `phase-03-guest`, `locale`, `auth-owner`, `copy` node tests: 39 pass, 0 fail. `tsc --noEmit` clean.
- Playwright (PW_PORT=3063, workers=1): `auth-continue.spec.ts` 12 pass, `auth-i18n` 4, `account-select` 3 (screenshots unchanged), `phase-03-whatsapp` 1. 20 pass, 0 fail in total.

## Deviations
- [Rule 3] `tests/auth-magic-link.test.mjs` "confirm route verifies the token" asserted on the deleted `route.ts`; repointed to `actions.ts`.
- Playwright spec uses assertions only (no screenshots): the frame is covered by existing /login and account-select baselines.
- The `Not you?` link posts nothing; it is a plain link inside the form, as drawn.

## Not done / not verified
- No live end-to-end click with real Supabase (rules forbid contacting it). Supabase-unconfigured path reasoned from code, not run.
- `npm run build` and the assembler were not run, as instructed. `/auth/confirm` is now a dynamic page; job 10 assembler/server-route lists were not touched (`/auth/confirm` was already in `server-paths.ts`).
- `tests/screens-before-after.spec.ts` (capture tool for /login) not run.

## Self-Check: PASSED
