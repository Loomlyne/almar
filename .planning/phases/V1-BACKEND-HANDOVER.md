# Job 12 hand-over — v1 backend plans (Phase 3.2, Phase 4, minimal ops)

**Branch:** `gsd/plan-v1-backend`, cut from `origin/main` `7076c2f`. Planning only: 0 files changed outside
`.planning/`. Final commit: the one that adds this file (see `git log -1`). Folder clean after it.
**Session:** job 12 work session (Opus 5.5), worktree `~/.t3/worktrees/almarprod-Website-Code/gsd-plan-v1-backend`.

## Signed by the owner (question form)

| When (+04) | What |
|---|---|
| 2026-10-04 22:10–22:29 | Discuss, 23 answers (`04-book-and-pay/V1-BACKEND-DISCUSSION-LOG.md`) |
| 2026-10-05 00:05–00:20 | 4 more answers after research: ops on `dashboard.almarprivatejourney.com`, served by a second Worker `almar-ops`; Adaptive Pricing on; arrival within the balance-due days → full payment only |
| 2026-10-05 ~01:16 | **Plans signed, one answer per phase:** "Sign 3.2", "Sign Phase 4", "Sign minimal ops" |

## What is in the branch

- CONTEXT: `03.2-real-catalog-and-team-inserted/03.2-CONTEXT.md` (C-01…C-23), `04-book-and-pay/04-CONTEXT.md`
  (B-01…B-22), `05-ops-os/05-CONTEXT.md` (O-01…O-09, the signed minimal-ops list).
- Research: `03.2-RESEARCH.md`, `04-RESEARCH.md`. Contract: `03.2-API-CONTRACT.md`.
- Plans: `03.2-01…15` (14 is a v1.1 stub), `04-01…07`, `05-01…02`. Owner's page: `V1-BACKEND-PLAN-SUMMARY.md`
  (waves, ships 3.2a/3.2b, which plans run side by side, shared files, owner steps, inputs owed).
- Plan checks (Opus): first pass per phase (3.2: 3 blockers; 4: 3 blockers; ops: 5 blockers), all fixed;
  second pass Phase 4 + ops (2 blockers, fixed); final cross-phase pass (2 blockers, 6 warnings, fixed by the
  lead). All 24 plan files pass `gsd-sdk verify.plan-structure`.

## Checks on this branch (code identical to `origin/main` `7076c2f`)

| Check | Result |
|---|---|
| `npm ci` | OK |
| `npx tsc --noEmit` | OK |
| `node --test tests/*.test.mjs` | 207 / 207 pass, 0 fail, 0 skipped |
| `npm run tokens:check` | OK |
| `npm run build` | OK |
| `npx playwright test --workers=4` (PW_PORT 3047), 01:20–01:49 | 1,126 passed, 28 skipped, **1 failed**: `tests/journey/visual.spec.ts:54` date-range-panel / past-days / es / 1440, `page.reload` hit the 30 s timeout (load, not an assertion) |
| Rerun of that file alone, `--workers=1`, 01:50–02:06 | **429 / 429 passed** |

## Not verified

- No plan has been executed; nothing is built, applied or deployed.
- Stripe facts not checkable without his TEST keys: Adaptive Pricing on his UAE account, Arabic inside Stripe's
  form, presentment amount recorded, session reuse after refresh (numbered checks in 04-07).
- Cloudflare Workers Builds deploy-hook response fields and build variable names; Workers AI Arabic quality (a
  3-text check in 03.2-10 Task 1, outputs shown to him); `btree_gist` on the hosted Supabase project
  (03.2-01 Wave 0 check); CPU per request on the Workers Free plan (measured after 3.2a wave 1).
- The npm legitimacy check for the Stripe packages could not run here (`pip` missing); 04-04 has a blocking
  manual check before install.

## Migrations (files only, written by the build sessions, never applied by them)

