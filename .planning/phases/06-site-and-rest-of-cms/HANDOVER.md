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

---

# 06-04 executed: hand-over (job 26)

Written 2026-10-30 (from `date`). Branch `phase-06-site-and-rest-of-cms`. Details: `06-04-SUMMARY.md`.

## Publishing the booking terms: tell the owner at the landing
**Publishing the terms opens real requests only after `almar` is rebuilt and deployed**, and only if every other live gate condition holds (test host rule, link secret, mail ready, bank details, window). Publishing alone opens nothing. This state lasts until the next deploy he approves; it is not a matter of minutes.

The gate is open only when the live `booking_terms_current()` version equals the one the deployed build baked (`lib/booking/baked-terms.snapshot.json`, written by `scripts/write-booking-terms.mjs`; the build prints one line with the version or "no version baked"). A failed read at build bakes none: closed.

**These saves on Booking terms change the version, so they close requests again until the next deploy, even with the page still published:**
- the title in English, Arabic or Spanish;
- any block's text in any of the three languages (including a draft-status block row);
- adding, removing or reordering blocks, or moving text between blocks.

**These do not change it (requests stay open):** a block's kind (heading, paragraph, quote: the page changes, the gate does not); SEO title and description; `locked_fields`; re-saving identical text; any other legal page.

**Unpublishing** the terms, or any of the three translations leaving published, closes requests at once. Republishing unchanged text reopens them with no deploy, because the version is unchanged.

## Money row in Settings (`terms_final`)
It runs on `almar-ops` but reads **`almar`'s** bake: `https://almarprivatejourney.com/booking-terms-version.json`, a no-store file the public build writes. It says final only when the live version equals that one. Between publish and deploy, and after any save in the first list above, it says not final. A failed fetch says not final. **Not verified:** the same-zone fetch from `almar-ops` to `almar`; the controller checks it on the first real deploy. If it fails, the row stays not final (the safe direction) while requests may be open.

## Files the controller's conditions named
- `deploy/production/robots.txt`: adds `Disallow` for `/api/`, `/auth/`, `/<locale>/account`, `/<locale>/bookings` and the unprefixed two. Sitemap line unchanged.
- `_headers`: a `/*` block with nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, Permissions-Policy; `/booking-terms-version.json` no-store. Existing blocks unchanged. `deploy/preview/_headers` carries the same three.
- `worker/handle.mjs`: the three headers on Worker answers when absent (a route's own stays, so the auth hand-off keeps no-referrer), on the 413, and on the `/` 302 and legacy 301 (controller's yes). The redirect targets and `public/_redirects` are unchanged; no wrangler file touched, so `run_worker_first` and the booking pages' noindex are as they were.
- `scripts/assemble-cloudflare.mjs`: `expectedPublicPaths` + `assertSitemapCovers` (a missing path stops the build), and the bake.
- `lib/ops/route.ts`: `bodyLimit` 256 KiB also on `/api/ops/legal` (accepted by the controller), read after the owner and Origin checks; OpenNext reads the whole body on Workers.

## Migration: every change since `65f2500d` (Fable read that version)
Final at this hand-over: **3,350 lines, sha256 `4a43c764fb27cf34bf08915e20debf3acd87cb6b67f93a0cddbd9d0ad8a6a6e4`**.
1. `f4c53751`: `ops_save_consult` writes `trunc(v_n)::int`; `site_request_date_ok` and `site_request_payload_ok` are stable; `ops_save_post` checks `published_at` first.
2. `420641af`: `ops_save_legal_page` no longer refuses `blocks` on `cookie_banner`; its comment.
3. `258587cb`: `grant execute on booking_terms_current() to anon`; body and `security invoker` unchanged. The controller proves in the dry run that anon's hash equals the service role's.
4. `3960cf4b`: `consult_slots` rewritten as one set query (settings read once, dates clamped to notice and horizon, days off and booked as conditions); its signature and grants unchanged.
pgTAP: plan 232 (new cases for each; banner blocks and the anon call flipped). Not run.

## Reviews
Sonnet, deep tier. First pass "fix first"; re-review of the fixes "ship". Answered: gate before page, checkbox link, Money row, booking-page footer, redirect headers, ops bake, `cache` option on the Worker fetch. Beacon on token-bearing addresses: the owner's choice, see Open.
**Not fixed, on purpose:**
- one extra rpc per quote when a version is baked (none while nothing is baked);
- a block row with empty English drops its AR/ES text on save (same rule as the blog);
- a block's kind is not in the hash (controller's "keep the function body").

