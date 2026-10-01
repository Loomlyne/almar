# Phase 3: Public site and dashboard - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Public site and dashboard as real screens on the chosen `/framer` look. `/` stays the live Framer site until a later phase. Dashboard screens are at `/dashboard` on this dev server. Catalogue records stay out. Hero Search books. Currency uses FX. Language, WhatsApp, and newsletter are connected. Every component, button, and text is named so a later plan can connect it.

</domain>

<decisions>
## Implementation Decisions

Locked this session. Do not re-ask.

### Dashboard rooms
- **D-01:** Catalog screens (Destinations, Stays, Experiences & Services, Packages) show every field and button, named. Nothing saves.
- **D-02:** Home shows the layout with named empty slots. No sample numbers.
- **D-03:** Bookings and Customers show full table chrome, no rows. Each control is named.
- **D-04:** Calendar is a month grid. Days are named. No bookings are drawn.
- **D-05:** Content (Pages, Blog, Team, Legal) and Settings (brand, VAT, deposit, templates) show every field and button, named. Nothing saves.
- **D-06:** Superseded by D-16. Booking, customer, and stay details are sidebars, not full pages. They stay reachable with zero rows.
- **D-07:** An empty Bookings, Customers, or Stays list has one named action. That action opens the empty detail.
- **D-08:** Profile shows every field and button, named. Nothing saves.
- **D-09:** The Home date control (this month, last 30, custom) is drawn and named. It does not filter.
- **D-10:** Catalog and Content empty lists have one named action. That action opens the empty editor, which is a sidebar (D-16).
- **D-11:** Settings is one page. Fields are grouped.
- **D-12:** Calendar days open an empty day screen in the sidebar if the day is empty. Owner words: "They open an empty day screen in the sidebar if it's empty"
- **D-13:** A sidebar opens on top of the screen. The screen under it stays as it is and does not shrink. Every sidebar from now on opens on top. Owner words: "The side bar will open on top of the month grid. The month grid will stay as it is. It will not shrink but the side bar will open on top. Every side bar from now on will open on top of the screen"
- **D-14:** The empty day sidebar shows that day's fields, named and empty. Nothing saves.
- **D-15:** Opening a second empty day replaces the sidebar. One sidebar only.
- **D-16:** Booking, customer, stay, and editors also open as sidebars on top. The list or page under them does not shrink.
- **D-17:** A sidebar has a named close control. Click outside closes it.
- **D-18:** A sidebar uses the end side. It flips in Arabic.
- **D-19:** Settings groups are Brand, Money, Email, Maintenance, in that order.
- **D-20:** The empty-list action says New, then the thing. Examples: New booking, New stay, New destination.
- **D-21:** The empty-list line says No [things] yet, plus the New action.
- **D-22:** Sign out and Logout-all sit on Profile only, next to each other. Not in the dashboard header.
- **D-23:** On a phone or tablet, the dashboard header is a logo and a menu icon. The ops nav is inside the menu.
- **D-24:** Bookings columns are guest, destination, dates, and status.
- **D-25:** Customers columns are name, email, phone, and bookings count.
- **D-26:** An empty day sidebar shows the date, an empty bookings list, and a named Block control. Nothing saves. That list uses the D-21 line.
- **D-27:** On desktop, the ops nav is a start-side rail. It stays when a sidebar opens.
- **D-28:** Settings fields: Brand holds tokens, logos, and favicon. Money holds VAT, deposit, and FX. Email holds templates, reminders, and confirmation. Maintenance holds maintenance mode.
- **D-29:** Profile shows name, email, and a photo, plus Sign out and Logout-all.
- **D-30:** Catalog and Content lists show name and status.
- **D-31:** Home empty slots are bookings, revenue, cost, outstanding, occupancy, reminders, and charts. No sample numbers. Reminders uses the D-21 line.
- **D-32:** Catalog and Content children are always open in the desktop rail.
- **D-33:** A sidebar heading is New, then the thing. A day uses its date.
- **D-34:** The sidebar close control says Close.
- **D-35:** The dashboard header uses the same wordmark as the public header.
- **D-36:** The Experiences list shows type, price sort, and destination. They are named. They do not filter.

