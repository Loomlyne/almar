---
phase: 04-book-and-pay
plan: 02
subsystem: database, api
tags: [postgres, supabase, plpgsql, rls, pgtap, advisory-lock, hmac, webcrypto, route-handlers, cloudflare-workers]

requires:
  - phase: 04-book-and-pay (04-01)
    provides: lib/money (priceBooking, dubaiToday, fils and basis-point helpers)
  - phase: 03.2 (03.2-01)
    provides: catalogue migration 20261005100000 (stays, stay_night_rates, stay_ops_blocked_days, catalog_items, api_stay_blocked_days, ops_add_block), tests/helpers/local-supabase.mjs
provides:
  - migration 20261005110000_bookings_and_ops.sql (10 tables, 31 functions, two 3.2 hand-overs)
  - the 30-minute hold with per-stay locking, no cron (lazy sweep)
  - POST /api/booking/quote, /api/booking/hold, /api/booking/release
  - lib/booking/* (contracts, parsers, signed booking link, origins, access rule, server helpers)
affects: [04-03 booking pages, 04-04 Stripe, 04-05 emails and account, 04-06, 04-07 UAT, 05-01 ops, 05-02 hand-made bookings]

tech-stack:
  added: []
  patterns:
    - "definer functions, search_path '', execute for service_role only, one grant per function"
    - "lock order: per-stay advisory lock, then the booking row, then its nights and payments"
    - "money in bigint fils, percentages in basis points, rounding only in lib/money"
    - "signed booking link: base64url HMAC-SHA256 over booking-link:v1:<id>:<link_version>, WebCrypto verify (constant time)"
    - "server helpers take any object with .rpc(name, args): the routes pass the service-role client, tests pass a fake"
    - "node tests that write to the one local stack take a pid-checked lock (acquireStackLock)"

key-files:
  created:
    - supabase/migrations/20261005110000_bookings_and_ops.sql
    - supabase/tests/bookings-and-ops.test.sql
    - lib/booking/{types,ref,terms,link-token,link,origin,access,validate,http,server}.ts
    - app/api/booking/{quote,hold,release}/route.ts
    - tests/booking-api.test.mjs
    - tests/booking-link.test.mjs
    - tests/booking-hold.db.test.mjs
    - tests/booking-routes.db.test.mjs
    - tests/helpers/load-route.mjs
  modified:
    - lib/server-routes.ts
    - tests/server-runtime.test.mjs
    - tests/build/server-runtime.spec.ts
    - tests/helpers/local-supabase.mjs
    - tests/import-catalog.test.mjs

key-decisions:
  - "Hold: 30 minutes; its nights outlast it by 1 minute (Checkout Session margin) plus a 2-minute sweep grace; no cron: place_hold and ops_lapse_holds sweep lapsed holds"
  - "Hold limiter: 5 holds an hour per email, 20 an hour per IP, keyed hashes (job 02's limiterHash), constants in claim_hold_slot"
  - "A guest's own hold is skipped in their own quote only when the request carries that hold's ref and a token that verifies; knowing an email frees nothing"
  - "A hold ends only by release (token), payment flow, or expiry; never by a new hold of the same email"
  - "stays.infants_count null (owner has not said) reads as: infants do not count toward max_guests (the plan's own rule: counted only when true)"
  - "booking_lines.name stores the English name (plan: EN snapshot); the booking's locale keeps the guest's language"
  - "31st function booking_by_ref(p_ref) added: the quote's own-hold check and the release need a lookup by reference and the plan named none"

patterns-established:
  - "Every outcome the guest can cause is a reason code in the answer (B-02), never a silent hide or a thrown error; a database failure throws and the route answers 503 with no input in the message"
  - "A refusal inside an owner-side SQL function is SQLSTATE P0001 'almar:<code>'; the public hold and payment functions return { ok: false, reason }"

requirements-completed: [BOOK-03, BOOK-04, STAY-01, STAY-02, STAY-03, STAY-04, STAY-06, PAY-14, AUTH-01, OPS-05, OPS-06, ADDN-01, IDEN-01, IDEN-02, JOUR-01]

duration: not recorded (the session was compacted once)
completed: 2026-10-05
---

# Phase 4 Plan 02: Bookings database, 30-minute hold, live quote, release Summary

**Ten booking tables and 31 locked-down SQL functions (one transaction and one per-stay advisory lock per hold, so ten guests asking for the same nights give exactly one winner), plus three POST endpoints that price on the server with every reason shown and issue a signed booking link.**

Branch `gsd/phase-04-p02`, tip below, cut from origin/main `bbc35b7`, merged with origin/main `9ab7e49` (3.2-11 kit; no file touched by both sides). Nothing was applied to the live project, nothing deployed, no secret written.

## Accomplishments

- Migration `20261005110000_bookings_and_ops.sql`, sha256 `4b4a6a5002f8fd24f31966580f7b6e89ee297b3bf6d7b519f31ad3c5b78a675c`, 2001 lines. Creates `bookings`, `booking_travellers`, `booking_lines`, `booking_nights` (pk `(stay_id, night)`), `booking_payments`, `booking_refunds`, `booking_disputes`, `booking_events`, `stripe_events`, `booking_hold_requests` (RLS on, every privilege revoked from public, anon, authenticated, no policy) and 31 functions (31 `security definer`, 31 `grant execute`, each `set search_path = ''`). It adds `site_settings.balance_due_days`, seeds VAT 5.00 and deposit 30.00 only where those cells are still null (decision B-04, the owner's TEST starting values), replaces 3.2's view `api_stay_blocked_days` and function `ops_add_block` with the same columns and signature, and changes nothing else. 3.2's migration is byte-identical to main (`git diff origin/main -- ...20261005100000_catalog_and_team.sql` is empty).
- Hold: `create_web_booking` (settings re-checked, booking `held`, nights placed, event) in one transaction; `place_hold` sweeps lapsed holds of that stay, refuses ops-blocked nights (`blocked`) and held nights (`sold_out`); primary key `(stay_id, night)` is the last guard. Paid and confirmed bookings keep their nights for good.
- Payment-side records for 04-04: `open_payment`, `attach_checkout_session`, `mark_session_expired`, `record_payment` (idempotent, safe under eight concurrent calls), `set_payment_card`, `record_refund`, `record_dispute`, `claim_stripe_event` / `finish_stripe_event` / `drop_stripe_event`.
- Owner-side functions 05-01 and 05-02 call instead of defining: `ops_create_booking`, `ops_set_booking_status`, `ops_lapse_holds`, `new_booking_ref`, `log_booking_event`, `ops_add_block`.
- Endpoints: quote (all reasons, server money, own-hold skip with verified link), hold (limiter, re-quote, create, signed link), release (token only). POST only, JSON only, 32 KB (release 4 KB) by Content-Length and by bytes read, Origin must equal the host's booking origin, `cache-control: no-store`, nothing logged, the booking id is never sent to the browser.
- `/booking` left `HELD_PATHS`. The assembler lists `/api/booking/hold`, `/api/booking/quote`, `/api/booking/release` among the server paths.

## Task Commits

1. **Task 1: bookings database** (TDD with pgTAP): `c4e245c` feat (migration, 348 pgTAP, race test), `a02c2e8` test (race test waits for the API, stress test with lapsed holds), `5926437` feat (`booking_by_ref`, pgTAP 352)
2. **Task 2: contracts, link, parsers** (TDD): `fb0f070` test (RED), `3e793c6` feat (GREEN)
3. **Task 3: endpoints, server helpers, /booking unheld** (TDD): `7ce76ec` test (RED), `594ddd8` feat (GREEN), `bdf6976` test (stack lock), `969f658` fix (English line names), `f1f7aea` test (stress bites reliably)
4. **Merge of origin/main 9ab7e49:** `a47474d`

Tip at hand-over: see the final report (the SUMMARY commit follows it).

## 3.2 names as reconciled

Used as they are on main; nothing in 3.2's migration is edited.

| 3.2 name | Used for |
|---|---|
| `stay_night_rates(p_stay, p_from, p_to)` returns `(night, nightly_rate_aed, source, rate_id)` | `booking_context.night_rates`, converted to fils; the engine never chooses between ranges |
| `stay_ops_blocked_days(p_stay, p_from, p_to)` returns `day` | `booking_context.blocked` |
| `stays` (`max_guests`, `min_nights`, `infants_count`, `base_nightly_rate_aed`, `hero_media_id`, `is_published`), `stay_translations`, `destinations`, `destination_translations`, `media`, `image_translations` | stay card; the locale text is used only when published, else English |
| `catalog_items` (`kind`, `unit`, `price_aed`, `is_uae`, `is_home_pickup`, `is_published`, `media_id`, `position`), `catalog_translations`, `catalog_item_stays`, `catalog_item_destinations` | offers: published, priced, linked to the stay or its destination or UAE-side; the explicit `is_home_pickup` flag (never `is_uae` or a slug) drives B-11 |
| `inclusions`, `inclusion_translations` | the seven inclusions in the quote |
| `site_settings` (`vat_percent`, `deposit_percent`) | read as basis points; null stays null |
| `availability_blocks`, `catalog_txt`, `catalog_invalid` | `ops_add_block` keeps 3.2's body and helpers |
| view `api_stay_blocked_days` | replaced: 3.2's first branch unchanged plus `public_booked_nights()`; `security_invoker = on`, same grants |
| function `ops_add_block(jsonb)` | replaced: same signature and result plus `overlapping_bookings`; definer; takes the per-stay lock for scope `stay` |

Reconciled against the plan: 05-01 wrote `ops_expire_lapsed`, which fails the `re_` gate; it is `ops_lapse_holds()` here. `booking_drop_hold` returns `jsonb { dropped, closed_sessions }` instead of `void` so the caller needs no second read.

## Hold limits chosen

- Web hold 30 minutes (`hold_expires_at`); its `booking_nights.expires_at` is 1 minute later (Stripe session margin, research Pitfall 4); a night row stays 2 minutes past its expiry (sweep grace), so a payment confirmed just before expiry still finds its nights. The quote and the hold use the same grace.
- Hand-made hold: the owner's "hold until" (UAE time), status `awaiting_payment`, must be more than 35 minutes ahead (`almar:hold_too_soon`).
- No cron. `place_hold` (for its own stay and range) and `ops_lapse_holds()` mark `held` / `awaiting_payment` bookings with `hold_expires_at < now() - 2 minutes` as `expired`, free their timed nights and write a `hold_expired` event.
- Limiter `claim_hold_slot`: 5 per email per hour, 20 per IP per hour (constants `c_per_email`, `c_per_ip` in the function; the only place to change them). Hashes are keyed (job 02's `limiterHash` under `authSigningKey("limit")`); the raw email and address never reach the database. A request counts when it passes the parser, even if the quote then refuses it.
- One hold can span up to 366 nights (the SQL and the quote both refuse more). Owner decision still open: a maximum stay length.
- Request bodies: 32 KB (hold, quote), 4 KB (release).

## Where owner values are read (none invented)

| Value | Read from | If null |
|---|---|---|
| VAT % | `site_settings.vat_percent` (seeded 5.00 only where null, B-04) | `settings_missing`, no price |
| Deposit % | `site_settings.deposit_percent` (seeded 30.00 only where null, B-04) | `settings_missing`, no price |
| Balance due days N | `site_settings.balance_due_days` (new column, left null) | deposit refused (`deposit_unavailable` / `no_due_days`), full payment still works |
| Min nights, max guests, infants count | `stays.min_nights`, `max_guests`, `infants_count` | max null = no limit; infants null = not counted |
| Base rate, rate ranges | `stays.base_nightly_rate_aed`, 3.2's range rows | `no_rate` |
| Add-on prices | `catalog_items.price_aed` | item not offered |
| Booking terms text | does not exist: `lib/booking/terms.ts` `BOOKING_TERMS_VERSION = "placeholder"`, `BOOKING_TERMS_IS_PLACEHOLDER = true` (page shows `[Booking terms]`) | live payments stay closed: the hold route answers 503 for a live Stripe key while the placeholder flag is true |

## What 05-01 and 05-02 call instead of defining

SQL (all `service_role` only): `ops_set_booking_status(p_booking uuid, p_to text, p_expected_from text, p_actor uuid)` (Confirm, Mark completed, Cancel; Cancel frees nights, never refunds, returns `closed_sessions`), `ops_lapse_holds() returns int`, `ops_create_booking(p jsonb, p_actor uuid)` (idempotent on `ops_request_id`), `new_booking_ref()`, `log_booking_event(p_booking, p_actor, p_action, p_detail)`, `ops_add_block(p jsonb)` (now returns `overlapping_bookings`), `booking_by_ref(p_ref)`, `public_booked_nights()`.

TypeScript: `snapshotRow(breakdown, offers)` in `lib/booking/server.ts` builds the money part of the `ops_create_booking` payload (snake_case, add-on lines with name and `is_home_pickup`); pass offers read in English (see Deviations). `quoteBooking(db, input)` prices a hand-made booking the same way the guest's is priced. `authorizeBookingAccess` and `verifyBookingLink` / `signBookingLink` (`lib/booking/link.ts`) for the link and session rule. `isAllowedPostOrigin` / `bookingOrigin` (`lib/booking/origin.ts`, includes the preview origin) for POSTs and return URLs.

For 04-04: `open_payment` (amount from the stored booking, never the caller), `attach_checkout_session`, `mark_session_expired`, `record_payment`. `record_payment` answers `found: false` for a session it does not know: the webhook must treat that as a retry (500), not as success. `releaseWebHold` already returns the Checkout Session ids to expire; the route does not send them to the browser and does not expire them at Stripe yet (04-04). `liveGate(secret)` (in `server.ts`) is moved by 04-04 into `lib/stripe/server.ts`.

05-01 must keep `bookings.needs_attention` visible: it is set when money arrives for a cancelled or expired booking, or when the nights could not be re-placed; the booking status is left as it was and ops refunds in Stripe (O-01).

## Shared-file lines (additive; each line listed)

- `lib/server-routes.ts`: removed `"/booking",` from `HELD_PATHS` (1 line).
- `tests/server-runtime.test.mjs`: pinned held list is the five sections (`["/dashboard", "/fx", "/newsletter", "/embed", "/__harness"]`) and its title; the held-extra loop lost `"/booking/trip"` and `"/ar/booking"` and gained `"/ar/fx"`; `"/booking/export"` became `"/fx/export"`; the public/ fixture list swapped `booking.html` and `ar/booking.html` for `fx.html` and `ar/newsletter.html`; one new test (`/booking` is not held, the three endpoints are served).
- `tests/build/server-runtime.spec.ts`: `PINNED_HELD` lost `"/booking"`; `/booking`, `/booking/trip`, `/es/booking` moved from `HELD_PROBES` to `OTHER_MISSES`; the expected server-path list gained the three `/api/booking/*` paths; the held-list test title says five; one new probe: `POST /api/booking/quote` with `{}` answers 400, 403 or 503 (never 404), JSON, no-store, noindex; `GET` answers 405.
- `tests/helpers/local-supabase.mjs` (3.2-01's): additive export `acquireStackLock()` and its `statSync` import; header export list.
- `tests/import-catalog.test.mjs` (3.2-01's): imports `acquireStackLock`; takes the lock in its stack test and releases it in its existing `after` hook (3 added lines, 1 changed import).
- Not touched: `wrangler*.toml`, `lib/ops-routes.ts`, `lib/copy/*.ts`, `lib/locale-path.ts`, `package.json`, `components/ops/api-types.ts`, `03.2-API-CONTRACT.md`, 3.2's migration.

## CPU probe (the controller runs it after the preview deploy; this session never deploys)

Precondition: `almar-preview` has no secrets on purpose, so `/api/booking/quote` answers 503 before touching the database and the probe would measure nothing. For the probe the preview Worker needs `NEXT_PUBLIC_SUPABASE_URL` and the service-role key (or probe on `almar` once those exist there). Quote needs no `BOOKING_LINK_SECRET`.

1. Terminal 1:
   `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler tail almar-preview --format json`
2. Terminal 2, twenty times (plan full needs no balance days; pick a published stay with a base rate and a start date at least 60 days ahead):
   `curl -s -X POST https://preview.almarprivatejourney.com/api/booking/quote -H 'content-type: application/json' -H 'origin: https://preview.almarprivatejourney.com' --data '{"stay":"<published stay slug>","from":"<YYYY-MM-DD>","to":"<from + 3 nights>","adults":2,"children":0,"infants":0,"addons":[],"plan":"full","locale":"en"}'`
3. Read `cpuTime` and `outcome` per request. Any `exceededCpu` goes to the owner as the Workers Paid question, with the numbers (D-SR-02 rule). Local reference only: the Worker bundle is 1816 KiB gzip (production) and 1802 KiB (preview), under the guard.
4. Hold and release write rows and are measured during the owner's TEST UAT (04-07).

## Owner and controller steps

1. The controller applies the migration to the live project once, verbatim (sha256 above), after the owner's word, then runs the read-back below.
2. The owner sets, from his terminal, `BOOKING_LINK_SECRET` (at least 32 characters, the same value) on Workers `almar`, `almar-preview` and `almar-ops`. Without it the hold route answers 503 and no hold is ever created.
3. The owner sets `PUBLIC_ORIGIN` on `almar-ops` only (the preview origin while Stripe is TEST, the production origin at go-live). Read by `lib/booking/origin.ts` only.
4. Owner values still needed: balance due days N (`site_settings.balance_due_days`), the booking terms text, `infants_count` per stay (Content, C-13), a maximum stay length if wanted.

## Live-apply read-back (read-only; run on the live project after applying)

```sql
-- 1. ten tables, RLS on (expect 10 rows, all true)
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('bookings','booking_travellers','booking_lines','booking_nights','booking_payments',
   'booking_refunds','booking_disputes','booking_events','stripe_events','booking_hold_requests') order by 1;
-- 2. no table privilege for anon, authenticated or public (expect 0)
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
   and table_name in ('bookings','booking_travellers','booking_lines','booking_nights','booking_payments',
     'booking_refunds','booking_disputes','booking_events','stripe_events','booking_hold_requests');
-- 3. 31 functions, all definer, search_path empty, service_role may execute (expect 31)
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = any (array['booking_set_updated_at','booking_fail','new_booking_ref','booking_lock',
   'booking_int','booking_txt','booking_date','booking_uuid','booking_context','claim_hold_slot','place_hold','booking_write',
   'create_web_booking','ops_create_booking','ops_set_booking_status','ops_lapse_holds','booking_drop_hold','open_payment',
   'attach_checkout_session','mark_session_expired','record_payment','set_payment_card','record_refund','record_dispute',
   'claim_stripe_event','finish_stripe_event','drop_stripe_event','log_booking_event','public_booked_nights','ops_add_block',
   'booking_by_ref'])
   and p.prosecdef and has_function_privilege('service_role', p.oid, 'execute')
   and exists (select 1 from unnest(p.proconfig) cfg where cfg = 'search_path=""');
-- 4. anon and authenticated may execute exactly one of them (expect {public_booked_nights})
select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = any (array['booking_set_updated_at','booking_fail','new_booking_ref','booking_lock',
   'booking_int','booking_txt','booking_date','booking_uuid','booking_context','claim_hold_slot','place_hold','booking_write',
   'create_web_booking','ops_create_booking','ops_set_booking_status','ops_lapse_holds','booking_drop_hold','open_payment',
   'attach_checkout_session','mark_session_expired','record_payment','set_payment_card','record_refund','record_dispute',
   'claim_stripe_event','finish_stripe_event','drop_stripe_event','log_booking_event','public_booked_nights','ops_add_block',
   'booking_by_ref'])
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
-- 5. settings (expect 5.00, 30.00 unless the owner had set them, null)
select vat_percent, deposit_percent, balance_due_days from public.site_settings where id = 1;
-- 6. the replaced view: columns stay_id, day; security_invoker on; anon can still read it
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'api_stay_blocked_days' order by ordinal_position;
select reloptions from pg_class where oid = 'public.api_stay_blocked_days'::regclass;           -- {security_invoker=on}
select has_table_privilege('anon', 'public.api_stay_blocked_days', 'select');                   -- true
-- 7. ops_add_block replaced: definer, search_path empty
select prosecdef, proconfig from pg_proc where oid = 'public.ops_add_block(jsonb)'::regprocedure; -- t, {search_path=""}
-- 8. nothing booked yet (expect 0)
select count(*) from public.bookings;
```

Then, from the Worker (never from the database), one `POST /api/booking/quote` for a published stay answers 200 with `ok` and a breakdown.

## Tests and results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run tokens:check` | theme up to date |
| pgTAP, `node tests/helpers/local-supabase.mjs test` (3 files) | 634 checks pass (`bookings-and-ops.test.sql` 352, 3.2's two files 282) |
| `ALMAR_REQUIRE_STACK=1 node --test tests/*.test.mjs`, stack running | 1276 tests, 1263 pass, 0 fail, 13 skipped (older plans' pins of deleted files, and media checks that need `MEDIA_CHECK_OUT` or `media-staging/`) |
| `node --test tests/*.test.mjs`, no stack | 1276 tests, 1248 pass, 0 fail, 28 skipped (the 15 stack-only cases print "no local Supabase stack") |
| `tests/build/server-runtime.spec.ts` on `wrangler.toml` and `wrangler.preview.toml`, port 3131, `--workers=2` (Playwright used 1: one spec file) | 12 of 12 pass on each; port 3131 free afterwards |
| `node scripts/assemble-cloudflare.mjs` (and `--target=preview`) | server paths include `/api/booking/hold`, `/api/booking/quote`, `/api/booking/release`; Worker size guard passes |
| `grep -n '"/booking"' lib/server-routes.ts` | prints nothing |
| `grep -rn SUPABASE_SERVICE_ROLE_KEY lib/booking app/api/booking` | prints nothing |
| Trial merge with origin/main `9ab7e49` | tsc clean, 1275 tests 0 fail (before the last test added) |

New test files: `tests/booking-link.test.mjs` (17), `tests/booking-api.test.mjs` (70: parsers, access rule, quote, snapshot, hold, release, status and live gate, the three routes' source rules), `tests/booking-hold.db.test.mjs` (6, real database: ten parallel holds give one winner, overlap property, eight parallel payment reports count once, 40-round concurrent mix without deadlock, home-pickup storage, and the server helpers against the real SQL including deposit, own-hold skip, release and the limiter), `tests/booking-routes.db.test.mjs` (8: the three route handlers called with real `Request` objects against the local database).

## Bite checks (break one rule, see red, restore)

SQL, run against the final migration with the pgTAP file and `tests/booking-hold.db.test.mjs`:

| # | Broken | Red in |
|---|---|---|
| M1 | `place_hold` without the held-night check (primary key left as the only guard) | pgTAP red (exit 1); the database test file stays green, the primary key still refuses a second holder |
| M1b | M1 and the primary key dropped | pgTAP "second guest is sold_out" and the race test (more than one winner) |
| M2 | `record_payment` ignores an already succeeded payment | pgTAP idempotency; race test counts the money twice |
| M3 | paid after cancel sets `deposit_paid` instead of flagging | pgTAP "a cancelled booking stays cancelled" |
| M4 | Cancel does not free the nights | pgTAP "Cancel frees the nights" |
| M5 | `grant select on bookings to anon` | pgTAP privilege checks |
| M6 | quote without the 2-minute sweep grace | pgTAP "same grace as the hold" |
| M7 | settings drift check removed | pgTAP `settings_changed` |
| M8 | `open_payment` charges the grand total for a deposit plan | pgTAP "first payment is the stored deposit" |
| M9 | `ops_add_block` reports no overlapping bookings | pgTAP overlap counts |
| M10 | `booking_lock` without the per-stay advisory lock | stress test: deadlock detected, 8 of 8 runs (it was 2 of 6 before the stress test was strengthened; the 40-round version is committed) |
| M11 | sweep does not mark the lapsed booking expired | pgTAP sweep checks |
| M12 | `public_booked_nights` lists 30-minute web holds | pgTAP "a web hold is not baked in" |
| M13 | `mark_session_expired` without its "no other open or succeeded payment" guard | green in pgTAP and in the database tests: treated as an equivalent mutant (as found earlier); the guard stays as a defence |
| M14 | own-hold skip without the `held` status check | pgTAP "another booking's id skips only that booking's nights" |

TypeScript, node tests (U = pure modules, T = server and routes):

| # | Broken | Red in |
|---|---|---|
| U1 | Origin check accepts any non-empty Origin | `isAllowedPostOrigin` |
| U2 | dev origins allowed in production | `bookingOrigin` |
| U3 | link checked by string comparison | "the comparison is the platform's verify" |
| U4 | token ignores the link version | own-hold test, token tests |
| U5 | a wrong token falls through to the session email | access tests |
| U6 | any signed-in guest accepted | access tests |
| U7 | child age floor 2 | traveller ages |
| U8 | second booker accepted | traveller rules |
| U9 | negative add-on quantity accepted | add-on parser |
| U10 | release accepts extra keys | release parser |
| T1 | own hold skipped without verifying the link | fake-rpc and real-database tests |
| T2 | home-pickup address not required | fake-rpc, real-database |
| T3 | release ignores the access check | release tests |
| T4 | 366-night guard removed | quote dates test |
| T5 | plan full stores a deposit | snapshot test, real database |
| T6 | re-quote forwards the page's old hold | hold test |
| T7 | infants always count | quote guests test |
| T8 | limiter answer ignored | hold limiter test, real database |
| T9 | live Stripe key not recognised | `liveGate` test |
| T10 | quote parser accepts unknown keys | parser test, route test |
| T11 | streamed body size not counted | route size test |
| T12 | hold route opens live payments on placeholder terms | route 503 test |
| T13 | quote route skips the origin check | route origin test |
| T14 | release route answers 200 to a refused release | route and hold flow tests |
| E1 | line names read in the guest's language | "add-on lines store the English name" |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No lookup by booking reference**
- **Found during:** Task 3
- **Issue:** the quote's own-hold check and the release must find a booking by its ref; no function did, and the tests' seam is `.rpc`.
- **Fix:** `booking_by_ref(p_ref)` (definer, service_role only, returns id, email, link_version, status or null); pgTAP 348 to 352; function count 30 to 31.
- **Files modified:** migration, pgTAP file. **Committed in:** `5926437`

**2. [Rule 1 - Bug] `infants_count` is nullable in 3.2 (null = not set)**
- **Found during:** Task 3, the real-database test (the fake context always had a boolean)
- **Issue:** reading it as a boolean threw on every real stay.
- **Fix:** null reads as "infants do not count" (the plan's rule: counted only when true); documented above and unit tested.
- **Files modified:** `lib/booking/server.ts`, `tests/booking-api.test.mjs`. **Committed in:** `594ddd8`

**3. [Rule 1 - Bug] Line names were stored in the guest's language**
- **Found during:** Summary review against the plan ("name (EN snapshot)")
- **Fix:** the hold's re-quote reads English texts; the booking keeps the guest's `locale`.
- **Files modified:** `lib/booking/server.ts`, `tests/booking-api.test.mjs`. **Committed in:** `969f658`

**4. [Rule 3 - Blocking] Full node suite red with the stack up (4 failures)**
- **Found during:** final verification
- **Issue:** `node --test` runs files in parallel; `tests/import-catalog.test.mjs` resets and counts the stack the booking database tests seed.
- **Fix:** `acquireStackLock()` (pid-checked directory lock) held by import-catalog and the two booking database files; also a visitor address per route-test call so the 20-per-IP-per-hour limiter does not count one run against the next.
- **Files modified:** `tests/helpers/local-supabase.mjs`, `tests/import-catalog.test.mjs`, the two database test files. **Committed in:** `bdf6976`

**5. [Rule 2 - Missing critical] The stress test did not reliably bite for a missing stay lock**
- **Fix:** 40 rounds, two of three from a lapsed hold, competing calls sent twice, three new holds a round: M10 now fails 8 of 8 (was 2 of 6); unmutated 6 of 6 pass.
- **Committed in:** `f1f7aea` (earlier rounds: `a02c2e8`)

### Plan departures worth the controller's eye (not bugs)

- `claim_hold_slot` takes keyed hashes (job 02's `limiterHash`, the SQL comment's wording), not `sha256(email)`; `createWebHold`'s context therefore carries `ipHash` and an `emailHash(email)` function instead of only `ipHash`.
- `snapshotRow(breakdown, offers)` takes the offers as a second argument: the engine's snapshot lines carry no name or flags.
- `releaseWebHold` also accepts a signed-in session reader (access rule: token or matching session email), but the route requires `{ ref, t }`, so over HTTP release is link-only; `parseReleaseRequest` makes `t` required.
- The hold route requires `bookingLinkConfigured()` and a live-gate that is open, besides the admin client, before it writes anything: a hold the guest cannot be given a link for is never created.
- Added `lib/booking/http.ts` (the JSON body reader the three routes share) and `tests/helpers/load-route.mjs` (loads a route handler in node with `next/headers` stubbed).
- Phone parser: 7 to 20 characters of digits, spaces, parentheses, hyphens, optional leading plus, and at least 7 digits (the SQL checks the same pattern without the digit count).

**Total deviations:** 5 auto-fixed (2 Rule 1, 1 Rule 2, 2 Rule 3). **Impact:** all necessary for correctness or for a green full suite; no scope creep.

## Issues Encountered

- PostgREST answered `PGRST001` right after a reset; the database tests wait for it.
- `npm ci` was run once in the worktree after the trial merge; `package.json` and the lockfile are unchanged.

## Known Stubs

- `lib/booking/terms.ts`: `BOOKING_TERMS_VERSION = "placeholder"`, `BOOKING_TERMS_IS_PLACEHOLDER = true`. Intentional: the owner's terms text does not exist; the version is stored on each booking; live payments are refused while it is true. His text replaces `[Booking terms]` and flips both constants in one commit (04-03 shows the text).
- `HoldResponse.checkout` is declared but never sent: 04-04 adds the Checkout Session.
- `releaseWebHold` returns Checkout Session ids; nothing expires them at Stripe yet (04-04).

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: public-post | `app/api/booking/quote/route.ts` | Unauthenticated POST that makes one or two database calls (up to 366 night rows). It has an origin check and size limits but no per-visitor limiter (the hold has one). A Cloudflare rate-limit rule for `/api/booking/quote` is the owner's call. |
| threat_flag: public-post | `app/api/booking/hold/route.ts` | Creates rows. Limited per email and per IP (5 and 20 an hour), origin-checked; the booking id and the link secret never leave the Worker; a hold needs `BOOKING_LINK_SECRET`. |
| threat_flag: token-gate | `app/api/booking/release/route.ts` | The signed link is the only key; a wrong token and an unknown reference give the same 404. Not rate-limited. |
| threat_flag: schema | migration | `public_booked_nights()` is executable by anon: returns only `(stay_id, day)` of permanently booked or hand-held nights, no booking id. |

## Not verified

- Nothing was applied to or read from the live project, and nothing was deployed: the live-apply read-back and the CPU probe are the controller's.
- Behaviour on the real Workers runtime (CPU time, `crypto.subtle` timing, `nodejs_compat` for `node:crypto` in the limiter) is checked only on local `wrangler dev` for the paths that need no secrets (400, 403, 405).
- `tests/build/server-runtime.spec.ts` does not exercise a successful quote or hold through `wrangler dev` (no secrets on the local Worker); the route handlers are exercised end to end in `tests/booking-routes.db.test.mjs` against the local database.
- Production-target Playwright specs other than `server-runtime.spec.ts` were not run (the plan names only that one).

## TDD Gate Compliance

Tasks 2 and 3 have a `test(...)` commit (`fb0f070`, `7ce76ec`) followed by a `feat(...)` commit (`3e793c6`, `594ddd8`). Task 1 does not: its pgTAP file and the migration are one commit (`c4e245c`); its failing side is shown by the fourteen SQL mutations above (each rule broken, pgTAP or the database tests red, rule restored).

## Self-Check: PASSED

All 20 created files exist, all 11 commits named above are on the branch, the migration sha256 is `4b4a6a5002f8fd24f31966580f7b6e89ee297b3bf6d7b519f31ad3c5b78a675c`, `security definer` and `grant execute` both count 31, 3.2's migration is unchanged, no `SUPABASE_SERVICE_ROLE_KEY` in `lib/booking` or `app/api/booking`, `"/booking"` is gone from `lib/server-routes.ts`.
