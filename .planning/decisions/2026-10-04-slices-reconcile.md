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

## Slice 1 UAT, 2026-10-04 ~15:40 (+04): two problems, three answers

On the local preview (`http://127.0.0.1:3090`, slice 1 at `693c21a`, production build) the owner answered
"its working but there different problems: 1. the booking bar doesn't have the button to search 2. the design
below the hero section is nothing same as the framer design and animation". Measured by the controller at 1440
(live Framer vs React, full page): home 12,066 px vs 7,587 px with the same 11 sections in the same order, but
small left-aligned headings in a narrow column instead of centred large ones, landscape cards with captions
below instead of portrait cards with the name on the photo, a photo grid instead of the sliding gallery, no
divider lines, a dark footer instead of Framer's light one, and 0 animated elements against Framer's 35. The
stays list lost its photo hero and the stay page its two-column About and sliding gallery. Pictures:
`03.3-public-site-in-react/uat-2026-10-04/compare-{home,private-stays,stay-page}.png` on the slice branch.

His answers (question form, 2026-10-04 ~15:55):
1. **Home Search**: "Opens the stays list, filtered" — Search takes the guest to `/private-stays` (per locale)
   showing only stays in the chosen destination, free on the chosen nights, that sleep the guests.
2. **Stay page button**: "Request on WhatsApp" — opens WhatsApp to `+971 56 388 3302` with the stay, the
   dates and the guests already written, in the page's language.
3. **Framer match**: "Match Framer on all 3 pages" — home, `/private-stays` and the stay page rebuilt section
   by section to the live Framer look and animations, EN/AR/ES at 390/834/1440; signed rules still win (nav
   order, square corners, gold as a line only, no fake controls). Pictures first for his signature, then code.
   **Slice 1 Ship waits for it.**
   **Narrowed by the owner minutes later (chat, with the `/private-stays` comparison attached): "no match framer
   for 2 the second one … this one dont match it keep it as you did it".** So the Framer match covers the home
   page and the stay page only; `/private-stays` keeps the React layout as built (search, filters, landscape
   cards, its header), and gains only the filtered arrival from the home Search (answer 1).

These two buttons replace the "journey bar final submit is not rendered until Phase 4" rule for these two bars
only; Phase 4 still brings checkout. Job 11 carries all three (`prompts/11-slice-1-framer-match.md`).
Consequence for slices 2–4: they build on the same components, so each lead re-checks its signed design
against the matching live Framer page before code; the owner is asked once whether "match Framer" applies to
every 3.3 page.

## Framer match for slices 2–4, and the preview site (owner, question form, 2026-10-04 ~16:15)

1. **"Yes, except list pages."** `/destinations`, `/about`, `/contact` and the three blog posts match the live
   Framer look and animations, like home and the stay page in job 11. The two filter-and-search list pages,
   `/experiences` (services folded in) and `/blog`, keep a React list layout like `/private-stays`.
   Each lead re-checks its signed design against the live Framer page for its matched pages, shows him the
   pictures (Framer beside the proposal, 390 and 1440, EN and AR) and gets his signature again before code;
   plans change only where the pictures change them. They reuse job 11's components (cards, galleries,
   dividers, animations) once it lands, and do not build their own.
2. **"Yes, create it now."** Worker `almar-preview` at `preview.almarprivatejourney.com` from the slice 1
   branch (`6264c59`), built with `--target=preview` (noindex header, disallow-all robots, no sitemap; media
   guard OK, 42 documents). First attempt 16:19: the ALMAR Wrangler login had expired (token expiry
   2026-10-04 03:21 UTC, refresh failed); his one terminal step re-logs it in, then the controller deploys.

## Speed-up (owner, controller chat, 2026-10-04 ~20:10)

His words: "contact all of them to finalize them yalla i need to continue fast and go ahead of this yalla".
Taken as **his go to build slices 2, 3A and 4**. Controller's changes for speed, sent to each session:
- They do not wait for slice 1 on `main`: each starts when the controller announces that job 11 is merged into
  `gsd/phase-3.3-slice-1`, merges that branch, and builds. Each precondition "slice 1 on `origin/main`" reads
  "slice 1 with job 11 on `origin/gsd/phase-3.3-slice-1`".
