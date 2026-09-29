# ALMAR design system canvas — 29/09/2026

Canvas (the design surface): https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw
`pages/*.dc.html` are reference copies of the boards for Claude Code to read. They are not app code. Never import them.

## Pages (D-03)

| # | Page | Status |
|---|------|--------|
| 1 | Audit (boards 1–8a) | frozen, unedited |
| 2 | Foundations: Colour, Type, Space/shape/motion/dense | approved 2026-09-29 |
| 3 | Components: Controls, Surfaces and navigation | approved 2026-09-29 (sidebar Catalog subtabs added at owner request) |
| 4 | Journey: 4 boards (see below) | awaiting owner |
| 5 | Public pages: 11 layouts (see below) | awaiting owner |
| 6 | Guest | not drawn (plan 22) |
| 7 | Dashboard: 8 boards (see below) | awaiting owner |

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

11 boards. Each has an EN/AR/ES switch, so there is no separate Arabic board (D-61). Home (screenshots in two halves per width, because a board is at most 8000 px tall), About, Contact, Destinations, Experiences and services, Private stays, Stay detail, Blog and Blog post show desktop 1440, tablet 834 and phone 390 side by side. Two boards are special: the details overlay and the header cart.

| Board | Route | Owner decision drawn |
|-------|-------|----------------------|
| 5a Home | `/` | Unchanged from Framer: screenshots of the live page (owner comment). No redesign. |
| 5b About | `/about` | |
| 5c Contact | `/contact` | |
| 5d Destinations | `/destinations` | |
| 5e Experiences and services | `/experiences` | One page. Desktop: filter column (search, type, destination, private stay, clear) beside results grouped into Experiences and Services with counts and removable filter chips. Phone and tablet: search, Filters button and type chips. Add icon on every card and a "2 added · Continue" bar (D-64, D-65) |
| 5f Overlay | opens from a card | Details overlay with a fixed bottom bar: price and Add to cart, desktop and full-screen phone (D-67) |
| 5g Cart in the header | header | Empty and with count; drawer for a signed-in guest with an existing booking (Checkout) and for everyone else (complete the booking first) (D-66) |
| 5h Private stays | `/private-stays` | |
| 5i Stay detail | `/private-stays/[stay]` | Booking bar pre-filled and locked (destination and stay). Clicking Dates opens the calendar under the bar with unavailable dates struck through. Availability is set per stay in Dashboard › Catalog › Stays (D-62, D-63). No separate availability block. |
| 5j Blog | `/blog` | |
| 5k Blog post | `/blog/[post]` | Reading time, destination tag, on-this-page list, pull quote, featured stay and experience with Add, share, plan-this-journey bar, related stories, newsletter (D-68) |

Removed: `/services`, `/services/[service]` and the separate experiences board (D-64, D-67).

Notes: tablet and phone use the Menu button (no full nav below 1024). TeamSection is placeholders only and renders nothing with zero members. Blocked dates on the stay calendar are examples. Copy that exists in `lib/copy/home.ts` is used as is in EN, AR and ES. New strings (cart, filters, overlay, blog) are AR/ES drafts for owner review. Images are six repo photos.

Gate: page 5 awaiting owner (second review).


## Page 4 · Journey (plan 11)

Four boards, each with an EN/AR/ES switch (no separate Arabic boards, per D-61). Copy is the drafted `lib/copy/journey.ts` text (EN, AR, ES); guest summaries and plurals use the same rules as `lib/journey-format.ts`. Prices are `AED [PRICE]` and `AED [AMOUNT]` only.

| Board | Shows |
|-------|-------|
| 4a Journey bar | Desktop bar: empty; Destination open with DestinationMenu; Dates open with two-month DateRangePanel; Guests open with GuestPanel; hover; Missing with the error rule and alert line; filled; docked in the sticky header. Tablet bar with a one-month panel. |
| 4b Phone journey | Entry empty and filled, docked row, sheet steps 1 to 3, and the warning states for steps 1 and 2. |
| 4c Add-ons (desktop) | StepRail, InclusionsList, the add-on list (trip, night and person units, Home pickup Added, stepper at max), filters, cart rail, page actions, skeleton rows, empty lines, empty cart. |
| 4d Phone add-ons, cart, Pay | Phone StepRail, add-ons list, dock, full-screen cart, and the Pay step with ToggleCards (none chosen with error, deposit chosen, UAE airport with error). |

Canvas design system: repo `tokens.json` is not installed as a canvas design system. The canvas type only installs a design system from another design-system artifact, and the repo file has a different shape, so forcing it in could break the Theme menu. The canvas keeps its existing "UI System" theme. Colours, type and spacing on every board are the same values as `tokens.json`.

Picker placement (D-70): the date picker opens below the Dates tab and the guest picker below the Guests tab, each centered on its own tab.

Gate: page 4 awaiting owner.


## Page 6 · Guest (plan 22), redesigned 2026-09-29

Redesigned after the owner said the first version had too much empty space. References came from Mobbin (split-screen sign-in screens from Cosmos, lululemon, Runway, Origin and Zillow; one-page sign in or create account from lululemon, Kayak and GetYourGuide). The owner chose the split screen and rejected the overlay login (D-71).

