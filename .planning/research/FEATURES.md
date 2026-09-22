# FEATURES — ALMAR Booking OS

Research dimension: what guests and ops expect vs table-stakes vs differentiators for a luxury private-stay booking product (Airbnb-like stay search + concierge journey).

**Product lock (do not expand):** `.planning/PROJECT.md` — UAE-based guests book one Colombia destination at a time (stay + add-ons + airport meet + return), pay deposit or in full; ops runs CMS, bookings, customers, calendar, and money from one branded dashboard. Rebuild, not Framer string-patches.

**Core value:** a guest can complete a real trip booking (stay + add-ons + pay) and ops can run that booking and the public site from one branded system — no fake controls.

Complexity in tables: **L** = days, **M** = 1–2 weeks, **H** = multi-week / payments-PII-calendar risk.

---

## Market split (why three buckets)

Three products are colliding. Guests will judge ALMAR against all three.

**Stay OTAs (Airbnb-like).** Guests expect Where / When / Who, dated search, occupancy, an itemized total (nightly + fees + tax), pay at confirm, a confirmation email, and the exact address only after the reservation is confirmed.[1][2] Airbnb also ships Experiences and Services on the same platform, 24/7 support, and a trusted payment rail.[3] Total price in search is now the worldwide default, and private airport cars are 2025–2026 product, not experiments.[5][6] Pay-later options are in the same wave.[4]

**Luxury villas.** Guests expect a named concierge (what is included vs add-on, 24/7 vs office hours), a full cost breakdown, a booking deposit (commonly 25–50%), balance 30–60 days out, and a separate security/damage deposit or card hold.[13][15][14] Extra line items (cleaning, staff, refundable damage) are normal; burying them is a trust failure.[20][13]

**Colombia luxury DMCs (brief competitors).** Galavanta, Amakuna, Magical Colombia, and Cielo.Travel sell *inquiry → specialist → bespoke itinerary*, not Instant Book of a whole country. Amakuna is on-the-ground bilingual 24/7 in Medellín and designs each trip from scratch.[8] Galavanta is a Cartagena DMC: blank-canvas trips, logistics reconfirmation, 24/7 WhatsApp to a travel designer, staffed private villas.[9][10] Magical Colombia leads with private travel designers and assistance through return.[12] Cielo.Travel sells private tours with safety and authenticity as the pitch, not a stay marketplace.[11] Amakuna confirms with a typical **50% deposit**, balance **60 days** before departure, quotes **USD**, and **excludes international airfare** unless listed.[7]

ALMAR’s brief differentiator vs those DMCs is security + 24/7 bilingual ops + bespoke, not canned itineraries (PROJECT.md Context). The product *also* has to feel like a stay booker, or GCC guests trained on Airbnb will bounce.

---

## Must Have (table-stakes)

