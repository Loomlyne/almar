# Hand-over: 02-06 Settings (work session, not the controller)

Branch `gsd/phase-02-p06-settings`, cut from `origin/main` `fa5033c`; `origin/main` merged twice (`4535fea`: `e776411`,
planning notes only; `9aa36e5`: `aee65eb`, 03.2-02b, merged with `-X theirs`, exit 0; my assembler hunks checked present after it). Round 2 (controller items 1-3, 2026-10-13) is on top of the first hand-over (`c72c50e`).
No push to `main`, no PR, no deploy, no live database, no Cloudflare or DNS change. Stripe untouched.

## Per task

1. **Pictures** (`9a7d6ef`): Settings, error, saved, maintenance x EN/AR/ES x 390/834/1440. Signed 2026-10-13.
2. **Contrast gate + failing tests** (`70052ed`): `lib/settings/contrast.ts` (WCAG 4.5 text / 3 large, gold not checked).
3. **02-05 finding 4** (`ac922ea`, `5105d15`): `/account` shows the currency the public site uses; a failed save puts
   the currency back. Language keeps its 02-05 behaviour: reverting it too flipped the signed `ar-closed.png` (the
   harness save always fails).
4. **Database** (`e07b6df`): migration `20261013120000_site_settings_brand.sql` + pgTAP `site_settings_access` (27).
5. **Public site** (`f7358b5`): build-time maintenance and brand (`scripts/assemble-cloudflare.mjs`,
   `lib/site-settings.ts`, `lib/maintenance-document.ts`); `/login`, `/account`, `/bookings` close at once
   (`middleware.ts` + `lib/maintenance-gate.ts`, 503, 30 s cache, fails open).
6. **Owner API** (`6d6d578`): `GET/POST /api/ops/settings` via `opsGet`/`opsPost` (`lib/ops/settings.ts`,
   `lib/settings/{validate,handlers,site-rebuild}.ts`).
7. **Screen** (`771f906`, `0114a2a`): `app/dashboard/(ops)/settings/*`, `/settings` in `OPS_LIVE_SECTIONS`, copy in its
   own file `lib/copy/ops-settings.ts`; browser specs; old placeholder tests updated.
8. **Round 2, item 1: dashboard and email wear the brand** (`2c2d57f`, `0a0730e`, `eedee97`; D-108, D-110, D-113, D-116).
   - Ops shell: `app/dashboard/(ops)/layout.tsx` reads `api_site_settings` on every request after the owner gate
     (`lib/site-settings-read.ts`, `maxAgeMs: 0`). Saved colours go in as `<style id="almar-brand">:root{…}</style>`
     (`brandCss`); a saved logo is the shell header image, straight from `media.almarprivatejourney.com`. A brand save
     calls `router.refresh()`, so the shell changes at once. A failed read keeps the design system.
   - Sign-in email (guest and ops, `lib/auth/magic-link-server.ts`): settings read at send time (30 s cache); Teal,
     Gold, Ivory, Charcoal inline; the saved faces first in each font stack (Arabic keeps Noto, D-123); a saved logo as
     `<img src="https://media.almarprivatejourney.com/<key>" width="140">`. `lib/email/magic-link.ts` stays import-free
     and refuses any colour, face or logo URL that did not come from the checked row.
   - Faces: the selects offer only the design system's faces (D-115, D-121: Questa, Lato), which the CSS already uses,
     so a saved face never needs a CSS rule; the email names them in its font stacks.
   - Tests: `tests/settings-brand.test.mjs` (8, node); `tests/build/ops-brand.spec.ts` (2, built ops Worker, owner signed
     in on the local stack: no style and the wordmark with nothing saved; the saved Teal variable and the media logo
     after a save).
