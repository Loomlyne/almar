# Requirements: ALMAR Private Journeys

**Defined:** 2026-09-22
**Core Value:** A guest can complete a real trip booking (stay + add-ons + pay) and ops can run that booking and the public site from one branded system — no fake controls.

## v1 Requirements

Requirements for this product. Each maps to roadmap phases.

### Design system

- [ ] **DSGN-01**: Owner can open `/design` (owner-only) and see every core component in hover, focus, disabled, loading, error, and empty states
- [x] **DSGN-02**: Guest and ops see the same token system (Questa primary, Lato secondary; Deep Teal `#1f3b40`, Charcoal `#262626`, Gold `#d4ba8a`, Ivory `#fffaf0`; light theme only)
- [x] **DSGN-03**: Guest sees RTL-flipped components when language is Arabic (`dir=rtl` on `<html>`, logical CSS, password eye on inline-end)
- [ ] **DSGN-04**: Ops can change brand tokens (colors, uploaded font family, light/dark logos, favicon) in Settings → Brand and Publish applies immediately on public and dashboard
- [ ] **DSGN-05**: Guest sees icons as vector components using token colors; icon-only controls have an accessible name
- [ ] **DSGN-06**: Guest sees branded 404 using Questa/Lato (no Bricolage)
- [ ] **DSGN-07**: Autoplay video is muted and pauses when off-screen; motion is kept

### Discover and booking

- [ ] **BOOK-01**: Guest can search from the hero with one destination, date range, and adults/children/infants without being charged
- [ ] **BOOK-02**: Guest is taken to `/booking/trip` and can go summary → choose stay (overlay + filter) → add-ons → traveler details → pay, and can go back and edit until pay
- [ ] **BOOK-03**: Guest sees a 30-minute hold on the pay step; on expiry the stay pick restarts
- [ ] **BOOK-04**: Guest books one destination per booking; a second city in the same timeline opens WhatsApp to ops with the booking id prefilled
- [ ] **BOOK-05**: Guest sees package cards under the hero booker; choosing a package opens its page then a tailored `/booking/trip` (request → ops confirm → deposit or full)
- [ ] **BOOK-06**: Guest can share a stay (copy / WhatsApp / native share)
- [ ] **BOOK-07**: Signed-in guest can favorite a stay; unsigned guest cannot
- [ ] **BOOK-08**: Guest sees an approximate map publicly and the exact stay address only after Confirmed

### Stays and calendar

- [ ] **STAY-01**: Guest sees stays for the chosen destination, dates, and occupancy; sold-out / too many guests / min nights are shown with a reason, not hidden
- [ ] **STAY-02**: Guest cannot select a party over stay max; adults always count, children always count, infants count only if that stay’s toggle is on (ages 0–2 / 3–12 / 13+)
- [ ] **STAY-03**: Guest cannot book a stay with no rates
- [ ] **STAY-04**: Overlapping Deposit-paid or Confirmed nights are a hard block; unpaid draft holds 30 minutes; ops maintenance blocks dates
- [ ] **STAY-05**: Guest sees pets rule per stay (allowed / not / fee)
- [ ] **STAY-06**: Min nights default to 1 per stay; there is no max nights
- [ ] **STAY-07**: Same-day Instant Book respects ops cutoff hours/days per destination (UAE timezone)
- [ ] **STAY-08**: After pay, longer/shorter stay is an ops request (no auto refund on shorten)

### Journey and inclusions

- [ ] **JOUR-01**: Guest picks UAE airport at checkout (Dubai / Abu Dhabi / Sharjah); return is the same airport
- [ ] **JOUR-02**: Airport meet is included by default; home pickup is an add-on with address book Home/Work/Custom (auto if one; add during booking if none)
- [ ] **JOUR-03**: If home pickup was bought, return home uses the same address unless the guest changes it
- [ ] **JOUR-04**: Guest sees the inclusions kit as included (no price) unless an extra add-on; default kit is airport meet, Colombia transfer, stay, guide, security, insurance, return
- [ ] **JOUR-05**: Ops can turn inclusions on/off per destination and override per stay; turning off removes them from trip and price
- [ ] **JOUR-06**: After deposit, ops can fill flight details and click Send; guest gets “flight booked” email and status (flights are not picked on site)
- [ ] **JOUR-07**: Ops can mark Driver assigned; guest sees the status without a driver phone (no Careem/Uber API)

