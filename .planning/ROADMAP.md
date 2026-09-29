# Roadmap: ALMAR Private Journeys

## Overview

Rebuild the Framer HTML export into a live booking OS. Tokens and components first, then auth/i18n spine, then real inventory, then a guest can pay a deposit on `/booking/trip`, then ops can run the trip from `/ops`, then the rest of the public site and remaining CMS replace the brochure.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Design system** - Tokens, core components, RTL states, owner `/design` (completed 2026-09-23)
- [ ] **Phase 2: Platform spine** - Supabase auth, host gate, locale/currency, no ops leak
- [ ] **Phase 3: Public site and dashboard** - Public site and dashboard screens first; catalogue, connections, and calculations after
- [ ] **Phase 3.1: Design system and journey bar** (INSERTED) - One token set, CSS per component, journey bar and booking components from the design canvas
- [ ] **Phase 3.2: Real catalog and team** (INSERTED) - Dashboard Catalog and Team save to Supabase, restyled in the dense variant
- [ ] **Phase 3.3: Booking-path pages** (INSERTED) - Home, Private stays, Stay detail, Destinations, Experiences & Services in React on the same URLs
- [ ] **Phase 4: Book and pay** - Hero → `/booking/trip` → Stripe TEST deposit or full
- [ ] **Phase 5: Ops OS** - `/ops` runs bookings, customers, money, brand publish
- [ ] **Phase 6: Site and rest of CMS** - Replace Framer pages; packages, consult, i18n publish

## Phase Details

### Phase 1: Design system

