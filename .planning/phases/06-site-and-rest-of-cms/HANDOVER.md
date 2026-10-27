# Phase 6 plans: hand-over (job 24)

**Branch:** `gsd/phase-6-plan`. Plans commit `c39f4cef`, merged with `origin/main` `0f8f6091` (job 21 landed) as `f66f8268`.
The hand-over commit follows. Written 2026-10-25 22:30 CET. Planning files only: no code, no migration file, no tests.

## What is here
- `06-CONTEXT.md`: discuss is **signed**. The owner chose A on all 12 questions, in the controller chat ("All 12
  recommended (A) for Phase 6.") and again in job 24's question form. The decisions are F-00a…F-15.
- `decisions/2026-10-21-phase-6-discuss.md`: the answer record. This job wrote it at the controller's request.
- Seven plans:

| Plan | Wave | Depends on | Covers |
|---|---|---|---|
| 06-01 Schema, data contracts, translation lock | 1 | none | I18N-04; every Phase 6 table, view and function in **one** migration; fixture import |
| 06-02 Pages + header/footer links | 2 | 06-01 | CMS-07, CMS-09, SITE-01, SITE-02, SITE-13, PLAT-03 |
| 06-03 Blog | 2 | 06-01 | SITE-10 |
| 06-04 Legal, cookie banner, analytics, robots/sitemap/headers | 3 | 06-01, 06-02 | SITE-07, SITE-09, SITE-11 |
| 06-05 Plan with us, List with us, consultation, dashboard Requests | 3 | 06-01, 06-02 | SITE-03, SITE-04, SITE-05, SITE-06, SITE-12 |
| 06-06 Packages v1, package page, request | 4 | 06-01, 06-02, 06-05 | CMS-03, BOOK-05, ADDN-03 |
| 06-07 Share, saved stays | 3 | 06-01, 06-02 | BOOK-06, BOOK-07 |

Already done before this phase (cited as evidence, not rebuilt): SITE-08 newsletter, SITE-12 on the existing forms,
CMS-08 Team, floating WhatsApp. OPS-12 promo codes move to v1.1 with PAY-05 (F-11).

Each plan opens with pictures (real tokens, 390/834/1440, EN/AR/ES), then the owner's signature, then code.

## Checks
- Plan check (gsd-plan-checker, Opus): first run **FAIL**, 3 blockers and 12 warnings. All 3 blockers and warnings
  4–10, 13 and 14 are fixed in `c39f4cef`. I checked the blocker fixes by grep. I did not run the checker again.
- `tsc`, `tokens:check`, node, build, Playwright: not run (owner: no test; and no code changed).

## The controller needs to do
1. **Migration number: reserved** `20261025120000_site_cms.sql` (controller, 2026-10-25; runs after Phase 4's 20261019160000 and 20261019170000). It now also carries
   `stay_is_published` and `booking_terms_current`, plus the slot names for the Experiences and Contact heroes.
2. **Shared-file slots**, listed per plan in each `files_modified`. The main collisions are `public-frame.tsx`,
   `footer.tsx`, the public page components and `ops-shell.tsx`. Waves 2, 3 and 4 order them.
3. **Owner gates**, one numbered step each, inside the plans:
   - 06-04: turn on Cloudflare Web Analytics and get the beacon token. The token is not secret and lives in
     `lib/analytics-config.ts`.
   - 06-05 and 06-06: `SUPABASE_SERVICE_ROLE_KEY` on Worker `almar`, only if it is missing. Pipe it, never print it,
     and have a different model check the step first.
   - Live migration apply: only after the wave 2-4 pictures are signed; any schema change from those signatures folds into `20261025120000_site_cms.sql` before it goes live (no second migration).

## Proposed planning changes (controller applies)
- **ROADMAP Phase 6:**
  - Replace "Plans: TBD" with the seven plans above.
  - Criterion 4 drops "promo codes CMS works": OPS-12 → v1.1.
  - Criterion 1 says the page replacement is done (3.3).
- **REQUIREMENTS:**
  - OPS-12 → v1.1 (with PAY-05).
  - SITE-07 → "necessary + analytics; marketing when a tool exists" (F-05).
  - BOOK-05 → "package page → request, owner prices it" (F-01, replaces the `/booking/trip` wording).
  - SITE-08 also covers the List with us footer link (06-05).
- **Phase 4 (job 25 or a board item)** (checker W11): published booking terms only open the Phase 4 request
  checkbox if Phase 4 reads 06-04's `bookingTermsGate`. 06-04 names the two call sites. Without that edit,
  `BOOKING_TERMS_IS_PLACEHOLDER` stays the gate and fails closed.
- **06-02 picture signature** (checker W12): it asks whether page heroes are always shown (recommended, keeps the
  booking bar) or hideable. Record the answer as an F-09 amendment in `decisions/`.

## Not done / open
- Checker W15 (plan size, not changed): 06-01 has ~40 files and 06-04 ~55. The checker suggested splitting 06-04
  (legal + cookies / crawl + headers + booking terms) and moving 06-01's kit wiring into its own plan. Split at
  execute time if an executor stalls.
- `[bracketed]` numbers wait for the owner's signature: consultation notice [24 h], horizon [30 days] and consent
  cookie lifetime [180 days]. Until they are filled, the consultation calendar stays closed.
- The plans name job 21's paths from its branch. Job 21 is now on `main` (`0f8f6091`), and each plan's Task 1 base
  check re-reads them.

## Lessons
- The auto-mode classifier blocked recording a relayed owner answer as "signed". Confirming it in this session's own
  question form fixed it. A peer relay alone is not owner input.
- The first plan check caught a real RLS failure (`authenticated` has no select on `stays`) that unrun pgTAP would
  have let reach live. A plan check matters more when tests do not run.

GSD: `/gsd-execute-phase 6` fits next, wave by wave (wave 1 = 06-01 alone).
Jev: 06-05 Requests triage, scoring an incoming request's kind and urgency (advisory, logged), fits on the owner's
word. Automation: a daily unattended digest of unhandled Requests to inquiries@ (proposal only).

---

# 06-01 executed: hand-over (job 26)

Written 2026-10-27 23:00 +0100 (from `date`). Branch `phase-06-site-and-rest-of-cms`, last code commit `eaec4c04`;
this hand-over and `06-01-SUMMARY.md` are the commit after it. origin/main (`8d2bc5e3`) merged at `97a68aaa`; it had
not moved at hand-over. Folder clean.

## What is here
Commits in order: `6fc08bb3` pictures · `c23cd3e8` Task 4 (data contracts, readers on the views, import script) ·
`00939cfc` slot files (lock copy, `applyImport`) · `e24155d7` Task 3 migration + pgTAP · `b69a6e08` migration review
answers + `ops_list_media` alt locks · `ee17c151` Tasks 5–6 (lock in the kit and every editor) · `97a68aaa` merge ·
`eaec4c04` kit review answers. Details: `06-01-SUMMARY.md`.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass on `eaec4c04` |
| `npm run tokens:check` | pass ("theme up to date") |
| node tests, pgTAP, build, Playwright, import dry run | **not run (owner: no test)** |

Written and not run: `tests/site-cms-import.test.mjs`, `tests/page-blocks.test.mjs`,
`tests/data-source-site-cms.test.mjs`, `tests/ops-translation-lock.test.mjs`, `tests/helpers/site-cms-views.mjs`,
`supabase/tests/site_cms.test.sql` (plan 225); updated: `tests/data-source.test.mjs`, `tests/ops-kit.test.mjs`,
`tests/catalog-forms.test.mjs`, `tests/ops-media.test.mjs`, `supabase/tests/catalog_schema.test.sql`.

## Migration `20261025120000_site_cms.sql` (not applied; the controller applies it after the wave 2–4 signatures)
- Additive: 24 new tables, 14 views, new columns `locked_fields text[] default '{}'` on the ar/es translation tables
  and `stay_access.notes_locked`. No column dropped or renamed, no row deleted.
- Replaced functions (same signatures): the catalog save functions (set `locked_fields` as sent, never merged),
  `ops_list_media` from `20261012120000` (adds `alt_locked {ar, es}`, same order and paging), the journey delete
  (F-02: `almar:not_found` for a seeded journey's missing row; `catalog_schema.test.sql` follows).
- The app runs before and after it: shape reads `locked_fields`/`notes_locked` as `[]` when absent, and the stay
  access read is `select("*")` for that reason.
- No env names added. No secret, no Worker or DNS change.

## Reviews (`jev-review`, author Opus)
- Migration: deep tier. Pass 1 Sonnet: ship. Pass 2 is **Fable**, which needs the owner's yes: not asked here.
- Kit and screens: Sonnet, verdict "fix first". All seven answered in `eaec4c04`:
  locks dropped on read (shape) · stay access never read `notes_locked` · lock-only change not dirty · a blank box
  still locked · focus lost after Translate again · stay-access `aria-describedby` hid the error id · a stale
  Translate again reply for another stay. Not re-reviewed after the fixes.

## Open (for the controller or the named plan)
- `consult_slots` builds every slot of the horizon per call: make it cheaper before 06-05 opens it publicly.
- anon can read uuids of unpublished rows through base-table grants used by the views: accepted (no text exposed).
- Unpublished seeded journeys can now be deleted (F-02): add a guard if the owner wants seeded ones kept.
- `ops_save_consult` casts with `::int`: a non-number raises a raw error instead of `almar:invalid`.
- `ops_list('journey_tier')` returns no legs: 06-06 reads them through the detail call.
- pgTAP gaps the review named: lock set/clear per table, `ops_list_page` hidden sections.
- `parseBody` refuses post photo blocks until 06-03 adds them.
- `tests/fixtures-frozen` may need page blocks and posts frozen once the import runs on live.
- Media Publish (`persist(alt, true)`) sends no `locked` key: the server keeps the stored alt locks.

## Owner's check (once the migration is on a local stack or live)
1. Open Catalog › Destinations › any destination.
2. Click Edit translations, type an Arabic name, click Save. Expected: the Arabic box shows "Your own text…" with
   Translate again.
3. Reload the page and open it again. Expected: the lock line is still there.
4. Change the English name, click Save. Expected: the Arabic stays as you typed it; Spanish updates.
5. Click Translate again under the Arabic. Expected: the box refills from the English and the lock line goes;
   the page says unsaved; Save keeps it.
6. Same in Stays › a stay › Access › Notes, and in Media › a photo's alt text.

## Proposed planning changes
None beyond job 24's list above.

## Lessons
- A lock that is only written and never read back passes every type check: the kit review caught it. Check the
  read path (shape, list functions) whenever a new column is saved.
- The kit's Field spreads extra props after its own, so a passed `aria-describedby` replaces the error id: merge it.

---

# 06-02 and 06-03 executed: hand-over (job 26)

Written 2026-10-28 00:13 +0100 (from `date`). Branch `phase-06-site-and-rest-of-cms`. origin/main `6558cb6f` merged
at `34e829d1`; this hand-over is the commit after it. Details: `06-02-SUMMARY.md`, `06-03-SUMMARY.md`.

## Migration: Fable pass 2 (owner-approved), verdict APPLY
Read at `65f2500d`; no fix-first item. Its three low findings are fixed in `f4c53751`:
1. `ops_save_consult` wrote `(p->>'notice_hours')::int` after the numeric check, so JSON `5.0` raised a raw 22P02:
   it now writes `trunc(v_n)::int` from the checked number (notice and horizon).
2. `site_request_payload_ok` (and `site_request_date_ok`, which it calls) were `immutable` with `::date` /
   `::timestamptz` casts: now `stable`. They are a table check only, never an index.
3. `ops_save_post` cast `published_at` unchecked: a day or ISO time is checked first, anything else is `almar:invalid`
   `published_at`.
pgTAP: plan 225 → 230 (two published_at cases, 24.0/30.0 stored, both checks stable). Written, not run.
**`20261025120000_site_cms.sql` now: 3,339 lines, sha256 `0906af3c9c7573b7cdd12a8b634dd73f8e4df211dab853f2c62e5c922c8c2470`.**
Reviewer's note: `23460bfe` (after the 06-01 hand-over) changed `page_section_slots()` Home order; SQL and
`lib/data/page-sections.ts` agree.

## Commits since the 06-01 hand-over
`ed303ec9` / `65f2500d` pictures · `57cb4cc0` 06-02 owner API + nav snapshot · `a1261025` 06-03 owner API + chunked
translate · `c7eb2544` heroes always shown · `a1bb228f`, `dd156103` copy · `8f1503d4` first review answers ·
`0fd430d8` kit `status` prop (slot 8) · `4d3f997b` Pages and Navigation screens · `cfeba43e` their specs ·
`eda622e1` public pages · `1250db22` public blog · `57f99c2d` Blog screen · `74b9afd0` blog tests · `f4c53751`
Fable answers · `99ccec0e` slots 1–7, 9, 10 · `7f69ba3f` second review answers · `34e829d1` merge.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass on `34e829d1` |
| `npm run tokens:check` | pass ("theme up to date") |
| node tests, pgTAP, build, Playwright | **not run (owner: no test)** |

## Before the first supabase-mode build (controller runbook)
`getPageContent` stops the build when a page has no row in `api_page_sections`, and the assemble writes the nav snapshot
from `api_nav_links` (a bad read stops it). So the import runs after the migration and before any `--target=preview` or
`--target=production` build. Run these in the main checkout on the landed `main`:
1. Apply `supabase/migrations/20261025120000_site_cms.sql` (3,339 lines, sha256 above) and read it back.
2. Dry run (no network, no client; prints each table's row count and every skipped value; it must end with "dry run:
   nothing was sent"):
   `node scripts/import-site-content.mjs --out /Users/koss/.almar-import/site-content-payload.json`
3. Apply to live, in the controller's terminal only. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are exported from
   the Supabase CLI output by a pipe, never printed or saved:
   `node scripts/import-site-content.mjs --apply --project-ref jkdkaldgeiowkhlfmsft`
   It is one `import_site_content` rpc in one transaction with `on conflict do nothing`, so a second run writes nothing new.
4. Read back (anon views): `api_page_sections` holds rows for home, about, destinations, experiences and contact;
   `api_nav_links` holds today's header and footer links; `api_posts` holds the three posts.
5. Then the usual pre-deploy checks (`parity-build.mjs --live --keep`, media dry run), then assemble.

The 256 KiB cap is on `/api/ops/posts` only, after `requireOwner`. OpenNext reads the whole body on Workers (Free plan,
10 ms CPU) whatever the cap, so a large post save costs CPU on that route.

## Reviews (`jev-review`, author Opus)
- Range `8f1503d4..74b9afd0`: standard tier, Sonnet, "fix first", 9 findings. Fixed: 1, 2, 3, 4, 5, 6, 7 and the
  comment in 8. Finding 8's reflow claim was wrong (the net `blog.ts` diff is the four search keys). Not changed: 9 (search
  text size). List in each SUMMARY. Not re-reviewed after `7f69ba3f`.

## Owner's check (after the migration, the import and a preview build)
1. Open the dashboard, Content › Pages › Home. Expected: the sections in page order; the first one says it is always shown.
2. Open Welcome, change the heading, click Save and update site. Expected: the Arabic and Spanish fill in; the
   preview home shows the new heading in each language.
3. Open Gallery, switch Show on site off, Save. Expected: the preview home has no gallery.
4. Content › Navigation and footer: add a header link to Contact, Save. Expected: the preview header shows it in all
   three languages.
5. Content › Blog › New post: title, excerpt, a paragraph, a photo; click Publish. Expected: `/en/blog` lists it;
   the post shows the photo; its address can no longer be changed.
6. On `/es/blog`, type part of a title without its accents. Expected: only matching stories; a word that matches
   nothing says so with Clear; Escape brings all back.

## Open
- `trip-screen` and `booking-page-view` still build their own links (outside both plans).
- No harness scenes or picture specs for 06-02/06-03 (the pictures were HTML).
- No unit test for the AR/ES body kind-order check (`lib/data/posts.ts`).
- Fable second pass on this range: not asked (needs the owner's yes).

GSD: `/gsd-verify-work 6` fits once the live import has run (the six checks above). Jev: none fits these two plans
(no bounded decision in them). Automation: a nightly unattended check that every published post's AR/ES body still
matches English in kind and order, reporting the posts that fall back (proposal only).
