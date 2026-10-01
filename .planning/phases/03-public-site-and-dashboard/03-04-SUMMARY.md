---
phase: 03-public-site-and-dashboard
plan: "04"
subsystem: ui
tags: [nextjs, search, booking, hero-booker]

requires:
  - phase: 03-public-site-and-dashboard
    provides: Hero booker with five destinations and six hidden query fields
provides:
  - Hero Search on /framer assigns the top window to an empty /booking/trip
  - Incomplete search stays on the hero and shows the locked line
  - Trip screen renders the query as text and an empty stay list
affects: [03-public-site-and-dashboard, booking, search]

tech-stack:
  added: []
  patterns:
    - "Optional HeroBooker onBook; omitted callback keeps the preview notice"
    - "iframe mount assigns window.top.location to /booking/trip with URLSearchParams of the six known keys"
    - "Production notFound gate on the trip page; query values rendered as React text"

key-files:
  created:
    - app/booking/trip/page.tsx
    - app/booking/trip/trip-screen.tsx
    - tests/phase-03-search.test.mjs
    - tests/phase-03-search.spec.ts
  modified:
    - components/specimens/hero-booker.tsx
    - lib/framer-hero-booker-mount.tsx

key-decisions:
  - "CMS-04 stays deferred: no stay record exists, so none was created or reused"
  - "Invalid where shows the locked destination line and Change dates, not the empty-stay line"
  - "New trip strings are English, Arabic, and Spanish; English stays the locked line"

patterns-established:
  - "Pattern: /framer booker navigates window.top only, never the iframe location"
  - "Pattern: /design and KitHome omit onBook and keep the preview notice"

requirements-completed: []

duration: 15 min
completed: 2026-09-27
---

# Phase 3 Plan 04: Empty trip search Summary

**Hero Search assigns the top window to /booking/trip with the six known keys and shows an empty stay list, with no stay record and no charge**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-27T10:47:23Z
- **Completed:** 2026-09-27T11:02:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- A complete hero search on /framer calls `window.top.location.assign` to `/booking/trip` with only `where`, `check-in`, `check-out`, `adults`, `children`, and `infants`.
- A search missing destination or dates stays on the hero, sets `aria-invalid`, and shows the existing locked line. It does not navigate.
- `/booking/trip` renders the query as text. A known destination shows `No stays for these dates` and a `Change dates` link to `/framer`. No sample stay, price, or charge control.
- `/design` and KitHome still omit `onBook`, so the preview sentence remains.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the search tests** - `579e263` (test)
2. **Task 2: Open /booking/trip from a complete search** - `8d54afa` (feat)

## Files Created/Modified

- `tests/phase-03-search.test.mjs` - Source assertions for the six keys, the five destinations, the assign path, and the empty stay line
- `tests/phase-03-search.spec.ts` - Incomplete Search on /framer stays on /framer
- `components/specimens/hero-booker.tsx` - Optional `onBook`; omitted callback still shows the preview sentence
- `lib/framer-hero-booker-mount.tsx` - Top-window assign to `/booking/trip`; unknown `where` does not assign
- `app/booking/trip/page.tsx` - Production `notFound` gate and title Trip
- `app/booking/trip/trip-screen.tsx` - Query as text, empty stay line, Change dates link

## Decisions Made

- CMS-04 is listed on the plan and is not complete. The requirement is one reused stay record. No stay record exists, so this plan created none and seeded none.
- English trip copy stays exact: `No stays for these dates`, `Change dates`, `Choose a destination to search.` Arabic and Spanish sit beside those lines so the screen is not English-only. Nav labels reuse `HOME_COPY`.
- `loginHref` stays the SiteNav default. Login is not sent to `/login`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wrapped the trip screen in Suspense**
- **Found during:** Task 2 (Open /booking/trip from a complete search)
- **Issue:** `useSearchParams` on the client child needs a Suspense boundary or the page cannot read the query during render
- **Fix:** Server `page.tsx` keeps the production gate and wraps `TripScreen` in `Suspense`. The fallback is the title only, not a stay
- **Files modified:** app/booking/trip/page.tsx
- **Verification:** `/booking/trip` returns 200 on the existing dev server and renders the six keys as text
- **Committed in:** 8d54afa

**2. [Rule 2 - Missing Critical] SiteNav does not mark Destinations as the current page**
- **Found during:** Task 2
- **Issue:** SiteNav defaults `markCurrent` to true, which would announce Destinations as the current page on `/booking/trip`
- **Fix:** Passed `markCurrent={false}`. Did not edit `components/ui/nav.tsx`
- **Files modified:** app/booking/trip/trip-screen.tsx
- **Verification:** Rendered nav has no current-page claim on this route
- **Committed in:** 8d54afa

**3. [Rule 2 - Missing Critical] Change dates remains available when where is invalid**
- **Found during:** Task 2
- **Issue:** An invalid or missing destination has no search field on this page. Hiding the only way back would leave the locked error with no fix
- **Fix:** Invalid `where` shows `Choose a destination to search.` and the `Change dates` link to `/framer`. It does not show `No stays for these dates` and does not show a stay
- **Files modified:** app/booking/trip/trip-screen.tsx
- **Verification:** `/booking/trip` and `/booking/trip?where=Miami<script>` show the locked line, render the bad value as text, and link Change dates to `/framer`
- **Committed in:** 8d54afa

**4. [Rule 2 - Missing Critical] Dev trip page is noindex**
- **Found during:** Task 2
- **Issue:** The page is production-gated with `notFound`, matching the dashboard entry, but a dev title could still be indexed if the gate is absent in a non-production host
- **Fix:** Metadata includes `robots: { index: false, follow: false }` beside title `Trip`
- **Files modified:** app/booking/trip/page.tsx
- **Verification:** page source contains `notFound()` and `title: "Trip"` and does not contain `use client`
- **Committed in:** 8d54afa

---

**Total deviations:** 4 auto-fixed (4 missing critical)
**Impact on plan:** All four keep the empty trip screen correct, reachable, and free of a fake current page. No stay record, no charge, no new route beyond `/booking/trip`.

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None that block this plan. The empty line is the specified stay list. CMS-04 remains deferred until a stay record exists.

## Next Phase Readiness

- Ready for the next phase 03 plan. Login still uses the SiteNav default; plan 03-05 owns `/login`.
- `git diff -- app/route.ts app/framer/hero-booker-style.ts` is empty. `git diff -- app/design` is not empty because of pre-existing chosen-look dirt this plan did not edit and did not revert.
- Playwright config is unchanged. The spec was not run through `playwright.config.ts` because that config starts a server and `reuseExistingServer` is false. Against the existing server on 127.0.0.1:3010, an incomplete Search on `/framer` showed the locked line and stayed on `/framer`.

## Self-Check: PASSED

- FOUND: components/specimens/hero-booker.tsx
- FOUND: lib/framer-hero-booker-mount.tsx
- FOUND: app/booking/trip/page.tsx
- FOUND: app/booking/trip/trip-screen.tsx
- FOUND: tests/phase-03-search.test.mjs
- FOUND: tests/phase-03-search.spec.ts
- FOUND: 579e263
- FOUND: 8d54afa

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
