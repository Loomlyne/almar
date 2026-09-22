# Roadmap: ALMAR Private Journeys

## Overview

Rebuild the Framer HTML export into a live booking OS. Tokens and components first, then auth/i18n spine, then real inventory, then a guest can pay a deposit on `/booking/trip`, then ops can run the trip from `/ops`, then the rest of the public site and remaining CMS replace the brochure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Design system** - Tokens, core components, RTL states, owner `/design`
- [ ] **Phase 2: Platform spine** - Supabase auth, host gate, locale/currency, no ops leak
- [ ] **Phase 3: Catalog and calendar** - Destinations, stays, rates, hard-block nights
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
**Plans:** TBD

Plans:
- [ ] 01-01: Tokens from brand book + live Framer measure
- [ ] 01-02: Core components + `/design` + branded 404

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
**Plans:** TBD

Plans:
- [ ] 02-01: Supabase clients, RLS, owner + guest auth
- [ ] 02-02: Middleware host gate + next-intl cookie + wrangler stub (no live CF create)

### Phase 3: Catalog and calendar
**Goal:** Ops can publish real stays with rates; overlapping nights cannot be booked.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** STAY-03, STAY-04, STAY-05, STAY-06, STAY-07, JOUR-05, PAY-16, OPS-09, CMS-01, CMS-02, CMS-04, CMS-05, CMS-06
**Success Criteria** (what must be TRUE):
  1. Ops can add/remove destinations (seed five) and publish one stay record reused on search / destination / home
  2. A stay with no rates is not bookable; nightly AED month/season + date override works
  3. Deposit-paid / Confirmed nights hard-block; unpaid draft holds 30 minutes; maintenance blocks; overlap is an error
  4. Experiences & Services catalog + inclusions kit on/off per destination and per stay; media is https URLs only (R2, not Supabase storage)
**Plans:** TBD

Plans:
- [ ] 03-01: Schema, destinations, stays, rates, occupancy uniqueness
- [ ] 03-02: Experiences & Services, inclusions, Draft → Publish, SEO required

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
**Goal:** Public pages are React, not Framer HTML; remaining Active CMS (packages, consult, content) is live.
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design system | 0/2 | Not started | - |
| 2. Platform spine | 0/2 | Not started | - |
| 3. Catalog and calendar | 0/2 | Not started | - |
| 4. Book and pay | 0/3 | Not started | - |
| 5. Ops OS | 0/2 | Not started | - |
| 6. Site and rest of CMS | 0/2 | Not started | - |
