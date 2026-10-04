# Handoff to "ALMAR controller", 2026-10-03

Owner's decision (2026-10-03): the Desktop session **"ALMAR controller"** takes ALMAR control back after Phase
3.3 slice 1, wave 1. Written by the session that ran slice 1 planning and wave 1 (thread
`9d91b779-0f49-4d76-add3-00bc9ca265a6`, continued as `almarprod-website-code-d4`). That session stands down
with this file: no further commits on `main`, no push of `main` beyond this note, no deploy. Planning note
only: no code on `main`, nothing deployed.

## Live

- Worker `almar` on account `f1d9a1fa…`: version **`f9ba2378`** (job 05, `main` `2180b14`), read from
  Cloudflare at 16:31 (+04). `https://almarprivatejourney.com/` answers 200. Unchanged by slice 1.
- `main` on GitHub: `834955c` before this note.

## Phase 3.3 slice 1: where it stands

Branch **`gsd/phase-3.3-slice-1`**, pushed at **`acdeba7`**. Plans 01–08 signed 2026-10-03; the owner's page
is `.planning/phases/03.3-public-site-in-react/03.3-01-PLAN-SUMMARY.md`, overlaps settled in `03.3-RECONCILE.md`.

| Wave | Plan | State |
|---|---|---|
| 1 | 01 data layer | **merged** `da93059`; summary `03.3-01-SUMMARY.md` |
| 1 | 02 shared primitives, extensions, journey bar without a submit | **merged** `c0e3de5`; summary `03.3-02-SUMMARY.md` |
| 1 | 03 per-locale addresses, assembler, three 404s, PublicFrame | **merged** `9a13f9a`; summary `03.3-03-SUMMARY.md` |
| 2 | 07 images (R2) | **not started.** It was started early and stopped on the owner's line; its empty worktree was removed |
| 3 | 04 home, 05 `/private-stays`, 06 the 12 stay pages | not started |
| 4 | 08 preview host, `robots.txt`, `sitemap.xml`, hand-over | not started |

### What happened in wave 1

1. Three Sonnet 5.5 executors ran in `.claude/worktrees/phase-3.3-w1-p0{1,2,3}`, cut from the slice branch at `b842408`.
2. Plans 01 and 03 finished and were merged and checked (tsc clean, 281/281 node tests).
3. **Plan 03 hit the design-system guard against raw HTML.** One exception was allowed: the organisation JSON-LD
   file only, and only while its content is a fixed string with no visitor input (`f15a1ae`). The guard was shown to
   still fail if variable data is put there.
4. **The plan 02 executor stopped at 03:10 with task 5 written but not committed**, and the session that launched
   it ended before it reported. On 2026-10-03 afternoon the work was checked and committed (`dcd3430`), the summary written
   (`9258a0f`) and merged. Task 5 turns blocked days into struck-through days, so the three existing
   `journey-bar-stay-{en,ar,es}-1440.png` baselines changed on exactly 20 and 21 October; checked in the diff
   image and updated, no spec edited.
5. With plan 02 in, `PublicFrame` lost plan 03's interim casts and TODO and now passes plan 02's real
   `SiteNav` / `SiteFooter` props (`acdeba7`). The newsletter form, Login and cart are off in the frame.
6. A leftover `wrangler dev` from the plan 03 executor (13 h old, cwd `…-w1-p03`) was stopped by its PID.

### Checks on the merged slice branch (`acdeba7`), 2026-10-03

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run tokens:check` | clean |
| `node --test tests/*.test.mjs` | 296 / 296 |
| `node scripts/assemble-cloudflare.mjs` | 29 HTML: 26 Framer, React en 0 / ar 0 / es 0, three 404s |
| `node --test tests/build/assembled-site.test.mjs` | 58 / 58 |
| `playwright -c playwright.build.config.ts -g "404 status\|server rules"` | 19 / 19 |
| `playwright test` (full suite, port 3047) | 1,699 passed, 28 skipped, 1 failed: `add-on-row / phone-row / en / 390` screenshot (no wave 1 plan touches it); rerun alone 9 / 9 passed across en, ar, es × 3 repeats, so a load flake |

**Expected, not a failure:** the unfiltered build suite (`tests/build/locale-routing.spec.ts`) fails on every
routing, language-link and language-select test until wave 3 adds the React home and stay pages. Plan 03's
summary records the same thing. Run it unfiltered only after wave 3.

## Next step for the controller

1. Start wave 2 (plan 07, images) from `gsd/phase-3.3-slice-1` at the pushed tip. It needs R2 for the upload only.
2. Then wave 3 (plans 04, 05, 06 in parallel), then wave 4 (plan 08).
3. Plan 01 found that the live stay pages publish **7 experiences**, not 5: the stay-page plans must expect 7.

## Open gates (the owner's)

1. **R2.** On 2026-10-03 at 16:31 (+04), `cf r2 buckets list` on `f1d9a1fa…` answered with an empty list, not error 10042, so R2
   looks enabled; **no bucket exists.** Next: his word for bucket `almar-media` and hostname
   `media.almarprivatejourney.com`.
2. **Real nightly rates and minimum stays** for the 12 stays. Until then stay pages show no amount and no minimum.
3. **The hero video file** (the live one loads from `files.catbox.moe`).
4. **His review of the draft Arabic and Spanish:** the 12 stays, the 404 page, and "Converted at the exchange
   rate of {date}."
5. **Two stays show "— bathrooms / — beds"** on the live site (Framer left them blank); carried over word for word.
6. At slice 1 hand-over: Worker `almar-preview` with `preview.almarprivatejourney.com` (board item 5).

## Uncommitted or local-only, as of this note

- Nothing uncommitted in any ALMAR worktree.
- Local branches `gsd/phase-3.3-s1-p01`, `-p02`, `-p03` are fully contained in the pushed slice branch.
- `note/phase-3.2-recheck` (`cbb3372`, one planning file) was local-only: archived today as tag
  **`archive/phase-3.2-recheck`** on GitHub.
- Worktrees still on disk: `phase-3.3-slice-1`, `phase-3.3-w1-p01`, `-p02`, `-p03` (the three plan worktrees
  can be removed: their branches are inside the slice branch), and the older `footer-contact`,
  `footer-contact-click`, `phase-3.2-recheck` (board item 6).
- Before the next deploy: `npm ci` in the main checkout (wrangler 4.141 installed, 4.146.0 pinned).
- Wrangler under `HOME=/Users/koss/.almar-cloudflare` answered "needs CLOUDFLARE_API_TOKEN" in this
  non-interactive session; the `cf` CLI read the deployments fine.
