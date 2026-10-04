---
phase: 02-platform-spine
plan: 26
subsystem: auth
tags: [hmac, rate-limit, ipv6, migration, ops-handoff]
requires: [02-23, 02-24, 02-25]
key-files:
  created: [lib/auth/limit.ts, tests/auth-limit.test.mjs]
  modified: [lib/supabase/clients.ts, lib/auth/continue.ts, lib/auth/magic-link-server.ts, app/auth/confirm/page.tsx, app/auth/confirm/actions.ts, app/account/actions.ts, app/auth/handoff/start/route.ts, components/ui/account-menu.tsx, lib/host.ts, supabase/migrations/20260925120000_platform_spine.sql]
metrics:
  completed: 2026-10-05
---

# Phase 02 Plan 26: second review fixes - Task 1 Summary

Task 1 only (no new screen). Task 2 (forwarded-link email check) is not started: it waits for the owner's signature on the pictures.

## Commits
- 0a9a5b9 fix(02-26): derived auth keys, keyed limiter hashes, /64 IPv6 limit, Continue attempt limit, ops handoff closed in production

## What changed
- #1 `authSigningKey("continue" | "limit")` in `lib/supabase/clients.ts`: `HMAC-SHA256(serviceKey, "almar-<label>-v1")`, null without a key. It is the only reader of the service-role key (`tests/secrets.test.mjs` unchanged and green). Continue signing and verification take the derived key. Old Continue links signed with the raw key stop verifying (no live links exist).
- #9 Limiter hashes (`email`, `ip`, `confirm`) are `HMAC(limit key, "<kind>\n<value>")` in `lib/auth/limit.ts`. No limiter key: `requestSignIn` answers unavailable (fail closed).
- #3 `ipLimitKey`: IPv4 in full; IPv6 by its first four hextets, expanded (`::` compression, zone id, brackets, trailing dotted IPv4); `::ffff:a.b.c.d` is the IPv4; unreadable or missing is one `none` bucket.
- #4 `confirmSignIn`: `isTokenHashShape` (`^[0-9a-f]{40,128}$`), then `claim_confirm_slot` (rpc error, non-true, or no key goes to the expired redirect), then `verifyOtp`. The shape is wider than today's GoTrue SHA-224 hex (56 characters) so an upstream digest change does not lock everyone out; no fixture in the repo holds a real hashed_token, so 56 is from GoTrue's behaviour as I know it, not verified here.
- Migration (edited in place, applied nowhere): `claim_confirm_slot(p_ip_key text)` on a sibling table `auth_confirm_attempts` (chosen over a `kind` column: leaves `claim_link_slot`'s counts untouched), 30 per IP per hour, IP advisory lock, security definer, `search_path = ''`, RLS on, revoke all, execute to `service_role` only. #7 `claim_link_slot` takes the IP lock after the email lock. #8 `created_at` indexes on both tables. #11 `on conflict do nothing` (no target) on the trigger insert and the backfill. #13 name checks refuse `[[:cntrl:]<>"&]` (the app's letters rule allows none of them).
- #12 `saveProfile` selects the updated row id; zero rows is `failed`.
- #14 `OPS_HOST_LIVE = false` and `opsHandoffOpen(nodeEnv)` in `lib/host.ts`. In production the menu hides TOUCHWORD and `/auth/handoff/start` redirects to `/` (303, no-store) before any session read. Development unchanged.
- #2 `tests/preview-config.test.mjs` now pins the 7-entry `run_worker_first` (`/api/*` + `JOB02_SERVER_PATHS`). That test had been asserting the old `["/api/*"]` line; it is not in the earlier-run subsets, which is why it was not caught.

## Verification
- `npx tsc --noEmit`: clean.
- `node --test tests/*.test.mjs`: 682 tests, 678 pass, 0 fail, 4 skipped (existing skips, e.g. media-staging absent).
- Playwright, `PW_PORT=3065`, `--workers=1`: `auth-continue.spec.ts` + `phase-02-guest-nav.spec.ts`, 20 passed.
- New: `tests/auth-limit.test.mjs` (IP parsing, token shape, keyed hashes, key derivation, action order, handoff gate, saveProfile); migration text assertions in `tests/migration.test.mjs`; `tests/auth-magic-link.test.mjs` limiter test repointed.

