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
  - "lib/money/fils.ts: assertFils, pct (the one half-up rounding rule), percentTextToBp, MIN_CHARGE_FILS, MAX_AMOUNT_FILS"
  - "lib/money/dates.ts: isIsoDate, addDays, daysBetween, eachNight, dubaiToday"
  - "lib/money/booking-price.ts: priceBooking and the exported contract types"
  - "lib/money/format.ts: formatAed (display only)"
affects: [04-02, 04-03, 04-05, 05-02]

tech-stack:
  added: []
  patterns:
    - "Every amount is an integer of fils; every percentage goes through pct(); balance by subtraction"
    - "Anything from the browser (picks, guest totals, the amounts they drive) is a reason; a malformed server input throws"

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
  - "settings_missing, too_large (guests) and no_rate are returned together when they apply; dates_invalid returns alone"
  - "Zero-quantity picks are dropped before repeated ids are counted; a malformed pick is refused even at quantity 0"
  - "pct keeps the plan's formula floor((a * bp + 5000) / 10000): with a safe product the quotient is under 2^40, where a correctly rounded division cannot cross a whole number, so it is exact (BigInt-checked in the tests)"
  - "Round 2: PriceReason gains { code: \"too_large\"; field: \"guests\" | \"amount\"; max }. Technical bounds only: guest total within Number.MAX_SAFE_INTEGER; nights, add-on lines and subtotal within MAX_AMOUNT_FILS = 450,359,962,736 fils, the largest subtotal whose VAT and deposit stay exact in pct(). No business cap in the engine."

patterns-established:
  - "Money modules in lib/money import only each other; no environment, no network, the clock is passed in"

requirements-completed: [PAY-01, PAY-02, PAY-03]

duration: 8min + round 2
completed: 2026-10-05
---

# Phase 4 Plan 01: Money engine Summary

**Integer-fils booking price in lib/money: nights, add-ons, subtotal, VAT once, grand, deposit or full with balance and due date, B-21's full-only rule, one half-up pct() rounding rule; 36 node tests including PAY-02's own example and 5,000 seeded whole-booking draws against a BigInt reference.**

## Performance

- **Round 1:** 2026-10-05T01:52:54Z – 02:00:08Z (05:52–06:00 +04), about 8 min, tasks 1–2.
- **Round 2 (review fixes WR-01..03):** finished 2026-10-05T02:20:20Z (06:20 +04).
- **Tasks:** 2 of 2, plus round 2. Each step was a failing-test commit, then a passing-code commit.
- **Files created:** 5

## Accomplishments

- `priceBooking` follows B-05 exactly: nights (summed from 3.2's resolved rows, never re-choosing ranges) → add-on
  lines (D-46 limits) → subtotal → `pct(subtotal, vatBp)` → grand → `pct(grand, depositBp)` → balance by subtraction.
- PAY-02's example is case 1: subtotal 100000 fils, 500 bp, 3000 bp → VAT 5000, grand 105000, deposit 31500,
  balance 73500, printed as AED 50.00 / 1,050.00 / 315.00 / 735.00.
- B-21: arrival fewer than balance-due days away → deposit blocked `too_close_to_arrival`; exactly N days → allowed
  with the balance due today. Missing VAT % or deposit % → `settings_missing` (never 0); missing due days →
  `no_due_days`, full still open.
- Browser data never throws: malformed picks are `addon_unavailable`, an inexact guest total or amount is `too_large`.
- No price, rate, VAT or deposit value lives in code. The only constants are Stripe's AED minimum (200 fils, given in
  the plan) and the technical amount bound derived from `Number.MAX_SAFE_INTEGER`.

## Task Commits

1. **Task 1: fils, rounding, percent parsing, dates (test first)**
   - RED `4a3ae2a` test(04-01): add failing tests for fils, rounding, percent parsing, dates and AED format
   - GREEN `ad444ad` feat(04-01): integer fils, the one pct rounding rule, percent text to basis points, ISO dates, formatAed
2. **Task 2: priceBooking (test first)**
   - RED `cd22634` test(04-01): add failing tests for priceBooking, cases 1-17 with 6b and a seeded property loop
   - GREEN `12347ae` feat(04-01): priceBooking, nights to grand to deposit or full in the signed order (B-05, B-21)
3. **Round 2: review should-fixes WR-01, WR-02, WR-03**
   - RED `bbf7fcb` test(04-01): failing tests for malformed picks, unbounded guests and amounts; whole-booking property loop
   - GREEN `8ba9753` fix(04-01): malformed picks are reasons; guest total and amounts bounded for exact arithmetic

Round-1 summary: `46b3e87`.

## Files Created

