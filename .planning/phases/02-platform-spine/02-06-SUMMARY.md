---
phase: 02-platform-spine
plan: "06"
status: complete
completed: 2026-10-13
---

# 02-06 Summary: Settings is one real page on the ops host

Executed on branch `gsd/phase-02-p06-settings` (work session). The plan's runtime design (a middleware rewrite of every
public page, `app/host-shell/*`, `/brand/logo` route, logo bytes in the table) did not fit main, where the public site is
static files and the Worker runs only for `/api/*`, `/login`, `/auth/*`, `/account`, `/bookings`. The owner chose the
shape on 2026-10-13 (answers 1-5 via the controller); pictures were signed the same day (teal Save, no contrast check on
gold, usted "Use dos decimales.").

## What she gets

- **Settings page** at `dashboard.almarprivatejourney.com/settings` (`app/dashboard/(ops)/settings/`, live section in
  `OPS_LIVE_SECTIONS`): five brand colours (one row each), title face Questa and body face Lato (the design system's
  faces; Arabic faces fixed), VAT and deposit percents (empty allowed, two decimals, 0-100), FX rate as read-only text
  from the live FX row or "Not available right now." in EN/AR/ES, Maintenance checkbox (starts off), logo from the media
  library (PNG/JPEG/WebP, up to 1 MB) with Remove logo, her language and currency.
- **Save** (teal, the locked word) is enabled only when something changed and nothing is invalid. A colour pair under
  WCAG 4.5 (text) / 3 (large) blocks it in the browser and again on the server; gold is lines only and not checked.
  After a save the line says "Settings saved."; leaving with unsaved changes asks (Stay / Leave).
- **Owner API** `GET/POST /api/ops/settings` through `runOps` (owner session, Origin, body size, strict parse). The whole
  form is required; unknown keys are refused. The server re-checks contrast and the logo row (exists, type, size).
  Writes `site_settings` (a colour equal to its token is stored as null) and her `profiles` row (locale, currency).
  No service-role key reaches the client; the screen never imports a Supabase client.
- **Maintenance and brand reach the public site at the next publish rebuild** (owner answer 1 and 2; D-137 reworded).
  The build reads `api_site_settings` with the anon key (`scripts/assemble-cloudflare.mjs` `readBuildSiteSettings`):
  maintenance on writes the closed page over every public page; otherwise the saved colours go in as one `<style>` of
  CSS variables and the saved logo (fetched from R2, magic bytes and 1 MB checked) is copied to `/brand/logo.<ext>`.
  `/login`, `/account`, `/bookings` close at once: `middleware.ts` asks `lib/maintenance-gate.ts` (30 s cache, fails
  open) and answers 503 with the closed page. The ops host is never closed.
- **Closed page** (`lib/maintenance-document.ts`): static HTML, no script, the locked line, +971 56 388 3302 and
  inquiries@almarprivatejourney.com as links, three language links, saved colours and logo. No form, no WhatsApp,
  no Sign in, no currency control (there is no price on it, so the control would do nothing).
- **Saving maintenance or brand requests the rebuild** through the seam `lib/settings/site-rebuild.ts`
  (`requestRebuild`, a no-op until 03.2-05 lands `requestPublish({ admin })` in `lib/ops/site-update.ts`).

## Database

Migration `20261013120000_site_settings_brand.sql` (new file; no applied migration edited): colour checks
(`#rrggbb`, lower case), faces Questa/Lato only, VAT and deposit 0-100; drops the unused `logo_bytes`, `logo_type` and
job 02's `site_settings_public`; adds `logo_media_id` (references `media`, on delete restrict); creates
`api_site_settings` (security_invoker) with exactly maintenance, five colours, two faces and the logo key, select for
anon only; RLS lets anon read the singleton's public columns and the one media row that is the logo.
pgTAP `supabase/tests/site_settings_access.test.sql` (27 tests): anon reads exactly those columns and cannot write.

## 02-05 review finding 4

`/account` shows the currency the public site uses (`shownAccountCurrency`); a failed save puts the currency back.
Language keeps its 02-05 behaviour (reverting it flipped the signed AR screenshot).

## Not done

- Email (`lib/email/magic-link.ts`) and the ops shell do not take the saved colours or logo.
- Framer-exported pages take the colours only where they use the design system's CSS variables.
- The settings write and the profile write are two updates, not one transaction.

## Tests

Node: `settings`, `settings-api`, `settings-form`, `site-settings`, `account-preferences`, updated `host-gate`,
`ops-media`, `phase-03-settings`. pgTAP: `site_settings_access`. Playwright: `ops-settings.spec.ts` (3 languages x 3
widths, Save flow, logo, leave dialog), `maintenance.spec.ts` (closed page 3 x 3). Results are in `02-06-HANDOVER.md`.
