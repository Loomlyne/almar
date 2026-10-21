# Job 17: close Phase 3.3 — hand-over

- Branch `gsd/phase-3.3-close-bridge` (PR #25's branch). Merged `origin/main` `dc7edae1` (no conflicts) as `f048ead5`,
  then this job's commit (named in the controller message). Worktree `.claude/worktrees/admiring-perlman-0ac47c`, folder clean after commit.
- No migration, no environment name, no secret, no Cloudflare/DNS/R2/Supabase change, no push to `main`, no deploy.
- No heavy run (dev server, Playwright, build, wrangler, stack): none was needed for this job's edits (comments plus one
  test-gate tightening, both covered by `node --test` and `tsc`).

## Result

`03.3-VERIFICATION.md` (gsd-verifier, read-only, plus my live probes): criteria 2, 3, 4, 5 PASS; 1 PASS on code with a
wording gap; 4b PASS except the cookie redirect, which the signed design chose not to build; 6 open until the last two
landings are previewed and deployed. Nothing is missing in the code.

## Checks (on `f048ead5` + this job's edits)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run tokens:check` | exit 0 |
| `node --test tests/*.test.mjs` | 2,048 tests, 2,002 pass, 0 fail, 46 skipped |
| `node --test tests/data-boundary.test.mjs` after removing its Framer skip | 5/5 pass |
| Live GETs (see VERIFICATION "Job 17 lead's checks") | all as expected |

## Gaps closed here

- G4 (comments only): `components/site/page-links.ts:3`, `components/pages/home-page.tsx:76-77`, `middleware.ts:11` no
  longer call the public pages "Framer" / "English-only". `tests/data-boundary.test.mjs`: the dead skip for a Framer
  `route.ts` with `const HTML = "` is removed, so the gate now scans every file under `app/` and `components/`.

## Gaps left for the controller

1. **G1 (doc):** ROADMAP 3.3 SC 1 → "22 public pages (66 documents) on the same URLs; `/services` and its 3 detail URLs 301
   to `/experiences` (D-64, D-67)".
2. **G2 (one owner question):** SC 4b says the `almar-locale` cookie redirects; signed design 03.3-01 §5.3 chose no
   redirect (static assets, no `Vary: Cookie`). Recommended: keep "remembered preference, no redirect" and edit 4b. A
   redirect would need pictures and his signature first.
3. **G3 (ops):** after PR #25 lands: `RESEND_API_KEY` on `almar` (else the contact form and newsletter answer 503 live,
   i.e. fake controls), deploy `almar-preview`, controller browser check, production on his word, then the UAT below.
   Record the controller-reviewed previews of slices 2, 3A, 4 as an accepted deviation if he agrees.
4. **G5 (doc):** `REQUIREMENTS.md:259-264` maps SITE-01…13 and I18N-04 to Phase 6; ROADMAP lists them for 3.3.
5. `HERMES.md` still describes the Framer bridge (lines in `03.3-CLOSE-HANDOVER.md` "Proposed changes" 2): `/gsd-map-codebase` refresh or a controller edit.
6. Re-run `tests/build/ops-runtime.spec.ts` once PR #24 is on this branch (tests 4 and 5 stop at `/login` before that).

## Proposed lines (apply only once PR #25 has landed)

- ROADMAP: `- [x] **Phase 3.3: Public site in React** … (closed <date>, PR #25 `<squash>`)`; SC 5 marked done; SC 1 and 4b
  reworded as in G1/G2; SC 6 done once the production deploy and UAT pass.
- STATE.md: "Phase 3.3 complete: verification `03.3-VERIFICATION.md`, bridge removed (PR #25), owner UAT <result>".
- CONTROL-BOARD.md:199: drop "Phase 3.3 close not done"; row "Phase 3.3 close" → done.

## Owner UAT (on https://almarprivatejourney.com after the controller deploys `almar` with PR #25; phone and laptop)

1. Open `/` → home in English: hero photo or video, the plan bar (Where · When · Who) over it, no Framer badge.
2. On the bar click **Where to?**, pick a destination → it shows in the bar. Click **Dates**, pick arrival and departure → the line under the calendar says the nights. Click **Guests**, press + twice → the count goes up and stops at the limit.
3. Press **Search** → `/private-stays` opens, filtered to that destination and those dates.
4. Clear the destination and press **Search** → a red line asks for a destination; nothing opens.
5. On a phone (or a window under 768 px) tap the hero bar → a sheet opens with 3 steps, Where → When → Who; finishing step 3 and pressing Search opens the same filtered list.
6. In the header language menu pick Arabic → the address becomes `/ar/`, the whole page is right-to-left from the first paint, the bar and menus are mirrored. Pick Spanish → `/es/`, Spanish text. Pick English → back to `/`.
7. Open `/ar/about` directly in a private window → Arabic, right-to-left, before any script runs (turn JavaScript off to check: the text is still there).
8. In the header pick another currency → every "From USD …" amount on the home journeys changes; reload → the choice is kept.
9. Open `/private-stays` → 12 stays. Use the filters (destination, dates, guests) → the list narrows and the count updates; clear → all 12 again.
10. Open any stay (e.g. `/private-stays/casa-jardin-san-diego`) → photos, details, the plan bar locked to that stay; dates it cannot take show as unavailable in the calendar.
11. Open `/experiences` → the experiences list; the type filter narrows it; click a card → the detail overlay opens; Esc closes it. Open `/services` → it lands on `/experiences?type=service` (services filter on).
12. Open `/destinations`, `/about`, `/blog` and one post (e.g. `/blog/why-medellin-is-redefining-luxury-travel`) → each page loads in all three languages (`/ar/…`, `/es/…`).
13. Open `/contact` → `inquiries@almarprivatejourney.com` and `+971 56 388 3302`; tapping each opens mail / the phone dialer. Only once `RESEND_API_KEY` is on `almar` (G3): send the contact form with your own address → a thank-you line, and the message arrives at inquiries@.
14. Open `/robots.txt` → `Allow: /` and the sitemap line. Open `/sitemap.xml` → 22 English addresses plus the `/ar/` and `/es/` ones.
15. Open `/fx`, `/es/fx`, `/embed/hero-booker`, `/embed/font/Lato-Regular.ttf` → the ALMAR "Page not found" page (Spanish for `/es/fx`), no download.
16. Open https://preview.almarprivatejourney.com/ → same site; it is not indexed (header `noindex`).

## Not verified

- **Not verified, needs the landing lane** (owner 2026-10-21: no test runs in work sessions): every Playwright spec and the build. No Playwright run and no build in this job; spec pass results come from `03.3-CLOSE-HANDOVER.md` run 2 (`d1805e4b`) and
  earlier slice hand-overs. The controller's landing lane runs the full set.
- Live Worker versions, the contact form and newsletter (POST), the visual Framer match, and AR/ES wording (delegated
  review `I18N-REVIEW-2026-10-05.md`).
- UAT steps 2-11 describe today's code; they were not clicked through by me.
