# Job 16: Phase 4, execute plan 04-08 (request, payments, lapse: database and server)

Read first: `.planning/prompts/00-common-rules.md` and `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

- **Signed:** the owner signed the Phase 4 plans in the controller chat on 2026-10-20 at 10:37 CET, on `phase-04-book-and-request` tip `feb08f2d`. The rules are in `decisions/2026-10-20-phase-4-rule-signatures.md`.
- **Branch:** work on `phase-04-book-and-request` (the phase branch) in your own app-made worktree. Merge `origin/main` first; main wins conflicts.
- **Scope:** plan `04-08` only (`/gsd-execute-phase 4`, limited to 04-08). Stop at 04-08's end.
- **Lead and executors:** you lead on Opus because this is money and database work. Executors run on Sonnet.
- **Local only:** use only a local Supabase stack, through `tests/helpers/local-supabase.mjs`. Never touch the hosted project.
- **Owner steps are the controller's:** the live migration, `BOOKING_LINK_SECRET` and every deploy belong to the controller. List them in the hand-over and do not run them.
- **Heavy runs need a slot:** a stack, Playwright, a build or `wrangler dev` each need the controller's go for that run. Ask by message. The Mac runs one lane at a time, `--workers=2` at most.
- **Hand-over:** commit name plus `HANDOVER.md` with every check, the bite checks S1-S37, U1-U7, N1-N4 and T1-T8, what was not verified, and the migration's safety on real rows. Then stop. No PR, no push to `main`, no deploy.
