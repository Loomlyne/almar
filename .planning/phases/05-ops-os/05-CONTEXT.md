# Phase 5 (v1 part): Minimal ops - Context

**Gathered:** 2026-10-04 22:10–22:29 (+04), owner through the question form, in job 12's session
**Status:** Ready for planning. **This file covers only the minimal ops screen in v1**; the rest of Phase 5 is v1.1.

<domain>
## Phase Boundary (signed list)

The owner sees and runs paid bookings from the dashboard, and can make a booking by hand.

**IN v1 (owner signed the list as written, 2026-10-04 ~22:25):**
1. Bookings list: search by reference or guest, filter by status, upcoming first, "balance overdue" flag.
2. Booking detail: guest and travellers, stay, dates, add-ons, airport, amounts paid / balance / due date,
   payments and refunds from Stripe (last 4 only).
3. Status buttons: Confirm (shows the guest the exact address and stay access), Mark completed, Cancel (no
   automatic refund).
4. Resend confirmation email.
5. Settings: VAT %, deposit %, balance due days.
6. Email to `inquiries@almarprivatejourney.com` on every paid booking (built in Phase 4, B-18).
7. **New booking by hand** (OPS-06; owner added it, answer "In v1").

**OUT to v1.1:** home analytics, customers screen, internal notes, audit log, CSV, reminders, In trip /
Driver assigned / Flights booked, guest cancellation requests, passport upload, brand editing.
</domain>

<decisions>
## Implementation Decisions

- **O-01 (owner):** Refunds are made **in Stripe's dashboard**; the Stripe webhook records each refund (and any
  dispute) on the booking and the ops detail shows it. No refund button in v1.
- **O-02 (owner):** **New booking by hand in v1**: guest, stay and dates (checked against availability and
  blocks), add-ons, deposit or full; it emails the guest a pay link to the same branded checkout (via the
  booking page).
- **O-03 (owner):** A hand-made unpaid booking **blocks the nights until a "hold until" date and time the owner
  sets** (UAE time). After it, the booking turns Expired and the nights free up (checked lazily, like the
  30-minute hold).
- **O-04 (owner):** **No offline payment recording**: every payment is card or Apple Pay through the branded
  checkout. "Record payment" from the canvas `DashBookingDetailA` / `DashNewBookingA` is not shown.
- **O-05:** Statuses in v1: Held (website, 30 min) / Awaiting payment (hand-made, until its hold date) →
  Deposit paid / Paid in full → Confirmed → Completed; Cancelled and Expired. Confirm is the owner's click
  (OPS-05 subset). Cancel never refunds by itself (O-01).
- **O-06:** Every status change and resend is stored with time and actor on the booking (a minimal history the
  v1.1 audit log grows from); not shown as a separate audit screen.
- **O-07:** Screens follow canvas `DashBookings` (7b), `DashBookingDetailA/B`, `DashNewBookingA/B`,
  `DashSettingsA`, dense variant, phone versions (D-82, D-93). Tabs and actions outside the IN list are not
  rendered. Owner-only, through `/api/ops/*` with `requireOwner()` (03.2 C-19).
- **O-08:** Settings money fields: VAT %, deposit %, balance due days. Deposit % in force is copied onto each
  booking when it is created, so a later change never alters a paid booking (PAY-04 subset).

- **O-09 (owner, 2026-10-05):** The ops screens are reached at `dashboard.almarprivatejourney.com` on the second
  Worker `almar-ops` (03.2 C-20). Depends on job 02's ops host and his DNS step by Oct 10.

### Claude's Discretion
- List page size, search matching, how "upcoming first" sorts ties.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/phases/04-book-and-pay/04-CONTEXT.md` (statuses, payments, webhook, emails)
- `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-CONTEXT.md` (C-13 blocks, C-14 stay access, C-19 owner endpoints)
- Canvas: `DashBookings`, `DashBookingDetailA`, `DashBookingDetailB`, `DashNewBookingA`, `DashNewBookingB`, `DashSettingsA`
- `03.1-CONTEXT.md` D-82, D-84, D-85, D-92, D-93
- `app/dashboard/(ops)/bookings/*`, `settings/*` (frontend only today); job 02 ops layout and host gate
</canonical_refs>

<deferred>
## Deferred to v1.1
Everything in the OUT list above, plus OPS-02 full nav, OPS-03, OPS-07, OPS-08, OPS-11 rest, PAY-04 lock UI,
PAY-11, PAY-12 button, JOUR-06, JOUR-07, IDEN-03, AUTH-03, AUTH-04, STAY-08, ADDN-02, DSGN-04.
</deferred>
