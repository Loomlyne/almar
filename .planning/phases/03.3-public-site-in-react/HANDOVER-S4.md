# Phase 3.3 slice 4 (job 09): hand-over, the blog and its three posts

Written 2026-10-05 for the controller. Work session: executor of plans 03.3-30 to 03.3-33. Nothing pushed, nothing deployed, no wrangler command except the build config's local `wrangler dev` under Playwright (ports 8797, 8941, 8943, 3142: all started by me, all ended). No message sent to any session.

## 1. Branch and commit

- Branch `gsd/phase-3.3-slice-4`. Code last changed at `8318b7c`; the commit after it holds this file and `03.3-33-SUMMARY.md` (planning only).
- Commits of this plan: `1843cc6` fix (post body overflowed 390), `7eb9873` the three blog test files plus helpers, `a34046e` slice 1's JSON-LD URL guard allows the BlogPosting cover on the media host, `8318b7c` slice 1's sitemap guard counts the 12 blog documents.
- I merged nothing. `origin/gsd/phase-3.3-slice-1` (with `b698507`) was merged by the earlier plans (`1ac5f24`). A merge of `origin/main` (`db36860`, 01:49 +04) appeared on this branch while my check run was going; I did not make it. It changes only `.planning/` files (`git diff --name-only 7eb9873 a34046e`: CONTROL-BOARD, STATE, one decision, three prompts, plus my one test file), so the checks below stay valid for code.
- Folder clean after the hand-over commit.