If these are missing, the product does not feel bookable. Guest OTAs plus villa money basics plus a real ops booking OS.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Hero search: Where (one destination) · When (from–to) · Who (adults, children, infants) · Search | Dated, guest-counted search is how stay inventory is priced and filtered.[1] | M | PROJECT.md: hero never charges. One destination only — not a multi-city hero. |
| Stay results for that destination + dates + occupancy | Guests expect to pick a home for the party size, not a hidden “request.” | M | One stay record reused (search / destination / home). No clone listings. |
| Sold-out / too many guests / min nights shown with **reason**, not hidden | Occupancy and min-stay rules are stay-booking table-stakes; hiding inventory feels like a bug. | M | Adults always, children always, infants on/off per stay. Cannot select over max. No extra-person fee (out of scope). |
| Stay detail: photos, amenities, occupancy, pets, min nights, approximate map | Villa buyers judge photos vs reality and what is included in the rate.[13] | M | Exact address after Confirmed only — same pattern as Airbnb.[2] |
| Itemized price: nights, included fees, tax, grand total **before** pay | Nightly + service/cleaning + VAT/local tax is the Airbnb total; villa guests ask for every fee up front.[1][13] | M | PROJECT.md: Stripe fees, service, cleaning **in subtotal**; VAT line; damage hold **separate**. Total-price display is now Airbnb-standard worldwide.[5] |
| Checkout identity: name, email, phone; accept booking terms | Contract forms at pay, not after.[7][15] | L | Nationality / special requests / emergency optional. Passport/ID optional + encrypted (Should Have vault). |
| First charge at last step: Deposit **or** Pay in full | Villa/DMC market books with a deposit; OTAs charge at confirm or offer part-now.[7][15][4] | H | PROJECT.md money model. Not Airbnb $0 Reserve Now, Pay Later; not Klarna/BNPL (out of scope). |
| Branded card checkout (not a hosted Stripe template) | Guests expect to pay on-brand; PAN never hits our servers. | H | Payment Element: card + Apple Pay + Link. TEST until go-live plan. 3DS when bank requires; idempotent pay; webhook repair. |
| Confirmation email + booking page as source of truth | Confirmation email + in-account trip is OTA table-stakes.[2][3] | M | Ref `ALMAR-XXXXXX`. Emails in guest site language. |
| Exact stay address / wifi / door **only after Confirmed** | Airbnb withholds host phone, full address, and arrival guide until confirmed.[2] | M | Approximate map public. |
| Hard-block calendar (no overlap) | Double-book is an unforgivable stay-product failure. | H | Deposit-paid and Confirmed block; unpaid draft 30 min; ops maintenance blocks. UAE timezone. |
| Legal CMS: privacy, terms, booking terms, waiver, disclaimer | Villa/DMC bookings are contracts; payment = acceptance.[7][15] | L | Accept booking terms at checkout. |
| Always-on contact: WhatsApp `+971 56 388 3302` + Contact form | DMC guests expect WhatsApp to ops, not a ticket queue.[10] | L | Do not replace this number. Every public page. |
| Guest can open the booking from email (after verify) | “Where is my trip?” is the first post-pay support ticket. | M | Email remembers bookings; later signup merges by email. |
| Ops bookings list + status + pay link | A booking OS without ops cannot run the trip. | H | Statuses: Draft → Deposit paid → Confirmed → In trip → Completed / Cancelled. Ops can create booking and send pay link. |
| Nightly AED rates (month/season + date overrides); stay not bookable without rates | No rate = no Instant Book. Seasonal villa pricing is expected.[20] | M | Fake seed rates, ops editable. |
| VAT as a checkout line (not buried) | Tax on the total is OTA-normal; UAE tourism services are commonly 5% when supplied in the UAE.[1][18] | M | PROJECT.md example: 1000 + 5% = 1050; deposit 30% of 1050; VAT not applied twice. **Settings VAT %** — do not hardcode tax law for Colombia-performed services. |
| No double-charge on refresh; receipts | Payment platforms are trusted only if refresh ≠ new charge.[3] | H | Email receipt; ops resend. PDF is Should Have. |

---

## Should Have (luxury / concierge class)

