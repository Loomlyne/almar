---
phase: 4
slug: book-and-pay
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-19
---

# Phase 4 — Validation Strategy (Book and request, bank transfer)

> Per-phase validation contract for feedback sampling during execution. Source: `04-RESEARCH-BANK-TRANSFER.md`
> "Validation Architecture" (2026-10-19), corrected by `04-PATTERNS.md` F-13 (ops specs are flat files under `tests/`,
> pictures are a `describe("pictures")` block gated by a per-spec env var; there is no `tests/ops/` folder and no
> `ALMAR_PICTURES`). The Stripe-era section of `04-RESEARCH.md` no longer applies.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (pure modules, `.ts` loaded directly), pgTAP on the worktree's own local Supabase stack, Playwright 1.63 (dev config with `/api/*` mocked by `page.route`; build config on `wrangler dev`) |
| **Config file** | `playwright.config.ts`, `playwright.build.config.ts`, `tests/helpers/local-supabase.mjs` (the only way to start, reset, test or stop a stack) |
| **Quick run command** | `npx tsc --noEmit && node --test tests/<file>.test.mjs` (no slot go needed) |
| **DB run command** | `node tests/helpers/local-supabase.mjs test` (local stack: needs the controller's slot go) |
| **Full suite command** | the hand-over set in `.planning/prompts/00-common-rules.md`: `npm ci`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`, `npm run build`, `npx playwright test --workers=2` (controller's go; Mac rule: `--workers=2` at most) |
| **Estimated runtime** | quick < 60 s; DB about 3 min; full suite about 2 h in shards (controller's lane) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` and the task's own `node --test` file.
- **After every plan wave:** all `node --test tests/*.test.mjs`; the wave's pgTAP files; the wave's Playwright specs (controller's go for each run).
- **Before `/gsd-verify-work`:** full suite green on the PR tip, then the owner UAT in 04-07.
- **Max feedback latency:** 60 seconds for the quick run.

---

## Per-Requirement Verification Map

Task IDs are `04-NN-Tn` (plan, task number). Tests are written first inside each task (TDD), so "W0" means the file is
created by the task named. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Playwright, pgTAP and DB runs need the
controller's go for each run; `--workers=2` at most.

| Requirement | Behaviour | Task IDs | Test type | Automated command | File exists | Status |
|-------------|-----------|----------|-----------|-------------------|-------------|--------|
| BOOK-01 | Book link → `/booking/trip` with stay, dates, guests; nothing charged | 04-03-T3 | node + Playwright mocks | `node --test tests/booking-trip-state.test.mjs tests/phase-03-search.test.mjs`; `npx playwright test tests/booking-trip.spec.ts --grep "book and add-ons" --workers=2` | ❌ W0 (04-03-T1a, 04-03-T1b) | ⬜ |
| BOOK-02 | Stay → Add-ons → Travellers → Request, back until Request; send | 04-03-T3, 04-03-T4, 04-06-T3 | Playwright mocks + node | trip spec `--grep "book and add-ons\|travellers and request"`; `node --test tests/trip-request-state.test.mjs`; `npx playwright test tests/trip-request.spec.ts --workers=2` | ❌ W0 (04-03-T1a, 04-03-T1b, 04-06-T1a) | ⬜ |
| BOOK-03 | 30-minute hold timer; after Request nights held to the transfer deadline | 04-08-T1, 04-08-T4, 04-03-T4, 04-06-T3 | pgTAP + node + Playwright (`page.clock`) | `node tests/helpers/local-supabase.mjs test supabase/tests/booking-requests.test.sql`; `node --test tests/booking-request-api.test.mjs`; trip spec `--grep "travellers and request"`; `node --test tests/trip-request-state.test.mjs` (resume against view, send/end race) | ❌ W0 (04-08-T1, 04-08-T4, 04-06-T3) | ⬜ |
| BOOK-04 | One destination per booking; second city → WhatsApp | 04-03-T3 | node | `node --test tests/booking-trip-state.test.mjs` | ❌ W0 (04-03-T1a, 04-03-T1b) | ⬜ |
| BOOK-08, OPS-10 | Exact address and access only when Confirmed/Completed | 04-08-T1, 04-05-T2, 04-05-T5 | pgTAP + node + Playwright mocks | pgTAP `booking_view` rows in `booking-requests.test.sql`; `node --test tests/booking-page.test.mjs`; `npx playwright test tests/booking-page.spec.ts --grep behaviour --workers=2` | ❌ W0 (04-08-T1, 04-05-T2) | ⬜ |
| STAY-01, STAY-02 | Reasons shown, never hidden; party within max | 04-03-T3, 04-03-T4 (+ landed 04-02) | node + Playwright | `node --test tests/booking-api.test.mjs tests/booking-trip-state.test.mjs`; trip spec | ✅ / ❌ W0 | ⬜ |
| JOUR-01..04 | UAE airport, home pickup default and address, inclusions kit | 04-03-T3, 04-03-T4 | Playwright mocks | trip spec `--grep "book and add-ons\|travellers and request"` | ❌ W0 (04-03-T1a, 04-03-T1b) | ⬜ |
| ADDN-01 | Add-ons per night or per stay | landed 04-01/04-02; shown in 04-03-T3 | node | `node --test tests/booking-price.test.mjs tests/booking-api.test.mjs` | ✅ | ⬜ |
| IDEN-01, IDEN-02 | Required fields, terms box, traveller lines | 04-03-T4 (+ landed parsers) | node + Playwright | `node --test tests/booking-api.test.mjs tests/booking-trip-state.test.mjs` (hold body parity with `parseHoldRequest`); trip spec | ✅ / ❌ W0 | ⬜ |
| PAY-01, PAY-02, PAY-03 | Breakdown order; VAT and deposit from Settings; deposit or full before Request | 04-03-T3, 04-03-T4, 04-06-T3, 04-09-T3, 04-09-T8 (+ landed 04-01) | node + Playwright | `node --test tests/booking-price.test.mjs tests/ops-money-form.test.mjs`; trip spec; `npx playwright test tests/ops-money-settings.spec.ts --workers=2` | ✅ / ❌ W0 | ⬜ |
| PAY-05 | Coupon | none | deferred to v1.1 by 04-CONTEXT (B-05, :15, :127); no plan lists it in `requirements`; 04-03, 04-07, 04-08 and 04-09 record `requirements_deferred: [PAY-05]`; ROADMAP/REQUIREMENTS traceability fix is the controller's | - | - | n/a |
| PAY-07 | No gift card, no BNPL, no card form anywhere | 04-03-T1a, 04-03-T3, 04-05-T2, 04-06-T1a, 04-06-T1b, 04-06-T3, 04-08-T3, 04-08-T4 | node source test + grep gates | `node --test tests/booking-trip-state.test.mjs` (source-rules block over `lib/copy/journey.ts`, `components/journey/*`; `app/booking/trip/*` from 04-03-T3 on); 04-05's and 04-06's `grep -niE "stripe\|clientSecret\|…"` acceptance gates; 04-08's `grep -rniE "stripe\|checkout session"` over its TS files and migration | ❌ W0 (04-03-T1a) | ⬜ |
| PAY-10 | Balance by transfer with the same instructions on the booking page and receipt | 04-08-T1, 04-05-T1, 04-05-T5 | pgTAP + node + Playwright mocks | pgTAP `booking_transfer_instructions` rows; `node --test tests/booking-mail.test.mjs tests/booking-page.test.mjs`; booking-page spec | ❌ W0 (04-08-T1, 04-05-T1) | ⬜ |
| PAY-14 | `ALMAR-XXXXXX` | landed 04-02 | node | `node --test tests/booking-api.test.mjs` | ✅ | ⬜ |
| PAY-17 | Receipt after the owner records; resend; guest's language | 04-05-T1, 04-05-T4, 04-09-T5 | node | `node --test tests/booking-mail.test.mjs tests/booking-notifier.test.mjs tests/ops-bookings-api.test.mjs` | ❌ W0 (04-05-T1, 04-05-T4, 04-09-T5) | ⬜ |
| PAY-18 | Bank details and transfer window owner-only; shown only with the signed link | 04-08-T1, 04-08-T3, 04-09-T6, 04-09-T8 | pgTAP + node + Playwright mocks | pgTAP anon/authenticated denials in `booking-requests.test.sql`; `node --test tests/bank-details.test.mjs tests/booking-gate.test.mjs tests/ops-money-settings.test.mjs`; `npx playwright test tests/ops-money-settings.spec.ts --workers=2` | ❌ W0 (04-08-T1, 04-08-T3, 04-09-T6) | ⬜ |
| PAY-19 | Record and void, flags (part received, overpaid, written off, paid after expiry/cancel), idempotent, owner-only, logged | 04-08-T2, 04-09-T1, 04-09-T5, 04-09-T6, 04-09-T7 | pgTAP + DB node + node + Playwright mocks | `node tests/helpers/local-supabase.mjs test supabase/tests/booking-payments.test.sql`; `ALMAR_REQUIRE_STACK=1 node --test tests/booking-money.db.test.mjs tests/ops-record-payment.db.test.mjs`; `node --test tests/ops-booking-rules.test.mjs tests/ops-bookings-api.test.mjs`; `npx playwright test tests/ops-booking-detail.spec.ts --workers=2` | ❌ W0 (04-08-T2, 04-09-T1, 04-09-T5, 04-09-T6) | ⬜ |
| PAY-20 | Unpaid request lapses on schedule, frees nights, guest emailed exactly once | 04-08-T2, 04-08-T5, 04-05-T4 | pgTAP + node + build spec | pgTAP `claim_lapse_emails` / `finish_lapse_email` rows in `booking-payments.test.sql`; `node --test tests/booking-lapse.test.mjs tests/ops-runtime.test.mjs tests/booking-notifier.test.mjs`; `PW_TEST_SCHEDULED=1 npx playwright test -c playwright.build.config.ts tests/build/lapse-cron.spec.ts --workers=1` (`wrangler dev --test-scheduled`, `/cdn-cgi/local/scheduled`) | ❌ W0 (04-08-T2, 04-08-T5) | ⬜ |
| P-09 (owner 2026-10-20) | A request with a recorded payment never lapses: nights permanent from the first payment, kept past the deadline, flagged `deadline_passed_part_paid` once per deadline, no lapse email; the booking page keeps the bank details | 04-08-T1, 04-08-T2, 04-08-T5, 04-05-T2, 04-09-T1 | pgTAP + DB node + build spec + node | pgTAP lapse, record and void rows in `booking-payments.test.sql`, display and transfer rows in `booking-requests.test.sql`; `ALMAR_REQUIRE_STACK=1 node --test tests/booking-money.db.test.mjs`; lapse-cron spec part-paid case; `node --test tests/booking-page.test.mjs tests/ops-booking-rules.test.mjs` | ❌ W0 (04-08-T1, 04-08-T2, 04-08-T5) | ⬜ |
| P-19 (owner 2026-10-20) | The guest withdraws an unpaid request on the booking page: a confirm step, nights freed at once, one owner notice, no guest email; a part-paid request is refused and the page says to contact the owner | 04-08-T1, 04-08-T2, 04-08-T3, 04-08-T4, 04-05-T1, 04-05-T2, 04-05-T6 | pgTAP + DB node + node + Playwright mocks | pgTAP withdraw rows in `booking-requests.test.sql`; db race withdraw against record in `booking-money.db.test.mjs`; `node --test tests/booking-request-api.test.mjs tests/booking-api.test.mjs tests/booking-mail.test.mjs tests/booking-page.test.mjs`; booking-page spec (withdraw pictures in 04-05-T2, the withdraw flow block in 04-05-T6); routes db withdraw end to end | ❌ W0 (04-08-T1, 04-08-T4, 04-05-T2, 04-05-T6) | ⬜ |
| P-21 (owner 2026-10-20) | `cancel_first`: no void takes a confirmed or completed booking below its deposit, on any plan (full plan: half-up pct of grand at the stored deposit_bp; 0 % gives 0) | 04-08-T2, 04-09-T1, 04-09-T6 | pgTAP + node + DB node | pgTAP `booking_deposit_floor` and void rows in `booking-payments.test.sql`; `node --test tests/ops-booking-rules.test.mjs` (void preview); `ALMAR_REQUIRE_STACK=1 node --test tests/ops-record-payment.db.test.mjs` (parity grid against `booking_deposit_floor`) | ❌ W0 (04-08-T2, 04-09-T1) | ⬜ |
| AUTH-01 | Request without an account; signed-in guest with that email sees it | 04-06-T3, 04-06-T4, 04-08-T4 (+ landed 04-02) | node + Playwright | `node --test tests/booking-link.test.mjs tests/guest-bookings.test.mjs`; `npx playwright test tests/guest-bookings.spec.ts --workers=2` | ✅ / ❌ W0 (04-06-T4) | ⬜ |
| OPS-04 | Bookings list search and filter (status, destination, dates) | 04-08-T2, 04-09-T1, 04-09-T7 | pgTAP + node + Playwright mocks | pgTAP `ops_list_bookings` rows; `node --test tests/ops-booking-rules.test.mjs`; `npx playwright test tests/ops-bookings.spec.ts --workers=2` | ❌ W0 (04-09-T1, 04-09-T2) | ⬜ |
| OPS-13 | Booking page is the source of truth | 04-05-T2, 04-05-T5 | Playwright mocks + build spec | `tests/booking-page.spec.ts`; `tests/build/booking-pages.spec.ts` (controller lane) | ❌ W0 (04-05-T2, 04-05-T5) | ⬜ |
| Server paths | `/api/booking/request`, `/api/booking/view`, `/api/booking/withdraw`, `/api/ops/booking*`, `/api/ops/money` served on the right Worker only; cron on `almar-ops` only | 04-08-T4, 04-08-T5, 04-09-T5, 04-09-T6 | node + build spec | `node --test tests/server-runtime.test.mjs tests/ops-runtime.test.mjs tests/ops-route.test.mjs`; `tests/build/server-runtime.spec.ts`, `tests/build/ops-api.spec.ts` (controller lane) | ✅ update | ⬜ |
| Whole path | Owner UAT on preview + dashboard; CPU per path | 04-07-T1, 04-07-T2, 04-07-T3 | manual + read-back | numbered UAT; `04-07-SUMMARY.md` grep in 04-07-T3 | - | ⬜ |

---

## Wave 0 Requirements

Created test-first inside the task named (no separate Wave 0 plan):

- [ ] pgTAP `supabase/tests/booking-requests.test.sql` (04-08-T1) and `supabase/tests/booking-payments.test.sql` (04-08-T2) for `20261019160000_booking_requests.sql`; `bookings-and-ops.test.sql`'s plan count untouched
- [ ] 04-08: `tests/bank-details.test.mjs`, `tests/booking-gate.test.mjs` (T3), `tests/booking-request-api.test.mjs` (T4), `tests/booking-lapse.test.mjs` (T5), `tests/booking-money.db.test.mjs` (T2), `tests/build/lapse-cron.spec.ts` (T5)
- [ ] 04-09: `tests/ops-booking-rules.test.mjs`, `tests/ops-money-form.test.mjs` (T1), `tests/ops-bookings-api.test.mjs` (T5), `tests/ops-money-settings.test.mjs`, `tests/ops-record-payment.db.test.mjs` (T6), specs `tests/ops-bookings.spec.ts`, `tests/ops-booking-detail.spec.ts`, `tests/ops-money-settings.spec.ts` (T2, T3); pinned `tests/phase-03-dashboard.spec.ts` rewritten in T7
- [ ] 04-05: `tests/booking-mail.test.mjs` (T1), `tests/booking-page.test.mjs` (T2), `tests/booking-notifier.test.mjs` (T4), specs `tests/booking-emails.spec.ts`, `tests/booking-page.spec.ts`, `tests/build/booking-pages.spec.ts`
- [ ] 04-03: `tests/booking-trip-state.test.mjs` (T1a), `tests/booking-trip.spec.ts` (T1b); pinned `tests/phase-03-search.test.mjs`, `tests/phase-03-guest.test.mjs` rewritten in T3
- [ ] 04-06: `tests/trip-request-state.test.mjs` (T3), `tests/guest-bookings.test.mjs` (T4), specs `tests/trip-request.spec.ts` (T1a), `tests/guest-bookings.spec.ts` (T1b)
- [ ] DB tests take `acquireStackLock()` and wait for PostgREST after a reset
- [ ] pinned tests updated in the same commit as the files they pin (`04-PATTERNS.md` section 5)
- [ ] Framework install: none (no new package)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Resend delivery and rendering of every booking email in EN, AR (RTL), ES | PAY-17, PAY-20 | needs the Resend domain and a real inbox | 04-07 numbered UAT |
| Owner reads a real bank statement and records against it; void with reason | PAY-19 | owner's bank and judgement | 04-07 numbered UAT |
| Signature on every picture set | design gate | owner's signature | pictures checkpoints 04-03-T2, 04-09-T4, 04-05-T3, 04-06-T2 |
| CPU time of request, view, record and one scheduled tick on preview | Free plan 10 ms | needs `wrangler tail` on a deployed Worker | 04-07, controller |
| Lapse of a real preview request with the test window | PAY-20 | needs the deployed cron | 04-07 numbered UAT |
| A part-paid preview request kept and flagged after its deadline; a guest withdraw with its confirm step and the owner notice | P-09, P-19 | needs the deployed cron, Resend and the owner's eyes | 04-07 numbered UAT (Withdraw and part-paid steps) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
