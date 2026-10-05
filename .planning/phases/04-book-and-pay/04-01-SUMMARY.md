---
phase: 04-book-and-pay
plan: "01"
subsystem: payments
tags: [money, fils, rounding, vat, deposit, typescript, node-test]

requires:
  - phase: 03.2-real-catalog-and-team-inserted
    provides: "stay_night_rates rows (C-11 already applied in SQL), passed in as nightRates"
  - phase: 02-platform-spine
    provides: "tests/helpers/load-ts.mjs (esbuild loader for node tests)"
provides:
  - "lib/money/fils.ts: assertFils, pct (the one half-up rounding rule), percentTextToBp, MIN_CHARGE_FILS"
  - "lib/money/dates.ts: isIsoDate, addDays, daysBetween, eachNight, dubaiToday"
  - "lib/money/booking-price.ts: priceBooking and the exported contract types"
  - "lib/money/format.ts: formatAed (display only)"
affects: [04-02, 04-03, 04-05, 05-02]

tech-stack:
  added: []
  patterns:
    - "Every amount is an integer of fils; every percentage goes through pct(); balance by subtraction"
    - "Guest-facing problems are reasons; a malformed caller input throws"

key-files:
  created:
    - lib/money/fils.ts
    - lib/money/dates.ts
    - lib/money/booking-price.ts
    - lib/money/format.ts
    - tests/booking-price.test.mjs
  modified: []

key-decisions:
  - "A refused deposit (plan deposit, deposit blocked) returns deposit_unavailable and leaves the snapshot on full (dueNow = grand, balance 0, no date), so the snapshot always describes a payable plan"
  - "settings_missing and no_rate are returned together when both apply; dates_invalid returns alone"
  - "Zero-quantity picks are dropped before repeated ids are counted"
  - "pct keeps the plan's formula floor((a * bp + 5000) / 10000): with a safe product the quotient is under 2^40, where a correctly rounded division cannot cross a whole number, so it is exact (BigInt-checked in the tests)"

patterns-established:
  - "Money modules in lib/money import only each other; no environment, no network, the clock is passed in"

requirements-completed: [PAY-01, PAY-02, PAY-03]

duration: 8min
completed: 2026-10-05
---

# Phase 4 Plan 01: Money engine Summary

**Integer-fils booking price in lib/money: nights, add-ons, subtotal, VAT once, grand, deposit or full with balance and due date, B-21's full-only rule, one half-up pct() rounding rule; 32 node tests including PAY-02's own example and 2,000 seeded draws against a BigInt reference.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-05T01:52:54Z (05:52 +04)
- **Completed:** 2026-10-05T02:00:08Z (06:00 +04), summary after
- **Tasks:** 2 of 2 (TDD: a failing-test commit, then a passing-code commit, for each)
- **Files created:** 5

## Accomplishments

