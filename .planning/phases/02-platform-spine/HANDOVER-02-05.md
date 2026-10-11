# Hand-over: 02-05 language and currency follow a signed-in account

- Branch `gsd/phase-02-p05`, cut from `origin/main` 3a458c6, with `origin/main` ce796e6 merged in (docs only, no conflicts). The tip commit is the one that adds this file. The folder is clean apart from this commit.
- Scope: owner answer A (2026-10-11), items 1-4 of `02-05-ADDENDUM.md`. What was built: `02-05-SUMMARY.md`.
- Commits:
  - `dbb2283` addendum
  - `7fe6b81` feature
  - `bf25c85` node and stack tests
  - `79665c1` Playwright spec
  - `d9c71bc` merge of origin/main
  - `c23964e` review fixes
  - then summary and this hand-over
- Migrations: none. Packages: none. New environment names: none. Shared files (`lib/copy/*`, `tokens.json`, `globals.css`, `next.config.ts`, `package*.json`, `wrangler.toml`): not touched. Booking and Stripe code: not touched.

## Checks (on c23964e, 2026-10-11)

| Check | Result |
|---|---|
| `npm ci` | pass |
| `npx tsc --noEmit` | pass |
| `npm run tokens:check` | pass ("theme up to date") |
| `node --test tests/*.test.mjs`, own local stack up, `ALMAR_REQUIRE_STACK=1` | 1,441 tests: 1,428 pass, 0 fail, 13 skipped |
| `npm run build` | pass; `/api/preferences` is a dynamic route |
| `npx playwright test --workers=4` | 2,775 tests: 2,687 pass, 0 fail, 88 skipped (17.1 min); no file needed a `--workers=1` rerun |
| `tests/header-i18n.spec.ts` alone, `--workers=1` | 6/6 pass |
| Reviewer (Sonnet, auth/DB diff) | ship, nothing blocking; 4 low findings, 2 fixed in `c23964e` |

The 13 node skips were all there before this job: deleted Framer routes, `MEDIA_CHECK_OUT` not set, no `media-staging/`. None needs the stack.

## Not verified

- A real magic-link sign-in end to end in a browser (email, then the confirm page, then the localised redirect). It is covered only by node tests with real local-stack sessions (`verifyOtp`) and by the confirm action's source guard.
- The built Worker (`wrangler dev` / OpenNext) answering `/api/preferences`, including the origin check behind Cloudflare. Only `next dev` and the node handler were tested. `/api/*` is already in `run_worker_first`, and the route is a `force-dynamic` app route, so `serverPathsFrom` picks it up.
- Live hosts (apex, www, preview), and real Arabic and Spanish sign-in emails.

## Open (reviewer findings left as they are)

1. The footer language links (the crawlable no-JS row) do not post the pick to the account; only the header `LocaleSelect` does. A signed-in guest who switches language through the footer keeps her old saved language. If this should be fixed, it is a small follow-up (a click handler on the footer links).
2. No browser test covers the `push` path, where a new account's browser currency is sent to its profile and `/account` then shows it. It is covered only by unit tests and by the local-stack `followAccount` test.
3. Item 4: the signed-in ops shell has no language control. Adding one is a design change for the owner (see the addendum).

## Deviation from the prompt

- `/gsd-execute-phase 2 --wave 7` was not run as written. The plan's tasks were stale against main, so the owner rescoped the work (answer A). The work was done inline from the committed addendum.

## Proposed board changes (controller to apply)

- ROADMAP / STATE / CONTROL-BOARD: 02-05 rescoped (owner A, 2026-10-11) and done, with the summary at `02-05-SUMMARY.md`. 02-09 and 02-10 stay superseded.
- Optional new card: "footer language links follow the account" (open item 1).

## Owner test steps (after landing, on the preview or live host)

1. Sign in on `/login` with an account whose saved language on `/account` is العربية. Expected: you land back on the Arabic page (`/ar/…`), laid out right to left.
2. On `/account`, set the currency to USD and save, then open `/`. Expected: the home currency control shows USD.
3. While signed in, open `/` and pick Español in the header language menu. Expected: the page goes to `/es/`. Reopen `/account`. Expected: the language shows Español.
4. Signed out, open `/ar/`, then sign up with a new email and confirm it from the email. Expected: you stay in Arabic, and `/account` shows العربية.
5. Signed out, pick a language in the header. Expected: the page changes language as before and nothing else happens (no error, no sign-in prompt).
