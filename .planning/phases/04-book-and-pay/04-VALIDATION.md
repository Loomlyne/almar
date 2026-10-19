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

Task IDs are filled by the planner (`04-NN-TT`). Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.

| Requirement | Behaviour | Plan | Test type | Automated command | File exists | Status |
|-------------|-----------|------|-----------|-------------------|-------------|--------|
| BOOK-01 | Book link → `/booking/trip` with stay, dates, guests; nothing charged | 04-03 | Playwright mocks + node | `npx playwright test tests/booking-trip.spec.ts --workers=2`; `node --test tests/booking-trip-state.test.mjs` | ❌ W0 | ⬜ |
| BOOK-02 | Stay → Add-ons → Travellers → Request, back until Request | 04-03, 04-06 | Playwright mocks | same spec | ❌ W0 | ⬜ |
| BOOK-03 | 30-minute hold timer; after Request nights held to the transfer deadline | 04-08, 04-03 | pgTAP + node | `node tests/helpers/local-supabase.mjs test`; `node --test tests/booking-request.test.mjs` | ❌ W0 | ⬜ |
| BOOK-04 | One destination per booking; second city → WhatsApp | 04-03 | node | `node --test tests/booking-trip-state.test.mjs` | ❌ W0 | ⬜ |
| BOOK-08, OPS-10 | Exact address and access only when Confirmed/Completed | 04-08, 04-05 | pgTAP + node | pgTAP `booking_view` rows; `node --test tests/booking-view.test.mjs` | ❌ W0 | ⬜ |
| STAY-01, STAY-02 | Reasons shown, never hidden; party within max | 04-03 (+ landed 04-02) | node + Playwright | `node --test tests/booking-api.test.mjs`; trip spec reasons | ✅ / ❌ W0 | ⬜ |
| JOUR-01..04 | UAE airport, home pickup default and address, inclusions kit | 04-03 | Playwright mocks | trip spec | ❌ W0 | ⬜ |
| ADDN-01 | Add-ons per night or per stay | landed 04-01/04-02 | node | `node --test tests/booking-price.test.mjs tests/booking-api.test.mjs` | ✅ | ⬜ |
| IDEN-01, IDEN-02 | Required fields, terms box, traveller lines | 04-03 (+ landed parsers) | node + Playwright | `node --test tests/booking-api.test.mjs`; trip spec | ✅ / ❌ W0 | ⬜ |
| PAY-01, PAY-02, PAY-03 | Breakdown order; VAT and deposit from Settings; deposit or full before Request | 04-03, 04-09 (+ landed 04-01) | node + Playwright | `node --test tests/booking-price.test.mjs`; trip spec; money settings spec | ✅ / ❌ W0 | ⬜ |
| PAY-05 | Coupon | none | deferred to v1.1 by 04-CONTEXT (B-05, :15, :127); ROADMAP/REQUIREMENTS traceability conflict goes to the controller | - | - | n/a |
| PAY-07 | No gift card, no BNPL anywhere | 04-03, 04-05 | node source test | `node --test tests/booking-no-bnpl.test.mjs` | ❌ W0 | ⬜ |
| PAY-10 | Balance by transfer with the same instructions on the booking page | 04-08, 04-05 | pgTAP + Playwright mocks | pgTAP instructions rows; `npx playwright test tests/booking-page.spec.ts --workers=2` | ❌ W0 | ⬜ |
| PAY-14 | `ALMAR-XXXXXX` | landed 04-02 | node | `node --test tests/booking-api.test.mjs` | ✅ | ⬜ |
| PAY-17 | Receipt after the owner records; resend; guest's language | 04-05, 04-09 | node | `node --test tests/booking-email.test.mjs` | ❌ W0 | ⬜ |
| PAY-18 | Bank details and transfer window owner-only; shown only with the signed link | 04-08, 04-09 | pgTAP + node | pgTAP anon/authenticated denials; `node --test tests/bank-details.test.mjs tests/booking-gate.test.mjs` | ❌ W0 | ⬜ |
| PAY-19 | Record and void, flags (part received, overpaid, written off, paid after expiry/cancel), idempotent, owner-only, logged | 04-08, 04-09 | pgTAP + DB node + node | pgTAP; `ALMAR_REQUIRE_STACK=1 node --test tests/ops-record-payment.db.test.mjs`; `node --test tests/payment-rules.test.mjs tests/ops-bookings-api.test.mjs` | ❌ W0 | ⬜ |
| PAY-20 | Unpaid request lapses on schedule, frees nights, guest emailed exactly once | 04-08, 04-05 | node + pgTAP + DB + build spec | `node --test tests/booking-lapse.test.mjs tests/ops-runtime.test.mjs`; pgTAP; `tests/booking-lapse.db.test.mjs`; build spec with `wrangler dev --test-scheduled` (`/cdn-cgi/local/scheduled`) | ❌ W0 | ⬜ |
| AUTH-01 | Request without an account; signed-in guest with that email sees it | 04-06 (+ landed 04-02) | node + Playwright | `node --test tests/booking-link.test.mjs tests/guest-bookings.test.mjs`; `tests/guest-bookings.spec.ts` | ✅ / ❌ W0 | ⬜ |
| OPS-04 | Bookings list search and filter (status, destination, dates) | 04-08, 04-09 | node + Playwright mocks | `node --test tests/ops-booking-rules.test.mjs`; `tests/ops-bookings.spec.ts` | ❌ W0 | ⬜ |
| OPS-13 | Booking page is the source of truth | 04-05 | Playwright mocks + build spec | `tests/booking-page.spec.ts`; `tests/build/booking-pages.spec.ts` | ❌ W0 | ⬜ |
| Server paths | `/api/booking/request`, `/api/booking/view`, `/api/ops/booking*`, `/api/ops/money` served on the right Worker only | 04-08, 04-09 | node + build spec | `node --test tests/server-runtime.test.mjs tests/ops-runtime.test.mjs`; `tests/build/server-runtime.spec.ts` | ✅ update | ⬜ |

---

## Wave 0 Requirements

- [ ] pgTAP file(s) for the new migration `20261019160000_*` (new files; `bookings-and-ops.test.sql`'s plan count untouched)
- [ ] `tests/bank-details.test.mjs`, `tests/booking-gate.test.mjs`, `tests/booking-request.test.mjs`, `tests/booking-lapse.test.mjs`, `tests/payment-rules.test.mjs`, `tests/booking-view.test.mjs`
- [ ] DB tests that take `acquireStackLock()` and wait for PostgREST after a reset
- [ ] build spec for the scheduled handler (`wrangler dev --test-scheduled`)
- [ ] pinned tests updated in the same commit as the files they pin (`04-PATTERNS.md` section 5)
- [ ] Framework install: none (no new package)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Resend delivery and rendering of every booking email in EN, AR (RTL), ES | PAY-17, PAY-20 | needs the Resend domain and a real inbox | 04-07 numbered UAT |
| Owner reads a real bank statement and records against it; void with reason | PAY-19 | owner's bank and judgement | 04-07 numbered UAT |
| Signature on every picture set | design gate | owner's signature | pictures checkpoints in 04-03, 04-09, 04-05, 04-06 |
| CPU time of request, view, record and one scheduled tick on preview | Free plan 10 ms | needs `wrangler tail` on a deployed Worker | 04-07, controller |
| Lapse of a real preview request with the test window | PAY-20 | needs the deployed cron | 04-07 numbered UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