Expected for this *product class* (private stay + accompanied journey), not for a bare Airbnb clone. All of these are PROJECT.md Active unless noted.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Add-ons = destination experiences/services (+ global), priced per-night or per-stay | Airbnb now sells Services (cars, chefs) on the trip; villas sell chef/transfer/spa as the stay.[3][6][14] | M | Group-priced. CMS type + price sort + destination filter. |
| UAE airport picker at checkout (Dubai / Abu Dhabi / Sharjah) | GCC departures are not one airport; meet-and-assist is sold per hub.[19] | L | Return = same UAE airport. |
| Default **airport meet**; home pickup as add-on | Airport meet-and-greet (greeter, bags, handoff) is a paid UAE product guests already buy.[19] Airbnb now pre-books private cars + meet-and-greet after a stay.[6] | M | Address book: Home/Work/Custom; auto if one. If home pickup bought, return home same address unless changed. |
| Traveler lines = guest count (booker can mark “I am not staying”); children/infants name+age | Party composition drives occupancy and villa rules.[13] | M | Passport/ID optional. |
| Guest checkout without account **or** sign-in | High-intent pay should not die on a password wall. | M | Later signup merges by email. |
| 30-minute FOMO hold on pay step; FX lock for that window | Draft hold is how OTAs stop two people buying the last night. | H | On expiry, restart stay pick. New booking = new FX. FX fail → last cache. |
| Currency: default AED; guest AED/USD/EUR; charge in selected | Amakuna quotes USD; ALMAR’s home market is AED.[7] | H | Live FX cached. Language + currency in header. |
| EN / AR / ES, same URLs, real RTL for AR | GCC + Colombia audience. Competitors are EN/ES bilingual, not Arabic RTL.[8] | H | Ops types English; Publish auto-translates AR/ES (editable, lockable). Default EN. No `/en` `/ar` `/es` prefixes. |
| Damage hold = Stripe **auth**, not capture; amount per stay; ops release/capture | Hotels/rentals hold cards for incidentals; villa security deposits are a separate cash/hold line.[16][17][13] | H | Show as “temporarily held,” not part of grand total. Card-not-present auth windows are short (Visa CIT ~7 days) — ops must know release/recapture reality.[16] |
| Remainder reminders (max 3 default timers); unpaid by deadline → cancelled, deposit kept | DMC/villa: miss the balance, lose the booking and the deposit.[7][15] | M | Skip if paid in full. Ops can add more reminders. |
| Deposit % in Settings (ops can change until first payment, then lock) | Villa deposits are 30–50% depending on property, not a fixed SKU.[15][13] | L | No min deposit % (out of scope). |
| Coupon: one per checkout, % or amount, expiry, max uses / per email | Promo codes are stay-market table-stakes; not a differentiator. | M | Applied to total then deposit %. Cannot go below 0. |
| Packages (Explorer / Resident / Sovereign): request → ops confirm → deposit or full | DMC guests expect a named journey, not only a stay SKU.[8][9] | H | Multi-city **only** via packages. Included add-ons not removable. Extra custom = WhatsApp. |
| Consultation (Contact only): 30 min, Dubai time, ops slots, no overlap | Specialist consult is how Amakuna/Galavanta/Magical Colombia actually sell.[8][12][14] | M | Plan with us = request, no pay. |
| Plan with us + List with us (forms only) | Inquiry path must survive for trips that cannot Instant Book. | L | No partner login (out of scope). |
| Post-pay: unverified guest can add add-ons + pay difference; signed-in requests any change via ops | Villa stays change (extra night, extra experience); auto-refund is not how this market works.[13] | M | Price-difference link / no auto refund. Stay longer = ops confirmation. |
| Inclusions kit shown as included (no price) unless extra add-on | “What does concierge actually include?” is the #1 villa question.[13] | M | Default: airport meet, Colombia transfer, stay, guide, security, insurance, return; on/off per destination, override per stay. |
| Share stay (copy / WhatsApp / native); favorites signed-in only | OTA social loop. | L | |
| Cookie banner (necessary / analytics / marketing) + newsletter | Legal + CRM table-stakes. | L | Analytics only if accepted. Footer newsletter → Resend. |
| Receipt PDF + branded Resend templates ops-editable | High-value trips need a PDF, not only an HTML mail. | M | EN stored, AR/ES translated. |
| Ops CMS: Destinations, Stays, Experiences & Services, Packages, Pages, Blog, Team, Legal | DMCs run inventory in the back office; ALMAR must not need a developer to change a stay. | H | Draft → Publish (owner preview link). SEO required to publish. Media = Cloudflare https URLs only. |
| Customer profile (ops): photo, PII lock, bookings, address book | UHNW/DMC ops keep a client file, not a Stripe email.[10] | M | Guest can delete account: strip PII, bookings remain for ops. |
| Analytics: bookings, revenue (captured − refunds), outstanding remainder, occupancy, reminders | Ops home is a money desk, not a CMS. | M | AED. Date dropdown: this month / last 30 / custom. Profit = revenue − ops costs (stay, flight, transfer, guide, security, other). |
| Pets: allowed / not / fee per stay | Airbnb pet fee is a known line; villa house rules too.[1] | L | |
| Same-day cutoff hours/days per destination | Last-minute Instant Book needs an ops gate. | L | |
| Invisible spam trap on public forms | Public forms without it become a support queue. | L | |

---

## Differentiator (ALMAR vs Airbnb **and** vs Colombia DMCs)