- `lib/money/fils.ts` — `assertFils`, `pct`, `percentTextToBp` (decimal text or a JSON number, at most two decimals, 0..100), `MIN_CHARGE_FILS = 200`, `MAX_AMOUNT_FILS = floor((MAX_SAFE_INTEGER − 5000) / 20000)`.
- `lib/money/dates.ts` — ISO-day helpers in UTC; `dubaiToday(now)` via `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" })`; the clock is a required argument.
- `lib/money/booking-price.ts` — `priceBooking` and the types `PriceInput`, `PriceResult`, `PriceSnapshot`, `PriceReason`, `DepositBlock`, `AddOnUnit`, `NightRate`, `AddOnOffer`. Names and fields are the plan's contract, plus round 2's `too_large` reason.
- `lib/money/format.ts` — `formatAed(fils)`: whole and fils parts by integer division, only the whole part grouped by `Intl.NumberFormat("en-US")`.
- `tests/booking-price.test.mjs` — 36 tests: 13 for Task 1; 23 for the engine (cases 1–16, 6b, block order, reasons together, caller errors, WR-01, two WR-02 tests, case 17 loop, case 17 edges).

## Round 2: review fixes (Fable 5.1 review of `46b3e87`)

**WR-01, malformed picks.** Each pick element that is null, not an object, or has a non-string id is now
`addon_unavailable` with `id: String(id)`. For a non-object element, the element itself is used as the id: `null`
becomes "null" and `7` becomes "7". These are deduplicated and kept in the order received, and a good pick beside a
bad one is still priced. `picks` itself must still be an array, otherwise the engine throws: 04-02 builds it from its
parsed body (see the contract notes). Proof: test "WR-01" (6 shapes, a mixed list, and non-array `picks` throwing).
It failed at `bbf7fcb` and passes at `8ba9753`. Mutants R1 (check removed) and R5 (id not `String()`) are killed.

**WR-02, unbounded counts.** The guest total is summed with `addWithin` up to `Number.MAX_SAFE_INTEGER`. Beyond that
the result is `{ code: "too_large", field: "guests", max: MAX_SAFE_INTEGER }` with no snapshot. `maxQuantity` now
takes that checked total. Nights, every add-on line and the subtotal are summed up to `MAX_AMOUNT_FILS`
(450,359,962,736 fils). Beyond that the result is `{ code: "too_large", field: "amount", max }` with no snapshot. The
bound is technical: VAT is at most 100 %, so the grand total is at most twice the subtotal, and `pct(grand, bp)` must
stay a safe integer. Every `pct()` after the subtotal is therefore exact, and no unsafe sum is ever formed.
- There is no business cap in the engine. 04-02's request check (adults 1..99, children and infants 0..99) is the
  business bound. The reviewer's "adults 1e8 quotes 10.5M AED" is still priced by the engine; 04-02 refuses that
  request before calling it.
- Nights have no separate engine bound. Valid ISO dates already limit them, products are covered by the amount bound,
  and the row-count check throws before `eachNight` runs on a long range.
- Proof: two "WR-02" tests cover 2 guest shapes, 6 amount shapes and the exact-bound pricing. They failed at
  `bbf7fcb` (a RangeError or a wrong ok) and pass at `8ba9753`. Mutants R2, R3 and R4 are killed.

**WR-03, property loop.** Case 17 now runs 5,000 draws. Each draw has 1–5 nights with their own rates (range and base
sources mixed), 0–3 add-ons of every unit with quantity in {max, max−1, max+1, 0}, a lead time in {N−1, N, N+1, 0}
with N in {null, 0, 1, 7, 30, 60, 1..120}, and four "today" values across month, year and leap boundaries. Each draw
is checked against a BigInt reference written in the test. Dates are worked out with `Date.UTC`, not
`lib/money/dates.ts`. The whole snapshot is compared: nights, lines, addons, subtotal, vat, grand, deposit, balance,
balanceDueDate, depositBlock, the plan fields, and the reasons in order. The loop also asserts its own coverage: all
three units, lead before, at and after N, all five deposit-block states, and VAT on add-ons more than 1,000 times. The
draw helper uses the high bits, because a power-of-two LCG's low bits repeat with a short period; the first version
reached only "lead after N". The old extreme one-night draws stay as "case 17 edges".
- Mutation proof, using the case 17 tests alone (`--test-name-pattern "case 17"`): M1 "VAT on nights only" is killed
  and M5 "B-21 `<=`" is killed. The loop alone kills 15 of 20 arithmetic mutants, both before and after the fix.

**Mutation run on `8ba9753`.** I ran the reviewer's 20 mutants, adapted to the new lines, plus 5 for round 2. The
whole test file kills 21 of 25. The four survivors are equivalent mutants:
- M12 (`floor(x/10000 + 0.5)`) and M18 (`Math.round`): with a product under 2^53, no input tells them apart from the
  exact rule. 30,000,000 worst-case inputs at the top of the safe range were checked; the plan's grep bans `Math.round`.
- M19 (no per-line bound) and M20 (nights summed unbounded): the subtotal bound catches the same overflow.

**Reviewer fuzzer** (`fuzz.mjs` run on `8ba9753` in a scratch copy, seed 64222): 120,000 draws, 0 failures, 0 throws.

**IN-02, 100 % or 99.99 % deposit.** These report `balance_below_minimum`, which is literally true: the balance is
0 or under 200 fils. The plan's `DepositBlock` has exactly four causes, so no `zero_balance` was added. 04-03 shows
the same "Deposit isn't available for this booking." text for every cause except `too_close_to_arrival`, so the guest
sees no difference. Adding a fifth cause is the planner's call.

