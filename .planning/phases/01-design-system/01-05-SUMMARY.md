---
phase: 01-design-system
plan: "05"
subsystem: ui
tags: [not-found, error-boundary, cloudflare]

requires:
  - phase: 01-01
    provides: Root layout, tokens, and skip link
provides:
  - Branded 404 for unknown paths
  - Server error page with Try again
  - Assemble script that writes 404.html without the catch-all
affects: [host-cloudflare]

tech-stack:
  added: []
  patterns:
    - "404 copy lives in lib/not-found-document.ts and the React page uses the same strings"
    - "Static 404.html inlines the monogram SVG read from brand, and may use hex because Tailwind is not in that file"
    - "Home link is the hardcoded href /"

key-files:
  created:
    - lib/not-found-document.ts
    - app/not-found.tsx
    - app/error.tsx
    - components/status-frame.tsx
    - tests/not-found.spec.ts
    - tests/assemble-404.test.mjs
  modified:
    - scripts/assemble-cloudflare.mjs
    - app/globals.css
    - next.config.mjs

key-decisions:
  - "Catch-all deleted only after not-found.tsx existed; /contact still returns Framer HTML"
  - "Monogram is imported from brand/Logo Monogram/Curves_black.svg and the SVG file was not edited"
  - "Skip link stays in the root layout so the 404 does not render a second one"

patterns-established:
  - "Pattern: unknown paths use app/not-found.tsx, not a catch-all route handler"
  - "Pattern: assemble-cloudflare.mjs calls renderStaticNotFound instead of parsing route.ts"

requirements-completed: [DSGN-06]

duration: 12min
completed: 2026-09-23
---

# Phase 01 Plan 05: Branded 404 Summary

**An unknown path returns 404 with Page not found and one Return home link, and /contact still serves the Framer page**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-23T12:28:00Z
- **Completed:** 2026-09-23T12:40:13Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Unknown path status is 404, with no Bricolage and no Framer generator meta
- `/contact` still returns 200 and the Framer document
- Assemble script no longer reads `app/[...not_found]/route.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing 404 and assemble-script tests** - `97416fa` (test)
2. **Task 2: Shared 404 copy, not-found page, and server error page** - `f64aad8` (feat)
3. **Task 3: Delete the catch-all and fix the assemble script** - `e7a8670` (feat)

## Files Created/Modified

- `lib/not-found-document.ts` - Locked strings and `renderStaticNotFound()`
- `app/not-found.tsx` - Ivory 404, monogram, one home link
- `app/error.tsx` - Same frame, `Try again` calls `reset`
- `components/status-frame.tsx` - Shared monogram and heading
- `scripts/assemble-cloudflare.mjs` - Writes `out/404.html` from the helper
- `app/[...not_found]/route.ts` - Deleted
- `tests/not-found.spec.ts` - Unknown path and `/contact`
- `tests/assemble-404.test.mjs` - Static HTML contract and script source ban

## Decisions Made

The root layout already renders `Skip to content`. The 404 and error pages do not add a second skip link. They set `id="content"` so that link still lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SVG is not under public/**
- **Found during:** Task 2
- **Issue:** `Curves_black.svg` lives in `brand/`, and Next cannot import that SVG without a loader.
- **Fix:** `next.config.mjs` treats that one file as `asset/source`. The React pages data-URI it. The static helper reads the same file. The SVG file was not edited.
- **Files modified:** `next.config.mjs`, `svg.d.ts`, `components/status-frame.tsx`
- **Verification:** Playwright 404 spec passed and the monogram renders
- **Committed in:** `f64aad8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Needed so the monogram can render without copying the file into `public/`. No deploy. No other `route.ts` edits.

## Issues Encountered

Node warns that `lib/not-found-document.ts` has no package module type. The assemble test still passes. `type: module` was not added, because that would change the Next package.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-06. Do not run `wrangler deploy`. Do not point the assemble script back at the deleted catch-all.

## Verification

- `node --test tests/assemble-404.test.mjs` exit 0
- `npx playwright test tests/not-found.spec.ts` exit 0
- `node --check scripts/assemble-cloudflare.mjs` exit 0
- `app/[...not_found]/route.ts` is gone
- No other `app/**/route.ts` file was modified
- `wrangler deploy` was not run

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