These are why a UAE guest uses ALMAR instead of Airbnb Luxe, Amakuna, or Galavanta. Do not ship v1 without the ones marked **v1**.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Stay Instant Book + concierge journey in one path** (`/booking/trip`: summary → stay overlay → add-ons → travelers → pay) | Competitors are either a stay marketplace or an inquiry DMC — not both.[3][8][9] | H | **v1.** This *is* the product. Hero never charges. Guest can go back until pay. |
| **Security + guide + insurance as default inclusions**, not an upsell | Brief: UAE clients want Colombia but fear safety; product is 24/7 private, accompanied luxury. Cielo leans on “safety”; Galavanta on logistics; neither productizes security as a stay inclusion.[11][10] | M | **v1.** Guest sees included (no price) unless extra add-on. |
| **UAE origin built into checkout** (airport pick, default meet, same-airport return, home pickup add-on) | Colombia DMCs start *in* Colombia; they exclude international airfare and do not model DXB/AUH/SHJ.[7] UAE airports already sell meet-and-assist as a standalone VIP product.[19] | M | **v1.** Default meet (not an extra SKU). Home pickup is the add-on. |
| **Ops books flights after deposit** (not on site); Send → “flight booked” email | Amakuna explicitly excludes international airfare; guests still expect someone to handle the long-haul.[7] | M | **v1.** Ops fills details, clicks Send. No self-serve GDS. |
| **Driver assigned** status without exposing driver phone; no Careem API | Airbnb’s new car service is a third-party bookable SKU; ALMAR is ops-assigned, privacy-first.[6] | L | **v1.** Guest sees status only. No driver phone. No Careem/Uber API (out of scope). |
| **Deposit or pay in full**, remainder reminders, cancel+keep deposit | Airbnb is pushing $0-upfront and Klarna; villa/DMC is 30–50% then balance.[4][15][7] ALMAR offers both without BNPL. | H | **v1.** Full pay = no remainder, no reminders. Flexible pay matters to guests (60% of Airbnb’s US survey) — deposit/full is the on-brand answer, not $0 hold.[4] |
| **Damage hold separate from trip deposit** | Villa guests already distinguish rent deposit vs security deposit; OTAs mix “security deposit” into fees.[13][1] Auth-not-capture is the hotel/rental pattern.[16][17] | H | **v1.** Ops release/capture only. |
| **Real Arabic RTL + AED default**, same URLs | Colombia DMCs are EN/ES and USD. GCC bookers live in AR + AED. | H | **v1.** Dates DD/MM/YYYY, week starts Monday, Western numerals. |
| **One branded OS:** public site + `dashboard.almarprivatejourney.com` (until then `/ops`) | VoD/Amakuna/Galavanta run on agency tools + WhatsApp, not a guest-facing OS.[14][10] | H | **v1.** Owner only: `maria@almarprivatejourney.com`. Guests: zero dashboard access. |
| **24/7 bilingual ops as a product surface** (WhatsApp + booking page status + emails), not a slogan | Amakuna and Galavanta already claim 24/7 bilingual / WhatsApp — ALMAR must *show* status (flights booked, driver assigned, inclusions) so the guest does not chase WhatsApp for facts.[8][10] | M | **v1.** Booking page is source of truth. |
| Packages as the **only** multi-city path; second city in the same timeline = WhatsApp (prefilled booking id) | DMC default is multi-city; PROJECT.md defers instant multi-city in the hero.[8][9] | M | v1: WhatsApp escape + packages request-then-pay. Instant multi-city hero = out of scope / v2+ deferred. |
| Encrypted passport/ID; owner extra confirm to open | UHNW/DMC file — not an OTA field. | H | v1 optional collect; treat as highest PII. Last 4 only for cards. No saved cards in our app. |
| Brand tokens live (Settings → Brand → Publish) on public **and** dashboard | Direct luxury brands do not look like Stripe Checkout or WordPress. | M | **v1** with design system. Light theme only. `/design` owner-only. |
| Consultation + Plan with us **beside** Instant Book | Pure Instant Book would undercut “bespoke, not canned.” Pure inquiry would freeze the OS (July 2026 Notion — superseded). | M | v1: Contact calendar can follow first paid stay path if sequenced (see v2). |

---

## Feature groups

Map to `/booking/trip` and ops nav in PROJECT.md.

