# Phase 4: request to book, paid by bank transfer; card payments plug in later

**Status:** SIGNED by the owner, 2026-10-19 16:18 CET, in the next-step box of the Claude Code work session that drafted this record (not the controller): "Signed. Apply the rewrite to ROADMAP, REQUIREMENTS and 04-CONTEXT as a planning-note commit, then start /gsd-discuss-phase 4 with Q1."
**Asked:** 2026-10-19 16:09 CET, owner in chat: "Go with option A: request-to-book with bank transfer and ops records
the payment; card provider plugs in later."
**Checked:** 2026-10-19, independent review (reviewer agent, Sonnet) against the live migration, the plans and the
requirements; its findings are folded in below.
**Replaces in `phases/04-book-and-pay/04-CONTEXT.md`:** B-03, B-06, B-07, B-08, B-19, B-20 (Stripe) are superseded.
B-02, B-09, B-11, B-14, B-15, B-18 are reworded (Pay → Request, receipt after the owner records, owner notice on each
request). Every other B-decision stays.

## Why

The ALMAR owners have no Stripe account, so nothing can be connected. B-19 ran TEST on Koss's UAE Stripe account
"until the owner's own account before live"; that step cannot happen now. Taking guests' money into Koss's account is
not an option (the money would sit with the wrong company). Phase 4 is rebuilt so a guest can book end to end with no
card provider at all.

## The decision

1. **A guest requests the trip; nobody is charged on the site.** `/booking/trip` keeps Stay → Add-ons → Travellers, and
   the last step becomes **Request** instead of Pay. The guest still picks deposit or full and sees the same
   breakdown (B-05, PAY-01/02/03). The button sends a request.
2. **The guest pays by bank transfer** to the owner's account. The email and the booking page show the bank details,
   the amount in AED, the booking reference `ALMAR-XXXXXX` to put on the transfer, and the deadline.
3. **Ops records the payment.** When the money is in the bank, the owner opens the booking in the dashboard and clicks
   **Record payment**: amount, date received, bank reference, then a confirm. The booking moves to Deposit paid or Paid
   in full, its nights block for good, and the guest gets the receipt email.
4. **Unpaid requests lapse.** If no payment is recorded by the deadline, the request expires, the nights free up and
   the guest is emailed. Today `ops_lapse_holds` runs only when someone reads or holds; a scheduled Worker (cron) is
   added so it runs on time.
5. **Cards come later as a second method, not a rewrite.** Each payment row gets a `method` (`bank_transfer` now,
   `card` later). The provider is picked once the owners' company country and bank are known. The parked Stripe work
   stays on GitHub (`archive/phase-04-book-and-pay`) and is not deleted.

## What stays as it is

- Money engine (04-01, landed): fils, VAT, deposit %, balance due days, late-booking rule (B-21).
- Database (04-02, live migration `20261005110000`): the `awaiting_payment` status, `place_hold`, the lapse function,
  `ops_create_booking`, the booking events log. The Stripe tables stay, unused. Nothing is dropped.
- Booking page as the source of truth, signed link, `ALMAR-XXXXXX`, emails in the guest's language.
- Booking terms (B-13): requests stay closed on the live site until the owner supplies the terms text.

## What changes in code (for the plans, not built yet)

**Request.** A new function moves a web booking from `held` to `awaiting_payment` and re-holds its nights through
`place_hold` with the transfer deadline (bookings and nights both), as `ops_create_booking` does; the same 35-minute
floor applies. If the 30-minute hold lapsed before Request, the guest restarts from the stay (as today).

**Payments table.** `booking_payments` gains `method`, `bank_reference`, `received_on`, `recorded_by`, `void_reason`,
`voided_at`, `voided_by`; its status check gains `voided`; `booking_events.action` gains `request_sent`,
`payment_recorded`, `payment_voided`. A transfer writes no `open` row; the owner's record writes a `succeeded` row.

**Record payment** (`ops_record_payment`) follows the card path already in the migration (`record_payment`):
- the money that arrived is recorded as it is; above what is owed it is kept and flagged `overpaid` (never refused);
- on an `expired` or `cancelled` booking it re-claims the nights if they are still free and flags `needs_attention`
  (`paid_after_expiry`, `nights_lost`, `paid_after_cancel`), so the owner decides and refunds from the bank;
- status rules for partial and short amounts wait for Q7 and Q8.

**Void payment** (`ops_void_payment`) reverses one recorded row: `paid_fils` goes down, the row is `voided` with a
reason, and the booking's status is recomputed (back to `awaiting_payment` with a fresh deadline when nothing paid
remains; a `confirmed` booking cannot be voided below its deposit without Cancel first). Logged; never deleted.

**Gate.** Today the hold route is open with no Stripe key and closes only for a live key without terms. The new gate is
built, not renamed: requests on the live host stay closed until the terms text and `BOOKING_LINK_SECRET` exist;
`is_test` comes from the host (preview = test, production = real), not from a Stripe key.

**Bank details** live in an owner-only table, outside `site_settings` (its select policy and `api_site_settings` view
are public). A test proves anon cannot read them. They are sent only in the guest's own emails and booking page.

## Open, for `/gsd-discuss-phase 4` (one question each, pictures first for screens)

The owner's calls. The recommended option is first; nothing here is decided. No prices, fees, deadlines or legal
wording are set by this record.

| # | Question | Recommended |
|---|---|---|
| Q1 | Does the owner accept a request before the guest is told to pay? | No: bank details go out at once; the owner can still Cancel |
| Q2 | How long does a guest have to transfer before the request lapses? | Owner's number in Settings ("[N] hours", 35 minutes at least) |
| Q3 | Can the guest upload a transfer receipt on the booking page? | Not in v1: the guest replies to the email; the owner checks the bank |
| Q4 | Who pays international transfer fees? | Owner's wording in the booking terms |
| Q5 | Bank account name, IBAN, SWIFT, bank, currency | Owner types them into the dashboard himself |
| Q6 | Refunds: made from the bank; does the dashboard record them in v1? | Phase 5, record only, never sends money |
| Q7 | A transfer below the deposit arrives: what status? | Stays "awaiting payment" with "part received"; nights stay held to the deadline |
| Q8 | A transfer a little short (bank fees): does the owner accept it as paid? | Owner clicks "Accept as paid" with a reason; no automatic tolerance |
| Q9 | Money arrives after the request lapsed and the nights were taken | Flag it; the owner refunds from the bank (mirrors the card path) |
| Q10 | Bookings detail and money Settings are planned in Phase 5 (05-01). The transfer flow needs them now. | Move them into Phase 4 (04-09) and shrink 05-01 |

## Not in this decision

Damage hold (PAY-13), coupons (PAY-05, already deferred in 04-CONTEXT), FX lock, balance reminders and auto-cancel
(PAY-11), card payments, Apple Pay.

## Signature

- [x] Owner signed, 2026-10-19 16:18 CET (see Status).
- [ ] Then: `ROADMAP.md`, `REQUIREMENTS.md`, `04-CONTEXT.md` and the Phase 4/5 plan headers change as in
      `phases/04-book-and-pay/04-REWRITE-DRAFT.md`, and Q1–Q10 go to `/gsd-discuss-phase 4`.
