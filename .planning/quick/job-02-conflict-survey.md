# Job 02 conflict survey: Phase 2 auth chain onto `main`

Survey only. Nothing was resolved that needs a decision, nothing pushed, deployed, or applied.

- Surveyed against `origin/main` = `864fe49ca05058e0f7e9b5b7bb3aa959fca141e7` ("docs(control): the markup-only footer Contact fix is broken; do not land it").
- Date/time: 2026-10-02 13:09 +04 (fetch), survey finished about 13:45 +04.
- Source: `origin/claude/project-thread-8h6bed` tip `3e2d58c`, merge-base with main `014ae37`.
- Worktree `.claude/worktrees/job-02-survey`, branch `survey/job-02-conflicts` (no suffix needed). A local scratch branch `survey/scratch-apply` in the same worktree holds the 11 commits applied cumulatively. It is NOT a resolution (see row 8). Delete it when done reading.
- Method: first each commit alone against main with `--abort` (to see raw conflicts), then cumulatively in order (the real picture, because later commits depend on earlier ones).

## Key background fact

The auth branch is not "pre-3.1". Its base already contains Phase 3.1 as 29 granular plan commits. `main` has the same 3.1 as one squash (`9fd6786`, PR #3). Tree comparison of the auth branch base (`9d170d5^`) against `9fd6786`, excluding `.planning`, differs in only 11 files, all review fixes added to main during landing: `app/dashboard/(ops)/layout.tsx`, `components/ui/{calendar,nav,stepper}.tsx`, `lib/https-url.ts` (new), `app/dashboard/(ops)/{catalog,content}/*-screen.tsx`, `tests/https-url.test.mjs`, `tests/phase-03-{catalog,content}.test.mjs`, `tests/review-fixes.spec.ts`. Main then moved on with job 04 (repo tidy, Framer `route.ts` link fixes, deleted tracked `tests/screens/after/`, new `.gitignore` lines, `wrangler.toml` account pin). So the screens (login, account, bookings, dashboard) are identical on both sides except the one dashboard layout file; that is why almost everything applies clean.

## Table

"Alone" = cherry-picked on top of `origin/main` by itself. "In order" = after the earlier ones are applied (the real result).

| # | Commit | Alone | In order | Conflicted paths | Mechanical or decision |
|---|---|---|---|---|---|
| 1 | 9d170d5 docs re-check | clean | clean | | n/a |
| 2 | 6440aeb docs owner answers A/B | clean | clean | | n/a |
| 3 | a0c02dd docs revise 02-02/03/04 | clean | clean | | n/a |
| 4 | f10f765 feat(02-08) server runtime config | CONFLICT | CONFLICT | `.gitignore` | Mechanical. Resolved by me (see below) |
| 5 | 4155797 docs align with discuss refresh | clean | clean | | n/a |
| 6 | 2598290 feat(02-02) magic link, hub, bookings | CONFLICT | CONFLICT | 12 PNGs `tests/screens/after/{account,login}-{en,ar}-{390,834,1440}.png` (modify/delete) | Mechanical. Resolved by me (see below) |
| 7 | 5b6739d feat(02-03) language cookie | CONFLICT (cascade: `app/account/page.tsx`, `app/bookings/page.tsx`, `app/login/page.tsx`, `lib/copy/guest.ts`) | clean | none in order | The alone conflicts exist only because 2598290 was absent. Clean once 02-02 is in |
| 8 | e0be58a feat(02-04) ops host, owner gate | CONFLICT (cascade: 7 delete/modify on `app/auth/confirm/route.ts`, `app/login/actions.ts`, `lib/auth/*`, `middleware.ts`, plus 2 real) | CONFLICT | `app/dashboard/(ops)/layout.tsx` (content). `app/login/sign-in-screen.tsx` conflicts only alone, clean in order | NEEDS A (SEMANTIC) MERGE, not a design choice. I did NOT resolve it |
| 9 | 393964f docs summaries | clean | clean | | n/a |
| 10 | e30e518 fix review findings | CONFLICT (cascade, 11 delete/modify) | clean | none in order | Clean in order |
| 11 | 3e2d58c docs hand-over | clean | clean | | n/a |

Counts: 11 commits. In order, 8 apply clean and 3 conflict (f10f765, 2598290, e0be58a). Two of those 3 are purely mechanical, one is a real semantic merge. Alone (without predecessors), 6 of 11 conflict, but 3 of those 6 are pure cascade.

### What each conflict is

**f10f765, `.gitignore`.** Main (job 04) appended `.DS_Store`, `.claude/worktrees/`, `.env`, `.env.*`, `!.env.example`, `.dev.vars`. The auth commit appended `/.open-next/` at the same spot. Both want to add lines at end of file. Resolved by keeping both (removed the three conflict marker lines, nothing else). Mechanical, certain.

**2598290, 12 PNGs.** Auth commit regenerated `tests/screens/after/{account,login}-*.png` (the redrawn /login and /account). Job 04 (`97005a0`) deleted the whole tracked `tests/screens/after/` folder and put it in `.gitignore`. Resolved by `git rm --cached` of all 12 (accept the deletion, as `.gitignore` says these are build output). Mechanical, certain. Side note: the same commit also rewrote four tracked baselines `tests/account-select/{ar,en}-{closed,open}.png` (clean apply, but they were produced on Linux in the cloud; see decision 4).

**e0be58a, `app/dashboard/(ops)/layout.tsx`.** Real content conflict.
- Auth side: turns `layout.tsx` into a small server component (force-dynamic, reads `x-almar-shell` header, 404 on marketing host in production, redirects non-owners to `/sign-in`, renders `<OpsShell mode=...>`) and moves the whole client rail/menu code into the new `ops-shell.tsx`. That new file is a copy of the OLD (pre-review-fix) layout plus `mode`, Sign out and Logout-all dialogs, and clean-URL hrefs on the ops host.
- Main side: the same client layout, but with three review fixes added on landing: (a) one always-mounted Menu/Close toggle button with `aria-expanded={menuOpen}` instead of two swapped buttons; (b) focus returns to the toggle through a `restoreFocusRef` plus effect and `closeMenu()`; (c) the toggle is included in the Tab focus trap. Pinned by `tests/review-fixes.spec.ts` "W1 dashboard phone menu" (4 tests on `/dashboard/home`).
- Why it needs care: a naive "take auth" silently drops the three fixes (and W1 would fail); a naive "take main" drops the owner gate. The right result is auth's `layout.tsx` plus the three fixes ported into `ops-shell.tsx`. Also a second small difference: main keeps `const INTERIOR_MARK = "DASHBOARD"` (not translated); auth replaced it by `copy.dashboardName` (EN Dashboard, AR لوحة التحكم, ES Panel; new keys in `lib/copy/dashboard.ts`) and updated `tests/phase-03-dashboard-shell.test.mjs`.
- For the survey only, I took the auth side of this file so the later commits could be applied (`git checkout --theirs`). That is a scratch convenience, not a recommendation, and it exists only on `survey/scratch-apply`.

## Resolved by me (full list)

1. `.gitignore` (f10f765): kept both sides' added lines.
2. 12 PNGs under `tests/screens/after/` (2598290): `git rm --cached`, i.e. accepted main's deletion.
3. `app/dashboard/(ops)/layout.tsx` (e0be58a): took the auth side, for the survey only, to continue. Not a valid resolution (loses the three review fixes). Everything is in the scratch branch only.

## Compile check

All 11 applied in order on the scratch branch. `npx tsc --noEmit` (using a temporary symlink to the main checkout's `node_modules`, removed afterwards) passed with no errors. No tests, no Playwright, no `next build` were run.

## Decisions the owner or an Opus lead must make (most consequential first)

1. **Runtime of the live Worker.** Live `almar` is a static-assets Worker (`wrangler.toml`, `assets = ./out`, built by `scripts/assemble-cloudflare.mjs`, which copies only prerendered `.body` files). The auth chain needs a server: `middleware.ts` plus ten force-dynamic routes and pages (`/login`, `/account`, `/bookings`, `/dashboard`, `/auth/confirm`, `/auth/sign-out`, `/auth/handoff`, `/auth/handoff/start`, ops layout, server actions). A static deploy of merged main would stop serving /login, /account, /bookings (they exist static today) and would not run the host gate. Option A: land the auth code dormant, keep deploying static, accept that the guest screens go dark or stay on an older deploy until the runtime switches. Option B: land it together with the plan 02-07 owner step (switch `almar` to the OpenNext server runtime via `wrangler.server.jsonc` plus routes, secrets, and an R2 cache decision, and the `dashboard.` DNS), so nothing regresses. (Not verified by a build; see "could not determine".)
2. **When and where the migration is applied.** It is owner-gated and goes to a live Supabase project that has no app wiring yet. Option A: apply to the existing ALMAR project (created in plan 02-01) after the control session reads its current tables read-only. Option B: apply to a fresh or branch project first, then promote.
3. **Dashboard shell merge (e0be58a).** Option A (recommended): auth `layout.tsx` plus the three review fixes ported into `ops-shell.tsx`. Option B: auth as it stands and accept losing the fixes and the W1 specs. Sub-choice: keep the localized `copy.dashboardName` (auth) or the fixed English `DASHBOARD` mark (main).
4. **Screenshot baselines.** Auth redrew /login and /account beyond the 0.35 guard in `screens-before-after`, and rewrote `tests/account-select/*.png` on Linux. Option A: regenerate those four baselines on the Mac and decide about `tests/screens/before/`. Option B: keep main's baselines and let the specs go red until the screens are re-signed.
5. **Owner identity.** `maria@almarprivatejourney.com` is hard-coded in the migration (role owner) and in `lib/auth/rules.ts` (`OWNER_EMAIL`). Option A: keep it hard-coded as the plans say. Option B: move it to a setting before it ships. Either way the owner must confirm the address, and her auth user must exist first (made in the Supabase dashboard).
6. **Who may sign up.** The magic link creates the account for any new guest email via admin `generateLink`. Handover says the owner must turn off "Allow new users to sign up" and the password provider in Supabase Auth (admin generateLink still works), verify the Resend domain for `inquiries@almarprivatejourney.com`, and add a Cloudflare rate-limit or Turnstile on POST `/login`. Decision: do these before landing or before deploying.
7. **Commit shape.** Land the 11 commits squashed into one code commit (matches the board's one-commit rule), or keep the 5 `.planning` docs commits as separate planning notes. The docs commits only add or edit files under `.planning/phases/02-platform-spine/`.

## Migration: `supabase/migrations/20260925120000_platform_spine.sql` (129 lines)

Added by 2598290, edited by e30e518. Not applied anywhere. Not run by me.

Creates, in schema `public`:
- `profiles` (id uuid pk references `auth.users` on delete cascade, email unique not null, first_name, last_name, phone, locale check en/ar/es default en, currency check AED/USD/EUR default AED, role check guest/owner default guest, created_at). RLS on. Policies: `profiles: read own row` (select to authenticated, `id = auth.uid()`), `profiles: update own row` (update to authenticated, using and with check `id = auth.uid()`). Privileges: `revoke all ... from public, anon, authenticated`, then `grant select` to authenticated and `grant update (first_name, last_name, phone, locale, currency)` only. So a guest cannot change role or email, cannot insert or delete.
- Function `handle_new_auth_user()` (security definer, `search_path = ''`) and trigger `on_auth_user_created` after insert on `auth.users`: inserts a profile; role `owner` if lower(email) = `maria@almarprivatejourney.com`, else guest; `on conflict do nothing`.
- Function `handle_auth_email_change()` (security definer, empty search_path) and trigger `on_auth_user_email_changed` after update of email on `auth.users`: updates `profiles.email`; never touches role.
- Backfill: inserts a profile for every existing `auth.users` row with an email, `on conflict do nothing`.
- `site_settings`: singleton (`id int check (id = 1)`), colour and font columns, `vat_percent`, `deposit_percent`, `maintenance`, `logo_bytes bytea`, `logo_type`. RLS on, no policies, all privileges revoked (service role only). No seed row. Nothing in the app reads or writes it yet.
- View `site_settings_public` with `security_invoker = false` (owner-rights view), selecting the non-logo columns; `revoke all` then `grant select` to anon and authenticated. Readable by the public, so VAT, deposit percent and maintenance flag become public (intended). Supabase's advisor will flag a security-definer view (lint "security_definer_view"); it is deliberate here to expose a fixed column list through a table with no policies.
- `host_handoff` (token_hash text pk, user_id references `auth.users` on delete cascade, expires_at, used_at). RLS on, no policies, all privileges revoked (service role only).

Destructive check:
- No `DROP TABLE`, `TRUNCATE`, `DELETE`, or `ALTER TABLE` that changes or drops columns or data. The only `alter table` statements are `enable row level security` on its own three new tables.
- `drop policy if exists` and `drop trigger if exists` only name this file's own policies and triggers. The `on delete cascade` foreign keys mean deleting an `auth.users` row deletes that person's profile and handoff rows (intended).
- Handover's claim "creates, does not change or drop" is accurate for a project where these names do not exist. Real risks to check before applying:
  1. `create table if not exists`: if a `public.profiles`, `site_settings` or `host_handoff` already exists in the target project with a different shape, creation is skipped silently, but the `revoke all` and `grant` statements and policies still apply to the existing table and can strip its current access. Read the target's table list first (read-only).
  2. `create or replace function` with the same names would overwrite functions of those names if they exist.
  3. It adds triggers on Supabase-owned `auth.users`. Needs a role that may do that (the default migration role normally can).
  4. Unique `profiles.email` plus the email-change trigger means an email change to an address already in `profiles` would fail inside Auth.
  5. The owner role is granted by email match at user creation. Safe only because her user is created in the dashboard first and sign-in needs mailbox access.
  6. Not idempotent for grants/policies beyond the `drop ... if exists` guards, and there is no down migration.

`tests/migration.test.mjs` (7 tests, reads the SQL with comment lines stripped, string and regex checks only, never runs SQL): (1) no `storage.` and no word "password"; (2) `enable row level security` for profiles, site_settings, host_handoff; (3) the exact column-level `grant update (first_name, last_name, phone, locale, currency)` and no grant update touching role or email, and no grant insert/delete/all to anon or authenticated; (4) site_settings_public is revoked before it is granted select, no write grants on it, and `revoke all ... from public, anon, authenticated` on all three tables; (5) the email-change function only updates `profiles.email` and its body does not mention role, and the trigger is `after update of email on auth.users`; (6) host_handoff stores `token_hash text primary key` and has no raw `token text`; (7) the public view does not include `logo_bytes`.

## Files touching money, auth, sessions, cookies or secrets

Money: none. No Stripe, no payment, no price code is added. The only money-adjacent items are the `vat_percent` and `deposit_percent` columns in the migration (unused by code) and `profiles.currency` (a display preference), plus `lib/format.ts` (+7 lines, a digit helper).

Auth, sessions, cookies, secrets (added or changed by the 11 commits):
- `middleware.ts` refreshes the Supabase session on each request that carries an `sb-*-auth-token` cookie (via `getUser`), sets the ops-host shell header (drops any client-sent copy), and routes by host.
- `lib/host.ts` pure ops/marketing host routing, `x-almar-host` override ignored in production, ops origin for the handoff.
- `lib/supabase/clients.ts` the only reader of `SUPABASE_SERVICE_ROLE_KEY` (guarded by `tests/secrets.test.mjs`); creates the session client, the admin client, and `readSessionProfile` (uses `getUser`, not `getSession`).
- `lib/auth/rules.ts` owner email constant, email and path validation, `safeReturnPath` open-redirect guard, cookie names (`almar-return`, `almar-locale`), profile validation, `isOwnerProfile`.
- `lib/auth/send-link.ts` pure magic-link decision logic (ops host refuses non-owner, owner account must pre-exist).
- `lib/auth/magic-link-server.ts` wires admin `generateLink` and Resend; reads `RESEND_API_KEY`; sender `inquiries@almarprivatejourney.com`.
- `lib/auth/allowed-origin.ts` allowlist so the link origin never trusts the raw Host header.
- `lib/auth/handoff.ts` TOUCHWORD token: 32 random bytes, SHA-256 stored, five minutes.
- `lib/auth/nav-account.ts` which nav state to show; `lib/email/magic-link.ts` the sign-in email template.
- `app/login/actions.ts` server action; sets httpOnly `almar-return` cookie (1 h, lax, secure in production) and sends the link.
- `app/auth/confirm/route.ts` redeems the emailed `token_hash` with `verifyOtp`, sets the session cookies, no redirect target from the query.
- `app/auth/sign-out/route.ts` local sign-out. `app/auth/handoff/start/route.ts` issues a one-time handoff (service role, owner only). `app/auth/handoff/route.ts` redeems it on the ops host and signs the owner in there.
- `app/account/actions.ts` saves profile (names, phone) and preferences under her own session and RLS; sets `almar-locale` cookie (1 year).
- `app/dashboard/actions.ts` ops sign-in (owner email only) and Logout-all (`signOut` scope global).
- `app/dashboard/(ops)/layout.tsx` and `app/dashboard/page.tsx` owner gate: `notFound()` on the marketing host in production, redirect to `/sign-in` unless `isOwnerProfile`.
- `app/login/page.tsx`, `app/account/page.tsx`, `app/bookings/page.tsx` are now force-dynamic and session-gated (account and bookings redirect to `/login?return=...`).
- `lib/request-locale.ts` reads the locale cookie; `components/document-locale.tsx`, `app/not-found.tsx` follow it.
- `supabase/migrations/20260925120000_platform_spine.sql` (above).
- `open-next.config.ts`, `wrangler.server.jsonc` server runtime config for build only; no routes, no secrets, no R2. `package.json` gains `host:server` and `preview:server` scripts only.
- Guard tests: `tests/secrets.test.mjs`, `tests/phase-02-gates.test.mjs`, `tests/host-gate.test.mjs`, `tests/auth-owner.test.mjs`, `tests/auth-magic-link.test.mjs`.

## Secrets in the diff

None found. Checked all added lines of the whole branch diff against main (excluding PNGs) for JWT-like `eyJ...`, `re_...`, `sk_live`/`sk_test`, `sbp_`, `sb_secret`/`sb_publishable`, and any 40+ character token: no hits. No file named `.env*`, `.dev.vars`, `.pem` or `.key` is added. Only env variable names appear in code.

`.env.example` gains nothing. The branch does not touch it. It already holds (from 3.1) four empty names: `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`, `RESEND_API_KEY=`. `wrangler.server.jsonc` states it has no secrets.

## `tests/phase-02-gates.test.mjs` (added by f10f765; 7 tests, not 6)

1. `package.json` has no script name or command containing "vercel". 2. `wrangler.toml` does not name `dashboard.almarprivatejourney.com`. 3. `next` stays exactly `15.5.26`. 4. `app`, `components`, `lib` contain no `eyJ` or `re_` strings (key material). 5. `wrangler.server.jsonc` names `almar`, main `.open-next/worker.js`, no `routes`/`route`, no `r2_buckets`, no dashboard host, has `nodejs_compat`. 6. `host:server` runs `opennextjs-cloudflare build` and contains none of deploy/upload/preview. 7. `open-next.config.ts` uses `defineCloudflareConfig` and sets no `output:` static export. Note: gate 2 and the vercel check duplicate tests already on main in `tests/host-config.test.mjs` (job 04); gate 4's `re_` needle matches any text containing "re_" (a false-positive risk, passed in the cloud).

## What Phase 3.1 changed under the same screens (which side is newer)

- 3.1 (squash `9fd6786`, landed 2026-10-02) created, as Tailwind-v4 utility screens on the token set: `app/login/{page,sign-in-screen}.tsx`, `app/account/{page,account-screen}.tsx`, `app/bookings/{page,bookings-screen}.tsx`, `app/dashboard/page.tsx`, the whole `app/dashboard/(ops)/` tree (layout, 13 section pages and their `*-screen.tsx`), `components/ui/{nav,footer}.tsx`, and `lib/copy/{guest,dashboard,index,home,journey,framer-source}.ts` (typed EN/AR/ES copy with `copy[locale]`). The auth commits were written on top of the same 3.1 code (the auth branch base contains it), so on those screens the two sides agree and the auth commits are strictly newer additions.
- Where `main` is newer than the auth branch's 3.1 copy: only the 11 landing review-fix files listed above. The ones that overlap auth edits: `app/dashboard/(ops)/layout.tsx` (conflict) and `components/ui/nav.tsx` (auth adds the account menu and the Login/account state, main fixes focus return on close and the Escape-in-Language-list case; the two merged without a textual conflict and compile, but both touch the same menu code, so run `tests/review-fixes.spec.ts` and the nav specs).
- Where the auth side is newer: login (single email field, no create tab, split screen), account hub (saves profile and preferences for real, language and currency follow the account), bookings (session gate), the language cookie on login/account/bookings/404, ops host and owner gate, Sign out and Logout-all in the ops rail, new keys in `lib/copy/{guest,dashboard}.ts` (additions only, applied clean).
- Since 3.1, main also did job 04: deleted tracked `tests/screens/after/` (source of the 12 PNG conflicts), pinned the Cloudflare account in `wrangler.toml`, `.gitignore` additions, Framer `route.ts` link edits, `tests/no-dead-links.test.mjs`, `tests/json-ld-domain.test.mjs`, `tests/host-config.test.mjs`. None of these touch the auth files.

## What I could NOT determine

- Whether the static build still produces the guest pages: I did not run `next build` or `assemble-cloudflare`. Decision 1 rests on reading the assemble script (it copies only prerendered `.body` files) and the `force-dynamic` exports. The cloud build passed, but that was `next build`, not the static assemble.
- Test results of any kind. `node --test` (the cloud ran 216 pass before main's job 04 tests were added), Playwright, and token checks were not run on the merged state. In particular unknown: `tests/no-dead-links.test.mjs` against the new routes, `tests/phase-03-*` tests that grep layout or screen source after the ops layout split, and the redrawn-screen specs.
- Whether `tsc` passed against the correct dependency set: `node_modules` came from the main checkout; `package.json` and the lockfile are unchanged by the branch, so it should match, but it was not a clean install.
- Anything live: no Supabase, Resend, Cloudflare, or DNS call was made. Whether the Supabase project from plan 02-01 exists, its current tables, its Auth settings, or whether the Resend domain is verified is unknown.
- Whether the target Supabase project already has tables or functions named in the migration.
- The three owner-test claims in the cloud hand-over (magic-link loop, TOUCHWORD handoff, Logout-all) were never run against real services.
