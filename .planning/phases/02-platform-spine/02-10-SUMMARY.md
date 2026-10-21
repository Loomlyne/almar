---
phase: 02-platform-spine
plan: "10"
status: superseded
requirements: [I18N-02]
superseded_by: Phase 3.3 React pages + 02-05 account follow (prices from the catalogue in 3.2)
metrics:
  completed: 2026-10-21
---

# Phase 02 Plan 10: convert written prices on Framer pages — SUPERSEDED

Not executed. No code was written for this plan.

- **Paused** 2026-09-28: prices come from the catalogue (Phase 3.2/3.3), not from strings in Framer HTML.
  **Marked superseded** 2026-10-11 in `4be0541f` (planning note, owner instruction).
- **What replaced it:**
  - The converter this plan asked for exists without the Framer injector: `lib/fx/rates.ts` (`FX_URL` pinned to
    `currency-api.pages.dev`, `parseWrittenAmount`, `convertWrittenAmount`; written USD stays USD, written AED stays
    AED; no typed rate), served by `app/fx/route.ts` and drawn by `components/ui/amount.tsx`. It came with Phase 3.1
    (`9fd67867`) and the 3.3 slice 1 data layer (`7902a7d2`, `lib/data/rates.ts`).
  - I18N-02 (language and currency switchers in the header; a language switch keeps currency): the React header
    (`components/ui/nav.tsx`, `components/ui/locale-select.tsx`, `components/site/public-frame.tsx`,
    `components/pages/home/currency-choice.tsx`) in Phase 3.3, and 02-05 (`5700eba2` + `fa5033c`), which makes the
    language and currency picks follow a signed-in account (`app/api/preferences/route.ts`,
    `components/site/account-sync.ts`).
  - Live catalogue prices (no prices imported yet, owner rule: never invent a price) belong to Phase 3.2 and Phase 4.
- `lib/framer/inject.ts` and `lib/fx/convert.ts` were never built; nothing to remove.

Verification of where I18N-02 is met now: `02-VERIFICATION.md`.