| File | Plan | Safe on live data |
|---|---|---|
| `20261005100000_catalog_and_team.sql` | 03.2-01 | New tables, views, functions only; touches no job 02 table except reading `profiles` for the owner check. Needs `btree_gist` |
| `20261005110000_bookings_and_ops.sql` | 04-02 | New tables and functions; `create or replace` of two 3.2 functions (`api_stay_blocked_days`, `ops_add_block`); adds `balance_due_days` to `site_settings` |
| `20261005120000_ops.sql` | 05-01 | **Second v1 file for Phase 4/ops (controller's next-hour rule):** five read/settings functions only |

The catalogue import (`scripts/import-catalog.mjs`, dry-run by default) is run by the controller with the service
key, after the last 3.3 slice that edits fixtures has landed.

## Environment names added by the plans (names only)

`ALMAR_DATA_SOURCE`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`BOOKING_LINK_SECRET`, `PUBLIC_ORIGIN` (almar-ops), the rebuild deploy-hook URL secret (03.2-05), bindings
`MEDIA` (R2 `almar-media`) and `AI` (Workers AI) on `almar-ops` only. Job 02's Supabase and Resend names reused.

## Proposed changes for the controller to apply (I did not edit these files)

- `ROADMAP.md`: 3.2 plans list (14 for v1, ships 3.2a/3.2b); 3.2 SC1 drop "Packages" as a booking catalogue (the
  journeys editor stays); Phase 4 plans 04-01…07 replacing the old 04-01…03; Phase 5 "v1 part" = 05-01, 05-02,
  rest v1.1.
- `REQUIREMENTS.md` traceability: PAY-05, PAY-13, PAY-15 lock, PAY-11, PAY-12 (button), ADDN-02 → v1.1; I18N-04,
  CMS-03, CMS-08, STAY-04, OPS-10 partial in v1; JOUR-05 editor → v1.1.
- `CONTROL-BOARD.md`: job 12 plans signed 2026-10-05 ~01:16; reserved numbers row (the three files above); new
  build jobs per lane (3.2a, 3.2b, 4, ops) and Worker `almar-ops`.
- `decisions/`: a file for the 27 answers and the three signatures (copy of the discussion log).
- `GOAL.md` "Done means" 5: receipt is a branded email (PDF v1.1); charge in AED with Stripe's local-currency
  display; damage hold v1.1.
- Plan 02-07's "no second Worker" is reversed by C-20 (owner, 2026-10-05).
- Job 02's `site_settings_public` is a security-definer view (Supabase lint 0010 error): fix in job 02 or 3.2-01.

## The owner's steps (one at a time, when the plan reaches them; details in each plan)

1. Supabase keys on both Workers and in `.env.local` (job 02's list).
2. Create Worker `almar-ops`, attach `dashboard.almarprivatejourney.com` (DNS), bind R2 `almar-media` and Workers AI.
3. Workers Builds on branch `live` and its deploy hook (rebuild on Publish).
4. Stripe TEST keys and webhook secrets (his existing UAE account); Adaptive Pricing on if offered.
5. Apple Pay domains (main, www, preview) in Stripe.
6. Resend domain for `inquiries@almarprivatejourney.com`.
7. `BOOKING_LINK_SECRET` on both Workers; `PUBLIC_ORIGIN` on `almar-ops` = preview while TEST.
8. After the first `almar-ops` CPU measurement: yes/no on the paid Workers plan.

## Inputs he owes by Oct 9

Real nightly rates and date ranges; prices and units for experiences and services, and which one is home pickup;
balance due days; booking terms text; the two team members' details and photos.

## His test steps

Each build plan carries its own numbered UAT; the end-to-end TEST payment is `04-07-PLAN.md` (TEST card first,
on `preview.almarprivatejourney.com`), the ops checks are in 05-01 Task 5 and 05-02 Task 4.

## Lessons from his corrections

- The discuss starts the same evening the job opens ("not Oct 5"): put the first questions to him as soon as
  they are ready, before finishing every read.
- Owner-gated answers can conflict with standing rules (automatic rebuild vs "deploy on his word"): ask the
  follow-up that keeps both (rebuild only from the `live` branch) instead of choosing for him.
