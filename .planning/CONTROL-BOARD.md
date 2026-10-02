# Control board

Kept by the controller: the Mac session "ALMAR controller" (`local_836ffacc-ca03-41c4-b1ff-385b8aa9d357`,
pinned, sidebar group ALMAR) in the main checkout, since 2026-10-02 00:05 (+04), on the owner's choice. The
claude.ai project ran 2026-10-01 11:08–19:27 UTC; its record is `HANDOFF-2026-10-01-projects.md`. One page:
what is live, what is being built, what waits for the owner, what comes next. Updated at every hand-over and
every landing. The goal: `GOAL.md`. The rules: `prompts/00-common-rules.md`; decisions
`decisions/2026-10-01-control-session.md`.

**Last update:** 2026-10-02 13:05 (+04), by the controller session `local_836ffacc-…` (owner's word, 13:00: this
session stays control). Job 04 **landed** as `97005a0` and **deployed** (`b769e01a`, 12:35) — by a second session,
outside the gate and without the footer follow-up the owner had asked for first. Job 04's substance is live and
correct. **The footer follow-up is not done and the pushed branch for it is broken — see the warning below.**
Next after it: job 02.

### ⚠ Do not land `fix/footer-contact` (`2350b51`)

That branch is on GitHub and sets the footer Contact anchor's `href` to `/contact` on the 20 footer pages. The
controller tested it in Chromium on a real build (2026-10-02 13:00): the link renders, is visible and reads
`href="/contact"`, but **a plain click navigates to `/legal/privacy-policy`** — Framer's own client router handles
the click and ignores the server href. It is a fake control. `1e6d19d` on the local `fix/repo-tidy` has
byte-identical code and the same defect; it is archived as tag `archive/repo-tidy-contact-fix`.
The owner's answer (13:02, question form): keep the link and add a small capture-phase click delegate that forces
`/contact`. Verified working by the controller: a plain click then lands on `/contact`, 200. Without the script the
plain `href` still navigates correctly, so the fallback is safe. Being built on `fix/footer-contact-click`.
Lesson for every Framer page: a markup-only link fix cannot be trusted — the guard must click the link and assert
the URL, which is why the node tests passed on a broken link.
over on `fix/repo-tidy` (`6bc38f2`) and checked by the controller in a clean clone: it waits for the owner's Ship.
Then job 02 sign-in. Nothing is running.

## Live now

