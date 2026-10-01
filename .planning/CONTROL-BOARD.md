# Control board

Kept by the control session: the one controller session in the Mac main checkout. The ALMAR claude.ai project
acted as controller from 2026-10-01 13:10 (+04 17:10) until the owner ended it at 19:27 UTC; its record is
`HANDOFF-2026-10-01-projects.md`. One page: what is live, what is being built, what waits for the owner, what
comes next. Updated at every hand-over and every landing. The goal: `GOAL.md`. The rules:
`prompts/00-common-rules.md`; decisions `decisions/2026-10-01-control-session.md` and
`decisions/2026-10-01-cloud-project.md`.

**Last update:** 2026-10-01 23:35 (+04) / 19:35 UTC. Phase 3.1 is done and tested but **not landed**: `main` is still the August export. The claude.ai project is ended.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com answer 200 with the static Framer export, title "Private luxury trips in Colombia \| ALMAR" (last read 15:06). `/booking/trip`, `/account`, `/login`, `/bookings`, `/dashboard`, `/fx`, `/newsletter`, `/embed/hero-booker` and `/__harness` answer 404. `dashboard.almarprivatejourney.com` has no DNS record |
| Worker `almar` | Version `cbab55c7` (2026-09-26 21:46 +04, a secret change). Last code upload 2026-09-23 00:36 (+04). Secrets on the Worker, names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Read with wrangler as koussayzayeni@gmail.com, account `e64b47de…` |
| GitHub `Loomlyne/almar` (private) | `main` = `014ae37`, the August Framer export. Open: PR #3 `claude/ship-3.1-c1bvb2` to `main` (tested code tip `08ffd1b`, plus the 2026-10-01 hand-off docs commit), mergeable; PR #2 `claude/repo-cleanup-brjluk` (inside 3.1, close at landing). Branches: `host/cloudflare-frontsite`, `claude/ship-3.1-c1bvb2`, `claude/project-thread-ccgi4o`, `claude/repo-cleanup-brjluk`, `claude/project-thread-ksoh69` (all inside 3.1, delete at landing); `claude/project-thread-8h6bed` (job 02, keep) |
| This Mac | The control session again (owner, 2026-10-01 19:27 UTC). Main checkout on `host/cloudflare-frontsite` `8cc7b4e` (= GitHub). Local `main` `284cc31` is 9 old GSD-doc commits ahead of `origin/main`, all inside 3.1: reset it to `origin/main` after the 3.1 landing. Playwright headless Chromium 1243 installed 13:44 UTC |
| GitHub alerts | 27 open Dependabot alerts (2 critical, 10 high, 13 medium, 2 low), all on `main`'s August lockfile (next 14.2.35, postcss). `main` now has next 15.5.26 and postcss 8.5.28, above every fixed version, so they should close on GitHub's next scan |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration written |
| Design system | Canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw, version `1790852310-eba8`: 63 boards on 7 pages. Copy in `.planning/design/2026-10-01-canvas/` (2026-10-01, hashes checked). Code takes values from `tokens.json` only |
| Stripe, Resend | Nothing live |
| CI | None (no `.github`). The control check in a clean clone is the CI. Fresh clone of `1e6ec8e` on 2026-10-01: install, `tsc`, 157 of 157 node tests, `tokens:check` and the build pass; Playwright lists 1,133 tests |
| Where work runs | This Mac only, never cloud (owner, 13:42 UTC). One controller session in the main checkout; worker sessions run one GSD job each on their own branch (cut from `main`; until 3.1 lands, from `claude/ship-3.1-c1bvb2`), run the checks, write a hand-over and stop. All work through local `/gsd`, stopping at each gate |
| Landing | On the owner's Ship, by the controller only: tag `main` (`backup/*`) and the tip (`archive/*`) on GitHub, squash onto `main`, check the tree, then in the same step delete the landed branches and close their PRs; only `main` and work in progress stay. Landing does not deploy (Worker `almar` is manual). Deploys, DNS and live-database changes need his explicit word each time |

