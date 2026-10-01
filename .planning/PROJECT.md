# ALMAR Private Journeys

## What This Is

A branded booking OS for ALMAR Private Journeys: UAE-based guests book a private Colombia trip (one destination at a time) with stay, add-ons, airport meet, and return — then pay a deposit or in full. Ops runs everything from a branded dashboard (CMS, bookings, customers, calendar, money, brand tokens). The current repo is a Framer→Next.js HTML export (portfolio only). This product is a rebuild, not string-patches on those files.

## Core Value

A guest can complete a real trip booking (stay + add-ons + pay) and ops can run that booking and the public site from one branded system — no fake controls.

## Requirements

### Validated

- ✓ Public marketing pages exist as Framer HTML route handlers (`app/**/route.ts`) — existing
- ✓ Contact shown: `inquiries@almarprivatejourney.com` / `+971 56 388 3302` — existing
- ✓ Sections/nav exist (Destinations, Experiences, Services, About, Contact, private stays, blog stubs) — existing
- ✓ Branded 404 catch-all — existing
- ✓ Self-hosted fonts/images under `public/assets/*` (mixed with remote Framer CDN) — existing

### Active

**Design system (first)**

- [ ] Tokens measured from the live Framer site + brand book (Questa primary, Lato secondary; Deep Teal `#1f3b40`, Charcoal `#262626`, Gold `#d4ba8a`, Ivory `#fffaf0`; merge with how the site already uses them)
- [ ] Build small → big: icons (brand-book vectors) → link → button → inputs (password + right-side eye) → select/checkbox/radio → date range → guest stepper → card → modal → toast → nav/footer → stay card → add-on row → price → sections
- [ ] Every component: hover, focus, disabled, loading, error, empty; real RTL flip for Arabic
- [ ] Same system on public site and dashboard (dashboard denser)
- [ ] Owner-gated `/design` route shows every component in every state
- [ ] Settings → Brand: colors, uploaded font family, light/dark logos, favicon; Publish applies immediately site-wide
- [ ] Light theme only (no dark mode). Keep motion; mute autoplay video; pause off-screen
- [ ] Update 404 to Questa/Lato (drop Bricolage)

**Public booking**

