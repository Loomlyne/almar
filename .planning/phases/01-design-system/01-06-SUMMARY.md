---
phase: 01-design-system
plan: "06"
subsystem: ui
tags: [select, dialog, calendar, icons, toast]

requires:
  - phase: 01-02
    provides: Core controls, /design kit, and state rows
provides:
  - Select, dialog, toast, Monday-start calendar, guest stepper, and chip
  - Fourteen filled brand marks plus geometric icons, all currentColor
affects: [01-03, 01-04]

tech-stack:
  added: []
  patterns:
    - "Dialog and Select come from radix-ui; FocusScope comes from @radix-ui/react-focus-scope"
    - "Calendar week starts Monday via getDayOfWeek with locale en-GB"
    - "Brand marks are filled currentColor paths, not the JPG sheets"

key-files:
  created:
    - components/ui/select.tsx
    - components/ui/dialog.tsx
    - components/ui/toast.tsx
    - components/ui/calendar.tsx
    - components/ui/stepper.tsx
    - components/ui/chip.tsx
    - components/icons/icons.tsx
  modified:
    - app/design/design-kit.tsx
    - app/globals.css
    - tests/design-page.spec.ts
    - tests/design-a11y.spec.ts

key-decisions:
  - "FocusScope is not on the radix-ui barrel, so dialog imports it from @radix-ui/react-focus-scope"
  - "The too-late date error is not rendered; Plan 01-04 owns that cell"
  - "Calendar days use roving tabindex so the modal trigger stays inside the 60-tab a11y loop"

patterns-established:
  - "Pattern: picker dialogs close on Escape and scrim; confirm dialogs do not"
  - "Pattern: icon-only controls carry an accessible name; the SVG uses currentColor"

requirements-completed: [DSGN-05]

duration: 25min
completed: 2026-09-23
---

# Phase 01 Plan 06: Overlays and Icons Summary

**Owner opens /design and sees select, date range, stepper, modal, toast, chip, and traced icons**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-23T12:40:13Z
- **Completed:** 2026-09-23T13:03:56Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Select named Where, empty copy No options to show, and a Monday-start date range named When
- Guest steppers floor at 1 adult and 0 children/infants, with the reason beside a disabled minus
- Modal Close is named; picker Escape closes, confirm Escape does not
- One icon is role img named Mark and uses currentColor

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing overlay and icon specs** - `c0c6388` (test)
2. **Task 2: Select, dialog, toast, calendar, stepper, chip, and icons** - `d6de7db` (feat)

## Files Created/Modified

- `components/ui/select.tsx` - Where combobox and empty list
- `components/ui/dialog.tsx` - Radix dialog, FocusScope, picker vs confirm dismiss
- `components/ui/toast.tsx` - Max 3, 4 second dismiss, pause on hover or focus
- `components/ui/calendar.tsx` - Monday grid, DD/MM/YYYY, no too-late line
- `components/ui/stepper.tsx` - Add/Remove adult, child, infant
- `components/ui/chip.tsx` - Off ivory, on teal border
- `components/icons/icons.tsx` - Filled brand marks and geometric strokes
- `app/design/design-kit.tsx` - New sections and jump links
- `app/globals.css` - Overlay, calendar, stepper, chip, card pulse
- `tests/design-page.spec.ts` - 01-06 controls
- `tests/design-a11y.spec.ts` - Modal tab stop and currentColor

## Decisions Made

Brand JPGs are filled silhouettes, so the traces are fill currentColor, not 1.5px strokes. Geometric eye, chevron, close, lock, and spinner stay strokes. The forward chevron flips with scaleX in Arabic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Duplicate empty copy failed the strict locator**
- **Found during:** Task 2
- **Issue:** `No options to show` was both a paragraph and the state-row cell, so Playwright strict mode failed
- **Fix:** Visible copy stays on the Select state row only. The closed empty select still carries the same string in its content
- **Files modified:** `components/ui/select.tsx`
- **Verification:** `npx playwright test tests/design-page.spec.ts` exit 0
- **Committed in:** `d6de7db`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The empty string is still on the Select specimen. No extra packages.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-03. Do not render the too-late date error until Plan 01-04. Do not deploy.

## Verification

- `npx playwright test tests/design-page.spec.ts tests/design-a11y.spec.ts` exit 0 (5 passed)
- `npx playwright test tests/design-rtl.spec.ts` exit 0
- `npx tsc --noEmit --pretty false` exit 0
- Picker Escape closes; confirm Escape does not (one-off spec, not committed)
- `These dates are too late` is absent from components and app
- No `ml-` or `text-left` in `components/`

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
