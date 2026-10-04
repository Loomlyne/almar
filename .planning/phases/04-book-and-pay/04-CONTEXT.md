# Phase 4: Book and pay - Context

**Gathered:** 2026-10-04 22:10–22:29 (+04), owner through the question form, in job 12's session
**Status:** Ready for planning
**Scope source:** `decisions/2026-10-04-ten-day-v1.md` (v1 by 2026-10-14, booking core)

<domain>
## Phase Boundary

A guest books and pays one stay with add-ons on Stripe TEST: Book on the stay page → `/booking/trip`
(Add-ons → Travellers → Pay) → deposit or full in the branded Payment Element → `ALMAR-XXXXXX`, a branded email
in their language, and a booking page that is the source of truth, where they can later pay the balance.
The owner is emailed on every paid booking.

Not in v1 (owner): damage hold (PAY-13), coupons (PAY-05), attached PDF receipt, reminders and auto-cancel
(PAY-11), refunds from our app (PAY-12: done in Stripe's dashboard), guest change requests (ADDN-02).
</domain>

<decisions>
## Implementation Decisions

### Entry
- **B-01 (owner):** A booking starts from **"Book" on the stay page**, beside "Request on WhatsApp". It opens
  `/booking/trip` (and `/ar/…`, `/es/…`) with destination, stay, dates and guests filled. Home Search keeps
  going to the filtered `/private-stays` (job 11). The stay overlay inside `/booking/trip` (BOOK-02's "choose
  stay") is not built; the guest can go back to the stay page to change stay.
- **B-02:** Steps follow the StepRail (D-51): Stay (summary, locked) → Add-ons → Travellers → Pay, back and edit
  until Pay. Availability, min nights, guests over max and missing rates are checked live and shown as a reason
  (STAY-01, STAY-02, STAY-03, D-40), never silently hidden.

### Money
- **B-03 (owner):** The charge is **in AED**. Where Stripe offers it on the account, its payment form shows the
  guest the amount in their own currency at Stripe's rate (the researcher checks which Stripe feature does this
  with a Payment Element on our page, and whether it is available on a UAE account); otherwise the card's bank
  converts. Our pages keep showing "about USD/EUR [AMOUNT]" next to AED as today. **No FX lock is built**
  (PAY-15's lock moves to v1.1).
- **B-04 (owner):** Starting values in TEST: **VAT 5 %, deposit 30 %** (the example in his requirements), in
  Dashboard → Settings, editable. They are confirmed or changed by him before live.
- **B-05:** Order of the breakdown (PAY-01, PAY-02): nights → add-ons → subtotal → VAT on the subtotal → grand
  total → deposit (deposit % of grand) or full. VAT is never applied twice. No coupon line, no damage-hold line.
  All amounts are computed on the server from live rates and add-on prices; the page's numbers are display
  only. Each booking stores a snapshot of every price, VAT % and deposit % used.
- **B-06:** Amounts to Stripe in minor units (fils), integer arithmetic, rounding rule written once and tested.
- **B-07 (owner):** Payment methods: **card and Apple Pay** (Apple Pay needs the domain verified: owner gate).
  Link is not turned on. Never a Stripe hosted page, never raw card numbers, ops sees last 4 only (PAY-06).
- **B-08:** Pay is idempotent; the webhook is the source of truth (PAY-09); a refresh never makes a second
  charge; 3DS when the bank asks.

### Hold
- **B-09:** Entering Pay holds the stay's nights for **30 minutes** (BOOK-03); on expiry the guest restarts from
  the stay. The hold is in Postgres (one row per stay-night, unique), expired holds are cleared in the same
  transaction that places a new one; no cron needed. Paid (deposit or full) bookings block their nights for good.

### Guest and travellers
- **B-10:** Guest checkout without an account (AUTH-01): name, email, phone required; nationality, special
  requests, emergency contact optional (IDEN-01). Traveller lines match the guest count; the booker can mark
  "I am not staying"; children and infants give name and age (IDEN-02). The booking is linked to the email;
  a signed-in guest with that email sees it in `/bookings` (job 02's page).
- **B-11:** UAE airport picked at Pay: Dubai / Abu Dhabi / Sharjah (JOUR-01), return the same. Airport meet is
  included; home pickup is the UAE add-on that starts added (D-48) and asks one pickup address in Travellers,
  reused for the return unless changed (JOUR-02, JOUR-03 simplified: no saved address book in v1).
- **B-12:** Inclusions kit shown as included, no price (JOUR-04, D-49), from 3.2's data.
- **B-13:** The booking terms checkbox is required (IDEN-01). Its text is the owner's; until he supplies it the
  page shows `[Booking terms]` and live payments stay off.

### After pay
- **B-14 (owner):** Receipt = **branded email** in the guest's site language (Resend, from
  `inquiries@almarprivatejourney.com`): reference, stay, dates, guests, add-ons, amounts paid, balance and due
  date, link to the booking page. **No attached PDF in v1**; the booking page prints cleanly.
- **B-15 (owner):** The balance is paid from **"Pay balance" on the booking page** in the same branded checkout
  (PAY-10), due **[N] days before arrival** (Settings "balance due days"; N is the owner's value). No automatic
  reminders or cancel in v1; ops sees "balance overdue".
- **B-16:** Booking page = source of truth (OPS-13): status, stay, dates, travellers, add-ons, payments,
  balance. Reached by a signed link in the email and by a signed-in guest with that email. Exact address and
  stay access show only after Confirmed (BOOK-08, OPS-10).
- **B-17:** Reference `ALMAR-XXXXXX` (PAY-14): 6 characters from an unambiguous alphabet, unique in the database.
- **B-18:** Every paid booking emails the owner at `inquiries@almarprivatejourney.com` (ops list item 6).

### Stripe account
- **B-19 (owner):** TEST runs on **Koss's existing UAE Stripe account** for now; it moves to the ALMAR owner's
  own account later (before live). Keys are names only in code (`STRIPE_SECRET_KEY`,
  `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`), set from his terminal. Switching accounts must be a key
  change, nothing in code.

### Added 2026-10-05 00:05–00:20 (+04), owner, question form
- **B-20 (owner):** Turn on Stripe's local-currency choice (Adaptive Pricing) where the account offers it: the
  guest may switch to their currency in the payment form and pays Stripe's own conversion fee only if they
  switch; ALMAR receives AED. Research: it works only with Checkout Sessions in `ui_mode: "elements"` (Payment
  Element on our page), not with PaymentIntents. If the account lacks it, the form shows AED only.
- **B-21 (owner):** If arrival is sooner than the balance due days, **full payment only** in v1 ("later we can do
  deposit"): the Deposit card shows unavailable with the reason.
- **B-22 (owner, see 03.2 C-20):** Ops lives on `dashboard.almarprivatejourney.com`, Worker `almar-ops`. Guest
  checkout APIs and the Stripe webhook stay on the public Worker `almar` under `/api/*`.

### Claude's Discretion
- Payment Element with PaymentIntents or with the Checkout Sessions API in custom UI mode, whichever gives B-03's
  local-currency display on a branded page; the researcher decides with evidence.
- Booking page URL shape, as long as it passes job 10's exact-path allow-list (query parameters allowed).
- Designs not on the canvas (Travellers step, Pay with the Payment Element, booking confirmed page, the email)
  get pictures for the owner's signature before code (rule: design before code).
</decisions>

<canonical_refs>
## Canonical References

- `.planning/decisions/2026-10-04-ten-day-v1.md`; `.planning/REQUIREMENTS.md` (BOOK, STAY, JOUR, ADDN, IDEN, PAY, AUTH-01, OPS-10, OPS-13)
- `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-CONTEXT.md` D-17, D-37, D-40, D-45…D-52, D-62, D-63, D-66, D-73, D-74, D-78
- Canvas boards: `Flow`, `FlowPhone`, `JourneyAddons`, `JourneyPhoneAddons` (Pay toggle cards), `PublicCart`, `GuestTrip`, `GuestBookings`
- `components/journey/*` (built, harness-tested, not mounted); `lib/copy/journey.ts`; `app/booking/trip/*` (placeholder)
- Job 11 branch: `components/pages/stay-detail/booking.tsx` (held submit, WhatsApp link), `lib/whatsapp-request.ts`
- `.planning/research/ARCHITECTURE.md` :103-127, :171-179; `.planning/research/SUMMARY.md` :31, :61, :84-85
- Job 10 runtime files (see 03.2-CONTEXT); job 02 `lib/email/magic-link.ts` (email shell), `app/bookings/*`
- `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-CONTEXT.md` (rates C-11, availability C-13, access C-14)
</canonical_refs>

<code_context>
## Existing Code Insights

- No Stripe code anywhere. `JourneyCart` takes display strings only and has no deposit/balance rows.
- No Travellers or Pay components; Pay is drawn only as toggle cards on `JourneyPhoneAddons`.
- Job 10: the webhook's raw request body under OpenNext is not verified yet — the plan proves it first.
- Workers Free plan; measured on preview before any upgrade (owner).
</code_context>

<deferred>
## Deferred to v1.1
- Damage hold (PAY-13) as a hold link sent a few days before arrival; coupons (PAY-05, OPS-12); PDF receipt;
  charging in USD/EUR with an FX lock (PAY-15); reminders and auto-cancel (PAY-11); refunds from our app
  (PAY-12); guest add-ons after pay (ADDN-02); stay overlay in `/booking/trip`; saved address book.
</deferred>
