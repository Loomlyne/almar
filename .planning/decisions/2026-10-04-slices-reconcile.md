# 2026-10-04 — controller's calls on slices 2–4, and the server-runtime job

Written by the controller ("ALMAR controller", `local_836ffacc-…`) on the owner's message of 2026-10-04 ~14:35 (+04):
"Slice 3 (job 08) design and plans signed: branch gsd/phase-3.3-slice-3 at 98a668f … Open the server-runtime
job (Phase 2 plan 02-08, OpenNext on Worker almar); plans 26, 27 and 29 wait on it. Reconcile items S3-5,
S3-6 and S3-11 need your call."

State read at 14:35: slice 2 signed at `4e29f8d` (plans 10–17), slice 3 signed at `98a668f` (plans 20–29),
slice 4 signed at `8095b67` (plans 30–33). **All three were cut from `84deec2`** (slice 1 after wave 3, before
its fixes). Slice 1 is now `0f33130` on GitHub plus plan 08 in progress.

## The calls

| Item | Call | Why |
|---|---|---|
| **S3-5** header over the About hero (`nav.tsx` `sticky` beats `absolute`) | **Already fixed in slice 1, no slot needed.** Slice 1's integration fix `2a92fac` (merged in `0f33130`) makes `tone="on-image"` give `absolute`, not `sticky`, via `cn()`. Plan 23 drops its `nav.tsx` edit and uses `tone="on-image"` as it is | The fix exists once, in the shared component, with its test (`tests/site-nav-tone.test.mjs`) |
| **S3-6** wordmark links to the current page (`public-frame.tsx` default `homeHref`) | **Already fixed in slice 1.** `a9d6362` (in `0f33130`) defaults `homeHref` to `localePath(locale, "/")`: `/`, `/ar/`, `/es/`. Plans 23 and 24 drop their explicit `homeHref` and rely on the default | One rule, tested by `tests/build/public-frame/public-frame.spec.ts` |
| **S3-11** media document list (slice 2 plan 12 `publicDocuments()` against slice 4 plan 32 extending `slice1Documents()`) | **`publicDocuments()` from slice 2's plan 12 is the one list.** It is computed from `PUBLIC_PAGES` and the published stay slugs, so a slice that adds a page to `PUBLIC_PAGES` gets its documents scanned with no other edit. Slice 4's plan 32 does **not** extend `slice1Documents()`; it adds its pages to `PUBLIC_PAGES` and relies on `publicDocuments()`. Slice 3's plan 22 the same. Whichever slice executes first without plan 12 on its base stops and asks, as plan 22 already says | One computed list, never three hand-kept ones; slice 2 lands first (below), so it is on the base for 3 and 4 |

## Landing order (controller's call, rule 4: one job at a time into the base)

1. Slice 1 (job 06), on the owner's Ship.
2. Slice 2 (job 07): carries `publicDocuments()` and `public/_redirects`.
3. Slice 3 part A (job 08, plans 20–25 and 28): the pages, no form.
4. Slice 4 (job 09).
5. The server-runtime job (job 10) lands when its own Ship comes; it may run in parallel with 2–4 in its own
   worktree, merging the base before its hand-over. Slice 3 part B (plans 26, 27, 29) runs after job 10 is on
   `main`, on a branch cut from `origin/main` (S3-14: part A lands alone and its branch is deleted).

## Every slice, before its first code task

Each slice's base is `84deec2`; slice 1 then changed files these plans name. Task 1 of each slice merges
`origin/main` (slice 1 landed) and re-reads these before editing:
- `components/pages/stay-detail/chrome.tsx` is deleted, `HomeNav` no longer exported; `HomeFrame` wraps
  `PublicFrame`; the stay page uses `PublicFrame` directly. Plans naming those files (slice 3 plan 27, S3-9)
  edit `PublicFrame` / `SiteFooter` instead.
- The footer text is one table, `lib/copy/site-footer.ts` (`SITE_FOOTER_COPY`); the per-page footer blocks in
  `lib/copy/home-page.ts`, `stays-list.ts`, `stay-detail.ts` are gone.
- `SectionHead` takes `headingLevel` 1–4 and `headingSize`.
- `PublicFrame.currency` is `false | { selected, onChange }`; the phone prints `+971 56 388 3302`.
- `lib/data/media.ts` points at `https://media.almarprivatejourney.com` (flag false).
- Plan 08: `scripts/assemble-cloudflare.mjs --target=local|preview|production`, preview builds into
  `out-preview/`, `scripts/crawl-files.mjs`, `wrangler.preview.toml`.
A plan step that no longer applies is reported in its summary, not forced.