9. **Round 2, item 2: the three server pages really close** (`5afe029`). Proof below. Also: the closed page the Worker
   answers takes a saved logo from the image host (a `/brand/` copy exists only after a rebuild), and the three 404s
   now take the saved colours and close with the site (they were not in the rebuild's page list).
10. **Round 2, item 3: brand reach measured** (`5afe029`, `tests/build/measure-brand-reach.mjs`). Table below.
11. **Spec upkeep** (`f7ff0e3`): `tests/build/ops-api.spec.ts` route list adds `media` (03.2-09, already on
    `main`: A1 failed there too) and `settings`.

## Checks

Code tip `eedee97`. Logs in `~/almar-logs/02-06-*.log`. Machine rule kept: one chain at a time, one stack, at most
`--workers=2`; the local stack is stopped (`stack_stop=0`, 2026-10-14 00:20 +04).

On `9aa36e5` (merge commit; chain 2026-10-13 23:46 to 2026-10-14 00:11) and again on `eedee97` (00:15 to 00:20) unless noted:

- `npm ci` (9aa36e5): exit 0. `npx tsc --noEmit`: exit 0 (both).
- `npm run tokens:check`: exit 0. `npm run build` (`next build`): exit 0.
- pgTAP: 4 files, 661 tests, PASS.
- Built ops Worker (`--target=ops`, local stack): `ops-brand.spec.ts` + `ops-api.spec.ts` + `ops-runtime.spec.ts`:
  27/27 pass. (On `5afe029`, before the route-list fix, `A1` failed on `/api/ops/media`, which `main` also lacks.)
- Built public Worker (`--target=local`, local stack): `maintenance-runtime.spec.ts` 3/3; `locale-404`,
  `auth-paths`, `server-runtime` 49/49.
- Brand reach: 2661 of 2661 teal elements follow (table above).
- Dev server, `--workers=2`: `maintenance`, `ops-settings`, `account-select`, `header-i18n`: 37/37.
- `ALMAR_REQUIRE_STACK=1 node --test tests/*.test.mjs` on `eedee97`: 1656 tests, 1639 pass, **3 fail**, 14 skipped
  (opt-in or retired: 7 "route.ts is gone", 2 media-staging absent, 4 `MEDIA_CHECK_OUT=1`, 1 `ALMAR_REBUILD_PROOF=1`).
  The 3 are `preferences-local` x2 and `ops-api-local` "owner API end to end", each failing with "no local Supabase
  stack" in the parallel run. Cause (test harness, not 02-06): `requireStack` runs `supabase status` before the file
  takes `acquireStackLock`, and `status` fails while another file (`import-catalog`) resets the database. Round 1's
  same three failures had the same cause (I blamed my types call then: wrong). Each of the 8 stack files run alone on
  `9aa36e5`, stack required: 54/54 pass (`02-06-stack2.log`). Proposed fix, shared helper, not changed here: take the
  lock before `requireStack` in those files, or retry `status` a few seconds in `localStack`.
- On `9aa36e5` the full node run also had a guard failure that was mine: the media host literal in
  `lib/site-settings.ts` (`tests/data-contract.test.mjs`). Fixed in `eedee97` (the media URL helpers moved to
  `lib/site-settings-read.ts`, which imports `mediaUrl`). That run's 20-minute lock waits (5 stack tests) did not recur.

## Item 2 proof: which of /login, /account, /bookings the Worker serves

The premise "the Worker runs only for /api/*" is from job 10. Plan 02-23 task 3 added the sign-in paths to
`run_worker_first` in both Worker files (`wrangler.toml` line 17 on the branch and on `origin/main`):
`["/api/*", "/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]`.

| Path | File in `out/` after `--target=local` | In `run_worker_first` | Live 2026-10-13 23:35 +04 (navigate GET) | Served by |
|---|---|---|---|---|
| `/login` | none | yes | 200, `x-opennext: 1` | Worker (middleware runs) |
| `/account` | none | yes | 307 to `/login?return=account`, `x-opennext: 1` | Worker (middleware runs) |
| `/bookings` | none | yes | 307 to `/login?return=bookings`, `x-opennext: 1` | Worker (middleware runs) |
| `/ar/login`, `/es/account` | none | no | (static 404) | asset 404 page, closed by the rebuild |
| `/about` | `out/about.html` | no | 200, no `x-opennext` | asset, closed by the rebuild |
| `/` | `out/index.html` | no | 200, no `x-opennext` | asset, closed by the rebuild |

None of the three is a static file, so the middleware gate is what closes them. Proven end to end on the built public
Worker (`wrangler dev`, local stack, `tests/build/maintenance-runtime.spec.ts`, 3 tests): with `maintenance = true`
saved in the database, all three answer 503 with the closed page (navigate and plain requests; `no-store`, `noindex`,
tel link, saved Teal, Spanish with `almar-locale=es`); `/about` is still the file (no `x-opennext`); `/api/health` 200.
Bite: the same run with `maintenance = false` saved fails (`/login` 200, expected 503). Every static page, and now the
three 404s, get the closed page from the publish rebuild (`applySiteSettings`, unit-tested).

## Item 3: how far a saved Teal reaches the public pages

`tests/build/measure-brand-reach.mjs` on `out/` (`--target=local`, fixtures). The build has **0 Framer pages**: every
public page is React since plans 23/24 deleted the Framer `route.ts` files ("0 Framer, React en 22 / ar 22 / es 22,
3 404s"). For each page, Chromium at 1440 px: elements whose computed colour, background, border, outline, fill,
stroke or underline is the design Teal, then the same page with the rebuild's `<style id="almar-brand">` for Teal
`#7a1f3b` (transitions off). Before the 404 fix the three 404 links stayed design Teal (literal hex); now nothing stays.
The SVG images are the two logo files (`Poly_White` x54, `Stacked_Charcoal` x12, white and charcoal, not teal); the
rebuild swaps them for a saved logo.

Saved Teal #7a1f3b over the design Teal #1f3b40, 69 pages in out/.

| Page | Teal elements | Take the saved Teal | Stay design Teal | SVG images (colour baked in, not measured) | Examples that stay |
|---|---:|---:|---:|---:|---|
| `/404` | 1 | 1 | 0 | 0 | - |
| `/about` | 15 | 15 | 0 | 1 | - |
| `/ar/404` | 1 | 1 | 0 | 0 | - |
| `/ar/about` | 15 | 15 | 0 | 1 | - |
| `/ar/blog` | 7 | 7 | 0 | 1 | - |
| `/ar/blog/colombias-coffee-triangle-eje-cafetero` | 15 | 15 | 0 | 1 | - |
| `/ar/blog/discovering-cartagenas-hidden-colonial-courtyards` | 16 | 16 | 0 | 1 | - |
| `/ar/blog/why-medellin-is-redefining-luxury-travel` | 16 | 16 | 0 | 1 | - |
| `/ar/contact` | 38 | 38 | 0 | 1 | - |
| `/ar/destinations` | 6 | 6 | 0 | 1 | - |
| `/ar/experiences` | 54 | 54 | 0 | 1 | - |
| `/ar/` | 59 | 59 | 0 | 1 | - |
| `/ar/private-stays` | 20 | 20 | 0 | 1 | - |
| `/ar/private-stays/baru-island-private-villa` | 51 | 51 | 0 | 1 | - |
| `/ar/private-stays/bocagrande-beach-house` | 66 | 66 | 0 | 1 | - |
| `/ar/private-stays/cartagena-historic-center-house` | 41 | 41 | 0 | 1 | - |
| `/ar/private-stays/casa-jardin-san-diego` | 58 | 58 | 0 | 1 | - |
| `/ar/private-stays/casa-juliana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/ar/private-stays/casa-mariana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/ar/private-stays/getsemani-colonial-house` | 48 | 48 | 0 | 1 | - |
| `/ar/private-stays/getsemani-courtyard-residence` | 59 | 59 | 0 | 1 | - |
| `/ar/private-stays/private-island-cartagena` | 37 | 37 | 0 | 1 | - |
| `/ar/private-stays/private-island-estate-cartagena` | 62 | 62 | 0 | 1 | - |
| `/ar/private-stays/santa-fe-farm-antioquia` | 59 | 59 | 0 | 1 | - |
| `/ar/private-stays/sopetran-country-estate` | 43 | 43 | 0 | 1 | - |
| `/blog` | 7 | 7 | 0 | 1 | - |
| `/blog/colombias-coffee-triangle-eje-cafetero` | 15 | 15 | 0 | 1 | - |
| `/blog/discovering-cartagenas-hidden-colonial-courtyards` | 16 | 16 | 0 | 1 | - |
| `/blog/why-medellin-is-redefining-luxury-travel` | 16 | 16 | 0 | 1 | - |
| `/contact` | 38 | 38 | 0 | 1 | - |
| `/destinations` | 6 | 6 | 0 | 1 | - |
| `/es/404` | 1 | 1 | 0 | 0 | - |
| `/es/about` | 15 | 15 | 0 | 1 | - |
| `/es/blog` | 7 | 7 | 0 | 1 | - |
| `/es/blog/colombias-coffee-triangle-eje-cafetero` | 15 | 15 | 0 | 1 | - |
| `/es/blog/discovering-cartagenas-hidden-colonial-courtyards` | 16 | 16 | 0 | 1 | - |
| `/es/blog/why-medellin-is-redefining-luxury-travel` | 16 | 16 | 0 | 1 | - |
| `/es/contact` | 38 | 38 | 0 | 1 | - |
| `/es/destinations` | 6 | 6 | 0 | 1 | - |
| `/es/experiences` | 54 | 54 | 0 | 1 | - |
| `/es/` | 59 | 59 | 0 | 1 | - |
| `/es/private-stays` | 20 | 20 | 0 | 1 | - |
| `/es/private-stays/baru-island-private-villa` | 51 | 51 | 0 | 1 | - |
| `/es/private-stays/bocagrande-beach-house` | 66 | 66 | 0 | 1 | - |
| `/es/private-stays/cartagena-historic-center-house` | 41 | 41 | 0 | 1 | - |
| `/es/private-stays/casa-jardin-san-diego` | 58 | 58 | 0 | 1 | - |
| `/es/private-stays/casa-juliana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/es/private-stays/casa-mariana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/es/private-stays/getsemani-colonial-house` | 48 | 48 | 0 | 1 | - |
| `/es/private-stays/getsemani-courtyard-residence` | 59 | 59 | 0 | 1 | - |
| `/es/private-stays/private-island-cartagena` | 37 | 37 | 0 | 1 | - |
| `/es/private-stays/private-island-estate-cartagena` | 62 | 62 | 0 | 1 | - |
| `/es/private-stays/santa-fe-farm-antioquia` | 59 | 59 | 0 | 1 | - |
| `/es/private-stays/sopetran-country-estate` | 43 | 43 | 0 | 1 | - |
| `/experiences` | 54 | 54 | 0 | 1 | - |
| `/` | 59 | 59 | 0 | 1 | - |
| `/private-stays` | 20 | 20 | 0 | 1 | - |
| `/private-stays/baru-island-private-villa` | 51 | 51 | 0 | 1 | - |
| `/private-stays/bocagrande-beach-house` | 66 | 66 | 0 | 1 | - |
| `/private-stays/cartagena-historic-center-house` | 41 | 41 | 0 | 1 | - |
| `/private-stays/casa-jardin-san-diego` | 58 | 58 | 0 | 1 | - |
| `/private-stays/casa-juliana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/private-stays/casa-mariana-historic-center` | 58 | 58 | 0 | 1 | - |
| `/private-stays/getsemani-colonial-house` | 48 | 48 | 0 | 1 | - |
| `/private-stays/getsemani-courtyard-residence` | 59 | 59 | 0 | 1 | - |
| `/private-stays/private-island-cartagena` | 37 | 37 | 0 | 1 | - |
| `/private-stays/private-island-estate-cartagena` | 62 | 62 | 0 | 1 | - |
| `/private-stays/santa-fe-farm-antioquia` | 59 | 59 | 0 | 1 | - |
| `/private-stays/sopetran-country-estate` | 43 | 43 | 0 | 1 | - |
| **All** | **2661** | **2661** | **0** | **66** | |

(Same table in `02-06-BRAND-REACH.md`.)

## Migration `20261013120000_site_settings_brand.sql`: live safety

- New file, timestamp after the latest (`20261005110000`). No applied migration edited.
- Drops `site_settings.logo_bytes`, `site_settings.logo_type` and the view `site_settings_public`. No code reads them
  (`git grep`: only the old migration, its test and the stale generated types). Before applying, read the live row
  once: `select logo_bytes is not null as has_bytes, logo_type from public.site_settings;` must be `false, null`.
- New checks: five colours `^#[0-9a-f]{6}$` or null, `title_face in ('Questa')`, `body_face in ('Lato')`, VAT and
  deposit 0-100. The live row (colours null, Questa/Lato, 5.00/30.00 per the controller) passes all of them. If a
  live colour is upper case or a face differs, the `alter table` fails and nothing is applied.
- `api_site_settings` is security_invoker; anon gets select on the view and column select on the public columns only.

## Environment and secrets

No new environment name. The build and the Worker use the existing `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. No secret was written anywhere.

## 03.2-05 seam

`lib/settings/site-rebuild.ts` `requestRebuild` is a no-op today. When 03.2-05 lands `requestPublish({ admin })` in
`lib/ops/site-update.ts`: return `affects_site: true` from the handler (it already does), let runOps `afterWrite`
call `requestPublish`, delete `site-rebuild.ts` and the `requestRebuild` argument in `lib/ops/settings.ts` and
`lib/settings/handlers.ts`. Until then a saved maintenance or brand change reaches the public site only at the next
deploy; `/login`, `/account`, `/bookings` close within 30 s regardless.

## Not verified

- No real publish rebuild against a saved live row (the assembler step is unit-tested on a temp `out/`; the seam waits
  for 03.2-05).
- The email in real mail clients: WebP logos do not show in Outlook desktop (the upload accepts PNG/JPEG/WebP); the
  saved faces only show where the client has them installed (Questa never is: Georgia shows).
- Owner question: the email button is Teal text on a Gold background, and Gold is not contrast-checked (signed). A
  dark saved Gold makes that button hard to read. Options: check Teal on Gold too, or make the email button the site's
  teal primary.
- The settings write and the profile write are two updates, not one transaction.
- `lib/supabase/database.types.ts` is stale (this and earlier migrations): a separate refresh after landing (agreed).

## Deviations from the plan

- Runtime middleware rewrite of every public page → build-time closed page + runtime gate on server paths (owner 1).
- `app/maintenance/page.tsx` → `lib/maintenance-document.ts` (static HTML, the build and the Worker both use it).
- `app/host-shell/*` → `app/dashboard/(ops)/settings/*` + `/api/ops/settings` (owner 5).
- Logo: R2 media row copied into `out/brand/` by the build; no `logo_bytes`, no `/brand/logo` route (owner 3).
- Save is teal (signed pictures), not the UI-SPEC's gold.
- The closed page has no currency control (no price on it; a control that does nothing breaks C-18).
- `app/account/account-screen.tsx` + `lib/account-preferences.ts` changed (finding 4), outside the plan's files.
- D-137 reworded in the plan (owner via controller). Note: D-137 in `02-CONTEXT.md` is about a **language** save
  updating an open public tab, not brand. That cannot happen live (the ops host is another origin); the reworded line
  says her language and currency reach the public site at her next sign-in there. Please confirm or correct.

## Proposed board / state lines (controller edits them)

- CONTROL-BOARD: `02-06 Settings: hand-over at <tip>, waiting for review and Ship. Migration 20261013120000 to apply.`
- STATE: `02-06 complete on branch; public site at the next publish rebuild (seam for 03.2-05); dashboard, sign-in email and /login, /account, /bookings at once.`

## UAT for the owner (after the migration is applied and the branch is deployed to the ops host)

1. Open `https://dashboard.almarprivatejourney.com/settings` signed in as owner. Expected: groups Brand colors, Type,
   VAT and deposit, Maintenance, Logo, Your language and currency; VAT 5.00, deposit 30.00; FX shows the live rate or
   "Not available right now."; Save is grey.
2. Change VAT to `5.5`. Expected: "Use two decimal places." under it, Save stays off. Type `5.50`: the line goes, Save
   turns teal.
3. Set Ivory to `#1f3b40` (same as Teal). Expected: "The contrast is too low." on the colour, Save off. Put it back.
4. Click Save. Expected: "Settings saved."; reload shows 5.50.
5. Change something, click Bookings in the sidebar. Expected: "You have unsaved changes." with Stay / Leave.
6. Logo → Upload a PNG over 1 MB. Expected: "Use a PNG, JPEG or WebP file up to 1 MB." and Save off.
7. Tick "Maintenance is on", Save. Open `https://almarprivatejourney.com/login` in a private window within a minute.
   Expected: the closed page with the phone and email links; the dashboard still opens. Untick and Save.
8. Set Teal to `#2b4f56`, Save. Expected: the dashboard header, buttons and links turn that colour at once.
9. Logo → pick a square PNG from the library, Save. Expected: the dashboard header shows it at once.
10. Sign out, then ask for a sign-in link. Expected: the email shows the new logo and colours. Put Teal back and
    Remove logo, Save.
11. Switch to العربية and Español in Settings. Expected: the page reloads in that language, right-to-left for Arabic,
   and "Settings saved." shows.

## Draft copy for review (correctable at UAT)

Locked lines unchanged: "ALMAR Private Journey is closed for a short time.", "Save", "Use dos decimales.".
Drafts in `lib/copy/ops-settings.ts` (EN/AR/ES): group titles, Gold hint "Gold is used for lines only.", FX hint
"Updated daily. Not editable.", "Not available right now.", maintenance hint, logo hint and refusal, "Settings saved.",
"The contrast is too low.", "Use a number from 0 to 100.", save/load failures, the leave dialog. Drafts in
`lib/maintenance-document.ts`: the AR and ES closed-page line, "Skip to content", "Language".
