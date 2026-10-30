# 06-04 summary: legal pages, cookie banner, analytics, crawl files, security headers

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-30, from `date`. Lead: Opus 5.5; Tasks 3-6 by a `worker-deep` (Opus) agent. Reviews: Sonnet, twice. Fable: one pass on the whole Phase 6 PR, by the controller (owner's answer).

## Signature
`pictures/06-04/index.html`, signed 2026-10-30 12:20 +0100: 180 days; `/<locale>/legal/<slug>`; legal row under Pages and Contact; card "Cookie settings"; WhatsApp dimmed under the sheet; AR/ES drafts. Added after review: `pictures/06-04-terms-link/index.html`, signed the same day: the terms link, Spanish option A ("Acepto: {title}"), the legal row on the booking pages. Records in `decisions/`.

## What landed
| Commit | What |
|---|---|
| `03ed2493` | `lib/legal/kinds.ts`, `lib/data/legal.ts` |
| `defaf8b5` | `bookingTermsGate`, wired in `gate-server.ts` and `server.ts` |
| `576f1b2e` | robots, `_headers`, Worker headers, `assertSitemapCovers`, `expected-public-paths.mjs` |
| `78eebb44` | copy: `cookie-consent.ts`, `ops-legal.ts`, two footer keys |
| `eb446f28` | Legal editor, `/api/ops/legal`, text-blocks field |
| `a0843fa8` | public legal pages, footer row, `CookieConsent`, beacon after consent |
| `420641af` | migration: the banner's text is blocks, as signed |
| `258587cb` | the gate needs the baked version; Money row; redirect headers; anon grant |
| `59d9be4d` | the terms link and the legal row on the booking pages |
| latest `fix(06-04)` | re-review answers |

## Deviations
- No harness scenes or picture spec; `tests/legal-consent.spec.ts` covers only the nothing-published state.
- `legal-page.tsx` is in `components/pages` (data-boundary rule); `SiteLegalChrome` lives in `lib/data/types.ts`.
- Outside the plan's list: `deploy/preview/_headers` and its pin, `scripts/media-lib.mjs` (`[legal]` enumerator), `tests/helpers/site-links.mjs` and the pins in `public-documents`, `media-guard`, `locale-path`, `build/locale-routing`; `components/ui/rich-text.tsx` (optional gold-line quote); `tests/phase-03-dashboard-shell.test.mjs`; `lib/booking/gate-server.ts`; `lib/ops/money-settings.ts`; the booking and trip screens and their six pages.
- The kit Dialog has no gold top line, unlike the picture.
- **On the trip and booking pages the legal row has no Cookie settings link and no banner or beacon runs** (`getBookingPageLegal`): their addresses hold the stay, dates and link token. The signed row drew the link; this is the one difference, from the re-review.
- `seo_title` is capped at 70, so a longer AI Spanish title leaves a gap the owner fills by hand.

## Checks
`npx tsc --noEmit` and `npm run tokens:check` pass. Node tests, pgTAP, build, Playwright: **not run (owner: no test)**.
