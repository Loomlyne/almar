# Hand-over: job 11, home and stay page matched to Framer, Search and Request on WhatsApp

Written 2026-10-04 by the job 11 work session (plans 03.3-40 to 03.3-47). Contract: `.planning/prompts/00-common-rules.md`, section "Hand-over".
Design: `.planning/phases/03.3-public-site-in-react/job11-design/11-DESIGN.md`. Nothing is pushed, deployed or written to R2, Cloudflare or Supabase.

## 1. Branch, commit, folder, base

- Branch `gsd/phase-3.3-s1-framer-match`, worktree `/Users/koss/Developer/almarprod-Website-Code/.claude/worktrees/phase-3.3-s1-framer-match`.
- **Last code commit: `b8cddbd`** (a spec-only commit: sweep row 11 selector). Every check below ran on the code of `b8cddbd`, except where a row says it ran on `835d7b4`; the only file that differs between the two is `tests/build/slice1-sweep.spec.ts` (row 11). The hand-over and summary commit that follows `b8cddbd` touches `.planning/` only.
- `git status` was clean before the hand-over files were written. The lead pushes.
- Base merges (plan 47 task 1):
  - `origin/gsd/phase-3.3-slice-1` (`6264c59`): already an ancestor of the branch. Nothing to merge, no conflict.
  - `origin/main` (`991a982`): had moved 7 docs-only commits past the branch (board, state, `decisions/2026-10-04-slices-reconcile.md`, `prompts/11-slice-1-framer-match.md`). Merged as `4418016`, no conflict, 4 files, 134 insertions. Code identical to before the merge.
- 111 files changed against `origin/gsd/phase-3.3-slice-1` (8855 insertions, 966 deletions), listed by `git diff --stat origin/gsd/phase-3.3-slice-1 HEAD`.

## 2. Checks on the final commit

All with `--workers=1`. Ports: 3083 (dev Playwright), 3084 (build Playwright), 3082 (my spec iteration, freed). 3081 and every foreign port untouched. A stray `workerd` of mine on 3082 (left by a killed run) was stopped by port.

| # | Command | Result | Time |
|---|---|---|---|
| 1 | `npm ci` | ok (install-script notice only) | 30 s |
| 2 | `npx tsc --noEmit` | clean, rerun after `b8cddbd`: clean | 3 s |
| 3 | `node --test tests/*.test.mjs` | 621 tests, 617 pass, 0 fail, 4 skipped (the media-staging cache is absent in a clean clone, as before); rerun after `b8cddbd`: same | 4 s |
| 4 | `npm run tokens:check` | "theme up to date" | 2 s |
| 5 | `npm run build` | ok | 24 s |
| 6 | `npx playwright test --workers=1` (dev config, `PW_PORT=3083`) | **1859 passed, 28 skipped, 0 failed**, of 1887 | 25.8 min |
| 7 | `node scripts/assemble-cloudflare.mjs` | 57 html files (12 Framer, React en 14 / ar 14 / es 14, 3 404s) | 10 s |
| 8 | `node --test tests/build/*.test.mjs tests/build/*/*.test.mjs` | 243 tests, 243 pass, 0 fail | 1 s |
| 9a | `npx playwright test -c playwright.build.config.ts --workers=1`, run 1 on `835d7b4` (`PW_PORT=3084`) | 1681 passed, **3 failed**, of 1684: `row 11 segment states` (en, ar, es home at 1440). Real, mine: with Search wired the hero bar is a `role="search"` form (plan 43), no longer a group, so the sweep's row 11 selector found nothing. Selector fixed in `b8cddbd`, assertions unchanged. No connection-refused, no contention. | 49.5 min |
| 9b | `npx playwright test -c playwright.build.config.ts -g "row 11" --workers=1` after the fix | 3 passed | 6 s |
| 9c | `npx playwright test -c playwright.build.config.ts --workers=1`, run 2 on `b8cddbd` (full, after the fix) | **1684 passed, 0 failed**, of 1684. No connection-refused, no contention. | 29.6 min |
| 10 | `node scripts/media-manifest.mjs --check` | OK, 118 entries, 118 measured | 1 s |
| 11 | Manifest key diff against `origin/gsd/phase-3.3-slice-1` | exactly **+3**: `destinations/cartagena/inset.webp`, `destinations/medellin/inset.webp`, `home/begin/poster.webp`; **-2**: `home/gallery/14.webp`, `home/gallery/15.webp` (left on R2, untouched). 117 to 118 entries. | |
| 12 | `git diff --exit-code origin/main -- wrangler.toml` | exit 0, no difference | |
| 13 | `grep -rnE "lib/data/(fixtures\|resolve\|media)" app components` | no output (no component reads a fixture) | |

