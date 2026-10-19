# Phase 4 rewrite: request to book, bank transfer (DRAFT)

**Status:** SIGNED 2026-10-19 16:18 CET (owner). Q10 still open: section 4 assumes "move into Phase 4". Decision: `decisions/2026-10-19-request-to-book-bank-transfer.md`.
Nothing below is applied yet. On signature, the controller copies each block into its file in one planning-note commit.
Section 5 assumes Q10 = "move into Phase 4"; if he picks the other way, 04-09 is dropped and 05-01 keeps those screens.

## 1. ROADMAP.md

Overview line (Phase 4 in the list near the top): `Hero → /booking/trip → Stripe TEST deposit or full` becomes
`Hero → /booking/trip → request, bank transfer, owner records the payment`.

Replace the "Phase 4: Book and pay" block:

```markdown
### Phase 4: Book and request

**Goal:** A guest can request a real one-destination trip (stay + add-ons), pay it by bank transfer, and the owner
records the payment in the dashboard. No card provider is needed.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-08, STAY-01, STAY-02, JOUR-01, JOUR-02, JOUR-03, JOUR-04,
ADDN-01, IDEN-01, IDEN-02, PAY-01, PAY-02, PAY-03, PAY-05, PAY-14, PAY-16, PAY-17, PAY-18, PAY-19, PAY-20, AUTH-01,
OPS-04, OPS-10, OPS-13
**Success Criteria** (what must be TRUE):

  1. Guest goes Stay → Add-ons → Travellers → Request on `/booking/trip`, can go back until Request, and is never charged on the site
  2. Sold-out / too many guests / min nights show a reason; 30-minute hold while filling; after Request the nights stay held to the owner's transfer deadline, then lapse on schedule and the guest is emailed
  3. Request shows nights → add-ons → subtotal → VAT → grand → deposit or full; the guest gets `ALMAR-XXXXXX` and an email in their language with the amount, bank details, reference and deadline; the owner is emailed
  4. Owner clicks Record payment (amount, date, bank reference, confirm); the booking becomes Deposit paid or Paid in full, nights block for good, the guest gets the receipt; late, short and extra money is flagged for the owner; a wrong entry is voided with a reason, never deleted
  5. Booking page is the source of truth: status, amounts paid and owed, transfer instructions while unpaid; exact address only after Confirmed; bank details never readable without the booking's signed link

**Plans:** 8 active (04-01, 04-02 landed; 04-03, 04-05, 04-06, 04-07 rewritten; 04-08, 04-09 new); 04-04 parked.
```

Progress row: `| 4. Book and request | 2/8 | Rewritten 2026-10-19 (bank transfer) | - |`

Phase 5 block: requirements lose OPS-04 (moved to Phase 4); OPS-11 stays, minus its money fields, which Phase 4 builds under PAY-02 and PAY-18; success criterion 2 "send a pay link, refund ≤
captured, release/capture damage hold" becomes "send payment instructions, record a refund made from the bank".

New backlog entry (not a numbered phase yet):

```markdown
- **Card payments (parked until the owners have a provider account).** Add `card` beside `bank_transfer`: branded
  payment form, webhook, balance and extras by card, refunds to card, damage hold as a card hold near arrival.
  Provider picked from the owners' company country and bank. Parked work: tag `archive/phase-04-book-and-pay`.
  Requirements: PAY-06, PAY-08, PAY-09, PAY-10 (card part), PAY-13, PAY-15; PAY-07's card rules.
```

## 2. REQUIREMENTS.md

| ID | Change to |
|---|---|
| BOOK-02 | … → traveler details → **request**, and can go back and edit until **request** |
| BOOK-03 | 30-minute hold on the **request** step; on expiry the stay pick restarts; **after Request the nights stay held to the transfer deadline** |
| BOOK-05 | package flow "request → ops confirm → **bank transfer** (deposit or full)" |
| STAY-04 | … unpaid draft holds 30 minutes; **a sent request holds to its transfer deadline** … |
| ADDN-02 | "pay the difference" / "price-difference link" → "**gets transfer instructions for the difference**" |
| PAY-01 | drop "damage hold is listed separately as 'temporarily held'" (damage hold moves to backlog); coupon line stays for when PAY-05 is built |
| PAY-03 | Guest **chooses** deposit or full **before requesting**; full skips remainder and reminders |
| PAY-05 | unchanged; stays deferred to v1.1 as in 04-CONTEXT |
| PAY-06 | **Moved to backlog "Card payments"** |
| PAY-07 | Split: "no gift cards, no BNPL" stays; "no saved cards, no split pay" moves to the card backlog (bank transfers may arrive in parts, see Q7) |
| PAY-08, PAY-09, PAY-13, PAY-15 | **Moved to backlog "Card payments"** |
| PAY-10 | Remainder and extras are paid **by transfer with the same instructions on the booking page**; card checkout to backlog |
| PAY-11 | unchanged (Phase 5): reminders and auto-cancel for the unpaid remainder |
| PAY-12 | Refunds are made **from the owner's bank**; the dashboard records them, never sends money (Phase 5) |
| PAY-16 | "Stripe fees" → "**payment** fees" |
| PAY-17 | Email receipt **after the owner records the payment**; ops can resend; guest's language (PDF stays deferred) |
| OPS-03 | revenue = **recorded payments − recorded refunds** |
| OPS-06 | "send a pay link" → "send **payment instructions**" |
| **PAY-18** (new) | Owner keeps bank details and the transfer window in the dashboard; they are stored owner-only and appear only in a guest's own emails and booking page |
| **PAY-19** (new) | Owner records a payment (amount as received, date, bank reference, one confirm) and can void one with a reason; status follows the amounts; late, short and extra money is flagged, never refused; every record and void is logged with time and owner |
| **PAY-20** (new) | A request with no recorded payment by its deadline expires on schedule, frees its nights, and the guest is emailed |

