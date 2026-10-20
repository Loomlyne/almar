# Phase 4: Discussion log, 2026-10-19 (request to book, bank transfer)

Human reference only; decisions live in `04-CONTEXT.md` B-26…B-35. Owner answered in the question form of the work session; pictures were shown before Q1 and Q3.

## Q1 Accept before pay

- Question: After Request, does the guest get bank details at once, or only after the owner accepts?
- Options: A: details at once (Recommended) / B: owner accepts first
- Answer: A: details at once (Recommended). Bank details go out with the request email; the owner can still cancel.
- Picture: almar_q1_request_flow_options (two booking-page mockups, shown in chat before the question)

## Q2 Transfer window

- Question: How long does a guest have to transfer before the request lapses?
- Options: Set it later (Recommended) / I'll type it now
- Answer: Set it later (Recommended): Settings field starts empty; live requests stay closed until the owner sets it; floor 35 minutes; preview uses a test value.

## Q3 Receipt upload

- Question: How does the guest show they've paid?
- Options: A: reply to email (Recommended) / B: upload on the page
- Answer: A: reply to the booking email with the receipt (Recommended). No upload in v1; owner checks the bank before recording.
- Picture: almar_q3_receipt_upload_options

## Q4 Transfer fees

- Question: Who pays international transfer fees?
- Options: Guest pays all fees (Recommended) / Shared fees / ALMAR absorbs fees
- Answer: Guest pays all fees (OUR) (Recommended). Email asks for 'all fees paid by sender'; terms text stays the owner's own wording; short arrivals go to Q8.

## Q5 Bank details

- Question: Which bank fields does the owner fill in?
- Options: Name, bank, IBAN, SWIFT (Recommended) / Add bank address / Add a note line
- Answer: All three picked: account name, bank, IBAN, SWIFT (currency fixed AED); plus bank address; plus a note line. Owner types values in the dashboard, never in chat. Note line typed in English, AR/ES filled by the auto-translate on Save (2026-10-14 rule).

## Q6 Refund recording

- Question: When can the dashboard record a refund made from the bank?
- Options: Phase 5 (Recommended) / Phase 4
- Answer: Phase 5 (Recommended), record only, capped at paid. Caveat found after asking: booking notes are a 05-01 feature, so in Phase 4 the owner tracks refunds outside the app unless notes move with Q10.

## Q7 Part payment

- Question: A transfer below the deposit arrives: what status?
- Options: Part received (Recommended) / Count as deposit paid
- Answer: Part received (Recommended): stays awaiting_payment with a 'part received' flag; nights held only to the deadline; guest sees what is still due. Deposit paid only when recorded total >= deposit_fils.

## Q8 Short payment

- Question: A transfer a little short: how does the booking move on?
- Options: "Accept as paid" + reason (Recommended) / Guest tops up
- Answer: 'Accept as paid' + reason (Recommended): owner ticks it while recording, types a reason; the gap is written off and logged; status moves on. No automatic tolerance amount.

## Q9 Late payment

- Question: Money arrives after the request lapsed: what happens?
- Options: Re-claim if free, else flag (Recommended) / Always flag, Maria decides
- Answer: Always flag, Maria decides (owner chose this over the recommended re-claim). Recording on an expired or cancelled booking never re-claims nights automatically; it records the money, flags needs_attention (paid_after_expiry / paid_after_cancel), and the owner re-books or refunds from the bank.

## Q10 Phase 5 screens

- Question: Bookings detail and money Settings are in 05-01; move them?
- Options: Move into Phase 4 (Recommended) / Keep in Phase 5
- Answer: Move into Phase 4 (Recommended): new plan 04-09 builds Bookings list + detail (with notes) and the money Settings; 05-01 shrinks.

## Deferred

- Guest upload of transfer receipt on the booking page (Q3 option B)
