# Hand-over: dashboard sign-in for Koss + dashboard /login

Work session `local_0187ed55-1f22-415f-ad8c-0b8dca4ec2f1`, 2026-10-19 11:26 +0100. Branch `claude/owner-emails-login`, cut from
`origin/main` f9d7cb1. Folder `.claude/worktrees/owner-emails-login`, clean after the commit.

## Owner's ask (2026-10-19)
"get the URLs for the dashboard … working correctly, like the login for dashboard.almarprivatejourney.com/login. And I want
to be able to sign in with koussayzayeni@gmail.com as well as maria@."

## Live findings (read-only, 2026-10-19 ~11:15 +0100)
1. `koussayzayeni@gmail.com` on dashboard sign-in -> "This email cannot be used here.": the owner was one hardcoded email
   (`OWNER_EMAIL`, maria@) in code and in the DB trigger.
2. Live `auth.users` has **no** user for koussayzayeni@gmail.com (maria@ exists, confirmed, role owner).
3. `https://dashboard.almarprivatejourney.com/login` -> 404 (the dashboard sign-in is `/sign-in`).
4. Live `almar-ops` was last deployed 2026-10-11 14:17 UTC (version 1ef92954). `/content/media` and `/content/navigation`
   are 404 live although they are on `main`; every other section answers 307 -> /sign-in as expected.

## What changed
- `lib/auth/rules.ts`: `OWNER_EMAILS = [maria@…, koussayzayeni@gmail.com]`; `isOwnerEmail` checks the list (so the
  middleware, `/auth/handoff`, `isOwnerProfile`, `require-owner` all accept both). `OWNER_EMAIL` stays (maria@).
- `lib/auth/send-link.ts` / `lib/auth/magic-link-server.ts`: `ownerEmails` list instead of one `ownerEmail`; the ops refusal
  uses the list. D-42 unchanged: an owner address with no auth user still gets "sent" and nothing is sent.
- `supabase/migrations/20261019120000_owner_emails.sql`: `handle_new_auth_user` gives role owner to both addresses; an
  existing confirmed profile of either address is set to owner. Safe on live data: one function replaced, at most one row
  updated (today zero: Koss has no auth user). No table or column change.
- `worker/almar-ops.mjs`: `/login` on the ops host -> 308 `/sign-in` (query kept); exact path; never reaches Next.
- Tests: `tests/auth-owner.test.mjs` (Koss sign-in, list = trigger list), `tests/ops-runtime.test.mjs` (/login 308),
  `ownerEmails` in `auth-magic-link`, `auth-continue`.

## Checks on the commit
- `node --test tests/*.test.mjs`: 1,939 tests, 1,899 pass, 0 fail, 40 skipped.
- `npx tsc --noEmit`: exit 0.
- NOT run (need the controller's slot go): `npm run build`, `npm run tokens:check`, Playwright, `npm ci` (node_modules was
  linked from `check-p19`, same lockfile assumed, not verified).

## Controller steps
1. Review + PR + verifier as usual; Ship lands it.
2. Apply `20261019120000_owner_emails.sql` live verbatim, read back the function.
3. Create the auth user `koussayzayeni@gmail.com` (Supabase dashboard -> Authentication -> Add user, auto-confirm, no
   password) per D-42; the trigger makes the owner profile. Read back `profiles.role = 'owner'`.
4. Deploy `almar-ops` from the landed `main` (build `--target=ops` right before) on his deploy word: this also brings the
   Media and Navigation pages live.

## Owner test steps (after steps 2-4)
1. Open `https://dashboard.almarprivatejourney.com/login` -> lands on `/sign-in`.
2. Type `koussayzayeni@gmail.com`, press Access with magic link -> "Check your email"; the email arrives; the link opens the
   dashboard Home.
3. Sign out, repeat with `maria@almarprivatejourney.com` -> same.
4. Type any other email -> "This email cannot be used here."
5. Open Content -> Media and Content -> Navigation -> each page shows (no 404).
