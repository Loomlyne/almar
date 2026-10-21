# Job 18: close Phase 2 (platform spine)

Read first: `.planning/prompts/00-common-rules.md` and `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`. Owner order, 2026-10-21: finish 3.3, 2 and 3.2, each in its
own session, land and deploy them, then start Phase 4.

**Goal:** Phase 2 is complete with proof: every success criterion in `ROADMAP.md` (Phase 2) is met on code that is on
`main` or in an open PR, `02-VERIFICATION.md` says so line by line, and the owner has a numbered UAT list for the live
site and the dashboard.

## What is already true (verify each)
- 15 of 17 plans have summaries. **02-09 and 02-10 were superseded** (commit `4be0541f`: no more Framer HTML patching;
  Phase 3.3 replaced the Framer pages). They have no summary file, so GSD counts the phase as partial.
- **PR #24** (`claude/sign-in-option-a`, `af024bf`): sign-in form option A; the dashboard's `/login` redirects GET and
  HEAD only. Verifier SHIP. Its landing lane is running in the controller now.
- Open question for the owner, carried here: sign-ups are disabled, yet the sign-in screen says "New here?". The
  controller asks it with pictures; propose the options.

## Steps
1. Cut `gsd/phase-02-close` from `origin/main` in your own app-made worktree. Push with
   `git push origin HEAD:gsd/phase-02-close`.
2. Add a short `02-09-SUMMARY.md` and `02-10-SUMMARY.md` that say "superseded", by which commit and decision, and
   what replaced them (requirement IDs I18N-01, I18N-02: where they are met now).
3. Run the GSD verifier for Phase 2 (`/gsd-verify-work 2` or a `gsd-verifier` agent) against `ROADMAP.md`'s Phase 2
   criteria and REQUIREMENTS. Count PR #24 as pending, not as met. Write
   `.planning/phases/02-platform-spine/02-VERIFICATION.md`: each criterion, the evidence, PASS or GAP.
4. Close each GAP that is small and needs no new customer-facing design. Auth and security gaps: lead on Opus. Anything
   a customer or the owner sees needs pictures and his signature first (through the controller). List bigger gaps.
5. Write the owner UAT list: numbered steps for sign-in (guest and owner), language and currency on the same URLs, and
   the public/ops wall, with the expected result. They run after the controller deploys.
6. Propose the `ROADMAP.md` and `STATE.md` lines that mark Phase 2 done once PR #24 and this job have landed.

## Rules
- Heavy runs (dev server, Playwright, build, `wrangler dev`, a stack) each need the controller's go for that run. Ask
  by message. One lane on the Mac, `--workers=2` at most. Reading code and writing docs need no go.
- Do not edit the files PR #24 changes (`git diff origin/main...origin/claude/sign-in-option-a --stat`); if a gap is
  there, say so in the hand-over.
- No push to `main`, no deploy, no hosted-database write, no auth setting change on the live project. Never print a
  secret.
- **Hand-over:** commit name plus `HANDOVER-close.md` in the phase folder: checks with results, gaps closed, gaps
  left, UAT list, what was not verified. Message the controller, then stop.
