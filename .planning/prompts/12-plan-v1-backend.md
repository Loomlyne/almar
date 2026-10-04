# Job 12 — plan the v1 backend: Phase 3.2, Phase 4 and minimal ops (planning only)

Read `00-common-rules.md` first. You are a work session, not the controller. **No application code.**

**Why (owner, 2026-10-04 ~22:05):** v1 by 2026-10-14, scope "booking core" — `decisions/2026-10-04-ten-day-v1.md`.
Building 3.2 and Phase 4 side by side from Oct 7 needs their plans signed by then. You prepare all three phases so he
signs them in batched sittings.

**Branch:** `gsd/plan-v1-backend`, cut from `origin/main`:
`git fetch origin && git switch -c gsd/plan-v1-backend origin/main`
**Model:** Opus 5.5 High lead (database, money, auth). Plan checkers Opus.

## Inputs

- `ROADMAP.md` Phases 3.2, 4, 5; `REQUIREMENTS.md`; `PROJECT.md`; `.planning/decisions/`.
- `prompts/03-phase-3.2-catalog-and-team.md` (its "decisions that stand" still hold; its shape changed on
  2026-10-02: 3.2 swaps the `lib/data` fixtures for Supabase queries and builds the dashboard screens already wired).
- The `lib/data/<entity>.ts` contract on `origin/gsd/phase-3.3-slice-1` (Supabase shapes, fixtures behind it).
- Job 02 (auth) and job 10 (server runtime) branches: 3.2 and 4 build on them. Do not edit them.
- Tags `archive/phase-3.2-discuss` (`ff99fd5`, 12 decisions written before the 2026-10-02 reshape: re-read, reuse only
  what still fits).

## Steps

1. **One discuss sitting** for all three: `/gsd-discuss-phase` for 3.2, then 4, then "5-min" (minimal ops), through the
   question form, one decision per question, recommended option first. Never invent prices, rates, fees, refund or
   legal text: those are questions to him.
2. Minimal ops: propose the exact requirement list a paid booking needs (see the cut list in the decision); he signs
   the list. Everything else in Phase 5 is v1.1.
3. Plans for each phase; plan checker (Opus) on each; one signature per phase. Mark which plans of 3.2 and 4 can run
   side by side and which files they share.
4. Migrations written as files only, numbered after job 02's; never applied.
5. Hand-over per the common rules: branch tip, the signed CONTEXT and PLAN files, and the open inputs he owes by Oct 9.

Target: discuss done Oct 5, plans signed by Oct 6 evening.
