# ALMAR design canvas: snapshot of 2026-10-01

Source: the owner's claude.ai Design canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw
("ALMAR Design System Audit"), version `1790852310-eba8`, copied on 2026-10-01 by the control session.
The canvas stays the live design surface: the owner signs designs there, page by page. This folder
is a read-only copy so every session, including cloud threads, can see the boards from GitHub.
It replaces `../2026-09-29-system/pages/` and `../2026-09-28-audit/boards/` (the canvas was later
split into one file per board).

## How to use it

- Code takes every colour, size and space from `tokens.json` at the repo root. The file
  `ds/ui-system/tokens.json` here is the canvas's own copy of its design system (namespace
  `ui-system`, copied 2026-09-28): never use it in code.
- `boards/*.dc.html` are canvas source files. They load the canvas runtime (`./support.js`) and
  import each other (`<dc-import name="…">`), so they do not open on their own. Read them for layout,
  sizes, states and copy (EN, AR and ES). 57 of the 63 boards show images and fonts stored on the
  canvas (`/_blob/<hash>`); those are not copied, so open the canvas to see a board exactly.
- `canvas.json` is the canvas layout: the page, title, size and position of every board.
- Never edit these copies. When the owner changes the canvas, the control session copies it again
  into a new dated folder.

## Pages and boards, in canvas order (63 boards)

