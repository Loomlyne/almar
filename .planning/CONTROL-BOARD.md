# Control board

Kept by the controller: the Mac session "ALMAR controller" (`local_836ffacc-ca03-41c4-b1ff-385b8aa9d357`,
pinned, sidebar group ALMAR) in the main checkout, since 2026-10-02 00:05 (+04), on the owner's choice. The
claude.ai project ran 2026-10-01 11:08–19:27 UTC; its record is `HANDOFF-2026-10-01-projects.md`. One page:
what is live, what is being built, what waits for the owner, what comes next. Updated at every hand-over and
every landing. The goal: `GOAL.md`. The rules: `prompts/00-common-rules.md`; decisions
`decisions/2026-10-01-control-session.md`.

**Last update:** 2026-10-02 04:20 (+04), job 04 checked. Phase 3.1 is on `main` and live. Job 04 is built, handed
over on `fix/repo-tidy` (`6bc38f2`) and checked by the controller in a clean clone: it waits for the owner's Ship.
Then job 02 sign-in. Nothing is running.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com serve `main` `68df3b6` (Phase 3.1): all 26 public pages answer 200, byte-identical to the build on both hosts; unknown paths answer the new branded 404 (read 2026-10-02 02:26). `/booking/trip`, `/account`, `/login`, `/dashboard`, `/fx`, `/newsletter`, `/__harness` answer 404. `dashboard.almarprivatejourney.com` has no DNS record. **Outage 2026-10-02 ~01:00–01:39**: the zone move left the Worker custom-domain records behind |
| Worker `almar` | Account "Almar Private Journey" `f1d9a1fa3abdda98c15161b00b40385c`. Version `49112d4b`, deployed 2026-10-02 02:25 (+04) from `68df3b6` on the owner's word. Rollback target `99d76f13` (commit `2f82714`, the pre-3.1 pages). Custom domains apex and `www`; also `almar.almar-private-journey.workers.dev`, which job 04's `workers_dev = false` turns off at the next deploy. No secrets yet |
| Wrangler for ALMAR | `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler …` (ALMAR-only login). The default login and the claude.ai Cloudflare connector see only the Vamos account. `cf` CLI signed in to `f1d9a1fa…` only |
| Cleaned up 2026-10-02 | Old Worker `almar` on the Vamos account `e64b47de…` deleted (owner's word); Pages project `almar` (`almar-khb.pages.dev`, built every branch) deleted (owner's word). The Vamos account keeps only `vamos`, `vamos-dashboard`, `rolandscaping-mail`, untouched |
| GitHub `Loomlyne/almar` (private) | `main` = `9fd6786` (3.1 squash) plus planning notes. Tags `backup/main-2026-10-02` (`014ae37`), `archive/ship-3.1` (`7e72c20`). No open PRs. Branches: `main`; `fix/repo-tidy` (job 04, tip `6bc38f2`, checked, waiting for his Ship); `claude/project-thread-8h6bed` (job 02's cloud work, moved onto `main` by job 02, deleted when it lands) |
| This Mac | Main checkout on `main` `7c5774f`, clean (only `.DS_Store`, ignored by job 04). One worktree exists: `.claude/worktrees/repo-tidy` on `fix/repo-tidy`, clean; removed the day job 04 lands. `.claude/worktrees/` is hidden from git in `.git/info/exclude`. Build output removed (`.next`, `out`, `.vercel` link). Playwright headless shell 1243 installed and linked to this checkout |
| Package alerts | `npm audit` on `main`'s lockfile: 2 high, 3 moderate. On the job 04 lockfile: **2 left** (high `postcss` inside `next`, moderate `next`); the fix for both is Next 16, a major, blocked — reported only |
| Database | One Supabase project (plan 02-01, Storage off, owner user confirmed). The app is not wired; no `.env.local`; no migration applied |
| Design system | Canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw, version `1790852310-eba8`: 63 boards on 7 pages. Copy in `.planning/design/2026-10-01-canvas/`. Code takes values from `tokens.json` only |
| GSD | Healthy (`validate.health`), no verification debt (`audit-uat`). Codebase map and `HERMES.md` refreshed 2026-10-02 for `main` |
| Stripe, Resend | Nothing live |
| CI | None (no `.github`). The controller's clean-clone check is the CI. Last: `7e72c20` (= `9fd6786` tree) on 2026-10-02: `npm ci`, `tsc`, 160/160 node tests, `tokens:check`, build pass; Playwright 1,109 passed, 28 skipped, 4 load timeouts that pass on rerun (45/45). Then `fix/repo-tidy` `6bc38f2` on 2026-10-02 04:20 (clean clone of `7c5774f`, fast-forward, merged tree `d7190a2` identical to the branch tree): `npm ci`, `tsc`, **193/193** node tests, `tokens:check`, build (27 html), `npm audit` 5→2 pass; Playwright 1,112 passed, 28 skipped, 1 failed — the known `chooseArabic` flake on `login-ar-1440`, 3/3 on rerun. The tree stayed clean through the run (item 7) |
| Where work runs | This Mac only. One controller in the main checkout; each worker session runs one GSD job in its own worktree `.claude/worktrees/<job>` on its own branch cut from `origin/main` (owner, 2026-10-02), runs the checks, writes a hand-over and stops |
| Landing | On the owner's Ship, by the controller only: tag `main` (`backup/*`) and the tip (`archive/*`) on GitHub, one squash commit with the checked tree, push, then in the same step delete the landed branches and close their PRs, remove the worktree. Worker `almar` is deployed by hand on the owner's word only |

## Jobs, in order

| # | Job | Who | Folder and branch | State | Needs |
|---|---|---|---|---|---|
| 01 | Finish Phase 3.1 | done | — | **Landed** 2026-10-02 01:42 as `9fd6786`; **deployed** 02:25 (`49112d4b`) | — |
| 04 | Repo tidy plus three live-page fixes (`prompts/04-repo-tidy.md`, 12 items): delete `PLAN_FIX_ALL.md`, `_README.txt`, `vercel.json`, `Dockerfile`, `.dockerignore`; `engines` node >=22.18; `account_id` and `workers_dev = false` in `wrangler.toml`; `wrangler@4.146.0`; declare `@radix-ui/react-focus-scope` and `esbuild`; `.gitignore` (`.DS_Store`, `.claude/worktrees/`, `.env`, `.env.*`, `.dev.vars`); settle `tests/screens/after/`; fix `connections.md`, README, a dead comment; **remove the 3 invented team members from live Home, About, Contact; hide 8 dead footer links; JSON-LD to the real domain** | one Mac worker, Sonnet, `/gsd-quick` | `.claude/worktrees/repo-tidy`, `fix/repo-tidy` | **Handed over and checked.** Built 02:55–03:44 by a Mac worker (Opus, not the Sonnet the prompt named), 12 items, one commit each, tip `6bc38f2`, final code commit `2e4fe87`; hand-over `.planning/quick/261002-42w-repo-tidy/HANDOVER.md`. Controller's clean-clone check passed 04:20 (see CI row) plus four independent checks: built `out/` carries none of the 3 names in any spelling, no `almarprod.framer.website`, no href to the 8 dead paths, no portraits; all 52 JSON-LD urls are `almarprivatejourney.com`; the 4 new/changed test files all fail on `7c5774f` and pass on the branch; the visible-text diff of the changed pages removes only the 3 names, their 3 roles, 3 "Email us" links and the 3 placeholder stay names, and adds nothing | **Owner's Ship**, then deploy on his separate word |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | one Mac worker, Opus lead, Sonnet executors | `.claude/worktrees/phase-02-auth`, `gsd/phase-02-auth-chain` | Built in the cloud on `claude/project-thread-8h6bed` (tip `3e2d58c`, 11 own commits, 216 unit tests); to be cherry-picked onto `main`, checked on the Mac, reviewed, then his 6 gates and 8 test steps. Also proposes W6 (sign-in, sign-out) and W7–W9. Migration `20260925120000` applied nowhere | After job 04 lands |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one Mac worker, Opus lead | `.claude/worktrees/phase-3.2`, `gsd/phase-3.2-catalog-and-team` | Prompt ready. Discuss may run while job 02 builds; code after job 02 lands. Takes W6 for Settings, Catalog, Content, Calendar, Experiences | Owner's go |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap. 3.3 shares W7–W9 with job 02 | |
| unassigned | 3.1 open items 3 and 4: hand-written font sizes in `app/globals.css:126-128` and `:133-135`, 9 repeated hexes in `settings-screen.tsx`; `object-left` logo in AR; English-only "Show/Hide password" and "Apply" in `field.tsx`; dead class hooks, unused `FRAMER_SOURCE_COPY`, checkbox, footer, `data-density`; `harness-client.tsx` pulling fixtures into the build | | | | Owner: which job |

Base for new branches: `origin/main`. One job at a time into `main`; the next job merges the new `main` first.

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | **Ship job 04?** It is built and checked. His test steps are in the hand-over: the 12 before/after images in `.planning/quick/261002-42w-repo-tidy/screens/`, then the GitHub diff of `fix/repo-tidy`. Two things to see first: the footer link **labelled "Contact" pointed at the privacy policy**, so it is hidden and the "Connect" heading now stands with no links under it; and the team block is hidden by **one CSS rule per page**, because Framer's CDN code redraws its heading | This chat |
| 2 | Item 7 of his 2026-09-29 dashboard feedback arrived empty; not confirmed answered since | Any session |
| 3 | For job 02: the Supabase names in a local `.env.local` (`02-USER-SETUP.md`) and on Worker `almar`; the 30-day session time-box after Pro | His terminal, Supabase |

## Sessions and folders

| Session | Model | Where | State |
|---|---|---|---|
| ALMAR controller (`local_836ffacc-…`, pinned) | Opus 5.5, xhigh | main checkout | the controller |
| job 04 worker | Opus 5.5 | `.claude/worktrees/repo-tidy` | handed over 03:44, stopped |

Archived 2026-10-02 on the owner's word (undoable): the retired control session, the 3 Phase 3.1 sessions and
the 14 Framer-era sessions. All ALMAR sessions sit in the sidebar group ALMAR. Each job's worktree is removed
the day it lands; `.claude/worktrees/repo-tidy` stays until job 04 lands.

## Reserved numbers

| Lane | Supabase migration |
|---|---|
| Phase 2 (job 02) | `20260925120000_platform_spine.sql`, named in plans 02-02 and 02-04; written on the job 02 branch, applied nowhere |
| Next | The controller hands them out and records them here at ship |

## Known, not fixed

| What | Where |
|---|---|
| Phase 3 has 13 of 13 summaries and no verification file | Controller report |
| The `chooseArabic` helper flakes under parallel Playwright workers | Run with `--workers=1` |
| The Playwright browser cache is shared by every project on this Mac; another project's install can remove build 1243 | Reinstall from this checkout: `npx playwright install --only-shell chromium` (a download: owner's OK) |
| Under heavy Mac load some journey-sheet a11y tests hit the 30 s page-load timeout | Rerun the file; it passed 45/45 on 2026-10-02 |
| After a DNS outage this Mac keeps the "no record" answer up to 30 minutes | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` (his terminal) |
| The Cloudflare Pages GitHub app may still be installed on `Loomlyne/almar` with no project behind it | Harmless; remove in GitHub settings if he wants |
| About 52 more card links answer 404 (7 destinations, 38 experiences, 7 services): job 04 lists them in `tests/no-dead-links.test.mjs` and hides none (his answer 2026-10-02) | Phases 3.3 and 6 |
| After job 04 the footer headings "Legal" and "Connect" stand with no links under them. He chose to keep the "Legal" heading; "Connect" emptied because its only link was the mislabelled one to the privacy policy | Phase 6, with the legal pages |
| The footer social links point at generic `facebook.com`, `instagram.com`, `youtube.com`, `tiktok.com`, not ALMAR accounts | Owner: the real handles |
| The 3 invented names are still in `framer-export/canvas-components.json` and the two `Evidence.dc.html` design-board copies under `.planning/design/`; neither is served | Whoever next touches those files |
| `vercel.json` was the only place with `X-Content-Type-Options: nosniff`; job 04 deletes it, so that header is gone until `_headers` gets the set | Phase 6 |
| The before/after screenshot spec covers only `/dashboard`, `/account`, `/login`, `/booking/trip`. The 26 Framer pages have no automated visual guard — only the 4 node test files and hand-taken screenshots | Phase 6 removes the Framer pages |
| `workers_dev = false` lands with job 04: at the next deploy the `almar.almar-private-journey.workers.dev` address stops answering. Apex and `www` are unaffected | Expected |
| Live pages: no `robots.txt`, no `sitemap.xml`, no security headers in `_headers`, root-relative canonical and `og:url` | Phase 6 |
| Live pages load Framer's CDN scripts and the hero video from `files.catbox.moe` (third-party, could vanish) | Phase 3.3 (React home) |
| The 6 service and blog detail pages are copies of their list pages with only title, meta and H1 changed | Phase 6 |
| Dashboard pages are hidden in production only by a per-page `NODE_ENV` 404 (23 files); no auth, no middleware | Job 02 |
| More shown-but-dead controls than W6 listed: Home date-range buttons, Maintenance switch, New booking / New customer / Calendar sidebars without save, an unused `<Sidebar open={false}>` in the ops layout | Job 03 (3.2) and Phase 5 |
| `SiteFooter` calls `useToast()` and no `ToastProvider` is mounted (not used on any page yet) | Whichever job mounts the footer |
| `@opennextjs/cloudflare`, `@supabase/ssr`, `@supabase/supabase-js` are installed but not imported yet | Job 02 |
| Next 16 (fixes the `postcss` alert) is blocked by the webpack hook in `next.config.ts` and the exact `next` pin in `tests/phase-02-gates.test.mjs:39` | Owner: when |
| Phone booking steps leave no room above the iPhone home bar | Phase 4 |
| AR and ES copy is draft for the owner's review | Owner |
| `npm run build` kills a running dev server | Restart it after a build |

## Owed by the controller

| What | When |
|---|---|
| Check each worker hand-over in a clean clone when he brings it | On his word |
| After each landing: delete the branch, close its PR, remove its worktree and build output | Same day |
| Copy the canvas again into a new dated folder under `.planning/design/` | Whenever the owner changes the canvas |
