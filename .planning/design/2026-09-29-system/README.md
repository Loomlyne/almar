# ALMAR design system canvas — 29/09/2026

Canvas (the design surface): https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw
`pages/*.dc.html` are reference copies of the boards for Claude Code to read. They are not app code. Never import them.

## Pages (D-03)

| # | Page | Status |
|---|------|--------|
| 1 | Audit (boards 1–8a) | frozen, unedited |
| 2 | Foundations: Colour, Type, Space/shape/motion/dense | approved 2026-09-29 |
| 3 | Components: Controls, Surfaces and navigation | approved 2026-09-29 (sidebar Catalog subtabs added at owner request) |
| 4 | Journey | not drawn (plan 11) |
| 5 | Public pages: 11 layouts (see below) | awaiting owner |
| 6 | Guest | not drawn (plan 22) |
| 7 | Dashboard | not drawn (plan 26) |

Every board has an EN/AR/ES switch (AR flips to RTL) and a fixed Arabic RTL board beside it (`…Ar`). AR and ES text is drafted from the real EN copy for owner review.

## Gate: Foundations + Components (plan 03.1-01, D-09)

Status: approved by the owner in chat, 2026-09-29 ("All good, continue").
Answer A (current-step rule colour): not given separately, default holds: teal.
Answer B (Lato 700 on stepper count and phone warning): not given separately, default holds: keep.
Owner change at the gate: dashboard sidebar Catalog opens a dropdown with its pages (Destinations, Experiences, Packages, Stays), drawn on board 3b.

## Notes

- Nav wordmark on the canvas is `brand/Logo Typography/Poly_Black.svg` (uploaded to the canvas). The stacked charcoal lockup replaces it in the build (plan 06).
- Gold is drawn only as lines. The gold "fails" row of the contrast table is drawn as a gold rule, not as gold text.

## Page 5 · Public pages (plan 15)

11 templates, one board each (desktop 1440, tablet 834, phone 390 side by side) plus a fixed Arabic RTL board (`…Ar`):

| Board | Route |
|-------|-------|
| 5a Home | `/` |
| 5b About | `/about` |
| 5c Contact | `/contact` |
| 5d Destinations | `/destinations` |
| 5e Experiences | `/experiences` |
| 5f Private stays | `/private-stays` |
| 5g Stay detail | `/private-stays/[stay]` (12 stays share it) |
| 5h Services | `/services` |
| 5i Service detail | `/services/[service]` (3 services share it) |
| 5j Blog | `/blog` |
| 5k Blog post | `/blog/[post]` (3 posts share it) |

Notes: section order comes from each Framer route's page map. Tablet and phone use the Menu button (no full nav below 1024). TeamSection is placeholders only (`[Name]`, `[Role]`, monogram on teal tint) with a note that it renders nothing with zero members. Service and blog detail bodies are `[Body text]` placeholders because their copy is not in `lib/copy`. Images are six repo photos from `public/assets/img`. Home, footer and form copy is the real `lib/copy/home.ts` text in EN, AR and ES; other headings are drafted from the Framer EN headings.

Gate: page 5 awaiting owner.