Out of Scope rows "Stripe live charges" and "Stripe hosted Checkout / Card Element / PAN": keep, marked "applies when
card payments are added". Traceability: card rows → "Backlog: Card payments"; PAY-18/19/20, OPS-04 → Phase 4;
coverage count +3.

## 3. 04-CONTEXT.md: append

```markdown
### Changed 2026-10-19 (owner): request to book, bank transfer
- **B-23 (owner):** Last step is Request, not Pay. No card provider in Phase 4. See `decisions/2026-10-19-request-to-book-bank-transfer.md`.
- **B-24 (owner):** Guest pays by bank transfer in AED with `ALMAR-XXXXXX` as the reference; the owner records it (PAY-19).
- **B-25:** `booking_payments.method` (`bank_transfer`; `card` later). Wrong records are voided with a reason, never deleted.
- **Superseded:** B-03, B-06, B-07, B-08, B-19, B-20. **Reworded:** B-02, B-09, B-11 (Pay → Request); B-14 (receipt
  after the owner records); B-15 (balance by transfer instructions); B-18 (owner emailed on each request and each
  recorded payment).
- Q1–Q10 of the decision record: answered in `/gsd-discuss-phase 4`.
```

## 4. Plans

| Plan | Now |
|---|---|
| 04-01 | Landed. Unchanged. |
| 04-02 | Landed (live). Unchanged; follow-up in 04-08. |
| **04-08** (new, first) | Migration + server: Request function (`held` → `awaiting_payment` via `place_hold`, 35-minute floor); payment columns, `voided`, new event actions; `ops_record_payment` (mirrors `record_payment`: overpaid, late, cancelled flags) and `ops_void_payment` (status recomputed); owner-only bank details table with an anon-cannot-read test; hold gate rebuilt (terms + link secret; `is_test` from host); scheduled Worker running the lapse. Local stack only; live apply on his word. |
| 04-03 | **Rewrite:** Pay step → Request step (deposit/full choice, terms, Request button, "what happens next"). Pictures first. Depends on 04-08. |
| 04-09 (new) | Dashboard: Bookings list and detail with Record payment / Void (confirm dialogs, flags shown); money Settings (VAT %, deposit %, balance due days, transfer window, bank details). Pictures first. Takes these screens from 05-01. Depends on 04-08. |
| 04-04 | **Parked** → backlog "Card payments". Not deleted. |
| 04-05 | **Rewrite:** emails: request received + transfer instructions, owner notice, payment received (receipt), request lapsed; booking page shows instructions while unpaid. Pictures first. `depends_on` 04-04 → 04-08. |
| 04-06 | **Rewrite:** submit request, resume after refresh; guest `/bookings` list unchanged. `depends_on` 04-04 → 04-08. |
| 04-07 | **Rewrite:** numbered UAT on preview: request → emails → Record payment → receipt; short, late and voided payments; lapse of an unpaid request. No Stripe steps. `depends_on` 04-04 removed. |
| 05-01 | Header edit: drop 04-04 from `depends_on`; drop the Bookings detail and money Settings (now 04-09); drop `stripeServer()` / `expireCheckoutSessions()` from Cancel. |
| 05-02 | Header edit: `sendPayLink` → send payment instructions; refunds recorded, not sent. |

Order: 04-08 → (04-03, 04-09 side by side) → (04-05, 04-06) → 04-07.

## 5. GSD steps after signature

1. `/gsd-phase` edit Phase 4 and Phase 5 (section 1).
2. `/gsd-discuss-phase 4` for Q1–Q10 (question form, one at a time, pictures for screen questions).
3. `/gsd-plan-phase 4` to rewrite 04-03, 04-05, 04-06, 04-07, write 04-08 and 04-09, and edit the 05-01/05-02 headers; plan checker on Opus.
4. Phase 4 runs in its own worktree and branch `phase-04-book-and-request`, cut from `origin/main` (the parked branch stays archived).