- [ ] Hero: Where (one destination) · When (from–to) · Who (adults, children, infants) · Search
- [ ] Path `/booking/trip`: summary → choose stay (overlay, filter) → add-ons → traveler details → pay
- [ ] Hero never charges; first charge is the last step (Deposit or Pay in full)
- [ ] Guest can go back and edit until pay; 30-minute FOMO hold on pay step; on expiry restart stay pick
- [ ] One destination per booking; second city in the same timeline = WhatsApp ops (prefilled booking id); another time = new booking
- [ ] Stays: one per destination; sold-out / too many guests / min nights shown with reason, not hidden
- [ ] Add-ons = that destination’s experiences/services (+ global ones), priced per stay (group), per-night or per-stay in CMS
- [ ] Traveler lines = guest count (booker can mark “I am not staying”); children/infants get name+age; passport/ID optional, encrypted, owner opens with extra confirm
- [ ] Checkout required: name, email, phone; nationality optional; special requests free text; emergency optional; accept booking terms
- [ ] UAE airport guest-picked at checkout: Dubai / Abu Dhabi / Sharjah
- [ ] Default: airport meet; home pickup is an add-on (address book: Home/Work/Custom; auto if one; add during booking if none)
- [ ] Return: same UAE airport; if home pickup bought, return home same address unless changed
- [ ] Guest checkout without account (email remembers bookings) or sign-in/sign-up; later signup merges by email
- [ ] After pay: email + booking page (source of truth). Guest (unverified): add-ons only + pay difference. Signed-in: request any change, wait for ops (price difference link / no auto refund)
- [ ] Open booking from email after email verify
- [ ] Consultation only on Contact (in-app calendar, 30 min, Dubai time, ops slots, no overlap)
- [ ] Plan with us: destination, dates, guests, notes, budget, UAE airport — request, no pay
- [ ] List with us: footer form (name, email, phone, property type, city, message) — no partner login
- [ ] Contact: name, email, phone, message + calendar + WhatsApp floating every page (`+971 56 388 3302`)
- [ ] Nav: Destinations · Experiences & Services (merged, search/filter) · About · Contact · Log in
- [ ] Home: keep current section order; booker in hero; package cards under booker; Stories section hides if all hidden/deleted; team = founder + co-founder until more published
- [ ] Destinations: CMS, seed 5 (Cartagena, Medellín, Bogotá, San Andrés, Cocora Valley); ops can add/remove any
- [ ] Experiences & Services: one catalog, type + price sort + destination filter (incl. All); many-to-many destinations
- [ ] Same URLs all languages; toggle EN/AR/ES remembered; AR is real RTL; default EN; no `/en` `/ar` `/es` prefixes
- [ ] Ops types English; Publish auto-translates AR/ES (editable; lockable); re-translate on English change unless locked
- [ ] Currency: default AED; guest AED/USD/EUR; charged in selected; live FX cached, lock for 30-min hold; FX fail → last cache; new booking uses new FX
- [ ] Language + currency switchers in header
- [ ] Dates DD/MM/YYYY, week starts Monday, Western numerals
- [ ] Share stay (copy / WhatsApp / native); favorites signed-in only; approximate map public; exact stay address after Confirmed
- [ ] Cookie banner: necessary / analytics / marketing, CMS copy, real analytics only if accepted
- [ ] Footer newsletter → Resend; keep current footer + List with us
- [ ] Legal CMS: privacy, terms, booking terms, waiver, disclaimer
- [ ] Blog/Stories CMS, search, no comments; hide-all hides section
- [ ] 404 branded; sitemap of published; robots allow public, disallow dashboard
- [ ] Auth pages branded, EN/AR/ES RTL
- [ ] Guest: branded confirmation email required; then magic link + optional password (eye)
- [ ] No age gate; occupancy: adults always, children always, infants on/off per stay; cannot select if over max (show reason)
- [ ] Pets: ops per stay (allowed / not / fee)
- [ ] No extra-person fee; if they need more people, another stay
- [ ] Min nights default 1, per stay; no max nights
- [ ] Deposit-paid and Confirmed block calendar; unpaid draft holds 30 min; ops maintenance blocks; extend/shorten after pay = ops request
- [ ] Stay longer needs ops confirmation
- [ ] Packages v1 CMS: Explorer / Resident / Sovereign (ops can add/rename/hide); group price; request → ops confirm → deposit or full; tailored `/booking/trip`; stay per city; included add-ons not removable; extra custom = WhatsApp; multi-city only via packages
- [ ] `/design` owner-only

**Money**

- [ ] Nightly AED by month/season, date overrides; fake seed rates, ops editable; stay not bookable without rates
- [ ] Add-ons AED, convert like nights
- [ ] Stripe fees, service, cleaning included in subtotal
- [ ] VAT % in Settings, line on checkout; example: 1000 + 5% = 1050; deposit 30% of 1050; remainder is the rest of 1050 (VAT not applied twice)
- [ ] Default deposit % in Settings (no min %); ops can change % until first payment, then lock
- [ ] Pay deposit or pay in full; full = no remainder, no reminders
- [ ] Coupon: one per checkout, % or amount, expiry, max uses, max uses per email; applied to total then deposit %; cannot go below 0
- [ ] Breakdown: nights, add-ons, coupon, subtotal, VAT, grand total, then deposit/full amount; damage hold separate “temporarily held”
- [ ] Custom branded checkout (Stripe Payment Element): card + Apple Pay + Link; never Stripe hosted page; never raw PAN; ops sees last 4 only
- [ ] No saved cards in our app; no split pay; no gift cards; no BNPL
- [ ] TEST Stripe until a dedicated go-live plan (updated while building)
- [ ] 3DS when the bank requires; idempotent pay; webhook repair; refresh = success not new charge
- [ ] Remainder + extra-charge = same branded checkout
- [ ] Reminders: max 3 default timers per booking (ops sets day/time); only if not fully paid; ops can add more; skip if paid in full
- [ ] Remainder unpaid by deadline: cancelled, deposit kept
- [ ] Refunds never automatic; ops starts Stripe refund to original, never more than captured
- [ ] Chargebacks visible, no auto-refund
- [ ] Damage hold: Stripe auth hold (not capture), amount per stay, at checkout, ops release/capture only (most secure path)
- [ ] Booking ref `ALMAR-XXXXXX`
- [ ] Email receipt + PDF + ops resend; emails in the guest’s site language; Resend branded templates ops-editable (EN stored, AR/ES translated)
- [ ] Analytics in AED: bookings, revenue (captured − refunds), outstanding remainder, occupancy by destination, reminders; date dropdown this month / last 30 / custom
- [ ] Profit = revenue − ops costs (stay, flight, transfer, guide, security, other)
- [ ] Flights: ops books after deposit (not on site); ops fills details, clicks Send → email “flight booked”
- [ ] Driver: no Careem API; ops marks Driver assigned; no email; guest sees status without driver phone

