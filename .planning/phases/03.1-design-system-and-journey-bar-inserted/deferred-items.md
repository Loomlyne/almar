# Deferred items (03.1)

- tests/phase-03-search.test.mjs "booker source names the five destinations and six query keys" fails: expects the string "Search is a preview on this page." in components/specimens/hero-booker.tsx. Pre-existing (that file is untouched by plan 04); the hero booker is replaced in plan 23.

- Playwright specs against /design, /framer and one dashboard spec (tests/design-*.spec.ts, phase-03-locale.spec.ts, phase-03-dashboard.spec.ts) fail with page.goto timeouts (30s) on this machine. Reproduced with the pre-plan app/globals.css (commit 7535baa) restored, so not caused by plan 04. Plan 07 deletes /design and /framer.
