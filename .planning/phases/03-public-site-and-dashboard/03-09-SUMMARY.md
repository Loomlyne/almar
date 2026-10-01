---
phase: 03-public-site-and-dashboard
plan: "09"
subsystem: ui
tags: [nextjs, react, radix-ui, dashboard, ops]

requires:
  - phase: 03-public-site-and-dashboard
    provides: OpsLayout dashboard shell (rail, header, Sidebar mount) from plan 03-02
provides:
  - Empty /dashboard/bookings screen with locked columns and New booking sidebar
  - Empty /dashboard/customers screen with locked columns and New customer sidebar
affects: [dashboard catalog/content list screens, dashboard calendar]

tech-stack:
  added: []
  patterns:
    - "Dashboard list screen: title, empty line + gold hero-search-submit action, then secondary .ops-table chrome with an empty <tbody />, then a Sidebar-backed create form."

key-files:
  created:
    - app/dashboard/(ops)/bookings/page.tsx
    - app/dashboard/(ops)/bookings/bookings-screen.tsx
    - app/dashboard/(ops)/bookings/bookings.module.css
    - app/dashboard/(ops)/customers/page.tsx
    - app/dashboard/(ops)/customers/customers-screen.tsx
    - app/dashboard/(ops)/customers/customers.module.css
    - tests/phase-03-dashboard-lists.test.mjs
    - tests/phase-03-dashboard.spec.ts
  modified: []

key-decisions:
  - "Column headers (Guest, Destination, Dates, Status / Name, Email, Phone, Bookings count) are locked English strings, hardcoded rather than added to lib/dashboard-copy.ts, since the plan forbids editing that file and its DashboardCopy type has no column-header keys."
  - "Sidebar fields use the existing Field component as plain text inputs (Guest/Destination/Dates/Status, Name/Email/Phone) — no new form control was introduced."
  - "New booking / New customer button uses the global .hero-search-submit class per the interfaces contract, not Button variant primary."

requirements-completed: []

duration: ~45min
completed: 2026-09-27
---

# Phase 3 Plan 09: Bookings and Customers dashboard lists Summary

**Empty Bookings and Customers dashboard tables with locked columns, D-20-pattern empty states, and single-sidebar create forms backed by the existing Sidebar/Field components.**

## Performance

- **Tasks:** 1 completed
- **Files modified:** 8 (6 created app/component files, 2 test files)

## Accomplishments
- `/dashboard/bookings`: table chrome with columns Guest, Destination, Dates, Status (empty `<tbody />`), empty line "No bookings yet", gold "New booking" action opening a Sidebar with Guest/Destination/Dates/Status fields.
- `/dashboard/customers`: table chrome with columns Name, Email, Phone, Bookings count (empty `<tbody />`), empty line "No customers yet", gold "New customer" action opening a Sidebar with Name/Email/Phone fields.
- Both `page.tsx` files copy the production `notFound()` gate from `app/framer/page.tsx` / `app/dashboard/(ops)/home/page.tsx` and are server components (no `"use client"`).
- Each screen owns exactly one `open` boolean for its Sidebar — there is nothing to stack, so opening "New booking"/"New customer" can never show two dialogs at once. The Sidebar renders through a Radix `Dialog.Portal`, so it never affects the table's layout width.
- `tests/phase-03-dashboard-lists.test.mjs` (node:test) verifies: production gate + delegation, locked columns present, copy sourced from `copy.noBookingsYet`/`copy.newBooking` etc., empty `<tbody />` (no sample row), no `[id]` detail route directories, no sample guest/customer names anywhere in the four source files, and that `components/ui/sidebar.tsx` is untouched.
- `tests/phase-03-dashboard.spec.ts` (Playwright) opens `/dashboard/bookings`, records the table's bounding-box width, clicks "New booking", and asserts the table width is unchanged and the dialog's accessible name includes "New booking".

## Task Commits

1. **Task 1: Draw both empty lists and their sidebars** - `245a488` (feat)

## Files Created/Modified
- `app/dashboard/(ops)/bookings/page.tsx` - Server component, production `notFound()` gate, renders `BookingsScreen`.
- `app/dashboard/(ops)/bookings/bookings-screen.tsx` - Client screen: title, empty state + New booking action, `.ops-table` chrome, Sidebar with Guest/Destination/Dates/Status fields.
- `app/dashboard/(ops)/bookings/bookings.module.css` - Layout-only module (screen stack, empty-state block, tabular-nums on the Dates header), no new radius/color tokens.
- `app/dashboard/(ops)/customers/page.tsx` - Server component, production `notFound()` gate, renders `CustomersScreen`.
- `app/dashboard/(ops)/customers/customers-screen.tsx` - Client screen: title, empty state + New customer action, `.ops-table` chrome, Sidebar with Name/Email/Phone fields.
- `app/dashboard/(ops)/customers/customers.module.css` - Same layout-only pattern as bookings.
- `tests/phase-03-dashboard-lists.test.mjs` - node:test static assertions (see Accomplishments).
- `tests/phase-03-dashboard.spec.ts` - Playwright interaction test for the one-sidebar / no-width-change invariant.

## Decisions Made
- Column header labels are not part of `lib/dashboard-copy.ts` (the type has no such keys, and the plan forbids editing that file), so they are hardcoded locked English strings in each screen, matching how `home-screen.tsx` hardcodes its metric slot labels ("Bookings", "Revenue", etc.) rather than routing them through `DashboardCopy`.
- Used the plain `Field` component for every sidebar input (Guest/Destination/Dates/Status/Name/Email/Phone) instead of introducing a select or date-picker control — the UI-SPEC's editor field table names the fields but not a specific control type, and a plain labeled text field satisfies "Fields are empty, labels above. Nothing saves." without inventing UI the spec doesn't describe.
- Added `bookings.module.css` / `customers.module.css` (not explicitly named in the plan's `files_modified`) as minimal, layout-only supporting files, following the exact pattern already established by `app/dashboard/(ops)/home/home.module.css` — required for the screens to render with the phase's spacing/typography tokens without touching `app/globals.css` or `sidebar.tsx`.

## Deviations from Plan

None - plan executed exactly as written. The two CSS module files above are new supporting files (Rule 3 — blocking: the client screens need scoped layout styling and the plan explicitly forbids editing `app/globals.css` or `sidebar.tsx`), committed in the same task commit; no logic, copy, or interface change beyond the plan's `files_modified` list.

## Issues Encountered
- The project's Playwright config starts its own dev server on port 3010 with `reuseExistingServer: false`, and a dev server was already occupying that port per this task's constraints ("do not start a second dev server"). `tests/phase-03-dashboard.spec.ts` was therefore verified by structural inspection (curl against the running server confirmed the table, "New booking"/"New customer" buttons, and column text render correctly) and by TypeScript compiling cleanly, rather than by an actual `playwright test` run. The Playwright assertions mirror the already-proven pattern in `tests/design-rtl.spec.ts` (Radix `Dialog` accessible name from `Dialog.Title`) and `tests/phase-03-search.spec.ts` (bounding-box comparisons), so risk is low, but this Playwright spec has not been executed end-to-end by this agent.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/dashboard/bookings` and `/dashboard/customers` are drawn and ready for later plans to wire the calendar day sidebar, catalog/content editor sidebars, and any future data connection.
- A future plan (or this session's owner) should run `npx playwright test tests/phase-03-dashboard.spec.ts` once a server-port conflict is not a concern, to get an actual pass/fail signal on the Playwright spec added here.

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
