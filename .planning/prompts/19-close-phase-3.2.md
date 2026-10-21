# Job 19: close Phase 3.2 (real catalogue and team)

Read first: `.planning/prompts/00-common-rules.md` and `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`. Owner order, 2026-10-21: finish 3.3, 2 and 3.2, each in its
own session, land and deploy them, then start Phase 4.

**Goal:** Phase 3.2 is complete with proof: every success criterion in `ROADMAP.md` (Phase 3.2) is met on code on
`main`, `03.2-VERIFICATION.md` says so line by line, the open follow-ups are closed or listed, and the owner has a
numbered UAT list for the dashboard and the public catalogue pages.

## What is already true (verify each)
- These plans **landed on `main` but have no `SUMMARY.md`**: 03.2-06 (`fa5c3b2`), 03.2-07 (`40b5b65`), 03.2-08
  (`74db046`), 03.2-12 (`f789937`), 03.2-13 (`b1cf7ae`), 03.2-15 (`6dcbabd`). Each has a `HANDOVER.md` in the phase folder.
- 03.2-14 is marked `status: not-in-v1`.
- Migration `20261019140000` (03.2-15) is live. Migration `20261019130000_ops_save_publish_rules` (follow-ups item 7,
  PR #22) is on `main` and **not live**: it goes live only when the live count of published items without a
  destination is 0 (it read 24 of 45 on 2026-10-19). The controller applies it.
- Board follow-ups for 3.2 (`CONTROL-BOARD.md`, known issues): 03.2-08 review nits
  (`tests/journey/scenes/ops-coming-soon.tsx:41`, `tests/ops-coming-soon.spec.ts:178`); kit editors re-read and drop
  unsaved edits on Unpublish/Publish without "Discard changes?" (`stays-screen.tsx:181-201`,
  `destinations-screen.tsx:152-164`).

## Steps
1. Cut `gsd/phase-3.2-close` from `origin/main` in your own app-made worktree. Push with
   `git push origin HEAD:gsd/phase-3.2-close`.
2. Write the six missing summaries from each plan, its hand-over and its landed commit (what shipped, deviations,
   tests). Add a short `03.2-14-SUMMARY.md` that says not in v1 and why.
3. Run the GSD verifier for Phase 3.2 (`/gsd-verify-work 3.2` or a `gsd-verifier` agent) against `ROADMAP.md`'s 3.2
   criteria. Write `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-VERIFICATION.md`: each criterion, the
   evidence, PASS or GAP.
4. Item 7's live precondition: write the exact read-only SQL that counts published items without a destination, for
   the controller to run. Do not run it against the hosted project. If the count is not 0, list which owner action
   brings it to 0 (dashboard steps), and say whether 3.2 can close with item 7 still waiting.
5. Fix the two follow-ups above on this branch if they need no new design (the Discard prompt follows the kit's
   existing dialog). Database and publish logic: lead on Opus. Anything new the owner sees needs pictures and his
   signature first (through the controller).
6. Write the owner UAT list: numbered steps on https://dashboard.almarprivatejourney.com (create, edit, publish,
   unpublish a destination, stay, experience, service, team member; media; calendar) and the matching public page,
   with the expected result. They run after the controller deploys `almar-ops` and `almar`.
7. Propose the `ROADMAP.md` and `STATE.md` lines that mark 3.2 done.

## Rules
- Local Supabase only, through `tests/helpers/local-supabase.mjs`. Heavy runs (stack, dev server, Playwright, build,
  `wrangler dev`) each need the controller's go for that run. Ask by message. One lane on the Mac, `--workers=2` at most.
- No push to `main`, no deploy, no hosted-database read or write. Never print a secret.
- **Hand-over:** commit name plus `HANDOVER-close.md` in the phase folder: checks with results, gaps closed, gaps
  left, the SQL for the controller, UAT list, what was not verified. Message the controller, then stop.
