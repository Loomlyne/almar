---
phase: 03-public-site-and-dashboard
plan: "10"
subsystem: ui
tags: [nextjs, react, internationalized-date, dashboard, calendar]

requires:
  - phase: 03-public-site-and-dashboard (03-02)
    provides: Dashboard ops shell layout (rail, header, single Sidebar instance) at app/dashboard/(ops)/layout.tsx
provides:
  - "/dashboard/calendar screen: empty month grid, Monday-start, Asia/Dubai today dot"
  - Empty day sidebar (No bookings yet / New booking / Block) nested in the same Sidebar as other ops screens
affects: [OPS-09, STAY-04, STAY-07 follow-on plans that add real bookings to the calendar]

tech-stack:
  added: []
  patterns:
    - "Ops screen split: server page.tsx with NODE_ENV notFound() gate delegating to a 'use client' *-screen.tsx, same as bookings/customers"
    - "Reuses formatDate from components/ui/calendar.tsx (pure DD/MM/YYYY formatter) without importing CalendarPanel"

key-files:
  created:
    - app/dashboard/(ops)/calendar/page.tsx
    - app/dashboard/(ops)/calendar/calendar-screen.tsx
    - app/dashboard/(ops)/calendar/calendar.module.css
    - tests/phase-03-calendar.test.mjs
  modified: []

key-decisions:
  - "Grid cells pad both leading and trailing to full weeks (multiples of 7) with empty <span> cells, keeping day squares fixed at 44px instead of stretching a partial last row"
  - "Sidebar has two views sharing one Sidebar instance: default day view (No bookings yet / New booking / Block) and a newBooking view showing the same Guest/Destination/Dates/Status fields as the 03-09 bookings sidebar; clicking New booking swaps the view in place, nothing saves or navigates"
  - "Block is a plain secondary button with no onClick side effect (does not fetch, does not save)"

requirements-completed: [OPS-09, STAY-04, STAY-07]

duration: 45min
completed: 2026-09-27
---

# Phase 3 Plan 10: Ops Calendar Empty Month Grid Summary

**Empty `/dashboard/calendar` month grid (Monday-start, `@internationalized/date` `getDayOfWeek`/`today("Asia/Dubai")`) with an empty day sidebar reusing the existing Sidebar and Field components — no bookings, overlap logic, hold timer, or cutoff control drawn.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 1
- **Files modified:** 4 (all created)

## Accomplishments
- New `/dashboard/calendar` route: production gate in `page.tsx` (notFound outside dev, same pattern as bookings/customers), client screen in `calendar-screen.tsx`.
- Month grid built from `today("Asia/Dubai")` and `getDayOfWeek(date, "en-GB")` (Monday = index 0). Days outside the month are not rendered; empty cells pad the grid to full weeks. Each day is a 44px square button, accessible name `DD/MM/YYYY` via the existing `formatDate` helper.
- Today is a small charcoal dot under the day number, not a fill.
- Clicking a day opens the single dashboard `Sidebar` (from `components/ui/sidebar.tsx`, unmodified) with the date as the heading, `No bookings yet`, the one gold `New booking` action (`hero-search-submit`), and a secondary `Block` button that does nothing (no fetch, no save). Clicking `New booking` swaps the same sidebar to the Guest/Destination/Dates/Status fields from the 03-09 booking pattern, without leaving the page or saving. A second day click replaces the sidebar content.
- No booking title, bar, or row is rendered anywhere on the screen.

## Task Commits

1. **Task 1: Draw the empty month and the empty day sidebar** - `8c5a75f` (feat)

_No separate plan-metadata commit — SUMMARY.md is committed alongside this document per orchestrator instructions (STATE.md/ROADMAP.md are owned by the orchestrator, not this executor)._

## Files Created/Modified
- `app/dashboard/(ops)/calendar/page.tsx` - Server page, NODE_ENV production gate, delegates to `CalendarScreen`
- `app/dashboard/(ops)/calendar/calendar-screen.tsx` - Client month grid + day sidebar, Asia/Dubai + Monday-start via `@internationalized/date`
- `app/dashboard/(ops)/calendar/calendar.module.css` - 44px day squares, month bar, empty/day-sidebar styles, tokens-only (no raw hex)
- `tests/phase-03-calendar.test.mjs` - Asserts Asia/Dubai present, no overlap/hold/cutoff words, no `CalendarPanel` import, Monday-index-0 verified independently with `getDayOfWeek`/`en-GB`, sidebar copy keys present, `sidebar.tsx` untouched

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- First test draft used a substring check for the word "hold" and false-matched inside `placeholder="DD/MM/YYYY"` (an approved, pre-existing pattern also used in `bookings-screen.tsx`). Fixed by switching to a word-boundary regex (`/\bhold\b/`) in the test itself — no production code changed for this.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/dashboard/calendar` is drawn and empty, ready for a later plan to connect real booking data, overlap rules (OPS-09), hold timers (STAY-04), and the same-day cutoff control (STAY-07) — all three remain explicitly deferred per this plan's scope.
- No blockers.

## Self-Check: PASSED

- `[ -f "app/dashboard/(ops)/calendar/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/calendar/calendar-screen.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/calendar/calendar.module.css" ]` → FOUND
- `[ -f "tests/phase-03-calendar.test.mjs" ]` → FOUND
- `git log --oneline --all | grep 8c5a75f` → FOUND
- `node --test tests/phase-03-calendar.test.mjs` → 7/7 pass
- `npx tsc --noEmit` → clean, no new errors

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
