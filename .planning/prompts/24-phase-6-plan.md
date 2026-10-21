# Job 24: Phase 6 (site and rest of CMS): discuss and plan, no code

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`, and `.planning/decisions/2026-10-21-owner-answers-after-landing.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

**No tests (owner, 2026-10-21: "I told you, no test. Direct, no test.").** Run no test suite, Playwright, pgTAP, stack, dev server or build. Write the test files the work needs, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed. Hand over with every other check marked "not run (owner: no test)".
No push to `main`, no deploy, no hosted database. Never print a secret. Hand-over: commit name plus `HANDOVER.md` in the job folder named below; message the controller; stop.

Branch `gsd/phase-6-plan` from `origin/main`. Owner #14 (2026-10-21): "yes" to Phases 5 and 6. Phase 5 executes after Phase 4; this job plans Phase 6 now.

1. `/gsd-discuss-phase 6` then `/gsd-plan-phase 6`, one planner per plan (memory `gsd-planner-chunked.md`), reading ROADMAP Phase 6, REQUIREMENTS, the landed 3.2 dashboard and kit, and the job 21 decision that every page lives under `/en`, `/ar`, `/es`.
2. Every question for the owner goes to the controller by message, one decision each, with a recommended option; anything a customer or the owner sees is decided on pictures (real tokens), drawn by you.
3. Hand over the plans for the owner's signature through the controller. No code.