### Add-ons

- [ ] **ADDN-01**: Guest can add destination experiences/services plus global ones, priced per-night or per-stay as set in CMS, charged as a group
- [ ] **ADDN-02**: After pay, an unverified guest can add add-ons and pay the difference; a signed-in guest requests any other change and waits for ops (price-difference link, no auto refund)
- [ ] **ADDN-03**: Package included add-ons cannot be removed; extra custom requests go to WhatsApp

### Checkout identity

- [ ] **IDEN-01**: Guest must enter name, email, phone and accept booking terms to pay; nationality, special requests, and emergency contact are optional
- [ ] **IDEN-02**: Traveler lines match guest count; booker can mark “I am not staying”; children and infants get name + age
- [ ] **IDEN-03**: Passport/ID is optional at checkout, stored encrypted; owner opens it only after extra confirm; guest delete strips PII and bookings remain for ops

### Money

- [ ] **PAY-01**: Guest sees breakdown in order: nights, add-ons, coupon, subtotal, VAT, grand total, then deposit or full amount; damage hold is listed separately as “temporarily held”
- [ ] **PAY-02**: VAT % comes from Settings; deposit is Settings % of grand total (example: 1000 + 5% = 1050; 30% of 1050); VAT is not applied twice
- [ ] **PAY-03**: Guest can pay deposit or pay in full; full skips remainder and reminders
- [ ] **PAY-04**: Ops can change deposit % until first payment, then it locks (no min deposit %)
- [ ] **PAY-05**: Guest can apply one coupon (% or amount, expiry, max uses, max uses per email) on the total then deposit %; total cannot go below 0
- [ ] **PAY-06**: Guest pays on branded `/booking/trip` with Stripe Payment Element (card + Apple Pay + Link); never a Stripe hosted page; never raw PAN; ops sees last 4 only
- [ ] **PAY-07**: No saved cards in our app; no split pay; no gift cards; no BNPL
- [ ] **PAY-08**: Stripe is TEST until a dedicated go-live plan
- [ ] **PAY-09**: 3DS runs when the bank requires it; pay is idempotent; webhook is source of truth; refresh does not create a new charge
- [ ] **PAY-10**: Remainder and extra charges use the same branded checkout
- [ ] **PAY-11**: Unpaid remainder gets at most 3 default reminders (ops sets day/time, can add more); unpaid by deadline → cancelled, deposit kept; skip if paid in full
- [ ] **PAY-12**: Refunds are never automatic; ops starts a Stripe refund to the original payment, never more than captured; chargebacks are visible with no auto-refund
- [ ] **PAY-13**: Damage hold is a separate Stripe auth (not capture), amount per stay, at checkout; ops release/capture only; coupon does not reduce the hold
- [ ] **PAY-14**: Booking reference is `ALMAR-XXXXXX`
- [ ] **PAY-15**: Guest is charged in the selected currency (AED default, or USD/EUR); live FX is cached and locked for the 30-min hold; FX fail uses last cache; new booking uses new FX; currency switch on pay restarts the hold
- [ ] **PAY-16**: Nightly rates are AED by month/season with date overrides; Stripe fees, service, and cleaning sit in the subtotal; add-ons convert like nights
- [ ] **PAY-17**: Guest receives email receipt + PDF; ops can resend; emails are in the guest’s site language

### Auth

- [ ] **AUTH-01**: Guest can check out without an account; email remembers bookings; later signup merges by email
- [ ] **AUTH-02**: Guest account is inactive until branded confirmation email; then magic link + optional password (right-side eye)
- [ ] **AUTH-03**: Guest can change email/phone (email re-verify) and can log out; password fields always have a right-side show/hide eye
- [ ] **AUTH-04**: Guest can delete account (PII stripped, bookings remain for ops)
- [ ] **AUTH-05**: Owner `maria@almarprivatejourney.com` signs in with email + password only (password set in owner terminal, never from chat); 30-day session; logout-all
- [ ] **AUTH-06**: Guests have zero dashboard access; logged-out dashboard is the ops sign-in, not the marketing homepage
- [ ] **AUTH-07**: Auth pages are branded and support EN/AR/ES with RTL

