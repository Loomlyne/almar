# Backlog: card payments (parked)

Parked 2026-10-19 by the owner's signed decision `decisions/2026-10-19-request-to-book-bank-transfer.md`: Phase 4 is
request to book, paid by bank transfer; card payments come later as a second payment method (`card` beside
`bank_transfer`), once the owners have a provider account.

- `04-04-PLAN.md` is the Stripe plan of Phase 4, moved here unchanged from `.planning/phases/04-book-and-pay/` so
  `/gsd-execute-phase 4` does not run it (GSD runs every `*-PLAN.md` in a phase folder that has no SUMMARY).
- The parked work (WIP code, tests not green, not reviewed) is the tag `archive/phase-04-book-and-pay` on GitHub.
- The Stripe-era research is `.planning/phases/04-book-and-pay/04-RESEARCH.md`.
- Requirements: PAY-06, PAY-08, PAY-09, PAY-10 (card part), PAY-13, PAY-15; PAY-07's card rules (ROADMAP "Backlog").
- Before it is picked up: a fresh plan against the code as it is then (bank transfer landed), a provider chosen from the
  owners' company country and bank, and Stripe (or the chosen provider) kept in TEST until the owner says live.
