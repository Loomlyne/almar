---
phase: 05-ops-os
plan: 04
subsystem: ops-dashboard
tags: [home, customers, profile, owner-api, session-storage-handoff]
requires: [05-01]
provides: [home-api, customers-api, profile-api, ops-home-copy, bookings-handoff]
affects: [lib/ops-routes.ts, bookings-screen]
key-files:
  created:
    - lib/ops/home-rules.ts
    - lib/ops/home-api.ts
    - app/api/ops/home/route.ts
    - app/api/ops/customers/route.ts
    - app/api/ops/profile/route.ts
    - lib/copy/ops-home.ts
    - components/ops/read-error.ts
    - lib/ops/bookings-handoff.ts
    - tests/ops-home-api.test.mjs
    - tests/ops-bookings-handoff.test.mjs
    - tests/ops-home-customers.spec.ts
  modified:
    - app/dashboard/(ops)/home/home-screen.tsx
    - app/dashboard/(ops)/profile/profile-screen.tsx
    - app/dashboard/(ops)/customers/customers-screen.tsx
    - app/dashboard/(ops)/bookings/bookings-screen.tsx
    - lib/copy/dashboard.ts
    - lib/ops-routes.ts
    - nine existing test and scene files (pins)
requirements: [OPS-02, OPS-03, OPS-08]
completed: 2026-10-31
---

# Phase 5 Plan 04: Home, Customers, Profile Summary

Three read-only owner screens on 05-01's SQL (`ops_home_numbers`, `ops_list_customers`) and the session; a customer row opens Bookings searched by that email through session storage, with the email never in the address bar.

## Commits

- 8d549f4d: Task 1, routes and pure rules, node test.
- afc4bd0d: Task 2, copy, Home, Profile, live sections, old pins. Customers screen and `bookings-handoff.ts` are in this commit too (see Deviations).
- a3edc9bb: Task 3, Bookings takes the handed text; lists test, handoff test, Playwright spec.

## What was built

- `home-rules.ts`: Dubai-day ranges, `parseHomeQuery`, `signedAed` (a minus before `formatAed` of the absolute value), `numberLinks`, `customerSearchText` (100 code points).
- `home-api.ts`: `getHome` (all eight fields checked, unreadable otherwise, no `ops_lapse_holds` on a read), `getCustomers` (reuses `parseListQuery`), `getProfile` (session only). Three route files in the `opsGet` shape.
- Home: three kit `Chip`s, `DateRangeField` for Custom (3,660-day cap caught before asking), three cards, linked card only when `numberLinks` is true (plain `/dashboard/bookings`, no filter). Latest-ticket rule; a failed read clears the numbers.
- Profile: `ProfileView` (props only, used by the picture scene) and `ProfileScreen` (one fetch). No sign-out on the page.
- Customers: `ListTable`, 300 ms quiet, Show more, search in state only.
- Bookings: handed text taken once into a ref inside the "URL read once" effect, left out of `replaceState` while it is the applied search, put back into storage on opening a booking so Back returns to the guest.
- `OPS_HOME_COPY` in EN, AR, ES (AR and ES marked model-translated). `dashboard.ts`: `last30` words, `newCustomer` and `noRemindersYet` removed.
- `OPS_LIVE_SECTIONS`: `/`, `/home`, `/profile`, `/customers`.

## P5-12 reading

Confirmed by reading `lib/host.ts` line 63: on the ops host `/` rewrites to `/dashboard/home` for the owner (and to `/dashboard` otherwise). Sign-in, handoff and logo all land on `/`. With `/` and `/home` live, the owner lands on Home; no other code was needed. `/dashboard` also reads live now, harmless since `app/dashboard/page.tsx` sits outside the (ops) layout (commented in `lib/ops-routes.ts`).

## Pins updated (nothing weakened)

`host-gate.test.mjs`, `ops-runtime.test.mjs` (Home and Profile now pinned live both ways; "/catalog" stays off), `ops-not-live-path.ts` (now "/catalog"), `ops-coming-soon.tsx` comment, `ops-coming-soon.spec.ts` title and comment, `phase-03-dashboard-home.test.mjs`, `phase-03-settings.test.mjs` (profile test), `phase-02-guest-nav.spec.ts` (sign-out test moved to the rail scene), `ops-profile.tsx` scene (fixture `ProfileView`), `review-fixes.spec.ts` (answers `/api/ops/home`), `ops-settings.spec.ts` (answers `/api/ops/profile`). No pin found beyond the plan's list.

## Deviations

