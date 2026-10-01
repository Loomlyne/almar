---
phase: 03-public-site-and-dashboard
plan: "11"
subsystem: dashboard-catalog
tags: [dashboard, catalog, ui, empty-states]
requires:
  - "03-02"
provides:
  - Four empty catalog lists at /dashboard/catalog/{destinations,stays,experiences,packages}
  - Shared CatalogScreen component with per-kind empty editor sidebars
affects:
  - app/dashboard/(ops)/catalog/*
tech-stack:
  added: []
  patterns:
    - Single CatalogScreen({ kind }) component driven by a per-kind config map, mirroring the existing bookings-screen.tsx / customers-screen.tsx pattern
    - Sidebar editor fields built from the existing Field component; Media URL validated inline (https:// prefix) with the invalid value never written to state
key-files:
  created:
    - app/dashboard/(ops)/catalog/destinations/page.tsx
    - app/dashboard/(ops)/catalog/stays/page.tsx
    - app/dashboard/(ops)/catalog/experiences/page.tsx
    - app/dashboard/(ops)/catalog/packages/page.tsx
    - app/dashboard/(ops)/catalog/catalog-screen.tsx
    - app/dashboard/(ops)/catalog/catalog.module.css
    - tests/phase-03-catalog.test.mjs
  modified: []
key-decisions:
  - One shared CatalogScreen component parameterized by kind, instead of four near-duplicate screens, to keep the empty-list/empty-editor pattern in one place
  - Media URL field keeps its previous valid state and flips aria-invalid via Field's error prop when a non-https value is typed; the rejected value is never assigned to component state (T-03-27)
  - Rates is drawn as a read-only Field with an empty value and a hint that it is set after the catalogue connects — no month table, no number, no calculation
  - Experiences' Type/Price/Destination controls are plain <select> elements with local state only; nothing fetches or filters the (always empty) table
requirements-completed:
  - STAY-03
  - STAY-05
  - STAY-06
  - JOUR-05
  - CMS-01
  - CMS-02
  - CMS-05
  - CMS-06
duration: "~35 min"
completed: 2026-09-27
---

# Phase 3 Plan 11: Empty catalog lists and editors Summary

Four dashboard catalog screens (Destinations, Stays, Experiences & Services, Packages) now render as named, empty lists with a shared `CatalogScreen` component and per-kind empty editor sidebars — no records, no seed data, no catalogue behavior.

## What was built

- `app/dashboard/(ops)/catalog/catalog-screen.tsx` — client component taking a `kind` prop (`destinations | stays | experiences | packages`). Renders:
  - Heading from `lib/dashboard-copy.ts` (`copy.rail.*`)
  - Experiences-only controls: Type, Price, Destination — plain `<select>`s with local state, wired to nothing; they do not filter the table and do not fetch
  - Empty line + `New [thing]` gold (`hero-search-submit`) action from the copywriting table
  - `ops-table` with `Name` / `Status` columns and an empty `<tbody />`
  - `Sidebar` (unmodified `components/ui/sidebar.tsx`) opened by `New [thing]`, titled with the same label, with a `Publish` button (`hero-search-submit`, no-op) and the existing `Close`
- Editor fields per kind, all from the existing `Field` component, all empty, none persisted:
  - Destination / Package: Name, Status
  - Stay: Name, Status, Pets, Min nights, Infants count, Media URL, Rates
  - Experience: Name, Status, Type, Price, Destination
- Media URL: `handleMediaChange` accepts empty or `https://`-prefixed values into state; any other value sets `mediaInvalid` (→ `aria-invalid` via `Field`'s `error` prop, message "Enter a URL that starts with https://.") and is never written to `mediaUrl` state — satisfies T-03-27 (not stored, not uploaded, no file input anywhere).
- Rates: a read-only `Field` with an empty value and a hint that it's set after the catalogue connects. No month table, no number, no calculation.
- `app/dashboard/(ops)/catalog/{destinations,stays,experiences,packages}/page.tsx` — four thin server components, each copying the existing `notFound()` production gate from `app/dashboard/(ops)/bookings/page.tsx` and rendering `<CatalogScreen kind="..." />`. None has `"use client"`.
- `app/dashboard/(ops)/catalog/catalog.module.css` — screen/title/controls/empty/table styles, matching the token usage and density of `bookings.module.css` and `home.module.css` (spacing tokens, `--text-heading`, `--font-display`, no radius, 44px hit targets on the select controls, `:focus-visible` teal outline).
- `tests/phase-03-catalog.test.mjs` — 10 tests: production gate + kind wiring on all four pages, the four empty lines/New actions, stay field presence (and no Max nights), experience controls named and not fetching, no inclusion toggle anywhere, Media URL rejection logic, Publish/Close wiring, no seeded row (no "cartagena" string), no file under `app/dashboard` named `seed`, no `[id]` detail route for any of the four lists.

## Verification

- `node --test tests/phase-03-catalog.test.mjs` → 10/10 pass.
- `npx tsc --noEmit -p .` → clean, no new errors.
- Dev server on `127.0.0.1:3010` (already running, left untouched): `GET /dashboard/catalog/{destinations,stays,experiences,packages}` all return `200`; `/dashboard/catalog/stays` body contains "No stays yet".

## Deviations from Plan

**1. [Rule 3 - blocking] Added `catalog.module.css`, a file not listed in `files_modified`**

- **Found during:** Task 1
- **Issue:** `catalog-screen.tsx` needs its own CSS module (screen layout, empty-state, table wrap, and the Experiences filter controls) — the plan's `files_modified` list named the four `page.tsx` files, `catalog-screen.tsx`, and the test file, but not a stylesheet. Every sibling dashboard screen (bookings, customers, home) ships its own `*.module.css`; omitting one would leave the screen unstyled or force reuse of an unrelated module.
- **Fix:** Created `app/dashboard/(ops)/catalog/catalog.module.css` using only the existing semantic tokens already declared in `app/globals.css` (spacing scale, `--text-heading`, `--font-display`, `--color-border`, `--color-surface`, `--color-heading`). No radius above 0, no new hex values.
- **Files modified:** `app/dashboard/(ops)/catalog/catalog.module.css`
- **Verification:** `npx tsc --noEmit -p .` clean; dev server serves all four routes at 200.
- **Commit:** `9d254f3`

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** none on scope or behavior — purely a supporting stylesheet required for the four listed component files to render per the UI-SPEC's spacing/typography/color tokens.

## Known Stubs

None beyond what the plan explicitly requires as empty/non-functional by design:

- All four tables render `<tbody />` with no rows (required — "Do not seed a record").
- Experiences' Type/Price/Destination controls hold local state that is never read by anything else (required — "do not filter", "do not fetch").
- Rates is a read-only, always-empty `Field` (required — "does not calculate").
- Publish is a no-op click handler (required — CMS-05, "Publish does not publish").

None of these block the plan's goal; they are the deferred CMS-01/02/05/06 and STAY-03/05/06/JOUR-05 behaviors named in the objective as out of scope for this plan.

## Threat Flags

None. The one trust boundary in scope (Operator → media field, T-03-27) is mitigated as specified: accept only `https://`-prefixed values, never `innerHTML`, no upload, no file input. T-03-28 (no seed rows, `notFound()` gate) and T-03-SC (no `npm install`, no migration) hold — nothing installed, no migration created, no Supabase project touched.

## Self-Check: PASSED

- `[ -f "app/dashboard/(ops)/catalog/destinations/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/catalog/stays/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/catalog/experiences/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/catalog/packages/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/catalog/catalog-screen.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/catalog/catalog.module.css" ]` → FOUND
- `[ -f "tests/phase-03-catalog.test.mjs" ]` → FOUND
- `git log --oneline --all | grep -q 9d254f3` → FOUND

## Next

Ready for the plan that connects catalog records (CMS-01, CMS-02, CMS-05, CMS-06) and stay rules (STAY-03, STAY-05, STAY-06) and inclusion toggles (JOUR-05) — all still deferred by design in this plan.
