# 2026-10-20: Phase 4 plan-gate rule signatures (request to book, bank transfer)

The owner answered in the controller session `local_2a268540` through the question form, about 08:10 to 08:20 CET on 2026-10-20 (written 2026-10-20 08:19 CET).
The questions came from the 13 `[signature]` rows of `04-08-PLAN.md` and items U-01 and U-02 on `phase-04-book-and-request` `cf502fa4`.

## Signed as planned
| Row | Rule |
|---|---|
| P-04 | A bank row may be any amount from 0.01 AED up; the 2.00 AED floor stays for card rows only. |
| P-05 | At most 3 open requests per email; a 4th is refused (`too_many_open`). |
| P-06 | TEST bookings on the preview host use the 35-minute floor as their window. Real bookings use the Settings window. The owner asked for an explanation first and then chose this. |
| P-07 | The transfer window can be set from 35 minutes to 30 days; empty = requests closed. |
| P-08 | "Bank details complete" = account name, bank, IBAN, SWIFT, bank address AND the English note line. |
| P-11 | A void sends no email to the guest. |
| P-12 | Lapse emails are sent only within 48 hours of the deadline. |
| P-13 | The production gate needs the email sender READY (04-05), not only RESEND_API_KEY present. |
| P-14 | No cap of the deadline at arrival; the owner reviews each request. |
| A10 | The static stay calendar does not show web requests' nights; the live quote's `sold_out` catches them. |
| U-01 | 04-07's UAT on preview runs BEFORE the Phase 4 Ship. |

## Changed by the owner
| Row | Planned | Owner's answer (verbatim where typed) |
|---|---|---|
| P-09 | A request that lapses with money recorded: expired, nights freed, flagged `expired_with_payment`, no automatic lapse email. | "It keeps the nights held, but it will flag it so I can act on it. so both". A request with a recorded payment does **not** lapse at its deadline. Its nights stay held, and it is flagged for the owner to act on (record more, cancel, refund). |
| P-19 | After Request the guest cannot withdraw on the site; only the owner cancels, or it lapses. | "Guest can withdraw": an **unpaid** request (no payment recorded) has a Withdraw control on the guest's booking page, and the nights free at once. |
| P-21 | `cancel_first` floor = the plan target (the deposit for a deposit plan, the grand total for a full plan). | "Deposit for all": a void may not take a confirmed or completed booking below the **deposit**, on every plan. |

## Already settled, not asked again
- U-02 (primary button text): **White on Teal**, the owner's rule of 2026-10-13 for the site, the dashboard and emails (gold is lines only).

Next: the Phase 4 plans session rewrites P-09, P-19 and P-21 and their ripples (04-05 emails, 04-06 booking page, 04-07 UAT, VALIDATION, pgTAP cases, bite checks). One more plan check follows, then the owner's signature on the plans as a whole. Any new screen state, such as the Withdraw control and its confirmation, is drawn for him first.