| Group | Guest | Ops | Bucket |
|---|---|---|---|
| **A. Discover** | Hero booker; destination CMS (seed 5: Cartagena, Medellín, Bogotá, San Andrés, Cocora Valley); Experiences & Services catalog; packages cards under booker; Stories hide-if-empty | Catalog + Content + Publish | Must (pages) / Should (CMS depth) |
| **B. Stay pick** | Overlay, filters, occupancy, min nights, sold-out reasons, share, favorites | Stays CMS, rates, calendar, pets, infants on/off, same-day cutoff | Must |
| **C. Journey** | UAE airport, default meet, home pickup add-on, return, inclusions list | Inclusions kit; Driver assigned; Flights booked after deposit | Differentiator + Should |
| **D. Add-ons & packages** | Destination add-ons; package request | Experiences & Services; Packages Explorer/Resident/Sovereign | Should |
| **E. Pay** | Breakdown, VAT, coupon, deposit or full, damage hold, 30-min hold, branded Element | VAT %, deposit %, Stripe TEST, refunds manual, chargebacks visible, reminders | Must + Differentiator (hold + deposit/full) |
| **F. After pay** | Email + booking page; add-ons + difference (unverified); change request (signed-in); stay access after Confirmed | Notes, audit, CSV, In trip / Completed, resend receipt, refund to original | Must / Should |
| **G. Site chrome** | EN/AR/ES RTL, AED/USD/EUR, WhatsApp, Contact + consult, Plan with us, List with us, cookies, newsletter, 404, sitemap | Legal, Pages show/hide, Team (founder + co-founder until more published), Brand tokens | Must (i18n/contact) / Should (rest) |
| **H. Ops OS** | — | Home analytics, Bookings, Customers, Calendar, Catalog, Content, Settings, Profile | Must (run a booking) |
| **I. Auth / platform** | Guest confirm email, magic link + optional password (eye), delete account | Owner email+password, 30-day session, logout-all; passkey+2FA later | Must / v2 for 2FA |

---

## Recommended v1

Ship the Core Value: **one destination, one stay, add-ons, pay, ops can run it.** Design system first (PROJECT.md), then this slice. Nothing here is outside Active.

1. **Design system** on public + dashboard (Questa/Lato, tokens, RTL-ready controls, `/design` owner-only, Settings → Brand).
2. **Hero → `/booking/trip`** (summary → stay overlay → add-ons → travelers → pay). Back-edit until pay. 30-min hold.
3. **Stays + rates + calendar** (seed destinations, occupancy rules, min nights, sold-out reasons, maintenance blocks).
4. **Add-ons CMS** attached to destination (+ global).
5. **Checkout:** name/email/phone, terms, UAE airport, default meet, guest checkout or auth.
6. **Money:** itemized nights + add-ons + coupon + subtotal + VAT + grand total; deposit or full; damage hold separate; branded Payment Element TEST; webhooks; `ALMAR-XXXXXX`; remainder reminders.
7. **Confirmation email + booking page** (source of truth). Exact address after Confirmed.
8. **Ops dashboard `/ops`:** Bookings (search/filter/status), Customers, Calendar, Catalog (Destinations/Stays/Experiences), Settings (VAT %, deposit %, brand), pay link, internal notes, audit, Driver assigned, Flights booked (fill + Send email).
9. **EN/AR/ES same URLs + AED/USD/EUR** (live FX, lock on hold).
10. **Inclusions kit** visible to guest. WhatsApp float. Legal CMS. Owner auth.

v1 **does not** require packages, consultation calendar, Plan/List with us, favorites, newsletter, cookies, blog, coupons, PDF, passport vault, or profit charts — those are Active but not the first paid booking.

---

## Recommended v2

Still PROJECT.md Active (or explicitly “later”). Not new scope.

- Packages Explorer / Resident / Sovereign (request → ops confirm → pay); multi-city only here.
- Consultation calendar (Contact, 30 min, Dubai time) + Plan with us + List with us form.
- Post-pay add-ons / change-request money links; stay-longer ops confirm.
- Coupons CMS; receipt PDF; analytics + profit (revenue − ops costs).
- Favorites, share, cookie banner + real analytics, newsletter, Blog/Stories CMS, SEO-required publish.
- Passport/ID encrypted vault (owner extra confirm).
- Address book for home pickup.
- Passkey + 2FA in owner settings (PROJECT.md: later).
- Dashboard on `dashboard.almarprivatejourney.com` when DNS is owner-gated.
- **Deferred / not v2 Instant Book:** multi-city in the hero (packages + WhatsApp only until PROJECT.md changes).

