# Job 21: /en, /ar, /es on every page, the chosen-language cookie, and the header Login link

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`, and `.planning/decisions/2026-10-21-owner-answers-after-landing.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

**No tests (owner, 2026-10-21: "I told you, no test. Direct, no test.").** Run no test suite, Playwright, pgTAP, stack, dev server or build. Write the test files the work needs, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed. Hand over with every other check marked "not run (owner: no test)".
No push to `main`, no deploy, no hosted database. Never print a secret. Hand-over: commit name plus `HANDOVER.md` in the job folder named below; message the controller; stop.

Branch `gsd/locale-prefix-urls` from `origin/main`. Job folder: `.planning/quick/261021-locale-prefix-urls/`.

1. **Prefixes (owner #13: "add /ar, /en, /es").** Every public page and the guest pages (`/login`, `/account`, `/bookings` and below) live under `/en/…`, `/ar/…`, `/es/…`, served with the right `lang`/`dir` in the first bytes (today Arabic `/login`, `/account`, `/bookings` arrive as English until hydration). `/api/*`, `/auth/*` callback paths and the dashboard host stay unprefixed. Every old unprefixed page URL answers **301 to `/en/…`** (keep query strings). Update the sitemap, hreflang, canonical, the language select, footer links, `lib/server-routes.ts` / `run_worker_first` in `wrangler.toml` and `wrangler.preview.toml`, the magic-link return paths, and `tests/no-dead-links`. Static pages stay static files (the Worker runs only for its `run_worker_first` paths): plan the 301s so they cost no CPU where possible (assets `_redirects` or a small Worker rule; say which and why).
2. **Cookie (owner #7: "based on the language the user chooses").** Choosing a language in the select stores it in a cookie. `/` sends a visitor with that cookie to `/<lang>/`; with no cookie, `/` goes to `/en/`. No browser-language guessing.
3. **Header Login link (owner #5: "build it").** Order per `CLAUDE.local.md`: wordmark, Destinations, Experiences, About, Contact, (cart later), currency, language, **Login**; EN/AR/ES copy, kit components only, phone and desktop. It links to `/<lang>/login` (or Account when signed in, if the existing account sync makes that cheap; say which).
4. **Phase 4 is running at the same time** (job 16 on `phase-04-book-and-request`, plans 04-05/04-06 add pages under `/bookings`). Do not touch `app/api/booking/*`. Write in the hand-over the exact new paths the Phase 4 pages must use.
