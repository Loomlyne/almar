---
phase: 02-platform-spine
plan: "05"
addendum: 2026-10-11
supersedes: the tasks of 02-05-PLAN.md (frontmatter, objective and threat ids kept for traceability)
owner_decision: "2026-10-11, question form via the ALMAR controller: option A, rescope 02-05 to items 1-4"
---

# 02-05 addendum: language and currency follow a signed-in account

## Why the old plan is stale (checked against `main` 3a458c6)

| Old plan says | `main` today |
|---|---|
| No `/ar` or `/es` route; a language pick keeps the URL `/` | Phase 3.3 shipped `/ar/…` and `/es/…` (`lib/locale-path.ts`); the nav's language select goes to the same page in the other language. Following the old plan would undo 3.3. |
| Edit `lib/framer/header.ts`, `components/live-header.tsx`, `lib/i18n/*` | None exist; the Framer header is gone. The public nav is `components/ui/nav.tsx` inside `components/site/public-frame.tsx`. |
| Depends on 02-09 | 02-09 is SUPERSEDED (ROADMAP). |
| Sign in / Bookings / Account in the public header | `public-frame.tsx` holds Login off on purpose; public pages are static files (Worker `almar` runs only for `/api/*` and the sign-in paths). |
| Currency in an `almar-currency` cookie | Owner answer 1 (3.3 design 6.1): currency is a browser choice in localStorage `almar-currency`, no cookie, no URL. |

Already on `main`: `/account` Preferences saves `profiles.locale` and `profiles.currency` and sets the `almar-locale` cookie (`app/account/actions.ts` `savePreferences`).

## The four items

1. **Sign-in restores her saved language.** `app/auth/confirm/actions.ts`, after `verifyOtp` succeeds, reads her own profile row (her session, RLS). Returning account: `almar-locale` := `profiles.locale`, and a return path that is a public page (`matchPublicPage`) is sent to that page in her language (`/private-stays` → `/ar/private-stays`). New account (profile row created in the last 15 minutes, i.e. by this confirmation): her current `almar-locale` cookie is saved to the profile instead, so a guest who signs up while reading Arabic is not flipped to English.
2. **Sign-in and `/account` restore her saved currency into the browser choice.** The confirm action sets a short handoff cookie `almar-prefs-sync` (not HttpOnly, 10 minutes, value `AED`/`USD`/`EUR`, or `push` for a new account). `PublicFrame` and the account screen read it once on mount: a currency is written to localStorage `almar-currency`; `push` sends the browser's current currency to her profile (item 3). The cookie is then cleared. `/account` also writes `profiles.currency` to localStorage on load and after a successful Preferences save.
3. **A language or currency pick on a public page while signed in saves to her profile.** New `POST /api/preferences` (`app/api/preferences/route.ts`, core in `lib/preferences-route.ts` with no Next import):
   - same-origin only: `Sec-Fetch-Site`, when present, must be `same-origin`; an `Origin` other than `null` must equal the request's own origin on an allowed host (production: `almarprivatejourney.com`, `www.`, `preview.`; dev: `127.0.0.1`/`localhost` over http). `Origin: null` (a `no-referrer` page) or no Origin is accepted only with `Sec-Fetch-Site: same-origin`. Anything else is 403.
   - JSON only, at most 1 KiB; body keys only `locale` (en/ar/es) and `currency` (AED/USD/EUR), at least one; else 400. No input is echoed.
   - no Supabase session cookie, no configured Supabase, or no user: 204, nothing written.
   - writes only her own `profiles` row through her session client (`.eq("id", user.id)` under RLS). No service role. Zero rows or an error: 503.
   - Callers: `LocaleSelect` when it follows a language URL (public nav only; the login and account selects do not call it) and `CurrencyChoiceProvider.choose`. Fire-and-forget: `fetch` with `keepalive`, `referrerPolicy: "same-origin"`, errors swallowed; navigation never waits for it.
4. **Ops dashboard.** The signed-in ops shell has no language control today (only its sign-in page has one, and that visitor is signed out). The shared confirm action (item 1) restores the owner's saved language at ops sign-in. `/api/preferences` is not served on `almar-ops` (`lib/ops-routes.ts` refuses non-`/api/ops` paths). Adding a language control to the signed-in ops shell is a design change and is left to the owner.

Not in scope: header restyle, URL change, Login on public pages, packages, migrations (columns exist), price conversion, booking or Stripe code. No new visible text.

## Files

- new `lib/account-preferences.ts` (pure: cookie names, parse, new-account test, return-path localising)
- new `lib/preferences-route.ts` (pure endpoint core and `saveOwnPreferences`)
- new `app/api/preferences/route.ts`
- new `components/site/account-sync.ts` (client: `postPreferences`, `applyAccountSync`)
- `app/auth/confirm/actions.ts`, `components/ui/locale-select.tsx`, `components/ui/nav.tsx`, `components/pages/home/currency-choice.tsx`, `components/site/public-frame.tsx`, `app/account/account-screen.tsx`

## Tests

- `tests/account-preferences.test.mjs`: allow-lists, new-account window, return-path localising (public page, English-only page, query kept, open-redirect shapes stay `/`).
- `tests/preferences-route.test.mjs`: same-origin accepted; cross-origin refused (403, nothing read or written); `Origin: null` with and without `Sec-Fetch-Site: same-origin`; `Sec-Fetch-Site: cross-site` with a forged matching Origin refused; no Origin refused; wrong host refused; 415, 413, 400 bad JSON, 400 unknown key, 400 bad value; no session cookie 204 with no session call; no user 204; save failure 503; reply never echoes input; source guard (no service role, no Next import in the core).
- `tests/preferences-local.test.mjs` (local stack): a signed-in user's client writes her own row; it cannot write another user's row.
- `tests/header-i18n.spec.ts` (dev server): picking العربية on `/` goes to `/ar/` with `dir=rtl`, sets `almar-locale=ar`, posts `/api/preferences` (204 signed out) and the page still navigates when the request fails; currency pick keeps `almar-locale`.
