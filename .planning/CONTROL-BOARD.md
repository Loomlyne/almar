# Control board

Kept by the controller: the Mac session "ALMAR controller" (`local_836ffacc-ca03-41c4-b1ff-385b8aa9d357`,
pinned, sidebar group ALMAR) in the main checkout, since 2026-10-02 00:05 (+04), on the owner's choice. It
replaced "ALMAR control session" (`local_90a0e6e2-…`, now titled "retired"). The claude.ai project ran
2026-10-01 11:08–19:27 UTC; its record is `HANDOFF-2026-10-01-projects.md`. One page: what is live, what is
being built, what waits for the owner, what comes next. Updated at every hand-over and every landing. The
goal: `GOAL.md`. The rules: `prompts/00-common-rules.md`; decisions `decisions/2026-10-01-control-session.md`
and `decisions/2026-10-01-cloud-project.md` (the cloud part is ended).

**Last update:** 2026-10-02 01:46 (+04). Phase 3.1 **landed** on `main` as `9fd6786` on the owner's Ship
(01:42), not deployed. The site moved to Cloudflare account `f1d9a1fa…` and is live there.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com answer 200 with the static Framer export (commit `2f82714`), title "Private luxury trips in Colombia \| ALMAR"; `/private-stays` and `/contact` 200; unknown paths the branded 404 (read 2026-10-02 01:41). **Outage 2026-10-02 ~01:00–01:39**: the owner moved the zone to account `f1d9a1fa…` and the Worker custom-domain records stayed behind; fixed by the redeploy below. 3.1 is not deployed. `dashboard.almarprivatejourney.com` has no DNS record |
| Worker `almar` | Account "Almar Private Journey" `f1d9a1fa3abdda98c15161b00b40385c`. Version `99d76f13`, deployed 2026-10-02 01:32 (+04) from `2f82714` on the owner's word; live home page byte-identical to that build. Custom domains apex and `www`; also `almar.almar-private-journey.workers.dev`. No secrets yet |
| Wrangler for ALMAR | `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler …` (ALMAR-only login, sees only `f1d9a1fa…`). The default `~/.wrangler` login and the claude.ai Cloudflare connector see only the Vamos account. `cf` CLI is signed in to `f1d9a1fa…` only |
| Old Worker `almar` | On the Vamos account `e64b47de…`: last code 2026-09-22, secret names `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Serves nothing since the move. Delete only on the owner's word |
| Pages project `almar` | Account `f1d9a1fa…`, `almar-khb.pages.dev`, Git integration on `Loomlyne/almar`. Production branch `main` (built `014ae37` a week before the move); every pushed branch gets a public preview. The 3.1 landing push builds `main` there (owner accepted in the Ship). Not the domain |
| GitHub `Loomlyne/almar` (private) | `main` = `9fd6786` (3.1 squash, tree `983aec38` = the checked tree) plus this planning note. Tags `backup/main-2026-10-02` (`014ae37`) and `archive/ship-3.1` (`7e72c20`). Landing step: PRs #3 and #2 closed; branches `host/cloudflare-frontsite`, `claude/ship-3.1-c1bvb2`, `claude/project-thread-ccgi4o`, `claude/repo-cleanup-brjluk`, `claude/project-thread-ksoh69` deleted (all inside `archive/ship-3.1`). Kept: `claude/project-thread-8h6bed` (job 02) |
| This Mac | Main checkout on `main`. Playwright headless shell 1243 reinstalled 2026-10-02 00:13 (owner's yes): a Vamos worktree's Playwright 1.62 install had removed it at 2026-10-01 23:47; now linked to this checkout's `node_modules` |
| Package alerts | `npm audit` on the 3.1 lockfile: 2 high (`postcss` inside `next`, fix is Next 16, a major; `undici` inside `wrangler`, fix `wrangler@4.146.0`), 3 moderate. GitHub's 27 Dependabot alerts were on the August lockfile and should re-scan |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration applied |
| Design system | Canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw, version `1790852310-eba8`: 63 boards on 7 pages. Copy in `.planning/design/2026-10-01-canvas/`. Code takes values from `tokens.json` only |
| Stripe, Resend | Nothing live |
| CI | None (no `.github`). The controller's clean-clone check is the CI. Last: `7e72c20` on 2026-10-02 00:05–01:07: `npm ci`, `tsc`, 160/160 node tests, `tokens:check`, build pass; Playwright 1,109 passed, 28 skipped, 4 failed on 30 s page-load timeouts while the Mac was loaded (load 11–14); the 45 journey-sheet a11y tests pass on rerun |
| Where work runs | This Mac only, never cloud. One controller in the main checkout; worker sessions run one GSD job each on their own branch cut from `origin/main`, run the checks, write a hand-over and stop. All work through local `/gsd`, stopping at each gate |
| Landing | On the owner's Ship, by the controller only: tag `main` (`backup/*`) and the tip (`archive/*`) on GitHub, one squash commit with the checked tree, push, then in the same step delete the landed branches and close their PRs. A push to `main` also builds the Pages production preview at `almar-khb.pages.dev`. Worker `almar` is deployed by hand on the owner's word only |

## Jobs

| # | Job | Who | Branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 (`prompts/01-finish-phase-3.1.md`) | cloud thread (ended); landed by the controller | — | **Landed** 2026-10-02 on the owner's Ship (01:42 +04) as `9fd6786`. Not deployed | Owner's word to deploy 3.1 to Worker `almar` |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | one Mac worker session (GSD), not started | `claude/project-thread-8h6bed`, tip `3e2d58c` | Built in the cloud: 02-08, 02-02, 02-03, 02-04; security fix `e30e518` plus 4 smaller fixes; 216 unit tests. Hand-over `phases/02-platform-spine/HANDOVER.md` on that branch (his 6 setup gates). Migration `20260925120000` applied nowhere. Also takes: 3.1 open items W6, W7 to W9 (shared with 3.3); `"engines": { "node": ">=22.18" }` and the Dockerfile; `account_id = "f1d9a1fa3abdda98c15161b00b40385c"` in `wrangler.toml` so no deploy can reach the Vamos account; `wrangler@4.146.0` | Now: move `f10f765..3e2d58c` onto `origin/main`, re-run checks and Mac screenshots (`/account`, `/login` before-after expected red, he decides), then its own Ship |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one Mac worker session (GSD) | `gsd/phase-3.2-catalog-and-team` | Prompt written, not started. Also takes 3.1 open item W6: Settings Save, Catalog and Content Publish, Calendar Block, Experiences filters (hide or wire; `tests/phase-03-settings.test.mjs:63` asserts the no-op Save) | Owner's go; code after job 02 |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap. 3.3 shares W7 to W9 with job 02 | |
| unassigned | 3.1 open items 3 and 4: hand-written font sizes in `app/globals.css:126-128` and `:133-135` and 9 repeated hexes in `settings-screen.tsx`; `object-left` logo not flipping in AR; English-only "Show/Hide password" and "Apply" in `field.tsx`; dead class hooks and unused `FRAMER_SOURCE_COPY`, checkbox, footer, `data-density`; `harness-client.tsx` pulling fixtures into the build | | | Needs the shared-file OK for `globals.css` | Owner: which job |

Base for new branches: `origin/main`.

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any session |
| 2 | For Mac work only: the three Supabase names in a local `.env.local` (`02-USER-SETUP.md`); the 30-day session time-box after Pro | His terminal, Supabase |
| 3 | Deploy 3.1 to Worker `almar` (landing did not deploy) | His word |
| 4 | Delete the old Worker `almar` on the Vamos account `e64b47de…` | His word |
| 5 | Keep or disconnect the Pages project `almar` (public previews of every branch at `*.almar-khb.pages.dev`) | His decision |
| 6 | Worker folders: `CLAUDE.local.md` says `/Users/koss/Developer/almar-wt/<job>`, the global rule (2026-10-01) says `.claude/worktrees/<name>` and never a sibling folder | His decision before job 02 starts |
| 7 | Supabase secret names onto the new Worker `almar` when job 02's server runtime needs them | His terminal |

## Sessions and folders

| Session | Model | Where | State |
|---|---|---|---|
| ALMAR controller (`local_836ffacc-…`, pinned) | Opus 5.5, xhigh | main checkout | the controller since 2026-10-02 00:05 (+04) |
| ALMAR control session (retired 2026-10-02) (`local_90a0e6e2-…`) | Opus 5.5, max | main checkout | idle since 2026-10-01 15:17 (+04); not the controller |
| ALMAR phase 3.1 continuation | Opus 5.5, xhigh | main checkout | idle; its work landed |
| GSD execute phase 3.1 | | main checkout | idle since 2026-09-29; its work landed |
| Phase 3.1 design system and journey bar | | main checkout | idle since 2026-09-28; its work landed |
| 14 Framer-era sessions, June and July | | home folder | titles only |

All ALMAR sessions sit in the sidebar group ALMAR. No work folder stays after a job. Disk free: 51 GB
(2026-10-01).

## Reserved numbers

| Lane | Supabase migration |
|---|---|
| Phase 2 (job 02) | `20260925120000_platform_spine.sql`, named in plans 02-02 and 02-04; written on the job 02 branch, applied nowhere |
| Next | The controller hands them out and records them here at ship |

## Known, not fixed

| What | Where |
|---|---|
| `HERMES.md` is a stale snapshot (Next 14, the old 404 catch-all, "no root layout", old 404 colours, "never rewrite pages as React") and GSD loads it as its CLAUDE.md (`.planning/config.json`) | Owner decision: refresh it or point GSD elsewhere |
| `.claude/rules/connections.md` says "Supabase has no project yet"; the project exists since plan 02-01 | Owner decision |
| Phase 3 has 13 of 13 summaries and no verification file | Controller report |
| The `chooseArabic` helper flakes under parallel Playwright workers | Run with `--workers=1` |
| The Playwright browser cache is shared by every project on this Mac; another project's install can remove build 1243 | Reinstall from this checkout: `npx playwright install --only-shell chromium` (a download: owner's OK) |
| Under heavy Mac load some journey-sheet a11y tests hit the 30 s page-load timeout | Rerun the file; it passed 45/45 on 2026-10-02 |
| After a DNS outage this Mac keeps the "no record" answer up to 30 minutes | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` (his terminal) |
| Phone booking steps leave no room above the iPhone home bar | Phase 4 |
| AR and ES copy is draft for the owner's review | Owner |
| `npm run build` kills a running dev server | Restart it after a build |

## Owed by the controller

| What | When |
|---|---|
| Read the Pages production build of the new `main` and the live site after the landing push | Now |
| Check each worker hand-over in a clean clone when he brings it | On his word |
| Copy the canvas again into a new dated folder under `.planning/design/` | Whenever the owner changes the canvas |
