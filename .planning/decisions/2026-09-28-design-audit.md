# Owner decisions from the design audit, 2026-09-28

Copied verbatim on 2026-10-01 from `CLAUDE.local.md`, section "Decisions 2026-09-28 (design audit)" (gitignored, so work sessions in
worktrees cannot see it). The two copies say the same; the control session keeps them in step.

- Team members on the live Framer home (Ana Velásquez, Mateo Ríos, Sofía Marín) are fake. Remove them. Public Team shows only members published from Dashboard → Content → Team (CMS). No stock or invented people anywhere, the design canvas included.
- Pale teal `#d1dfe0` is not a fifth brand colour. Token `--color-teal-tint`, section and panel backgrounds only, never text.
- Khadija's ALMAR scope is finished: branding only. The brand book's "premium chauffeur service" paragraph is Vamos Taxi wording. ALMAR is private journeys. Never use that copy.
- Order decided 2026-09-28 (owner delegated): stop patching Framer HTML (02-09, 02-10 paused) → Phase 3.1 design system + journey bar → 3.2 real Catalog + Team in Supabase (after 02-08, 02-04) → 3.3 booking-path pages in React → Phase 4 Book & pay → Phase 5 Ops OS → Phase 6 remaining pages + remove Framer bridge. Dashboard screens are restyled when they become real, not in a separate pass.
- The hero booking bar and the booking flow are design-system components. Their look may be fully redesigned. Square corners and the no-radio rule still hold.
- Phone booking entry: one tap target in the hero, then 3 steps (Where → When → Who). Experiences and services always show an image.
- ALMAR sessions may run in Claude Cowork linked to this Mac, not only the Hermes `almar` bot. In Cowork, do not send him to the Hermes bot; do the next step in the same chat. GSD slash commands may not exist there: follow the GSD step by hand and write files in the existing `.planning/` format.
