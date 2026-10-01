---
phase: 03-public-site-and-dashboard
plan: "06"
subsystem: ui
tags: [whatsapp, floating-control, framer-shell, guest-screens]

requires:
  - phase: 03-public-site-and-dashboard
    provides: FramerShell, sign-in/bookings/account/trip screens (03-05)
provides:
  - components/ui/whatsapp.tsx floating control, mounted on /framer and the four public screens
  - components/icons/icons.tsx WhatsAppIcon glyph
affects: [03-public-site-and-dashboard]

tech-stack:
  added: []
  patterns:
    - "One-off channel-exception hex fill (#25D366) documented as not a brand token, matching the Tokens section rule"
    - "Fixed-position control uses inset-inline-end/inset-block-end, never right, matching the rest of the logical-property convention"

key-files:
  created:
    - components/ui/whatsapp.tsx
    - components/ui/whatsapp.module.css
    - tests/phase-03-whatsapp.spec.ts
  modified:
    - components/icons/icons.tsx
    - app/framer/framer-shell.tsx
    - app/login/sign-in-screen.tsx
    - app/bookings/bookings-screen.tsx
    - app/account/account-screen.tsx
    - app/booking/trip/trip-screen.tsx

key-decisions:
  - "z-index 45 on .whatsapp: below the open header menu (z-index 50 in framer-shell.module.css / SiteNav) per the plan's locked instruction, which takes priority over the UI-SPEC's separate 'above toasts' note (toast-stack is also z-index 50 and lives in a different mount point not touched by this plan)"
  - "Accessible name comes from aria-label=\"WhatsApp\" on the anchor; the glyph itself is aria-hidden so screen readers announce only 'WhatsApp'"
  - "target=\"_blank\" rel=\"noopener noreferrer\" added since wa.me is an external destination; does not change the href value the plan locks"
  - "Mounted as a sibling after <main>/the iframe in each screen's JSX fragment, not inside SiteNav, so it stays outside any dialog/sidebar stacking context"

patterns-established:
  - "Pattern: a locked external-contact control (WhatsApp) is a plain component imported per-screen, not threaded through props on SiteNav or FramerShell"

requirements-completed: []

duration: 20 min
completed: 2026-09-27
---

# Phase 3 Plan 06: Floating WhatsApp control Summary

**A square, 44px WhatsApp control fixed to the bottom end of the viewport opens the locked `https://wa.me/971563883302` link with no prefilled reference. It is mounted on `/framer` (outside the iframe) and on the sign-in, bookings, account, and trip screens. It is absent on `/design` and `/dashboard`.**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `WhatsAppIcon` added to `components/icons/icons.tsx` following the existing `ChevronIcon`/`CloseIcon` shape: `viewBox 0 0 24 24`, `currentColor`, `strokeWidth={1.5}`, with a small solid phone-handset glyph inset in the outlined speech bubble.
- `components/ui/whatsapp.tsx` renders a native `<a>` with `aria-label="WhatsApp"`, `href="https://wa.me/971563883302"` — the constant, with no query string and no booking-reference interpolation anywhere in the file.
- `components/ui/whatsapp.module.css`: `position: fixed`, `inset-inline-end: 16px`, `inset-block-end: 16px`, `inline-size`/`block-size: 44px`, `border-radius: 0`, `background: #25D366`, `color: var(--color-fg)` (charcoal, not white). Not a circle, not a pill.
- Mounted from `FramerShell` as a sibling of the header and the iframe (outside it), and from `SignInScreen`, `BookingsScreen`, `AccountScreen`, and `TripScreen`, each as the last sibling in their JSX fragment.
- Not mounted on `/design` (`app/design/page.tsx` and `design-kit.tsx` untouched; only string on that page containing "whatsapp" is a pre-existing unrelated testimonial label, `"WhatsApp trip"`, in `design-kit.tsx`) and not in any `app/dashboard/**` file — no `KitHome` import either.
- `tests/phase-03-whatsapp.spec.ts` (Playwright, port 3010 via existing `playwright.config.ts`, not touched) asserts: on `/framer` the link named `WhatsApp` has the exact locked href; on `/design` that link has zero matches; and the same href is present on `/login`, `/bookings`, `/account`, `/booking/trip`.

## Task Commits

1. **Task 1 + Task 2 (combined): glyph, control, mounts, and test** - `d6f0cfe` (feat)
2. **Docs: this summary** - see below

## Files Created/Modified

- `components/icons/icons.tsx` - added `WhatsAppIcon`
- `components/ui/whatsapp.tsx` - the control
- `components/ui/whatsapp.module.css` - fixed-position square styling
- `tests/phase-03-whatsapp.spec.ts` - Playwright coverage
- `app/framer/framer-shell.tsx` - mounted `<WhatsApp />` outside the iframe
- `app/login/sign-in-screen.tsx`, `app/bookings/bookings-screen.tsx`, `app/account/account-screen.tsx`, `app/booking/trip/trip-screen.tsx` - mounted `<WhatsApp />`

## Decisions Made

- See `key-decisions` above (z-index priority, accessible-name mechanism, `target="_blank"`, mount position).

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Issues Encountered

None. `tests/phase-03-search.test.mjs`'s pre-existing unrelated failure (noted in 03-05-SUMMARY.md) is untouched by this plan and was not re-run as part of this plan's verification.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The control is fully wired — it is a real `<a>` to a real, locked `wa.me` URL.

## Next Phase Readiness

- `node -e "..."` Task 1 check: PASS (href present, no `text=`).
- `node -e "..."` Task 2 check: PASS (`framer-shell.tsx` includes `whatsapp`; `app/design/page.tsx` does not, case-insensitively).
- `npx playwright test tests/phase-03-whatsapp.spec.ts` — 2/2 passing.
- `npx playwright test tests/design-rtl.spec.ts` — 1/1 passing (no regression).
- `npx tsc --noEmit -p tsconfig.json` — no errors.
- `git diff --stat -- app/design app/route.ts app/globals.css app/framer/framer-shell.module.css` — empty (none of these files were touched).

## Self-Check: PASSED

- FOUND: components/icons/icons.tsx (WhatsAppIcon)
- FOUND: components/ui/whatsapp.tsx
- FOUND: components/ui/whatsapp.module.css
- FOUND: tests/phase-03-whatsapp.spec.ts
- FOUND: app/framer/framer-shell.tsx (mounts WhatsApp)
- FOUND: app/login/sign-in-screen.tsx, app/bookings/bookings-screen.tsx, app/account/account-screen.tsx, app/booking/trip/trip-screen.tsx (each mounts WhatsApp)
- FOUND: d6f0cfe

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