1. **[Rule 3 - ordering]** Customers screen and `lib/ops/bookings-handoff.ts` landed in the Task 2 commit, not Task 3: removing `newCustomer` from `dashboard.ts` breaks the old Customers screen's type check, so the new screen had to ship with it. Task 3's commit holds the Bookings change and the tests.
2. **[Rule 2]** Added one copy key not on the plan's table, `home.rangeTooLong` (EN "The range can cover at most 3,660 days.", AR and ES model-translated), because the plan's range note asks for a field error for the 3,660-day cap. Flagged in the file header.
3. **Copy shape**: `OPS_HOME_COPY` is nested (`home`, `customers`, `profile` objects) rather than dotted flat keys; same words, same keys when flattened.
4. `tests/ops-home-customers.spec.ts` reuses `mockBookingsApi` from `tests/helpers/ops-bookings-api.ts` for the Bookings and detail calls (read-only use).

## For the orchestrator

- **`tests/ops-route.test.mjs` EXPECTED_ROUTES** needs three names added: `"customers"`, `"home"`, `"profile"` (sorted order in that list). Not touched by me (05-02 owns it).
- No other ungranted file was wanted.

## Verification

- `npx tsc --noEmit`: clean (no errors, including 05-02's files at the time of the last run).
- `npm run tokens:check`: "theme up to date".
- Plan acceptance greps for Tasks 1-3: all pass (get-only routes, force-dynamic, no `ops_lapse_holds`, F-09 clean, Home and Profile clean of old slots and sign-out, copy cleaned, `model-translated` present, customers clean, handoff calls present, `/customers` live, no ungranted file, no `lib/copy/*` other than `dashboard.ts` and `ops-home.ts`).
- Base untouched: `home-contract.ts`, the migration, `ops-shell.tsx`, `bookings-list.tsx`, `scripts/worker-size.mjs`, `package*.json`.

## Not verified (owner's no-test rule)

Written, not run: `tests/ops-home-api.test.mjs`, `tests/ops-bookings-handoff.test.mjs`, `tests/ops-home-customers.spec.ts`, and every updated test. No build, no pgTAP, no Playwright, no dev server. Pictures and the build-size check skipped: worker size is a controller measure (expected 3 to 5 KiB for this plan; no new dependency, no `next/dynamic`). AR and ES wording is model-translated and unsigned beyond the plan-gate pictures. The custom-range calendar clicks in the spec (`gridcell` text 10 and 12) are a guess at the calendar's markup and may need a fix at the first run.

## Known stubs

None.

## Threat flags

None beyond the plan's register. T-05-04-02 mitigation is in code (storage handoff, `replaceState` leaves the text out) and asserted in the spec on `page.url()`.

## Review

Opus reviewer verdict: **fix first**. Findings and fixes:

1. Code comments in `home-screen.tsx` and `customers-screen.tsx` named words the rewritten tests refuse. Comments reworded ("the v1.1 slots are not drawn", "Read-only: no create action").
2. A handed email could outlive its use. `clearBookingsSearch()` added to `lib/ops/bookings-handoff.ts`; a spec case added (Customers row, a booking, Home, Bookings card, empty search box).
3. `profile-screen.tsx` effect closed over first-render English copy: it now reads the latest words through a ref.
4. A failed Customers read also showed "No customers yet": the table renders only when `error === null` or rows exist.
5. Home: `aria-busy` and reduced opacity on the grid while loading; `error` cleared when a fetch starts.
6. Home: `self-start` on the value so the number follows the reading side in Arabic.
7. `rangeTooLong` now says 3,661 days (EN, AR, ES): SQL allows a difference of 3660, which is 3,661 days counted inclusively. The screen's check (`daysBetween > 3660`) already matched.
8. Spec additions: range over the cap, a failed read on each of the three screens, the Profile name placeholder, underline checks on Customers and Profile plus hover on a linked Home card. The moved sign-out test now sets 1440 wide.

**Known limit (review finding 5, not fixed):** `ops_list_bookings` treats a `q` starting `almar-` as a booking ref. Reported by the controller.

**Shell grant and sign-out:** the controller granted `app/dashboard/(ops)/ops-shell.tsx` for this only. One effect on `pathname` calls `clearBookingsSearch()` whenever the path is not the Bookings list or detail (`/bookings...` or `/dashboard/bookings...`). The rail signs out by a form POST (full-page leave) and by the `signOutEverywhere` server action, so the effect may not run first: `clearBookingsSearch()` is also called in both confirm handlers in the same file. Fully covered inside this file; no other file touched.

Reviewer: Opus, verdict "fix first", findings fixed as above (not re-reviewed).
