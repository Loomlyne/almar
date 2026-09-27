---
phase: 03-public-site-and-dashboard
plan: "01"
subsystem: ui
tags: [fx, currency, framer, nextjs]

requires:
  - phase: 02-host-and-auth
    provides: Locked FX URL and the /framer shell that holds the chosen look
provides:
  - Fetched usd.aed and usd.eur numbers rewrite the six written home amounts on /framer
  - Dev GET /fx returns those two numbers and a date; production returns 404
  - Currency is lifted out of SiteNav without a second control
affects: [03-public-site-and-dashboard, currency, framer]

tech-stack:
  added: []
  patterns:
    - "Server fetches the locked FX URL, parses two numbers, and never writes the raw JSON into HTML"
    - "FramerShell postMessages currency plus the two numbers; the iframe script writes text nodes"
    - "Missing rate leaves the written amount and shows no guest error"

key-files:
  created:
    - lib/fx/rates.ts
    - app/fx/route.ts
    - tests/phase-03-fx.test.mjs
    - tests/phase-03-screens.test.mjs
  modified:
    - components/ui/nav.tsx
    - app/framer/framer-shell.tsx
    - app/framer/source/route.ts

key-decisions:
  - "PAY-16 nightly, season, override, fee, service, and cleaning math stays out. FX display is not a trip price."
  - "A missing rate returns null and the written amount stays. No guest error string."
  - "Currency cookie almar-currency is not an auth cookie."

patterns-established:
  - "Pattern: /fx is the only client fetch. The iframe never calls the upstream URL."
  - "Pattern: optional currency and onCurrency keep /design and KitHome on internal state."

requirements-completed: [PAY-16]

duration: 14min
completed: 2026-09-27
---

# Phase 3 Plan 01: FX on the six home amounts Summary

**Fetched usd.aed and usd.eur rewrite the six written /framer amounts in place, with no trip-price math and no change to /.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-27T11:08:40Z
- **Completed:** 2026-09-27T11:23:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Switching AED, USD, or EUR on `/framer` rewrites `$20,000`, `$3,000`, `$3,500`, `AED 120,000`, `AED 200,000`, and `AED 80,000` from a live fetch. The URL stays `/framer`.
- A missing rate leaves the written amount. No guest error string is returned or shown.
- `GET /` is still `app/route.ts`. `app/page.tsx` does not exist. PAY-16 month, season, override, fee, service, and cleaning math is absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the FX and / handler tests** - `c57201e` (test)
2. **Task 2: Fetch two numbers and rewrite the six home amounts** - `2a7bf06` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `lib/fx/rates.ts` - Parses the six written amounts, converts with caller-supplied numbers, fetches and caches `usd.aed` and `usd.eur`
- `app/fx/route.ts` - Development JSON `{ aed, eur, date }`; production 404; raw upstream body is not returned
- `components/ui/nav.tsx` - Optional `currency` and `onCurrency`; closed labels stay AED, USD, EUR
- `app/framer/framer-shell.tsx` - Holds currency, reads and writes `almar-currency`, fetches `/fx`, postMessages the two numbers
- `app/framer/source/route.ts` - Injects the text-node rewrite script; booker injection and hidden journey button stay
- `tests/phase-03-fx.test.mjs` - Converter contract, no `3.6725`, no `rate unavailable`
- `tests/phase-03-screens.test.mjs` - `/` stays a route handler; no `app/page.tsx`; no seed file

## Decisions Made

- Conversion is amount times the rate from the written currency. `$` is USD. A written AED amount stays AED when AED is selected.
- Cache is in memory for 12 hours. Failure retries the same URL once, then uses the last good cache. No cache returns null. No peg is invented.
- Range endings that are not in the six amounts (`90,000`, `150,000`, `250,000+`) are left as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node test runner cannot import extensionless TypeScript**
- **Found during:** Task 2 (Fetch two numbers and rewrite the six home amounts)
- **Issue:** `node --test` fails if `lib/fx/rates.ts` statically imports `../format`. Next.js still needs extensionless imports, so the module cannot import `lib/format.ts` and also load under the plan's test command.
- **Fix:** The formatter in `lib/fx/rates.ts` copies the `formatAmount` / `formatAmountLatn` rules (code before number, comma thousands, two decimals only when not whole, `ar-AE-u-nu-latn` for Arabic). Output was checked equal to those functions.
- **Files modified:** `lib/fx/rates.ts`
- **Verification:** `formatConverted` matched `formatAmount` and `formatAmountLatn` for whole, fractional, and Arabic cases
- **Committed in:** `2a7bf06`

**2. [Rule 1 - Bug] A bare `$` replacement left a second currency code**
- **Found during:** Task 2
- **Issue:** The home lines are `From USD $20,000/person`. Replacing only `$20,000` with `EUR 17,556.13` produced `From USD EUR 17,556.13`.
- **Fix:** The rewrite consumes a preceding `USD ` when it replaces a `$` amount. Only the six listed amounts are converted.
- **Files modified:** `lib/fx/rates.ts`
- **Verification:** Playwright on `http://127.0.0.1:3010/framer` showed `From USD 20,000/person` and `From EUR 17,556.13/person`, not a doubled code
- **Committed in:** `2a7bf06`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were required for the tests to run and for the rewritten line to stay readable. No trip-price math was added.

## Authentication Gates

None.

## Known Stubs

None. The six amounts are rewritten from the live feed. Range endings outside that list stay written on purpose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 03-03. `/framer` currency uses fetched numbers. `/` and `/design` were not restyled. PAY-16 price math remains absent.

## Self-Check: PASSED

- FOUND: lib/fx/rates.ts
- FOUND: app/fx/route.ts
- FOUND: tests/phase-03-fx.test.mjs
- FOUND: tests/phase-03-screens.test.mjs
- FOUND: c57201e
- FOUND: 2a7bf06
- `node --test tests/phase-03-fx.test.mjs tests/phase-03-screens.test.mjs` exited 0
- Live `GET /fx` returned finite `aed` and `eur` plus a date, and not the upstream body
- `NODE_ENV=production` `GET` on `app/fx/route.ts` returned 404 `Not found`

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