## Open
- `CF_WEB_ANALYTICS_TOKEN` is null: no banner, no Cookie settings and no beacon until the owner's Cloudflare step, even with the banner published.
- Trip and booking pages, Cookie settings: **signed B** (the link, banner and beacon as on every other page). Before `CF_WEB_ANALYTICS_TOKEN` is set, the controller confirms whether the beacon sends the query string on those addresses (stay, dates, link token) and reports that to the owner.
- `getPackageSlugs` is not on the base: 06-06 adds it to `expectedPublicPaths`.
- Not run: whether a build with an empty `[legal]` static-params list passes.

## Owner's check (after the import and a preview build)
1. Content › Legal. Expected: six kinds, each with its status.
2. Open Privacy policy, write a title and a paragraph, click Publish. Expected: Arabic and Spanish fill in; after the rebuild `/en/legal/privacy` shows your text and the footer has a Legal row.
3. Open Booking terms, write and publish. Expected: Settings still says terms not final; after the deploy it says final and the request step's box links your title in a new tab.
4. Edit one word of the booking terms. Expected: Settings says not final again until the next deploy.
5. Publish the Cookie banner (after the Cloudflare token step). Expected: first visit shows the banner; no `cloudflareinsights` request until Accept analytics.

Jev: none fits (bounded, deterministic gates only). Automation: a daily unattended check that the public version file equals the live `booking_terms_current()` version, emailing the owner when they differ (proposal only).

# 06-05 executed: hand-over (job 26)

Commits: see `06-05-SUMMARY.md`; tip of the plan `5c7e4e3f`. Also pushed here: `6a1a43f2` (06-04, the owner's B). Checks: `tsc` and `tokens:check` pass; nothing else ran (owner: no test).

## Migration: every change since the 06-04 hand-over
Final at this hand-over: **3,379 lines, sha256 `8af56ba2977f5567df4b456055e594b5ad1e4c0cc8ad3ce02f7fe205d9694980`**. Add to the four items in the 06-04 section; 5-7 in `5c7e4e3f`, 8-10 after it:
5. `site_request_payload_ok`: a phone needs at least 7 digits (`-------` passed before).
6. New `consult_is_open()`, service role only: the public slots read no longer loads `ops_get_consult`, which carries every upcoming guest's name and email.
7. `book_consultation`: an advisory lock on the email, taken before the slot's; the same email on a future start it already holds gets that booking back (a retry whose reply was lost, Resend's idempotency keys hold the emails); a third upcoming call for one email raises `almar:slot_limit` (removed in item 8).
8. The owner chose no limit on calls per email (2026-10-30): the count check, `slot_limit`, its 429 and its reason are gone; the email lock and the same-email retry stay.
9. The owner chose no limit on cities (2026-10-30): `site_request_payload_ok` cities 6 -> 50 and `ops_save_journey_tier` legs 12 -> 50, purely as a guard against malformed payloads; their comments. 
10. Add-ons (controller, 2026-10-30): `ops_save_journey_tier` addon_ids 30 -> 500, a guard only; `ops_get` no longer returns a home-pickup item in `addon_ids`, so the editor can never send it back and be refused. pgTAP plan 244.
pgTAP: plan 241 (new: `consult_is_open` closed, open, anon, guest; retry; a second and third call for one email booked; phone; 24:00 read-back; "booked twice" now uses a second email). Not run.

`to_char('24:00'::time, 'HH24:MI')` reads back `24:00` on the live database (controller, 2026-10-30).

