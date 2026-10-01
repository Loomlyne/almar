You run Phase 3.2 (real catalogue and team) for ALMAR: discuss, then plan. Code waits until job 02
(Phase 2 auth chain) has landed.

Read `.planning/prompts/00-common-rules.md` first and follow it.

STARTS only after job 01 (Phase 3.1) has landed and the owner says go. Not started on 2026-10-01.
Discuss may run while job 02 builds: it is talk and planning files, no code.

One cloud thread (on the Mac: `/Users/koss/Developer/almar-wt/phase-3.2`), branch
`gsd/phase-3.2-catalog-and-team`, cut from the base named in the common rules. Lead: Opus 5.5
(database and rates). A fresh reviewer thread reads every database change before the hand-over.

GOAL (ROADMAP)
Ops can create and publish destinations, stays with rates, experiences and services with images,
the inclusions kit and team members; the data lives in Supabase. Requirements to confirm at
discuss: CMS-01, CMS-02, STAY-03, STAY-05, STAY-06.

STEPS
1. `/gsd-discuss-phase 3.2` with the owner, through the question form. Do not re-ask what stands
   below or in `.planning/decisions/`.
2. Plan; he signs; execute only after job 02 has landed (3.2 needs the server runtime and ops
   sign-in).
3. Screens follow canvas page 7 (Dashboard, dense variant). Pictures of anything new first.
4. Hand-over per the common rules.

DECISIONS THAT STAND
- The three team members on the live Framer home are fake and go. Public Team shows only members
  published from Dashboard → Content → Team. No stock or invented people anywhere.
- Every experience and service has an image (https, Cloudflare), a type, a unit and a destination
  link. Media never goes to Supabase storage.
- Experiences and services are one page with filters and search; details open in an overlay, not a
  detail page (D-64, D-67). The private-stay booking bar is pre-filled and its blocked dates come
  from the CMS per stay (D-62, D-63).
- Seed rates are fake and labelled as such; the owner enters real rates. A stay with no rates is
  not bookable.
- Five seed destinations: Cartagena, Medellín, Bogotá, San Andrés, Cocora Valley. Ops can add and
  remove any.
- English is typed by ops; AR and ES follow the publish rules in `PROJECT.md`.
