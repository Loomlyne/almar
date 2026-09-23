---
phase: 01-design-system
plan: "01"
subsystem: ui
tags: [tailwind, next-font, playwright, rtl]

requires: []
provides:
  - Tailwind v4 token set in app/globals.css
  - Dev-only /design skeleton with password eye and Arabic html dir
  - Questa and Lato local fonts plus conditional Noto variables
affects: [01-02, 01-05, 01-06]

tech-stack:
  added: [tailwindcss@4.3.3, @tailwindcss/postcss@4.3.3, postcss@8.5.28, radix-ui@1.6.7, @internationalized/date@3.12.4, @playwright/test@1.63.0]
  patterns:
    - "Semantic color tokens point at primitives; components do not use raw hex"
    - "Password eye uses inset-inline-end and does not move when toggled"
    - "Arabic preview sets lang and dir on documentElement, not a wrapper"

key-files:
  created:
    - app/globals.css
    - lib/fonts.ts
    - app/layout.tsx
    - app/design/page.tsx
    - app/design/design-kit.tsx
    - tests/design-tokens.test.mjs
    - tests/design-rtl.spec.ts
    - playwright.config.ts
    - postcss.config.mjs
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "Playwright dev server uses 127.0.0.1:3010 because 3000 is held by Twenty CRM"
  - "RTL spec measures the password textbox, not every node labeled Password"

patterns-established:
  - "Pattern: kit controls are text buttons; product nav is not rendered from the root layout"
  - "Pattern: production NODE_ENV calls notFound() before the design kit renders"

requirements-completed: [DSGN-02, DSGN-03]

duration: 13min
completed: 2026-09-23
---

# Phase 01 Plan 01: Design system skeleton Summary

**Dev-only /design shows ivory, teal, gold, and charcoal, with a password eye on the inline end and an Arabic preview that sets dir=rtl on the html element**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-23T11:55:36Z
- **Completed:** 2026-09-23T12:08:25Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Pinned Tailwind 4.3.3, PostCSS, Radix, internationalized date, and Playwright without upgrading Next 14.2.35
- Token test passes against the locked hex set and rejects a fifth type-size token
- `/design` toggles the password field and sets `lang`/`dir` on `document.documentElement`

## Task Commits

Each task was committed atomically:

1. **Task 1: Human-verify six assumed packages** - no commit (approved before install)
2. **Task 2: Install pinned packages and write failing token and RTL tests** - `d78f708` (test)
3. **Task 3: Tokens, fonts, layout, and the /design eye plus Arabic preview** - `0b684b5` (feat)

## Files Created/Modified

- `app/globals.css` - Tailwind v4 `@theme` tokens, focus ring, compact density, reduced motion
- `lib/fonts.ts` - Questa and Lato from `brand/Font`; Noto variables applied only for AR
- `app/layout.tsx` - `lang=en` `dir=ltr`, skip link, no product nav
- `app/design/page.tsx` - `notFound()` when `NODE_ENV` is production
- `app/design/design-kit.tsx` - swatches, EN/AR/ES, Compact, password eye
- `tests/design-tokens.test.mjs` - source scan of tokens and banned strings
- `tests/design-rtl.spec.ts` - html dir/lang and eye position
- `playwright.config.ts` - Chromium, dev server on port 3010
- `postcss.config.mjs` - `@tailwindcss/postcss` only
- `package.json` - exact pins and `test` script

## Decisions Made

Playwright cannot bind `127.0.0.1:3000` here because `twenty-crm-server-1` already listens there. The spec still starts `npm run dev`, on port 3010. Twenty, Clickit, and Vamos containers were not stopped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dev server port**
- **Found during:** Task 3 (RTL spec)
- **Issue:** Plan pins `http://127.0.0.1:3000`. That port is Docker Twenty CRM, not this repo.
- **Fix:** Playwright webServer uses `npm run dev -- -H 127.0.0.1 -p 3010`. Still the dev server, not a production build. `reuseExistingServer` stays false.
- **Files modified:** `playwright.config.ts`
- **Verification:** `npx playwright test tests/design-rtl.spec.ts` passed
- **Committed in:** `0b684b5`

**2. [Rule 1 - Bug] RTL locator matched three Password nodes**
- **Found during:** Task 3 (RTL spec)
- **Issue:** `getByLabel('Password')` matched the section, the input, and the Show password button.
- **Fix:** Spec uses `getByRole('textbox', { name: 'Password' })`. Section `aria-label` removed so the visible label owns the name.
- **Files modified:** `tests/design-rtl.spec.ts`, `app/design/design-kit.tsx`
- **Verification:** RTL spec passed in LTR and RTL
- **Committed in:** `0b684b5`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were required for the spec to run and measure the field. No extra packages. No route.ts edits.

## Issues Encountered

Port 3000 is occupied by another local product. Resolved by the port deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-02 and 01-05. Token file, layout, and `/design` exist. Do not add `app/page.tsx`. Do not edit Framer `route.ts` files in those plans except the planned 404 catch-all removal in 01-05.

## Verification

- `node --test tests/design-tokens.test.mjs` exit 0
- `npx playwright test tests/design-rtl.spec.ts` exit 0
- `npm ls next@14.2.35 --depth=0` resolves
- No `app/page.tsx`, no `tailwind.config.js`, no `app/**/route.ts` diff

## Self-Check: PASSED

---
*Phase: 01-design-system*
*Completed: 2026-09-23*
