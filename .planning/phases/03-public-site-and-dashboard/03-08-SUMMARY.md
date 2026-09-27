---
phase: 03-public-site-and-dashboard
plan: "08"
subsystem: ui
tags: [nextjs, react, css-modules, dashboard]

requires:
  - phase: 03-public-site-and-dashboard (03-02)
    provides: Ops dashboard shell (rail, header, overlay sidebar) at app/dashboard/(ops)/layout.tsx
provides:
  - /dashboard/home screen nested inside the existing ops shell
  - Seven named, valueless slots (bookings, revenue, cost, outstanding, occupancy, reminders, charts)
  - A three-button date control (This month, Last 30, Custom) that sets aria-pressed only
affects: [dashboard-home-wiring, dashboard-data-plans]

tech-stack:
  added: []
  patterns:
    - "Dev-only ops screen: production notFound() gate on the server page.tsx, client screen component holds the interactive body"
    - "Locale read from the almar-locale cookie in a client useEffect, mirroring app/dashboard/(ops)/layout.tsx"

key-files:
  created:
    - app/dashboard/(ops)/home/page.tsx
    - app/dashboard/(ops)/home/home-screen.tsx
    - app/dashboard/(ops)/home/home.module.css
    - tests/phase-03-dashboard-home.test.mjs
  modified: []

key-decisions:
  - "Slot labels (Bookings, Revenue, Cost, Outstanding, Occupancy, Charts) are hardcoded English text because lib/dashboard-copy.ts has no entries for them and the file is locked; the screen only 404s outside development so this is not user-facing in production."
  - "Reminders text is read from DASHBOARD_COPY via copy.noRemindersYet (not duplicated) so the locked lib/dashboard-copy.ts string stays the single source of truth."
  - "Bookings slot gets a larger heading (styles.slotPrimary) per UI-SPEC's 'Focal point is the Bookings slot heading' visual-hierarchy rule."

requirements-completed: []

duration: 25min
completed: 2026-09-27
---

# Phase 03 Plan 08: Dashboard Home Summary

**Dashboard Home screen at /dashboard/home with seven named empty slots (no sample numbers, no chart series) and a three-button date control that sets aria-pressed without fetching or filtering.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-27
- **Tasks:** 1
- **Files modified:** 4 (all created)

## Accomplishments
- Added `app/dashboard/(ops)/home/page.tsx`, a server component that 404s in production (matching `app/framer/page.tsx`'s gate) and renders the client `HomeScreen` otherwise.
- Added `app/dashboard/(ops)/home/home-screen.tsx`: renders the seven slots in UI-SPEC order (bookings, revenue, cost, outstanding, occupancy, reminders, charts), each a labeled region with no metric value; the date control is three `<button type="button">` elements (`This month`, `Last 30`, `Custom`) with `aria-pressed`, local `useState` only, no `fetch`, no radio inputs, radius 0.
- Added `app/dashboard/(ops)/home/home.module.css` using existing design tokens (`--spacing-*`, `--color-*`, `--text-*`, `--duration-fast`, `--ease-standard`), `border-radius: 0` throughout, 44px minimum hit areas on the date buttons, `:focus-visible` rings, and `prefers-reduced-motion` guards.
- Added `tests/phase-03-dashboard-home.test.mjs` with 6 assertions covering: production gate + delegation, slot order, reminders text sourced from `lib/dashboard-copy.ts`, date-control shape (no radio, no fetch), no numeric literal used as a metric, no chart series, and that `lib/dashboard-copy.ts` / `app/globals.css` were not touched.

## Task Commits

1. **Task 1: Draw Home with empty slots and a date control that does not filter** - `c76ecf8` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `app/dashboard/(ops)/home/page.tsx` - Production notFound() gate, delegates to HomeScreen, metadata title "Home"
- `app/dashboard/(ops)/home/home-screen.tsx` - Client component: 7 named slots + date control, no fetch, no sample numbers
- `app/dashboard/(ops)/home/home.module.css` - Flat, bordered, radius-0 styling using existing design tokens
- `tests/phase-03-dashboard-home.test.mjs` - 6 assertions verifying slot order, copy sourcing, and constraints

## Decisions Made
- See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Verified locally: `node --test tests/phase-03-dashboard-home.test.mjs` passes (6/6); `npx tsc --noEmit` is clean; `curl http://127.0.0.1:3010/dashboard/home` returns 200 and the response body contains all seven slot labels, "No reminders yet", and the three date labels.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/dashboard/home` exists as a named, empty screen ready for a later plan to wire real bookings/revenue/cost/outstanding/occupancy/reminders/chart data.
- `lib/dashboard-copy.ts` will need slot-label entries (Bookings/Revenue/Cost/Outstanding/Occupancy/Charts) added in a future copy/locale plan; today they are English-only hardcoded strings on a dev-only screen.
- No blockers.

## Known Stubs

- `app/dashboard/(ops)/home/home-screen.tsx`: all seven slots render only a label with no value/content (by design per plan - "no sample number, no chart series"). A future plan connects each slot to real data; this plan intentionally stops at named empty slots.

## Self-Check: PASSED

- FOUND: app/dashboard/(ops)/home/page.tsx
- FOUND: app/dashboard/(ops)/home/home-screen.tsx
- FOUND: app/dashboard/(ops)/home/home.module.css
- FOUND: tests/phase-03-dashboard-home.test.mjs
- FOUND commit: c76ecf8 (`git log --oneline --all | grep c76ecf8`)

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
