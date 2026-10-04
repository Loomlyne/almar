# Phase 3.3 slice 1: plan 08 hand-over (preview host, crawl files, final gate)

Written 2026-10-04 15:06 +0400. For the controller (`local_836ffacc-ca03-41c4-b1ff-385b8aa9d357`). Work session: plan 08, wave 4, the
last plan of slice 1. Nothing was pushed, nothing was deployed, no wrangler command was run by me (the only wrangler
process was the build config's local `wrangler dev` under Playwright), no message was sent to any other session.

## 1. Branch and commit

- Branch `gsd/phase-3.3-s1-p08`, cut from `origin/gsd/phase-3.3-slice-1` at `0f33130` (plans 01 to 07, the money fix, the
  integration fixes and the media flip). The controller named this branch; the plan said `gsd/phase-3.3-slice-1`.
- Commits since `0f33130`:

| Commit | What |
|---|---|
| `5c97087` | merge `origin/main` `913cddc` (seven `.planning/` files: board, state, handoff, prompts 07 to 09, one decision). No conflict, no code |
| `b6f25ed` | `wrangler.preview.toml`, `deploy/{preview,production}/`, `scripts/crawl-files.mjs`, `tests/crawl-files.test.mjs` (39), `tests/preview-config.test.mjs` (10), `.gitignore` `/out-preview/` |
| `04f1caa` | assembler `--target=local|preview|production`, preview into `out-preview/`; `tests/assemble-target.test.mjs` (15) |
| `31629d8` | `tests/build/slice1-sweep.spec.ts`: 42 documents x 3 widths, real-page control tests, crawl files as served |
| `8a934a6` | the `language links` hang: `tests/helpers/click-clear-of-dock.ts`, `locale-routing.spec.ts`, sweep footer clicks |
| `bad84d8` | merge `origin/main` `06d5d2c` (`CONTROL-BOARD.md`, `STATE.md` only). No conflict, no code |
| `8d3c7e7` | `crawl-files.mjs` no longer names the test harness (`tests/harness-gate.test.mjs` scans `scripts/`) |
| `c239b10` | comment-only: two test comments now say the page height is still changing (cause not isolated) instead of naming the fonts. `git diff --stat 8d3c7e7 c239b10`: two files, 8 insertions, 6 deletions, no code line. `tsc` clean |
| `c968859` | merge `origin/main` `2bccc60` (board, state, one decision, prompt 10). No conflict, no code |
| the commit after `c968859` | this file and `03.3-08-SUMMARY.md` (planning files, no code) |

- **Every check below ran on `8d3c7e7`** (the last commit that changed code), except where a row says `c239b10`. `c239b10` and the two merges after it change two comments and `.planning/` files only. `origin/main` (`2bccc60` at the end) is an ancestor of the branch. `git status` is clean after the hand-over commit; nothing is pushed.
- Task 1 (base check): job 05's two tests are gone, plan 06's replacements exist, `find app/private-stays -name route.ts` prints
  nothing, `grep -rli mariven app components lib` prints 0. The "12 modify/delete resolutions" the plan mentions were the lead's
  merge before wave 2; this plan had none.

## 2. Check set

All on `8d3c7e7` unless a row says otherwise, in this worktree, `--workers=1`, `PW_PORT=3071`, no process killed by pattern.

| Check | Result |
|---|---|
| `npm ci` | exit 0, 456 packages |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/*.test.mjs` | **556 tests, 552 pass, 0 fail, 4 skipped** (the opt-in `out/` scan, the pin on the deleted Framer home, and the two tests that need the gitignored `media-staging/`, each logging its reason). Controller's number on `0f33130` was 492 / 488 / 0 / 4: the 64 new tests are mine (39 + 10 + 15). The first run on `bad84d8` had one failure, `tests/harness-gate.test.mjs` (my `scripts/crawl-files.mjs` named the harness); fixed in `8d3c7e7`, then 556 / 552 / 0 / 4 |
| `npm run tokens:check` | theme up to date |
| `npm run build` | exit 0, 76 static pages |
| `npx playwright test --workers=1` (dev config, `next dev`) | **1887 tests: 1859 passed, 28 skipped, 0 failed**, 18.4 min |
| `node scripts/assemble-cloudflare.mjs` (default target) | exit 0: `assembled 57 html files into out/ (target: local): 12 Framer, React en 14 / ar 14 / es 14, 3 404s` |
| Task 3 acceptance on that `out/` | `cmp _headers out/_headers` 0; `cmp deploy/production/robots.txt out/robots.txt` 0; `grep -ciE "noindex|x-robots-tag" out/_headers` 0; bare `Disallow: /` lines 0; `<url>` 54 = 42 + 12 (12 is also the count of Framer `route.ts` files holding `const HTML = "` and of the English-only documents in `out/`, both computed); `hreflang="x-default"` 42; excluded-path grep 0; `const HTML = ` + backtick in the assembler 0 |
| `node --test tests/build/*.test.mjs` | 198 tests, 198 pass, 0 fail |
| `MEDIA_CHECK_OUT=1 node --test tests/media-guard.test.mjs` | 19 / 19 |
| `node scripts/media-guard.mjs --deploy` | OK `https://media.almarprivatejourney.com`, 42 documents, 783 image references |
| `npx playwright test -c playwright.build.config.ts --workers=1` (build config, wrangler dev over `out/`) | **1384 tests: 1384 passed, 0 failed, 0 skipped**, 22.3 min. It holds the 204 sweep tests, 505 `locale-routing` tests (126 server routing, 252 language links, 126 language select, the slice inventory), `home` 90, `private-stays` 129, `stay-detail` and the Mariven guard. No hang, no rerun needed |
| `git diff --exit-code origin/main -- wrangler.toml` | exit 0 |
| fixture-import greps, `tests/data-boundary.test.mjs` | section 3 |

**Both targets, on the final commit** (`assertMediaReady()` now passes because the flip is in): `--target=preview` exit 0 (`assembled 57 html files into out-preview/ (target: preview)`): `X-Robots-Tag: noindex` count 1, `Disallow: /` count 1, no
`sitemap.xml`, `node scripts/media-guard.mjs --deploy --out out-preview` OK 42 documents, 783 image references; `out/` tree hash identical before and after (`c345b3ce7d6fbf05`).
`--target=production` exit 0 (`... into out/ (target: production)`): `cmp _headers out/_headers` identical, `noindex|x-robots-tag` count 0, `<url>` 54,
`node scripts/media-guard.mjs --deploy` OK 42 documents, 783 image references; `out-preview/` unchanged by it. Run on `c239b10`. `out/` is left as the production variant.

**The `language links` hang (the controller's known flake): handled, not hidden.** It was a hang, not load. All runs, in order:

| Run | Spec state | Machine | Result |
|---|---|---|---|
| A | unmodified, 42 tests (`language links: ar /private-stays/*`, one `en`, one `server routing`) | idle | 42 passed, 4.4 to 9.3 s each. No timeout |
| B | `routeMedia` added, 45 tests | busy (load average above 60, other products' Playwright and wrangler running) | 6 failed, 39 passed; same again: 8 failed, 37 passed. All `ar` stay pages, all at the 30 s timeout |
| C | `routeMedia`, one test per target language, `test.slow()`, 84 tests | busy, then calm | 7 failed (each at 90 s), 77 passed. The passing ones took 0.4 s: so a hang, not slowness |
| D | one failing test repeated | calm (load 4) | 1 hang in 8, 1 in 14; the same click alone with a 4 s limit: 4 in 40, 3 in 60, 3 in 50 |
| E | click log of a stuck click | calm | "`<span>` from the fixed dock (`div.fixed.bottom-0`) subtree intercepts pointer events". Page state while stuck: link at y 800 to 844, the dock at 756 to 844, `scrollY` 7401 of a possible 7576, never changing |
| F | other remedies tried | calm | scroll to the end before clicking: 8 hangs in 60 (worse); centre once: 5 in 50; `scroll-padding-bottom` on the root: not measurable here (adding a style needs JavaScript and the stuck context has it off) |
| G | **`clickClearOfDock()` (centre the link on every attempt, then click)** | calm | **0 failures in 60 clicks** (at most 2 attempts), then **0 failures in 40 runs of the spec test** |

Cause: a stay page pins an 88 px dock over the bottom of the screen; the page's height is still changing when the footer link is scrolled to the
bottom edge, so the link ends up behind the dock; Playwright counts a link inside the viewport as "in view", never scrolls it clear, and retries
the same position until the timeout. What changes the height was not isolated (the Arabic font swap is the likely cause: only `ar` stay pages hung, and
only in the no-script context was it reproduced). The fix is in the helper `tests/helpers/click-clear-of-dock.ts`, used by `locale-routing.spec.ts` and by the sweep's footer
clicks. The same spec file also now answers images with `routeMedia` and has one `language links` test per target language (252
tests instead of 126) with `test.slow()`: smaller and hermetic, but neither cured the hang by itself (run C). Run on `8d3c7e7`: all 505 `locale-routing` tests passed in the build-config suite; the slowest `language links` test took 2.8 s; none timed out.

**Reruns.** No file hung or failed on `8d3c7e7`, so none was rerun. Extra runs, all green: `node --test tests/*.test.mjs` once more with the 117 images cached in
`media-staging/` (556 tests, 554 pass, 0 fail, 2 skipped: the opt-in `out/` scan, which needs `MEDIA_CHECK_OUT=1`, and the pin on the deleted Framer home; the two cache-dependent tests ran); the sweep spec once more with the real photographs
(204 passed, 5.3 min, section 5). The controller's own clean-clone run on `0f33130` was slowed by contention and three `stay-detail-held` tests hung 11 to 17 min; none
did here (`stay-detail.spec.ts` took 5.9 min in all; the three `stay-detail-held` tests I looked at in the log took 1.6 to 1.7 s each) with nothing else of the controller's running. The machine was not otherwise idle: other
products' Playwright and wrangler processes ran at times (finding 2 in section 11).

## 3. No component imports a fixture

```
$ grep -rnE "lib/data/(fixtures|resolve|media)" app components
$ grep -rln "fixtures/" app components
$ node --test tests/data-boundary.test.mjs
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

Both greps print nothing (exit 1) on `8d3c7e7`.

## 4. Every rendered control, and how it was exercised

The 29 rows of design 4.1. Every row has a browser test on a real page of the assembled site; none counts a file-text assertion.
Rows 1, 3, 4, 7, 11 and 28 had no such test before this plan: their tests are in `slice1-sweep.spec.ts` and run on a home, a list and a
stay page in each of the three languages.

Spec files (all under `tests/build/`, all run on the assembled `out/` served by local wrangler, so the Cloudflare
asset rules apply; every title below is a real browser test):
**S** = `slice1-sweep.spec.ts` (this plan) · **H** = `home/home.spec.ts` · **L** = `private-stays/private-stays.spec.ts` ·
**D** = `stay-detail/stay-detail.spec.ts` · **F** = `public-frame/public-frame.spec.ts` · **R** = `locale-routing.spec.ts`.
Page kinds: **home** = `/`, **list** = `/private-stays`, **stay** = a stay page; each in en, ar and es.

| # | Control | Pages | Spec file | Test title (start) | What the test clicked or typed | Asserted result |
|---|---|---|---|---|---|---|
| 1 | Nav links (Destinations, Experiences, About, Contact) | home, list, stay | S | `row 1 nav links: Destinations, Experiences, About, Contact each go to their page` (1440) and `row 1 nav link inside the Menu` (390) | Clicked each of the four links in the primary nav; at 390 opened the Menu first and clicked Contact | `href` equals `siteHref(locale, path)`; the click's navigation answers 200 at exactly that path with no redirect; the four are Framer pages in English in every language |
| 2 | Wordmark | home, list, stay | F, H | F `1 the logo on the list page / stay page goes to the language's home, with no redirect`; H `8 every link goes where it says` | Clicked the wordmark | `href` is `/`, `/ar/` or `/es/`; lands on it with `lang` of that language and no 3xx |
| 3 | Menu (phone and tablet) | home, list, stay | S | `row 3 Menu: opens, holds the page, Close and Escape close it and focus returns` (390 and 834) | Clicked Menu; pressed Escape; clicked Menu again; clicked Close menu | `aria-expanded`, Close button takes focus, four nav links show, `body` stops scrolling; Escape and Close hide the nav and focus returns to the Menu button |
| 4 | Skip to content | home, list, stay | S | `row 4 Skip to content: the first Tab stop, visible, and Enter lands in the content` | Pressed Tab on a fresh page, then Enter, then Tab | The skip link is the first stop, is visible while focused, Enter sets `#content`, the next stop is inside `main#content` |
| 5 | Language select | home, list, stay | R, L, D | R `language select: <locale> <path> at <width>` (all 42 documents x 3 widths); L `9. language switch`; D `language @…` | Opened the combobox (inside the Menu below 1152), picked each other language | No 3xx; lands on `localePath(target, path)`; served `lang` and `dir` of the target; cookie `almar-locale` equals the target |
| 6 | Currency select | home only (absent on list and stay) | H, F | H `6 currency: three prices move together, survive a language switch and a reload`; F `3 the list and stay pages have no currency select; the home's is bound to its saved choice` | Chose USD, AED, EUR; switched language; reloaded; on list and stay looked for the select | The three tier prices equal `rewriteHomeAmounts` for each code and nothing else moves; the rates line prints; the choice survives a language switch and a reload; no currency select on list and stay |
| 7 | WhatsApp float | home, list, stay | S, F | S `row 7 WhatsApp float: one link to the owner's number, opening in a new tab` (390 and 1440); F `4 the WhatsApp float` | Clicked the float (the request to wa.me is answered by the test, nothing leaves the Mac) | `href` is `https://wa.me/971563883302`, `target=_blank`, `rel` has `noopener`; a new tab opens at exactly that address; the page itself does not move; on a stay page it sits above the dock |
| 8 | Journey bar · Where | home (list the data's destinations); stay (locked) | H, D | H `3 Where, When, Who with no submit anywhere`; D `locked segments @…` | Home: opened Where, picked Medellín. Stay: clicked the locked Destination and Stay segments and pressed Enter | Home: the listbox holds exactly the data layer's destinations in order, the segment shows Medellín, When opens by itself. Stay: a lock shows, nothing opens, Tab goes on to Dates |
| 9 | Journey bar · When | home, stay | H, D | H `3 …`; D `dates @…` | Home: picked arrival and departure, Done. Stay: opened the calendar, clicked a blocked day, picked a 3-night range, Done | Home: the segment reads the range. Stay: the blocked day is `aria-disabled`, struck through, and a click leaves the segment empty; the range reads in the segment and the dock; Done moves to Who |
| 10 | Journey bar · Who | home, stay | H, D | H `3 …`; D `guests @…` | Clicked + adult, Done | The segment (and on a stay page the dock) reads "2 adults" in the language, with the Arabic forms |
| 11 | Journey bar · segment states | home | S | `row 11 segment states: empty, hover, open and filled` | Hovered Where, clicked it, picked the first destination | Empty text; hover turns the segment white; open sets `aria-expanded` and the inset rule; filled shows the destination |
| 12 | Phone entry row and sheet | home, stay (390) | H, D | H `3 …` (phone branch); D `sheet @390…` | Clicked the entry row; walked Where, When, Who; Back; Next; Done | "1 of 3" to "3 of 3", the sheet never offers Search, the entry row then reads destination, range and guests; on a stay Back from When closes the sheet |
| 13 | Docked bar / docked row | home | H | `5 docked: the planner follows the page once the hero has scrolled away` | Scrolled past the hero, clicked the docked Dates segment (or the docked row on a phone) | The panel (or the sheet) opens from the docked control; back at the top the docked planner is gone |
| 14 | Hero bar handoff | home to list | H, L | H `4 the choice has a visible result…`; L `8. handoff` | Planned Medellín, two dates, 2 adults on the home; clicked View All Private Stays; opened the list with a bad query | Only the two Medellín stays show and the count reads 2; the link carries `?destination=medellin&from=…&to=…&guests=2`; the list opens with that applied; bad input is ignored |
| 15 | Search stays | list | L | `3. search: title, neighbourhood and destination, accent- and case-insensitive; Clear appears` | Typed `getsemani`, `GETSEMANÍ`, `cartagena` | Grid and count equal the one `filterStays`; Clear filters appears |
| 16 | Destination chips | list | L | `4. destination chips…` | Clicked each chip, then All | `aria-pressed` follows; grid and count follow |
| 17 | Guests stepper | list | L | `5. guests…` | Clicked + 11, 20 and to the maximum, then - back to 0 | Count and grid follow each value; stops at the largest capacity; 0 is "Any" |
| 18 | Bedrooms chips | list | L | `6. bedrooms…` | Clicked 1-4, 5-8, 9+, Any | Grid and count follow the bucket |
| 19 | Result count | list | L | `2. initial grid…`, `12. screen-reader names…` | Read the line after each filter | Plural form per language, in an `aria-live=polite` line |
| 20 | Clear filters | list | L | `7. empty state and Clear…` | Typed `zzzz`, clicked Clear filters (twice, from two states) | Twelve cards back, every control reset, the query string removed, focus on the search box |
| 21 | Stay card | list, home, stay | L, H, D | L `10. card navigation`; H `8 …`; D `related @…` | Clicked the first card on the list, a card on the home, the first related card on a stay | Lands on the stay's own address; the related card's page heading is that stay |
| 22 | View All Private Stays | home | H | `4 …` | Clicked it | Lands on the exact carried address |
| 23 | View All Services | home | H | `8 every link goes where it says` | Clicked it | Lands on `/experiences` |
| 24 | Read All | home | H | `8 …` | Clicked it | Lands on `/blog` |
| 25 | Request Consultation (2) | home | H | `8 …` | Clicked both | Land on `/contact` |
| 26 | Request Inquiry | stay | D | `Request Inquiry @390…` | Clicked it | One link; lands on `/contact` with 200 |
| 27 | Gallery | stay, home | D, H | D `gallery @…`; H `7 gallery lightbox…` | Clicked a tile; Next; the arrow key; Escape | Count line moves, wraps at the last picture, Escape returns focus to the tile |
| 28 | Footer links | home, list, stay | S | `row 28 footer links: pages, mail, phone and Instagram` | Clicked each of the four page links; focused and clicked the mail and phone links; clicked Instagram (answered by the test) | Pages: 200 at the exact path; mail and phone: exact `mailto:` and `tel:` values, reachable by keyboard, the page does not move; Instagram opens its own address in a new tab |
| 29 | Footer language row | home, list, stay | R, L, D | R `language links: <locale> <path> at <width>` (42 documents x 3 widths, with JavaScript on and off); L `9.`; D `language @…` | Clicked the other two languages | Three links equal `localeHrefs`; each switch lands on the target's own document with no redirect and the right `lang` and `dir` |

## 5. Pages checked

All 14 pages x 3 locales = 42 documents, at 390, 834 and 1440 (126 cases), by `tests/build/slice1-sweep.spec.ts`. Each case asserts: 200
with no redirect; `lang` and `dir` in the served bytes and in the DOM; four `hreflang` links in the served bytes and in the DOM equal to
`localeAlternates`; one `h1`; no horizontal overflow; every image painted; no `button[type=submit]`, no `input[type=email]`, none of the
held controls by name (with the Menu closed and, below 1152 px, open); none of `framerusercontent.com`, `files.catbox.moe`,
`videos.pexels.com` in the DOM; no page error and no console error. **Screenshots:** `/Users/koss/Developer/almarprod-Website-Code/.claude/worktrees/phase-3.3-w4-p08/test-results/slice1/<locale>/<page>-<width>.png`, 126 files, 429 MB,
gitignored, never committed, written by the last sweep run (204 passed, 5.3 min) with the 117 real photographs served from disk. I opened one of them (`ar/getsemani-colonial-house-390.png`:
right to left, photos, footer) and did not review the other 125. They are evidence for the controller, not the owner's review.

Result of the last sweep run, per document and width (every cell is the sweep case for that document: all assertions above):

| page | en 390 | en 834 | en 1440 | ar 390 | ar 834 | ar 1440 | es 390 | es 834 | es 1440 |
|---|---|---|---|---|---|---|---|---|---|
| home | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| private-stays | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| getsemani-colonial-house | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| getsemani-courtyard-residence | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| cartagena-historic-center-house | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| casa-jardin-san-diego | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| casa-juliana-historic-center | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| casa-mariana-historic-center | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| baru-island-private-villa | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| bocagrande-beach-house | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| private-island-cartagena | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| private-island-estate-cartagena | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| santa-fe-farm-antioquia | pass | pass | pass | pass | pass | pass | pass | pass | pass |
| sopetran-country-estate | pass | pass | pass | pass | pass | pass | pass | pass | pass |


## 6. The eight controls not rendered (and Discover the Journey)

None of these is rendered, disabled or hidden by CSS: it is absent from the DOM. The proof is
`tests/build/slice1-sweep.spec.ts`, part 1, on all 42 documents at 390, 834 and 1440 (126 cases): `button[type=submit]`
count 0, `input[type=email]` count 0, and `getByRole("button")` and `getByRole("link")` with the exact label of each
control in that document's language count 0, with the header Menu closed and, below 1152 px, open. Labels come from
`lib/copy` and from the canvas dictionary the boards were drawn from; "See Packages" exists only in English, so the
English string is used in all three languages. The page specs assert the same on their own page (H `9`, L `13`, D
`stay-detail-held.spec.ts`).

| # | Control | Where it is drawn | Why it cannot work in slice 1 | Returns in | Labels the sweep looks for (en) |
|---|---|---|---|---|---|
| 1 | Journey bar and sheet `Search` | Hero, phone hero, boards 4a, 4b, 5i | Its target `/booking/trip` is not a React page and answers 404 in production | Phase 4 | `Search` |
| 2 | Nav cart | Boards 5h, 5g, 5i, 3b | There is no cart | The cart slice of 3.3, then Phase 4 | `Cart` |
| 3 | Nav `Login` | Boards 5h, 5i, 3b | There is no session; `/login` answers 404 in production | Phase 2 | `Login` |
| 4 | Footer newsletter (`Email` and `Subscribe`) | Boards 5h, 5i, 3b, the live footer | `app/newsletter/route.ts` is 404 in production and needs `RESEND_API_KEY` and a verified Resend domain | Phase 6 (SITE-08) | `Subscribe`, and no `input[type=email]` |
| 5 | Footer `List with us` | Boards 5h, 5i, 3b | There is no page and no form | Phase 6 (SITE-05) | `List with us` |
| 6 | Stay page add-on `Add` | Board 5i | It adds to a cart that does not exist | The cart slice, then Phase 4 | `Add` |
| 7 | Stay page dock `Continue` | Board 5i | It continues into the booking flow; the dock itself is a live summary with no control | Phase 4 | `Continue`, `Continue to travelers` |
| 8 | `See Packages` | Hero destination-menu footnote | Packages are marked Coming soon and have no page | Phase 6 | `See Packages` |
| + | `Discover the Journey` (and `Design your journey`) | The three tier cards on the live home | No href anywhere on the live site and no decided destination | Not scheduled (design 7.9) | `Discover the Journey`, `Design your journey` |

## 7. MEDIA_BASE_URL_IS_PLACEHOLDER

- At `8d3c7e7`: `MEDIA_BASE_URL_IS_PLACEHOLDER = false`, `MEDIA_BASE_URL = "https://media.almarprivatejourney.com"` (the controller's flip,
  `4d61eda`). So `--target=preview` and `--target=production` are no longer refused by plan 07's `assertMediaReady()`.
- Proved both ways on the real files. With a temporary edit of `lib/data/media.ts` (flag true, `media-pending.invalid`, then `git checkout --`
  of that one file): both targets exit 1 with `media host is a placeholder (MEDIA_BASE_URL_IS_PLACEHOLDER = true): R2 runbook step C9 has not
  landed` before the build starts, and `out/` is byte-identical afterwards. With the real flip: both targets build, and
  `node scripts/media-guard.mjs --deploy --out out-preview` and `node scripts/media-guard.mjs --deploy` print `OK
  https://media.almarprivatejourney.com, 42 documents, 783 image references`. `tests/assemble-target.test.mjs` holds the refusal on a scratch copy.
- Live host, plain GETs (a `Range: bytes=0-0` header, 2026-10-03 about 23:00 +04): all 117 manifest keys answer 200 or 206 with
  `image/webp` and `Cache-Control: public, max-age=31536000, immutable`; `/__almar-missing-probe.webp` answers 404.
- **Not seen in a browser:** every Playwright run used `routeMedia` (plan 07), which answers the media host from `media-staging/` or a sized
  SVG stand-in. For the 126 screenshots I ran `node scripts/media-fetch.mjs` (plain GETs to the Framer CDN, each file checked against the manifest's sha256, 24.6 MB in the gitignored `media-staging/`)
  and re-ran the sweep, so those pictures are the real ones, read from disk. No browser run loaded a picture from `media.almarprivatejourney.com` itself; the live host was probed with GETs only.

## 8. The noindex trap, how it is closed

Both Workers serve the same kind of static folder, so the one thing that must never happen is a preview-only
`noindex` reaching the live site. It is closed four ways, and each has a test:

1. **The root `_headers` never contains it.** The repo-root `_headers` is the file the assembler copies into the
   production folder; it holds only the five `Cache-Control` rules. `tests/preview-config.test.mjs` fails on
   `noindex` or `X-Robots-Tag` in it.
2. **The preview files live in `deploy/preview/`** (`_headers` with `X-Robots-Tag: noindex, nofollow`, and a
   disallow-all `robots.txt`) and reach a folder only when the assembler runs with `--target=preview`.
3. **Preview and production are different folders** (reconcile R-11). `--target=preview` builds `out-preview/`;
   `local` (the default) and `production` build `out/`. `wrangler.preview.toml` serves `./out-preview`,
   `wrangler.toml` (byte-identical to `origin/main`) serves `./out`. A preview build never writes `out/` (the tree
   hash of `out/` was identical before and after one) and a production build never writes `out-preview/`. A preview
   build can therefore never be deployed by a bare `wrangler deploy`, and `out-preview/` is gitignored.
4. **The assembler refuses a wrong folder.** `assertTargetFiles` fails the build if a production or local folder
   carries `noindex`, `X-Robots-Tag` or a bare `Disallow: /`, lacks the `Sitemap:` line or `sitemap.xml`, or if a
   preview folder lacks the block, carries it twice, or has a sitemap. It also refuses a preview target written into
   a folder not named `out-preview`, and the reverse. `public/` may hold none of `robots.txt`, `sitemap.xml` or
   `_headers` (they would be copied before the target logic runs): the assembler stops before building, and a test
   holds it. A mistyped target (`--target=previw`) or any unknown option stops before anything is built or removed.

Tests that hold it: `tests/crawl-files.test.mjs` (39), `tests/preview-config.test.mjs` (10),
`tests/assemble-target.test.mjs` (15, the assembler run as a process on a scratch copy). Red runs are in the SUMMARY.

**The one residual risk, stated plainly.** `out-preview/` is not served by `wrangler.toml`, so the only ways to put
preview files on the live site are to copy them over `out/` by hand or to edit the `directory` line of `wrangler.toml`. Before a production deploy the controller still runs
`node scripts/assemble-cloudflare.mjs --target=production` and `grep -ciE "noindex|x-robots-tag" out/_headers`
(expect 0), then `node scripts/media-guard.mjs --deploy`.

**Correction to plan 07's runbook C10** (reconcile R-12): "assemble before every deploy" is
`--target=preview` before a preview deploy and `--target=production` before a production deploy, never the bare
assembler; its media check on the folder is `node scripts/media-guard.mjs --deploy --out out-preview` for the preview
and `node scripts/media-guard.mjs --deploy` for production. `--target=local` skips plan 07's `assertMediaReady()`
so the check set can build.

**`npm run host:cloudflare` is unchanged** (reconcile R-17; `package.json` is a shared file). It runs the bare
assembler, which now builds the `local` target (production crawl files, no media check, no noindex), then a bare
`wrangler deploy`, which uses the Vamos login on this Mac and fails against the pinned ALMAR account rather than
deploying to Vamos. Proposed for the controller:
`"host:cloudflare": "node scripts/assemble-cloudflare.mjs --target=production && wrangler deploy"` and
`"host:preview": "node scripts/assemble-cloudflare.mjs --target=preview && wrangler deploy -c wrangler.preview.toml"`,
each run with the ALMAR prefix `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c`.

## 9. Crawl files

- **Production `robots.txt`** (`deploy/production/robots.txt`): `User-agent: *`, `Allow: /`, a blank line, `Sitemap: https://almarprivatejourney.com/sitemap.xml`.
  Live today the zone serves only Cloudflare's Content Signals comment block (no directives). Once the origin serves its own file Cloudflare
  serves ours, and with the managed setting on it may print its comment block first; the directives stay ours.
- **`sitemap.xml`**: 54 `<url>` entries = the 42 slice-1 documents (each with four `xhtml:link` alternates: en, ar, es, x-default pointing at
  English, all equal to `https://almarprivatejourney.com` + `localePath(...)`) + 12 English-only Framer pages with no alternates:
  `/about`, `/blog` and its three posts, `/contact`, `/destinations`, `/experiences`, `/services` and its three pages. No `lastmod` (no reliable
  date exists and none is invented). A page present in `ar` or `es` but missing a locale throws at build time.
- **Why the English-only pages are listed.** Design 8 SC5 held the sitemap back because "14 of 26 pages would be wrong". This one lists every
  live public page, so that objection no longer applies (reconcile R-15). It supersedes design 8 SC5's timing.
- **As served** (local wrangler, production variant): `/robots.txt` 200 with `Allow: /`; no `x-robots-tag` on `/`, `/ar/`, `/es/`, the list pages or a 404;
  `/sitemap.xml` 200 with an xml content type; **all 54 listed addresses answer 200 with no redirect** (`slice1-sweep.spec.ts`, part 3). Not read on a real host.

## 10. What was NOT verified

- The preview Worker was not created and no wrangler command was run: `wrangler.preview.toml` was only read as text (10 tests) and has never been parsed by wrangler.
  A malformed field would show at step 1.
- Nothing was read from `preview.almarprivatejourney.com`: not the `x-robots-tag` header, not `robots.txt`, not a page. The preview variant (`out-preview/`) was never served by
  a local wrangler either (only `out/` is); its files were checked by tests and by `grep` on the folder.
- A picture loaded from the live media host by a browser (section 7). The live host was probed with GETs only.
- Production cutover: the sitemap and `robots.txt` as Cloudflare will serve them in front of the Worker; the managed-robots prefix.
- Arabic and Spanish wording: every AR and ES string in the slice is a draft for the owner (the 12 stays, the home, the list, the 404s, the footer lines
  in section 11). No native reader looked at any of it.
- The four policy bodies (design 7.3): the stay pages show the four headings only.
- Keyboard focus under the dock in a real browser (section 11, finding 1 is measured with Playwright's scroll, not with Tab).
- Real iOS and Android behaviour of the phone sheet and the Menu; Chromium only, in every spec.
- Anything marked unverified in the seven earlier SUMMARY files (`03.3-01` to `03.3-07`), notably the no-rates branch of the home currency on a real build,
  the media upload ETags on a real R2 domain, and the money diff (a fresh Opus reviewer read `lib/fx/rates.ts` in four rounds, per the board).

## 11. Migrations, environment, proposed changes, findings

- **Migrations:** none. **Environment names added:** none (`MEDIA_BASE_URL` is a constant in `lib/data/media.ts`).
- **Dashboard cookie reads:** the nine `almar-locale` reads in dashboard and guest screens stay as they are: a different surface, not in this slice (job 06 prompt point 2).
- **Proposed changes for the controller to apply at ship:**
  - CONTROL-BOARD job 06: status "handed over for check", branch, final code commit `8d3c7e7`, this file.
  - ROADMAP 3.3 SC5: `robots.txt` and `sitemap.xml` exist in this slice's build (live once production cuts over); SC6: preview config written (`wrangler.preview.toml`), Worker pending the owner's word.
  - Design 8 SC5's "sitemap later" note is superseded by section 9.
  - `package.json` (shared file, not edited): `host:cloudflare` and a new `host:preview`, section 8.
  - `.planning/prompts` runbook C10 for plan 07: section 8.
  - `REQUIREMENTS.md` I18N-01 (from plan 03's summary): per-locale URLs supersede "same URLs".
- **For the owner's review (AR and ES are drafts, status `draft` in the copy files).** The integration fix changed the Arabic footer on `/ar/private-stays` and on its stay pages to the
  home page's lines: copyright "© 2026 المار للرحلات الخاصة. كل الحقوق محفوظة.", new-tab text "(يفتح في تبويب جديد)", Instagram label "Instagram". The phone now prints "+971 56 388 3302"
  (it dials `tel:+971563883302`). One footer table (`lib/copy/site-footer.ts`) serves the home, the list and the stay pages in all three languages.
- **Findings (not fixed here, none changes a promise made to the owner):**
  1. **The pinned stay-page dock can sit over a link that is scrolled to the bottom edge.** Measured with Playwright (link at 800 to 844 px, dock at 756 to 844, the dock's text
     the element under the point). A visitor who scrolls reaches the footer fine (the footer clears the dock at the end of the page, asserted by `stay-detail.spec.ts` "dock"). What was not
     measured is a keyboard visitor tabbing to a footer link: the browser's own scroll would use the same nearest-edge position. If it does, it is WCAG 2.2 "Focus Not Obscured". Proposed one-line
     fix in `app/globals.css` (shared file): `html { scroll-padding-bottom: var(--spacing-dock); }` while a dock exists. The test helper stays valid either way.
  2. **A stray `wrangler dev --port 8787` from the main folder** (pid 10234, parent 1, about two days old, about 97% of a core, also listening on 9229) was on this Mac throughout. It is not mine
     and I did not kill it. It slows every browser run on this Mac.
  3. **The assembler's "am I the entry point" test compares `process.argv[1]` with its own resolved path.** Run through a symlinked path (a scratch copy under `/var`, which is
     `/private/var`), it silently does nothing and exits 0. The real folder is not affected. `tests/assemble-target.test.mjs` uses real paths for that reason. A `realpath` on one side would remove the trap.
  4. `tests/ui/*` and the journey harness are unchanged; `tests/screens/before/` was not touched.

## 12. The owner's numbered steps

Step 1 is the Cloudflare gate: it runs only on the owner's word, and the controller runs it, not a work session.
Steps 2 to 13 are his review on the preview address. His "done", "correct" or "working" on a step is a pass;
anything else goes back to the controller as a numbered note. The media flip is already on this branch
(section 7), so nothing has to land before step 1.

1. **Create the preview Worker (Cloudflare, owner's word, controller runs).** Read-only first: the zone
   `almarprivatejourney.com` has no DNS record named `preview` (a custom-domain deploy fails if one exists).
   Then, in a clean clone at `c239b10` (the branch tip after the hand-over commit differs from it by `.planning/` files only) (or at `main` once this branch has landed; landing does not deploy):
   ```
   npm ci
   node scripts/assemble-cloudflare.mjs --target=preview            # builds out-preview/ and never touches out/
   node scripts/media-guard.mjs --deploy --out out-preview          # expect: OK https://media.almarprivatejourney.com, 42 documents
   grep -c "X-Robots-Tag: noindex" out-preview/_headers             # expect 1
   grep -cE '^Disallow: /$' out-preview/robots.txt                  # expect 1
   test ! -f out-preview/sitemap.xml && echo no-sitemap             # expect no-sitemap
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy -c wrangler.preview.toml
   ```
   Expected: wrangler reports Worker `almar-preview` on account `f1d9a1fa…` with
   `preview.almarprivatejourney.com (custom domain)`. Worker `almar` and its live version are untouched.
   Then the controller reads, with plain GETs:
   `curl -sI https://preview.almarprivatejourney.com/` is 200 with `x-robots-tag: noindex, nofollow`;
   `curl -s https://preview.almarprivatejourney.com/robots.txt` contains `Disallow: /` (possibly after
   Cloudflare's comment block); `curl -sI https://preview.almarprivatejourney.com/sitemap.xml` is 404;
   `curl -s https://preview.almarprivatejourney.com/ar/ | grep -c '<html lang="ar" dir="rtl"'` is 1;
   `curl -sI https://almarprivatejourney.com/` has no `x-robots-tag`, and the live version is still the one on the board.
   `wrangler.preview.toml` serves `./out-preview`, so a bare `wrangler deploy` (which reads `wrangler.toml` and `./out`)
   can never carry a preview file to the live site. Nothing has to be rebuilt afterwards.

His review: open each page at phone (390), tablet (834) and desktop (1440) width, in English and Arabic
(his answer 4); Spanish once at desktop.

2. Open `https://preview.almarprivatejourney.com/`. Expected: the ALMAR wordmark on the left; Destinations,
   Experiences, About, Contact; a currency select and a language select; no Login and no cart; the hero holds the
   planner "Plan your journey" with Where, When, Who and no Search button; the sections run in this order:
   "Where Safety Meets Bespoke Luxury", "Colombia, Beautifully Captured", "Private Stays, Fully Vetted",
   "Everything Handled. Nothing Left to Chance.", "Moments Designed for You", "Choose Your Journey",
   "ALMAR Stories", "Begin Your Journey"; the three tier prices read exactly as on the live site:
   `From USD $3,000/person · Est. AED 80,000–90,000`, `From USD $3,500/person · Est. AED 120,000–150,000`,
   `From USD $20,000/person · Est. AED 200,000–250,000+`.
3. On that page click "Where to?" and choose Cartagena. Expected: the dates panel opens by itself. Pick two dates,
   click Done, then in the Guests panel click + for one more adult. Expected: the planner reads your two dates and
   "2 adults"; the "Private Stays, Fully Vetted" section under it lists only Cartagena stays and its count line
   reads "10 stays".
4. Click "View All Private Stays". Expected: `/private-stays?destination=cartagena&from=…&to=…&guests=2` opens with
   the Cartagena chip selected, the guest stepper at 2, your dates in the address, and the count "10 stays".
5. Back on the home page, choose USD in the currency select. Expected: the three tier prices show in USD and a line
   "Converted at the exchange rate of " followed by the rates date appears. Reload: USD is still chosen. Choose العربية: the address
   becomes `/ar/`, the page reads right to left from the first paint, and the prices are still in USD.
6. Open `https://preview.almarprivatejourney.com/ar/` at phone width and tap "القائمة". Expected: the Arabic menu
   fills the screen; Escape or "إغلاق القائمة" closes it and the button is focused again.
7. Open `/private-stays`. Type `getsemani` in the search box. Expected: 2 stays (Getsemaní Colonial House and
   Getsemaní Courtyard Residence). Click "Clear filters", choose Medellín. Expected: 2 stays (Santa Fe Farm
   Antioquia and Sopetrán Country Estate). Click "Clear filters", press + on Guests until it reads 20. Expected: 2 stays
   (Private Island Cartagena and Private Island Estate Cartagena). Click "Clear filters". Expected: 12 stays and the
   count line "12 stays".
8. Repeat step 7 on `/ar/private-stays` and `/es/private-stays`. For the search, type a neighbourhood or stay name
   taken from the first card shown. Expected: the list narrows to the matching stays; Medellín gives 2 stays; 20
   guests gives 2 stays; Clear filters gives 12; Arabic runs right to left. The AR and ES wording is a draft for his review.
9. Open each of the 12 stay pages on the preview host:
   - https://preview.almarprivatejourney.com/private-stays/getsemani-colonial-house
   - https://preview.almarprivatejourney.com/private-stays/getsemani-courtyard-residence
   - https://preview.almarprivatejourney.com/private-stays/cartagena-historic-center-house
   - https://preview.almarprivatejourney.com/private-stays/baru-island-private-villa
   - https://preview.almarprivatejourney.com/private-stays/bocagrande-beach-house
   - https://preview.almarprivatejourney.com/private-stays/casa-jardin-san-diego
   - https://preview.almarprivatejourney.com/private-stays/casa-juliana-historic-center
   - https://preview.almarprivatejourney.com/private-stays/casa-mariana-historic-center
   - https://preview.almarprivatejourney.com/private-stays/private-island-cartagena
   - https://preview.almarprivatejourney.com/private-stays/private-island-estate-cartagena
   - https://preview.almarprivatejourney.com/private-stays/santa-fe-farm-antioquia
   - https://preview.almarprivatejourney.com/private-stays/sopetran-country-estate
   Expected on each: the title and photos as on the live page; clicking a photo opens it large, the arrows and
   Escape work; the booking bar shows the destination and the stay locked with a lock icon; blocked dates are struck
   through and cannot be picked, with the line "Blocked dates here are examples." under the bar; no Add buttons and
   no Continue button; "Request Inquiry" opens the contact page; no sentence about "Mariven".
10. Repeat step 9 for `/ar/private-stays/getsemani-colonial-house` and one more Arabic stay of his choice.
    Expected: Arabic, right to left, the same behaviour.
11. On any page scroll to the footer. Expected: English, العربية and Español switch the language of the same page;
    `inquiries@almarprivatejourney.com` and `+971 56 388 3302` and Instagram; no newsletter form; no "List with us".
12. His review of changed Arabic wording: on `/ar/private-stays` and on any Arabic stay page the footer now reads
    exactly as on the Arabic home: "© 2026 المار للرحلات الخاصة. كل الحقوق محفوظة.", the Instagram link is labelled
    "Instagram" followed by "(يفتح في تبويب جديد)", and the phone prints "+971 56 388 3302". Expected: he approves
    or sends the wording he wants.
13. Open `https://preview.almarprivatejourney.com/nope`, `/ar/nope` and `/es/nope`. Expected: the branded English
    404 "Page not found", then the Arabic one "الصفحة غير موجودة" right to left, then "Página no encontrada".

Nothing reaches production from this: the production cutover is a separate Ship and deploy, on his word. The
production variant is built with `node scripts/assemble-cloudflare.mjs --target=production` (section 8).

## 13. Lessons from his corrections

None were given to this session. Method notes, each learned from a measurement here: a click that hangs is read from its call log before the test is lengthened (the "load" explanation was wrong, the log
named the dock); a guard that "passes" must be shown red once (the hreflang check first passed a stripped page because the page repairs its own `<head>` after hydration; it now reads the served bytes);
a scratch copy for a script that checks `argv[1]` must be a real path.
