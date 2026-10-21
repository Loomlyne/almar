# Job 21 hand-over: /en, /ar, /es on every page, the language cookie, the header Login link

Branch `gsd/locale-prefix-urls`, cut from `origin/main` 39546d56. Owner decisions: `.planning/decisions/2026-10-21-owner-answers-after-landing.md` #5, #7, #13.

## Checks
- `npx tsc --noEmit`: clean.
- `npm run tokens:check`: theme up to date.
- Everything else: **not run (owner: no test)**: node tests, Playwright, build, assemble, parity, media guard, wrangler dry run.

## What changed

### 1. Prefixes (#13)
- `lib/locale-path.ts`: English is prefixed like the others: `localePath("en", "/") = "/en/"`, `localePath("en", "/about") = "/en/about"`. `stripLocale` still reads an unprefixed path as English (old addresses). New `GUEST_PAGES` / `isGuestPage` (`/login`, `/account`, `/bookings`, `/bookings/…`); `siteHref` localises them too. Canonical, hreflang (x-default = `/en/…`), og:url, the language select, the footer language row and the sitemap all go through this helper, so they follow without other edits.
- Public pages: `app/<page>` moved to `app/en/<page>` (git mv; only import depths changed). No page at `app/page.tsx` any more.
- Guest pages: `app/login|account|bookings` moved to `app/[locale]/login|account|bookings`. The language comes from the address (`params.locale`, anything but en/ar/es is `notFound()`), so `lang`/`dir` are right in the first bytes (LocaleDocument reads the first segment). The cookie no longer picks their language.
  - Sign-in (public variant), account and bookings: choosing a language navigates to the same page in that language (`components/site/locale-navigation.ts` `goToLocale`, keeps query and hash, writes the cookie). The account page saves the preference first, then navigates. The ops sign-in (dashboard host, no prefixes) still switches in place.
  - Redirects: `/<locale>/login?return=account|bookings`; `RETURN_KEYS` and the return cookie are localised to the page's language (`localizedReturnPath`, which now also localises guest pages).
  - `safeReturnPath` also refuses `/en|ar|es/login…` (loop guard).
  - Account menu links (Bookings, Profile, Preferences) carry the page's locale.
- `/auth/*`, `/api/*`, `/newsletter` and the dashboard host stay unprefixed. `/auth/confirm` links to `/<cookie locale>/login` (else `/en/login`).
- `lib/server-routes.ts` `SERVER_PATHS_OUTSIDE_API`, `lib/auth/server-paths.ts` `JOB02_SERVER_PATHS`, `run_worker_first` in `wrangler.toml` and `wrangler.preview.toml`: the 9 prefixed guest paths replace `/login`, `/account`, `/bookings`; `"/"` added to `run_worker_first`.
- Maintenance (`lib/maintenance-gate.ts`): closes `/<locale>/login|account|bookings` and below; the closed page speaks the address's language. Maintenance page and static 404s link English home as `/en/`.
- `scripts/assemble-cloudflare.mjs`: English documents at `out/en/…`, home `out/en/index.html`; it throws if any page would ship unprefixed or if `out/index.html` exists. `scripts/media-lib.mjs` `publicDocuments` lists `en/…` documents (the media guard reads it).

**301s, and why this way:** the old unprefixed English pages answer **301 to `/en/…` from `public/_redirects`** (static asset layer: no Worker invocation, no CPU, no count against the Free plan's 100k Worker requests). Splat rules keep the rest of the path (`/blog/* → /en/blog/:splat`, also `/private-stays/*`, `/bookings/*`). `/services…` rules now target `/en/experiences…`. `worker/handle.mjs` holds the same 301 as a fallback (`legacyLocaleTarget`, used only if such a path ever reaches the Worker). `lib/locale-redirect.ts` holds the section list once; `tests/redirects.test.mjs` checks the file against it.

### 2. Cookie (#7)
- The language select already wrote `almar-locale` on every pick; it still does (public pages, and now the guest pages through `goToLocale`).
- `/` is answered by the Worker before Next (`worker/handle.mjs`, option `rootRedirect`, set only by `worker/almar.mjs`, so Worker `almar` and `almar-preview`; never `almar-ops`): **302** to `/<cookie>/` when the cookie is exactly en/ar/es, else `/en/`; query kept; `Cache-Control: private, no-store`, `Vary: Cookie`, noindex. No browser-language guessing. One small Worker call per `/` visit (no Next, microseconds of CPU). The dev server does the same in `middleware.ts` (and the legacy 301s), public host only.

### 3. Header Login link (#5)
- `PublicFrame` no longer hides Login: the nav's last item (after currency and language, order per CLAUDE.local.md) is **Login → `/<lang>/login`** (EN "Login", AR "دخول", ES "Entrar" from `HOME_COPY.nav.login`), same kit `SiteNav` link on phone (menu) and desktop.
- Signed in: it reads the existing readable hint cookie `almar-signed-in` after mount (the same one the account sync uses, nothing secret) and shows **Account → `/<lang>/account`** (GUEST_COPY "Account" / "الحساب" / "Cuenta"). Cheap: no request. A stale hint shows Account, whose page sends her to sign in. Pages are static, so the first paint says Login and switches after hydration for a signed-in visitor.

### 4. Phase 4 (job 16) — paths its pages must use
- Guest booking pages live under **`app/[locale]/bookings/…`** (not `app/bookings/…`), served at **`/en/bookings/…`, `/ar/bookings/…`, `/es/bookings/…`**. Read the language from `params.locale` (`isLocale` else `notFound()`), never from the cookie. Build links with `localePath(locale, "/bookings/<id>")` / `siteHref`.
- `app/bookings/bookings-screen.tsx` and `page.tsx` are now `app/[locale]/bookings/…` (git mv, same content apart from the locale changes): a merge of job 16 should follow the rename.
- Any new exact server path goes in `SERVER_PATHS_OUTSIDE_API` and both `run_worker_first` lists in its three prefixed forms; a dynamic `/<locale>/bookings/<id>` needs a pattern (e.g. `"/en/bookings/*"` in run_worker_first plus a prefix rule in `worker/handle.mjs` / `lib/server-routes.ts`, which today forwards exact paths only). The old `/bookings/*` answers 301 to `/en/bookings/*`. Maintenance already closes `/<locale>/bookings/…`.
- `app/api/booking/*` untouched. Emails and magic links that point at a booking page must use the prefixed form.

## Verify on preview before production (not verified here)
1. `curl -sI https://preview.almarprivatejourney.com/` → 302 `/en/`; with `-H 'Cookie: almar-locale=ar'` → `/ar/`; `/?x=1` keeps `?x=1`.
2. `curl -sI '…/about?x=1'` → 301 `/en/about` — **check the query string survives** (Cloudflare's `_redirects` docs do not say whether the request query is kept). If it is dropped, add the legacy sections to `run_worker_first` (handle.mjs already answers them with the query kept); say the cost (one Worker call per old URL hit).
3. `run_worker_first` exact `"/"`: confirm it matches only the root (docs give no example of a bare `/`): `curl -sI …/en/` must come from assets (no `x-robots-tag: noindex`).
4. `/ar/login` served HTML has `lang="ar" dir="rtl"`.

## Follow-ups / notes
- The Organization JSON-LD `url` stays `https://almarprivatejourney.com/` (a 302 now); left as the brand root.
- Test files: see the commit list; they were edited, not run.
