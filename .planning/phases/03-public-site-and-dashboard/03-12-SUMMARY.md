---
phase: 03-public-site-and-dashboard
plan: "12"
subsystem: ui
tags: [nextjs, react, dashboard, content-cms]

requires:
  - phase: 03-public-site-and-dashboard
    provides: dashboard shell layout (app/dashboard/(ops)/layout.tsx) from plan 03-02, and the shared *-screen.tsx + thin page.tsx gate convention from plan 03-11 (catalog-screen.tsx)
provides:
  - Four empty content lists (Pages, Blog, Team, Legal) at /dashboard/content/*
  - ContentScreen shared component with per-kind config (title, empty line, New label)
  - Team editor Photo field as an https-only URL input, no file input
affects: [03-13, cms-plans]

tech-stack:
  added: []
  patterns:
    - "Shared *-screen.tsx client component + thin server page.tsx gate (notFound in production), same pattern as catalog-screen.tsx from 03-11"

key-files:
  created:
    - app/dashboard/(ops)/content/content-screen.tsx
    - app/dashboard/(ops)/content/content.module.css
    - app/dashboard/(ops)/content/pages/page.tsx
    - app/dashboard/(ops)/content/blog/page.tsx
    - app/dashboard/(ops)/content/team/page.tsx
    - app/dashboard/(ops)/content/legal/page.tsx
    - tests/phase-03-content.test.mjs
  modified: []

key-decisions:
  - "Reused the 03-11 catalog-screen.tsx pattern verbatim for structure (Config record, readLocale, Sidebar, Fields) to keep the two content-domain screens consistent"
  - "Added content.module.css as a sibling, matching the catalog.module.css precedent (deviation noted below)"

patterns-established: []

requirements-completed: [CMS-05, CMS-06]

duration: 25min
completed: 2026-09-27
---

# Phase 3 Plan 12: Dashboard Content Screens Summary

**Four empty /dashboard/content lists (Pages, Blog, Team, Legal) with a shared ContentScreen component, empty editor sidebars, and a Team Photo field that only accepts https:// URLs and never uploads.**

## Performance

- **Duration:** 25 min
- **Tasks:** 1
- **Files modified:** 7 (all created)

## Accomplishments
- Four `/dashboard/content/*` pages (`pages`, `blog`, `team`, `legal`) each gate `notFound()` in production and delegate to `ContentScreen` with their `kind`, mirroring the `CatalogScreen` gate pattern from 03-11
- `ContentScreen` draws the locked empty line + `New [thing]` action, an empty `ops-table` with Name/Status columns and no data row, and an empty editor `Sidebar`
- Team editor's Photo field is a plain URL input (no `type="file"`); a non-https, non-empty value is rejected before it ever reaches component state (`aria-invalid` via the `Field` component's `error` prop) — nothing is stored, nothing uploads
- `Publish` in every editor uses `hero-search-submit` (the one gold fill) and only calls a no-op handler — no `fetch`
- Added `tests/phase-03-content.test.mjs` (6 tests, all passing) asserting the four empty lines, the wired copy keys, no file input, no SEO field, and no seed files under the content dir

## Task Commits

1. **Task 1: Draw the four empty content screens** - `04906ea` (feat)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified
- `app/dashboard/(ops)/content/content-screen.tsx` - Shared client component rendering the four content kinds (pages/blog/team/legal), their empty list, and empty editor sidebar
- `app/dashboard/(ops)/content/content.module.css` - Screen/empty-state/table styles, copied 1:1 from the 03-11 `catalog.module.css` token usage
- `app/dashboard/(ops)/content/pages/page.tsx` - Thin server gate → `ContentScreen kind="pages"`
- `app/dashboard/(ops)/content/blog/page.tsx` - Thin server gate → `ContentScreen kind="blog"`
- `app/dashboard/(ops)/content/team/page.tsx` - Thin server gate → `ContentScreen kind="team"`
- `app/dashboard/(ops)/content/legal/page.tsx` - Thin server gate → `ContentScreen kind="legal"`
- `tests/phase-03-content.test.mjs` - Source-level assertions for the empty lines, copy wiring, https-only Photo field, and absence of file inputs/SEO fields/seed rows

## Decisions Made
- Followed the 03-11 `catalog-screen.tsx` convention exactly (per-kind `Config` record, `readLocale()` from the `almar-locale` cookie, `Sidebar` from `components/ui/sidebar.tsx`, `hero-search-submit` for Publish) so the two content-domain screen families stay visually and structurally identical.
- Content kinds (Pages, Blog, Legal) only need Name + Status per the UI-SPEC editor table; only Team gets the extra Photo field, so `Fields()` branches only on `kind === "team"` rather than replicating the catalog screen's four-way branch.

## Deviations from Plan

**1. [Deviation - additive, not a plan file] Added `content.module.css`**
- **Found during:** Task 1
- **Issue:** `content-screen.tsx` needs its own CSS module (screen/title/empty/table/actions classes); this file was not in the plan's `files_modified` list but the plan explicitly allowed it: "A content.module.css sibling file is acceptable if content-screen.tsx needs one, matching the 03-11 catalog.module.css precedent — note it as a deviation in SUMMARY.md if added."
- **Fix:** Created `app/dashboard/(ops)/content/content.module.css`, mirroring `catalog.module.css` token usage (spacing/color/font vars, radius 0 implied by no radius rules).
- **Files modified:** `app/dashboard/(ops)/content/content.module.css`
- **Verification:** Committed alongside the plan's other files in the same task commit; no separate commit needed since it was pre-approved by the plan.
- **Committed in:** `04906ea` (Task 1 commit)

---

**Total deviations:** 1 pre-approved addition (sibling CSS module, explicitly allowed by the plan).
**Impact on plan:** None — this was anticipated and permitted by the plan text itself, not scope creep.

## Issues Encountered
None.

## Threat Model Verification

| Threat ID | Disposition | Verified |
|-----------|-------------|----------|
| T-03-29 | mitigate | Photo field rejects any non-empty value not starting with `https://` before it reaches state (`handlePhotoChange` in `content-screen.tsx`); no `type="file"` anywhere in the created files. |
| T-03-30 | mitigate | All four pages call `notFound()` when `NODE_ENV === "production"`; `<tbody />` renders no rows. |
| T-03-SC | mitigate | No `npm install` was run; no Supabase storage was added. |

## Known Stubs

None beyond the plan's intentional scope — the four lists and editors are empty by design (CMS-05 publish workflow and CMS-06 storage/upload remain deferred, as the plan requires). `Publish` is a no-op `onClick`; this is the locked behavior, not an unintentional stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The four `/dashboard/content/*` screens exist, named and empty, ready for a later plan to wire real data once CMS-05 (publish workflow) and CMS-06 (storage/upload) are picked back up.
- No blockers.

## Self-Check: PASSED
- `[ -f "app/dashboard/(ops)/content/content-screen.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/content/content.module.css" ]` → FOUND
- `[ -f "app/dashboard/(ops)/content/pages/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/content/blog/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/content/team/page.tsx" ]` → FOUND
- `[ -f "app/dashboard/(ops)/content/legal/page.tsx" ]` → FOUND
- `[ -f "tests/phase-03-content.test.mjs" ]` → FOUND
- `git log --oneline --all | grep -q "04906ea"` → FOUND
- `node --test tests/phase-03-content.test.mjs` → 6/6 passing, exit 0

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