## Deviations
- [Rule 3] `tests/auth-owner.test.mjs` and `tests/phase-03-guest.test.mjs` anchored on `account.opsHref ? (`; repointed to the new `opsHref && opsHandoffOpen(...)` condition.
- [Rule 3] `tests/preview-config.test.mjs` was already out of date with `wrangler.toml` (see #2); fixed as the plan asks.
- Added helper `opsHandoffOpen(nodeEnv)` next to the constant so the menu, the route and the tests share one condition.
- Untracked `tests/journey/scenes/auth-continue-email-draft.tsx` was already in the tree before this task; left alone.

## Not verified
- No SQL was run: the new function, constraints and indexes are checked as text only. No Supabase or Resend contact, so the real `hashed_token` length and the rpc round trip are unproven.
- No build or assembler run.

## Self-Check: PASSED

# Task 2 - forwarded-link email check

Signed by the owner (last row of `02-JOB02-DECISIONS.md`). The signed draft scene is reproduced exactly and deleted.

## Commits
- 4b62a49 feat(02-26): forwarded-link email check
- 4e3cbe4 test(02-26): helpers, action order, cookie and screen checks, Playwright states

## What changed
- `lib/auth/continue.ts`: `LINK_NONCE_COOKIE` (`almar-link-nonce`), `newLinkNonce` (32 bytes base64url), `isLinkNonce`, `signBrowser`/`verifyBrowser` (`b` = HMAC(continue key, "almar-browser-v1\n" nonce "\n" token_hash)), `signEmail`/`verifyEmail` (`e` = HMAC(..., "almar-email-v1\n" normalised email "\n" token_hash)), `continueMode` (browser / email / closed), `checkContinue` (ok / wrong-email / closed). Constant-time compares.
- The nonce cookie (httpOnly, Lax, Secure in production, path `/`, 1 hour; an existing valid one is reused) is set in `sendLinkFromRequest` (`lib/auth/magic-link-server.ts`), the one function both `requestSignIn` and `opsSignIn` call, so both hosts get it from one place. The link gains `b` and `e` via `continueProof`; `m`/`s` unchanged. The link never carries the email.
- Page: cookie nonce verifies against `b` goes to the earlier signed page (no field); no cookie, mismatch or missing `b` goes to the email-check state. No continue key: the no-email page, and the button redirects to expired (fails closed).
- `confirmSignIn(state, form)`: shape, `claim_confirm_slot`, `checkContinue`, then `verifyOtp`. Wrong or empty email returns `{status: "wrong-email", email}`: no `verifyOtp`, the slot already counted. The screen re-renders with the error line, no reload.
- Copy: `auth.continue.why` and `auth.continue.wrongEmail` (EN/AR/ES as in the draft), additions only. Field label is `GUEST_COPY[locale].email`.
- Harness states `email-ask` and `email-wrong` on `tests/journey/scenes/auth-continue.tsx` render the real `ContinueScreen`.

## Verification
- `npx tsc --noEmit`: clean.
- `node --test tests/*.test.mjs`: 691 tests, 687 pass, 0 fail, 4 skipped (existing).
- Playwright `auth-continue`, `auth-i18n`, `phase-02-guest-nav`, `account-select`, `PW_PORT=3065`, `--workers=1`: 45 passed (new: email-ask, email-wrong, signed-unchanged at 390/834/1440 EN+AR).
- Node: b/e round trip, wrong nonce, wrong email, tampered token_hash, no-key, URL carries no email, action source order (shape < slot < check < verifyOtp, one verifyOtp), cookie flags.

## Deviations
- The cookie is set in `sendLinkFromRequest`, not separately in `requestSignIn` and `opsSignIn` (both reach it; one place, no drift).
- React 18.3 types have no `useActionState`: the form uses `action={submit}` with local state (the `app/login` pattern). A function form action needs JavaScript, as the login form already does. The email input is controlled so it survives the form reset.
- A link with no `e` and no browser match can only show the email field and always refuse; only links from before this task lack `e` (none live).

## Not verified
- The real cookie round trip in a browser, the Supabase rpc and `verifyOtp` (no Supabase/Resend contact, no live link). The screen's submit path is covered by source-order and harness tests only.
- No build or assembler run.
