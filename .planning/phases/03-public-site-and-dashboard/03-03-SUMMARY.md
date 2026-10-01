---
phase: 03-public-site-and-dashboard
plan: "03"
subsystem: ui
tags: [locale, rtl, framer, postMessage, arabic]

requires:
  - phase: 03-01
    provides: home price amounts left untouched
  - phase: 03-04
    provides: HeroBooker navigate callback and preview notice
provides:
  - In-place EN/AR/ES on /framer with no locale URL
  - Arabic dir rtl on the shell and the iframe
  - Booker labels from BOOKER_COPY when a locale is passed
affects: [03-public-site-and-dashboard]

tech-stack:
  added: []
  patterns:
    - Locale cookie almar-locale plus postMessage of en, ar, or es
    - Iframe text swap writes textContent from the repo table

key-files:
  created:
    - lib/framer-source-copy.ts
    - tests/phase-03-locale.test.mjs
    - tests/phase-03-locale.spec.ts
  modified:
    - app/framer/framer-shell.tsx
    - app/framer/source/route.ts
    - components/specimens/hero-booker.tsx
    - lib/framer-hero-booker-mount.tsx
    - app/embed/hero-booker/route.ts

key-decisions:
  - "Locked Destinations, Search, and Close live in the table even though they are not Framer body text"
  - "HeroBooker locale defaults to en so /design keeps the preview notice"
  - "Noto class names travel in the locale message because the iframe cannot see the shell fonts"

patterns-established:
  - "Pattern: accept only en, ar, or es. Write textContent. Do not assign innerHTML."
  - "Pattern: closed language labels stay EN, AR, ES."

requirements-completed: []

duration: 45min
completed: 2026-09-27
---

# Phase 03 Plan 03: Public locale on /framer Summary

**Language on /framer changes copy and dir in place. Arabic is RTL. English and Spanish stay LTR. The URL stays /framer.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-27T11:10:00Z
- **Completed:** 2026-09-27T11:55:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- English keys are the visible home text and image alts, not rewritten HOME_COPY sentences. The six price amounts stay out.
- Picking AR sets lang ar and dir rtl on the shell and the iframe, writes cookie almar-locale, and does not change the URL.
- The booker on /framer uses BOOKER_COPY. /design still defaults to English and the preview notice.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the locale tests and the home string table** - `9b1c06d` (test)
2. **Task 2: Change copy and dir on /framer without a new URL** - `520c378` (feat)

## Files Created/Modified

- `lib/framer-source-copy.ts` - English keys plus standard Arabic and Spanish
- `tests/phase-03-locale.test.mjs` - Locked chrome strings, no next-intl, route.ts still exports GET
- `tests/phase-03-locale.spec.ts` - AR sets dir rtl on /framer and the URL stays /framer
- `app/framer/framer-shell.tsx` - Cookie, setDocumentLocale, nav labels, locale postMessage
- `app/framer/source/route.ts` - Iframe script sets lang and dir and writes textContent
- `components/specimens/hero-booker.tsx` - Optional locale prop, default en
- `lib/framer-hero-booker-mount.tsx` - Listens for the locale message and passes it
- `app/embed/hero-booker/route.ts` - home-copy.ts added to the bundle source list

## Decisions Made

- Destinations, Search, and Close are not visible Framer body text. They are still in the table so the locked UI-SPEC wording is the one the unit test and the swap script use.
- Arabic and Spanish body copy is standard and correctable at UAT. Locked chrome strings were not reworded.
- The iframe cannot inherit the shell's Noto classes, so the locale message carries those class names and the script adds them only for ar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Playwright spec targeted a button that /framer does not render**
- **Found during:** Task 2 (Change copy and dir on /framer without a new URL)
- **Issue:** The plan said to click the closed AR control. On /framer that control is an option inside the Language listbox, not a visible AR button. The design page is the one with a direct AR button.
- **Fix:** The spec opens Language, chooses the AR option, then opens the Arabic-labeled control and chooses EN. It still asserts lang, dir, and the /framer URL on the shell and the iframe.
- **Files modified:** tests/phase-03-locale.spec.ts
- **Verification:** Live check on 127.0.0.1:3010. AR set dir rtl on both documents. EN and ES set dir ltr. URL stayed /framer. Booker showed Arabic labels.
- **Committed in:** 520c378

**2. [Rule 2 - Missing Critical] Booker bundle must include the copy table**
- **Found during:** Task 2
- **Issue:** HeroBooker now imports BOOKER_COPY. The embed route rebuilds from a source list. Without home-copy.ts, a later edit to that table would not rebuild the iframe bundle.
- **Fix:** Added lib/home-copy.ts to SOURCES.
- **Files modified:** app/embed/hero-booker/route.ts
- **Verification:** The plan named this step. Typecheck passed.
- **Committed in:** 520c378

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both keep the locale switch working on the real control and the real bundle. No scope creep.

## Issues Encountered

- Playwright's repo config refuses the server already on 3010, and this plan forbids editing playwright.config.ts or starting a second server. The same assertions were run against 127.0.0.1:3010 with Playwright directly.
- /framer/source logs React error 405 from Framer's own hydrateRoot in the published script. It is not from this plan's mount. /design does not log it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AR, EN, and ES on /framer change dir and copy in place. Arabic and Spanish sentences are marked correctable at UAT.
- app/route.ts, app/design/page.tsx, and app/globals.css were not edited by this plan.

## Self-Check: PASSED

- FOUND: lib/framer-source-copy.ts
- FOUND: tests/phase-03-locale.test.mjs
- FOUND: tests/phase-03-locale.spec.ts
- FOUND: 9b1c06d
- FOUND: 520c378
- Unit test `node --test tests/phase-03-locale.test.mjs` exited 0.

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
