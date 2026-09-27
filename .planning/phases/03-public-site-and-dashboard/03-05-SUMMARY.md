---
phase: 03-public-site-and-dashboard
plan: "05"
subsystem: ui
tags: [nextjs, guest, sign-in, bookings, account, nav]

requires:
  - phase: 03-public-site-and-dashboard
    provides: SiteNav, Field, and the FramerShell / trip-screen shells
provides:
  - Named Sign in, Bookings, and Account screens, all production-gated
  - Login on /framer and /booking/trip opens /login
  - components/ui/nav.tsx SiteNav gains an unused, defaulted-false signedIn menu
affects: [03-public-site-and-dashboard, guest, nav]

tech-stack:
  added: []
  patterns:
    - "Each guest page.tsx copies the app/framer/page.tsx production notFound gate"
    - "Per-screen local COPY record (en/ar/es), same shape as app/booking/trip/trip-screen.tsx"
    - "NavDrop exported from components/ui/nav.tsx and reused on Account for the language control"

key-files:
  created:
    - lib/guest-copy.ts
    - app/login/page.tsx
    - app/login/sign-in-screen.tsx
    - app/bookings/page.tsx
    - app/bookings/bookings-screen.tsx
    - app/account/page.tsx
    - app/account/account-screen.tsx
    - tests/phase-03-guest.test.mjs
  modified:
    - components/ui/nav.tsx
    - app/framer/framer-shell.tsx
    - app/booking/trip/trip-screen.tsx

key-decisions:
  - "Screens hold their own literal English/Arabic/Spanish COPY record (matching the trip-screen precedent) instead of importing lib/guest-copy.ts, so the locked English strings the plan's acceptance criteria check for (Access with magic link, No bookings yet, Start a trip) are literally present in each screen file"
  - "lib/guest-copy.ts stands as the Task 1 deliverable: a single record of the same strings for a future consumer, not force-imported into the screens"
  - "SiteNav gained an optional signedIn prop (default false) and renders Bookings / Account / Sign out when true, per D-60, but no call site passes true this plan"
  - "NavDrop was exported (was module-private) so Account's Language control reuses the header's exact control instead of a second implementation"
  - "loginHref=\"/login\" was added only to FramerShell and the trip screen, per the interfaces block; Sign in, Bookings, and Account keep the SiteNav default (#log-in)"

patterns-established:
  - "Pattern: guest page.tsx files are server components with the production notFound() gate and a client screen child"

requirements-completed: []

duration: 25 min
completed: 2026-09-27
---

# Phase 3 Plan 05: Guest screens and Login → /login Summary

**Sign in, Bookings, and Account are drawn as named, empty screens. Login on /framer and on /booking/trip now opens /login. Nothing sends and nothing saves.**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `/login` renders one email field (label `Email`, required asterisk, placeholder `name@example.com`) and a gold `Access with magic link` button (`.hero-search-submit`). Submitting with no email sets `aria-invalid` and shows `Enter an email address.` The button does not call `fetch`, does not post, and does not set a cookie. No password field anywhere.
- `/bookings` shows heading `Bookings`, the line `No bookings yet`, and one gold `Start a trip` link to `/framer`. No rows.
- `/account` shows `Name`, `Email`, `Phone`, then a `Language` control built from the same `NavDrop` component the header uses. Picking a language calls `setDocumentLocale` and writes the `almar-locale` cookie. No Save button, no password, nothing persists.
- `components/ui/nav.tsx`'s `SiteNav` gained an optional `signedIn` prop, default `false`. When `true` it would show `Bookings` / `Account` / `Sign out` instead of `Login`; no call site sets it, so it stays hidden. `touchword` is not rendered and the owner's email is not hardcoded anywhere in this diff.
- `app/framer/framer-shell.tsx` and `app/booking/trip/trip-screen.tsx` now pass `loginHref="/login"` to `SiteNav`. The prop's default stays `#log-in`, so `/design` and `KitHome` are unaffected (`git diff -- app/design app/route.ts` is empty).
- `lib/guest-copy.ts` holds the Task 1 record of guest strings (`en`, `ar`, `es`) for `Login`, `Sign in`, `Email`, `Access with magic link`, `Enter an email address.`, `Bookings`, `No bookings yet`, `Start a trip`, `Account`, `Name`, `Phone`, `Language`, `Sign out`. No `touchword`, no `dashboard`.

