# Plan 02-23 Summary (Tasks 1 and 2 only)

Task 3 (server-routes, wrangler, build spec) was not done, by instruction.

## What changed

Migration `supabase/migrations/20260925120000_platform_spine.sql` (edited in place, applied nowhere):
- `handle_new_auth_user()` inserts a profile only when `email_confirmed_at` is not null; owner role only on that path.
- New trigger `on_auth_user_confirmed` (after update of email_confirmed_at, old null -> new not null).
- Backfill selects confirmed users only.
- Constraints: first/last name `char_length <= 80`, phone null or `^\+?[0-9]{6,15}$`. `app/account/actions.ts` already saves `phone || null`, so `''` is not allowed in SQL.
- `auth_link_requests` (RLS on, all revoked, two indexes) and `claim_link_slot` (security definer, `search_path = ''`, advisory xact lock on the email hash, 60 s / 5 per hour per email / 20 per hour per IP, deletes rows older than a day, execute for service_role only).
- Execute revoked from public, anon, authenticated on both trigger functions.

App:
- `lib/auth/send-link.ts`: dep `claimSlot(email)`, called after the email check and the ops refusal, before `accountExists`. False returns `sent` with nothing generated or sent. A thrown error returns `unavailable` (fail closed).
- `lib/auth/magic-link-server.ts`: SHA-256 of the email and of the IP (first `x-forwarded-for` entry, else `"none"`), rpc `claim_link_slot`; error or non-boolean data throws. Nothing logged.
- `lib/auth/server-paths.ts` (new): `JOB02_SERVER_PATHS`, the six paths including `/auth/handoff/start` (finding 12). Task 3 should read it.
- Finding 4: matcher test in `tests/auth-magic-link.test.mjs`, every path (and `/ar`, `/es` forms) matches the middleware matcher.

Tests extended: `tests/auth-magic-link.test.mjs`, `tests/migration.test.mjs`; `tests/auth-owner.test.mjs` fake deps got `claimSlot` (it broke otherwise).

## Verified

- `npx tsc --noEmit`: exit 0.
- `node --test tests/auth-magic-link.test.mjs tests/migration.test.mjs tests/auth-owner.test.mjs`: 38 tests, 38 pass, 0 fail.

## Not verified

SQL never run (no database): the function and constraints are checked by text only. Build, assembler, Playwright not run.

## Deviations

- [Rule 3] `tests/auth-owner.test.mjs` updated for the new dep (not named in the task).
- The "paths job 02 opens" list did not exist in code; created `lib/auth/server-paths.ts` for it. `lib/server-routes.ts` untouched.
- Untracked `app/auth/confirm/continue-screen.tsx` and `tests/journey/scenes/auth-continue.tsx` were present in the worktree and are not mine; left uncommitted.

## Task 3: the six sign-in paths open on the Worker

Commits: d205f72 (feat: paths, both wrangler files), 42fd16b (test: build spec, held-list flip, three-place test).

- `/login`, `/auth/confirm`, `/auth/sign-out`, `/auth/handoff/start`, `/account`, `/bookings` left HELD_PATHS
  (`/dashboard`, `/booking`, `/fx`, `/newsletter`, `/embed`, `/__harness` stay held) and joined
  SERVER_PATHS_OUTSIDE_API and `run_worker_first` in both wrangler files. No other key in either toml moved.
- One source of truth: `tests/server-runtime.test.mjs` asserts SERVER_PATHS_OUTSIDE_API equals JOB02_SERVER_PATHS
  and that both `run_worker_first` lists are `/api/*` plus those six; none is held, with or without a locale prefix.
- New `tests/build/auth-paths.spec.ts` (9 tests) on the built Worker with no Supabase/Resend settings bound:
  /login 200 sign-in page; /account and /bookings redirect to `/login?return=...`; /auth/confirm with
  `token_hash` and `type` gives the Continue page, without or with a bad type redirects to `/login?expired=1`;
  /auth/handoff/start (no session) 303 to `/` with no-store (it goes home, not to sign-in: existing app
  behaviour, unchanged); POST /auth/sign-out 303 to `/`; a real browser submit on /login posts the server action,
  gets 200 with noindex and shows "Sign-in is not available right now"; `x-robots-tag: noindex` on every server
  response; `/ar/login`, `/es/account`, `/login/x`, `/account/x`, `/auth/handoff`, `/auth/confirm/x` still answer
  the static 404. No 500 was found; no app code changed.
- Results: node tests 62/62 (server-runtime, host-gate, auth-magic-link); tsc clean; build specs 19/19 on
  wrangler.toml (out/) and 19/19 on wrangler.preview.toml (out-preview/), each running server-runtime.spec.ts
  and auth-paths.spec.ts with one worker. Assembler server paths: /account, /api/health, /auth/confirm,
  /auth/handoff/start, /auth/sign-out, /bookings, /login.

### git diff origin/gsd/phase-02-server-runtime -- wrangler.toml wrangler.preview.toml lib/server-routes.ts

```diff
diff --git a/lib/server-routes.ts b/lib/server-routes.ts
index 798bda2..db9a431 100644
--- a/lib/server-routes.ts
+++ b/lib/server-routes.ts
@@ -19,10 +19,7 @@
  */
 export const HELD_PATHS = [
   "/dashboard",
-  "/account",
-  "/login",
   "/booking",
-  "/bookings",
   "/fx",
   "/newsletter",
   "/embed",
@@ -30,10 +27,18 @@ export const HELD_PATHS = [
 ] as const;
 
 /**
- * Exact server paths outside /api. Empty in job 10. Known future users: slice 3 plan 27 (`/newsletter`, moved out
- * of HELD_PATHS in the same commit) and Phase 2's sign-in.
+ * Exact server paths outside /api. Phase 2's sign-in (plan 02-23 task 3): the same six as JOB02_SERVER_PATHS in
+ * lib/auth/server-paths.ts (tests/server-runtime.test.mjs asserts they are equal). Known future user: slice 3
+ * plan 27 (`/newsletter`, moved out of HELD_PATHS in the same commit).
  */
-export const SERVER_PATHS_OUTSIDE_API: readonly string[] = [];
+export const SERVER_PATHS_OUTSIDE_API: readonly string[] = [
+  "/login",
+  "/auth/confirm",
+  "/auth/sign-out",
+  "/auth/handoff/start",
+  "/account",
+  "/bookings",
+];
 
 const LOCALE_PREFIXES = ["/ar", "/es"];
 
diff --git a/wrangler.preview.toml b/wrangler.preview.toml
index 3c450f8..9301823 100644
--- a/wrangler.preview.toml
+++ b/wrangler.preview.toml
@@ -14,7 +14,7 @@ preview_urls = false
 [assets]
 directory = "./out-preview"
 binding = "ASSETS"
-run_worker_first = ["/api/*"]
+run_worker_first = ["/api/*", "/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]
 html_handling = "auto-trailing-slash"
 not_found_handling = "404-page"
 
diff --git a/wrangler.toml b/wrangler.toml
index 4cd953e..54eb7ad 100644
--- a/wrangler.toml
+++ b/wrangler.toml
@@ -11,7 +11,7 @@ preview_urls = false
 [assets]
 directory = "./out"
 binding = "ASSETS"
-run_worker_first = ["/api/*"]
+run_worker_first = ["/api/*", "/login", "/auth/confirm", "/auth/sign-out", "/auth/handoff/start", "/account", "/bookings"]
 html_handling = "auto-trailing-slash"
 not_found_handling = "404-page"
 
```
