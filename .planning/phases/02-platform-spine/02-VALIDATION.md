---
phase: 02
slug: platform-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-25
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright 1.63.0 |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `node --test tests/design-tokens.test.mjs` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/design-tokens.test.mjs`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PLAT-01 | — | Checkout unchanged before the human gate | unit | `node -e` reads package.json and wrangler.toml | ✅ exists | ⬜ pending |
| 02-08-01 | 08 | 2 | PLAT-01 | — | Server runtime config, no deploy | unit | `node --test tests/host-config.test.mjs` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 3 | AUTH-02 | T-02-01 | Magic link, no password | unit | `node --test tests/auth-magic-link.test.mjs` | ❌ W0 | ⬜ pending |
| 02-09-01 | 09 | 6 | I18N-03 | — | Full string map, one middleware boundary | unit | `node --test tests/framer-inject.test.mjs` | ❌ W0 | ⬜ pending |
| 02-10-01 | 10 | 8 | I18N-02 | — | $ is USD. Written AED stays AED | unit | `node --test tests/fx.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth-magic-link.test.mjs` — AUTH-02
- [ ] `tests/auth-owner.test.mjs` — AUTH-05
- [ ] `tests/host-gate.test.mjs` — AUTH-06, OPS-01
- [ ] `tests/locale.test.mjs` — I18N-01
- [ ] `tests/fx.test.mjs` — I18N-02
- [ ] `tests/auth-i18n.spec.ts` — AUTH-07
- [ ] `tests/phase-02-gates.test.mjs` — repo guard for Plan 02-01 and Plan 02-07. Human gates stay manual.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Package identity and Supabase create | PLAT-01 | Human gate. The repo guard only proves the checkout did not change | `node --test tests/phase-02-gates.test.mjs` then wait for approved |
| Ops host, runtime apply, and R2 | OPS-01, PLAT-02 | DNS and bucket create are owner-gated. skipped is not done | After the gate, open the host logged out and confirm the title is Sign in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