## Reviews
Sonnet (`jev-review`: deep, "touches security"; Fable deferred to the whole PR, the owner's decision). Verdict "fix first", no high findings. All eight answered in `5c7e4e3f`, no re-review:
1. Owner email lost when the guest's brand failed: separate `try` blocks.
2. Phones with no digits: pattern, validator and SQL.
3. Anonymous slots read loaded guests' names and emails: `consult_is_open()`.
4. One script could book every slot and mail any address: **not limited, the owner's choice (2026-10-30).** The brake is `FORM_LIMITER`, bound at 5 a minute per IP in `wrangler.toml` and `wrangler.preview.toml`.
5. A failed month read showed "not open yet": **partly fixed**, one quiet second try. After two failures it still shows the closed line with WhatsApp, because the signed page has no words for a failed read.
6. Lost reply then retry told the guest their own slot was taken: fixed for the consultation. Plan and List can still make two rows on a retry; the owner sees both and marks one handled.
7. WhatsApp button on a number with no country code opened no chat: shown only when the number starts with `+`.
8. Hidden past days off could fill the list and block saving: they are dropped on save.

## Open
- `almar` holds `SUPABASE_SERVICE_ROLE_KEY` (controller, `wrangler secret list`). Without it the three public routes would answer 503 after refusing bad input. No `RESEND_API_KEY`: the row is saved, `emailed: false`.
- The calendar stays closed until the owner types notice and horizon in Content › Consultation.
- Bare `/plan-with-us` and `/list-with-us` stay 404s (controller, 2026-10-30): the redirect list is for old addresses, and these pages never had one.
- `/api/*` is already in `run_worker_first`; wrangler untouched.

## Owner's check (after the migration, a preview build with the service-role key and Resend)
1. Content › Consultation: add hours, type 24 notice and 30 ahead, click Save. Expected: saved, and reloading shows the same.
2. Contact page, pick a day and a time, fill the form with your own email and a `+` number, click to book. Expected: the confirmation line with your time and Dubai time; your inbox gets the email with an `.ics`; `inquiries@` gets its own.
3. Try to book the same time from another email. Expected: the time is gone from the list.
4. Book a second time with your email. Expected: it books; both show in Content › Consultation.
5. Dashboard › Requests, open the booking, cancel it. Expected: cancelled tag; the time is offered again on Contact.
6. Send Plan with us and List with us from `/en/plan-with-us` and `/en/list-with-us`. Expected: thank-you line, both in Requests; Mark handled moves them; WhatsApp shows only for a `+` number.
7. Repeat one form in Arabic and Spanish. Expected: RTL with Arabic text; Spanish with tú.

Jev: fits later as a triage score on incoming requests (likely spam or not), logged and advisory; not added. Automation: a daily unattended digest to the owner of the next day's calls and any request not handled after 48 hours (proposal only).

# 06-07 executed: hand-over (job 26)

Commits: see `06-07-SUMMARY.md`. Checks: `tsc` and `tokens:check` pass; nothing else ran (owner: no test). **Migration unchanged: 3,378 lines, sha256 `9f917461e8e532d660ab0c374ddc275c96a8e508f3f924eddd720751b91fa77d`.** No SQL gaps.

## Reviews
Sonnet (no Fable per plan, the owner's decision). Verdict "fix first"; all three answered, no re-review:
1. Notices on home and post pages landed against `PageShell` (its `@container` holds fixed children), often off-screen: `SaveStayNotices` with no children now renders into the body, so `home-page.tsx` needs no slot.
2. The saved heart read "Remove X, pressed": `aria-pressed` dropped, the name carries the state; `tests/saved-stays.spec.ts` follows.
3. A read returning during a tap could flip the heart back: hearts still being saved keep what she tapped.

## Slots (granted by the controller 2026-10-30; all four edited, tests not run)
1. `tests/build/private-stays/private-stays.spec.ts:138`: `cardLinks` finds 0, cards are now `article` with the link nested. Use `main ul[role='list'] > li a[href*='/private-stays/']`; recheck its Tab-order test (527-567), each card gains a stop.
2. `tests/build/stay-detail/stay-detail.spec.ts:755`: `#related ul a` also counts hearts. Use `a[href*='/private-stays/']`.
3. `tests/build/server-runtime.spec.ts:125`: add `"/api/saved-stays"`.
4. `worker/handle.mjs` `FORM_BODY_CAPS` `["/api/saved-stays", 256]` plus its pin in `tests/server-runtime.test.mjs`.
The card link stays first in the DOM, so the Tab-order test's first stop holds; a heart is the next stop after it.

## Open
- Owner, 2026-10-30: the gold title underline is hover only (removed at rest); the heart on a post's featured stay stays.
- Look first on a phone: the hero's three controls wrap to two rows at 390 and may touch the booking bar on short screens.
- Signed in, first paint shows the sign-in link until the read returns, then the heart flips; Share appears after mount, so the row shifts.
- Never run: save under RLS through PostgREST (`upsert` with `ignoreDuplicates`; reviewer read it as fine), and the `[&_button]` overrides on Copy link.
- Baselines shift: `tests/account-select.spec.ts` (`guest-account`).

## Owner's check (after the migration and a preview build)
1. Signed out, open a stay and click Save. Expected: sign-in page; after signing in, back on the stay with "Saved" and the filled heart, and the saved notice.
2. On /en/private-stays click a heart on another card. Expected: it fills, no notice; reload and it is still filled.
3. Account › Saved stays. Expected: both stays listed; click Remove on one. Expected: it goes, with the removed notice; the heart on that stay is outline again.
4. On a phone, stay page, click Share. Expected: the phone's share sheet. On a computer: Copy link and Share on WhatsApp, the address has no extra query.
5. Repeat 1-3 in Arabic and Spanish. Expected: RTL with Arabic words; Spanish with tú.

Jev: none fits (a plain saved list, no judgment). Automation: a weekly unattended email to the owner of the most-saved stays, as a demand signal (proposal only).

# 06-06 executed: hand-over (job 26)

Commits: see `06-06-SUMMARY.md`; tip of the plan `aae76387`. Checks: `tsc` and `tokens:check` pass; nothing else ran (owner: no test). **Migration at this hand-over: 3,379 lines, sha256 `8af56ba2977f5567df4b456055e594b5ad1e4c0cc8ad3ce02f7fe205d9694980` (items 9 and 10).**

## Reviews
Sonnet: "ship", three lows. Reviewed `670ab183^..13b1a294`; the slot commits and these fixes were not reviewed. Answered in `aae76387`:
1. A destination name of 121-160 characters made the form unsubmittable: dashboard cap now 120 (`DESTINATION_TEXT.name`). A stored name over 120 would still do it; check the live rows before the import.
2. Add-ons: no stop at 30 (guard 500, migration item 10). Before a package opens the screen reads the catalog again if the first read failed or a connected item is unknown; if that read fails the package does not open, so nothing shows as a raw id or is lost. An item that became the home pickup is left out by `ops_get`.
3. `$` in a package name garbled the WhatsApp text: fixed.

## For the Fable review
- **`ops_publish` does not check leg translations; the page falls back to English** (controller's request to list it).

## Owner's answers, 2026-10-30
- Cities: no limit. Done, migration item 9; `legsFull` removed; a route over 6 cities takes columns on the form at `md` and up. 50 cities of long Arabic names could pass the 16 KB body cap on `/api/requests` ; realistic names fit.
- Underlines: none on the whole site, at rest or on hover. Not coded yet: picture first (`pictures/no-underlines/index.html`).

## Open
- `tests/build/slice1-sweep.spec.ts` granted, not edited: its counts are computed from `publicDocuments()` or are slice 1's own 42.
- The email's page address is the English form; the hook has no locale.
- Home cards no longer show duration, ideal-for or description, as drawn.
- A static page offering a renamed city gets the failed line until the next build.
- After a locked leg is removed the editor stays dirty until closed, as the blog does.
- `tests/package-page.spec.ts` checks `dir=rtl` on html; not confirmed for this route.
- Baselines shift: home "Choose Your Journey" and home full-page snapshots; ops-journeys pictures.

## Owner's check (after the migration, the import and a preview build)
1. Catalog › Packages › New package. Type a name, price line and web address, add two cities and an add-on, click Save. Expected: saved, the web address still editable.
2. Click Publish. Expected: Arabic and Spanish fill in; the web address locks; Delete is off with "A shown package cannot be deleted. Hide it first."
3. After a rebuild, open it from "Choose Your Journey" on home. Expected: `/en/journeys/<web address>`, your price line exactly as typed, the cities in order, Included with no remove button, no amount to pay anywhere.
4. Send the form with one city unticked. Expected: sent line; the request in Requests shows the package and the ticked city.
5. Open it in Arabic and Spanish. Expected: RTL with Arabic words; Spanish with tú.
6. Hide the package, open it in the editor, click Delete and confirm. Expected: gone from the list, and after a rebuild its page is a 404.

Jev: fits later as a score on which package a free-text request is closest to, advisory and logged; not added. Automation: a weekly unattended email to the owner listing shown packages whose cities or add-ons have since been hidden (proposal only).
