# Job 02 hand-over (Phase 2 auth chain: 02-08, 02-02, 02-03, 02-04)

Written 2026-10-01 by the cloud thread "Read loomlyne/almar and propose next steps". Stopped early on
the owner's new rule: ALMAR work runs on his Mac only. The rest continues in a Mac session.

## Branch and commits
- Branch `claude/project-thread-8h6bed`, cut from `host/cloudflare-frontsite` 31c8747, base 8cc7b4e
  merged (f0c7cef). Code tip `e30e518`; the branch tip is the commit that adds this file.
- Commits: f10f765 (02-08), 2598290 (02-02), 5b6739d (02-03), e0be58a (02-04), 393964f (summaries),
  e30e518 (review fixes). No PR. Nothing pushed to main. Nothing deployed. No SQL run anywhere.
- **Still to do: move onto main.** 3.1 is shipping to `main` as a squash and `host/cloudflare-frontsite`
  goes away. Once main has it, rebase or cherry-pick f10f765..e30e518 (plus this commit) onto
  `origin/main` (git will not see a shared base), resolve conflicts (likely in app/account,
  app/login, components/ui/nav.tsx, the ops layout, tests/phase-03-*), name the new base commit here,
  and re-run every check.

## Checks on e30e518 (cloud)
| Check | Result |
|---|---|
| `npm ci` | pass |
| `npx tsc --noEmit` | pass |
| `node --test tests/*.test.mjs` | 216 pass, 0 fail |
| `npm run tokens:check` | pass |
| `npm run build` | pass |
| Playwright `--workers=1` | stopped at 774 of 1,142 by the local-only rule. 94 failures, all `tests/journey/visual.spec.ts` screenshots (Mac baselines vs Linux fonts, known). On e0be58a the job-02 specs passed: host-gate, auth-i18n, account-select, locale-switch, whatsapp, not-found, removed-routes, phase-03-dashboard |
| Fresh security review (sign-in + DB) | done; 1 blocker + 4 items fixed in e30e518 |

## Not verified
1. Any real Supabase or Resend call (no keys in the cloud). The full magic-link loop, profile save,
   TOUCHWORD handoff and Logout-all need a Supabase project and the migration applied.
2. Screenshots: run the full Playwright on the Mac. Expected red, by design, not regenerated:
   `screens-before-after` account (6) and login (4 of 6), because /account and /login were redrawn to
   the signed canvas (6a, 6b) beyond the 0.35 guard; `tests/screens/before/` is never regenerated, so
   the owner decides. `tests/account-select/*.png` were redrawn for the hub card (re-check on the Mac).
3. Production-only paths (marketing-host 404 for /dashboard and /ops) are unit-tested, not run.

## Migration
`supabase/migrations/20260925120000_platform_spine.sql` (number reserved by the plan; coordinator to
confirm). New tables only (profiles, site_settings + read-only view, host_handoff), two triggers on
auth.users, backfill of existing users. Safe on live data: it creates, it does not change or drop.
Not applied.

## Environment names
None added. Uses NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
RESEND_API_KEY (already in `.env.example`).

## Shared files touched (coordinator to confirm)
`lib/copy/guest.ts` and `lib/copy/dashboard.ts`: additions only (auth, hub, mail, notFound, notReady,
dashboardName).

## Owner gates, one step each
1. Create the Supabase project (or name the existing one) and apply the migration.
2. Supabase Auth: turn off "Allow new users to sign up" and the password provider (admin generateLink
   still works). Review finding 4.
3. Resend: verify the sending domain for `inquiries@almarprivatejourney.com`.
4. Cloudflare: a rate-limit rule (or Turnstile) on POST `/login`. Review finding 3.
5. DNS for `dashboard.almarprivatejourney.com` and the 02-07 runtime switch.
6. `.env.local` on the Mac with the four names above.

## Owner test steps (Mac, after steps 1, 3 and 6; `npm run dev -- -H 127.0.0.1 -p 3010`)
1. Open http://127.0.0.1:3010/login, type a new email, click Access with magic link. Expected:
   Check your email; the email arrives with subject "Confirm your email".
2. Click the link. Expected: signed in, lands on /account with an empty Profile.
3. On /account type first and last name and a phone, click Save. Expected: "Saved."; reload keeps them.
4. Clear First name, click Save. Expected: "Add your name." under the field.
5. Switch Language to العربية. Expected: page is Arabic and right-to-left; reload stays Arabic.
6. Open http://dashboard.localhost:3010/ and enter a guest email. Expected: "This email cannot be used
   here." and no email sent.
7. Sign in on http://127.0.0.1:3010/login as maria@. Open the name menu, click TOUCHWORD. Expected: a
   new tab on dashboard.localhost:3010 showing "Not ready." and the full menu, with no second sign-in.
8. In that tab click Logout-all, then Sign out everywhere. Expected: the ops sign-in; reloading the
   public tab shows Login again.

## Not done
- The move onto main and the re-run of the checks on that commit.
- Screenshot sign-off for the new states (shots in /mnt/project-files/almar/job-02/screens/).
- Review notes left open: handoff start is a GET (owner-only, harmless today); login CSRF inherent to
  magic links; when ops pages start reading data, check the owner in each data call too.

## Lessons
- Owner rule 2026-10-01: ALMAR work runs locally on his Mac, never in a cloud thread.
