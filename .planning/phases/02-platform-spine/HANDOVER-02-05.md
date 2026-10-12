# Hand-over: 02-05 language and currency follow a signed-in account

- Branch `gsd/phase-02-p05`, cut from `origin/main` 3a458c6. `origin/main` was merged three times: ce796e6, then the 03.2 landings (`38a609f`), then df7abd6 (`441851c`, a board line only, no conflicts). The tip commit is the one that updates this file. The folder is clean apart from that commit.
- Scope: owner answer A (2026-10-11), items 1-4 of `02-05-ADDENDUM.md`. What was built: `02-05-SUMMARY.md`.
- Commits:
  - `dbb2283` addendum
  - `7fe6b81` feature
  - `bf25c85` node and stack tests
  - `79665c1` Playwright spec
  - `d9c71bc` merge of origin/main
  - `c23964e` review fixes
  - `a0c31d8` summary and hand-over
  - `38a609f` merge of origin/main
  - `1fca336` send-back causes 1 and 2: the `almar-signed-in` hint and the server paths list
  - `441851c` merge of origin/main df7abd6
  - then the cause 3 test fix, the summary and this hand-over
- Migrations: none. Packages: none. New environment names: none. Shared files (`lib/copy/*`, `tokens.json`, `globals.css`, `next.config.ts`, `package*.json`, `wrangler.toml`): not touched. Booking and Stripe code: not touched.

## Send-back of 2026-10-12: the three causes

1. **`server-runtime.spec.ts` lacked `/api/preferences`.** Fixed in `1fca336`. The spec passes on a `--target=local` assemble, and the assemble lists `/api/preferences` among the server paths.
2. **A signed-out language pick logged a 403.** Fixed in `1fca336`. Session cookies are HttpOnly, so the browser cannot tell whether she is signed in. The confirm action now sets a readable hint cookie `almar-signed-in=1` on a non-ops sign-in. It is not a secret (value `1` only), not HttpOnly, lax, Secure in production, and lasts 400 days. Both sign-outs (`/auth/sign-out` and "sign out everywhere") clear it with max-age 0. `postPreferences` sends nothing without the hint. The Origin/CSRF check and the session check in `lib/preferences-route.ts` are unchanged; a stale or forged hint only gets a 204. Tests:
   - Node source guards: set only under `!ops` with value `1`, cleared on both sign-outs, early return in `postPreferences`.
   - `header-i18n.spec.ts`: a signed-out pick sends no `/api/preferences` request; the sign-out POST answers 303 with `almar-signed-in=; Max-Age=0; SameSite=lax`, not HttpOnly.
3. **about.spec.ts:254 and contact.spec.ts:284: `htmlAttr` null.** **Not caused by 02-05.**
   - On plain `origin/main` df7abd6 (scratch worktree, `--target=local` assemble, PW_PORT 3074, `--workers=2`), 4 of 18 failed with the same `Cannot read properties of null (reading 'getAttribute')` at `slice3-pages.ts:257`.
   - Cause: a race in the test. `checkLanguage` read `document.documentElement` as soon as the navigation response arrived, before the new document committed.
   - Fix (test only): that read is now `expect(page.locator("html")).toHaveAttribute("lang", target)`, which retries. Only about and contact call `checkLanguage`.

## Checks (on 441851c plus the cause 3 fix, 2026-10-12 13:40-13:54 +04)

Machine budget from the controller: only the specs this job touched plus `server-runtime` and the `slice3-pages` users, `--workers=2`. The full build and app suites are left to the controller's clean clone.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run tokens:check` | pass ("theme up to date") |
| `node --test tests/*.test.mjs`, own local stack up, `ALMAR_REQUIRE_STACK=1` | 1,444 tests: 1,431 pass, 0 fail, 13 skipped |
| `node scripts/assemble-cloudflare.mjs --target=local` (runs `npm run build`) | pass; 69 html files; server paths include `/api/preferences`; Worker 1828 KiB gzip |
| Build suite, PW_PORT 3074, `--workers=2`: `about.spec.ts:254`, `about.spec.ts:309`, `contact.spec.ts:284`, `server-runtime.spec.ts`, all of `tests/build/destinations`, `home.spec.ts:556`, `private-stays.spec.ts:486` | 192 passed, 0 failed (7.6 min) |
| Same two cause-3 specs on plain `origin/main` df7abd6 | 4 failed, 14 passed (the proof that it is not this job) |
| `tests/header-i18n.spec.ts`, PW_PORT 3074, `--workers=2` | 8/8 pass |
| Earlier, on c23964e (2026-10-11): full app suite `--workers=4` | 2,775 tests: 2,687 pass, 0 fail, 88 skipped |
| Reviewer (Sonnet, auth/DB diff) | 2026-10-11 on c23964e: ship, 4 low findings, 2 fixed. 2026-10-12 on 1fca336 plus the cause 3 fix: ship, nothing blocking; 3 low findings, listed under Open as items 4-6 |

The 13 node skips were all there before this job: deleted Framer routes, `MEDIA_CHECK_OUT` not set, no `media-staging/`. None needs the stack.

## Not verified

- The full build suite (three shards) and the full app suite on this tip: left to the controller's clean clone, per the machine budget.
- A real magic-link sign-in end to end in a browser (email, then the confirm page, then the localised redirect). It is covered only by node tests with real local-stack sessions (`verifyOtp`) and by the confirm action's source guard. The same holds for the hint being set on sign-in; its clearing is covered in the browser.
- A signed-in POST to `/api/preferences` through the built Worker (`wrangler dev`). The build suite proves the Worker serves the path; the write itself was tested on `next dev` and the node handler.
- Live hosts (apex, www, preview), and real Arabic and Spanish sign-in emails.

## Open (reviewer findings left as they are)

1. The footer language links (the crawlable no-JS row) do not post the pick to the account; only the header `LocaleSelect` does. A signed-in guest who switches language through the footer keeps her old saved language. If this should be fixed, it is a small follow-up (a click handler on the footer links).
2. No browser test covers the `push` path, where a new account's browser currency is sent to its profile and `/account` then shows it. It is covered only by unit tests and by the local-stack `followAccount` test.
3. Item 4: the signed-in ops shell has no language control. Adding one is a design change for the owner (see the addendum).
4. "Sign out everywhere" runs on the ops host, so it clears the hint only there. The public host keeps its hint after an ops global sign-out. Its picks then POST and get a 204, which is harmless but means "a signed-out visitor sends nothing" is not strict in that case.
5. Setting the hint on sign-in is covered only by a source guard, not by a test that reads the `Set-Cookie` header. Owner test step 6 checks it by hand.
6. The hint lasts 400 days and is not renewed when the session refreshes. An account that stays signed in longer than that stops syncing until she signs in again.

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
6. Sign in on the public host, then open the browser's cookies for the site. Expected: `almar-signed-in` is there with value `1`. Sign out. Expected: it is gone.