- `priceBooking` follows B-05 exactly: nights (summed from 3.2's resolved rows, never re-choosing ranges) → add-on
  lines (D-46 limits) → subtotal → `pct(subtotal, vatBp)` → grand → `pct(grand, depositBp)` → balance by subtraction.
- PAY-02's example is case 1: subtotal 100000 fils, 500 bp, 3000 bp → VAT 5000, grand 105000, deposit 31500,
  balance 73500, printed as AED 50.00 / 1,050.00 / 315.00 / 735.00.
- B-21: arrival fewer than balance-due days away → deposit blocked `too_close_to_arrival`; exactly N days → allowed
  with the balance due today. Missing VAT % or deposit % → `settings_missing` (never 0); missing due days →
  `no_due_days`, full still open.
- No price, rate, VAT or deposit value lives in code. The only constant is Stripe's AED minimum, 200 fils, given in
  the plan.

## Task Commits

1. **Task 1: fils, rounding, percent parsing, dates (test first)**
   - RED `4a3ae2a` test(04-01): add failing tests for fils, rounding, percent parsing, dates and AED format
   - GREEN `ad444ad` feat(04-01): integer fils, the one pct rounding rule, percent text to basis points, ISO dates, formatAed
2. **Task 2: priceBooking (test first)**
   - RED `cd22634` test(04-01): add failing tests for priceBooking, cases 1-17 with 6b and a seeded property loop
   - GREEN `12347ae` feat(04-01): priceBooking, nights to grand to deposit or full in the signed order (B-05, B-21)

No refactor commit was needed.

## Files Created

- `lib/money/fils.ts` — `assertFils`, `pct`, `percentTextToBp` (decimal text or a JSON number, at most two decimals, 0..100), `MIN_CHARGE_FILS = 200`.
- `lib/money/dates.ts` — ISO-day helpers in UTC; `dubaiToday(now)` via `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" })`; the clock is a required argument.
- `lib/money/booking-price.ts` — `priceBooking` and the types `PriceInput`, `PriceResult`, `PriceSnapshot`, `PriceReason`, `DepositBlock`, `AddOnUnit`, `NightRate`, `AddOnOffer`, names and fields as in the plan's contract.
- `lib/money/format.ts` — `formatAed(fils)`: whole and fils parts by integer division, only the whole part grouped by `Intl.NumberFormat("en-US")`.
- `tests/booking-price.test.mjs` — 32 tests: 13 for Task 1, 19 for Task 2 (cases 1-17, 6b, block order, reasons together, caller errors, property loop).

## Verification (final code commit `12347ae`)

| Check | Result |
|---|---|
| `node --test tests/booking-price.test.mjs` | 32 tests, 32 pass, 0 fail |
| `node --test tests/*.test.mjs` | 735 tests, 731 pass, 0 fail, 4 skipped (environment-gated before this plan: `MEDIA_CHECK_OUT`, `media-staging/` absent) |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/phase-02-gates.test.mjs` | 4 pass, 0 fail |
| `grep -rnE "Math\.round\|toFixed\|parseFloat" lib/money` | nothing |
| `grep -rn "re_" lib/money` | nothing |
| enum / namespace in lib/money | none (erasable TypeScript only) |

Not run, as the plan and the controller said: Playwright, `npm run build`, `npm run tokens:check`. No CPU measurement (no server path in this plan).

## Decisions Made

See `key-decisions` above. Each fills a point the plan left open; none changes a signed decision.

## Deviations from Plan

### Auto-added (Rule 2, correctness)

**1. Caller-input checks that throw**
- **Found during:** Task 2
- **Issue:** The contract lists guest-facing reasons only; a malformed input from the server (negative or fractional guest counts, a non-ISO `today`, a repeated offer id, an unknown unit, a negative or fractional price, basis points outside 0..10000, negative or fractional due days, an unknown plan, a night with a rate but no source) had no defined outcome.
- **Fix:** `assertCallerInput` throws for each, like case 6b; a guest's choice never throws. Tested in "caller errors throw instead of pricing".
- **Files:** `lib/money/booking-price.ts`, `tests/booking-price.test.mjs` — commits `cd22634`, `12347ae`

**2. Night-row count checked before the nights are listed**
- **Issue:** Valid but far-apart dates would make `eachNight` build a long list before the mismatch is found.
- **Fix:** `priceNights` compares `nightRates.length` with `daysBetween(from, to)` first and throws on a mismatch.

### Interpretations where the plan was silent

- A refused deposit leaves the snapshot on plan `full` (see key-decisions). 04-02 stores a snapshot only when `ok`, so nothing stored depends on this.
- `daysBetween` divides two UTC midnights exactly instead of rounding, so the plan's `Math.round` ban holds in `lib/money`.

### Executor protocol

- The GSD per-commit allow-list for `worktree-agent-*` branches was not applied: the project's rules name this job's branch `gsd/phase-4-p01-money-engine`. The deny-list (never `main`) and the worktree-root check ran before every commit.

## Not done in this session

- **Fresh reviewer agent on the money diff** (00-common-rules, Models): this session has no tool to start a sub-agent. The job lead or the controller should have one read `git diff 777c6b0..HEAD -- lib/money tests/booking-price.test.mjs` before the hand-over.
- `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` not edited (work sessions do not edit them). Proposed for the controller at ship: plan 04-01 done 2026-10-05; PAY-01, PAY-02, PAY-03 money rules met in code (end-to-end payment still needs 04-02 to 04-05).
- Branch not pushed; no `HANDOVER.md` (per the controller's brief for this plan).

## Known Stubs

None.

## Threat Flags

None. No endpoint, file access or schema in this plan. T-04-01-01..04 are covered: quantities bounded and refused (cases 7-9), one `pct` with balance by subtraction (property loop), safe-integer throws (pct and assertFils tests), per-night source and range id in the snapshot (case 5).

## Next Phase Readiness

04-02 can import `priceBooking`, the types, `dubaiToday` and `MIN_CHARGE_FILS`; 04-03 and 04-05 can import `formatAed`. The owner still owes the balance-due days N (by Oct 9); until it is set, the deposit shows `no_due_days` and full payment stays open.

## Self-Check: PASSED

All five created files exist; commits 4a3ae2a, ad444ad, cd22634 and 12347ae are on the branch.
