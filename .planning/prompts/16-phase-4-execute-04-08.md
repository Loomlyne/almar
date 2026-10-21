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

## Restart, 2026-10-21 (owner: phases 3.3, 2 and 3.2 landed and deployed, then Phase 4)

- The first job 16 session stopped mid-task on 2026-10-20 and was archived. Its uncommitted draft migration was saved, not
  checked, as branch `wip/04-08-job16` (`ca1afb58`, tag `archive/job16-04-08-wip-20261021`): one file,
  `supabase/migrations/20261019160000_booking_requests.sql` (1,059 lines). Read it as a draft: keep what matches 04-08,
  rewrite what does not. Migration number `20261019160000` stays reserved for you; `20261019130000` (item 7) is not live yet.
- `main` moved a lot since `3d190217`: Next.js 16.4.2 and OpenNext 1.20.12 (`--webpack` build and dev; `middleware.ts`
  kept), sign-in option A, the Framer bridge removed, the kit's Unpublish asks "Discard changes?". Merge `origin/main` into
  `phase-04-book-and-request` first (main wins), then bring in the draft from `wip/04-08-job16`.
- All three Workers run `main` `64c3475d` now. Live `almar` still serves 04-02's hold routes; they fail closed with no
  `BOOKING_LINK_SECRET` (503). The controller sets that secret only with 04-08's gate, as the plan says.
- The Mac is free: ask for a slot by message before each heavy run (stack, pgTAP, Playwright, build, `wrangler dev`).