Notes on the runs:
- The dev run (6) cannot be affected by `b8cddbd` (the dev config ignores `tests/build/**`), so it was not repeated.
- Plan 47 spec results before the full runs: `tests/build/job11-motion.spec.ts` 45 tests: 42 passed, 3 failed on the first run (the safety-reveal poll used Playwright's default 100/250/500/1000 ms back-off, so its last sample before the 3.5 s limit fell at 2.85 s; the page was right, the test sampled too rarely). Fixed with `intervals: [100]`; rerun of the three: 3 passed. Both runs are in the plan 47 summary.
- Red-once proofs (scratch breaks of `out/` or of the controller chunk, restored from copies, never committed, `out/` rebuilt afterwards): safety timer removed from the boot script -> 3/3 safety tests red; hidden state without the `data-motion=on` guard -> 27/27 JavaScript-off and reduced-motion tests red; observer that re-hides on leaving the view -> "reveal once" red at "stays revealed while off screen"; home submit turned into `type=button` -> sweep home row red ("exactly one submit"); Made by link and request href changed on one stay -> sweep red.

## 3. Not verified / by design

Not verified:
- **The three new images are not on R2 yet** (`destinations/cartagena/inset.webp`, `destinations/medellin/inset.webp`, `home/begin/poster.webp`). A GET on `media.almarprivatejourney.com` for each answered 404 on 2026-10-04 (plan 44). On the live host the two Moments insets and the Begin still would show empty until the owner's upload (step list in section 8).
- **No video plays until the owner's upload.** `hero.video_key` and `begin.video_key` are null by design; the pages show the poster still. The video player path (muted, looping, inline, poster first, still under reduced motion) is proven only by node tests and the Slider/BackgroundMedia probes, never with a real file.
- No browser run loaded a picture from `media.almarprivatejourney.com` itself: every Playwright run serves the manifest's files through `routeMedia`.
- Safari/iOS and real phones. Everything ran in headless Chromium at 390, 834 and 1440.
- The hero video file on catbox.moe could not be measured (a HEAD and a ranged GET both returned nothing from this Mac on 2026-10-04).
- Pixel-level match with live Framer: sections were compared by screenshots in plans 43 to 45 (folders `compare43`, `compare44`, `compare45` in the session scratchpad), not by a pixel diff. The Dates filter at real widths was checked by DOM assertions only.

By design (lead, 2026-10-04):
- **There is no Search without JavaScript.** With JavaScript off the hero keeps slice 1's behaviour: the bar's panels need JavaScript, and a no-JS Search would land on a list that cannot filter.
- Policies are headings only, nothing opens (owner, 2026-10-04). The 96 AR/ES policy-body drafts written in plan 40 were removed with the bodies in plan 45; no policy text exists in the data.
- The home Private Stays cards are three fixed stays and are never filtered by the bar; Search does that on `/private-stays`.
- Gold is a line only (founder line, nights, durations render grey); sizes keep the signed scale (Framer's 88 and 56 become 64 and 48).
- Every new AR/ES string awaits the owner's review: the footer `brand` and `madeBy`, the home strip labels `gallery.goTo` and `gallery.slide`, the stay page request wording (`button`, `greeting`, `dates`, `datesNone`, `guests`), and the slideshow labels. All are marked in `lib/copy/site-footer.ts`, `lib/copy/home-page.ts`, `lib/copy/stay-detail.ts`.

## 4. Shared files touched (for the controller's grant)

| File | Why |
|---|---|
| `tokens.json` | motion tokens (`ease.reveal`, eight transition durations), `spacing.section` (plan 41) |
| `app/globals.css` | regenerated from tokens, plus one `@custom-variant pre-reveal` line; 197 lines (plan 41) |
| `lib/copy/site-footer.ts` | `brand` and `madeBy` keys, AR/ES drafts (plan 41) |
| `lib/copy/home-page.ts` | Search/hero keys, strip labels `gallery.previous/next/slide/goTo`, AR/ES drafts (plans 43, 44) |
| `lib/copy/stay-detail.ts` | request message and button, slideshow labels, About and Policies copy, AR/ES drafts (plan 45) |
| `lib/cn.ts` | one word, `section`, in the spacing mirror, because `tests/cn.test.mjs` pins it to `tokens.json` (plan 41, Rule 3) |

`package.json` and `package-lock.json` are not touched. `wrangler.toml` and `next.config.ts` are not touched. Not a shared file but worth a look: `app/embed/hero-booker/route.ts` gained one line in its SOURCES stamp list (dev cache invalidation; `tests/embed-sources.test.mjs` demands it once `icons.tsx` imports the `AmenityIcon` type). `tests/controls.test.mjs` had one regex relaxed (`border-gold` allowed in `button.tsx`, gold stays a line, plan 42).

## 5. Proposed board and state changes (proposals only; I edited none of them)

- CONTROL-BOARD: job 11 done on branch `gsd/phase-3.3-s1-framer-match` at `b8cddbd` (add the clock time of the controller's read), handed over, waiting for the controller's clean-clone check.
- STATE.md: slice 1 waits for the owner's UAT (steps in section 7); the media ship step (section 8) is pending and is the owner's R2 gate.
- Decisions to record: (a) policies headings only; (b) the WhatsApp float hides on stay pages (11-DESIGN section 1), which needs REQUIREMENTS SITE-03 amended or the design changed (section 6, item 1); (c) the Begin and hero videos are copied to our media host, keys `home/begin/begin.mp4` and `home/hero/hero.mp4`.
- The prompt `.planning/prompts/11-slice-1-framer-match.md` did not exist on this branch while the job ran (the plans said so); it arrived with the `origin/main` merge `4418016`. Nothing to do; noted so the flag is closed.

## 6. Open questions and flags (one per line)

1. For the controller, SITE-03 (REQUIREMENTS) says the WhatsApp float is on every public page; the signed design (11-DESIGN section 1, "one WhatsApp button") hides it on stay pages, where the Request on WhatsApp link takes its place. Amend SITE-03 or reopen the design.
2. The hero and the stay h1 render **40 px at 390** (the phone override in `app/globals.css` makes `text-hero` 40 and `text-display` 32); Framer shows 48. At 834 and 1440 they are 64 (Framer 88, owner answer 2). Computed size recorded in plan 43.
3. The Welcome letter is 576 px wide at 1440 (`max-w-xl`); Framer's is 460. At 390 Framer pads more around the letter (its section is 113 px taller). Owner's call.
4. Framer's "All Services" and "All experiences" outline buttons at the head of the Services and Experiences sections on the stay page are not drawn (the plan lists a button only for More Private Stays; the targets would be `/services` and `/experiences`, still Framer pages). Framer's small icon above each Service title is not drawn (no data).
5. The Moments insets (2) and the Begin poster (1) return 404 on `media.almarprivatejourney.com` until the owner's upload (section 8, step 1).
6. The first paragraph of the stay About text is plain text; Framer bolds the stay's name there. Needs a data change.
7. The stay slideshow peek slide is 1312 x 738 at 1440 (64 px sides); Framer's is 1280 x 718 with 80 px sides, which needs `px-20`, outside the token allow-list in `tests/design-tokens.test.mjs` (controller-gated).
8. Framer has no `/ar` or `/es` stay page (it answers 404), so the Arabic and Spanish stay pages have no Framer reference; they mirror the English page.
9. The live Framer policy text was one placeholder on all 12 stays ("Property amenities and staffing recorded: PRIVADA. Included: 1 CAMARERA..."), a CMS default naming "1 CAMARERA" on stays with other staff. Owner chose headings only; real text is for the dashboard.
10. Strip and slideshow: at the last slide the strip shows empty space to the right of the photo (swipe works from there); dots sit on the photo's bottom edge on a dark strip (plan 45).
11. The amenity icon groups, 13 (`lib/data/amenity-icon.ts`, first matching rule wins, `check` when none): `pool`, `wifi`, `water`, `tv`, `air`, `kitchen`, `grill`, `security`, `parking`, `outdoor`, `lounge`, `service`, `check`.
12. After blocking the Next chunks the safety reveal turns `data-motion` off at 3.0 s and the blocks then fade in over their own durations (up to about 1.6 s), so everything is visible about 4 s after load, not 3 s. If "within 3 s" must be literal, the boot script should also clear the hidden state without a transition.
13. The sweep's painted-image rule now skips pictures with no box (the Welcome photos below md) and lazy pictures the browser has not asked for (off to the side of a strip or slideshow track). Every other picture must still have painted.
14. The Begin video file on pexels.com is 13,836,319 bytes (about 13.2 MiB, 2732 x 1440 UHD) by a plain HEAD request on 2026-10-04. A 1920-wide copy is recommended for the web (about half the pixels, a much smaller file). The hero file's size is unknown (section 3).

## 7. The owner's test steps

Do each in English, then Arabic (`/ar/...`), then Spanish (`/es/...`). Words in quotes are the page's own. Use a desktop browser at full width unless a step says phone. `https://almarprivatejourney.com` is the live Framer site; these steps need the controller's preview, so the controller names the address.

Home Search (home page `/`, `/ar/`, `/es/`)
1. Open the home page. Under the headline see the bar Where, When, Who and a Search button (EN "Search", AR "بحث", ES "Buscar"). Expected: no "Design your journey" button.
2. Click Search with nothing chosen. Expected: nothing leaves the page; a one-line message under the bar: EN "Choose a destination and dates to search.", AR "اختر وجهة وتواريخ للبحث.", ES "Elige un destino y fechas para buscar." and the missing segment is marked red.
3. Pick only a destination (Where), click Search. Expected: the message "Choose arrival and departure to search." (AR "اختر تاريخ الوصول والمغادرة للبحث.", ES "Elige llegada y salida para buscar.").
4. Reload the page, pick a pair of dates only (no destination), click Search. Expected: "Choose a destination to search." (AR "اختر وجهة للبحث.", ES "Elige un destino para buscar.").
5. Pick a destination, an arrival and a departure date, set Who to 2 adults, click Search. Expected: you land on `/private-stays` (`/ar/private-stays`, `/es/private-stays`) with the address carrying `destination`, `from`, `to` and `guests`.
6. On that page expected: the Destination filter shows your destination, Guests shows 2, a Dates filter shows your range as DD/MM/YYYY - DD/MM/YYYY and the number of nights, and the list shows only that destination's stays that are free on those nights and sleep 2 or more; the count line matches. The note "Blocked dates here are examples." is under Dates.
7. Click the x on the Dates filter. Expected: the dates clear, the list widens, the destination and guests stay. Set dates again from the Dates filter (pick arrival, then departure). Expected: the list changes only when both days are picked; Done, Escape or a click outside closes the calendar and focus returns to the Dates button.
8. Click "Clear filters" (AR "مسح المرشّحات", ES "Borrar filtros"). Expected: destination, guests, bedrooms and dates all reset; all 12 stays show.
9. On a phone (or a window under 768 px wide): tap the one entry bar, the three-step sheet opens; Next on step 1 with no destination shows "Choose a destination."; the last step ends in Search, which lands on `/private-stays` as in step 5.
10. Scroll the home page past the hero. Expected: a slim docked bar appears at the top with its own Search; with a destination and dates chosen it lands on the list the same way.

Stay page Request on WhatsApp (open any stay, for example Casa Jardín San Diego under `/private-stays/casa-jardin-san-diego`)
11. With no dates chosen, click "Request on WhatsApp" (AR "اطلب عبر واتساب", ES "Solicitar por WhatsApp"). Expected: a new tab opens at `wa.me/971563883302` with this text: EN "Hello ALMAR, I would like to request Casa Jardín San Diego (Cartagena). / Dates: not chosen yet / Guests: 1 adult / the page's address"; AR the same in Arabic ("مرحباً المار، ... التواريخ: لم تُحدَّد بعد ... الضيوف: ..."); ES "Hola ALMAR, me gustaría solicitar ... Fechas: aún sin elegir ... Huéspedes: ...". The stay page stays open.
12. Choose dates (for example 3 nights) and 2 adults and 1 child in the bar, click the button again. Expected: the message now reads "Dates: DD/MM/YYYY to DD/MM/YYYY (3 nights)" and "Guests: 2 adults, 1 child" (AR "من ... إلى ... (3 ليالٍ)" and "بالغان، طفل واحد"; ES "del ... al ... (3 noches)" and "2 adultos, 1 niño"), in the page's language, ending with that page's own address.
13. On a phone, scroll the stay page: the pinned bottom dock holds the same Request on WhatsApp button. Open the sheet, choose dates on step 2 and guests on step 3: the last step offers the request link (no Done button); it opens WhatsApp with the same text. Expected: no green WhatsApp float anywhere on a stay page.
14. The photo slideshow near the top of the stay page moves one photo every 2 seconds. Hover it: it stops. Press the "Pause slideshow" button: it stops for good; "Play slideshow" restarts it. Use the arrows, dots, a swipe (phone) and the Left/Right arrow keys: each moves one photo; in Arabic the previous arrow sits on the right and Left Arrow means forward.
15. Scroll to Policies: four headings in a plain list. Click one: nothing opens (by design).
16. On the home page, scroll through Welcome (the letter stays centred while five photos slide down into place around it, desktop only), then the gallery strip (arrows, dots, swipe), then the cards: hover a Private Stays card photo (grows slightly), a story card photo (grows less).

Footer and Arabic
17. On the home page, the list and a stay page: the same light footer (ivory, "ALMAR Private Journeys" wordmark, Pages, Contact, language links, copyright, "Made by Koussay"). Expected: no newsletter, no Facebook, YouTube, TikTok, no legal links. Click "Koussay": `https://koussay.com` opens in a new tab.
18. Open `/ar/`. Expected: the page mirrors (menu, bar, cards, strip arrows swapped, Welcome photos on the other side); the footer phone reads `+971 56 388 3302` left to right, not backwards.

Reduced motion
19. macOS System Settings > Accessibility > Display > turn on "Reduce motion", reload the home page and a stay page. Expected: everything is visible at once, no block slides or fades in, the Welcome photos and the hero do not move with the scroll, the slideshow does not move by itself and shows no Pause button, card photos do not grow on hover. Turn it off again: scroll the home page and see blocks reveal once as they enter, never hide again.

## 8. Ship step for the five media files (owner's R2 gate, one numbered step at a time)

1. The owner says yes to the image upload. The controller then runs, from the control checkout (the script reads the files from `media-staging/`, so the three new images must be there):
   `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c node scripts/media-upload.mjs --public-base https://media.almarprivatejourney.com --apply`
   Expected: the 3 new keys uploaded, the other 115 skipped as identical (a key holding other bytes is refused, never overwritten). Then:
   `node scripts/media-upload.mjs --verify --public-base https://media.almarprivatejourney.com --all`
   Expected: 200 and `image/webp` for the three new keys (flags checked against the script header; `--sample N` is the other form).
2. The owner downloads the two videos and uploads each from his own terminal:
   - hero: `https://files.catbox.moe/v0nj1o.mp4` (Framer poster `caedcb84dd0d35bb.webp`; size not measured)
   - Begin: `https://videos.pexels.com/video-files/4932586/4932586-uhd_2732_1440_30fps.mp4` (measured 13,836,319 bytes, about 13.2 MiB, UHD 2732 x 1440; **recommend re-encoding a 1920-wide copy** for the web before the upload; Framer poster `3484e51613dcadfa.webp`, now `home/begin/poster.webp`)
   Upload each with:
   `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler r2 object put almar-media/home/hero/hero.mp4 --file <file> --content-type video/mp4 --cache-control "public, max-age=31536000, immutable" --remote`
   and the same for `almar-media/home/begin/begin.mp4`.
3. The controller sets `hero.video_key` to `"home/hero/hero.mp4"` and `begin.video_key` to `"home/begin/begin.mp4"` in `lib/data/fixtures/home.json`, rebuilds, checks a plain GET of both URLs answers 200 `video/mp4`, and checks that the home plays them muted with motion on and shows the posters with reduced motion.

## 9. Lessons from the owner's and the lead's corrections in this job

- Owner, 2026-10-04: policies as headings only. A signed design can meet a data fact (one placeholder body on all 12 stays) after the plan is written: stop and ask once the fact is found, do not build around it.
- Owner: one light footer on all three pages; keep the signed size scale. Answers given in the question form are binding for every plan after them.
- A spec that polls a time-boxed condition must pass its own sampling interval: Playwright's default back-off skipped the 3 s window.
- A minified bundle can hold the same component in two chunks (home and the other pages). A scratch break of built output must patch every chunk the page loads, or the red proof proves nothing; confirm the break turns the test red before trusting a green.
- A scratch break must be restored from a copy: `git checkout -- <file>` is refused here, so copy before breaking.
- A test selector keyed on an ARIA role (`group`) breaks when a component becomes a `search` form; the sweep missed it until the full build run, so run the whole build suite once per plan that changes a role.
