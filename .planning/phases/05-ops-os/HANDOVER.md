# HANDOVER: Phase 5 Ops OS, built (2026-10-31 15:16 +0100)

- **Branch:** `claude/phase-05-ops-os-d47554`, base `main` `2f1a6a80`, nothing else behind it. The final commit is the one adding this file; the PR names it.
- **Method:** `/gsd-execute-phase 5`, wave by wave: `gsd-executor` on Sonnet per plan, one Opus reviewer per plan, findings fixed. All four plans share this one branch and folder. The GSD verifier was not run: nothing can be run under the no-test rule, and the four reviews read the same goal; the controller's whole-PR review covers the rest.
- **Planning record:** the plan-phase hand-over (signatures, migration reservation, shared-file list) is in git at `2f1a6a80`; decisions in `.planning/decisions/2026-10-31-phase-5-*.md`.

## Built

| Plan | What | Summary |
|---|---|---|
| 05-01 | Migration `supabase/migrations/20261031120000_ops_os.sql`, pgTAP `ops-os.test.sql` (`plan(147)`), database types, agreed-price entry, refund rules, contracts | `05-01-SUMMARY.md` |
| 05-02 | Dashboard `/bookings/new` (five steps, browser-only chunk), `availability`, `quote`, `create` routes, hand-made email and its resend, agreed price in History, New booking and Make a booking buttons | `05-02-SUMMARY.md` |
| 05-04 | Home, Customers, Profile wired and live, `home`, `customers`, `profile` routes, session-storage hand-off from Customers to Bookings | `05-04-SUMMARY.md` |
| 05-03 | Record refund, Void, resend (lazy chunk), `refund`, `refund-void` routes, refund email EN/AR/ES, guest page Refunds line | `05-03-SUMMARY.md` |

## Checked (on the final code)

- `npx tsc --noEmit`: clean. `npm run tokens:check`: theme up to date. `re_` under `app`, `components`, `lib`: none.
- Opus review of each plan: all "fix first", no blocker. Every finding fixed or answered in that plan's summary. `jev-review` on 05-01: tier deep, opus then Fable; the Fable pass needs his yes and was not asked.

## Not verified

- **Nothing ran**, by the owner's rule: no pgTAP, no node test, no Playwright, no build, no assemble, no dev server, no local Supabase. All new tests are written and unrun; some Playwright calendar clicks guess at markup and may need a fix on first run.
- **Postgres has never parsed the migration.** It was checked by reading and by diff against the source ranges. Apply-time errors are possible.
- **Worker size measured by the controller only:** 2,580 KiB at `0680e886`; the limit is now 2,800 as signed. `next/dynamic` with `ssr: false` is new to this repo and unproven.
- No screen seen in a browser at 390, 834, 1440; RTL not seen; no email seen in an inbox; AR and ES are model-translated and unchecked.
- `BOOKING_LINK_SECRET` and the mail sender on `almar-ops` were not read; check before first use.
- Stored screenshots now stale, not regenerated: Bookings list (new button), Request detail (new button). Others may change with Home, Customers, Profile and the refund block.

## Grants used beyond the plans' tables (controller, 2026-10-31)

`tests/trip-request-state.test.mjs`, `tests/booking-request-api.test.mjs` (fixture fields); `app/dashboard/(ops)/ops-shell.tsx` (clears the handed search off Bookings and at sign-out); `components/journey/date-range-panel.tsx` (`endOnBlocked`, default off, only New booking passes it); `tests/ops-bookings-api.test.mjs`, `tests/ops-bookings.spec.ts`, `tests/phase-03-dashboard.spec.ts` (pins).

## Controller's order

1. Whole-PR review; Fable pass only on his yes.
2. Local gates in a clean clone, since nothing has run here: pgTAP (`node tests/helpers/local-supabase.mjs test supabase/tests/ops-os.test.sql`, and `booking-payments.test.sql`, whose seed was fixed but which has never run), `node --test`, the build.
3. His Ship, then squash-merge.
4. **Migration live before any deploy.** `booking-detail.tsx` calls `b.refunds.filter` unguarded, so `almar-ops` without the migration crashes every booking detail; the new routes also need the new functions. The migration is additive and safe under the running Phase 6 code (05-01 plan, "Live code"). Live read 2026-10-31: 0 bookings.
5. First `almar-ops` build: read the `Worker N KiB gzip` line. The controller measured 2,580 KiB, so `WORKER_GZIP_LIMIT_KIB` is now 2,800 in this PR (signed, no higher). Run `grep -rl "data-booking-refunds" .next/server` and `grep -rl "Links go to the preview site" .next/server`; a hit means a chunk was not dropped.
6. Before UAT, deploy `almar-preview` (`node scripts/assemble-cloudflare.mjs --target=preview`): TEST links go to preview (`lib/booking/origin.ts`), so UAT steps 19 and 22 fail falsely on Phase 6 code. Then `almar-ops`, and `almar` for the guest booking page line and emails, each on his word.

## For the owner to decide