| Page | Board | File | Width × height |
|---|---|---|---|
| 1 · Audit | 1 · Verdict | `boards/Main.dc.html` | 1440 × 1760 |
| 1 · Audit | 2 · Where it is today | `boards/Evidence.dc.html` | 1440 × 2480 |
| 1 · Audit | 3 · Token drift | `boards/Drift.dc.html` | 1440 × 1760 |
| 1 · Audit | 4 · The order (decided) | `boards/Plan.dc.html` | 1440 × 1760 |
| 1 · Audit | 5 · Desktop hero · journey bar (click it) | `boards/Hero.dc.html` | 1440 × 1100 |
| 1 · Audit | 6 · Phone hero (click it) | `boards/HeroPhone.dc.html` | 390 × 844 |
| 1 · Audit | 6a · Phone step 1 · Where | `boards/PhoneWhere.dc.html` | 390 × 844 |
| 1 · Audit | 6b · Phone step 2 · When | `boards/PhoneWhen.dc.html` | 390 × 844 |
| 1 · Audit | 6c · Phone step 3 · Who | `boards/PhoneWho.dc.html` | 390 × 844 |
| 1 · Audit | 7 · Design-system spec | `boards/BookerKit.dc.html` | 1440 × 2240 |
| 1 · Audit | 8 · /booking/trip · add-ons (scroll, pick many) | `boards/Flow.dc.html` | 1440 × 1480 |
| 1 · Audit | 8a · Phone · add-ons (scroll, pick many) | `boards/FlowPhone.dc.html` | 390 × 844 |
| 2 · Foundations | 2a · Colour | `boards/FoundationsColor.dc.html` | 1440 × 3350 |
| 2 · Foundations | 2a · Colour · Arabic RTL (fixed) | `boards/FoundationsColorAr.dc.html` | 1440 × 3350 |
| 2 · Foundations | 2b · Type | `boards/FoundationsType.dc.html` | 1440 × 3400 |
| 2 · Foundations | 2b · Type · Arabic RTL (fixed) | `boards/FoundationsTypeAr.dc.html` | 1440 × 3400 |
| 2 · Foundations | 2c · Space, shape, motion, dense | `boards/FoundationsSpace.dc.html` | 1440 × 4200 |
| 2 · Foundations | 2c · Space, shape, motion, dense · Arabic RTL (fixed) | `boards/FoundationsSpaceAr.dc.html` | 1440 × 4200 |
| 3 · Components | 3a · Controls | `boards/ComponentsControls.dc.html` | 1440 × 6000 |
| 3 · Components | 3a · Controls · Arabic RTL (fixed) | `boards/ComponentsControlsAr.dc.html` | 1440 × 6000 |
| 3 · Components | 3b · Surfaces and navigation | `boards/ComponentsSurfaces.dc.html` | 1440 × 6700 |
| 3 · Components | 3b · Surfaces and navigation · Arabic RTL (fixed) | `boards/ComponentsSurfacesAr.dc.html` | 1440 × 6700 |
| 5 · Public pages | 5a · Home | `boards/PublicHome.dc.html` | 5928 × 7632 |
| 5 · Public pages | 5b · About | `boards/PublicAbout.dc.html` | 3024 × 4533 |
| 5 · Public pages | 5c · Contact | `boards/PublicContact.dc.html` | 3024 × 3088 |
| 5 · Public pages | 5d · Destinations | `boards/PublicDestinations.dc.html` | 3024 × 3444 |
| 5 · Public pages | 5e · Experiences and services | `boards/PublicExperiences.dc.html` | 3024 × 4419 |
| 5 · Public pages | 5f · Experience and service overlay | `boards/PublicOverlay.dc.html` | 2110 × 1454 |
| 5 · Public pages | 5g · Cart in the header | `boards/PublicCart.dc.html` | 2230 × 1424 |
| 5 · Public pages | 5h · Private stays | `boards/PublicStays.dc.html` | 3024 × 3807 |
| 5 · Public pages | 5i · Stay detail | `boards/PublicStayDetail.dc.html` | 3024 × 7408 |
| 5 · Public pages | 5j · Blog | `boards/PublicBlog.dc.html` | 3024 × 3081 |
| 5 · Public pages | 5k · Blog post | `boards/PublicBlogPost.dc.html` | 3024 × 5052 |
| 4 · Journey | 4a · Journey bar (desktop and tablet) | `boards/JourneyBar.dc.html` | 1440 × 4700 |
| 4 · Journey | 4b · Phone journey | `boards/JourneyPhone.dc.html` | 3880 × 1688 |
| 4 · Journey | 4c · Add-ons step (desktop) | `boards/JourneyAddons.dc.html` | 1440 × 4302 |
| 4 · Journey | 4d · Phone add-ons, cart and Pay | `boards/JourneyPhoneAddons.dc.html` | 1440 × 2562 |
| 6 · Guest | 6a · Login | `boards/GuestLogin.dc.html` | 3024 × 4838 |
| 6 · Guest | 6b · Account | `boards/GuestAccount.dc.html` | 3024 × 6082 |
| 6 · Guest | 6c · Bookings | `boards/GuestBookings.dc.html` | 3024 × 5482 |
| 6 · Guest | 6d · Trip detail | `boards/GuestTrip.dc.html` | 3024 × 3504 |
| 6 · Guest | 6e · Account access (header menu) | `boards/GuestMenu.dc.html` | 2110 × 1874 |
| 6 · Guest | 6f · Delete account, all states | `boards/GuestDelete.dc.html` | 2580 × 2876 |
| 6 · Guest | 6g · Cancellation and refund, all states | `boards/GuestCancel.dc.html` | 2216 × 2180 |
| 7 · Dashboard | 7a · Home | `boards/DashHome.dc.html` | 3024 × 5444 |
| 7 · Dashboard | 7b · Bookings | `boards/DashBookings.dc.html` | 3024 × 3104 |
| 7 · Dashboard | 7c · New booking page, steps 1 to 3 | `boards/DashNewBookingA.dc.html` | 3024 × 6444 |
| 7 · Dashboard | 7c · New booking page, steps 4 and 5 | `boards/DashNewBookingB.dc.html` | 3024 × 4154 |
| 7 · Dashboard | 7d · Booking detail, overview and payments | `boards/DashBookingDetailA.dc.html` | 3024 × 4754 |
| 7 · Dashboard | 7d · Booking detail, history and cancellation | `boards/DashBookingDetailB.dc.html` | 3024 × 4154 |
| 7 · Dashboard | 7e · Customers | `boards/DashCustomers.dc.html` | 3024 × 2954 |
| 7 · Dashboard | 7e · Customer profile | `boards/DashCustomerProfile.dc.html` | 3024 × 5244 |
| 7 · Dashboard | 7f · Calendar and blocking | `boards/DashCalendar.dc.html` | 3024 × 5334 |
| 7 · Dashboard | 7g · Destinations | `boards/DashDestinations.dc.html` | 3024 × 7314 |
| 7 · Dashboard | 7h · Stays | `boards/DashStays.dc.html` | 3024 × 7024 |
| 7 · Dashboard | 7i · Experiences and services | `boards/DashServices.dc.html` | 3024 × 5634 |
| 7 · Dashboard | 7j · Packages, coming soon | `boards/DashPackages.dc.html` | 3024 × 1564 |
| 7 · Dashboard | 7k · Content hub and page editor | `boards/DashContent.dc.html` | 3024 × 2854 |
| 7 · Dashboard | 7l · Blog | `boards/DashPosts.dc.html` | 3024 × 1564 |
| 7 · Dashboard | 7m · Team and Legal | `boards/DashTeamLegal.dc.html` | 3024 × 4634 |
| 7 · Dashboard | 7n · Media and Navigation | `boards/DashMediaNav.dc.html` | 3024 × 4344 |
| 7 · Dashboard | 7o · Settings, profile, business, payments | `boards/DashSettingsA.dc.html` | 3024 × 4444 |
| 7 · Dashboard | 7o · Settings, team, integrations, security | `boards/DashSettingsB.dc.html` | 3024 × 2754 |
