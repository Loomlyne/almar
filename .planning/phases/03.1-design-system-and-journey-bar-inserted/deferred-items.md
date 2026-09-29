# Deferred items (03.1)

- OPEN, plan 23: tests/phase-03-search.test.mjs "booker source names the five destinations and six query keys" fails: expects the string "Search is a preview on this page." in components/specimens/hero-booker.tsx. Pre-existing; the hero booker is replaced in plan 23. Only failure in `node --test tests/*.test.mjs` after plan 07 (144 of 145 pass).

- RESOLVED in plan 13 (spec located the table by role, but the open modal aria-hidden's the page; now uses locator("table")): tests/phase-03-dashboard.spec.ts "New booking opens one sidebar..." fails after plan 07 (`getByRole('table')` never appears, 30s timeout). Reproduced before plan 04 as well; not caused by the /design or /framer deletion. Only failure in the full `npx playwright test` (32 of 33 pass). Owner: whichever plan touches dashboard bookings screens.

- RESOLVED in plan 07: Playwright /design and /framer spec timeouts. app/design and app/framer are deleted; the specs are removed, and coverage returns in plans 12 (locale), 24 (search) and 28 (a11y, RTL, video).

- OPEN, plan 27: legacy `.ui-chip { min-block-size: 44px }` in app/globals.css (line ~2317) makes Chip 44px visible, not 40px (D-47). Found in plan 20; the chip's `h-chip` is overridden by the unlayered legacy rule. Remove with the legacy `.ui-chip` block in plan 27; then tighten tests/journey/steps-addons.spec.ts chip test to exactly 40.