## Task Commits

1. **Task 1 + Task 2 (combined): guest copy, guest test, and the three screens** - `6f2faef` (feat)
2. **Docs: this summary** - see below

## Files Created/Modified

- `lib/guest-copy.ts` - en/ar/es guest string record (Task 1 deliverable)
- `tests/phase-03-guest.test.mjs` - 8 assertions: guest copy strings, no `touchword`/password anywhere in this plan's files, no public `dashboard` text, sign-in has the magic-link button and no `fetch(`, bookings has the empty line and `Start a trip`, account has no Save/password, FramerShell/trip-screen `loginHref="/login"` with the SiteNav default unchanged, `signedIn` defaults false and no call site sets it true
- `app/login/page.tsx`, `app/login/sign-in-screen.tsx` - Sign in screen
- `app/bookings/page.tsx`, `app/bookings/bookings-screen.tsx` - Bookings screen
- `app/account/page.tsx`, `app/account/account-screen.tsx` - Account screen
- `components/ui/nav.tsx` - optional `signedIn`/`onSignOut` props on `SiteNav`, `NavDrop` exported, `bookings`/`account`/`signOut` added to `NavLabels` defaults
- `app/framer/framer-shell.tsx` - `loginHref="/login"` added to its `SiteNav` call
- `app/booking/trip/trip-screen.tsx` - `loginHref="/login"` added to its `SiteNav` call

## Decisions Made

- The plan's acceptance criteria require the literal strings (`Access with magic link`, `No bookings yet`, `Start a trip`) inside the screen source files. Importing `GUEST_COPY` and rendering `copy.accessWithMagicLink` would satisfy the runtime behavior but not that literal-text check, and would diverge from the existing `trip-screen.tsx` precedent of an inline `COPY` record. Each screen keeps its own local `COPY` object; `lib/guest-copy.ts` remains the standalone Task 1 record.
- `NavDrop` was exported from `nav.tsx` (previously module-private) rather than building a second language control on Account, matching `03-PATTERNS.md`'s explicit instruction to reuse `NavDrop` / `LOCALES`.
- Implemented the `signedIn` prop and its Bookings/Account/Sign out branch in `SiteNav` per D-60 and the threat model (T-03-14), even though no call site uses it this plan — the architecture is drawn in code and stays inert because there is no session.

## Deviations from Plan

None requiring an auto-fix beyond the copy-source decision above.

## Authentication Gates

None.

## Issues Encountered

- `tests/phase-03-search.test.mjs` fails on this branch independent of this plan (a stale string-match assertion against `components/specimens/hero-booker.tsx`'s preview text). Verified by stashing this plan's changes and re-running the test — it fails identically on the pre-existing tree. Not touched by this plan; left as-is.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None that block this plan. `Sign in` does not send a real magic link (locked for this phase). `Bookings` and `Account` do not persist (locked for this phase).

## Next Phase Readiness

- `node --test tests/phase-03-guest.test.mjs` exits 0 (8/8 passing).
- `git diff -- app/design app/route.ts` is empty.
- `/login`, `/bookings`, `/account` are reachable in dev and 404 in production via the copied `notFound()` gate.

## Self-Check: PASSED

- FOUND: lib/guest-copy.ts
- FOUND: app/login/page.tsx
- FOUND: app/login/sign-in-screen.tsx
- FOUND: app/bookings/page.tsx
- FOUND: app/bookings/bookings-screen.tsx
- FOUND: app/account/page.tsx
- FOUND: app/account/account-screen.tsx
- FOUND: tests/phase-03-guest.test.mjs
- FOUND: 6f2faef

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