---

## Explicitly not features (PROJECT.md Out of Scope)

Do not put these in Must/Should/Differentiator as build items.

| Not this | Why |
|---|---|
| Instant multi-city in the hero | Deferred; packages / WhatsApp |
| Partner dashboard / List with us accounts | Form only |
| Gift cards, BNPL, split pay, saved cards in our app | Out of scope — even though Airbnb ships Pay Over Time with Klarna and Reserve Now, Pay Later.[4] |
| Careem / Uber API | Ops marks Driver assigned |
| Stripe live charges | Until dedicated go-live plan |
| `/en` `/ar` `/es` prefixes; dark mode; extra-person fee; max nights; min deposit % | Out of scope |
| Fake testimonials; story comments | None until real guests |
| Inquiry-only freeze | Superseded by this OS |
| Invented contact or chauffeur copy | Keep `inquiries@almarprivatejourney.com` / `+971 56 388 3302` |

---

## Alignment notes

- **Users expect** Airbnb search + total price + confirmation + address-after-confirm.[1][2] Airport cars are now in that same OTA loop.[6]
- **Table-stakes for luxury** are deposit, balance deadline, and a damage/security hold.[13][15] Inclusions vs add-ons plus 24/7 WhatsApp are the DMC bar.[7][10]
- **Differentiators** are the hybrid OS (Instant Book stay **plus** accompanied UAE→Colombia journey), security as inclusion, ops-booked flights after deposit, AR/AED, damage hold ≠ trip deposit, booking page as source of truth.
- Competitors do **not** offer a public stay checkout; they offer a designer.[8][9][12] Copying their inquiry-only model contradicts PROJECT.md. Copying Airbnb’s BNPL / $0 reserve / extra-person fee / Careem-like car API also contradicts it.

---

## Sources

[1] https://www.airbnb.com/help/article/125 — Airbnb Help: How pricing works for homes
[2] https://www.airbnb.com/help/article/4116 — Airbnb Help: What info is shared when booking is confirmed
[3] https://www.airbnb.com/help/article/2503 — Airbnb Help: What it is and how it works
[4] https://news.airbnb.com/reserve-now-pay-later — Airbnb: Introducing Reserve Now, Pay Later
[5] https://news.airbnb.com/category/product — Airbnb Newsroom: Product archives
[6] https://news.airbnb.com/introducing-private-car-services-on-airbnb-with-welcome-pickups — Airbnb: Introducing private car services with Welcome Pickups
[7] https://amakuna.com/termsandconditions — Amakuna Travel Terms and Conditions
[8] https://www.amakuna.com/why-us — Amakuna: Why choose Amakuna
[9] https://galavanta.com — Galavanta Colombia tailored travel
[10] https://www.virtuoso.com/suppliers/16628918/galavanta-colombia — Virtuoso: Galavanta Colombia supplier profile
[11] https://cielo.travel — Cielo.Travel private luxury tours Colombia
[12] https://magicalcolombia.com — Magical Colombia regenerative luxury travel
[13] https://jatinagroup.com/details/5-questions-smart-travelers-ask-before-booking-a-luxury-villa-that-most-people-forget — Jatina Group: 5 questions before booking a luxury villa
[14] https://www.villasofdistinction.com/magazine/insider-tips/how-to-book-a-luxury-villa-with-villas-of-distinction-a-complete-guide — Villas of Distinction: How to book a luxury villa
[15] https://www.goldfavela.com/booking-policy — Gold Favela villa booking policy
[16] https://docs.stripe.com/payments/place-a-hold-on-a-payment-method — Stripe Docs: Place a hold on a payment method
[17] https://stripe.com/resources/more/authorization-holds-explained — Stripe: Authorization holds explained
[18] https://www.hfaconsulting.ae/blogs/vat-on-tourism-services — HFA Consulting: VAT on tourism services in UAE
[19] https://abudhabiairport.ae/en/Services%20and%20Facilities/Convenience%20Services/Meet%20and%20Assist%20Services — Abu Dhabi Airport: Meet and Assist Services
[20] https://hauteretreats.com/how-much-does-it-cost-to-rent-a-luxury-villa-in-the-caribbean — Haute Retreats: Cost to rent a luxury villa in the Caribbean
