---
phase: 02-platform-spine
plan: "05"
status: complete
completed: 2026-10-11
---

# 02-05 Summary: language and currency follow a signed-in account

Rescoped by the owner on 2026-10-11 (answer A) to items 1-4 of `02-05-ADDENDUM.md`, because the original plan's tasks no longer fit main (3.3 routes, missing framer/i18n files, Login held off public pages, currency kept in localStorage). This work was done inline from the addendum, not task by task through `/gsd-execute-phase`.

- **Item 1, sign-in restores her choices.** `lib/account-follow.ts` runs from the confirm action (`app/auth/confirm/actions.ts`) right after `verifyOtp`.
  - Returning account: `almar-locale` is set to her saved language, and her saved currency goes to the browser in the one-shot `almar-prefs-sync` cookie (10 minutes, lax, Secure in production). The return path is localised for public pages only (`localizedReturnPath`).
  - New account (first sign-in per `isFirstSignIn(verified.user)` and a row less than 15 minutes old): keeps what the browser already had. The browser's language is saved to her row, and the sync cookie value `push` asks the browser to send its currency.
  - Ops host: no localised return and no sync cookie.
  - It never throws, so a failure cannot cost her the sign-in.
- **Item 2, the browser applies the handoff.** `components/site/account-sync.ts` `applyAccountSync()` runs once from `PublicFrame` and `AccountScreen`.
  - It reads the cookie, clears it, and checks it against the allow-list. A currency is stored in localStorage `almar-currency`; `push` posts the browser's currency.
  - `/account` fills the browser currency from her row only when the browser has none.
- **Item 3, public picks are offered to the account.** `LocaleSelect` (the public `hrefs` branch only) and the home currency provider call `postPreferences`.
  - The call is fire-and-forget: `keepalive`, `referrerPolicy: "same-origin"`, and `.catch`. It never blocks or breaks navigation.
  - It is sent only when the readable hint cookie `almar-signed-in=1` is present (send-back, 2026-10-12). The confirm action sets it on a non-ops sign-in (value `1`, not HttpOnly, lax, Secure in production, 400 days); both sign-outs (`/auth/sign-out` and "sign out everywhere") clear it with max-age 0. A signed-out visitor sends nothing, so no 403 is logged. The hint grants nothing: the server's Origin check and session check are unchanged, and a stale hint only gets a 204.
- **POST `/api/preferences`.** The handler is `lib/preferences-route.ts`; the route file is `app/api/preferences/route.ts`.
  - Checks run in order: same-origin (`Origin`/`Sec-Fetch-Site`; `Origin: null` is accepted only with `Sec-Fetch-Site: same-origin`), then content type and the 1 KiB limit, then JSON, then the allow-list (en/ar/es, AED/USD/EUR).
  - Then the session: no session cookie or no user returns 204 and writes nothing.
  - The write is her own `profiles` row through her session client under RLS. No service role is used, and no reply echoes the input.
- **Item 4, ops.** The ops sign-in uses the same confirm action, so her language follows her there. The signed-in ops shell has no language control, and adding one is a design change left to the owner. `/api/preferences` is not served on `almar-ops`.
- **Not changed:** no package, no migration, no header restyle, no URL change, no Login on public pages, no new visible text, no booking or Stripe code.
- **Review:** a Sonnet `reviewer` found nothing blocking. Two low findings were fixed in `c23964e`:
  - A second sign-in inside the window is now treated as returning.
  - `/account` no longer overwrites a browser pick that has not been saved yet.

  Two were left open: the footer language links do not post the pick, and there is no browser test of the `push` path.
- **Tests:**
  - `account-preferences`, `preferences-route`, `account-follow` (node).
  - `preferences-local` (local stack: own row only, `role` not writable, check constraint, `followAccount` on real sessions).
  - `header-i18n.spec.ts` (Playwright, 8 tests: the signed-out pick sends no request; sign-out clears the hint).
  - `tests/build/server-runtime.spec.ts` now lists `/api/preferences` among the Worker's server paths.
  - `tests/build/slice3-pages.ts` `checkLanguage`: the `lang` read after the header pick retries on the `html` locator. The one-shot read raced the new document and failed on plain `origin/main` too (4 of 18).
