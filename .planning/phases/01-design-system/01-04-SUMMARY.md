---
phase: 01-design-system
plan: "04"
subsystem: ui
tags: [specimens, team, inventory, currency]

requires:
  - phase: 01-03
    provides: Nav, footer, and booking specimens
provides:
  - Remaining locked frames on /design
  - Team portraits with published names
  - Inventory spec that fails if a named frame is missing
affects: []

tech-stack:
  added: []
  patterns:
    - "Currency sits beside EN/AR/ES. Language names stay in a specimen, not the header"
    - "Frames do not post, charge, or load a map"

key-files:
  created:
    - components/specimens/account-frames.tsx
    - components/specimens/catalog-frames.tsx
    - components/specimens/team.tsx
  modified:
    - app/design/design-kit.tsx
    - components/ui/nav.tsx
    - tests/design-page.spec.ts
    - tests/design-a11y.spec.ts

key-decisions:
  - "Team photos are 420px rectangles with object-fit cover, not circles"
  - "Placeholder names Ana Velásquez, Mateo Ríos, and Sofía Marín are not shipped"
  - "Early control assertions are scoped to their own region so later specimens can reuse Back, Continue, and Deposit"

patterns-established:
  - "Pattern: a specimen frame is a section with an h2. Jump links stay after the modal so the 60-tab loop still reaches Open modal"

requirements-completed: [DSGN-01, PLAT-05]

duration: 28min
completed: 2026-09-23
---

# Phase 01 Plan 04: Remaining Frames Summary

**Owner opens /design and sees every locked specimen, including team names and a Stripe frame that does not charge**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-23T13:20:00Z
- **Completed:** 2026-09-23T13:48:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Account, pay, and status frames render the locked English copy
- Team shows Maria Del Mar Valdes and María Francis
- Too-late row shows These dates are too late to book today.
- Stay alt stays Sample stay in Cartagena in the Arabic preview
- Inventory spec covers the locked frame list

## Task Commits

1. **Task 1: Account, pay, and status frames** - `4806669` (test), `c8d51d8` (feat)
2. **Task 2: Marketing and team frames** - `7672178` (test), `ef79cf7` (feat)
3. **Task 3: Inventory sweep** - `73d7464` (test)

## Files Created/Modified

- `components/specimens/account-frames.tsx` - Sign-in through booking list
- `components/specimens/catalog-frames.tsx` - Marketing, catalog, and leftover frames
- `components/specimens/team.tsx` - Measured portraits and published names
- `components/ui/nav.tsx` - AED/USD/EUR beside EN/AR/ES
- `tests/design-page.spec.ts` - Task 1, task 2, and inventory specs
- `tests/design-a11y.spec.ts` - Stay alt stays English

## Decisions Made

The currency control is a select in the product header. The language specimen lists English, العربية, and Español and is not in that header. Stripe Pay is a button and does not post.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Later frames duplicated early control names**
- **Found during:** Task 3
- **Issue:** Back, Show password, and Deposit matched more than one node
- **Fix:** Core assertions are scoped to the Link, Password, and Radio regions
- **Files modified:** tests/design-page.spec.ts, tests/design-a11y.spec.ts, tests/design-rtl.spec.ts
- **Verification:** 13 Playwright tests passed
- **Committed in:** `73d7464`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Locked copy and the no-submit rule are unchanged. No deploy.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 01 plans are complete. Do not deploy. Do not add a booking route.

## Verification

- `npx playwright test tests/design-page.spec.ts tests/design-a11y.spec.ts tests/design-rtl.spec.ts tests/design-video.spec.ts` — 13 passed
- `node --test tests/design-tokens.test.mjs` — 2 passed
- `npx tsc --noEmit --pretty false` — exit 0
- No `@stripe` import and no `fetch(` in components

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
