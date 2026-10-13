# Hand-over: 02-06 Settings (work session, not the controller)

Branch `gsd/phase-02-p06-settings`, cut from `origin/main` `fa5033c`; `origin/main` `e776411` merged in (`4535fea`,
planning notes only, no conflict). Code tip `5105d15`; this file and `02-06-SUMMARY.md` are the only later change.
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

## Checks (on `5105d15`, detached, logs in `~/almar-logs/02-06-*.log`)

Ran 2026-10-13 23:20-23:23 (+04), local stack `almar-931ac25e` up.

- `npm ci`: exit 0.
- `npx tsc --noEmit`: exit 0.
- `ALMAR_REQUIRE_STACK=1 node --test tests/*.test.mjs`: 1628 tests, 1611 pass, **3 fail**, 14 skipped (opt-in or
  retired: 7 "route.ts is gone", 2 media-staging absent, 4 `MEDIA_CHECK_OUT=1`, 1 `ALMAR_REBUILD_PROOF=1`). The 3 failures all said "no local Supabase stack"
  (`ops-api-local` owner API end to end, `preferences-local` x2) while 18 other stack tests passed in the same run.
  The likely cause is my `supabase gen types` call touching the stack at that moment. Rerun of those two files alone,
  stack required: 13/13 pass, exit 0 (`02-06-node-stack-rerun.log`). An earlier full run without the stack (before
  `0114a2a`/`5105d15`, same code except the account revert) had 1593 pass, 0 fail, 35 skipped.
- `npm run tokens:check`: exit 0.
- `npm run build` (`next build`): exit 0.
- `node scripts/assemble-cloudflare.mjs --target=local` (fixtures): exit 0, 69 html files, `out/brand/` has
  `wordmark.svg`, `questa.woff`, `lato.ttf`; "settings applied to 0 pages" (defaults change nothing, as designed).
  `--target=production` refuses to build without the database values in the shell (by design); not run.
- pgTAP (`local-supabase.mjs test`): 4 files, 661 tests, all pass (incl. `site_settings_access` 27).
- Playwright `--workers=2`, PW_PORT 3061: `maintenance.spec.ts`, `ops-settings.spec.ts`, `account-select.spec.ts`,
  `header-i18n.spec.ts`: 37/37 pass. Before `5105d15`, `account-select` failed `ar-closed.png` (18% pixels): the
  finding-4 language revert; fixed by reverting the currency only.

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

- No real publish rebuild ran against a saved row (the assembler path is unit-tested on a temp `out/`).
- The `/login` gate against a live flag in a browser (unit-tested with a fake fetch).
- Email (`lib/email/magic-link.ts`) and the ops shell do not take the saved colours or logo: **not done**.
- Framer-exported pages take the saved colours only where they use the design system's CSS variables.
- The settings write and the profile write are two updates, not one transaction.
- `lib/supabase/database.types.ts` is stale for this migration and for earlier ones (bookings, disputes, …);
  regenerating it here would pull other jobs' tables into this branch. Proposal: one separate refresh after landing.

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
- STATE: `02-06 complete on branch; maintenance/brand at the next publish rebuild (seam for 03.2-05).`

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
8. Switch to العربية and Español in Settings. Expected: the page reloads in that language, right-to-left for Arabic,
   and "Settings saved." shows.

## Draft copy for review (correctable at UAT)

Locked lines unchanged: "ALMAR Private Journey is closed for a short time.", "Save", "Use dos decimales.".
Drafts in `lib/copy/ops-settings.ts` (EN/AR/ES): group titles, Gold hint "Gold is used for lines only.", FX hint
"Updated daily. Not editable.", "Not available right now.", maintenance hint, logo hint and refusal, "Settings saved.",
"The contrast is too low.", "Use a number from 0 to 100.", save/load failures, the leave dialog. Drafts in
`lib/maintenance-document.ts`: the AR and ES closed-page line, "Skip to content", "Language".
