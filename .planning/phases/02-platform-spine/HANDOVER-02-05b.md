# Hand-over: fix-up job 02-05b (review of PR #6)

Branch `fix/02-05b-footer-language`, cut from `origin/main` `9572732`, `origin/main` `9235f86` merged in (a planning
note only, no conflict). Work session, not the controller. No migration, no environment name, no secret, no deploy.
The first run died on 2026-10-12 ~20:36 (network error) before any commit; this is the redo of 2026-10-13.

Review: PR #6, the comment starting `**Verdict: ship**` (Sonnet reviewer). Findings 1, 2, 3, 5 were assigned here;
4 goes to 02-06 (board).

## Per finding

1. **Footer language links never call `postPreferences`: fixed.** `components/ui/footer.tsx`: both footer tones' language
   links get `onClick={() => offerLanguage(item)}`; `offerLanguage` posts `{ locale }` through the same
   `postPreferences` the header picker uses (so: only with the signed-in hint, fire-and-forget, `keepalive`). The link
   stays a plain `<a href>`: with JavaScript off it still navigates and saves nothing, as before. The current
   language's link sends nothing (no change), matching the header picker, whose select fires only on a change. The
   footer does not set the `almar-locale` cookie (it did not before; out of scope, no cookie logic changed).
   Tests: three new browser tests in `tests/header-i18n.spec.ts` (`footer, …`): signed in, Español posts
   `{"locale":"es"}` and lands on `/es/about`; signed out, العربية posts nothing and lands on `/ar/about` rtl; the
   current language posts nothing. The first fails on the old footer (no request is ever made).
2. **Set the hint server-side when a valid session lacks it: not done, on the controller's instruction** (2026-10-13:
   "the footer links call `postPreferences` like the header picker does, and you don't change the cookie logic").
   Proposed fix, for the controller to assign or drop: in `middleware.ts`, after `sessionEmail` (line 45) and before
   the cookie loop (line 80): when `email` is set, the host is not ops, the method is GET or HEAD, the path is not
   `/auth/sign-out`, and the request has no `almar-signed-in=1`, add
   `response.cookies.set(SIGNED_IN_HINT_COOKIE, "1", signedInHintOptions(production))`. Limit: the middleware only runs
   on the Worker's server paths (`/api/*`, `/login`, `/auth/*`, `/account`, `/bookings`, `wrangler.toml`
   `run_worker_first`), so a guest who only browses the static pages gets the hint back the next time she opens
   `/account` or `/bookings`, not before. Test would extend the middleware harness in `tests/auth-cookies.test.mjs`.
3. **A 503 loses the pick silently: fixed.** `components/site/account-sync.ts`: `postPreferences` sends the same body
   once more when the answer is 503; any other status, a second 503 or a network error is dropped (no loop). Limit,
   stated in the code: the retry needs the first answer to arrive while the page is still open. A currency pick
   (no navigation) always gets it; a language pick (header or footer) navigates at once, so its retry happens only
   when the 503 comes back before the next page replaces this one. Tests: `tests/preferences-fixup.test.mjs` runs the
   real `postPreferences` against a fake fetch (12 tests: no hint = no request; 503 then 204 = two identical requests;
   503 x3 = two; 204/400/403/413/415/500/502 = one; network errors swallowed). Three of them fail on the old file
   (checked by swapping it back).
5. **No test reads the hint's Set-Cookie from `confirmSignIn`: fixed.** `tests/preferences-fixup.test.mjs` bundles
   the real `app/auth/confirm/actions.ts` (stubs only for Next's headers/cookies/redirect, Supabase, the continue check
   and the account follow) and gives it Next's own `ResponseCookies` as the cookie store, so it reads the exact
   Set-Cookie text: production, public host = one `almar-signed-in=1; Path=/; …; Max-Age=34560000; Secure;
   SameSite=lax`, no HttpOnly, no Domain; development = no Secure; ops host = none; failed `verifyOtp` = none and
   `/login?expired=1`. Checked it bites: setting `httpOnly: true` in `signedInHintOptions` fails it.

## Checks (2026-10-13, on the final commit after the merge)

Code commit `bde708c`; merge commit `710cf82` (checks below ran on it; this hand-over file is the only later change).

- `npm ci`: exit 0.
- `npx tsc --noEmit`: exit 0.
- `npm run tokens:check`: exit 0.
- `node --test tests/*.test.mjs`: 1,598 tests, 1,563 pass, 0 fail, 35 skipped (skips are the existing conditional
  ones: deleted route files, no local stack). Same result before the merge.
- `tests/preferences-fixup.test.mjs` alone: 17/17 pass. Against the old `account-sync.ts`: 3 fail (the retry tests).
  With `httpOnly: true` in `signedInHintOptions`: the Set-Cookie test fails.
- `PW_PORT=3061 npx playwright test tests/header-i18n.spec.ts --workers=2`: 11/11 pass (8 old, 3 new footer tests),
  before and after the merge. Against the old footer, the "footer, signed in" test fails (no request within 90 s).

## Not verified

- The full browser suite (`npx playwright test --workers=4`), `npm run build` and the build suite: left to the
  controller's clean clone (machine budget); I ran only the browser file I touched.
- A real 503 from the hosted Supabase, and the retry through the built Worker (`wrangler dev`): the retry is covered by
  the node test with a fake fetch only.
- The footer click on the built static site (`out/`) and on live hosts: tested on `next dev`.
- Local-stack tests: no local Supabase stack was started (nothing here touches the database); those tests skip.

## Proposed board changes (controller to apply)

- 02-05b: findings 1, 3, 5 done on this branch; finding 2 open (proposal above), decide whether it becomes its own job.

## Owner test steps (after landing, on the preview or live host)

1. Sign in on the public site, open `/about`, scroll to the footer, click **Español**. Expected: `/es/about` opens in
   Spanish.
2. Open `/account`. Expected: the language shows Español.
3. Sign out, open `/about`, click **العربية** in the footer. Expected: `/ar/about` opens right to left; nothing else
   changes (no account).