Three boards (6a Login, 6b Account, 6c Bookings), each with an EN/AR/ES switch and no separate Arabic board (D-61), each at desktop 1440, tablet 834 and phone 390.

| Board | States | Layout |
|-------|--------|--------|
| 6a Login | empty, error, typing, link sent | One page for sign in and sign up. Desktop: form on the left (logo, language select, headline, one email field, full-width teal button, a note that the account is created on first use), inset photo on the right with the Framer hero headline. Tablet and phone: photo band on top, form below. |
| 6b Account | empty, filled | Cards: profile card, Personal details, Preferences (language and currency), Contact ALMAR (WhatsApp inline, wa.me/971563883302), Sign out. Two columns on desktop. |
| 6c Bookings | empty, filled | Empty: photo beside "No bookings yet" and Start a trip. Filled: booking cards with photo, status chip, ref, dates, guests and amount, in brackets. |

New strings (sign-in headline and helper, sent state, cards) are EN drafts with AR and ES drafts for owner review. No social sign-in buttons, because those would be controls that do nothing. The terms and privacy line is a placeholder: `[Terms and privacy line]`.

Second update (owner: "get more out of account page and bookings"): Account, Bookings and a new Trip detail board are much richer (D-72, D-73, D-74).

| Board | What it adds |
|-------|--------------|
| 6b Account | Side nav; Profile; Saved travelers; Saved stays (teal hearts); Preferences (language, currency, two switches); Sign-in and security (signed in as, sign out); Help (WhatsApp, email). Empty states use "No … yet" lines. |
| 6c Bookings | Summary tiles, tabs, search, and rich booking cards with payment progress and actions. |
| 6d Trip detail | Timeline, stay, experiences and services with Add, payment card, help card. |

Amounts, dates, names, counts and the days-to-go line are bracket placeholders.

Third update (owner: trip detail not liked, how to reach Account, help under the tabs, delete account states, better organized account): D-75 to D-78.

| Board | Change |
|-------|--------|
| 6b Account | Grouped left rail (Personal, Settings) with Need help? directly below it; sectioned content; Delete account card. |
| 6d Trip detail | Redesigned: photo header, facts strip, tabs, payment card. |
| 6e Account access | Header shows Login when signed out and an account menu when signed in (menu open shown), plus the phone Menu list. |
| 6f Delete account | Ten states: confirm, confirm with email (disabled, enabled, mismatch, busy), failed, blocked, link sent, deleted page desktop and phone, phone sheet. |

Fourth update (owner: request cancellation and refund; one image size on bookings): D-79, D-80.

| Board | Change |
|-------|--------|
| 6c Bookings | Every booking image is one fixed size, cropped to fill. Cards have Request cancellation; a card with a request shows the Cancellation requested chip and View request. |
| 6d Trip detail | Cancellation and refund card with the placeholder policy and the request button. |
| 6g Cancellation and refund | Nine states: request dialog, sending, failed, request sent, not available after the trip starts, phone sheet, requested, refund approved, refunded and cancelled. |

Fifth update (owner: update the navbar everywhere; no logo in the account dropdown): D-81. Navbar specimen on 3b now shows signed out, signed in with a cart count, and the account menu open; phone headers on 3b and page 4 carry the cart; account trigger and menu have no logo.

Sixth update (owner: reimagine the trip detail): 6d Trip detail redesigned again (D-78 replaced): Manage booking dropdown, status rail, stay with one fixed photo size, Day by day itinerary, sticky payment card with the balance due, concierge card and a quiet cancellation link.

Gate: page 6 awaiting owner.


## Page 7 · Dashboard (plan 26), redesigned 2026-09-29 (D-82 to D-92)

19 boards. Each frame is drawn at desktop 1440, tablet 834 and phone 390 (a few sub-states only at desktop and phone). Every board has the EN/AR/ES switch. Labels and empty lines use `lib/copy/dashboard.ts`; filled rows use brackets only.

| Board | What it covers |
|-------|----------------|
| 7a Home | Admin overview, empty state, phone rail open |
| 7b Bookings | Tabs, filters, table; empty state |
| 7c New booking page | Five steps with the summary rail |
| 7d Booking detail | Overview, payments, history, cancellation request |
| 7e Customers, Customer profile | List; read-only details, bookings, logs |
| 7f Calendar and blocking | Filter by destination or stay; block everything, one destination or one stay; conflict warning |
| 7g Destinations | List and side panel: details, connect stays, all experiences and services, delete |
| 7h Stays | List and side panel: details, connect experiences and services, availability |
| 7i Experiences and services | One list with filter and search; panel with details and connections |
| 7j Packages | Coming soon |
| 7k Content hub and page editor | Hub; sections editor with language switch |
| 7l Blog | List and post editor |
| 7m Team and Legal | Member panel; legal page panel with versions |
| 7n Media and Navigation | Library with alt text in three languages; header and footer menus |
| 7o Settings | Profile, business and brand, payments and taxes, team and roles, integrations, security and logs |

Checked by rendering every board locally with fallback fonts: no frame clips its content. Not checked in the real canvas fonts.

Targets, not built in 3.1: most of these screens (bookings pages, calendar blocking, connections, content editing, merged settings) are later phases. Publish and Save are drawn as buttons with no success states.

Gate: page 7 awaiting owner.
