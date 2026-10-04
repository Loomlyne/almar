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
