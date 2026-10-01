# Control board

Kept by the control session: since 2026-10-01 13:10 (owner) that is the ALMAR cloud project, which
replaced the Mac "ALMAR control session". One page: what is live, what is being built, what waits for the owner, what
comes next. Updated at every hand-over and every landing. The goal: `GOAL.md`. The rules:
`prompts/00-common-rules.md`; decisions `decisions/2026-10-01-control-session.md` and
`decisions/2026-10-01-cloud-project.md`.

**Last update:** 2026-10-01 17:30 (+04), job 01 (Phase 3.1) shipped to `main` by the cloud control session.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com answer 200 with the static Framer export, title "Private luxury trips in Colombia \| ALMAR" (last read 15:06). `/booking/trip`, `/account`, `/login`, `/bookings`, `/dashboard`, `/fx`, `/newsletter`, `/embed/hero-booker` and `/__harness` answer 404. `dashboard.almarprivatejourney.com` has no DNS record |
| Worker `almar` | Version `cbab55c7` (2026-09-26 21:46 +04, a secret change). Last code upload 2026-09-23 00:36 (+04). Secrets on the Worker, names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Read with wrangler as koussayzayeni@gmail.com, account `e64b47de…` |
| GitHub `Loomlyne/almar` (private) | `main` = Phase 3.1 squash (2026-10-01): `host/cloudflare-frontsite`, job 01 (`claude/project-thread-ccgi4o`) and PR #2 (`claude/repo-cleanup-brjluk`, with `claude/project-thread-ksoh69` inside it) in one commit. Those four branches are deleted and PR #2 is closed. Open: `claude/project-thread-8h6bed` (job 02, still running) |
| This Mac | Not the control session any more. Its local `main` (`284cc31`) and `host/cloudflare-frontsite` are stale: point local `main` at `origin/main` and delete the local branch |
| GitHub alerts | 27 open Dependabot alerts (2 critical, 10 high, 13 medium, 2 low), all on `main`'s August lockfile (next 14.2.35, postcss). `main` now has next 15.5.26 and postcss 8.5.28, above every fixed version, so they should close on GitHub's next scan |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration written |
| Design system | Canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw, version `1790852310-eba8`: 63 boards on 7 pages. Copy in `.planning/design/2026-10-01-canvas/` (2026-10-01, hashes checked). Code takes values from `tokens.json` only |
| Stripe, Resend | Nothing live |
| CI | None (no `.github`). The control check in a clean clone is the CI. Fresh clone of `1e6ec8e` on 2026-10-01: install, `tsc`, 157 of 157 node tests, `tokens:check` and the build pass; Playwright lists 1,133 tests |
| Where work runs | The ALMAR cloud project: a coordinator and one thread per job, both Opus 5.5 High, GitHub only, no Mac (owner, 2026-10-01). Threads never push `main`, deploy or write to the live database |
| Landing | On the owner's Ship, from the cloud control session: one ship branch with the job folded in and the checks re-run, then a PR squash-merged onto `main`. In the same step, delete every branch now on `main` and close its PR; only `main` and work in progress stay. Deploys and live-database changes need his explicit word each time. Screenshot tests cannot pass in the cloud (Mac baselines): report them as unverified |

## Jobs

| # | Job | Who | Branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 (`prompts/01-finish-phase-3.1.md`) | cloud thread "Finish phase 3.1 handover" | landed, branch deleted | Done 2026-10-01: owner test 18/18, W1 to W5 fixed, shipped to `main`. Hand-over `phases/03.1-design-system-and-journey-bar-inserted/03.1-HANDOVER.md` | Nothing |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | cloud threads "Plan phase 2 auth chain" and "Read loomlyne/almar and propose next steps" | discuss refresh in `claude/repo-cleanup-brjluk` (PR #2); plans on `claude/project-thread-8h6bed` | Discuss refresh signed 2026-10-01 (now on `main`). Plans 02-02/03/04 re-checked and revised; 02-08 Task 2 (server runtime config, build only) and its summary written on `8h6bed`. Also takes 3.1 open items: sign-in submit and Profile sign-out (W6); guest nav anchors, currency select, language cookie, footer newsletter (W7 to W9, shared with 3.3); `"engines": { "node": ">=22.18" }` and the Dockerfile before any deploy | Merge `origin/main` into `8h6bed` (it was cut before the 3.1 ship), then its own Ship |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one cloud thread | `gsd/phase-3.2-catalog-and-team` | Prompt written, not started. Also takes 3.1 open item W6: Settings Save, Catalog and Content Publish, Calendar Block, Experiences filters (hide or wire; `tests/phase-03-settings.test.mjs:63` asserts the no-op Save) | Owner's go; code after job 02 |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap. 3.3 shares W7 to W9 with job 02 | |
| unassigned | 3.1 open items 3 and 4: hand-written font sizes in `app/globals.css:126-128` and `:133-135` and 9 repeated hexes in `settings-screen.tsx`; `object-left` logo not flipping in AR; English-only "Show/Hide password" and "Apply" in `field.tsx`; dead class hooks and unused `FRAMER_SOURCE_COPY`, checkbox, footer, `data-density`; `harness-client.tsx` pulling fixtures into the build | | | Needs the shared-file OK for `globals.css` | Owner: which job |

Base for new branches: `origin/main` (Phase 3.1 landed 2026-10-01).

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any thread |
| 2 | For Mac work only: the three Supabase names in a local `.env.local` (`02-USER-SETUP.md`); the 30-day session time-box after Pro | His terminal, Supabase |

## Sessions and folders

| Session | Model | Where | State |
|---|---|---|---|
| ALMAR cloud project (control session since 2026-10-01 13:10) | Opus 5.5 High | GitHub | checks and lands; deploys only on the owner's word |
| ALMAR control session (Mac, pinned) | Opus 5.5, max | main checkout | replaced as control session 2026-10-01 |
| ALMAR phase 3.1 continuation | Opus 5.5, xhigh | main checkout | idle, waits for the test answer |
| GSD execute phase 3.1 | | main checkout | idle since 2026-09-29; its work is on the branch |
| Phase 3.1 design system and journey bar | | main checkout | idle since 2026-09-28; its work is on the branch |
| 14 Framer-era sessions, June and July | | home folder | the app removed their transcripts; titles only |

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
| Check each cloud hand-over the same way when he brings it | On his word |
| Copy the canvas again into a new dated folder under `.planning/design/` | Whenever the owner changes the canvas |
