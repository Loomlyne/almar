# Phase 3.3 slice 2 (job 07): hand-over, /destinations and /experiences in React, the /services redirects

Written 2026-10-05 07:50 +0400 by the executor of plan 03.3-17, for the controller. Nothing pushed, nothing deployed, no wrangler deploy, no R2 write, no message sent to any session. The only wrangler used is the local `wrangler dev` that Playwright's build config starts (ports 3048 and, for one refused try, 3049; both started by the runner and ended by it; port 3049 turned out to be held by another process, which I did not touch).

## 1. Branch and commit

- Branch `gsd/phase-3.3-slice-2`, worktree `/Users/koss/Developer/almarprod-Website-Code/.claude/worktrees/phase-3.3-slice-2`.
- **Every check below ran on commit `14ed6db`** (code). The commit that adds this file and `03.3-17-SUMMARY.md` follows it and holds `.planning/` files only. `git status` was clean before and after the checks.
- `origin/main` merged: `a9f65e3` (slice 1, job 10 server runtime, slice 4 blog) by merge `a4d6d72`. Since then `origin/main` moved to `388698a`, which changes only `.planning/` files (board and the Phase 3.2, 4, 5 plans); I did not merge it (instruction). `git diff --exit-code origin/main -- tokens.json app/globals.css next.config.ts wrangler.toml wrangler.preview.toml package.json package-lock.json scripts/assemble-cloudflare.mjs lib/copy/index.ts` exits 0.
- Job 11's landing is slice 1's landing `65672af`: an ancestor of the final commit, and `components/ui/slider.tsx`, `reveal.tsx` and its footer are on the branch. Plan 13 therefore ran with job 11 on the branch.
- Slice 4 (`a9f65e3`) is an ancestor too. Side effect of that merge on a slice-2 file: a `PortraitCard` without `href` renders an `<article>` (plan 13's option; before slice 4 it was a `<div>`), so slice 4's featured card on a blog post page without a link is now an `<article>`. The blog's own sweep (36 documents) passes with it.
- Plan start commits, each plan alone in this worktree (S2-28): 10 `67bdeee`, 11 `4024e6a`, 12 `23bb647`, 13 `2ce5d6d`, 14 `194f522`, 15 `7def77c`, 16 `80ff6af`, 17 `a4e0d9b` then restarted at merge `a4d6d72`. There are no executor-branch merge commits (S2-13 was replaced by S2-28).
- This session's one code change after the merge: `14ed6db` removes the `slice1Documents` wrapper that the merge with main brought back into `scripts/media-lib.mjs` (plan 16 had deleted it; nothing called it). `publicDocuments()` is the one document list (S3-11); it returns the 60 React documents today.

## 2. Check set (commit `14ed6db`, `--workers=1`, no pattern kill, PW_PORT 3048)

| Check | Result |
|---|---|
| `npm ci` | exit 0, 13 s |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/*.test.mjs` | 827 tests, 820 pass, 0 fail, 7 skipped: 3 are live-string proofs against Framer routes that no longer exist (`/destinations`, `/experiences`, `/`), 4 are the `out/` checks of `tests/media-guard.test.mjs` that need `MEDIA_CHECK_OUT=1` |
| `MEDIA_CHECK_OUT=1 node --test tests/media-guard.test.mjs` (after the assemble) | 31 tests, 31 pass, 0 skipped; `60 documents, 1089 image references, 158 distinct keys referenced, 0 manifest keys referenced by no document` |
| `npm run tokens:check` | "theme up to date" |
| `node scripts/assemble-cloudflare.mjs` (default target, runs `next build`) | exit 0, 26 s: `assembled 65 html files into out/ (target: local): 2 Framer, React en 20 / ar 20 / es 20, 3 404s; server paths: /api/health; Worker 1413 KiB gzip`. The build's route list shows `/destinations`, `/experiences` and their `/ar` and `/es` forms static; `/blog` and the three posts too |
| `node scripts/media-guard.mjs --deploy` | `media-guard: OK https://media.almarprivatejourney.com, 60 documents, 1089 image references`, exit 0 |
| `node scripts/media-upload.mjs --public-base https://media.almarprivatejourney.com` (dry run, plain GETs only) | exit 0: `158 entries: 40 put, 118 skip, 0 fix, 0 refuse, 6.1 MB to send`. 40 `PUT` lines, 118 `SKIP`; the 40 PUT keys equal (as sets) the manifest keys that are not in `origin/main`'s manifest (118 entries): checked by script |
| `npx playwright test --workers=1` (dev config, `ALMAR_HARNESS=1` set by the config) | **2270 passed, 28 skipped, 0 failed** of 2298, 30.6 min |
| `npx playwright test -c playwright.build.config.ts --workers=1` (build config, last) | **2487 passed, 0 failed, 0 skipped** of 2487, 1.1 h. It holds `tests/build/slice2-sweep.spec.ts` (190), `redirects.spec.ts` (13), `destinations` (129), `experiences` (211), the slice 1 sweep, the blog sweep, the server-runtime spec and the rest |
| `node --test tests/build/*.test.mjs tests/build/*/*.test.mjs` (assembled-site and built-documents) | **430 tests, 430 pass**, after the assemble above. First attempt: 422 pass, **8 fail**, see "Reruns" |
| `tests/build/slice2-sweep.spec.ts` alone, before the full runs | 190 passed, 0 failed (7.4 min); `find test-results/slice2 -name '*.png' | wc -l` prints 159 |

Order note: the plan puts the build node tests before the browser runs. I ran them after the dev run by mistake of order, see the first rerun.

Sitemap and rules, on the same out/: `cmp public/_redirects out/_redirects` identical; `grep -c "<url>" out/sitemap.xml` 62 (60 React documents + 2 Framer); `grep -c 'hreflang="x-default"' out/sitemap.xml` 60; `grep -c "/services" out/sitemap.xml` 0.

### Reruns, both results

1. **Build node tests, 8 failures then 430 / 430.** The first run was after the dev-config Playwright run. `next dev` rewrote `.next/server/app`, so the eight `tests/build/stay-detail/built-documents.test.mjs` cases that read `.next/server/app/private-stays/*.html` failed with `ENOENT: no such file or directory, scandir '.next/server/app/private-stays'`. Not a code fault: the same eight pass after a fresh `node scripts/assemble-cloudflare.mjs` (430 / 430). The Playwright build run read `out/`, which the dev run does not touch, so it was unaffected.
2. **Lead item 1, `/services` rules with job 10's Worker in front of the assets.** `wrangler.toml` now has `main = "worker/almar.mjs"` and `run_worker_first = ["/api/*"]`. `tests/build/redirects.spec.ts` alone through `playwright.build.config.ts` (local `wrangler dev`, never `--remote`): **13 passed**. Every rule answers 301 with the exact Location: `/services` and `/services/` to `/experiences?type=service`; the three detail addresses with and without a final slash to `/experiences?type=service&item=<slug>`; `/services/helicopter-transfers` and `/services/private-city-guides` (the splat) to `/experiences?type=service`; following each lands 200 on `/experiences`; `/ar/services` and `/es/services` answer 404. The same 13 passed again inside the full build run, and sweep section E (12 tests) passed. Mechanism not changed.
3. **Lead item 2, the `/destinations` spec's earlier intermittent "did not resume within 3 s".** Plan 13 had seen it three times in its own runs (harness run once, build run 2 twice), each early in a run, each passing alone. In this session: inside the full build run the spec passed with **no failure** (129 of 129), and a separate standalone rerun of `tests/build/destinations` on the same out/ passed again (129 of 129, 6.2 min); the slice 2 sweep's own slideshow tests (Pause, Play, hover, focus, dot, reduced motion, 3 locales, 3 widths) passed 190 of 190 in its run before the full runs and again inside the full build run. The failure did not reproduce in four passes, so its cause is still unknown. No assertion was loosened; there is nothing to fix on evidence. It remains a possible cold-page timing effect (a slide that has not painted when the hold ends).
4. **Port.** My first redirects try on 3049 stopped with `http://127.0.0.1:3049/ is already used` (another process holds it); I did not clear it and ran on 3048.

## 3. No component imports a fixture

```
$ grep -rnE "lib/data/(fixtures|resolve|media)" app components
(empty, exit 1)
$ grep -rln "fixtures/" app components
(empty, exit 1)
$ node --test tests/data-boundary.test.mjs
ℹ tests 3   ℹ pass 3   ℹ fail 0
```

## 4. Every rendered control and how it was exercised in a browser

All on the assembled `out/` under local wrangler, EN / AR / ES at 390 / 834 / 1440. Spec paths are under `tests/build/`. "sweep" is `slice2-sweep.spec.ts` (this plan).

| # | Control | Pages | Spec file | Test title | Clicked or typed | Asserted result |
|---|---|---|---|---|---|---|
| 1 | Nav, wordmark, Menu, skip link, WhatsApp, footer links, footer language row | both pages, all 48 documents | `destinations/destinations.spec.ts`, `experiences/page.spec.ts`, sweep | "9. the Destinations nav link goes to this page...", "2. the Experiences nav link marks the page...", sweep `<locale> <url> @<width>` | nav link click, Menu opened below 1152 px | current-page mark only on the page's own link, WhatsApp link present, footer mail and phone, one Instagram link, Menu open shows no held control |
| 2 | Language select | both | `destinations/destinations.spec.ts`, `experiences/page.spec.ts` | "10. language: ...", "3. language: with filters set, ..." | select and footer row clicked | same page in the other language; filters reset |
| 3 | Search | /experiences | `experiences/filters.spec.ts` | "2. search: live, accent- and case-folded, never in the address; ..." | typed a word, then a non-matching one | live count, accent and case folded, nothing in the address, empty state with one Clear |
| 4 | Type All / Experiences / Services | /experiences | `experiences/filters.spec.ts` | "3. type: Services 10, Experiences 35, All 45, ..." | each option clicked | counts 10 / 35 / 45, the other group hidden, `?type=` |
| 5 | Destination checkboxes | /experiences | `experiences/filters.spec.ts` | "4. destination: the five places one at a time (14, 11, 3, 1, 4), then two together" | each box ticked | locked counts; two together = union |
| 6 | Private stay checkboxes | /experiences | `experiences/filters.spec.ts` | "5. private stay: Santa Fe gives 6, a destination narrows the stay options..." | a stay and a place ticked | 6 for Santa Fe; stay options narrowed; a stay left outside is dropped |
| 7 | Removable filter chips | /experiences | `experiences/filters.spec.ts` | "6. chips: one per active filter; each × removes only its own" | each × clicked | only that filter removed |
| 8 | Result count (live, plural forms, group counts) | /experiences | `experiences/filters.spec.ts`, `experiences/page.spec.ts` | "1. initial: 45 cards, group heads 35 and 10, count line, ...", "5. names: every control is named, the count is live, ..." | filters changed | count line per locale's plural form, `aria-live="polite"` |
| 9 | Clear filters | /experiences | `experiences/filters.spec.ts` | "7. Clear filters: search and filters reset, the address is the page path alone, focus on the search box" | Clear clicked | reset, address plain, focus in search |
| 10 | Filters button, count badge, sheet | /experiences below 1024 | `experiences/filters.spec.ts`, sweep D | "8. the Filters sheet (below 1024) and the rail (from 1024)", sweep `<locale> /experiences Filters sheet @<width>` | Filters clicked, boxes ticked, Show N clicked, Escape | sheet opens, badge, Show N closes it, no held control inside the sheet |
| 11 | Card to overlay | /experiences | `experiences/overlay.spec.ts`, sweep D | "1. a card opens its overlay: name, kicker, full text, ...", sweep `<locale> /experiences overlay @<width>` | first card clicked | dialog, kicker, text, `?item=<slug>`, no Add to cart, no price, no per person |
| 12 | Overlay close | /experiences | `experiences/overlay.spec.ts`, sweep D | "2. close by Escape, by the close square and, from md, by the scrim: ...", sweep overlay test | Escape, close square, scrim | dialog gone, `?item=` gone, focus on the card |
| 13 | Overlay Private stays links | /experiences | `experiences/overlay.spec.ts` | "6. a stay link in the overlay goes to that stay's page, which answers 200" | a stay link clicked | that stay's page, 200 |
| 14 | Overlay Request Inquiry | /experiences | `experiences/overlay.spec.ts` | "7. Request Inquiry goes to /contact, which answers 200" | link clicked | `/contact`, 200 |
| 15 | URL state | /experiences | `experiences/overlay.spec.ts`, `experiences/filters.spec.ts`, sweep E | "5. deep links: the service redirect landing, an unknown slug, and an item the filters hide", "9. bad address input is ignored: ...", sweep `301 <source> ...` | addresses typed, redirects followed | filters and overlay restored from `?type ?destination ?stay ?item`; bad input ignored; each old `/services` address lands with the right overlay open |
| 16 | Empty state | /experiences | `experiences/filters.spec.ts` | "2. search: ..." (no-match half) | a word that matches nothing | message and one Clear, group hidden not shown empty |
| 17 | Slideshow dots | /destinations | `destinations/destinations.spec.ts`, sweep G | "2d. a dot shows that photo, marks it current and stops the slideshow for good", sweep "layout, signed sizes, enter animations, hero slideshow" (load 4) | dot 3 clicked | photo 3 shown, dot marked current; stays on it (plan 13 proves "for good") |
| 18 | Slideshow Pause / Play | /destinations | `destinations/destinations.spec.ts`, sweep G | "2a. Pause holds the slide and its name becomes Play; Play runs it again", sweep G (load 1; loads 2 and 3 hover and focus) | Pause, Play clicked on a fresh load; hover; focus on a dot | no change over two intervals, runs again on Play, after pointer off, after blur |

Also exercised: the home Search on the three home documents (exactly one `button[type=submit]`, named by `JOURNEY_COPY[l].bar.search`; none on the other 45 documents of the sweep), the stay pages' request link (36 documents), and the home and stay-page links into /experiences (plan 15's `home.spec.ts` 8, 8b and stay-detail click tests).

## 5. Pages checked: 16 pages x 3 locales

The sweep (`tests/build/slice2-sweep.spec.ts`, 144 page tests) opened each document at 390, 834 and 1440 and checked: status 200 with no redirect, served `lang` and `dir`, one h1, no horizontal overflow, four hreflang links, one canonical, every picture painted and no media key outside the manifest, WhatsApp link, footer mail and phone, no footer form or email field, no bare social link, exactly one social link (Instagram), no console or page error, no hydration warning, no request to framerusercontent.com, files.catbox.moe or videos.pexels.com, and every held control absent by exact name and by text (Menu closed, and open below 1152 px). On `/destinations` and `/experiences` also: a header link marked current and every current link is that document; every control inside 0..innerWidth; no currency and no "per person" text. Result for every cell: **pass at 390 / 834 / 1440** (190 of 190 passed, twice: alone and inside the build run).

Screenshot folder (gitignored, replaced by the next Playwright run, gone with the worktree): `/Users/koss/Developer/almarprod-Website-Code/.claude/worktrees/phase-3.3-slice-2/test-results/slice2/<locale>/<page>-<width>.png`, `<locale>` = `en`, `ar`, `es`, `<width>` = 390, 834, 1440. 53 files per locale (48 pages, 3 overlay, 2 sheet), 159 in all. English first, then Arabic.

| Page | `<page>` in the file name | en | ar | es |
|---|---|---|---|---|
| Home | `home` | pass 390 / 834 / 1440 | pass 390 / 834 / 1440 | pass 390 / 834 / 1440 |
| Private stays | `private-stays` | pass x3 | pass x3 | pass x3 |
| Destinations | `destinations` | pass x3 | pass x3 | pass x3 |
| Experiences | `experiences` | pass x3 | pass x3 | pass x3 |
| 12 stay pages | `stay-baru-island-private-villa`, `stay-bocagrande-beach-house`, `stay-cartagena-historic-center-house`, `stay-casa-jardin-san-diego`, `stay-casa-juliana-historic-center`, `stay-casa-mariana-historic-center`, `stay-getsemani-colonial-house`, `stay-getsemani-courtyard-residence`, `stay-private-island-cartagena`, `stay-private-island-estate-cartagena`, `stay-santa-fe-farm-antioquia`, `stay-sopetran-country-estate` | pass x3 each | pass x3 each | pass x3 each |

Overlay (opened from the first Experiences card, Escape back to the card): `<locale>/experiences-overlay-<width>.png`. Filters sheet (390 and 834 only): `<locale>/experiences-filters-<width>.png`. `/destinations` JavaScript off (6 tests) and the section G layout, size, animation, slideshow and reduced-motion tests (12 tests) also pass.

The blog documents (12 x 3, slice 4) are not in this sweep; `tests/build/blog/sweep.spec.ts` covers them and passed inside the build run.

## 6. Held controls, not rendered (design 4.3 rows 1-8 plus the currency select)

Not drawn, not disabled. Assertion that proves count 0: sweep section C on every document x width (exact name, then text), repeated inside the overlay and the Filters sheet in section D.

| # | Held control | Where the board draws it | Why it cannot work now | Returns with | Sweep assertion |
|---|---|---|---|---|---|
| 1 | Card **Add** (x45) | board 5e, D-65 | there is no cart | the cart work, then Phase 4 | no control named `addons.add` or "Add {name}" for any of the 45 items |
| 2 | Overlay **Add to cart** | 5f, D-67 | same | same | CART and PACKAGES regexes on every name, in the overlay too |
| 3 | Cart bar "2 added, Continue" | 5e | same | same | no control named `cart.continue` or `addons.continue` |
| 4 | Header cart and badge | 5d, 5e, D-66 | same | same | CART regex in EN, ES and AR on every name |
| 5 | Price on card, overlay and bar | 5e, 5f | no price exists; `AED [PRICE]` is never shown | Phase 3.2 (rates) | no `AED [`, `[PRICE]`, `[AMOUNT]`, `[RATE]`; on /destinations and /experiences no currency code or sign and no "per person" |
| 6 | Login | 5d, 5e | no session | Phase 2 | no control named `nav.login` |
| 7 | Footer newsletter, List with us | footer | newsletter needs slice 3 plan 27 (job 08 owns the form question); List with us is Phase 6 | slice 3 / Phase 6 | no footer form, no `input[type=email]`, no `subscribe` control, no "List with us" text |
| 8 | Destination card link | live page | no destination page exists | when he decides (design 7.1) | no link in the /destinations card list (sweep F and G; `destinations.spec.ts` 5) |
| 9 | Currency select | home only | the select is on the home hero; the two new pages never show it | n/a | currency combobox count 0 on every document except the three home documents |

The live home Search is not held: it works (job 11), and the sweep expects exactly one submit named by `bar.search` on each home document and none elsewhere.

## 7. Redirects

`public/_redirects` holds the 9 rules of design 5.2 and is copied to `out/_redirects` (cmp identical). Local `wrangler dev` evidence, from sweep section E and `redirects.spec.ts`, both with job 10's Worker in front of the assets:

| Source | Status | Location | Landing |
|---|---|---|---|
| `/services` | 301 | `/experiences?type=service` | Services group, 10 cards, no Experiences group, no dialog |
| `/services/` | 301 | `/experiences?type=service` | same |
| `/services/24-7-private-concierge` and with a final `/` | 301 | `/experiences?type=service&item=24-7-private-concierge` | that service's dialog open (h2 equals the item name) |
| `/services/luxury-ground-transport` and with a final `/` | 301 | `/experiences?type=service&item=luxury-ground-transport` | same |
| `/services/vip-airport-meet-greet` and with a final `/` | 301 | `/experiences?type=service&item=vip-airport-meet-greet` | same |
| `/services/helicopter-transfers` and with a final `/` | 301 | `/experiences?type=service` | Services, no dialog |
| `/services/private-city-guides` (splat) | 301 | `/experiences?type=service` | 200 on `/experiences` |
| `/ar/services`, `/es/services`, and with a final `/` | 404 | none (no rule, design 5.2) | the 404 page |

Cloudflare's live edge, including the trailing-slash forms, is proven only by section 12 step 2 and steps 15 and 16.

## 8. Media

- `lib/data/media.ts`: `MEDIA_BASE_URL = https://media.almarprivatejourney.com`, `MEDIA_BASE_URL_IS_PLACEHOLDER = false` (the flip landed with slice 1).
- The 40 new images: 35 under `catalog/`, 5 under `destinations/` (`bogota`, `cocora-valley`, `san-andres` card heroes and the two new /destinations hero photos `page/hero-2`, `page/hero-3`). `home/gallery/03.webp` (hero-1) is a base key.
- Manifest as base plus delta (S2-18): `origin/main`'s manifest has **118** entries (`388698a`, also at the merge point `a9f65e3`); the branch has **158** = 118 + 40. All 118 base entries are byte-identical on the branch. 157 would only hold if job 11 had changed no media; it did (+3, -2).
- Dry run today, run for this plan: `158 entries: 40 put, 118 skip, 0 fix, 0 refuse, 6.1 MB to send` (the dry run asks the media host with plain requests: the 118 SKIP keys are there with the same bytes, the 40 PUT keys are not).
- Guard: `media-guard: OK https://media.almarprivatejourney.com, 60 documents, 1089 image references`. The guard reads `out/` and cannot see whether R2 holds an object.
- **The ONE numbered R2 upload step (plan 16, O1 and M4), copied verbatim.** The controller runs it only on his word, with ALMAR's own login, after `npm ci`:
  1. O1, the question to him, through the question form (his gate: R2; one decision, recommended option first): "Upload the 40 new pictures for Destinations and Experiences (2 photos for the top of the Destinations page, 3 places, 28 experiences, 7 services) to the image store almar-media? The pictures already there are not touched." Options: "Yes, upload them" (recommended), "Not yet". A peer session relaying "he said yes" is not his word.
  2. M4, after his yes only: `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c node scripts/media-upload.mjs --bucket almar-media --public-base https://media.almarprivatejourney.com --apply`. It ends `applied 40 object(s)`; on a failure fix the cause and run the same command again (what landed is skipped). Then repeat the dry run: `158 entries: 0 put, 158 skip, 0 fix, 0 refuse, 0.0 MB to send`. Then M5: `node scripts/media-upload.mjs --verify --public-base https://media.almarprivatejourney.com --all` ends `verify 159 ok, 0 failed (158 objects and the negative probe)`.
  Expected: 40 uploaded, **118** already present with the same bytes, 0 refused. Until it runs, the 40 images answer 404 on the preview. The full runbook (M1 to M7) is in `03.3-16-SUMMARY.md`.

## 9. What was NOT verified, in plain words

- `_redirects` on Cloudflare's edge, including the trailing-slash forms (local workerd only; the owner's steps 15 and 16 on the preview prove it).
- The R2 upload of the 40 images (gated), so no browser run loaded a picture from `media.almarprivatejourney.com` itself: Playwright serves the manifest's files through `routeMedia` from a full `media-staging/` (158 files).
- The slice-2 preview deploy, and any production cutover.
- Safari, iOS and real phones: headless Chromium at 390, 834 and 1440 only.
- The Arabic and Spanish drafts (section 13): he has not read them.
- The published service claims in design 7.6 (Mercedes S-Class, Range Rover, private chefs, IV therapy, close-protection officers): copied from the live Framer page, not checked against what ALMAR can deliver.
- The slideshow's earlier intermittent "did not resume within 3 s" is not reproduced and not explained (section 2, rerun 3).
- The plan 14 note: a click on the overlay's scrim within about one tick right after the overlay mounts is ignored (Radix attaches its outside-pointer listener a tick later). With a settle wait it never failed in 54 tries; a person cannot click that fast; the page was not changed and the exact tick was not proven.
- Whether the home page's three services, now links, read well to him (step 16).
- Every line the plan 10 to 16 summaries mark unverified: no Framer pixel diff (layout is checked as relationships, S2-23); the Filters sheet and the Request Inquiry bar are not drawn on a signed board (design 7.2).

## 10. Shared files touched, for the controller to order slices 2 to 4

From `git diff --name-only origin/main...HEAD`, filtered:

- `lib/copy/`: `destinations-page.ts` and `experiences-page.ts` (new; `lib/copy/index.ts` untouched).
- `lib/data/`: `types.ts`, `experiences.ts`, `destinations.ts`, `catalog-filter.ts` (new), `media-manifest.json`, and fixtures `catalog.json`, `catalog-translations.json`, `destinations.json`, `destination-translations.json`, `destinations-page.json` (new), `image-translations.json`.
- `lib/locale-path.ts` (`PUBLIC_PAGES` gains `/destinations` and `/experiences`; additive).
- `scripts/media-lib.mjs`, `scripts/media-guard.mjs`, `scripts/media-fetch.mjs`, `scripts/media-upload.mjs`.
- `components/ui/`: `card.tsx`, `chip.tsx`, `chip-group.tsx`, `dialog.tsx`, `nav.tsx`, `slider.tsx` (modified), `checkbox-group.tsx`, `count-badge.tsx` (new). `components/site/`: untouched (footer owned by job 11 and slice 3 plan 27).
- Slice-1 page files: `components/pages/home-page.tsx` (`HOME_SERVICE_SLUGS`, links into /experiences), `components/pages/stay-detail-page.tsx` (cards link to the overlay). `home/home-sections.tsx` untouched.
- `tests/helpers/`: `pointer-off.ts` (new), `site-links.mjs`. Tests shared with slice 1 and others: `tests/build/locale-routing.spec.ts`, `tests/build/slice1-sweep.spec.ts` (sitemap count computed), `tests/build/assembled-site.test.mjs`, `tests/build/home/home.spec.ts`, `tests/build/home/built-documents.test.mjs`, `tests/build/stay-detail/*`, `tests/crawl-files.test.mjs`, `tests/no-dead-links.test.mjs`, `tests/json-ld-domain.test.mjs`, `tests/locale-path.test.mjs`, `tests/data-boundary.test.mjs`, `tests/data-contract.test.mjs`, `tests/data-sample.test.mjs`, the media tests.
- Deleted: `app/destinations/route.ts`, `app/experiences/route.ts`, the four `app/services/**/route.ts` (the Framer pages these replaced).
- Union of `shared_files:` from plans 10 to 17: the files above that plans 10 to 17 each named, plus `tests/build/locale-routing.spec.ts` (this plan, no edit needed: plans 13 and 14 had already computed the inventory).
- Slices 3 and 4 also edit `PUBLIC_PAGES`, `tests/helpers/site-links.mjs` and the document list, which `publicDocuments()` (S3-11) makes computed; slice 4 landed first and its own `readPostSlugs`, `BLOG_PAGES`, `blogDocuments` and `reactDocuments` coexist with it. The footer is shared and owned by job 11 (look, Instagram only) and slice 3 plan 27 (newsletter); slice 2 touched neither.

## 11. Migrations, environment, and proposed changes

Migrations: none. Environment names added: none. Hosted database, Cloudflare, DNS and R2: untouched.

Proposed changes for the controller to apply at ship (I edited none of them):

- **ROADMAP 3.3 SC1** (design 7.5): "services and service detail" becomes "`/services` and its three detail URLs answer 301 to `/experiences` (D-64)"; "All 26 public pages" becomes "All 22 public pages plus 4 redirected addresses" (also in the Phase 3.3 summary line at ROADMAP :18). With slice 4 the blog pages (4 per language) are public pages too, so the controller may prefer one count for slices 1 to 4 at landing.
- **CONTROL-BOARD job 07 row:** "handed over `<hand-over commit>` `2026-10-05 <time>`; checks on `14ed6db`; waits on the R2 upload, the preview deploy and his review".
- **STATE.md:** slice 2 handed over.
- **Cleanup for the controller (S2-28):** the three unused worktrees `.claude/worktrees/phase-3.3-s2-p10`, `-p11` and `-p12` (branches `gsd/phase-3.3-s2-p10`, `-p11`, `-p12` at `c601a38`, no commits) can be removed; slice 2's executors all ran one after another in this worktree.
- Notes for him, not questions: design 7.1 (a destination card could open Experiences filtered to that place: one line); 4.2 (stay-page cards now link to the overlay, inert is one line); 7.6 (service claims).
- **Plan 14 scrim note** (section 9): no change proposed; named so a later change to the overlay does not hide it.

## 12. The owner's numbered steps

Steps 1 and 2 are gates: the controller runs each only on his word, one at a time. Steps 3 to 20 are his review on the preview host, at phone (390), tablet (834) and desktop (1440), English and Arabic first, Spanish once at desktop. His "done", "correct" or "working" on a step is a pass; anything else goes back to the controller as a numbered note.

1. **Upload the 40 new images to R2 (his word, the controller runs).** The step in section 8 (O1 then M4), dry-run line first: `158 entries: 40 put, 118 skip, 0 fix, 0 refuse, 6.1 MB to send`. Expected: 40 uploaded, 118 already present with the same bytes, 0 refused. Read-back, plain GETs: `curl -sI https://media.almarprivatejourney.com/destinations/bogota/hero.webp` and `curl -sI https://media.almarprivatejourney.com/destinations/page/hero-2.webp` each answer 200 `image/webp`.
2. **Deploy the slice-2 preview (Cloudflare, his word, the controller runs).** In a clean clone at `14ed6db` (the branch tip after the hand-over commit differs from it by `.planning/` files only), run `.planning/phases/02-platform-spine/02-RUNTIME-DEPLOY.md` section 1 (it replaces slice 1's step 1 now that a Worker sits in front of the assets): `npm ci`, `node scripts/assemble-cloudflare.mjs --target=preview` (into `out-preview/`; its last line now reads `assembled 65 html files ... React en 20 / ar 20 / es 20`, not 57), `node scripts/media-guard.mjs --deploy --out out-preview` (expect `OK https://media.almarprivatejourney.com, 60 documents`), then the `wrangler deploy --config wrangler.preview.toml` of that runbook with the ALMAR login prefix. Step 1 must have run first, or the pictures show empty. Then plain GETs: `curl -sI https://preview.almarprivatejourney.com/services` gives 301 and `location: /experiences?type=service`; `curl -sI https://preview.almarprivatejourney.com/services/vip-airport-meet-greet/` gives 301 and `location: /experiences?type=service&item=vip-airport-meet-greet`; `curl -sI https://preview.almarprivatejourney.com/ar/services` gives 404; `curl -sI https://preview.almarprivatejourney.com/destinations` gives 200 with `x-robots-tag: noindex, nofollow`; `curl -sI https://almarprivatejourney.com/` shows no `x-robots-tag` and the live version is still the one on the board.
3. Open `https://preview.almarprivatejourney.com/destinations` at desktop. Expected, as in the pictures you signed (`79b0dc8`): a full-width photo slideshow with the kicker "Destinations" and the heading "Colombia’s most extraordinary cities"; three photos that change by themselves, with dots and a pause button and no arrows; right after the page opens, the pause button stops it and pressing it again restarts it; it also stops while the pointer is over it; clicking a dot shows that photo and the slideshow then stays on it. The heading is the signed scale's hero size (64 at desktop and tablet, 40 at phone, the same as the home page heading), not Framer's 88. No sentence under the hero. Then five square cards with the name on the photo, a pin and the region: Cartagena (Caribbean coast), Medellín (Andes), Bogotá (Andes), San Andrés (Caribbean), Cocora Valley (Coffee region); two per row, Cocora Valley alone and centred on the last row; the cards slide up into place as they scroll in; clicking a card does nothing; "Destinations" is marked in the header; no currency select, no Login, no cart. Footer: the link "Instagram", opening instagram.com/almarprivatejourney, and no other social link; no newsletter box yet (it comes with slice 3).
4. Same page at tablet, then phone. Expected: at desktop two per row with Cocora Valley centred; at tablet two per row, Cocora Valley centred; at phone one per row; nothing scrolls sideways. Then turn on System Settings > Accessibility > Display > Reduce motion and reload: the photo no longer changes by itself and the cards are simply there, without sliding. Turn Reduce motion off again.
5. Open `/ar/destinations` at the three widths. Expected: Arabic, right to left, the same five places in the same order, Medellín written ميديلين, Destinations marked in the Arabic header. Then `/es/destinations` once at desktop.
6. Open `/experiences` at desktop. Expected: heading "Experiences and services"; on the left: search, Type (All, Experiences, Services), Destination (Cartagena, Medellín, Bogotá, San Andrés, Cocora Valley), Private stay (12 stays); the count reads "45 options"; the Experiences group, then the Services group; no prices, no Add buttons, no cart, no currency select.
7. Tick Cartagena. Expected: "14 options" and a "Cartagena ×" chip. Also tick Bogotá: "15 options". Click × on the Cartagena chip: "3 options" (Bogotá only). Click Clear filters: "45 options", the cursor is in the search field.
8. Tick Medellín. Expected: the Private stay list shows only Santa Fe Farm Antioquia and Sopetrán Country Estate. Tick Santa Fe Farm Antioquia: "6 options". Clear filters.
9. Click Services under Type. Expected: the Experiences group disappears, the Services group shows 10 cards. Type `airport` in search: "2 options". Clear filters.
10. Click the Rosario Islands Escape card. Expected: a large panel with its picture, "Experience · Cartagena", the title, the full paragraph, Duration "Full Day", links to Barú Island Private Villa, Private Island Cartagena and Private Island Estate Cartagena, and "Request Inquiry" at the bottom; the address ends `?item=rosario-islands-escape`. Click one stay link: that stay's page opens. Go back, press Escape: the panel closes and `?item=` is gone.
11. Same page at tablet. Expected: a Filters button and the three type chips; a number appears on Filters once a place or stay is ticked (no number at 0). Filters opens a full sheet with Destination and Private stay; tick Cartagena, the sheet's button reads "Show 14 options"; clicking it closes the sheet and the list shows 14. A card opens the panel centred on the page.
12. Same page at phone. Expected: Filters and the type chips fit without sideways scrolling (they may wrap to a second line); the card panel fills the screen; its close square and Escape both close it.
13. Repeat 6 to 12 on `/ar/experiences`. Expected: Arabic, right to left, the same counts written with Arabic plural words; the chips' × works. Then `/es/experiences` once at desktop.
14. Open `https://preview.almarprivatejourney.com/experiences?item=vip-airport-meet-greet`. Expected: the page opens with the VIP Airport Meet & Greet panel already open. Open `/experiences?item=nope`: the page, no panel.
15. Type each old services address in the address bar. Expected for each:
    a. `/services`: lands on `/experiences?type=service`, Services selected, 10 services, no panel.
    b. `/services/`: the same.
    c. `/services/24-7-private-concierge`: lands with the 24/7 Private Concierge panel open.
    d. `/services/luxury-ground-transport`: the Luxury Ground Transport panel open.
    e. `/services/vip-airport-meet-greet`: the VIP Airport Meet & Greet panel open.
    f. The three of c to e with a slash at the end: the same as c to e.
    g. `/services/helicopter-transfers` (a dead address today): lands on `/experiences?type=service`, no panel.
    h. `/ar/services`: the Arabic "page not found" page. `/_redirects`: "page not found" (the rule file is not served).
16. Open `https://preview.almarprivatejourney.com/`. In "Services & Experiences" click the first service card. Expected: `/experiences?type=service&item=24-7-private-concierge` with its panel open. Back; click "View All Services": `/experiences?type=service`.
17. Repeat 16 on `/ar/`. Expected: the cards lead to `/ar/experiences?...`, in Arabic, right to left.
18. Open `/private-stays/getsemani-colonial-house`. Click the 24/7 Private Concierge card under Services. Expected: `/experiences?item=24-7-private-concierge` with its panel open. Back; click an Experiences card: its panel. (If he prefers these cards not clickable, it is one line; say so.)
19. Repeat 18 on `/ar/private-stays/getsemani-colonial-house`. Expected: `/ar/experiences?item=...`, Arabic.
20. On `/experiences` with Cartagena ticked, switch the language to العربية. Expected: `/ar/experiences`, filters reset (slice 1 rule), Experiences marked in the Arabic header.

Nothing reaches production from this: the production cutover is a separate Ship and deploy, on his word.

## 13. Lessons, and drafted strings for his review

Lessons from this job's corrections and findings, one line each:

- Sub-agents of a session are held to that session's worktree: plans ran one after another in one worktree (S2-28), not one worktree per executor (S2-13); three worktrees were created and never used.
- The sweep restarted once because `origin/main` moved (slice 1, job 10, slice 4 landed). The leftover-count grep after a merge found a dead `slice1Documents` wrapper that the merge itself had brought back; check the grep again after every merge, not only at the start.
- Run the build node tests (`tests/build/*.test.mjs`) before any dev-config Playwright run, or re-assemble first: `next dev` rewrites `.next/server/app` and eight built-document tests then fail with ENOENT for no code reason.
- A hand-over count of "documents" must come from `publicDocuments()`, never a typed 42 or 48: typed counts broke each time a page was added (slice 1 sweep's sitemap check, found by plans 15 and 17; the slice 4 hand-over names two more).
- Port 3049 was held by another process this morning; the free-port loop is not optional.

Drafted strings for his review (S2-14); all `draft` in the data:

- The Filters badge label "# active filter(s)" (read by assistive technology): EN `# active filter(s)`; AR zero `لا عوامل تصفية مفعّلة`, one `عامل تصفية مفعّل واحد`, two `عاملا تصفية مفعّلان`, few `# عوامل تصفية مفعّلة`, many and other `# عامل تصفية مفعّل`; ES `# filtro activo` / `# filtros activos` (plan 14, `lib/copy/experiences-page.ts`).
- The other plan 14 drafts: `count`, `showResults`, `removeFilter`, `empty`, `filters.label`, the overlay words `Service`, `Private stays`, `Close` in AR and ES (listed in `03.3-14-SUMMARY.md`, file `lib/copy/experiences-page.ts`).
- The AR and ES meta titles and descriptions of /destinations and /experiences (plans 13 and 14; the EN meta is the live Framer text). Files `lib/copy/destinations-page.ts` and `lib/copy/experiences-page.ts`. The /destinations slideshow labels: EN "Destinations photos", AR "صور الوجهات", ES "Fotos de los destinos" (`slider.region`).
- Pointers to every AR and ES draft record (status `draft`): the 35 AR and ES catalogue texts in `lib/data/fixtures/catalog-translations.json`, the nine destination records in `lib/data/fixtures/destination-translations.json`, and the 114 new image alt records in `lib/data/fixtures/image-translations.json` (plan 10); the page copy files above.
- /destinations hero alts (S2-19): hero-1 reuses the home gallery's published alt for the same file; hero-2 is the new drafted wording "Black marble bathroom with a freestanding bathtub and a sea view"; hero-3 is Framer's words reordered, "Arched hallway inside a Mediterranean modern hotel".
- The phone h1 size on /destinations: 40 px (`--text-hero` below 48rem, S2-20 corrected), Framer shows 48. It is the same token as job 11's open question on the home and stay h1s (HANDOVER-job11 section 6, item 2), so he answers both at once.
- Two literal place outcomes: Helicopter Transfers ("coffee country") and Rural Farm & Nature Visits ("coffee farms") are not filed under Cocora Valley because neither phrase is on the keyword list (plan 10).
- Plan 14: the Filters button carries no `aria-haspopup` (the plan asks for exactly 45 dialog-opening buttons, the cards), and Request Inquiry is a primary link button, not a bare link, so the docked bar has a visible next step where the board draws Add to cart.
- S2-13 recorded: one worktree per executor was the plan; S2-28 replaced it, so there are no per-plan executor branches to merge (section 1).

## 14. Merge with main f46cd70 (slice 3A, money engine)

Merge commit `21a3b81` (2026-10-05, about 08:38 +04): `origin/main` f46cd70 (slice 3 part A About/Contact in React `e0dd82f`, Phase 4 money engine `d3d2615`, planning notes) into this branch on top of `f263d04`. Main wins; slice 2's additions kept. package-lock.json did not change, so no `npm ci`.

Resolutions, one line each:

- `lib/locale-path.ts`: PUBLIC_PAGES = main's `/`, `/private-stays`, `/private-stays/[stay]`, `/about`, `/contact`, `/blog`, `/blog/[post]`, then slice 2's `/destinations`, `/experiences`.
- `scripts/media-lib.mjs`: `publicDocuments()` stays the one computed list (S3-11); main's `SLICE3_PAGES`/`slice3Documents(pages)` and `reactDocuments(stays, posts, pages)` are now derived from it, no hand-kept list.
- `scripts/media-guard.mjs`: slice 2's code (manifest-key check, `publicDocuments()`); main changed only comments, which now name About and Contact.
- `lib/data/fixtures/image-translations.json`: union, slice 2's records then main's 42 appended: 519 records, 173 image ids, each exactly en, ar, es, no duplicate.
- `tests/locale-path.test.mjs`: main's tests plus slice 2's; `/about` and `/contact` are localised now, so the English-only examples moved to `/login` and `/destinations` expects `/ar/destinations`.
- `tests/data-sample.test.mjs`: fixture list is the union (`about` and `destinations-page`); floor stays 118 + 41.
- `tests/media-guard.test.mjs`: slice 2's out/ coverage tests and imports plus `slice3Documents`; main's slice 3 RED test uses PUBLIC_PAGES as is (it already holds both pages); main's `slice3Documents` test rewritten without the removed `slice1Documents`.
- `tests/media-manifest.test.mjs`: main's tests kept; `slice1Documents` import dropped (gone in slice 2); the page list is de-duplicated.
- `tests/build/home/home.spec.ts`: slice 2's cases (service cards to `/experiences?...`) with main's `localePath(locale, "/contact")` for both Request Consultation links.
- `tests/build/locale-routing.spec.ts`: DEFAULT_PATHS = slice 2's list plus main's `/about`, `/contact`.
- Outside the conflict list, needed by the merge: `tests/data-contract.test.mjs` manifest count is computed (118 + slice 2's 40 + about/ entries, was a typed 158); `tests/media-guard.test.mjs` source scan asserts no Framer route file remains (main had `>= 1`; slice 2 and slice 3A removed the last ones); `tests/build/experiences/overlay.spec.ts` Request Inquiry expects `localePath(locale, "/contact")`; `tests/build/slice2-sweep.spec.ts` sweep list leaves About and Contact to slice 3A's own specs, as it does the blog.

Checks run on the merge (`21a3b81` content, PW_PORT 3048, `--workers=1`):

- No conflict markers outside node_modules. `node scripts/assemble-cloudflare.mjs --target=local`: 69 html files, 0 Framer, React en 22 / ar 22 / es 22, 3 404s.
- `npx tsc --noEmit`: clean. `npm run tokens:check`: theme up to date.
- `node --test tests/*.test.mjs`: 943 tests, 931 passed, 0 failed, 12 skipped.
- `node scripts/media-guard.mjs --deploy`: OK, 66 documents, 1146 image references.
- `node scripts/media-upload.mjs --public-base https://media.almarprivatejourney.com` (dry run, after `media-fetch --offline` copied main's 12 local about/ files into the gitignored cache): 170 entries, 40 PUT, 130 SKIP; the 40 PUT are exactly slice 2's keys; main's 12 about/ keys are already uploaded.
- `MEDIA_CHECK_OUT=1 node --test tests/media-guard.test.mjs`: 33 passed; 66 documents, 170 keys referenced, 0 unreferenced.
- Build node tests (`tests/build/*.test.mjs tests/build/**/*.test.mjs`): 493 passed, 0 failed.
- Build Playwright, slice2-sweep, redirects, destinations, experiences, locale-routing, home: 1336 tests; first run 1335 passed, 1 failed (the sweep list, 54 vs 48, About and Contact now public); fixed, that test rerun: passed. A first attempt was stopped at test 240 by the shell's time limit; it had shown the two overlay `/contact` failures (ar 390), fixed before the full run, and both passed in it.
- Extra: build Playwright `tests/build/about tests/build/contact` (slice 3A's specs) on the merge: 189 passed.

The full dev and build Playwright suites (2270 / 2487 passed) ran on `14ed6db` before this merge and were not rerun in full.