## 2. Check set (final code commit `8318b7c`, `--workers=1`, no pattern kill)

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/*.test.mjs` | 642 tests, 638 pass, 0 fail, 4 skipped (the opt-in ones) |
| `npm run tokens:check` | theme up to date |
| `npm run build` | exit 0 |
| `ALMAR_HARNESS=1 PW_PORT=3142 npx playwright test --workers=1` (dev + harness) | 1977 tests: **1949 passed, 28 skipped, 0 failed** (1.3 h) |
| `node scripts/assemble-cloudflare.mjs` | 65 html: 8 Framer, React en 18 / ar 18 / es 18, 3 404s |
| `node scripts/media-guard.mjs --deploy` | OK, 54 documents, 912 image references |
| `node --test tests/build/*.test.mjs tests/build/*/*.test.mjs` | first run 369 tests, 360 pass, **9 fail** (see red 1); after the fix 369 / 369 pass |
| `PW_PORT=8941 npx playwright test -c playwright.build.config.ts --workers=1` | 1834 tests: first run **1833 passed, 1 failed** (see red 2, 1.3 h); the one failing test rerun after the fix: 1 / 1 pass |

Reds, both real and both caused by slice 4 reaching a slice 1 guard that the plans did not run:
1. `tests/build/assembled-site.test.mjs` "organisation JSON-LD on the real domain" failed on the 9 post documents: it demanded every URL in any JSON-LD block start with the site origin, but a BlogPosting's `image` is the cover on the media host. Fixed (`a34046e`) by allowing the media host; 238 / 238 in that file, 369 / 369 across the build node tests.
2. `tests/build/slice1-sweep.spec.ts` sitemap test hard-coded 42 documents with alternates; there are now 54. Fixed (`8318b7c`): `DOCUMENTS.length + 12`.
No dead-server artifacts occurred. One real product bug was found by the sweep and fixed (see Deviations in the summary): the post body overflowed the screen at 390 (415 px wide) because the Contact button's no-wrap width stretched the grid track (`1843cc6`, `components/pages/post-page.tsx`, two class changes).

`grep -rn "fixtures/" components app`: empty.

## 3. Control table (every shown control exercised in a browser, on the assembled `out/` under local wrangler, en/ar/es at 390/834/1440)

Spec file `tests/build/blog/blog.spec.ts` unless noted; 99 tests (11 per locale-width cell) plus 6 routing tests.

| Control | Page | Test |
|---|---|---|
| list card to post | /blog | 2 |
| post served bytes, JS off, sessionStorage untouched on opening a post | post | 1 |
| language select; footer language row | post | 3 |
| featured stay card to the stay page; experience card is not a link; coffee post has neither | post | 4 |
| related story cards | post | 5 |
| Copy link: clipboard equals the canonical absolute URL, toast and live region | post | 6 |
| hero Search with destination, dates and guests to /private-stays: destination chip pressed, dates trigger set, guests 2, count line changed; phone sheet ends in Search | post (Cartagena, pre-filled) | 7 |
| same on a post with no destination (Where empty, then chosen) | coffee post | 7b |
| missing-step messages with nothing chosen (bar error both / dates; sheet warn where / when) | coffee post | 8 |
| Plan Your Journey contact button to /contact; Back, Home, Destinations links | post | 9 |
| home Read All to the localised /blog; a home story card to its post | home | 10 |
| tag, featured cards, pre-filled or empty Where, no On this page, per post | the three posts | 11 |
| 12 URLs answer 200, no redirect, lang and dir; `/blog/`, `/ar/blog/<slug>/` etc. answer 307 to the no-slash form; `/blog/nope`, `/ar/blog/nope`, `/es/blog/nope` serve that language's 404 | routing | last describe |

Also `tests/build/blog/built-documents.test.mjs` (86 node tests on the 12 files and the sitemap).

## 4. Held list (absent from the DOM, asserted by role and by each language's label)

Continue, Add, cart, Login, newsletter, any email input or textarea or form field, currency select, the "Plan this journey" section and the "See private stays" hand-off link, List with us. The hero's Search is rendered and working (v4): one `type=submit` from 768 px up (inside the hero bar's form), none shown below it (the bar is hidden there; the sheet's last-step Search is a plain button). `tests/build/blog/sweep.spec.ts`.

## 5. The 12 x 3 matrix

`sweep.spec.ts`: 36 tests, all pass: per document and width the status, one h1, lang and dir, no horizontal overflow, four hreflang links, canonical without a slash, every image on the media host with none missing from the manifest, no framerusercontent, catbox or pexels request, held controls absent. A full-page picture of each, taken after a scroll-through so the reveals have shown, is written to `test-results/blog/<locale>-<width>-<page>.png` (36 files, gitignored). Compare by eye with `s4-framer-match-2026-10-04/compare-post-v4-*.png`.

## 6. For the controller

a. `tests/design-tokens.test.mjs` got a second `dangerouslySetInnerHTML` exemption for `components/site/blog-posting-json-ld.ts` (it escapes `<` and never assigns `innerHTML`). Shared, controller-gated: needs his grant.
b. `scripts/media-lib.mjs` gained `readPostSlugs`, `blogDocuments`, `reactDocuments`; replace with slice 2's `publicDocuments()` when it lands (S3-11). Media guard and its test point at `reactDocuments`.
c. No `eje-cafetero` destination exists: the coffee post has no destination, so no tag, no featured cards, an empty Where, and the post is unlinked from any destination.
d. Proposed board row for job 09: "09 Phase 3.3 slice 4: handed over 2026-10-05 at `<hand-over commit>` on `gsd/phase-3.3-slice-4`; plans 30 to 33 done; node 642/638/0/4, dev 1949/28/0, build node 369/369, build browser 1834/1834 after two guard fixes; awaits the lead's merge of slices 2 and 3, then his Ship". Proposed STATE line: "Phase 3.3 slice 4 built and proven; the blog and three posts in React in EN/AR/ES; AR/ES texts are drafts for his review."
e. `JourneyChoiceProvider` lives in `components/pages/home/` and now serves the home and the post page. Move to `components/journey/` (imports only), after slices 2 and 3 land. Not done here.
f. Board 5k draws the newsletter block as a contact form, not a signup: a board defect for job 08 (job 08 owns the newsletter answer for every slice).
g. Arabic and Spanish drafts awaiting the owner's review (all marked draft in the data): `lib/copy/blog.ts` (every AR and ES string except the board 5j/5k dictionary ones named in its header), `lib/data/fixtures/post-translations.json` (AR and ES title, excerpt, body, seo of the three posts, all `status: draft`). (Plan 30 only moved the story text out of the home fixtures into the posts fixtures; the AR/ES wording is the same drafts.)
h. Slice 1's `tests/build/assembled-site.test.mjs` and `tests/build/slice1-sweep.spec.ts` were edited (one line each, reds 1 and 2). Shared files; additive in meaning.

## 7. Not verified, in plain words

- The Arabic and Spanish texts have not been read by the owner.
- Real devices; only Chromium headless at 390, 834 and 1440.
- The live preview host: nothing deployed, so steps below are not yet run there.
- The Copy link toast and the clipboard were checked with Chromium's clipboard permission granted; a browser that refuses the permission shows the failure toast (covered by the component's own test, not here).
- No Framer visual diff beyond the pictures for his eye.

Migrations: none. Environment names added: none. R2 upload: none. Hosted database: untouched.

## 8. The owner's test steps, on `preview.almarprivatejourney.com` after the controller's preview deploy

1. Open `/blog` at phone width. Expect: `Travel Insights`, three cards newest first (Cartagena, Medellín, Coffee).
2. Tap the Cartagena card. Expect: a photo at the top with the date, `1 min read`, `Cartagena` tag, the title, the booking bar with Search and the line under it; below, the paragraph, the contact button, three links, Copy link; then Getsemaní Colonial House and Cartagena Heritage Tours cards and two related stories.
3. Tap `Copy link`, paste it in a note. Expect: `https://almarprivatejourney.com/blog/discovering-cartagenas-hidden-colonial-courtyards` (the permanent address, not the preview host: that is what a guest shares) and a `Link copied` message.
4. In the photo at the top pick dates and 2 adults, tap Search. Expect: the private stays list for Cartagena, only stays free on those nights that sleep 2.
5. Back on the post, switch language to العربية. Expect: `/ar/blog/…`, right-to-left, the Arabic draft text, the date `1 يونيو 2025`.
6. Open the coffee post. Expect: no tag, no featured cards, Where empty.
7. Repeat 1 and 2 at desktop width. Expect: the same content; no Continue, Add, cart, Login or newsletter anywhere.

## 9. Lessons

Running the full build set once showed two slice 1 guards that only the build runner exercises (JSON-LD URL origin, sitemap count): the plans 30 to 32 summaries ran node and dev tests only. A converted page should run the build specs before its own hand-over, not at plan 33.
