---
phase: 02-platform-spine
plan: 01
subsystem: auth
tags: [supabase, magic-link, resend, opennext]

requires: []
provides:
  - Approved package pins for a later install
  - One cloud project gate, with Storage off
  - Confirmed owner user and four auth redirect URLs
affects: [02-08, 02-02]

tech-stack:
  added: []
  patterns:
    - "Secrets stay in the owner environment. The repo stores env names only."
    - "Magic-link expiry stays at the Supabase default."

key-files:
  created:
    - .planning/phases/02-platform-spine/02-01-SUMMARY.md
    - .planning/phases/02-platform-spine/02-USER-SETUP.md
  modified: []

key-decisions:
  - "email-verification-api is rejected. The confirm email is Resend."
  - "Session time-box stays unset until the Supabase plan is Pro."

patterns-established:
  - "No install, no second project, no Storage, no local Docker in this gate."

requirements-completed: [PLAT-01, PLAT-04, AUTH-05]

duration: 3h 17m
completed: 2026-09-26
---

# Phase 02 Plan 01: Package gate and cloud project Summary

**Pinned auth and host packages are approved and uninstalled, and the cloud project gate is closed with the 30-day session time-box deferred until Pro.**

## Performance

- **Duration:** 3h 17m
- **Started:** 2026-09-26T15:01:17Z
- **Completed:** 2026-09-26T18:18:00Z
- **Tasks:** 3
- **Files modified:** 0

## Accomplishments

- Four packages were approved by hand and not installed: `@supabase/supabase-js@2.117.2`, `@supabase/ssr@0.12.7`, `resend@6.29.0`, `@opennextjs/cloudflare@1.20.6`. `next` stays `14.2.35`.
- `email-verification-api` was rejected. It is not Resend.
- One cloud project exists. Storage is off. The owner user is confirmed, with an empty name and no password. No link was sent. Four confirm redirects are allow-listed. No `/ops` path.

## Task Commits

No production commits. This plan does not edit source.

1. **Task 1: Human-verify three assumed packages before any install** — approved in chat, no commit
2. **Task 2: Human-verify email-verification-api before it may be installed** — rejected in chat, no commit
3. **Task 3: Owner creates one Supabase project, then wait** — approved in chat, no commit

**Plan metadata:** docs commit for this summary

## Files Created/Modified

- `.planning/phases/02-platform-spine/02-01-SUMMARY.md` — this close-out
- `.planning/phases/02-platform-spine/02-USER-SETUP.md` — env names and the deferred time-box

## Decisions Made

- Confirm email is Resend, from `inquiries@almarprivatejourney.com`, display name ALMAR Private Journey. `email-verification-api` is not installed.
- Magic-link expiry stays at the Supabase default. No 15-minute or 24-hour product TTL was typed.
- Session time-box is deferred until the owner moves the project to Pro.

## Deviations from Plan

### Auto-fixed Issues

None.

### Accepted by owner

**1. [Plan requirement — AUTH-05] Session time-box left unset**

- **Found during:** Task 3 (Owner creates one Supabase project, then wait)
- **Issue:** Time-boxed sessions are Pro plans and up. The free plan rejects the setting in the dashboard and in the auth config API.
- **Fix:** None applied. Owner approved closing the plan and will set 30 days after going Pro.
- **Files modified:** none
- **Verification:** Official session docs state the feature is Pro and up. A config write was rejected. No time-box value was invented.
- **Committed in:** none

---

**Total deviations:** 1 accepted, 0 auto-fixed
**Impact on plan:** Installs stay blocked until a later plan. AUTH-05's time-box is not done.

## Issues Encountered

- Live re-read of the project was denied after the gate was checked. The close uses the earlier successful reads in this sitting, not a fresh read at commit time.
- The three env names are unset in this shell. They stay out of the repo.

## User Setup Required

**External services require manual configuration.** See [02-USER-SETUP.md](./02-USER-SETUP.md) for:

- Three env names to set in the owner environment
- The 30-day session time-box, after Pro

## Next Phase Readiness

- Ready for `02-08`. Do not start `02-02` first.
- Blocker: session time-box remains unset until Pro.
- No key and no project ref were written into the repo.

## Self-Check: PASSED

- Task 1 was approved before any later plan runs npm install
- Task 2 recorded rejected for `email-verification-api`
- Task 3 resume was `approved`, with no key and no project ref in that message
- `package.json` still pins `next` `14.2.35` and does not list the new packages
- Automated check passed: `package.json` has no `vercel` string, and `wrangler.toml` has no `dashboard.almarprivatejourney.com`

---
*Phase: 02-platform-spine*
*Completed: 2026-09-26*
