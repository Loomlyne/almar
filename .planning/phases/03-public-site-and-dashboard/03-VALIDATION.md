---
phase: 3
slug: public-site-and-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner, plus Playwright 1.63.0 |
| **Config file** | `playwright.config.ts` (port 3010). No jest, no vitest. |
| **Quick run command** | `node --test tests/phase-03-fx.test.mjs tests/phase-03-newsletter.test.mjs tests/phase-03-screens.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | 90 seconds |

`npm test` runs `tests/design-tokens.test.mjs` and then Playwright, which starts `next dev` on 127.0.0.1:3010. Do not point tests at port 3000.

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/phase-03-fx.test.mjs tests/phase-03-newsletter.test.mjs tests/phase-03-screens.test.mjs`
- **After every plan wave:** Run `npx playwright test tests/phase-03-screens.spec.ts tests/phase-03-dashboard.spec.ts`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | D-63 | T-03-01 | FX body is parsed to two numbers. Never written as HTML. | unit | `node --test tests/phase-03-fx.test.mjs` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | D-66 | T-03-02 | Newsletter rejects a filled honeypot and does not succeed without a contact id. | unit | `node --test tests/phase-03-newsletter.test.mjs` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | D-52 | T-03-03 | `/` stays a route handler. New screens 404 in production. | unit | `node --test tests/phase-03-screens.test.mjs` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | D-62 | T-03-04 | Search opens only `/booking/trip` with known query keys. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | D-64 | — | Arabic sets `dir=rtl`. URL unchanged. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | D-65 | — | WhatsApp href is `https://wa.me/971563883302`. Absent on `/design`. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | D-13 | — | Sidebar does not shrink the page under it. | e2e | `npx playwright test tests/phase-03-dashboard.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase-03-fx.test.mjs` — parses `$` as USD, leaves written AED alone, does not throw a guest string
- [ ] `tests/phase-03-newsletter.test.mjs` — rejects the honeypot, does not succeed without a contact id, does not read a key from the repo
- [ ] `tests/phase-03-screens.test.mjs` — no `app/page.tsx`, no seed rows, `/` still a route handler
- [ ] `tests/phase-03-screens.spec.ts` — Search, language `dir`, WhatsApp, no WhatsApp on `/design`
- [ ] `tests/phase-03-dashboard.spec.ts` — empty lists, one sidebar
- [ ] No framework install. Playwright and `node --test` are already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/framer` still matches the Framer home under the header and booking bar | D-51 | A pixel diff against Framer is not a test | Open `http://127.0.0.1:3010/framer` and confirm the hero, header, and bar |
| Arabic and Spanish copy | D-64 | Owner corrects the wording | Switch language and read one screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
