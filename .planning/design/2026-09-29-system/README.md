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

## Page 5 · Public pages (plan 15), revised 2026-09-29 after owner feedback

11 boards. Each has an EN/AR/ES switch, so there is no separate Arabic board (D-61). Home, About, Contact, Destinations, Experiences and services, Private stays, Stay detail, Blog and Blog post show desktop 1440, tablet 834 and phone 390 side by side. Two boards are special: the details overlay and the header cart.

| Board | Route | Owner decision drawn |
|-------|-------|----------------------|
| 5a Home | `/` | Cart icon in the header |
| 5b About | `/about` | |
| 5c Contact | `/contact` | |
| 5d Destinations | `/destinations` | |
| 5e Experiences and services | `/experiences` | One page for both, with search, type chips, destination and private-stay filters, Add icon on every card, and a "2 added · Continue" bar (D-64, D-65) |
| 5f Overlay | opens from a card | Details overlay with a fixed bottom bar: price and Add to cart, desktop and full-screen phone (D-67) |
| 5g Cart in the header | header | Empty and with count; drawer for a signed-in guest with an existing booking (Checkout) and for everyone else (complete the booking first) (D-66) |
| 5h Private stays | `/private-stays` | |
| 5i Stay detail | `/private-stays/[stay]` | Booking bar pre-filled and locked (destination and stay); calendar with unavailable dates set per stay in the CMS (D-62, D-63) |
| 5j Blog | `/blog` | |
| 5k Blog post | `/blog/[post]` | Reading time, destination tag, on-this-page list, pull quote, featured stay and experience with Add, share, plan-this-journey bar, related stories, newsletter (D-68) |

Removed: `/services`, `/services/[service]` and the separate experiences board (D-64, D-67).

Notes: tablet and phone use the Menu button (no full nav below 1024). TeamSection is placeholders only and renders nothing with zero members. Blocked dates on the stay calendar are examples. Copy that exists in `lib/copy/home.ts` is used as is in EN, AR and ES. New strings (cart, filters, overlay, blog) are AR/ES drafts for owner review. Images are six repo photos.

Gate: page 5 awaiting owner (second review).
