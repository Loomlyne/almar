---
phase: 01-design-system
plan: "02"
subsystem: ui
tags: [controls, field, button, playwright, rtl]

requires:
  - phase: 01-01
    provides: Token file, /design skeleton, and the password eye position test
provides:
  - Link, button, field, checkbox, radio, and switch on /design
  - State rows for those controls, including N/A where a state cannot apply
  - Password eye still on inset-inline-end after Field replaced the skeleton
affects: [01-03, 01-04, 01-06]

tech-stack:
  added: []
  patterns:
    - "Controls use semantic tokens, never raw hex"
    - "Password eye class includes inset-inline-end and does not move on toggle"
    - "State rows live in the control region; N/A is visible text, not a missing cell"

key-files:
  created:
    - components/ui/button.tsx
    - components/ui/link.tsx
    - components/ui/field.tsx
    - components/ui/checkbox.tsx
    - components/ui/radio.tsx
    - components/ui/switch.tsx
    - tests/design-page.spec.ts
    - tests/design-a11y.spec.ts
  modified:
    - app/design/design-kit.tsx
    - app/globals.css
    - tests/design-tokens.test.mjs
    - tests/design-rtl.spec.ts

key-decisions:
  - "One password field keeps the RTL spec on a single eye"
  - "Locale buttons use exact accessible names so Search does not match AR"
  - "Checked choice controls draw a mark, not color alone"

patterns-established:
  - "Pattern: specimens use type=button and do not fetch"
  - "Pattern: field error replaces the hint and sets aria-invalid plus aria-describedby"

requirements-completed: [DSGN-01, DSGN-03, PLAT-05]

duration: 23min
completed: 2026-09-23
---

# Phase 01 Plan 02: Core controls Summary

**`/design` shows link, button, input, password eye, checkbox, radio, and switch, with the state rows those controls own and the eye still on the inline end**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-23T12:10:00Z
- **Completed:** 2026-09-23T12:33:05Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Inventory and keyboard specs fail until the controls exist, then pass
- Primary button is gold with a teal label; disabled primary is not gold
- Date error `Enter a date as DD/MM/YYYY.` sits under the label with `aria-invalid`

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing inventory and a11y tests** - `e816659` (test)
2. **Task 2: Button, link, field, choice controls, and their state rows** - `722ad19` (feat)

## Files Created/Modified

- `components/ui/button.tsx` - Primary, secondary, ghost, and danger; busy spinner keeps the label
- `components/ui/link.tsx` - Teal text link, gold on hover, real href
- `components/ui/field.tsx` - Label above, password eye, search icon, coupon Apply
- `components/ui/checkbox.tsx` - Native checkbox, teal when on
- `components/ui/radio.tsx` - Native radio, teal when on
- `components/ui/switch.tsx` - Teal when on, ivory when off
- `app/design/design-kit.tsx` - State rows and specimens for this plan's controls only
- `app/globals.css` - Control chrome, logical eye padding, reduced-motion spinner
- `tests/design-page.spec.ts` - Inventory scoped to these controls
- `tests/design-a11y.spec.ts` - Tab, focus ring, date error
- `tests/design-tokens.test.mjs` - `components/` scan for physical utilities
- `tests/design-rtl.spec.ts` - Exact names so later buttons do not collide

## Decisions Made

The password error copy is the state-row text, not a second password field. A second eye would make the RTL spec ambiguous. The live field still shows the hint `Use at least 8 characters.`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Locale button name collided with Search**
- **Found during:** Task 2 (RTL spec)
- **Issue:** `getByRole('button', { name: 'AR' })` also matched Search because the name match is a case-insensitive substring and the class string contains `var`.
- **Fix:** EN, AR, and ES locators use `exact: true`. Password textbox name is exact too.
- **Files modified:** `tests/design-rtl.spec.ts`
- **Verification:** RTL spec passed after the locator change
- **Committed in:** `722ad19`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Locator only. No extra controls. No `route.ts` edits. Select, dialog, toast, calendar, stepper, chip, and icons were not added.

## Issues Encountered

None beyond the locale locator.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-05 in this wave, then 01-06. Do not add select, dialog, toast, calendar, stepper, chip, or icons here. Do not render `These dates are too late to book today.`

## Verification

- `node --test tests/design-tokens.test.mjs` exit 0
- `npx playwright test tests/design-page.spec.ts tests/design-a11y.spec.ts tests/design-rtl.spec.ts` exit 0
- `npx tsc --noEmit --pretty false` exit 0
- No `app/page.tsx`. No edit to `app/**/route.ts`

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