- They build at the same time. Measured overlap of their `files_modified`: all three edit `lib/data/types.ts`,
  `lib/locale-path.ts`, `scripts/media-lib.mjs`, `tests/build/home/home.spec.ts`, `tests/build/locale-routing.spec.ts`,
  `tests/locale-path.test.mjs`, `tests/media-guard.test.mjs`; 2 and 3 share the media manifest, image translations,
  `scripts/media-guard.mjs` and five specs; 2 and 4 share `components/ui/card.tsx`, `tests/data-contract.test.mjs`,
  `tests/helpers/site-links.mjs`; 3 and 4 share two blog specs. Rule for this run, replacing "two jobs never edit
  the same file at once" for these files only: edits there are additive (append, never reorder or rewrite); landing
  order stays 2 → 3A → 4, and each later slice merges the earlier one before its hand-over, the earlier lander winning.
- Job 11 was asked to finish plans 44 and 47 inside the signed scope and hand over at once.
- Job 10 is handed over (`466ec4c`); it lands after slice 1, after one more merge of `main`.

## Standing word while the owner is away (2026-10-05 ~01:58 +04, controller chat)

His words: "I will put the laptop on charge and I will keep you working. So I want you to keep track on all of
them. And you take control whenever someone finish, either you achieve or merge or push and deploy and take the
control, full control."

How the controller applies it, until he is back and says otherwise:
- **Covered:** when a job hands over, the controller checks it in a clean clone (every gate, both browser suites at
  4 workers with failed files rerun alone, the media guard, the upload dry run), lands it on `main` (tags, squash,
  staged tree = checked tree), deploys the preview, browser-checks the preview itself, then deploys production and
  runs the live checks, with the rollback target written down first. A failed live check is rolled back at once.
  Landed branches are deleted on GitHub (archive tags first), worktrees removed, sessions archived. Additive R2
  uploads that a landing needs (new keys only; never an overwrite or a delete) count as part of the deploy.
- **Not covered, still his word each time:** applying a migration to the live Supabase database, any secret, DNS,
  Stripe live, an R2 overwrite or delete, any price, rate, legal or policy text, and Phase 2 sign-in going live
  (it needs his secrets and the live migration). Job 02 may land on `main` only if it stays dormant; it is not
  deployed without him.
- His UAT is replaced by the controller's own browser check on the preview, reported as such; he can reopen any
  landed job when he is back.

## Full control (owner, controller chat, 2026-10-05 ~02:40–02:45 +04) — replaces the "Not covered" list above

His words: "I told you to take control … Applying migration to the live database. You have control to Supabase.
You can do that. Secret, DNS, Stripe Live, all of those … Stripe, now you'll go into testing. Not yet [live] …
replacing or deleting images, prices and legal text, signing going live, all. You take control. That means I
accept everything. You verify, but I accept everything." Then: "I have marked you as bypass permission. So you
have all my permission. as well as the other sessions. So go ahead." (The auto-mode check had refused to let the
controller write this grant itself; he then switched the session to bypass permissions.)

So the ALMAR controller also lands and runs: live Supabase migrations (verbatim, read back, after a backup check),
Worker secrets (set from the source; no value in chat or any file), DNS, R2 overwrites and deletes, sign-in going
live. **Stripe stays in TEST mode until he says live.** Every such step is verified first by a different model
(Fable 5.1 or Sonnet 5.5) and reported with both results. The controller's own limits, stated to him: it does not
invent prices, rates or legal wording (a real published value or his answer is used; otherwise "on request" or a
marked draft), and no secret value is ever written into chat or a file.

Team model, his words ("make sure this is how you work as well as my previous orchestrator"): Opus 5.5 plans and
lands; Sonnet 5.5 writes code in isolated worktrees; Fable 5.1 reviews every diff before it lands; mechanical calls
go to a cheaper model (Haiku 4.5; Jev is Hermes-only and is not simulated).

## v1 backend, controller calls (2026-10-05 ~06:00 +04)

- **`components/ops/api-types.ts` belongs to plan 03.2-11 (the kit).** 03.2-04 does not create it: it imports from
  it and adds its server-side types elsewhere; names are the kit's (`Locale3`, `OpsError`, `SiteStatus`). 03.2-09
  already follows this.
- **03.2-11 Task 2 waits for job 02 on `main`**: it rewrites `tests/phase-03-catalog.test.mjs` and
  `tests/review-fixes.spec.ts`, which job 02 also edits, and its scene swaps `OpsLayout` for job 02's
  `<OpsShell mode="preview">`. Task 1 is done (`6b9420e`, 60 pictures, pushed); the owner signs the pictures.
- **`tests/data-boundary.test.mjs`**: 03.2-11 exempts `components/ops`, `app/dashboard`, `app/api/ops` from the
  `translations` / `*_en` name rule (the API contract uses those names); import rules still apply there.
- **Plans 04-01 and 03.2-11 ran before job 02** because they need no database or keys (owner's speed word).