### Languages and chrome

- [ ] **I18N-01**: Guest uses the same URLs in EN, AR, and ES (no `/en` `/ar` `/es`); toggle is remembered; default EN; AR is real RTL
- [ ] **I18N-02**: Language and currency switchers are in the header; language switch keeps currency
- [ ] **I18N-03**: Dates are DD/MM/YYYY, week starts Monday, Western numerals in AR
- [ ] **I18N-04**: Ops types English; Publish auto-translates AR/ES (editable, lockable); English change re-translates unless locked
- [ ] **SITE-01**: Nav is Destinations · Experiences & Services (merged, search/filter) · About · Contact · Log in (Log in last, not removable)
- [ ] **SITE-02**: Home keeps current section order with the booker in the hero; Stories hide if all hidden/deleted; public team is founder + co-founder until more are published
- [ ] **SITE-03**: WhatsApp `+971 56 388 3302` floats on every public page; Contact has name, email, phone, message + calendar
- [ ] **SITE-04**: Plan with us is a request (destination, dates, guests, notes, budget, UAE airport) with no pay
- [ ] **SITE-05**: List with us is footer-only (name, email, phone, property type, city, message); no partner login
- [ ] **SITE-06**: Consultation is Contact-only: 30 min, Dubai time shown in guest local, ops slots, no overlap
- [ ] **SITE-07**: Cookie banner has necessary / analytics / marketing (CMS copy); analytics fire only if accepted
- [ ] **SITE-08**: Footer newsletter goes to Resend; keep current footer plus List with us
- [ ] **SITE-09**: Legal CMS pages exist: privacy, terms, booking terms, waiver, disclaimer
- [ ] **SITE-10**: Blog/Stories have CMS + search and no comments; hide-all hides the section
- [ ] **SITE-11**: Sitemap lists published public URLs; robots allow public and disallow dashboard
- [ ] **SITE-12**: Public forms have an invisible spam trap (no captcha)
- [ ] **SITE-13**: Contact stays `inquiries@almarprivatejourney.com` / `+971 56 388 3302` (do not invent replacements)

### Ops dashboard

- [ ] **OPS-01**: Ops uses `dashboard.almarprivatejourney.com` when DNS is gated; until then local `/ops` with no public link
- [ ] **OPS-02**: Ops nav is Home · Bookings · Customers · Calendar · Catalog (Destinations, Stays, Experiences & Services, Packages) · Content (Pages, Blog, Team, Legal) · Settings · Profile
- [ ] **OPS-03**: Home shows bookings, revenue (captured − refunds), cost, outstanding remainder, occupancy by destination, reminders, charts; analytics in AED; date dropdown this month / last 30 / custom; profit = revenue − ops costs (stay, flight, transfer, guide, security, other)
- [ ] **OPS-04**: Ops can search and filter bookings (status, destination, dates); one booking = 1 destination + 1 stay + add-ons + journey
- [ ] **OPS-05**: Statuses are Draft → Deposit paid → Confirmed → In trip → Completed / Cancelled, plus Driver assigned and Flights booked; ops clicks In trip / Completed
- [ ] **OPS-06**: Ops can create a booking and send a pay link
- [ ] **OPS-07**: Ops internal notes are staff-only; audit log is timestamp + action; CSV export works
- [ ] **OPS-08**: Customer profile shows photo, locked passport/ID, customer since, first booking, counts, phone, email, nationality, emergency, address book, bookings
- [ ] **OPS-09**: Calendar is UAE timezone; conversion code exists but is off; overlap is a hard block
- [ ] **OPS-10**: Stay access (wifi, door, exact address) is visible to the guest only after Confirmed
- [ ] **OPS-11**: Settings hold brand tokens, VAT %, default deposit %, live FX (not manual), email templates, reminders, confirmation, maintenance mode, logos
- [ ] **OPS-12**: Promo codes are managed in CMS
- [ ] **OPS-13**: Guest booking page is the source of truth after pay

### CMS

