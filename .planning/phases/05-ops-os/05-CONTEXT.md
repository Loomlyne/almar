# Phase 5: Ops OS - Context

**First gathered:** 2026-10-04 22:10–22:29 (+04), owner through the question form, in job 12's session
**Reconciled:** 2026-10-31 13:46 +0100 against `main` `d34e599a` (Phase 4 live on `almar`, Phase 6 landed), and re-discussed
with the owner through the question form (`decisions/2026-10-31-phase-5-discuss.md`)
**Status:** Ready for planning. O-01 and O-04 stay superseded by the request-to-book decision; P5 decisions below win over O-*.

<domain>
## Phase Boundary

The owner runs bookings from the dashboard with no card provider: makes a booking by hand, records a refund made from the
bank, opens on a Home with real numbers, sees customers, and has a real Profile. Everything else on the signed v1 list was
built in Phase 4 (04-09) and is not rebuilt.

### Reconciliation: the signed v1 list against the code

| # | Signed item | State | Where |
|---|---|---|---|
| 1 | Bookings list: search, status filter, upcoming first, balance overdue | Built | `app/dashboard/(ops)/bookings/*`, `ops_list_bookings` (rank order), `/api/ops/bookings` |
| 2 | Detail: guest, travellers, stay, dates, add-ons, airport, amounts, payments | Built; refunds part missing | `bookings/detail/*`, `ops_get_booking`. Card last 4 is unused (Stripe parked) |
| 3 | Confirm, Mark completed, Cancel (no refund) | Built | `/api/ops/booking/status`, `ops_set_booking_status`, `statusActions` |
| 4 | Resend confirmation email | Built | `/api/ops/booking/resend` (request email, receipt) |
| 5 | Settings: VAT %, deposit %, balance due days | Built | `settings/settings-screen.tsx`, `money-settings.tsx`, `/api/ops/settings`, `/api/ops/money` |
| 6 | Email to inquiries@ on every booking | Built, reworded | `request_owner`, `payment_owner` |
| 7 | New booking by hand (OPS-06, O-02, O-03) | **Missing** (SQL only) | `ops_create_booking` is live; no route, no screen. `dashboard.ts` has only the word `newBooking` |

### The roadmap's requirements against the code

| Requirement | State | Today |
|---|---|---|
| OPS-06 create a booking, send payment instructions | **Missing**: this phase | as item 7 |
| PAY-12 refunds recorded, never sent (B-31) | **Missing**: this phase | `booking_refunds` is Stripe-shaped (`stripe_refund_id not null`), no route, no screen |
| OPS-03 Home | **Part: this phase, narrowed** (P5-01) | Screen drawn, nothing wired, not in `OPS_LIVE_SECTIONS` |
| OPS-08 customers | **Part: this phase, narrowed** (P5-01) | Screen drawn with a dead New customer, no table, not live |
| Profile screen | **Part: this phase** (P5-01) | Drawn with empty fields, not live; sign-out already in the rail |
| OPS-02 nav | Built, once the three above are live | `ops-shell.tsx` RAIL |
| OPS-05 subset | Built | Statuses of O-05 (Awaiting payment replaces Held for hand-made). In trip, Driver assigned, Flights booked: v1.1 |
| OPS-07 notes | Built (04-09); audit is the booking history; CSV: v1.1 | `ops_add_booking_note`, History section |
| OPS-11 subset | Built (02-06, 04-09, 03.2): brand, logo, VAT, deposit, FX text, maintenance, money, bank | Email templates and reminder settings: v1.1 |
| PAY-04 | Subset built: deposit % copied on each booking (O-08). Edit per booking until first payment: v1.1 | `booking_write` |
| PAY-11, JOUR-06, JOUR-07, ADDN-02, IDEN-03, STAY-08, AUTH-03, AUTH-04, DSGN-04 | Not built: v1.1 | Signed OUT list |

### v1.1, not in this phase (signed list, 2026-10-04)

Customer profile beyond the list (photo, locked passport, address book), cost and profit, occupancy, charts, reminders and
auto-cancel (PAY-11), CSV, In trip / Driver assigned / Flights booked (JOUR-06, JOUR-07), guest cancellation or change requests
(ADDN-02), passport upload (IDEN-03), guest change email or phone and delete account (AUTH-03, AUTH-04), new-brand editing
beyond 02-06 (DSGN-04), per-booking deposit edit (PAY-04), PAY-05 / OPS-12 coupons.
</domain>

<decisions>
## Implementation Decisions

### New in this discussion (owner, question form, 2026-10-31)
- **P5-01 (owner, picture 1, "Build them today"):** Home, Customers and Profile are built today, not hidden. As drawn on the
  picture: Home shows Bookings, Recorded money and Outstanding; Customers is a list. This overrides the signed list for these
  three only.
- **P5-02 (owner, picture 2, "Rates or typed price"):** A hand-made booking uses the stay's rates when set. The owner may type
  an agreed price for the stay before VAT, with a reason kept in the history. VAT and deposit still come from Settings. It
  applies to this one booking and writes no rate. Live read 2026-10-31: 12 published stays, 0 with a rate.
- **P5-03 (owner, picture 3, "Page and an email"):** A recorded refund shows on the guest's booking page and sends the guest one
  new email in EN, AR and ES, with a resend button in the dashboard. Wording signed on the plan-gate pictures.

