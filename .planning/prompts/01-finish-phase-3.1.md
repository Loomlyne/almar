You finish Phase 3.1 (design system and journey bar) for ALMAR.

Read `.planning/prompts/00-common-rules.md` first and follow it.

Session: "ALMAR phase 3.1 continuation" (`local_d1594554-afcd-4c9f-aee9-d1f320f24127`). If that
session is lost, a new one starts with: "Read `.planning/prompts/00-common-rules.md` and
`.planning/prompts/01-finish-phase-3.1.md`, then continue."

Folder: the main checkout `/Users/koss/Developer/almarprod-Website-Code`, branch
`host/cloudflare-frontsite`. This job is the one exception to "own folder": it started before the
control method. Nothing else works in the main checkout while it runs.

STATE ON 2026-10-01 14:00 (+04)
- Plans 01 to 28 have a SUMMARY. Last commit `ba274a3` (03.1-28 summary and harness report).
- Last checks, by that session on 2026-09-29: `tsc` clean; 157 node tests pass; 1,066 harness browser tests
  pass, 28 skipped (keyboard focus on screens with nothing to focus); 411 reference screenshots.
- Left: plan 29, the owner's UAT (18 numbered steps, sent in that session on 2026-09-29 16:25 +04) and the
  DSGN-01 wording. Proposed wording: "Owner opens the design-system canvas and sees every core
  component in hover, focus, disabled, loading, error and empty states."

STEPS
1. Wait for his UAT answer. "done" is a pass. For each failed step: fix it on this branch, test
   first, re-run the touched specs, then show him that step again.
2. Record the UAT in `03.1-UAT.md`, apply the DSGN-01 wording he confirms, write
   `03.1-29-SUMMARY.md`, run the phase verifier and the code review the GSD config asks for.
3. Write `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-HANDOVER.md` as the
   common rules describe.
4. Message the control session with the commit and the file path. Do not push, do not open a PR,
   do not edit `STATE.md` or `ROADMAP.md`: the control session does those when it lands the phase.

KNOWN
- The `chooseArabic` helper flakes under parallel Playwright workers: use `--workers=1`.
- The phone booking steps leave no room above the iPhone home bar yet: moved to Phase 4.
- AR and ES copy is draft for the owner's review.
- `.planning/HANDOFF-phase-3.1.md` was written before plans 19 to 28 ran; this file replaces it.