- [ ] **CMS-01**: Destinations are CMS; seed Cartagena, Medellín, Bogotá, San Andrés, Cocora Valley; ops can add/remove without code
- [ ] **CMS-02**: Experiences & Services are one catalog with type + price sort + destination filter (including All); items can apply to many destinations
- [ ] **CMS-03**: Packages v1: Explorer / Resident / Sovereign (ops can add/rename/hide); group price; stay per city; multi-city only via packages
- [ ] **CMS-04**: One stay record is reused on search / destination / home (no clone); unpublish hides, old bookings keep data
- [ ] **CMS-05**: Draft → Publish with owner-only preview; SEO (from English, then translated) is required to publish
- [ ] **CMS-06**: Media is https URLs only (Cloudflare R2/Images — never Supabase storage)
- [ ] **CMS-07**: Pages CMS can show/hide sections; hero image or video URL per page
- [ ] **CMS-08**: Team CMS includes Maria Del Mar Valdes (founder) and María Francis (co-founder) with emails, phone, WhatsApp, Instagram, photo; public About uses published members
- [ ] **CMS-09**: Nav CMS is label + link + show/hide; Log in stays last

### Platform

- [ ] **PLAT-01**: One Supabase project for data + auth only (no storage)
- [ ] **PLAT-02**: Cloudflare hosts the app and R2/Images (create/DNS owner-gated); no Vercel deploy
- [ ] **PLAT-03**: Rebuild uses real App Router pages; Framer HTML `route.ts` is visual reference until each URL is replaced (not string-patched as the product)
- [ ] **PLAT-04**: Owner auto-confirm until changed; guest confirm email is required
- [ ] **PLAT-05**: Keyboard, visible focus, field errors, and translated alt text work on public and ops

## v2 Requirements

Deferred. Not in the current roadmap.