**IN-01, owner question.** B-21 as signed is "arrival sooner than N days → full only" (`<`). At exactly N days the
deposit is allowed and the balance falls due the same day as the booking. Should exactly N days also be full-only
(`<=`)? Unchanged until he answers.

## Contract notes for 04-02

1. Map `too_large` (`field` "guests" | "amount", `max`) into `BookingReason`. 04-02's `ReasonCode` list must gain
   "too_large", or 04-02 maps it to "invalid" with the same `field`. `BookingReason` already has `field` and `max`.
   With 04-02's own request bounds it cannot occur in practice.
2. `picks` must be an array: map `addons` only after `parseQuoteRequest` has accepted it. Malformed elements are
   fine; they become reasons.
3. IN-04: `percentTextToBp(null)` throws. Map a null `vat_bp`, `deposit_bp` or `balance_due_days` settings value to
   `null` before calling (the engine then answers `settings_missing` or `no_due_days`). Never pass null to
   `percentTextToBp`. `booking_context` already sends integer basis points; `percentTextToBp` is for text settings.
4. Beyond 366 nights, `booking_context` returns empty `night_rates`. 04-02 must answer `dates_invalid` itself and not
   call `priceBooking`, because the engine throws on a row count that does not match the stay (case 6b).
5. Guest counts must be non-negative integers (04-02's request check). A fraction or a negative count reaching the
   engine is a programming error and throws.

## Verification (final code commit `8ba9753`)

| Check | Result |
|---|---|
| `node --test tests/booking-price.test.mjs` | 36 tests, 36 pass, 0 fail |
| `node --test tests/*.test.mjs` | 739 tests, 735 pass, 0 fail, 4 skipped (environment-gated before this plan: `MEDIA_CHECK_OUT`, `media-staging/` absent) |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/phase-02-gates.test.mjs` | 4 pass, 0 fail |
| `grep -rnE "Math\.round\|toFixed\|parseFloat" lib/money` | nothing |
| `grep -rn "re_" lib/money` | nothing |
| enum / namespace in lib/money | none (erasable TypeScript only) |
| Mutants (25) / reviewer fuzzer (120,000) | 21 killed, 4 equivalent / 0 failures |

Not run, as the plan and the controller said: Playwright, `npm run build`, `npm run tokens:check`. No CPU
measurement (no server path in this plan).

## Deviations from Plan

### Auto-added (Rule 2, correctness)

**1. Caller-input checks that throw.** A malformed server input throws, like case 6b. This covers negative or
fractional guest counts, a non-ISO `today`, a repeated offer id, an unknown unit, a bad price, basis points outside
0..10000, bad due days, an unknown plan, a night with a rate but no source, and `picks` not an array. Since round 2,
pick elements are not in this list: they are reasons.

**2. Night-row count checked before the nights are listed,** so a long range never builds a long list.

**3. Round 2 contract addition:** `PriceReason` gains `too_large`, at the reviewer's request (WR-02). This is
additive; 04-02 maps it (contract note 1).

### Interpretations where the plan was silent

- A refused deposit leaves the snapshot on plan `full` (see key-decisions). 04-02 stores a snapshot only when `ok`.
- `daysBetween` divides two UTC midnights exactly instead of rounding, so the plan's `Math.round` ban holds.

### Executor protocol

- The GSD per-commit allow-list for `worktree-agent-*` branches was not applied: the project's rules name this
  job's branch `gsd/phase-4-p01-money-engine`. The deny-list (never `main`) and the worktree-root check ran before
  every commit.

## Not done in this session

- `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` not edited (work sessions do not edit them). Proposed for the
  controller at ship: plan 04-01 done 2026-10-05; the PAY-01, PAY-02 and PAY-03 money rules are met in code
  (end-to-end payment still needs 04-02 to 04-05).
- Branch not pushed; no `HANDOVER.md` (per the controller's brief for this plan).
- The round-2 diff (`46b3e87..8ba9753`) has not had a fresh reviewer; the round-1 diff had Fable 5.1.

## Known Stubs

None.

## Threat Flags

None. No endpoint, file access or schema in this plan. T-04-01-01..04 are covered: quantities bounded and refused
(cases 7–9), malformed picks refused (WR-01), one `pct` with balance by subtraction (property loop), overflow answered
as `too_large` instead of a wrong rounding or a throw (WR-02), and per-night source and range id in the snapshot
(case 5).

## Next Phase Readiness

04-02 can import `priceBooking`, the types, `dubaiToday`, `MIN_CHARGE_FILS` and `MAX_AMOUNT_FILS`; 04-03 and 04-05
can import `formatAed`. The owner still owes the balance-due days N (by Oct 9). Until it is set, the deposit shows
`no_due_days` and full payment stays open. Open owner question: IN-01.

## Self-Check: PASSED

All five created files exist. Commits 4a3ae2a, ad444ad, cd22634, 12347ae, 46b3e87, bbf7fcb and 8ba9753 are on the
branch.
