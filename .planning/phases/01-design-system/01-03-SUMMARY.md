---
phase: 01-design-system
plan: "03"
subsystem: ui
tags: [nav, footer, specimens, video, whatsapp]

requires:
  - phase: 01-06
    provides: Select, calendar, stepper, dialog, and icons
provides:
  - Nav, footer, hero booker, stay, add-on, and price specimens
  - Muted video that pauses off-screen
  - WhatsApp link on the locked number
affects: [01-04]

tech-stack:
  added: []
  patterns:
    - "Amounts are currency code, space, Western digits"
    - "Footer contact is the locked email and phone, not the brand-book pair"
    - "Review Pay and payment-failed Try again are separate frames"

key-files:
  created:
    - components/ui/nav.tsx
    - components/ui/footer.tsx
    - components/ui/whatsapp.tsx
    - components/specimens/hero-booker.tsx
    - components/specimens/stay-row.tsx
    - components/specimens/add-on.tsx
    - components/specimens/price.tsx
    - components/specimens/video.tsx
    - lib/format.ts
    - tests/design-video.spec.ts
  modified:
    - app/design/design-kit.tsx
    - app/globals.css
    - next.config.mjs
    - tests/design-page.spec.ts

key-decisions:
  - "Wordmark SVG is imported as asset/source and is not flipped in RTL"
  - "Specimen jump links sit after the modal so the 60-tab a11y loop still reaches Open modal"
  - "The too-late date error is still absent; Plan 01-04 owns that cell"

patterns-established:
  - "Pattern: fixture amounts go through formatAmount; Arabic Intl uses ar-AE-u-nu-latn"
  - "Pattern: a footer inside a section needs role=contentinfo to stay a landmark"

requirements-completed: [DSGN-07]

duration: 13min
completed: 2026-09-23
---

# Phase 01 Plan 03: Booking Specimens Summary

**Owner opens /design and sees nav, footer, hero booker, stay, add-on, price, and a muted video**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-23T13:05:23Z
- **Completed:** 2026-09-23T13:16:45Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Footer shows inquiries@almarprivatejourney.com and +971 56 388 3302
- Empty stays heading is No stays for these dates with one Change dates action
- Review has gold Pay only; payment-failed has gold Try again only
- Video stays in the DOM under reduced motion, is muted, and pauses off-screen

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing footer, specimen, and video specs** - `48b2175` (test)
2. **Task 2–3: Nav, footer, specimens, video, and WhatsApp** - `6bb850b` (feat)

## Files Created/Modified

- `components/ui/nav.tsx` - Sticky ivory header, wordmark, monogram, EN/AR/ES
- `components/ui/footer.tsx` - Locked contact, newsletter error, empty email
- `components/ui/whatsapp.tsx` - wa.me/971563883302, charcoal glyph
- `components/specimens/hero-booker.tsx` - Where, When, steppers, secondary Search
- `components/specimens/stay-row.tsx` - Bookable, booked, missing image, skeleton
- `components/specimens/add-on.tsx` - Included lock and checkbox
- `components/specimens/price.tsx` - Fixture lines, review, payment-failed
- `components/specimens/video.tsx` - Muted catbox video, IntersectionObserver
- `lib/format.ts` - AED 1,050 style amounts and ar-AE-u-nu-latn
- `tests/design-video.spec.ts` - Mute, pause, reduced motion
- `tests/design-page.spec.ts` - Footer and specimen rows

## Decisions Made

The phone price bar also says Continue, so the core inventory assertion is scoped to the Button region. Specimen jumps are a second nav after the chip section so the existing tab-loop tests still reach the eye and Open modal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Poly_Black.svg could not be imported**
- **Found during:** Task 2
- **Issue:** webpack only treated Curves_black.svg as asset/source
- **Fix:** the same rule now includes Poly_Black.svg. The SVG file was not edited
- **Files modified:** next.config.mjs
- **Verification:** tsc exit 0 and the nav renders
- **Committed in:** `6bb850b`

**2. [Rule 1 - Bug] Footer inside a section was not contentinfo**
- **Found during:** Task 2
- **Issue:** HTML does not expose footer as contentinfo when nested in section
- **Fix:** role="contentinfo" on the footer
- **Files modified:** components/ui/footer.tsx
- **Verification:** footer state rows passed
- **Committed in:** `6bb850b`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Contact strings, gold actions, and the video contract are unchanged. No deploy.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-04. Do not add the too-late date error until that plan. Do not deploy.

## Verification

- `npx playwright test tests/design-page.spec.ts tests/design-a11y.spec.ts tests/design-rtl.spec.ts tests/design-video.spec.ts` exit 0 (9 passed)
- `npx tsc --noEmit --pretty false` exit 0
- Footer does not contain +971 50 975 8018
- No Stripe import and no fetch in components/specimens

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
