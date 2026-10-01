# Control board

Kept by the control session ("ALMAR control session", `local_90a0e6e2-4bce-4142-b7d6-2fd05b2a84e1`,
on the owner's Mac). One page: what is live, what is being built, what waits for the owner, what
comes next. Updated at every hand-over and every landing. The goal: `GOAL.md`. The rules:
`prompts/00-common-rules.md`; decisions `decisions/2026-10-01-control-session.md` and
`decisions/2026-10-01-cloud-project.md`.

**Last update:** 2026-10-01 15:06 (+04).

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com answer 200 with the static Framer export, title "Private luxury trips in Colombia \| ALMAR" (last read 15:06). `/booking/trip`, `/account`, `/login`, `/bookings`, `/dashboard`, `/fx`, `/newsletter`, `/embed/hero-booker` and `/__harness` answer 404. `dashboard.almarprivatejourney.com` has no DNS record |
| Worker `almar` | Version `cbab55c7` (2026-09-26 21:46 +04, a secret change). Last code upload 2026-09-23 00:36 (+04). Secrets on the Worker, names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Read with wrangler as koussayzayeni@gmail.com, account `e64b47de…` |
| GitHub `Loomlyne/almar` (private) | `main` = `014ae37` (the August export and the Hermes contract). `host/cloudflare-frontsite` = last code commit `ba274a3` plus planning notes; everything since 2026-09-23 is there and only there |
| This Mac | `host/cloudflare-frontsite` equal to GitHub. Local `main` = `284cc31`: 9 commits not on GitHub `main`, all inside the branch. No stash, no other worktree, no tag |
| GitHub alerts | 27 open Dependabot alerts (2 critical, 10 high, 13 medium, 2 low), all on `main`'s August lockfile (next 14.2.35, postcss). The branch has next 15.5.26 and postcss 8.5.28, above every fixed version: they close when 3.1 lands |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration written |
| Design system | Canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw, version `1790852310-eba8`: 63 boards on 7 pages. Copy in `.planning/design/2026-10-01-canvas/` (2026-10-01, hashes checked). Code takes values from `tokens.json` only |
| Stripe, Resend | Nothing live |
| CI | None (no `.github`). The control check in a clean clone is the CI. Fresh clone of `1e6ec8e` on 2026-10-01: install, `tsc`, 157 of 157 node tests, `tokens:check` and the build pass; Playwright lists 1,133 tests |
| Where work runs | The ALMAR cloud project: a coordinator and one thread per job, both Opus 5.5 High, GitHub only, no Mac (owner, 2026-10-01). Threads never push `main`, deploy or write to the live database |
| Landing | On the owner's Ship, from this Mac: `backup/*` tag on `main` and `archive/*` tag on the branch tip, one commit on `main`, staged tree equal to the checked tree, push `main`. Deploys and DNS need his explicit word. No PR unless he asks |

## Jobs

| # | Job | Who | Branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 (`prompts/01-finish-phase-3.1.md`) | Mac session "ALMAR phase 3.1 continuation"; a cloud thread if he closes it | `host/cloudflare-frontsite`; cloud: `gsd/phase-3.1-close` | 28 of 29 plans done. Plan 29 = owner test, 18 steps in `03.1-29-PLAN.md`, sent 2026-09-29 16:25, no answer yet. The steps need the dev server on the Mac | Owner test, then hand-over, control check, Ship question |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | one cloud thread | `gsd/phase-02-auth-chain` | Prompt written. 02-08 Task 1 done 2026-09-26 (packages, Next 15.5.26); Task 2 and the summary open | Job 01 landed, owner's go; first step re-checks the four plans |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one cloud thread | `gsd/phase-3.2-catalog-and-team` | Prompt written, not started | Job 01 landed, owner's go; code after job 02 |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap | |

Base for new branches: `origin/host/cloudflare-frontsite` until Phase 3.1 lands, then `origin/main`
(test in `prompts/00-common-rules.md`).

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Plan 29 test, 18 numbered steps; "done" is a pass | Mac, with the 3.1 session or the control session |
| 2 | Create the cloud project: general (name, goal, models), project instructions, GitHub repository; first message to the coordinator. Both texts were handed to him on 2026-10-01 | claude.ai |
| 3 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any thread |
| 4 | For Mac work only: the three Supabase names in a local `.env.local` (`02-USER-SETUP.md`); the 30-day session time-box after Pro | His terminal, Supabase |

## Sessions and folders

| Session | Model | Where | State |
|---|---|---|---|
| ALMAR control session (this, pinned) | Opus 5.5, max | main checkout (reads), clean clones for checks | stays: checks, lands and deploys |
| ALMAR phase 3.1 continuation | Opus 5.5, xhigh | main checkout | idle, waits for the test answer |
| GSD execute phase 3.1 | | main checkout | idle since 2026-09-29; its work is on the branch |
| Phase 3.1 design system and journey bar | | main checkout | idle since 2026-09-28; its work is on the branch |
| 14 Framer-era sessions, June and July | | home folder | the app removed their transcripts; titles only |
| ALMAR cloud project | Opus 5.5 High | GitHub | being created by the owner |

All 18 local sessions sit in the sidebar group ALMAR. No work folder exists under
`/Users/koss/Developer/almar-wt/`. Disk free: 51 GB.

## Reserved numbers

| Lane | Supabase migration |
|---|---|
| Phase 2 (job 02) | `20260925120000_platform_spine.sql`, named in plans 02-02 and 02-04; not written |
| Next | The coordinator hands them out; the control session records them here at ship |

## Known, not fixed

| What | Where |
|---|---|
| `HERMES.md` is a stale snapshot (Next 14, the old 404 catch-all, "no root layout", old 404 colours, "never rewrite pages as React") and GSD loads it as its CLAUDE.md (`.planning/config.json`) | Owner decision: refresh it or point GSD elsewhere |
| `.claude/rules/connections.md` says "Supabase has no project yet"; the project exists since plan 02-01 | Owner decision |
| Phase 3 has 13 of 13 summaries and no verification file | Coordinator report |
| The `chooseArabic` helper flakes under parallel Playwright workers | Run with `--workers=1` |
| Phone booking steps leave no room above the iPhone home bar | Phase 4 |
| AR and ES copy is draft for the owner's review | Owner |
| `npm run build` kills a running dev server | Restart it after a build |

## Owed by the control session

| What | When |
|---|---|
| Check job 01's hand-over in a clean clone (install from the lockfile, `tsc`, node tests, Playwright with one worker, tokens check, build), then the Ship question | When it arrives |
| Land job 01: tags first, one commit on `main`, staged tree equal to the checked tree, push `main`; then point local `main` at `origin/main` and set the base here to `origin/main` | After his Ship |
| Check each cloud hand-over the same way when he brings it | On his word |
| Copy the canvas again into a new dated folder under `.planning/design/` | Whenever the owner changes the canvas |