**Ops dashboard**

- [ ] Host: `dashboard.almarprivatejourney.com` (DNS owner-gated); until then local `/ops`; no public link
- [ ] Owner only: `maria@almarprivatejourney.com`; email + password (password set in owner terminal, never from chat); 30-day session; logout-all; passkey + 2FA in settings later
- [ ] Guests: zero dashboard access; logged-out dashboard = ops sign-in
- [ ] Nav: Home (analytics) · Bookings · Customers · Calendar · Catalog (Destinations, Stays, Experiences & Services, Packages) · Content (Pages, Blog, Team, Legal) · Settings · Profile
- [ ] Home: bookings, revenue, cost, charts, reminders
- [ ] Bookings: search + filters (status, destination, dates); one booking = 1 destination + 1 stay + add-ons + journey
- [ ] Statuses: Draft → Deposit paid → Confirmed → In trip → Completed / Cancelled + Driver assigned + Flights booked (ops clicks In trip / Completed)
- [ ] Ops can create a booking and send pay link
- [ ] Ops internal notes staff-only; audit log timestamp+action; CSV export
- [ ] Draft → Publish (preview owner-only link); unpublish hides, old bookings keep data; one stay record reused on search/destination/home (no clone)
- [ ] Media: https URLs only (Cloudflare R2/Images — never Supabase storage). Dashboard upload to Cloudflare when gated
- [ ] Customer profile: photo (ops or guest), passport/ID (locked), customer since, first booking, counts, phone, email, nationality, emergency, address book, bookings
- [ ] Team CMS: Maria Del Mar Valdes (founder), María Francis (co-founder); fields: emails, phone, WhatsApp, Instagram, photo; public About uses published members
- [ ] Pages: section show/hide; hero image or video URL per page
- [ ] Settings: brand tokens, VAT %, default deposit %, FX is live not manual, email templates, reminders, confirmation, maintenance mode, logos
- [ ] Inclusions kit: default airport meet, Colombia transfer, stay, guide, security, insurance, return; on/off per destination, override per stay; guest sees included (no price) unless extra add-on
- [ ] Calendar: UAE timezone; conversion code present but off; hard block overlap
- [ ] Same-day: ops cutoff hours/days per destination
- [ ] Stay access (wifi, door, exact address) only after Confirmed
- [ ] SEO required to publish (from English, translated)
- [ ] Promo codes CMS

**Auth / platform**

- [ ] One Supabase: data + auth only (no storage)
- [ ] Cloudflare: host + R2/Images (owner-gated)
- [ ] Guest confirm email branded; owner auto-confirm until changed
- [ ] Delete account: guest can; strip PII; bookings remain for ops
- [ ] Invisible spam trap on public forms
- [ ] Guest can change email/phone (re-verify email)
- [ ] Password fields: right-side eye

### Out of Scope

- Instant multi-city in the hero — deferred; packages / ops WhatsApp only
- Partner dashboard / List with us accounts — form only
- Vercel deploy — leftover exporter; host is Cloudflare
- Inquiry-only freeze (July 2026 Notion) — superseded by this booking OS
- Fake testimonials — none until real guests
- Comments on stories
- Gift cards, BNPL, split pay, saved cards in our app
- Careem/Uber API
- Stripe live charges — until dedicated go-live plan
- `/en` `/ar` `/es` URL prefixes — same URLs, language toggle
- Dark mode
- Extra-person fee
- Max nights
- Min deposit %
- Storing owner password from chat
- Other products (Vamos, Invios, Clickit)
- Inventing a live custom domain before purchase (intended: almarprivatejourney.com + dashboard.almarprivatejourney.com)
- Brand-book “chauffeur service” copy and `+971 50 975 8018` — brief/site win
- Eje Cafetero until ops adds it in CMS

