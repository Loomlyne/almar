---
phase: 01
slug: design-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` Validation Architecture. Plans do not exist yet — task IDs are assigned when PLAN.md is written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed. Wave 0 adds Node's built-in test runner for static checks, plus `@playwright/test@1.63.0` for interaction. Do not add Jest or Vitest. |
| **Config file** | none — Wave 0 installs `playwright.config.ts` |
| **Quick run command** | `node --test tests/design-tokens.test.mjs` |
| **Full suite command** | `node --test tests/design-tokens.test.mjs && npx playwright test && npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/design-tokens.test.mjs`
- **After every plan wave:** Run `node --test tests/design-tokens.test.mjs && npx playwright test && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds for the quick command; full suite may take ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0-01 | TBD | 0 | DSGN-02 | — | Token file exists and bans Bricolage, `#f9f6f3` as a token, and `outline: none` without `:focus-visible` | unit | `node --test tests/design-tokens.test.mjs` | ❌ W0 | ⬜ pending |
| W0-02 | TBD | 0 | DSGN-01 | T-01-01 | `/design` is not a public production URL (`notFound()` in production) | e2e | `npx playwright test tests/design-page.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-01 | — | `/design` in dev lists every required control and state | e2e | `npx playwright test tests/design-page.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-02 | — | Computed styles use `#1f3b40`, `#262626`, `#d4ba8a`, `#fffaf0`; Questa/Lato; no dark class | unit + e2e | `node --test tests/design-tokens.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-03 | — | Arabic preview sets `html[dir=rtl]`; eye sits on inline-end; no `margin-left` in `components/` | unit + e2e | `npx playwright test tests/design-rtl.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-05 | T-01-02 | Icons are inline SVG with `currentColor`; icon-only controls have an accessible name; no `dangerouslySetInnerHTML` | e2e | `npx playwright test tests/design-a11y.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-06 | T-01-04 | Unknown path returns 404, body has no Bricolage, monogram and one hardcoded `/` home link | e2e | `npx playwright test tests/not-found.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | DSGN-07 | — | Video specimen is `muted` and pauses when scrolled off-screen | e2e | `npx playwright test tests/design-video.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | PLAT-05 | — | Tab reaches every control; `:focus-visible` ring is visible; field error is under the label; alt text differs in the AR preview | e2e | `npx playwright test tests/design-a11y.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Threats that are not a test row: T-01-03 CSS injection via token publish is Phase 5 (DSGN-04), out of scope. T-01-05 Framer HTML must not be edited except deleting `app/[...not_found]/route.ts` after `not-found.tsx` works — the planner's verify step must prove `/contact` still serves Framer HTML.

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `webServer` runs `npm run dev`, `baseURL` `http://127.0.0.1:3000`, chromium only for the quick loop
- [ ] `tests/design-tokens.test.mjs` — DSGN-02, DSGN-06 string bans, logical-CSS grep
- [ ] `tests/design-page.spec.ts` — DSGN-01 inventory
- [ ] `tests/design-rtl.spec.ts` — DSGN-03
- [ ] `tests/design-a11y.spec.ts` — DSGN-05, PLAT-05
- [ ] `tests/not-found.spec.ts` — DSGN-06 status and body
- [ ] `tests/design-video.spec.ts` — DSGN-07
- [ ] Framework install: `npm install -D @playwright/test@1.63.0 && npx playwright install chromium`
- [ ] `package.json` script `"test": "node --test tests/design-tokens.test.mjs && playwright test"` — do not invent this script until Wave 0 adds it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production build returns 404 for `/design` | DSGN-01 / T-01-01 | Playwright quick loop uses `next dev`. Production `notFound()` is a separate build. | `npm run build`, start the production server, open `/design`, expect 404. Dev `/design` must still render the kit. |

All other phase behaviors in the map have an automated command once Wave 0 files exist.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for the quick command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
