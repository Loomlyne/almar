# Job 17: close Phase 3.3 (public site in React)

Read first: `.planning/prompts/00-common-rules.md` and `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`. Owner order, 2026-10-21: finish 3.3, 2 and 3.2, each in its
own session, land and deploy them, then start Phase 4.

**Goal:** Phase 3.3 is complete with proof: every success criterion in `ROADMAP.md` (Phase 3.3) is met on code that is
on `main` or in this job's PR, `03.3-VERIFICATION.md` says so line by line, and the owner has a numbered UAT list for
the live site.

## What is already true (verify each)
- All 41 plans have summaries. The last open item is the Framer bridge removal (hero booker embed, Lato font route,
  `/fx`): branch `gsd/phase-3.3-close-bridge`, **PR #25** (`eff2727b`), verifier SHIP. The controller runs its landing
  lane after PR #24 lands.
- `uat-2026-10-04/` holds an earlier UAT.

## Steps
1. Work on `gsd/phase-3.3-close-bridge` (PR #25's branch) in your own app-made worktree; merge `origin/main` first
   (main wins). Push with `git push origin HEAD:gsd/phase-3.3-close-bridge`.
2. Run the GSD verifier for Phase 3.3 (`/gsd-verify-work 3.3` or a `gsd-verifier` agent) against `ROADMAP.md`'s
   3.3 criteria. Write `.planning/phases/03.3-public-site-in-react/03.3-VERIFICATION.md`: each criterion, the evidence
   (file, test, commit), PASS or GAP.
3. Close each GAP that is small and needs no new customer-facing design. Anything a customer sees needs pictures and
   the owner's signature first (through the controller). List bigger gaps for the controller instead of building them.
4. Write the owner UAT list: numbered type/click steps on https://almarprivatejourney.com with the expected result,
   EN/AR/ES where it matters. These steps run after the controller deploys.
5. Mark 3.3 criterion 5 and the phase in `ROADMAP.md` and `STATE.md` only once PR #25 has landed; until then propose
   the lines in the hand-over.

## Rules
- Heavy runs (dev server, Playwright, build, `wrangler dev`, a stack) each need the controller's go for that run. Ask
  by message. One lane on the Mac, `--workers=2` at most. Reading code and writing docs need no go.
- No push to `main`, no deploy, no hosted-database write. Never print a secret.
- **Hand-over:** commit name plus `HANDOVER-close.md` in the phase folder: checks with results, gaps closed, gaps
  left, UAT list, what was not verified. Message the controller, then stop.
