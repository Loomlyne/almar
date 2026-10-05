---
phase: 02-platform-spine
plan: "02"
status: complete
completed: 2026-10-01
---

# 02-02 Summary: magic link, account hub, session-gated bookings

Commit `2598290`. Follows the plan's REVISED 2 block (owner-signed discuss refresh 2026-10-01).

- `/login` (board 6a): one email field and Access with magic link. The server action asks Supabase
  `admin.generateLink` for a link and sends it through Resend from `inquiries@`. An unknown email
  gets the link that creates the account (subject "Confirm your email"); a known one gets "Sign in".
  The owner email never creates an account from the public form. Check-your-email state with Send
  again (countdown from the provider's 429 only) and Use a different email.
- `/auth/confirm` verifies `token_hash` with `verifyOtp`; the return path comes from an httpOnly
  cookie set from a fixed key list (`account`, `bookings`), never from the query. Failure goes to
  `/login?expired=1`.
- `/account` hub (board 6b, Phase 2 parts): Profile (first name, last name, optional phone, Save;
  email shown as text), Preferences (language, currency, saved on change), Sign-in and security
  (Sign out). Needs a session; `/bookings` too.
- Account menu in `SiteNav` (board 6e): Bookings, Profile, Preferences, TOUCHWORD (owner only, wired
  in 02-04), Sign out (local scope, no dialog).
- Migration `supabase/migrations/20260925120000_platform_spine.sql`: `profiles` (RLS, column grants),
  trigger from `auth.users`, `site_settings` + public view, `host_handoff`. Not applied.
- Tests: `auth-magic-link`, `account-save`, `secrets`, `migration`; phase-03 guest tests updated to
  the signed state. Harness scene `guest-account` renders the session-gated screens for Playwright.

Deviations: no Create account tab (owner answer 1); no browser Supabase client (nothing needs one);
the terms line on board 6a is left out until legal copy exists.