**Goal:** Every core control exists in the brand system, including RTL, before any booking screen is built.
**Mode:** mvp
**UI hint**: yes
**Depends on:** Nothing (first phase)
**Requirements:** DSGN-01, DSGN-02, DSGN-03, DSGN-05, DSGN-06, DSGN-07, PLAT-05
**Success Criteria** (what must be TRUE):

  1. Owner can open `/design` and see link, button, input, password+eye, select, checkbox, radio, date range, guest stepper, card, modal, toast, nav, footer, stay card, add-on row, price, and icons in every required state
  2. Components use Questa, Lato, Deep Teal `#1f3b40`, Charcoal `#262626`, Gold `#d4ba8a`, Ivory `#fffaf0`, light only
  3. Arabic preview sets `dir=rtl` on `<html>` and flips layout with logical CSS; password eye stays on inline-end
  4. 404 uses Questa/Lato (no Bricolage); keyboard and visible focus work on every control

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tokens, fonts, `/design` skeleton, password eye, Arabic preview (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Button, link, field, checkbox, radio, switch, and their state rows (wave 2)
- [x] 01-05-PLAN.md — Branded 404 and assemble script (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-06-PLAN.md — Select, dialog, toast, calendar, stepper, chip, and icons (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-03-PLAN.md — Nav, footer, hero booker, stay, add-on, price, video (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-04-PLAN.md — Remaining locked specimen frames, including the date-range error cell (wave 5)

### Phase 2: Platform spine

**Goal:** Guest and owner can authenticate; public and ops are isolated; language and currency persist on the same URLs.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** AUTH-02, AUTH-05, AUTH-06, AUTH-07, I18N-01, I18N-02, I18N-03, OPS-01, PLAT-01, PLAT-02, PLAT-04
**Success Criteria** (what must be TRUE):

  1. Guest account stays inactive until branded confirm email, then magic link + optional password (eye)
  2. Owner `maria@almarprivatejourney.com` signs in with email+password (set in owner terminal); 30-day session; logout-all; logged-out `/ops` is ops sign-in
  3. Guest hitting `/ops` or ops APIs gets 404 / denied; dashboard host (when gated) does not serve marketing
  4. Same URLs for EN/AR/ES; header language + currency; AR is `dir=rtl`; dates DD/MM/YYYY, week Monday, Western numerals

**Plans:** 1/10 plans executed

Plans:

**Wave 1**

- [x] 02-01: Package-legitimacy gates, then the owner creates one Supabase project (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-08: Server runtime on Worker almar, no deploy (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-02: Magic-link account, confirm, and account page (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-03: Auth, account, and 404 in EN/AR/ES, with dates and Western numerals (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-04: Ops host sign-in, guest rejection, touchword handoff, logout-all (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 02-09: Same-URL string map on every Framer page (wave 6) — PAUSED 2026-09-28: Framer HTML is not patched further; React pages in 3.3 and 6 carry EN/AR/ES

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 02-05: Language and currency follow a signed-in account (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 02-10: Convert written prices on every priced page (wave 8) — PAUSED 2026-09-28: prices come from the catalog in 3.2/3.3, not Framer strings

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 02-06: Settings save, contrast gate, and maintenance page (wave 9)

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 02-07: Owner applies the runtime and the ops host route, then wait (wave 10)

### Phase 3: Public site and dashboard

**Goal:** Build the public site and the dashboard as real screens first. Catalogue, connections, and calculations come after. Every component, button, and text is named so a later plan can connect it.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** STAY-03, STAY-04, STAY-05, STAY-06, STAY-07, JOUR-05, PAY-16, OPS-09, CMS-01, CMS-02, CMS-04, CMS-05, CMS-06
**Success Criteria** (what must be TRUE):

  1. Ops can add/remove destinations (seed five) and publish one stay record reused on search / destination / home
  2. A stay with no rates is not bookable; nightly AED month/season + date override works
  3. Deposit-paid / Confirmed nights hard-block; unpaid draft holds 30 minutes; maintenance blocks; overlap is an error
  4. Experiences & Services catalog + inclusions kit on/off per destination and per stay; media is https URLs only (R2, not Supabase storage)

**Plans:** 13 plans

Plans:

- [ ] 03-01-PLAN.md — Connect FX on /framer for the six written amounts. PAY-16 stays deferred.
- [ ] 03-02-PLAN.md — Draw the /dashboard shell, rail, and overlay sidebar.
- [ ] 03-03-PLAN.md — Connect language so copy and dir change on /framer.
- [ ] 03-04-PLAN.md — Hero Search opens an empty /booking/trip. CMS-04 stays deferred.
- [ ] 03-05-PLAN.md — Draw Sign in, Bookings, and Account. Sign in does not send.
- [ ] 03-06-PLAN.md — Connect WhatsApp on /framer and the later public pages.
- [ ] 03-07-PLAN.md — Connect the existing footer form. Success only after a Resend contact id.
- [ ] 03-08-PLAN.md — Draw dashboard Home with empty slots.
- [ ] 03-09-PLAN.md — Draw empty Bookings and Customers tables and sidebars.
- [ ] 03-10-PLAN.md — Draw the empty calendar. OPS-09, STAY-04, and STAY-07 stay deferred.
- [ ] 03-11-PLAN.md — Draw empty catalog editors. Catalogue requirements stay deferred.
- [ ] 03-12-PLAN.md — Draw empty content editors. Publish does not publish.
- [ ] 03-13-PLAN.md — Draw Settings and Profile. Nothing saves.

### Phase 3.1: Design system and journey bar (INSERTED)

**Goal:** One consolidated design system, then the journey bar and booking components built on it, before any new page.
**Mode:** mvp
**Depends on:** Phase 1 (no platform dependency)
**Requirements:** DSGN-01, DSGN-02, DSGN-03, DSGN-05
**Source:** design canvas "ALMAR Design System Audit", boards 1–8a (2026-09-28)
**Success Criteria** (what must be TRUE):

  1. Brand-book palette plus semantic tokens only, from one `tokens.json`; `#d1dfe0` is `--color-teal-tint` (backgrounds only); no raw hex or px font sizes outside the token source (failing test)
  2. Tailwind v4 is the only styling method: `globals.css` and every CSS module converted into component utilities; the 47 "Comment N" patches folded in; no styles keyed to route ids or to a parent like `.nav-tools`
  3. One named type scale (Questa / Lato, Noto for Arabic), 12px floor; gold never as text on ivory or white
  4. Logos served from `brand/`, one `next.config.ts`
  5. The design-system canvas (claude.ai, 7 pages) is signed off page by page; journey bar (desktop 72px bar, phone one-tap entry + Where → When → Who steps), StepRail, AddOnRow, InclusionsList, JourneyCart are coded and match the canvas in a component-test harness in every state, EN/AR/ES, RTL; `/design` and `/framer` are removed
  6. No stock or invented people anywhere in React code, copy, or the canvas

**Plans:** 9/29 plans executed

Plans:
- [x] 03.1-01-PLAN.md — Canvas Foundations and Components pages, owner gate (D-09)
- [x] 03.1-02-PLAN.md — Wave 0: before-screenshots baseline, Playwright config
- [x] 03.1-03-PLAN.md — Package legitimacy check and install of class-variance-authority and tailwind-merge
- [x] 03.1-04-PLAN.md — tokens.json, @theme generator, cn helper, D-29 guardrail test
- [x] 03.1-05-PLAN.md — lib/copy/ catalog, AR/ES parity test, team names removed, embed proof
- [x] 03.1-06-PLAN.md — One next.config.ts, stacked lockup saved into brand/
- [ ] 03.1-07-PLAN.md — Delete /design and /framer and dead specimens, repoint tests
- [x] 03.1-08-PLAN.md — Controls to Tailwind: Button, Link, Chip, ToggleCard, Stepper, Field, Checkbox, Switch
- [x] 03.1-09-PLAN.md — Overlays to Tailwind: Dialog, ConfirmDialog, Toast, WhatsApp, DateField, Calendar
- [x] 03.1-10-PLAN.md — Journey copy in EN/AR/ES, guest-summary formatter, shared types and fixtures
- [ ] 03.1-11-PLAN.md — Canvas Journey page and tokens install, owner gate
- [ ] 03.1-12-PLAN.md — LocaleSelect (/account fix), nav and footer, logos from brand/
- [ ] 03.1-13-PLAN.md — Dashboard shell, sidebar, profile and settings to Tailwind
- [ ] 03.1-14-PLAN.md — Flag-gated test harness route and scene contract
- [ ] 03.1-15-PLAN.md — Canvas Public pages page, owner gate
- [ ] 03.1-16-PLAN.md — Guest screens, status pages and layout to Tailwind
- [ ] 03.1-17-PLAN.md — Dashboard Home, Bookings, Customers to Tailwind
- [ ] 03.1-18-PLAN.md — Dashboard Calendar, Catalog, Content to Tailwind
- [ ] 03.1-19-PLAN.md — DateRangePanel, GuestPanel, DestinationMenu
- [ ] 03.1-20-PLAN.md — StepRail, AddOnRow, InclusionsList
- [ ] 03.1-21-PLAN.md — JourneyCart and TeamSection
- [ ] 03.1-22-PLAN.md — Canvas Guest page, owner gate
- [ ] 03.1-23-PLAN.md — Hero-booker (embed) to Tailwind, embed proof
- [ ] 03.1-24-PLAN.md — JourneySegment and JourneyBar
- [ ] 03.1-25-PLAN.md — JourneySheet, phone entry and docked row
- [ ] 03.1-26-PLAN.md — Canvas Dashboard page, owner gate
- [ ] 03.1-27-PLAN.md — Final globals.css, strict guardrail, after-screenshots, production proof
- [ ] 03.1-28-PLAN.md — Harness matrix screenshots, RTL and accessibility specs, report
- [ ] 03.1-29-PLAN.md — Owner UAT and DSGN-01 wording

### Phase 3.2: Real catalog and team (INSERTED)

**Goal:** Ops can create and publish destinations, stays with rates, experiences and services with images, the inclusions kit, and team members; the data lives in Supabase.
**Mode:** mvp
**Depends on:** Phase 3.1; Phase 2 plans 02-08 (server runtime) and 02-04 (ops sign-in)
**Requirements:** CMS-01, CMS-02, STAY-03, STAY-05, STAY-06 (confirm at discuss)
**Success Criteria** (what must be TRUE):

  1. Dashboard Catalog (Destinations, Stays, Experiences & Services, Packages) and Content › Team save, publish and unpublish through Supabase
  2. Every experience and service has an image (https, Cloudflare), a type, a unit and a destination link
  3. The three fake team members are gone; public Team reads only published members
  4. Catalog and Team screens use the dense dashboard variant of the 3.1 system

**Plans:** TBD

### Phase 3.3: Booking-path pages (INSERTED)

**Goal:** The pages a guest passes through before booking are React on the same URLs, reading the 3.2 catalog.
**Mode:** mvp
**Depends on:** Phase 3.2
**Requirements:** SITE (home, destinations, experiences, private stays) — confirm at discuss
**Success Criteria** (what must be TRUE):

  1. `/`, `/private-stays`, `/private-stays/*`, `/destinations`, `/experiences` render from React with the Framer look on 3.1 tokens
  2. Home hero carries the journey bar; Search opens `/booking/trip`
  3. EN / AR / ES with real RTL on every section; contact stays `inquiries@almarprivatejourney.com` / `+971 56 388 3302`
  4. Each template cuts over on Cloudflare one at a time (owner gate); the other Framer routes keep serving

**Plans:** TBD

### Phase 4: Book and pay

**Goal:** A guest can complete a real one-destination trip (stay + add-ons + pay) on TEST Stripe.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-08, STAY-01, STAY-02, JOUR-01, JOUR-02, JOUR-03, JOUR-04, ADDN-01, IDEN-01, IDEN-02, PAY-01, PAY-02, PAY-03, PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10, PAY-13, PAY-14, PAY-15, PAY-17, AUTH-01, OPS-10, OPS-13
**Success Criteria** (what must be TRUE):

  1. Guest searches from the hero (one destination, dates, guests) with no charge, then completes `/booking/trip` and can go back until pay
  2. Sold-out / too many guests / min nights show a reason; 30-minute pay hold; expiry restarts stay pick
  3. Checkout shows nights → add-ons → coupon → subtotal → VAT → grand → deposit or full; damage hold separate; Payment Element card + Apple Pay + Link on TEST; webhook marks paid; refresh does not double-charge
  4. Guest gets `ALMAR-XXXXXX`, email receipt + PDF, booking page as source of truth; exact address only after Confirmed

**Plans:** TBD

Plans:

- [ ] 04-01: Hero + `/booking/trip` stay overlay + add-ons + travelers
- [ ] 04-02: Money math, FX lock, Payment Element, two PaymentIntents, webhook
- [ ] 04-03: Confirmation email/PDF + booking page + 30-min hold job

### Phase 5: Ops OS

**Goal:** Owner can run the booking and the brand from `/ops` with no guest access.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** DSGN-04, STAY-08, JOUR-06, JOUR-07, ADDN-02, IDEN-03, PAY-04, PAY-11, PAY-12, AUTH-03, AUTH-04, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-11
**Success Criteria** (what must be TRUE):

  1. Owner uses Home · Bookings · Customers · Calendar · Catalog · Content · Settings · Profile
  2. Ops can filter bookings, change status, create a booking, send a pay link, refund ≤ captured, release/capture damage hold, mark Driver assigned, send “flight booked”
  3. Settings Publish applies brand tokens site-wide; VAT % and deposit % work; reminders fire for unpaid remainder
  4. Passport/ID is encrypted and opens only after extra owner confirm; guest can change email/phone and delete account (PII stripped)

**Plans:** TBD

Plans:

- [ ] 05-01: Ops shell, bookings, customers, notes, audit, CSV
- [ ] 05-02: Settings (brand, VAT, deposit, templates, maintenance) + money actions

### Phase 6: Site and rest of CMS

**Goal:** The remaining public pages (About, Contact, Services and service detail, Blog and posts) are React, the Framer bridge is removed; remaining Active CMS (packages, consult, content) is live.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** BOOK-05, BOOK-06, BOOK-07, ADDN-03, I18N-04, SITE-01, SITE-02, SITE-03, SITE-04, SITE-05, SITE-06, SITE-07, SITE-08, SITE-09, SITE-10, SITE-11, SITE-12, SITE-13, OPS-12, CMS-03, CMS-07, CMS-08, CMS-09, PLAT-03
**Success Criteria** (what must be TRUE):

  1. Framer `route.ts` pages are replaced with React on the same URLs; contact stays `inquiries@almarprivatejourney.com` / `+971 56 388 3302`
  2. Nav, home, WhatsApp, Plan with us, List with us, Contact calendar, legal, blog, cookies, newsletter, sitemap/robots all work
  3. Ops types English; Publish translates AR/ES (editable, lockable); packages Explorer/Resident/Sovereign request-then-pay
  4. Share and signed-in favorites work; promo codes CMS works

**Plans:** TBD

Plans:

- [ ] 06-01: Replace Framer marketing routes with tokenized pages
- [ ] 06-02: Packages, consult, Plan/List with us, content CMS, i18n publish

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 3.2 → 3.3 → 4 → 5 → 6. Phase 3.1 can start now; 3.2 waits on 02-08 and 02-04.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design system | 6/6 | Complete   | 2026-09-23 |
| 2. Platform spine | 1/10 | In Progress|  |
| 3. Catalog and calendar | 0/2 | Not started | - |
| 3.1 Design system and journey bar | 9/29 | In Progress|  |
| 3.2 Real catalog and team | 0/? | Not started | - |
| 3.3 Booking-path pages | 0/? | Not started | - |
| 4. Book and pay | 0/3 | Not started | - |
| 5. Ops OS | 0/2 | Not started | - |
| 6. Site and rest of CMS | 0/2 | Not started | - |