## Context

- Official name: ALMAR PRIVATE JOURNEYS. Brand personality: elegance, transformation, exclusivity. Voice: elegant, exclusive, inspiring, personalized.
- Origin: founder from Colombia; UAE clients want to visit but fear safety; product is 24/7 private, accompanied luxury.
- Brief (Notion) + July 2026 decisions: UAE/GCC-based guests; domain almarprivatejourney.com later; Cartagena & Medellín were the launch freeze — this project seeds five destinations in CMS instead.
- Codebase at the start (2026-09-22): Next.js 14.2.35 App Router, 27 `route.ts` HTML dumps, no DB/auth/payments. Map in `.planning/codebase/`. Since 2026-09-26 Next is 15.5.26 (02-08); live state: `.planning/CONTROL-BOARD.md`.
- Brand book in-repo: `brand/` (Guideline PDF, Questa, Lato, logos, icons, colors). Copied from Downloads 2026-09-22.
- Team public: Maria Del Mar Valdes (founder), María Francis (co-founder).
- Competitors (brief): Galavanta, Amakuna, Magical Colombia, Cielo Travel. ALMAR differentiator: security + 24/7 bilingual ops + bespoke, not canned itineraries.
- Framer leftover risks: legal links 404, stub blog/services, JSON-LD still framer.website, Pexels/catbox, koussay.com hrefs — strip as we rebuild.

## Constraints

- **Stack**: Next.js 15.5.26 (bumped 2026-09-26 in 02-08), React 18, TypeScript, Tailwind v4. Cloudflare project name `almar`. Supabase + Stripe + Resend planned; create/paid only when Koss gates.
- **Git**: GitHub `Loomlyne/almar`. Since 2026-10-01 only the control session pushes `main`, one commit per job, on the owner's Ship; no PR unless he asks (`decisions/2026-10-01-control-session.md`).
- **Secrets**: none in repo or chat. Owner commands numbered, then wait.
- **Contact**: do not replace `inquiries@almarprivatejourney.com` / `+971 56 388 3302`.
- **Media**: Cloudflare only for files; Supabase never storage.
- **Stripe**: TEST until go-live plan. Custom branded Payment Element.
- **PII**: passport/ID highest security; owner extra confirm; last 4 only for cards.
- **Gated**: Cloudflare Worker/Pages + DNS + R2, Supabase project, Stripe live, Resend domain — one numbered step each, wait.
- **Quality**: every control live through UI, backend, DB, ops, public. No placeholders.
- **A11y**: keyboard, visible focus, field errors, alt text; icon-only needs a name.
- **Timezone**: UAE for calendars/slots. Stay nights as UAE calendar dates.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Booking OS, not inquiry-only | This session supersedes July 2026 freeze | — Pending |
| Rebuild, don’t patch Framer HTML | Strings cannot be a design system or CMS | — Pending |
| Design system first, then screens | Control when adding UI | — Pending |
| One destination in hero | Simpler v1; multi-city later via packages/ops | — Pending |
| Deposit or pay in full; VAT on total then % | Ops money model | — Pending |
| English in CMS, auto AR/ES | Ops will not type three locales | — Pending |
| Same URLs, language toggle | Not three sites | — Pending |
| Custom branded Stripe Element | Not Stripe hosted template | — Pending |
| No saved cards in our app | Ops choice | — Pending |
| Dashboard subdomain | Ops isolated from public | — Pending |
| Cloudflare files, Supabase data/auth | Storage vs data split | — Pending |
| Live FX, lock on hold | Guest currency | — Pending |
| Packages request-then-pay | Not instant SKU like a stay | — Pending |
| Damage hold = Stripe auth | Frozen, not captured | — Pending |
| Owner password not stored from chat | Secret handling | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-22 after initialization*
