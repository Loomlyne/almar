# Deferred items (03.1)

- OPEN, plan 23: tests/phase-03-search.test.mjs "booker source names the five destinations and six query keys" fails: expects the string "Search is a preview on this page." in components/specimens/hero-booker.tsx. Pre-existing; the hero booker is replaced in plan 23. Only failure in `node --test tests/*.test.mjs` after plan 07 (144 of 145 pass).

- OPEN: tests/phase-03-dashboard.spec.ts "New booking opens one sidebar..." fails after plan 07 (`getByRole('table')` never appears, 30s timeout). Reproduced before plan 04 as well; not caused by the /design or /framer deletion. Only failure in the full `npx playwright test` (32 of 33 pass). Owner: whichever plan touches dashboard bookings screens.

- RESOLVED in plan 07: Playwright /design and /framer spec timeouts. app/design and app/framer are deleted; the specs are removed, and coverage returns in plans 12 (locale), 24 (search) and 28 (a11y, RTL, video).