- **AUTH-V2-01**: Owner passkey + 2FA in settings
- **BOOK-V2-01**: Instant multi-city in the hero (until then packages / WhatsApp only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Instant multi-city in the hero | Deferred; packages / ops WhatsApp only |
| Partner dashboard / List with us accounts | Form only |
| Vercel deploy | Leftover exporter; host is Cloudflare |
| Inquiry-only freeze (July 2026 Notion) | Superseded by this booking OS |
| Fake testimonials | None until real guests |
| Comments on stories | Out of scope |
| Gift cards, BNPL, split pay, saved cards in our app | Product ban |
| Careem/Uber API | Ops marks Driver assigned |
| Stripe live charges | Until dedicated go-live plan |
| `/en` `/ar` `/es` URL prefixes | Same URLs, language toggle |
| Dark mode | Brand book: light only |
| Extra-person fee | Another stay if over max |
| Max nights | None |
| Min deposit % | Ops sets default % only |
| Storing owner password from chat | Secret handling |
| Other products (Vamos, Invios, Clickit) | Workspace lock |
| Inventing a live custom domain before purchase | Intended later: almarprivatejourney.com + dashboard.almarprivatejourney.com |
| Brand-book “chauffeur service” and `+971 50 975 8018` | Brief/site win |
| Eje Cafetero until ops adds it | CMS, not code |
| vinext / OpenNext 1.20.x / Next 15–16 | Pin is Next 14.2.35 + OpenNext 1.15.x until a gated bump |
| Supabase Storage | R2 only |
| Stripe hosted Checkout / Card Element / PAN in our app | Payment Element only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DSGN-01 | Phase 1 | Pending |
| DSGN-02 | Phase 1 | Complete |
| DSGN-03 | Phase 1 | Complete |
| DSGN-04 | Phase 5 | Pending |
| DSGN-05 | Phase 1 | Pending |
| DSGN-06 | Phase 1 | Pending |
| DSGN-07 | Phase 1 | Pending |
| BOOK-01 | Phase 4 | Pending |
| BOOK-02 | Phase 4 | Pending |
| BOOK-03 | Phase 4 | Pending |
| BOOK-04 | Phase 4 | Pending |
| BOOK-05 | Phase 6 | Pending |
| BOOK-06 | Phase 6 | Pending |
| BOOK-07 | Phase 6 | Pending |
| BOOK-08 | Phase 4 | Pending |
| STAY-01 | Phase 4 | Pending |
| STAY-02 | Phase 4 | Pending |
| STAY-03 | Phase 3 | Pending |
| STAY-04 | Phase 3 | Pending |
| STAY-05 | Phase 3 | Pending |
| STAY-06 | Phase 3 | Pending |
| STAY-07 | Phase 3 | Pending |
| STAY-08 | Phase 5 | Pending |
| JOUR-01 | Phase 4 | Pending |
| JOUR-02 | Phase 4 | Pending |
| JOUR-03 | Phase 4 | Pending |
| JOUR-04 | Phase 4 | Pending |
| JOUR-05 | Phase 3 | Pending |
| JOUR-06 | Phase 5 | Pending |
| JOUR-07 | Phase 5 | Pending |
| ADDN-01 | Phase 4 | Pending |
| ADDN-02 | Phase 5 | Pending |
| ADDN-03 | Phase 6 | Pending |
| IDEN-01 | Phase 4 | Pending |
| IDEN-02 | Phase 4 | Pending |
| IDEN-03 | Phase 5 | Pending |
| PAY-01 | Phase 4 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 4 | Pending |
| PAY-04 | Phase 5 | Pending |
| PAY-05 | Phase 4 | Pending |
| PAY-06 | Phase 4 | Pending |
| PAY-07 | Phase 4 | Pending |
| PAY-08 | Phase 4 | Pending |
| PAY-09 | Phase 4 | Pending |
| PAY-10 | Phase 4 | Pending |
| PAY-11 | Phase 5 | Pending |
| PAY-12 | Phase 5 | Pending |
| PAY-13 | Phase 4 | Pending |
| PAY-14 | Phase 4 | Pending |
| PAY-15 | Phase 4 | Pending |
| PAY-16 | Phase 3 | Pending |
| PAY-17 | Phase 4 | Pending |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 5 | Pending |
| AUTH-04 | Phase 5 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| AUTH-07 | Phase 2 | Pending |
| I18N-01 | Phase 2 | Pending |
| I18N-02 | Phase 2 | Pending |
| I18N-03 | Phase 2 | Pending |
| I18N-04 | Phase 6 | Pending |
| SITE-01 | Phase 6 | Pending |
| SITE-02 | Phase 6 | Pending |
| SITE-03 | Phase 6 | Pending |
| SITE-04 | Phase 6 | Pending |
| SITE-05 | Phase 6 | Pending |
| SITE-06 | Phase 6 | Pending |
| SITE-07 | Phase 6 | Pending |
| SITE-08 | Phase 6 | Pending |
| SITE-09 | Phase 6 | Pending |
| SITE-10 | Phase 6 | Pending |
| SITE-11 | Phase 6 | Pending |
| SITE-12 | Phase 6 | Pending |
| SITE-13 | Phase 6 | Pending |
| OPS-01 | Phase 2 | Pending |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 5 | Pending |
| OPS-04 | Phase 5 | Pending |
| OPS-05 | Phase 5 | Pending |
| OPS-06 | Phase 5 | Pending |
| OPS-07 | Phase 5 | Pending |
| OPS-08 | Phase 5 | Pending |
| OPS-09 | Phase 3 | Pending |
| OPS-10 | Phase 4 | Pending |
| OPS-11 | Phase 5 | Pending |
| OPS-12 | Phase 6 | Pending |
| OPS-13 | Phase 4 | Pending |
| CMS-01 | Phase 3 | Pending |
| CMS-02 | Phase 3 | Pending |
| CMS-03 | Phase 6 | Pending |
| CMS-04 | Phase 3 | Pending |
| CMS-05 | Phase 3 | Pending |
| CMS-06 | Phase 3 | Pending |
| CMS-07 | Phase 6 | Pending |
| CMS-08 | Phase 6 | Pending |
| CMS-09 | Phase 6 | Pending |
| PLAT-01 | Phase 2 | Pending |
| PLAT-02 | Phase 2 | Pending |
| PLAT-03 | Phase 6 | Pending |
| PLAT-04 | Phase 2 | Pending |
| PLAT-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 104 total
- Mapped to phases: 104
- Unmapped: 0 ✓


---
*Requirements defined: 2026-09-22*
*Last updated: 2026-09-22 after research synthesis*