### Framer pages
- **D-37:** Superseded by D-47. The two looks are not every public URL this phase.
- **D-38:** Build both looks as real screens. The owner will choose which one later. Owner words: "Give me both options. Build, like you build the /design-kit and the current Framer look, and rebuild it as real screens and I will choose which one. In the current Framer look the only changes I want you to make when you create both are: to change the nav bar (the header), and to add the booking flow in the hero section of the home screen."
- **D-39:** Rebuilt public pages use the /design nav: wordmark, Destinations, Experiences, About, Contact, then currency, language, Login. Services stays a real URL. It is not in that nav.
- **D-40:** `/booking/trip` is named screens. Nothing saves and nothing charges.
- **D-41:** Contact, List with us, Plan with us, and the consultation calendar are drawn, named, and not sending.
- **D-42:** Superseded by D-47. Not two full trees.
- **D-43:** The kit home uses the current home section order, restyled.
- **D-44:** A kit stay page uses the current stay blocks, restyled.
- **D-45:** The kit footer is brand, links, List with us, and newsletter.
- **D-46:** Copy is in both looks. `/design` follows Framer, not the reverse. Owner words: "I want to copy in both looks but see, what I want you is this: even in /design I want that to follow the Framer page. Any element, any section, any component in Framer needs to be done in /design not the opposite. New: /design needs to follow /Framer not the opposite"
- **D-47:** The two looks are the home screen only, for now. URLs are `/framer` and `/design`. Other pages are later. Owner words: "only create both on the home screen that I told you to create, so I can see them... The URL right now that we have as a local screen, as a localhost, is like that: /framer. The other one is /design. Just to home/home/framer/design, like that, to see it. That's just the home screen for now. Later we will figure out." The `/kit` prefix is not the lock.
- **D-48:** `/design` pieces that Framer does not have stay, after the Framer set.
- **D-49:** One dashboard. It is not duplicated.
- **D-50:** After a look is chosen, the other comes out.
- **D-51:** `/framer` is the chosen look. Owner words: "I choose / framer one"
- **D-52:** `/` stays the live Framer site until a later phase.
- **D-53:** `/design` specimens stay at `/design`. They are not the public home.
- **D-54:** The floating WhatsApp control is on `/framer` and the later public pages.
- **D-55:** Local dashboard screens are at `/dashboard` on this dev server.
- **D-56:** Next area is Guest account.
- **D-57:** Guest screens drawn now are Bookings, Account, and Sign in. Named. Nothing saves.
- **D-58:** An empty guest booking list uses the D-21 line, plus a named way to start a trip.
- **D-59:** Account shows name, email, phone, and language. Named. Nothing saves.
- **D-60:** The guest opens those screens from the signed-in header menu: Bookings, Account, Sign out.
- **D-61:** Sign in on `/framer` is the email field, named. It does not send.
- **D-62:** Hero Search books. Owner words: "Why doesn't the hero search do bookings? Let's make it do bookings"
- **D-63:** Currency is connected to FX. Owner words: "No let's make it. Connect it, the FX, let's connect it"
- **D-64:** Language is connected. Owner words: "Let's connect them. Why don't they? Let's connect them"
- **D-65:** WhatsApp is connected and works. Owner words: "let's connect them and make it work"
- **D-66:** Newsletter is connected and works. Owner words: "let's connect them and make it work"

### Claude's Discretion

None yet.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase locks
- `.planning/phases/01-design-system/01-CONTEXT.md` — tokens, components, square corners, no radio controls
- `.planning/phases/02-platform-spine/02-CONTEXT.md` — magic link, dashboard host, full ops nav, guest menu
- `.planning/REQUIREMENTS.md` — OPS-01 through OPS-13, CMS-01 through CMS-09, PLAT-03
- `.planning/PROJECT.md` — public booking and ops dashboard screen lists
- `.planning/ROADMAP.md` — Phase 3 goal. Success criteria still describe the catalogue and are not the screen lock.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui` and `components/specimens` — kit already built for `/design`
- `app/design/page.tsx` — component states, not the public site

### Established Patterns
- Live public URLs are still Framer HTML in `app/**/route.ts`
- `app/layout.tsx` exists. Phase 1 maps that said "no layout" are stale.

### Integration Points
- Dashboard host is `dashboard.almarprivatejourney.com`, not `/ops` (phase 2 D-04)
- Ops nav is already locked (phase 2 D-58, OPS-02)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

Catalogue records stay out of this phase. A calendar day that already has a booking is not this phase. Price calculation beyond the connected FX is not this phase.

</deferred>

---

*Phase: 3-Public site and dashboard*
*Context gathered: 2026-09-27*
