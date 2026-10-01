# Control board

Kept by the control session ("ALMAR control session", `local_90a0e6e2-4bce-4142-b7d6-2fd05b2a84e1`).
One page: what is live, what is being built, what waits for the owner, what comes next.
Updated at every hand-over and every landing. The goal: `GOAL.md`. The rules:
`prompts/00-common-rules.md` and `CLAUDE.local.md`, section "One job, one branch, one ship".

**Last update:** 2026-10-01 14:05 (+04), first version.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com answer 200 with the static Framer export, title "Private luxury trips in Colombia \| ALMAR" (read 13:58). `/booking/trip`, `/account` and `/design` answer 404 |
| Worker `almar` | Version `cbab55c7` (2026-09-26 21:46 +04, a secret change). Last code upload 2026-09-23 00:36 (+04). Secrets on the Worker, names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Read with wrangler as koussayzayeni@gmail.com, account `e64b47de…` |
| GitHub `Loomlyne/almar` (private) | `main` = `014ae37` (the August export and the Hermes contract). `host/cloudflare-frontsite` = `2f82714` (2026-09-23) |
| This Mac | `host/cloudflare-frontsite` = `ba274a3`: **208 commits not on GitHub** (Phases 1 to 3.1). Local `main` = `284cc31`: 9 commits not on GitHub, all inside the branch. No stash. Secret scan of the 208: clean |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration written yet |
| Stripe, Resend | Connected, nothing live |
| CI | None (no `.github`). The control check in a clean clone is the CI |
| Who lands and deploys | The control session, on the owner's word. Deploys and DNS are his gate |

## Jobs

| # | Job | Session | Folder, branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 (`prompts/01-finish-phase-3.1.md`) | ALMAR phase 3.1 continuation | main checkout, `host/cloudflare-frontsite` | 28 of 29 plans done. Plan 29 = owner UAT, 18 steps, sent 2026-09-29 16:25, no answer yet | Owner UAT, then hand-over, control check, Ship question |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | none yet | `almar-wt/phase-2-auth`, `gsd/phase-02-auth-chain` | Prompt written, not started | Job 01 landed, owner's go; first step re-checks the four plans |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | none yet | `almar-wt/phase-3.2`, `gsd/phase-3.2-catalog-and-team` | Prompt written, not started | Job 01 landed, owner's go; code after job 02 |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap | |

Base for new branches: decided when job 01 lands (see "Waiting for the owner", 2).

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Plan 29 UAT, 18 numbered steps; "done" is a pass | Session "ALMAR phase 3.1 continuation" |
| 2 | How a job lands on `main`: straight push on his Ship (Vamos), or a PR (ALMAR today) | This session, question form |
| 3 | Push `host/cloudflare-frontsite` to GitHub now, so the 208 commits are not only on this Mac | This session, question form |
| 4 | Model of this control session: Vamos runs its control session on Fable 5.1, high | This session, question form |
| 5 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any session |
| 6 | For job 02: the three Supabase names are on Worker `almar` since 2026-09-26, but not in a local `.env.local` for dev (`02-USER-SETUP.md`); the 30-day session time-box after Pro | His terminal, Supabase |

## Sessions and folders

| Session | Model | Folder | State |
|---|---|---|---|
| ALMAR control session (this, pinned) | Opus 5.5, max | main checkout (reads), clean clones for checks | running |
| ALMAR phase 3.1 continuation | Opus 5.5, xhigh | main checkout | idle, waits for the UAT answer |
| GSD execute phase 3.1 | | main checkout | idle since 2026-09-29; its work is on the branch |
| Phase 3.1 design system and journey bar | | main checkout | idle since 2026-09-28; its work is on the branch |
| 14 Framer-era sessions, June and July | | home folder | the app removed their transcripts; titles only |

Work folders live under `/Users/koss/Developer/almar-wt/` (none yet). Disk free: 51 GB.
`node_modules` is 713 MB per folder.

## Reserved numbers

| Lane | Supabase migration |
|---|---|
| Phase 2 (job 02) | `20260925120000_platform_spine.sql`, named in plans 02-02 and 02-04; not written |
| Next | Given by the control session on request |

## Known, not fixed

| What | Where |
|---|---|
| `STATE.md` says 17 of 29 for 3.1 (real: 28); the ROADMAP progress table lags for Phases 3 and 3.1 | Control session, when job 01 lands |
| `.planning/HANDOFF-phase-3.1.md` predates plans 19 to 28 | Replaced by `prompts/01-finish-phase-3.1.md` |
| The `chooseArabic` helper flakes under parallel Playwright workers | Run with `--workers=1` |
| Phone booking steps leave no room above the iPhone home bar | Phase 4 |
| AR and ES copy is draft for the owner's review | Owner |
| `npm run build` kills a running dev server | Restart it after a build |

## Owed by the control session

| What | When |
|---|---|
| Check job 01's hand-over in a clean clone (install from the lockfile, `tsc`, node tests, Playwright with one worker, tokens check, build), then the Ship question | When it arrives |
| Land job 01, update STATE and ROADMAP, write the base for new branches here | After his Ship |
| Start jobs 02 and 03 from their prompt files | His go, after job 01 lands |
