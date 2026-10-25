# Job 25: Phase 4, execute 04-09, then 04-03, then 04-05 and 04-06 (and 04-07 last)

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`,
`.planning/decisions/2026-10-20-phase-4-rule-signatures.md`, `.planning/decisions/2026-10-21-owner-answers-after-landing.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

- **Branch:** `phase-04-book-and-request` (04-08 is on it at `3aea7c5f`, hand-over `.planning/phases/04-book-and-pay/HANDOVER.md`).
  Merge `origin/main` first (main wins). Push with `git push origin HEAD:phase-04-book-and-request`.
- **Order:** 04-09 now (owner dashboard; wave 4). Then 04-03 (guest pages), but only after the controller says job 21 has
  landed: every page moves under `/en`, `/ar`, `/es`; merge `origin/main` again and put the guest pages under that
  structure. Then 04-05 and 04-06 (wave 5), then 04-07 (UAT plan: write it, but the owner said "no UAT").
- **No tests (owner, 2026-10-21: "I told you, no test. Direct, no test.").** No pgTAP, node suite, Playwright, stack, dev
  server or build. Write the tests the plans name, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed.
- **Owner answers to use (2026-10-21):** 04-09 Q-18 = yes, "Resend request email" stays on a part-paid request past its
  deadline; 04-05 E-31 = yes, every payment gets its own receipt (no repeated past "Pay by"). Button: kit Ivory on Teal.
- **Pictures:** a plan step that asks the owner to sign pictures: draw them (real tokens, EN/AR/ES, widths the plan names),
  put them in one HTML page per plan, and message the controller the path; continue with the non-visual tasks while
  waiting. Do not build a visible screen before its pictures are signed.
- **Lead:** Opus; money, database and auth tasks run on worker-deep, UI tasks on worker.
- **Never:** push `main`, deploy, set secrets, touch the hosted database. Hand over per plan by commit name in the phase
  `HANDOVER.md`, message the controller, and carry on with the next plan in order.
