You finish Phase 3.1 (design system and journey bar) for ALMAR.

Read `.planning/prompts/00-common-rules.md` first and follow it.

WHO AND WHERE
- Today the Mac session "ALMAR phase 3.1 continuation" (`local_d1594554-afcd-4c9f-aee9-d1f320f24127`)
  holds this job in the main checkout `/Users/koss/Developer/almarprod-Website-Code`, branch
  `host/cloudflare-frontsite`. It is the one exception to "own branch, own folder": it started before
  the control method. Nothing else works in the main checkout while it runs.
- If the owner closes that session, the job moves to one cloud thread: branch `gsd/phase-3.1-close`,
  cut from `origin/host/cloudflare-frontsite`. The owner's test itself runs on his Mac, because the
  steps use the dev server on `127.0.0.1:3010`; the control session starts it for him.

STATE ON 2026-10-01
- Plans 01 to 28 have a SUMMARY. Last code commit `ba274a3` (03.1-28 summary and harness report).
- Last checks: on 2026-09-29 by that session, `tsc` clean, 157 node tests pass, 1,066 harness browser
  tests pass and 28 skipped (keyboard focus on screens with nothing to focus), 411 reference
  screenshots. On 2026-10-01 by the control session, in a fresh clone of `1e6ec8e`: install, `tsc`,
  157 of 157 node tests, `tokens:check` and the build pass; Playwright lists 1,133 tests (full run not
  repeated).
- Left: plan 29, the owner's test (18 numbered steps in `03.1-29-PLAN.md`, sent to him in that
  session on 2026-09-29 16:25 +04, no answer yet) and the DSGN-01 wording. Proposed wording: "Owner
  opens the design-system canvas and sees every core component in hover, focus, disabled, loading,
  error and empty states."

STEPS
1. Wait for his test answer. "done" is a pass. For each failed step: fix it, test first, re-run the
   touched specs, then show him that step again.
2. Record the test in `03.1-UAT.md`, apply the DSGN-01 wording he confirms, write
   `03.1-29-SUMMARY.md`, run the phase verifier and the code review the GSD config asks for.
3. Write `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-HANDOVER.md` as the
   common rules describe.
4. Report the commit and the file path: the Mac session to the control session, a cloud thread to the
   coordinator (after pushing `gsd/phase-3.1-close`). Neither pushes `main` or
   `host/cloudflare-frontsite`, opens a PR, or edits `STATE.md` or `ROADMAP.md`: the control session
   does those when it lands the phase.

KNOWN
- The `chooseArabic` helper flakes under parallel Playwright workers: use `--workers=1`.
- The phone booking steps leave no room above the iPhone home bar yet: moved to Phase 4.
- AR and ES copy is draft for the owner's review.
- The old `HANDOFF-phase-3.1.md` (written before plans 19 to 28 ran) was removed on 2026-10-01; this file replaces it.
