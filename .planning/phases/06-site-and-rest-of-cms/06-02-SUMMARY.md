# 06-02 summary: Pages, header and footer links

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-28, from `date`. Lead: Opus 5.5. Review: Sonnet,
picked by `jev-review`.

## Signature
Pictures: `pictures/06-02/index.html` at `ed303ec9` (24 scenes × EN/AR/ES × 390/834/1440). Signed by the owner
2026-10-27 in the controller's question form: page heroes "A: always shown (Recommended)"; the other 23 scenes and the
AR/ES drafts "Approve all (Recommended)". Record: `decisions/2026-10-27-06-02-06-03-pictures-signed.md` on main.
The pictures are one hand-drawn HTML page with real tokens, so the plan's harness scenes and picture specs were not
written.

## What landed on the branch
| Commit | Task |
|---|---|
| `ed303ec9` | 1: pictures |
| `57cb4cc0` | 3: owner API `/api/ops/pages`, `/api/ops/page-items`, `/api/ops/nav`; `site-pages-handlers.ts`, `validate-site-pages.ts`; nav snapshot (`lib/site-nav.ts`, `site-nav.snapshot.json`, `scripts/write-site-nav.mjs`) |
| `c7eb2544` | heroes always shown (owner's A): the first section of a page refuses `is_shown: false`; nav-link import rows |
| `a1bb228f` | dashboard copy for Pages and Navigation (slot) |
| `8f1503d4` | review answers (snapshot temp dir, draft-English links skipped, hero check, reorder only the section's own cards, `affects_site` passed on) |
| `0fd430d8` | kit: `EditPage` takes an optional `status` chip (Shown / Hidden) |
| `4d3f997b` | 4: Content › Pages (`page-forms.ts`, `pages-view.tsx`, `pages-screen.tsx`) and Navigation (`nav-forms.ts`, `navigation-view.tsx`, `navigation-screen.tsx`) |
| `cfeba43e` | 4: `tests/ops-pages.spec.ts`, `tests/ops-nav.spec.ts` |
| `eda622e1` | 5: public pages read shown sections, CMS words and hero media; header links from the snapshot |
| `99ccec0e` | shared-file slots (below) |
| `7f69ba3f` | review answers (below) |

## How it works
- **Dashboard.** One section editor (Text, Photos, Hero video, Cards, Settings). A hero has no Show/Hide; it shows the
  signed "always shown" line. Cards have their own Delete link with a confirm, because the kit's Delete is off while a
  record is shown. Navigation saves a whole area (Header or Footer) in one `ops_save_nav` call; the fixed rows
  (currency, language, Login, contact) are drawn from the existing copy and cannot be edited.
- **Public pages.** `getPageContent(page, locale)` returns `{shown, text, hero}`. `withPageWords` writes the CMS words
  into the copy object at each section's `textFrom` paths. In fixtures mode every section is shown with the copy
  files' words, so today's HTML is unchanged. A hidden section is skipped by the page and returns empty words from
  `home.ts` / `about.ts`, so no reader crashes. A hero video replaces the Destinations slider; `PageBand` draws the
  hero photo or video on Experiences and Contact.
- **Links.** `pageLinks(locale)` reads `navLinks("header")` from the snapshot; `footerPageLinks(locale)` the footer.

## PLAT-03 (no new public runtime route)
Non-API routes today: `app/auth/handoff/route.ts`, `app/auth/handoff/start/route.ts`, `app/auth/sign-out/route.ts`,
`app/newsletter/route.ts`; plus 36 under `app/api/`. `tests/plat-03-routes.test.mjs` pins this list.

## Deviations from the plan
- Edited outside the plan's file list: `lib/data/home.ts`, `lib/data/about.ts` (hidden sections give empty words) and
  `components/pages/blog/frame-links.ts` (uses `pageLinks`).
- `trip-screen` and `booking-page-view` still build their own links (not in this plan's list).
- No harness scenes or picture specs (pictures were HTML).

## Shared files (controller slots, 2026-10-28) in `99ccec0e`
- `ops-shell.tsx`: Pages, Navigation and footer (and Blog, 06-03) lose `soon: true`. `tests/ops-coming-soon.spec.ts`
  and its scene keep only Legal; `tests/phase-03-content.test.mjs` follows (KINDS = legal; the copy keeps the pages and
  navigation blocks until the last Phase 6 content plan lands, per the controller).
- `nav.tsx` / `footer.tsx`: `external?: true` opens a new tab with the existing `newTab` screen-reader line
  (`SITE_FOOTER_COPY`); keys are index plus href, so two links to one page no longer clash. No visual change.
- `public-frame.tsx`: `footerLinks` optional, default `footerPageLinks(locale)`; every existing caller still passes it.
- `scripts/assemble-cloudflare.mjs`: `writeNavSnapshot()` runs `write-site-nav.mjs` with the build env inside the
  publish-sequence window (not for `--target=ops`), then reads the file back; a failed write or a snapshot missing a
  header or footer list for any language stops the assemble.
- `tests/ops-route.test.mjs`: nav, page-items, pages, posts in EXPECTED_ROUTES.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass on `34e829d1` (after merging `origin/main` at `6558cb6f`) |
| `npm run tokens:check` | pass ("theme up to date") |
| node tests, build, Playwright | **not run (owner: no test)** |

Written and not run: `tests/ops-site-pages.test.mjs`, `tests/site-nav.test.mjs`, `tests/page-content.test.mjs`,
`tests/plat-03-routes.test.mjs`, `tests/ops-pages.spec.ts`, `tests/ops-nav.spec.ts`; updated
`tests/site-cms-import.test.mjs`.

## Review (Sonnet, standard tier per `jev-review`: subtle 0.83, security 0.45) of `8f1503d4..74b9afd0`, both plans
Verdict "fix first". Safe: https-only video, link and photo URLs at client, validator and table check; no invented UI
text; no hydration mismatch. Answered in `7f69ba3f` (06-02 part):
1. An empty list column (Home Welcome paragraphs) was sent as `null` and refused (400): always an array now.
2. The public page blanked a column an AR/ES record lacked: column by column now (own, else the English record's, else
   the copy file's); `tests/page-content.test.mjs` has the case.
3. A card save, delete or move dropped unsaved section edits: kept now; only the saved copy refreshes.
6. A page with no row in `api_page_sections` hid every section silently: the build now stops with the page named
   (**the site content import must run before the first supabase-mode build**).
7. External links and duplicate keys: fixed with the nav/footer slot.
Not re-reviewed after the fixes.