## Jobs

| # | Job | Who | Branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 (`prompts/01-finish-phase-3.1.md`) | cloud thread "Finish phase 3.1 handover" (ended) | `claude/ship-3.1-c1bvb2` (PR #3) | Done 2026-10-01 13:03 UTC: owner test 18/18, W1 to W5 fixed (`5660f8f`). Mac test 13:55 UTC at `08ffd1b`: 1,113 passed, 0 failed, 28 skipped. **Not landed.** Hand-over `phases/03.1-design-system-and-journey-bar-inserted/03.1-HANDOVER.md` | Owner's Ship, then the landing steps in `HANDOFF-2026-10-01-projects.md` |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | cloud thread (stopped 13:43 UTC) | `claude/project-thread-8h6bed`, tip `3e2d58c` | Built: 02-08, 02-02, 02-03, 02-04; security fix `e30e518` (anon could write `site_settings_public`) plus 4 smaller fixes; 216 unit tests pass. Hand-over `phases/02-platform-spine/HANDOVER.md` on that branch (his 6 setup gates). Migration `20260925120000` applied nowhere. Also takes 3.1 open items W6, W7 to W9 (shared with 3.3), `"engines": { "node": ">=22.18" }` and the Dockerfile before any deploy | After 3.1 lands: move `f10f765..3e2d58c` onto `origin/main`, re-run checks and Mac screenshots (`/account`, `/login` before-after expected red, he decides), then its own Ship |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one Mac worker session (GSD) | `gsd/phase-3.2-catalog-and-team` | Prompt written, not started. Also takes 3.1 open item W6: Settings Save, Catalog and Content Publish, Calendar Block, Experiences filters (hide or wire; `tests/phase-03-settings.test.mjs:63` asserts the no-op Save) | Owner's go; code after job 02 |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap. 3.3 shares W7 to W9 with job 02 | |
| unassigned | 3.1 open items 3 and 4: hand-written font sizes in `app/globals.css:126-128` and `:133-135` and 9 repeated hexes in `settings-screen.tsx`; `object-left` logo not flipping in AR; English-only "Show/Hide password" and "Apply" in `field.tsx`; dead class hooks and unused `FRAMER_SOURCE_COPY`, checkbox, footer, `data-density`; `harness-client.tsx` pulling fixtures into the build | | | Needs the shared-file OK for `globals.css` | Owner: which job |

Base for new branches: `claude/ship-3.1-c1bvb2` until Phase 3.1 lands, then `origin/main`.

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any thread |
| 2 | For Mac work only: the three Supabase names in a local `.env.local` (`02-USER-SETUP.md`); the 30-day session time-box after Pro | His terminal, Supabase |

## Sessions and folders

| Session | Model | Where | State |
|---|---|---|---|
| ALMAR claude.ai project (coordinator and threads) | Opus 5.5 High | GitHub and this Mac | ended 2026-10-01 19:27 UTC; record in `HANDOFF-2026-10-01-projects.md` |
| ALMAR control session (Mac, pinned) | Opus 5.5, max | main checkout | the controller again from 2026-10-01 19:27 UTC |
| ALMAR phase 3.1 continuation | Opus 5.5, xhigh | main checkout | idle, waits for the test answer |
| GSD execute phase 3.1 | | main checkout | idle since 2026-09-29; its work is on the branch |
| Phase 3.1 design system and journey bar | | main checkout | idle since 2026-09-28; its work is on the branch |
| 14 Framer-era sessions, June and July | | home folder | the app removed their transcripts; titles only |

All local sessions sit in the sidebar group ALMAR. No work folder stays under
`/Users/koss/Developer/almar-wt/` after a job. Disk free: 51 GB.

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
| Check each worker hand-over in a clean clone when he brings it | On his word |
| Copy the canvas again into a new dated folder under `.planning/design/` | Whenever the owner changes the canvas |
