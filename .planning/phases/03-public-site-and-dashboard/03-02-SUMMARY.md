---
phase: 03-public-site-and-dashboard
plan: "02"
subsystem: ui
tags: [nextjs, radix-ui, dashboard, rtl]

requires:
  - phase: 02-design-system
    provides: design tokens, radix dialog, wordmark URLs, Noto font classes
provides:
  - Dashboard chrome copy in en, ar, and es
  - Document locale setter for lang and dir
  - Sign in entry at /dashboard
  - Start-side ops rail and end-docked overlay sidebar
affects: [03-public-site-and-dashboard, dashboard screens, locale]

tech-stack:
  added: []
  patterns:
    - "Dashboard overlay is a controlled Radix dialog docked with inset-inline-end"
    - "Ops routes live under app/dashboard/(ops) so the URL stays /dashboard/*"

key-files:
  created:
    - lib/set-document-locale.ts
    - lib/dashboard-copy.ts
    - components/ui/sidebar.tsx
    - app/dashboard/dashboard.module.css
    - app/dashboard/page.tsx
    - app/dashboard/(ops)/layout.tsx
    - tests/phase-03-dashboard-shell.test.mjs
  modified: []

key-decisions:
  - "Wordmark and monogram URL strings are copied, not imported, because nav.tsx does not export them and this plan must not edit it"
  - "The overlay is mounted closed; no screen in this plan opens it, so no booking can be drawn"
  - "Rail links use next/link so compact navigation stays a client transition"

patterns-established:
  - "Sidebar docks to the end side and does not take a layout column"
  - "Compact rail hides below 1440px and is inert until the menu opens"
  - "Arabic sets dir rtl; English and Spanish stay ltr"

requirements-completed: []

duration: 55min
completed: 2026-09-27
---

# Phase 3 Plan 02: Dashboard Shell Summary

**Sign in entry, start-side ops rail, and one end-docked overlay sidebar, with no booking drawn**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-27T09:50:00Z
- **Completed:** 2026-09-27T10:45:22Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Dashboard chrome strings exist in English, Arabic, and Spanish, including the locked Close, New booking, and No bookings yet rows
- `/dashboard` in dev renders the title Sign in and does not say dashboard in the body
- The ops rail lists the eight labels and their children; the sidebar is an overlay on the end side and does not shrink the page

## Task Commits

Each task was committed atomically:

1. **Task 1: Write dashboard copy, the locale setter, and the shell test** - `d61c335` (feat)
2. **Task 2: Draw the Sign in entry, the rail, and the overlay sidebar** - `6b43b0d` (feat)

## Files Created/Modified

- `lib/set-document-locale.ts` - Sets document lang and dir; Arabic also adds the existing Noto classes
- `lib/dashboard-copy.ts` - EN, AR, and ES dashboard chrome, including rail labels and empty-state strings
- `tests/phase-03-dashboard-shell.test.mjs` - Asserts locked copy, rtl-only Arabic, end-side docking, and the Sign in entry
- `app/dashboard/page.tsx` - Sign in title with the production notFound gate
- `app/dashboard/(ops)/layout.tsx` - Start-side rail, compact menu, and DASHBOARD mark on the interior only
- `components/ui/sidebar.tsx` - One controlled Radix dialog with a Close control
- `app/dashboard/dashboard.module.css` - Shell, rail, and overlay styles; radius 0; no physical right

## Decisions Made

- Copied the wordmark and monogram URL strings instead of importing them. `components/ui/nav.tsx` does not export those constants, and this plan forbids editing that file.
- Mounted the sidebar closed. No caller in this plan opens it, so the shell cannot draw a booking or an overlap rule.
- Used `next/link` for rail items so a compact-menu click does not drop the client layout on a full reload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Copied logo URL strings instead of importing unexported constants**
- **Found during:** Task 2 (Draw the Sign in entry, the rail, and the overlay sidebar)
- **Issue:** The plan says to import WORDMARK_SRC and MONOGRAM_SRC from nav.tsx. Those constants are not exported, and editing nav.tsx is forbidden.
- **Fix:** Copied the same URL strings into the ops layout and left nav.tsx untouched.
- **Files modified:** app/dashboard/(ops)/layout.tsx
- **Verification:** Live `/dashboard/home` renders the ALMAR wordmark from the same Framer URL.
- **Committed in:** `6b43b0d`

**2. [Rule 1 - Bug] Removed a physical slide animation that fought RTL docking**
- **Found during:** Task 2
- **Issue:** A translateX starting style used a physical direction, which would enter from the wrong side in Arabic.
- **Fix:** Dropped the slide. The panel stays docked with inset-inline-end.
- **Files modified:** app/dashboard/dashboard.module.css
- **Verification:** Compiled CSS contains inset-inline-end and min(32rem, 100%), and no physical right property.
- **Committed in:** `6b43b0d`

**3. [Rule 2 - Missing Critical] Compact menu keeps one visible control and an inert closed rail**
- **Found during:** Task 2
- **Issue:** A single toggle put the opener and closer in disagreement, and a closed rail stayed in the tab order.
- **Fix:** Swap the menu and close buttons, trap Tab inside the open rail, and set the rail inert below 1440px until the menu opens.
- **Files modified:** app/dashboard/(ops)/layout.tsx
- **Verification:** Server HTML lists the rail labels. Closed overlay is not in the first HTML, which is expected for a closed portal.
- **Committed in:** `6b43b0d`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 bug)
**Impact on plan:** All three keep the shell correct without adding screens, bookings, or a second dashboard path.

## Issues Encountered

- Browser automation was not installed, so the visual check used the running dev server on 127.0.0.1:3010. Title, visible Sign in text, rail labels, and compiled overlay CSS were verified. Keyboard walk and screenshot were not verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans can import `setDocumentLocale` and `DASHBOARD_COPY` and open `Sidebar` with their own state.
- Do not add a second dashboard path. Bookings and the month grid stay out of this shell.
- `app/globals.css` and `components/ui/nav.tsx` were not changed by this plan.

## Self-Check: PASSED

- FOUND: lib/set-document-locale.ts
- FOUND: lib/dashboard-copy.ts
- FOUND: components/ui/sidebar.tsx
- FOUND: app/dashboard/page.tsx
- FOUND: app/dashboard/(ops)/layout.tsx
- FOUND: app/dashboard/dashboard.module.css
- FOUND: tests/phase-03-dashboard-shell.test.mjs
- FOUND: d61c335
- FOUND: 6b43b0d

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