| Item | Value |
|---|---|
| Site | https://almarprivatejourney.com and https://www.almarprivatejourney.com serve `main` `97005a0`: all 26 public pages answer 200, byte-identical to the build on both hosts; none carries the three invented names, `almarprod.framer.website` or the 8 dead footer and stay links; unknown paths answer the branded 404 (read 2026-10-02 12:35). The footer shows "Legal" and "Connect" with no links until Phase 6. `/booking/trip`, `/account`, `/login`, `/dashboard`, `/fx`, `/newsletter`, `/__harness` answer 404. `dashboard.almarprivatejourney.com` has no DNS record |
| Worker `almar` | Account "Almar Private Journey" `f1d9a1fa3abdda98c15161b00b40385c` (now pinned in `wrangler.toml`). Version `b769e01a`, deployed 2026-10-02 12:35 (+04) from `97005a0` on the owner's word. Rollback targets `49112d4b` (3.1, `68df3b6`) and `99d76f13` (`2f82714`). Custom domains apex and `www` only: `workers_dev = false`, the workers.dev address answers 404. No secrets yet |
| Wrangler for ALMAR | `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler …` (ALMAR-only login). The default login and the claude.ai Cloudflare connector see only the Vamos account. `cf` CLI signed in to `f1d9a1fa…` only |
| Cleaned up 2026-10-02 | Old Worker `almar` on the Vamos account `e64b47de…` deleted (owner's word); Pages project `almar` (`almar-khb.pages.dev`, built every branch) deleted (owner's word). The Vamos account keeps only `vamos`, `vamos-dashboard`, `rolandscaping-mail`, untouched |
| GitHub `Loomlyne/almar` (private) | `main` = `97005a0` (job 04 squash) plus this planning note. Tags `backup/main-2026-10-02` (`014ae37`), `archive/ship-3.1` (`7e72c20`), `backup/main-2026-10-02-job04` (`9c89a1d`), `archive/repo-tidy` (`6bc38f2`, includes the screenshots commit left out of `main`). No open PRs. Branches: `main`; `claude/project-thread-8h6bed` (job 02's source) |
| This Mac | Main checkout on `main`, clean. Worktree `.claude/worktrees/repo-tidy` (local branch `fix/repo-tidy` = `6bc38f2`) **kept**: it holds 21 uncommitted files from 12:28, a follow-up that points the footer "Contact" link at `/contact` (probably the terminal session `almarprod-website-code-34`); removed only after that work is on its own branch on GitHub |
| Package alerts | `npm audit` on `main`: 2 left (high `postcss` inside `next`, moderate `next`); the fix is Next 16, a major (owner: when) |
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
| 04 | Repo tidy plus three live-page fixes (`prompts/04-repo-tidy.md`, 12 items) | done | — | **Landed** 2026-10-02 12:34 as `97005a0`; **deployed** 12:35 (`b769e01a`). Clean-clone check: 193/193 node tests, build, Playwright 1,113 passed, 28 skipped, 0 failed | Follow-up open, see the warning above |
| 02 | Phase 2 auth chain 02-08, 02-02, 02-03, 02-04 (`prompts/02-phase-2-auth-chain.md`) | one Mac worker, Opus lead, Sonnet executors | `.claude/worktrees/phase-02-auth`, `gsd/phase-02-auth-chain` | Built in the cloud on `claude/project-thread-8h6bed` (tip `3e2d58c`, 11 own commits, 216 unit tests); to be cherry-picked onto `main`, checked on the Mac, reviewed, then his 6 gates and 8 test steps. Also proposes W6 (sign-in, sign-out) and W7–W9. Migration `20260925120000` applied nowhere | After job 04 lands |
| 03 | Phase 3.2 catalogue and team (`prompts/03-phase-3.2-catalog-and-team.md`) | one Mac worker, Opus lead | `.claude/worktrees/phase-3.2`, `gsd/phase-3.2-catalog-and-team` | Prompt ready. Discuss may run while job 02 builds; code after job 02 lands. Takes W6 for Settings, Catalog, Content, Calendar, Experiences | Owner's go |
| later | 3.3 booking-path pages, 4 book and pay, 5 ops OS, 6 remaining pages | | | Roadmap. 3.3 shares W7–W9 with job 02 | |
| unassigned | 3.1 open items 3 and 4: hand-written font sizes in `app/globals.css:126-128` and `:133-135`, 9 repeated hexes in `settings-screen.tsx`; `object-left` logo in AR; English-only "Show/Hide password" and "Apply" in `field.tsx`; dead class hooks, unused `FRAMER_SOURCE_COPY`, checkbox, footer, `data-density`; `harness-client.tsx` pulling fixtures into the build | | | | Owner: which job |

Base for new branches: `origin/main` (`6416b51`). One job at a time into `main`; the next job merges the new
`main` first.

Branches open 2026-10-02 13:05: `fix/footer-contact` `2350b51` (on GitHub, **broken, do not land**);
`fix/footer-contact-click` (the controller's, being built, carries `2350b51` plus the click delegate and a
Playwright click guard); `fix/repo-tidy` `1e6d19d` (local, landed content plus the same broken fix, archived as
`archive/repo-tidy-contact-fix`, worktree to be removed).

## Waiting for the owner

| # | What | Where |
|---|---|---|
| 1 | Answered 13:00–13:02: this session stays control; the footer Contact link keeps its link plus the click delegate. **Still his to do: tell the second session to stop landing, deploying and pushing branches for ALMAR** — it landed and deployed job 04 at 12:34–12:35 and pushed the broken `fix/footer-contact` | His word, to that session |
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
