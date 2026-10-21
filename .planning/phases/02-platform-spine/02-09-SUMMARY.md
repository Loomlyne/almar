---
phase: 02-platform-spine
plan: "09"
status: superseded
requirements: [I18N-01, I18N-03]
superseded_by: Phase 3.3 (React public pages)
metrics:
  completed: 2026-10-21
---

# Phase 02 Plan 09: same-URL string map on Framer pages — SUPERSEDED

Not executed. No code was written for this plan.

- **Paused** 2026-09-28: the owner stopped patching Framer HTML. **Marked superseded** 2026-10-11 in `4be0541f`
  (planning note, owner instruction). The plan file carries the same status line.
- **Decision behind it:** I18N-01 was rewritten on 2026-10-02 (owner): per-locale URLs (`/`, `/ar/…`, `/es/…`) baked at
  build with the right `lang` and `dir`, replacing "same URLs + injected string map". Phase 3.3 was reshaped the same
  day to rebuild every public page in React and remove the Framer bridge (`ROADMAP.md`, Phase 3.3).
- **What replaced it:**
  - I18N-01 (EN/AR/ES on every public page, `lang`/`dir` in served HTML): the Phase 3.3 React pages under `app/`,
    `app/ar/`, `app/es/` — slices `7902a7d2` (data layer, home, stays), `8bd0364b` (destinations, experiences),
    `e0dd82fd` (about, contact), `a9f65e30` (blog), `7cf9ce29` (contact form, newsletter); AR/ES text fixed in `7f3c1d17`.
    Header language picker: `components/ui/locale-select.tsx`, `components/ui/nav.tsx`.
  - I18N-03 (DD/MM/YYYY, Monday week, Western numerals): carried by the 3.1 kit and 02-03 formatting, not by this plan.
  - The "phone menu link closes the menu, a language pick leaves it open" truth moved with the React nav (3.3).
- `lib/framer/inject.ts` was never built; nothing to remove.

Verification of where I18N-01 and I18N-03 are met now: `02-VERIFICATION.md`.
