# HANDOVER: job 25, Phase 4 plan 04-05 (2026-10-26)

- **Branch:** `phase-04-book-and-request` (pushed). Code tip before this entry `c74b7f36`.
- **Base:** origin/main merged in `3c9a3545`.
- **Checks:** `npx tsc --noEmit` exit 0, `npm run tokens:check` up to date. Everything else **not run (owner: no test)**. Table in `04-05-SUMMARY.md`.
- **Signature:** E-11 English owner notices; E-31 one receipt per payment; all else as drawn.
- **Hosted database, secrets, Cloudflare, DNS, main:** not touched.

## LIVE EFFECT (controller, before any deploy)

- `getNotifier()` is live in code. Once this is on `main`, the first `almar-ops` deploy sends **real** lapse emails and receipts, because `almar-ops` already holds `RESEND_API_KEY`. `almar` and `almar-preview` send only after the key is set there. The controller flags this to the owner at the landing (noted 2026-10-26).
- `/bookings/trip` is a public page with its three files now; a build is still unrun, so the first `next build` + `assemble-cloudflare` is its first check.

## Differs from the signed picture

- `receipt-part-2`: a receipt for money received after the pay-by date has no "Pay by {date}" sentence (owner 6b; controller ruling 2026-10-26). Code `lib/email/booking-guest-mail.ts` `receivedAfterPayBy` (late = the Dubai day received is after the pay-by instant's Dubai day); case added in `tests/booking-mail.test.mjs`.
- Unavailable state: Try again is secondary (as drawn); the plan text said primary.

## Not verified, in plain words (04-05)

1. No email was rendered to a real inbox, no page was rendered: everything is type-checked only.
2. The Resend call shape (package, Idempotency-Key header) was read from `node_modules/resend`, never called.
3. Dev-only risk: with maintenance on, the dev middleware also closes `/<locale>/bookings/trip`; on Cloudflare the static file is served without the Worker.
4. Withdraw focus after the dialog relies on a 50 ms timer after Radix's focus return.

## Model-translated copy for the owner's check

All AR and ES lines in `lib/copy/booking-email.ts` and `lib/copy/booking-page.ts` (headers say so). Owner copy is English only.

# HANDOVER: job 25, Phase 4 plan 04-03 (2026-10-26)

- **Branch:** `phase-04-book-and-request` (pushed). Code tip before this entry: the Task 5 build-spec commit (see the controller message); screens `093c6f45`.
- **Base:** origin/main merged in `56d6618c` (after #33). Nothing newer merged since.
- **Checks:** `npx tsc --noEmit` exit 0, `npm run tokens:check` up to date. Everything else **not run (owner: no test)**. Table in `04-03-SUMMARY.md`.
- **Signature:** Q-01 = B, six approved, British "Travellers" (plan section "Owner signature, 2026-10-25 23:16 CET").
- **Hosted database, secrets, Cloudflare, DNS, main:** not touched. No stack, dev server or build.

## Task 5 build specs (`b8f477e1`, not run)

- server-runtime: 200 probes for `/en|ar|es/booking/trip` (bytes, noindex, same-origin referrer, lang/dir) and a browser check of the page's own quote POST.
- slice1-sweep: the sitemap counts leave out the noindex trip pages. slice2-sweep: `isBookingFlow` filter; also fixed `isBlog` / `isSlice3` to accept the `en` prefix (since #33 `/en/blog` etc. slipped through; the sweep-list test was failing on main). Kept (controller, 2026-10-26): a fix to a test already failing on main since #33.
- stay-detail and stay-detail-held: Book button before dates, Book link to `tripHref(...)` after; the dock holds Book + the request link.
- Plain `/booking/trip` (and `/booking/trip/`): 301 to `/en/booking/trip`, query kept by the asset layer, in public/_redirects and LEGACY_SECTIONS (controller, 2026-10-26, owner decision 13); tests/locale-redirect.test.mjs gains two lines (not run).
- Plan Task 5 gate list updated to `out/en|ar|es/booking/trip.html` and `! grep -q "booking/trip" out/sitemap.xml`.
- Not done: step-rail / journey-cart baselines, the gate chain (no test, no shoot).

## Not verified, in plain words (04-03)

1. No page was rendered or built. The route move to `/en|ar|es/booking/trip` (unprefixed page deleted) has not been through `next build` + `assemble-cloudflare`; that is the first thing to run.
2. No call reached 04-08's routes: quote, hold, release are wired by types only; request is 04-05's (not called here).
3. The 29 harness scenes and every spec were written blind; selectors may need tweaks.

## Model-translated copy for the owner's check (AR and ES)

All AR and ES lines added or changed in `lib/copy/journey.ts` by this plan are model-translated (file header says so): Task 1a groups `book`, `trip`, `summary`, `travellers`, `request`, `reasons`, `bookingStatus` (except `bookingStatus.confirmed`, the canvas word), changed `steps.pay`, `addons.intro`, `cart.note`, new `cart.vatRate/payFirst/balanceBy/payFull`, `pay.terms.error`; and from the signature `travellers.errors.summary`, `request.windowNote`. The terms line keeps the English bracket `[Booking terms]` in AR and ES until the terms document exists.

## NEEDS OWNER (04-03)

- `request.windowNote` says "[N] hours", while the transfer window can be set in minutes or days (04-09 Settings). If the real window is not whole hours the line needs rewording, or should use the same `windowParts` text as the held state.
- English labels the agent wrote where the plan had none (form labels, error lines, step titles, reason lines): listed in the 04-03 Task 1a report; worth one read by the owner.

## 04-08 migration hash changed (04-09 follow-up)

`20261019160000_booking_requests.sql` is now 2,106 lines, sha256 `2f04c72a969f9a15369609816763a99269d938261ebb7e9ceff5fe405de97f22` (note request_id, `a6723c6e`); the 04-08 entry below records the older hash.

# HANDOVER: job 25, Phase 4 plan 04-09 (2026-10-25)

- **Branch:** `phase-04-book-and-request` (pushed). **Final commit:** the one that adds this entry (`docs(04-09): SUMMARY and HANDOVER (owner: no test)`); code tip before it `fbca17bb`.
- **Base:** origin/main `0f8f6091` (#33, /en /ar /es) merged in `15584a24`, no conflicts.
- **Checks:** `npx tsc --noEmit` exit 0, `npm run tokens:check` up to date. Everything else **not run (owner: no test)**. Full table in `04-09-SUMMARY.md`.
- **Signature:** all A, record on closed bookings, deposit-left line, missing copy added (plan section "Owner signature, 2026-10-25").
- **Hosted database, secrets, Cloudflare, DNS, main:** not touched. No stack, dev server or build started.

## Not verified, in plain words (04-09)

1. No screen was ever rendered: list, detail, dialogs and the Bank transfer section are type-checked only. Playwright selectors written blind may need tweaks (date input fill, ListTable row click, the Select in Bank transfer).
2. No handler ran against SQL; part B of 04-08's migration has still never compiled (04-08 item 1), and these routes call it.
3. The parity grids (nextStatus vs booking_next_status 288, depositFloor vs booking_deposit_floor 80) are written, not run.

## Reviewer nits accepted (Sonnet, Tasks 5–6)

- A resend replayed with the same request_id writes a second `resend_requested` / `email_sent` event (the mail itself dedupes by key).
- A null view after a record gives both mails "skipped" with no event; the owner uses Resend receipt (signed decision 5).
- The record POST awaits the mail with no timeout; matters once 04-05's real notifier is in.
- `ops_set_booking_status` (04-02) has no `booking_assert_owner`; the gate is requireOwner + service-role grant. A later migration may add it.

## NEEDS OWNER (04-09)

- `app/dashboard/(ops)/bookings/detail/booking-detail.tsx:235` "Still due" on the detail shows the total left (example AED 9,000) while the record review shows the deposit left by the pay-by date (AED 3,000, signed 2026-10-25). Should the detail match the review, or show both? The controller asks him with a picture at the phase landing (Opus review nit 1).

## Proposed for the controller

- STATE / CONTROL-BOARD: 04-09 written and pushed, checks not run (owner: no test), tsc clean, Sonnet review of 5–6 no blocker.
- A UI review of Tasks 2–3, 7–8 by Opus (Sonnet wrote them) if wanted before the PR.
- Live: `BOOKING_LINK_SECRET` on `almar-ops`.

# HANDOVER: job 16, Phase 4 plan 04-08 (restart, 2026-10-21)

- **Branch:** `phase-04-book-and-request` (pushed). **Final commit:** the commit that adds this file (subject
  `docs(04-08): SUMMARY and HANDOVER (owner: no test)`); code tip before it `b9463828`. Folder clean after that commit.
- **Base:** `origin/main` `3b9775cb` merged in first (`a58685da`, no conflicts, main wins).
- **Owner rule:** "Direct, no test" (2026-10-21, via the controller). The controller ruled `npx tsc --noEmit` is not a test.
  Every other check below is **not run (owner: no test)**.
- **Local stack:** `almar-51d57db4` was started once inside the controller's slot and stopped (exit 0). Nothing of this job is running.
- **Hosted database, secrets, Cloudflare, DNS, main:** not touched.

## Commits (04-08)

| Commit | What |
|---|---|
| `299d1107` | migration part A + `supabase/tests/booking-requests.test.sql` (plan 221) |
| `88fd1e96` | migration part B + `supabase/tests/booking-payments.test.sql` (plan 237) + `tests/booking-money.db.test.mjs` |
| `150b0a36` | `lib/supabase/database.types.ts` **hand-written** (no stack to generate) |
| `ab63986b`, `ddbcac7b` | Task 3: gate, bank validators, email seam, contracts (tests, then code) |
| `b7a6d2dd`, `a41939bc` | Task 4: request / view / withdraw routes, gate on quote and hold, `liveGate` removed |
| `cb2aa02d`, `b9fd228a` | Task 5: scheduled lapse on `almar-ops`, `[triggers] crons = ["*/5 * * * *"]` |
| `b9463828` | reviewer fix: per-email advisory lock before the 3-open count |

## Every check on the final commit

| Check | Result |
|---|---|
| `npm ci` | exit 0 (at start) |
| `npx tsc --noEmit` | exit 0 after Task 4, after Task 5, and on the final code commit `b9463828` |
| `node --test tests/*.test.mjs` | not run (owner: no test) |
| `npm run tokens:check` | not run (owner: no test) |
| `npm run build`, `assemble-cloudflare` prod / preview / ops, worker size guard | not run (owner: no test). The ops bundle now carries a lazy second Supabase client copy (PATTERNS 2.5): unmeasured |
| `npx playwright test` (build specs: server-runtime, lapse-cron, ops-runtime, ops-api) | not run (owner: no test) |
| pgTAP, Task 1 file at `299d1107` (local reset, before the rule) | **PASS: 4 files, 615 tests** (booking-requests 221, bookings-and-ops 352, site_settings_access, save_site_settings) |
| pgTAP after Task 2 (all files, booking-payments 237) | not run (owner: no test) |
| db tests (`booking-money`, `booking-hold`, `booking-routes`) under ALMAR_REQUIRE_STACK=1 | not run (owner: no test) |
| types regenerated and diffed | not run: hand-written |
| Bite checks S1-S37, U1-U7, N1-N4, T1-T8 (and L1-L3, W1-W2) | **not run (owner: no test)** |
| Acceptance greps of Tasks 1-5 | run, clean (grep only) |
| Different-model review (Sonnet `reviewer`, read-only, diff to `a41939bc`) | **no blocker**; finding 1 fixed in `b9463828` |

## What was NOT verified, in plain words

1. **Part B of the migration has never been parsed by Postgres.** `ops_record_payment`, `ops_void_payment`, the owner reads,
   the new `ops_lapse_holds`, the guard trigger and the lapse-email claim may fail to apply. The reviewer read every line and
   found no syntax or name error, but the first reset anywhere is its first compile.
2. The reviewer fix (`pg_advisory_xact_lock` in `request_web_booking`) has not been applied either.
3. No race was ever run: withdraw vs record, eight parallel records on one request id, the claim lease and skip-locked.
4. None of the new or edited node tests, pgTAP files or build specs has run red or green. `plan(237)` of booking-payments is
   a count of assertion lines and may need correcting on the first run.
5. `lib/supabase/database.types.ts` is hand-written. `booking_flags(b public.bookings)` is typed as taking the bookings Row,
   and `p_locale` of `booking_view` / `guest_bookings` is typed `string` though callers may pass null. Regenerate after
   the first local or live apply.
6. The `almar-ops` bundle with the lazy `lib/booking/lapse-worker.ts` import (second copy of `next/headers` + `@supabase/ssr`)
   was never built: unknown whether wrangler bundles it and whether it fits the size guard and the 10 ms CPU of the Free plan.
7. The lapse-cron spec's A1 (Worker secrets reach `process.env` in `scheduled`) and A2 (the bundle with the lazy import starts)
   are not settled.
8. Screens: none in this plan. Nothing visible changed for a guest except that the quote and hold routes now answer
   `requests_closed` on production (the gate is closed until terms, link secret, window, bank details and a ready mail sender exist).

## Migration safety on real rows

`20261019160000_booking_requests.sql` adds nullable or defaulted columns (no rewrite), replaces the four inline checks with
plain `drop constraint` + `add ... not valid` + `validate` (the live names are Postgres's defaults; a different live name stops
the apply instead of leaving the old rule), creates three empty owner-only tables and one singleton row of nulls, adds
functions, one trigger and three indexes, and replaces `public_booked_nights` and `ops_lapse_holds` with the same signatures and
grants. It deletes nothing and rewrites nothing. Live rows: every existing `booking_payments` row gets `method = 'card'` (the
truthful backfill) and passes the new checks; every booking gets `written_off_fils = 0`, `lapse_email_attempts = 0` and nulls.
`validate constraint` on `booking_events_action_check` passes only if every live event action is among the 19 (the 12 of
04-02 are all kept). sha256 `3ba14152a70eaf6af45ddd459f93e63b4e3ef60d19ed3d2a992af7d2e326b97e`, 2,086 lines.

**Recommendation to the controller:** because part B never ran, do one local reset of this branch before the live apply
if the owner allows a non-test apply check; otherwise the live apply is its first compile (it runs in one transaction, so a
failure leaves the live database unchanged).

## Environment names added (never values)

None new. The routes read the existing `BOOKING_LINK_SECRET` (via `bookingLinkConfigured()`), and the Supabase names through
`createSupabaseAdmin()` / `readSessionProfile`. `PW_TEST_SCHEDULED` is a test-runner switch only.

## Reviewer findings (Sonnet, read-only)

1. Should-fix, **fixed** (`b9463828`): the open-request cap was not atomic across stays.
2. **Decision for the owner/controller:** a TEST request on preview needs only complete bank details (P-06), so once the owner
   saves the real bank details, anyone who completes a hold on `preview.almarprivatejourney.com` sees the real IBAN and SWIFT
   before production opens. As signed this is intended; the alternative is to gate TEST on the same flags as production
   (or keep preview noindexed and unlinked, as it is today).
3. Nit: a lapse email that fails five claims leaves no terminal event (`attempts_exhausted`). Low risk (production needs a
   ready sender).
4. Nit: view and withdraw answer 503 without `BOOKING_LINK_SECRET` even on the session path.
5. Nit: a failed first request mail is not retried until 04-09's resend.
6. Nit: hand-written types (see item 5 above).

## Proposed changes (controller applies; I did not edit these files)

- `.planning/STATE.md` / `CONTROL-BOARD.md`: 04-08 written and pushed (`phase-04-book-and-request`, tip = this commit),
  checks not run (owner: no test), tsc clean, Sonnet review no blocker; Task 6 (controller checks) and the live steps open.
- `ROADMAP.md`: none. `decisions/`: record reviewer finding 2's answer when the owner gives it.
- `prompts/`: the next job (04-03 / 04-09 / 04-05 / 04-06) should read this hand-over's items 1, 5 and 6.

## Owner steps (from the plan, controller only)

1. Apply the migration verbatim (after `20261019120000`; not waiting for 130000/140000), then the plan's live read-back SQL.
2. Deploy `almar-ops` (assemble `--target=ops` immediately before; record version and rollback); `wrangler tail` two ticks
   for `outcome` and `cpuTime`. Migration first, deploy second.
3. Do not set `BOOKING_LINK_SECRET` on `almar` before `almar` runs this gate.
4. Secrets as in the plan (Supabase names on `almar-preview` on the owner's word; `BOOKING_LINK_SECRET` generated and piped;
   `RESEND_API_KEY` by the owner after 04-05).
5. Owner in the dashboard after 04-09: transfer window, bank details, balance due days, terms text.
6. Deploy `almar` and `almar-preview` with this gate only on the owner's word.

## The owner's numbered test steps (for 04-07 UAT; nothing of this plan has a screen)

1. On `preview.almarprivatejourney.com`, after the owner saves TEST bank details (04-09): pick a stay and dates, hold, then
   Request → the answer says requested, with a deadline 35 minutes ahead.
2. Open the booking link → status awaiting payment, bank details shown, amount = the deposit, the booking reference as transfer reference.
3. Withdraw on the booking page → status cancelled, the dates free again on the stay's live quote.
4. A second request, owner records a part payment in the dashboard → the booking page shows part received; Withdraw is gone.
5. Wait past the deadline + 5 minutes → the part-paid request stays awaiting payment and the dashboard flags "Pay-by date
   passed, part paid"; an unpaid one lapses.
6. On `almarprivatejourney.com` → the quote says requests are closed; no hold is created.

## Lessons from the owner's corrections

- "Direct, no test": work sessions write the code and the test files the plan names and run nothing; a type-check is allowed.
  Saved in the project memory `owner-no-test-direct.md` (with the controller's tsc ruling).