### Carried and restated for bank transfer
- **O-02, reworded:** Guest, stay and dates (checked against availability and blocks), add-ons, deposit or full; it emails the
  guest the bank-transfer instructions and the booking link (no pay link, 04-CONTEXT B-23, B-24).
- **O-03 (owner):** A hand-made unpaid booking blocks the nights until a "hold until" date and time the owner sets (UAE time).
  After it the booking turns Expired and the nights free up. Floor 35 minutes (`hold_too_soon`, live SQL).
- **O-05, O-06, O-07, O-08, O-09:** stand, except the refund and pay-link wording. History events, canvas `DashNewBookingA/B`
  and the dense variant, owner-only through `/api/ops/*` with `requireOwner()`, settings copied per booking, `almar-ops`.
- **B-31 (owner):** Refunds are recorded, never sent, never more than was paid.
- **B-25 (owner):** A wrong record is voided with a reason, never deleted. Applies to refund records.
- **B-13 (owner):** Real payments stay off until the booking terms are published: a real hand-made booking uses the same request
  gate (terms, link secret, mail sender, settings, bank). A TEST one is always possible with complete bank details (P-06).

### Claude's decisions (shown on the plan-gate pictures; the owner's signature covers them)
- **P5-04 TEST choice:** A "Test booking" tick on the Review step, off by default. The ops host's `isTestHost` is not used for a
  hand-made booking. TEST links go to preview, real ones to production (`originForBooking`).
- **P5-05 Hand-made email:** the `request_received` mail with its own heading and first line ("Your booking is ready"), since
  "We have your request" is false here. No new template name. No owner notice for a booking the owner made himself.
- **P5-06 Refund money rule:** a refund never changes the status and never raises what is still due. `paid_fils` is unchanged;
  a new `refunded_fils` shows beside it. `overpaid` reads paid minus refunded above the total. The owner Cancels separately.
- **P5-07 Refund record:** amount, date refunded, bank reference, optional reason, one confirm; offered on every status where
  paid minus refunded is above zero (late money on cancelled and expired bookings included).
- **P5-08 Home:** Date range This month / Last 30 days / Custom. Bookings = requests and hand-made bookings created in the range,
  held and abandoned excluded. Recorded money = bank payments received in the range minus refunds in the range. Outstanding =
  what is still due now, independent of the range. AED only, TEST bookings left out. Cost, Occupancy, Charts and Reminders are
  not rendered (v1.1). A filled number links to Bookings.
- **P5-09 Customers:** read-only list grouped by guest email from bookings, no new table: name (latest), email, phone, bookings
  count, last arrival; search; a row opens Bookings filtered to that email. New customer is removed. TEST left out.
- **P5-10 Profile:** owner's name and email from the session, read-only; sign-out buttons stay in the rail only.
- **P5-11 From a Request:** "Make a booking" on a Plan, Package or Consultation request's detail opens New booking with name,
  email, phone, dates and guests filled when present (06-CONTEXT F-01). No link is stored between them.
- **P5-12 Sign-in landing:** the owner lands on Home, now live.
- **P5-13 Hand-made bookings have no travellers and no guest terms tick** (`booking_write` web fields only). The booking page
  shows what it has. Named at the gate as a known gap: no recorded terms acceptance on a hand-made booking.
- **P5-14 Lapse email:** none for a hand-made booking (`claim_lapse_emails` is web only, as built); the owner set the deadline.

### Claude's Discretion
Page size, search matching, tie order, exact error words in the same voice as `lib/copy/ops-bookings.ts`.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/decisions/2026-10-31-phase-5-discuss.md`, `2026-10-19-request-to-book-bank-transfer.md`, `2026-10-27-04-09-still-due.md`
- `.planning/phases/04-book-and-pay/04-CONTEXT.md` B-13, B-21, B-23…B-35; `HANDOVER.md`
- `.planning/phases/06-site-and-rest-of-cms/06-CONTEXT.md` F-01
- Canvas `DashNewBookingA`, `DashNewBookingB`, `DashHome*`, `DashCustomers*` in `.planning/design/2026-10-01-canvas/boards/`
- `supabase/migrations/20261005110000_bookings_and_ops.sql` (`booking_write`, `ops_create_booking`, `booking_refunds`)
- `supabase/migrations/20261019160000_booking_requests.sql` (`booking_flags`, `booking_view`, `ops_record_payment`, `ops_void_payment`, `ops_get_booking`)
- `lib/ops/bookings-api.ts`, `lib/ops/booking-rules.ts`, `lib/booking/server.ts`, `lib/booking/gate-server.ts`, `lib/booking/notify.ts`, `lib/email/booking-guest-mail.ts`, `lib/money/booking-price.ts`, `lib/ops-routes.ts`
</canonical_refs>

<code_context>
## Existing Code Insights
- `ops_create_booking` validates sums, re-reads settings and takes `is_test` from the payload; `nights_snapshot` elements are
  checked only for `night` and `rate_fils`, so an agreed price fits with no change to `booking_write`.
- `priceQuote` returns `no_rate` for a stay with no base rate; the agreed price needs a path around that in `lib/money`.
- `booking_view` is `withdrawable` for web only, and `booking_transfer_instructions` works for any source.
- Live 2026-10-31: 0 bookings, VAT 5, deposit 30, `balance_due_days` null, bank details incomplete: Deposit and every real
  hand-made booking stay closed until the owner fills Settings.
- Owner's no-test rule: plans write test files, run `tsc` and `tokens:check` only.
</code_context>
</content>