- **Hold with no ceiling, and a TEST hold blocks real nights** (05-02 review, finding 11). A hold year typed as 2062, or a hold after arrival, is accepted; `taken` and `place_hold` do not look at `is_test`. O-03 sets no ceiling. Proposal: warn when the hold is after arrival, and add "These nights are really held" to the Test booking hint.
- **New words beyond the pictures**, EN/AR/ES, listed in `05-02-SUMMARY.md` (`noAnswer`, `priceChanged`, `nightsUnnamed` and field-error sentences) and `05-04-SUMMARY.md` (`rangeTooLong`).

## Known limits kept

- UAT needs Settings first: bank details incomplete, `balance_due_days` null, 0 stays with rates. Agreed price is the only way to price today.
- A hand-made booking records no guest terms acceptance and has no travellers (P5-13).
- A customer email starting `almar-` opens an empty Bookings list: `ops_list_bookings` reads that `q` as a ref prefix. Fix needs a new migration; not done.
- Customers count leaves out TEST; the Bookings search it opens does not. Prefill from a Request reads the newest 500 requests. Stay titles in New booking are English in every dashboard language (`/api/ops/stays` carries `title_en` only).
- The refund email's closed-booking sentence names the payment's own amount, not the net.

## Proposed for the controller

- `ROADMAP` Phase 5 plans list and criteria; `REQUIREMENTS`: OPS-03 and OPS-08 narrowed, rest v1.1 per `05-CONTEXT.md`; `STATE` and `CONTROL-BOARD`.
- `.planning/prompts/00-common-rules.md` hand-over check set still conflicts with the no-test rule.
- Lessons for the plans: reviews found test pins that read their own code comments, and old pins nobody listed. Next time, plan greps for pins against a changed screen.

## Owner's UAT

On `https://dashboard.almarprivatejourney.com`, after the migration and deploy, signed in as owner. Tick **Test booking** on every booking below.

**Settings first**

1. Settings: fill bank details, and balance due days. Save. Expected: saved, reload keeps them. (Skip if done.)

**Home, Customers, Profile**

2. Open the dashboard root. Expected: you land on Home with Bookings, Recorded money, Outstanding; no Cost, Occupancy, Charts or Reminders.
3. Click Last 30 days, then a custom range. Expected: numbers and dates change; a TEST booking is not counted.
4. Click a number card. Expected: Bookings opens unfiltered.
5. Open Customers. Expected: a list with name, email, phone, bookings count, last arrival; no New customer. With only TEST bookings the list is empty.
6. Open Profile. Expected: your name and email, read only, no sign-out button there.

**New booking**

7. Bookings › New booking. Type guest name, email, phone. Next. Expected: Step 2 of 5.
8. Choose a destination and stay, pick dates and guests. Expected: blocked nights struck through; a stay with no rate asks for an agreed price.
9. Change Destination to another one. Expected: the stay clears, nothing silently stays booked on the old stay.
10. Next through extras. On Payment, tick the agreed price, type an amount and a reason, choose Deposit, set Hold until at least 35 minutes ahead (UAE time). Expected: the summary shows VAT and deposit from Settings, on your typed price.
11. On Review, tick Test booking, press Create. Expected: the booking's detail page opens straight away with its ref, TEST, Awaiting payment; it is also in Bookings.
12. Open it. Expected: History shows the agreed price and reason.
13. Check the guest inbox. Expected: heading "Your booking is ready", bank-transfer instructions, booking link to preview, no pay link. In EN, then repeat one in AR and ES.
14. New booking again, same stay: pick checkout on the first night of the booking from step 11, a day that is struck through. Expected: it can be clicked only as the checkout, the range is accepted and the booking creates. A struck-through day in the middle of a range still refuses.
15. Requests › open a Plan, Package or Consultation request › Make a booking. Expected: name, email, phone, dates and guests filled; choosing a stay keeps the dates.

**Refund**

16. On the booking from step 11, record a bank payment. Then press Record refund: type a part amount, today's date, a bank reference. Review. Expected: it says this only records it and no money moves.
17. Confirm. Expected: Refunds lists it; Refunded and Net received change; status and Still due do not.
18. Check the guest inbox. Expected: "We have made a refund", the date and amount, no bank reference or reason.
19. Open the guest booking link. Expected: a Refunds line with date and amount only.
20. Press Resend refund email. Expected: a second email arrives.
21. Try a refund above what is left. Expected: refused, nothing recorded.
22. Void the refund with a reason. Expected: the row stays struck through with your reason; the guest page stops showing it; no email goes.
23. Record a refund again, then try to void the payment under it. Expected: refused, "void the refund first" in words.

Your "done", "correct" or "working" is a pass.

## Jev and automation, per GSD step

- **Execute:** Jev picked the reviewer tier on 05-01 (real call: deep; money 0.99, database 0.99). Nothing in the product uses Jev: the money rules are fixed code.
- **Verify:** none for Jev; UAT is the owner's. A later fit: Jev triages which UAT step a failed hand-made email points to; propose only.
- **Ship:** none: live database, money and deploys stay with the controller and his word.
- **Automation to consider later:** an unattended agent that nudges the owner when a hand-made hold is a day from lapsing with nothing paid; proposal only.
