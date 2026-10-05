# Job 02 hand-over — Phase 2 sign-in (plans 02-02, 02-03, 02-04, 02-23 … 02-26)

Work session "gsd-phase-02-auth-chain" (Opus 5.5 lead, Sonnet executors, fresh Opus reviewers), 2026-10-04 22:03 →
2026-10-05 (+04). Replaces the cloud hand-over of 2026-10-01 (its gates and test steps are carried below, updated).

## Branch

- `gsd/phase-02-auth-chain`, T3 worktree `/Users/koss/.t3/worktrees/almarprod-Website-Code/gsd-phase-02-auth-chain`
  (app-made by the owner's launcher, not `.claude/worktrees/`).
- Cut from `origin/gsd/phase-02-server-runtime` `466ec4c` (job 10). `origin/main` merged at `ce086f5` (planning notes
  only, no conflict). Job 10's branch had not moved. Slice 1 and job 10 are not on `main` yet: after they land, this
  branch needs `origin/main` merged again (`main` wins).
- Code checked at `d20e191` (full set below). `f802695` adds two source assertions to one node test file (node suite
  rerun on it: 694, 690 pass, 0 fail, 4 skipped). The commit after it holds this file only. Folder clean.

## What moved from the cloud branch

`git cherry-pick` of the 10 commits `archive/ship-3.1..origin/claude/project-thread-8h6bed` without `f10f765`
(job 10's runtime replaced it). Conflicts and how they were solved:

| File | Solution |
|---|---|
| `components/ui/nav.tsx` | Both: job 02's account menu (`account` prop, Profile/Preferences/Account menu labels) and main's newer props (`links`, `homeHref`, `localeHrefs`, `currentPath`, `login`, `currencyNone`). Signed out with `login={false}` still hides Login |
| `app/dashboard/(ops)/layout.tsx` | Survey option A: job 02's server owner gate in `layout.tsx`; main's three W1 menu-focus fixes (one toggle with `aria-expanded`, `restoreFocusRef` + `closeMenu`, toggle in the Tab trap) ported into `ops-shell.tsx`. Kept job 02's localized `copy.dashboardName` over the fixed `DASHBOARD` mark — **owner sub-choice, not asked; say if you want `DASHBOARD` back** |
| `tests/screens/after/*.png` (12) | Kept deleted: `main` stopped tracking that folder (job 04, `.gitignore`) |
| `tests/host-gate.test.mjs` | Checks `wrangler.toml` + `wrangler.preview.toml` (`wrangler.server.jsonc` was `f10f765`'s) |

## What this session added

| Plan | What |
|---|---|
| 02-23 | First review fixes: profile row only once the email is confirmed (owner role only there); name/phone checks in the database; sign-in email limits per email (1 per 60 s, 5 per hour) and per IP (20 per hour), over the limit says "Check your email" and sends nothing; trigger functions not callable through the API. Task 3: the six sign-in paths open on Worker `almar` and `almar-preview` |
| 02-24 | Continue page (signed design): the sign-in link no longer signs in on a GET; Continue posts a server action. Masked email shown only when the server proves it |
| 02-25 | W6 Profile Sign out / Sign out everywhere wired; W7 real Destinations, Experiences, About, Contact links on `/account` and `/bookings`; W8 no currency control on `/bookings` (kept on `/account`, where it saves). W9 and sign-in submit were already done (02-03, 02-02) |
| 02-26 | Second and third review fixes: keys derived from the service-role key (read only in `lib/supabase/clients.ts`); keyed limiter hashes; IPv6 limited per /64; Continue attempts limited per IP (30 per hour) and token shape checked first; forwarded-link email check (signed design: other browser → type the full email; wrong email refused, token not spent); `__Host-` nonce cookie in production; TOUCHWORD and `/auth/handoff/start` off in production until the ops host is live (`OPS_HOST_LIVE = false` in `lib/host.ts`); Continue page referrer `same-origin` (with `no-referrer` the Continue POST answered 500: browsers send `Origin: null`; bite-checked) |
| tests | W2 nav-menu tests moved to the signed-in hub harness (`/account` needs a session); `tests/account-select/*.png` redrawn on the Mac (font anti-aliasing only, checked by eye) |

Owner answers this session (question form): `02-JOB02-DECISIONS.md` (proposed for `.planning/decisions/`).

## The six paths (controller's condition)

`git diff origin/gsd/phase-02-server-runtime -- wrangler.toml wrangler.preview.toml lib/server-routes.ts`:

```diff
--- a/lib/server-routes.ts
+++ b/lib/server-routes.ts
@@ export const HELD_PATHS = [
   "/dashboard",
-  "/account",
-  "/login",
   "/booking",
-  "/bookings",
   "/fx",
   "/newsletter",
   "/embed",
@@
-export const SERVER_PATHS_OUTSIDE_API: readonly string[] = [];
+export const SERVER_PATHS_OUTSIDE_API: readonly string[] = [
+  "/login",
+  "/auth/confirm",
+  "/auth/sign-out",
+  "/auth/handoff/start",
+  "/account",
+  "/bookings",
+];
--- a/wrangler.preview.toml
+++ b/wrangler.preview.toml
-run_worker_first = ["/api/*"]
+run_worker_first = ["/api/*", "/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]
--- a/wrangler.toml
+++ b/wrangler.toml
-run_worker_first = ["/api/*"]
+run_worker_first = ["/api/*", "/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]
```

(The comment above `SERVER_PATHS_OUTSIDE_API` changed too.) No other key in either file moved. Fail closed with no
Supabase or Resend secret on the Worker, proven on the built Worker (`tests/build/auth-paths.spec.ts`): `/login` 200
sign-in page; `/account`, `/bookings` → `/login?return=…`; `/auth/confirm` with a token → 200 Continue page, without →
`/login?expired=1`; Continue POST → `/login?expired=1`, never 500; `POST /auth/sign-out` 303 `/`; `GET /auth/sign-out`
404/405; `/auth/handoff/start` → `/` in production; the `/login` server action answers "Sign-in is not available right
now"; every server answer `x-robots-tag: noindex`; `/ar/login`, `/es/account`, `/login/x`, `/account/x`, `/auth/handoff`,
`/auth/confirm/x` stay the static 404.

## Checks on `d20e191`

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | pass |
| `node --test tests/*.test.mjs` | 693: 689 pass, 0 fail, 4 skipped (the same 4 as job 10). On `f802695`: 694, 690 pass, 0 fail, 4 skipped |
| `npm run tokens:check` | up to date |
| `npm run build` | exit 0 |
| `node scripts/assemble-cloudflare.mjs` | 57 HTML; server paths `/account, /api/health, /auth/confirm, /auth/handoff/start, /auth/sign-out, /bookings, /login` |
| `npx playwright test --workers=4` (dev config, port 3061, 01:22–02:03) | 1,889 passed, **19 failed**, 28 skipped |
| Failed files rerun alone at `--workers=1` (02:07–02:51) | `journey/rtl` 142/142; `ui/extensions` 258/258; `journey/visual` 428 + 1 failed, that one rerun alone 1/1 (a different test from the 4-worker run: load, the built-Worker suite ran at the same time); `screens-before-after` **14 failed, 10 passed** = the 14 by design below (the `booking-trip-ar-1440` failure of the 4-worker run passed) |
| Built Worker, `playwright.build.config.ts --workers=1` on `wrangler.toml` (port 8797) | **1,403 passed, 0 failed** (02:03–03:05) |
| `--target=preview` assemble + `server-runtime.spec.ts` + `auth-paths.spec.ts` on `wrangler.preview.toml` (port 8798) | 57 HTML, same seven server paths; **19 passed, 0 failed** |

Red by design, `tests/screens-before-after.spec.ts` (never regenerated; **the owner decides**): `account` 6 and `login` 4
(redrawn to canvas 6a/6b by 02-02), and `dashboard` 4 (`/dashboard` was a bare "Sign in" heading; 02-04 made it the ops
sign-in). Shots of the new states: `tests/screens/after/` after a run (ignored folder).

## Reviews (fresh Opus, every sign-in or database change)

| Pass | On | Result |
|---|---|---|
| 1 | the moved diff | 1 HIGH (unlimited sign-in emails, account at request), 2 MEDIUM, 4 LOW → plans 02-23, 02-24 |
| 2 | after 02-25 | 2 red tests (gates), 3 MEDIUM, 8 LOW → 02-26 |
| 3 | 02-26 | no BLOCKER/HIGH/MEDIUM; 4 LOW fixed (`f002606`, `d7e1d93`) |
| 4 | the LOW fixes | 2 LOW fixed (`d20e191`); one item found by the executor: `no-referrer` → `Origin: null` → 500, fixed `39a835e` |
| 5 | `d20e191` | no BLOCKER/HIGH; 1 LOW (source assertions) fixed `f802695` |

Left open on purpose: `/auth/handoff/start` is a GET (owner-only, off in production); a preview-host link points at
the live host (`lib/auth/allowed-origin.ts`, older code); masked email still shown in email mode (accepted, strictly
better than before); keys rotate with the service-role key (all links then ask for the email).

## NOT verified (plain words)

- **Nothing ran against Supabase or Resend**: no email was sent, no link was clicked, the migration was never applied.
  The whole loop is unproven until his gates and test below.
- The new SQL (limits, constraints, triggers) is checked as text only.
- That Supabase's `hashed_token` is 40–128 lowercase hex (the code assumes it; GoTrue source today: SHA-224 hex, 56).
- Which IP Supabase sees for calls from the Worker; Cloudflare CPU per sign-in request on the Free plan.
- A no-JavaScript wrong-email submit end to end (needs Supabase).
- Anything on Cloudflare itself (no deploy).

## Migration

`supabase/migrations/20260925120000_platform_spine.sql` (number confirmed by the controller). One file, edited in
place, applied nowhere. Creates only: `profiles`, `site_settings` + `site_settings_public`, `host_handoff`,
`auth_link_requests`, `auth_confirm_attempts`, the functions `handle_new_auth_user`, `handle_auth_email_change`,
`claim_link_slot`, `claim_confirm_slot`, three triggers on `auth.users`, and a backfill of confirmed users (the
owner). Safe on live data: it creates, it changes and drops nothing that exists. **Before applying**: read back that
`supabase_migrations.schema_migrations` has no `20260925120000` and that `public.profiles` does not exist (else
`create table if not exists` would keep an older shape).

## Environment names

Added: none new. Used: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY` (server code only; the browser bundle reads none). Never in a `.env` file (job 10's assembler refuses
it), never in the build shell.

## Shared files touched

`lib/copy/guest.ts`, `lib/copy/dashboard.ts`: additions only. **Not yet answered by the controller** (asked
2026-10-04; its 00:12 answer covered the migration and the six paths). `wrangler.toml`, `wrangler.preview.toml`,
`lib/server-routes.ts`: the six paths only (controller's yes). `package.json`, lockfile, tokens, `globals.css`,
`next.config.ts`: untouched.

## Proposed changes for the controller

1. STATE / board: "Job 02 (Phase 2 sign-in: 02-02, 02-03, 02-04, 02-23…02-26) handed over at `<tip>`; migration
   `20260925120000` not applied; sign-in live only after the gates below and a deploy on his word."
2. `decisions/`: add `02-JOB02-DECISIONS.md`'s rows (five answers, 2026-10-04/05).
3. `prompts/02-phase-2-auth-chain.md` step 5: gate "Cloudflare rate limit on POST /login" becomes optional (the app
   now limits); if kept, it should cover every POST with a `Next-Action` header on the six paths, not `/login` only.
4. Later job (v1.1 or minimal ops): a scheduled cleanup of never-confirmed `auth.users` rows and old limiter rows.
   Live rows are never deleted by a session: his step.
5. Ops host (gate 6): `dashboard.almarprivatejourney.com` cannot run on Worker `almar` as configured
   (`run_worker_first` is per path for every host): it needs its own Worker config with every path through Next, then
   `OPS_HOST_LIVE = true`.

## The owner's gates, one numbered step each, in this order

1. Controller: name the Supabase project and apply the migration verbatim, read back (his word first).
2. Supabase dashboard → Authentication → Providers / Sign In: "Allow new users to sign up" off, Email password sign-in
   off. (Guests still get accounts: ALMAR makes them with the admin link, which does not check that switch — read in
   Supabase Auth's source 2026-10-04.)
3. Resend → Domains: verify `almarprivatejourney.com` for `inquiries@almarprivatejourney.com`.
4. His terminal: `~/.almar/dev.env` with the four names (he types the values; nobody prints them).
5. (Optional, see proposal 3) Cloudflare rate-limit rule.
6. Later, his call: ops host DNS and its Worker.

## The owner's test (Mac, after gates 1–4)

Start, in this folder: `set -a; source ~/.almar/dev.env; set +a; npm run dev -- -H 127.0.0.1 -p 3010`

1. Open http://127.0.0.1:3010/login, type a new email, click Access with magic link. Expected: "Check your email"; an
   email "Confirm your email" from `inquiries@almarprivatejourney.com`.
2. Click the link in the same browser. Expected: "One more step", "Continue to sign in to ALMAR as x•••@…", no email
   field. Click Continue. Expected: `/account` with an empty Profile.
3. Type first and last name and a phone, click Save. Expected: "Saved."; reload keeps them.
4. Clear First name, click Save. Expected: "Add your name." under the field.
5. Switch Language to العربية. Expected: Arabic, right to left; reload stays Arabic.
6. In the header click Destinations. Expected: the Destinations page (no `#` link). Open `/bookings`. Expected: no
   currency control.
7. Click Send again (or ask again) twice within a minute for the same email. Expected: the page says "Check your
   email" both times; only one new email arrives.
8. Ask for a link, then open it in a private window. Expected: the email field and "This link was opened in a
   different browser…". Type another email, Continue. Expected: "This email does not match the link." Type the right
   one. Expected: signed in.
9. Open http://dashboard.localhost:3010/ and enter a guest email. Expected: "This email cannot be used here." and no
   email sent.
10. Sign in on http://127.0.0.1:3010/login as `maria@almarprivatejourney.com`. Open the name menu, click TOUCHWORD.
    Expected: a new tab on `dashboard.localhost:3010` with "Not ready." and the full menu, no second sign-in.
11. In that tab click Logout-all, then Sign out everywhere. Expected: the ops sign-in; reloading the public tab shows
    Login again.

## Lessons

- Executors must run the full node suite before reporting, not the files they touched: two red tests slipped past
  hand-picked runs (02-24, 02-23 task 3); found by the second review.
- A security header can break a security check: `Referrer-Policy: no-referrer` made browsers send `Origin: null`, which
  Next's server-action origin check cannot parse (500). Prove a form POST on the real page, not only in the harness.
- Supabase admin `generateLink` creates users even with sign-ups off: the "sign-ups off" gate does not limit ALMAR's
  own link flow; the app's limits do.
