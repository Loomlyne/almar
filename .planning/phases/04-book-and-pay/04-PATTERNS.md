# Phase 4: Book and request - Pattern Map

**Mapped:** 2026-10-19 (read-only pass on `phase-04-book-and-request` at `4d735039`; nothing built, no stack, no browser)
**Scope:** B-01..B-35 of `04-CONTEXT.md` (B-23..B-35 win), `decisions/2026-10-19-request-to-book-bank-transfer.md`, `04-REWRITE-DRAFT.md` section 4, `04-02-SUMMARY.md`, old plans 04-03/04-05/04-06 and `05-01`.
**Files analyzed:** 81 classification rows (about 110 files; some rows group 2-5 files) across 04-08, 04-03, 04-09, 04-05, 04-06, plus the existing pinned tests that the changes touch (section 5)
**Analogs found:** 78 / 81 rows (3 rows have none for their core; section 6 lists 7 pieces with no in-repo analog)

All paths are relative to the worktree root. Line numbers are the current files on this branch.

---

## 0. Read first: findings that change the tentative file list or the old plans

These were found by reading the repo, not the plans. Each one would have cost an executor a red test or a wrong design.

| # | Finding (evidence) | What the plans must do |
|---|---|---|
| F-01 | **The Settings screen already has a Money group.** `app/dashboard/(ops)/settings/settings-screen.tsx:279-317` draws VAT % and Deposit % and saves through `POST /api/ops/settings` -> `save_site_settings` (`supabase/migrations/20261013120000_site_settings_brand.sql`, 14 fixed params). Old 05-01 said "REWRITE: Payments and taxes only, drop Brand/FX/Email/Maintenance"; that would delete shipped 02-06 groups (brand colours, type, maintenance, logo, language). `tests/phase-03-settings.test.mjs:27-39` pins the group order `brandColors, type, money, maintenance, logo, langCurrency`. | 04-09 **extends** the screen: only `balance_due_days`, the transfer window and the bank details are new. Do not touch `lib/settings/validate.ts` (`parseSettingsSave` rejects unknown keys, `:33-34`) or `save_site_settings`. Add a **second endpoint** (`/api/ops/money`) with its own RPC pair and its own Save. |
| F-02 | **Old 04-05 and 04-06 say `referrer: "no-referrer"` on the booking page. That breaks the page's own POST.** `lib/booking/origin.ts:44-51` `isAllowedPostOrigin` needs `Origin === bookingOrigin(host)`; a page with `Referrer-Policy: no-referrer` makes the browser send `Origin: null` (memory `auth-job02-lessons`, `lib/preferences-route.ts:29`). | `/bookings/trip` and `/booking/trip` use `referrer: "same-origin"` exactly like `app/auth/confirm/page.tsx:12-18`. Prove a real POST from the real page, not only the harness. |
| F-03 | **There is no `scheduled` handler and no cron anywhere.** `worker/almar-ops.mjs:44-50` and `worker/almar.mjs:24-27` export only `fetch`. Five existing tests pin what the cron change must edit: `tests/ops-runtime.test.mjs:236-250` (the entry imports exactly five modules), `:411-416` (the `wrangler.ops.toml` tables are exactly `[assets] [ai] [[r2_buckets]] [[routes]]`), `tests/secrets.test.mjs:17-21` (the service-role key name appears only in `lib/supabase/clients.ts` and `scripts/import-catalog.mjs`), `tests/worker-size.test.mjs` (2,560 KiB gzip cap), and `tests/ops-runtime.test.mjs` "public Worker files bind only ASSETS and FORM_LIMITER". | Put the cron on **`almar-ops`** (it holds `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` as secrets, `03.2-OPS-DEPLOY.md:107-115`); never on `wrangler.toml` / `wrangler.preview.toml`. Update the two pinned lists in the same commit. The scheduled body must get its admin client from `createSupabaseAdmin()` (the only allowed place) through `lib/booking/lapse.ts` deps, not name the key. Measure CPU on preview (Free plan 10 ms; owner rule). |
| F-04 | **A static page only ships if it is in `PUBLIC_PAGES`.** `scripts/assemble-cloudflare.mjs:68` drops every `.html` whose path fails `matchPublicPage`. `/booking/trip` and `/bookings/trip` therefore need `lib/locale-path.ts` `PUBLIC_PAGES` entries, which `tests/locale-path.test.mjs:116-126` pins with `deepEqual`, and which feed `scripts/media-lib.mjs publicDocuments()` (`tests/media-guard.test.mjs:217-220`, `tests/media-manifest.test.mjs:342-368`) and hreflang (`localeAlternates`). | Treat `lib/locale-path.ts` as a granted shared file; update the three pinned tests; the two pages are `noindex`, so decide (and test) that they carry no hreflang/sitemap entry. |
| F-05 | **`record_payment` re-claims nights on an expired booking; B-34 forbids it.** `supabase/migrations/20261005110000_bookings_and_ops.sql:1657-1672` sets `deposit_paid/paid_in_full` for `expired` and calls `place_hold(..., null)`. | `ops_record_payment` is **not a copy**: for `expired` and `cancelled` it records the money, keeps the status, sets `needs_attention` with reason `paid_after_expiry` / `paid_after_cancel`, and never calls `place_hold`. Delete the `nights_lost` branch for those two statuses. |
| F-06 | **`public_booked_nights()` would bake web requests into the static site.** `:1907-1919` lists `expires_at is null or (b.status = 'awaiting_payment' and n.expires_at > now())`. Today only hand-made bookings are `awaiting_payment`; after Request every web request is too, for hours or days. The comment at `:1903-1906` says short web holds are deliberately not baked. | In the new migration `create or replace` it with `... and b.source = 'ops'` on the second branch (same signature, same grants `:1922`). Web requests stay visible only through the live quote (`sold_out`). pgTAP: a web request is not listed, a hand-made hold still is. |
| F-07 | **Check constraints that the new rows hit.** `booking_payments.amount_fils >= 200` (`:149`), `status in ('open','succeeded','expired','failed')` (`:150`), `kind in ('deposit','full','balance')` (`:147`), `booking_events.action in (...)` (`:193`). | Migration: `alter table ... drop constraint ... , add constraint ...` for status (+`voided`) and event actions (+`request_sent`, `payment_recorded`, `payment_voided`, `note_added`, any lapse-email marker). Decide and test the 2.00 AED floor for a recorded transfer (drop it for `method = 'bank_transfer'` or refuse below it with an `almar:` code). `card_*`, `checkout_session_id`, `payment_intent_id` stay null on bank rows. A bank row is written `succeeded` straight away, so `booking_payments_one_open` (`:229`) is not hit. |
| F-08 | **`mapDbError` does not know the new refusals.** `lib/ops/route-core.ts:142-157` maps only `not_found`, `published`, `amenities_mismatch`, `parent_unpublished`, `has_published_stays`, `invalid`; any other `almar:<code>` becomes 503 `unavailable`. | Either the handler catches `error.message === "almar:changed"` etc. and returns its own `OpsResult` (what old 05-01 did: `{ status: 409, body: errorBody("changed") }`), or add cases to `mapDbError` (shared file, additive). Recommended: handler-side, so `lib/ops/route-core.ts` stays untouched. |
| F-09 | **Any file under `app/`, `components/`, `lib/` containing the text `re_` fails `tests/phase-02-gates.test.mjs:7`** (secret needle for Resend keys). `failure_`, `where_`, `more_`, `before_`, `store_`, `secure_`, `closure_` all contain it. (04-02 already had to rename `ops_expire_lapsed`.) SQL under `supabase/` is not scanned, but TS that mirrors SQL keys is. | Name JSON keys and TS identifiers without `re_`: `failed_reason` is fine, `failure_reason` is not. Check every snake_case key of the new RPC payloads. |
| F-10 | **Owner-API route rules** (`tests/ops-route.test.mjs:506-535`): every file under `app/api/ops` is a `route.ts` with `export const dynamic = "force-dynamic"`, exports only `GET/POST/PUT` built with `opsGet/opsPost/opsPut`, imports **only** `lib/ops/*`, mentions no `process.env`, no `createClient`, no `[id]` segment. `tests/phase-03-dashboard-lists.test.mjs:45` forbids `app/dashboard/(ops)/bookings/[id]`. | Detail is `GET /api/ops/booking?ref=ALMAR-XXXXXX` and page `/bookings/detail?ref=...`. All logic in `lib/ops/*.ts` (the route files only bind). Writes are RPCs only (`tests/ops-route.test.mjs:551-556` forbids `.insert/.update/.delete` in `catalog-handlers.ts`; apply the same rule to the new handlers). |
| F-11 | **`lib/booking/server.ts` must stay database- and env-agnostic** (`tests/booking-api.test.mjs:983-986`: no `process.env`, no `next`, no `@supabase`, no `SERVICE_ROLE`). `liveGate` (`:451-454`) reads a Stripe key; the rebuilt gate must be a pure function whose inputs the **route** reads. | New pure `requestGate({ host, termsArePlaceholder, linkConfigured, windowSet })` (inputs read in the route); `isTest` from a pure `isTestHost(host, nodeEnv)` in `lib/booking/origin.ts` next to `HOST_ORIGIN` (`:14-18`). The `liveGate` tests (`booking-api.test.mjs:916-922`) are replaced, not kept. |
| F-12 | **`ReasonCode` is a signed list** (`lib/booking/types.ts:21-42`, comment "so this list stays the signed one"). A "requests closed until the owner sets the window" refusal needs a code (for example `requests_closed`) and a hold-time check. | 04-08 adds the code(s) to `types.ts` and states it in the SUMMARY; 04-03's `booking-reasons.tsx` and the three copy languages must cover it. |
| F-13 | **Picture/test conventions differ from the old plans.** There is no `tests/ops/` folder: ops specs are flat (`tests/ops-stays.spec.ts`, `tests/ops-settings.spec.ts`, `tests/ops-calendar.spec.ts`). `ALMAR_PICTURES` appears nowhere; pictures are a `test.describe("pictures")` block gated by a per-spec env var (`OPS_STAYS_PICTURES=1` or an absolute folder) writing to `.planning/phases/<phase>/pictures/<plan>/<state>-<width>-<locale>.png` (`tests/ops-stays.spec.ts:157-209`; since 03.2-15 its `openScene` also calls `routeStayTabs` at :27, 03.2-15's own route mock, which new specs leave out). Scenes are discovered from `tests/journey/scenes/<name>.tsx` by `sceneStates()` (`tests/journey/matrix.ts:32-41`, top-level keys at two-space indent). | Use `tests/ops-bookings.spec.ts`, `tests/ops-booking-detail.spec.ts`, `tests/ops-money-settings.spec.ts`, `tests/booking-trip.spec.ts`, helpers in `tests/helpers/ops-bookings-api.ts`. Env var names: `OPS_BOOKINGS_PICTURES`, `BOOKING_TRIP_PICTURES`, etc. Pictures are shot from real components through `/__harness` (memory `picture-mock-text-gate`); write outside `tests/` (memory `snapshot-writes-outside-tests`). |
| F-14 | **The `/api/booking/*` routes are not on the ops Worker, and `almar-preview` has no secrets on purpose.** `lib/server-routes.ts` + `worker/almar.mjs:14-19` forbid `/api/ops/*` on `almar`; `tests/ops-runtime.test.mjs:66,202,561` keep `/api/booking/*` off `almar-ops`. The new `request` route sends two emails, so `almar` (and `almar-preview` for UAT) need `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BOOKING_LINK_SECRET`; today only `almar-ops` holds Resend (`03.2-OPS-DEPLOY.md:115`). | Owner steps (not code): list in 04-08's SUMMARY. The route must answer 503 `unavailable` when any is missing (copy `app/api/booking/hold/route.ts:32-33`). |
| F-15 | **Migration numbering and the "never append" rule.** `20261005110000` says "Nothing is appended to this file later" (`:26`); `20261005120000_ops.sql` (old 05-01) was never written. | One new file, number reserved by the controller. If 04-09 needs SQL after 04-08 lands, that is a second file and a second number. Regenerate `lib/supabase/database.types.ts` with `node tests/helpers/local-supabase.mjs types` if the repo keeps it current. |

---

## 1. File Classification

Match quality: **exact** (same role and flow), **role** (same role, different flow), **partial** (pattern borrowed from two files), **none** (section 6).

### Plan 04-08: database and server (no UI)

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `supabase/migrations/<n>_booking_requests.sql` (header, constraint changes, `method`/`bank_reference`/`received_on`/`recorded_by`/`void_*` columns, `request_id`) | migration | CRUD / state machine | `supabase/migrations/20261005110000_bookings_and_ops.sql` (tables `:144-197`, RLS `:244-268`); header style `20261019130000_ops_save_publish_rules.sql:1-11` | exact |
| same file: request function `request_booking(...)` | SQL function | request-response, state change | `ops_create_booking` `:1248-1327` + `create_web_booking` `:1192-1240` | exact |
| same file: `ops_record_payment` | SQL function | CRUD / state machine | `record_payment` `:1616-1710` (with F-05 deviations) + `ops_create_booking` idempotency `:1270-1303` | exact |
| same file: `ops_void_payment` | SQL function | state machine | `ops_set_booking_status` `:1335-1384` + `record_payment` recompute `:1651-1677` | role |
| same file: `booking_bank_details` table + `ops_get_money_settings` / `ops_save_money_settings` | table + functions | CRUD (singleton) | `site_settings` singleton `20260925120000_platform_spine.sql:128-145` + `save_site_settings` `20261013120000_site_settings_brand.sql:75-135` | role |
| same file: `booking_notes` table + add/list | table + functions | CRUD (append-only) | `booking_events` `:188-197` + `log_booking_event` `:1884-1897` | role |
| same file: `ops_list_bookings`, `ops_get_booking` | SQL function | request-response (paged read) | `ops_list_media` `20261012120000_ops_list_media.sql:30-91` (cursor, fold search); `ops_get` `20261005100000_catalog_and_team.sql:1867` | role |
| same file: lapse claim (`ops_lapse_holds_notify` or similar) | SQL function | batch / event-driven | `ops_lapse_holds` `:1392-1422` + `claim_stripe_event` `:1830-1852` | partial |
| same file: `public_booked_nights` replace (F-06) | SQL function | read | itself `:1907-1922` | exact |
| same file: guest reads `booking_view`, `guest_bookings` (for 04-05/04-06) | SQL function | request-response | `booking_by_ref` `:670-683` + `booking_context` `:513-660` | role |
| `supabase/tests/booking-requests.test.sql` | test (pgTAP) | n/a | `supabase/tests/bookings-and-ops.test.sql` (helpers `:7-70`, anon checks `:139-153`), `supabase/tests/site_settings_access.test.sql` | exact |
| `lib/booking/server.ts` (modify: `requestBooking`, `requestGate`, drop `liveGate`) | service | request-response | itself: `createWebHold` `:360-435`, `releaseWebHold` `:466-482`, `liveGate` `:451-454` | exact |
| `lib/booking/terms.ts` (modify) | config | n/a | itself `:6-7` | exact |
| `lib/booking/origin.ts` (modify: `isTestHost`) | utility | pure | itself `:14-51` | exact |
| `lib/booking/types.ts` (modify: reason codes, request types) | types | n/a | itself `:21-42`, `:121-147` | exact |
| `lib/booking/validate.ts` (modify: `parseRequestRequest`) | utility | validation | `parseReleaseRequest` `:264-273` | exact |
| `app/api/booking/request/route.ts` (new) | route | request-response (write) | `app/api/booking/release/route.ts` (link-gated) + `hold/route.ts` (gate, email) | exact |
| `app/api/booking/hold/route.ts` (modify gate) | route | request-response | itself `:28-40` | exact |
| `lib/booking/lapse.ts` (new, deps injected) | service | batch / event-driven | `lib/auth/send-link.ts` `SendLinkDeps` `:6-35` (deps injection); `ops_lapse_holds` for the SQL it calls | partial |
| `worker/almar-ops.mjs` (add `scheduled`) | Worker entry | event-driven | itself `:44-50` (`export default { fetch }`) | none for `scheduled` (section 6) |
| `wrangler.ops.toml` (add `[triggers] crons`) | config | n/a | itself; table list pinned `tests/ops-runtime.test.mjs:416` | none for crons |
| `lib/ops/bank.ts` (new, pure IBAN / BIC / text caps) | utility | validation | `lib/settings/validate.ts` `parsePercent` `:24-28`; `lib/ops/validate.ts` `text/requiredText/onlyKeys` `:41,138-152` | partial |
| `lib/ops/money-settings.ts` (new: parse + handlers) | handler | request-response | `lib/settings/handlers.ts` (`readRow`, rpc save `:49-53,136-154`) + `lib/settings/validate.ts:30-62` | exact |
| `app/api/ops/money/route.ts` (new) | route | request-response | `app/api/ops/settings/route.ts` (`:4-8`) | exact |
| `app/api/ops/booking/payment/route.ts`, `app/api/ops/booking/void/route.ts` (new; may be 04-09) | route | request-response (write) | `app/api/ops/stays/route.ts` | exact |
| `tests/booking-request.test.mjs` | test | n/a | `tests/booking-api.test.mjs` (fake `rpc`, route source rules `:988-1000`) | exact |
| `tests/booking-lapse.test.mjs` | test | n/a | `tests/ops-runtime.test.mjs` `opsWorker()` scratch Worker `:252-280` + fake deps | partial |
| `tests/booking-request.db.test.mjs` | test (real stack) | n/a | `tests/booking-hold.db.test.mjs:1-75`, `tests/booking-routes.db.test.mjs:1-60` | exact |
| existing tests to edit (section 5) | test | n/a | n/a | n/a |

### Plan 04-03: guest `/booking/trip` (Request step instead of Pay)

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `components/journey/travellers-step.tsx` (new) | component | form | `components/journey/guest-panel.tsx` (counts) + `components/ui/field.tsx` + `components/ui/checkbox.tsx` | partial |
| `components/journey/request-step.tsx` (new; was `pay-step.tsx`) | component | form | `components/ui/toggle-card.tsx:21-31` (deposit/full cards) + `components/journey/journey-cart.tsx` | partial |
| `components/journey/hold-timer.tsx` (new) | component | event-driven (tick) | none (section 6); time text helpers `components/ops/site-status-time.ts` | none |
| `components/journey/booking-reasons.tsx` (new) | component | display | `ErrorLine` `settings-screen.tsx:70-80` + reason union `lib/booking/types.ts:21-42` | partial |
| `components/journey/stay-summary-step.tsx` (new) | component | display | `CartStay` + `CartBody` in `components/journey/journey-cart.tsx:12-23` | role |
| `components/journey/journey-cart.tsx` (modify: due-now / balance rows, request note) | component | display | itself `:25-46`, scene `tests/journey/scenes/journey-cart.tsx` | exact |
| `components/pages/stay-detail/book-link.tsx` (new) | component | navigation | `StayRequestLink` `components/pages/stay-detail/booking.tsx:185-199` | exact |
| `components/pages/stay-detail/booking.tsx` (modify: mount `BookLink` in bar / sheet / dock) | component | navigation | itself `:212-271` | exact |
| `lib/booking/trip-link.ts`, `lib/booking/trip-state.ts` (new, pure) | utility | state / storage | `lib/journey-choice.ts:1-40` (key, shape, untrusted storage) + `components/pages/stay-detail/booking-value.ts` | exact |
| `lib/booking/client.ts` (new, fetch wrappers) | utility | request-response | `components/pages/contact/inquiry-form.tsx:171-200` (AbortController timeout, one status); envelope idea `components/ops/ops-client.ts:76-110` | partial |
| `lib/copy/journey.ts` (modify: `steps.pay` -> Request, `cart.note`, `pay.*`) | copy | n/a | itself `:98-104,148-156` (+ AR `:274-280`, ES `:441-447`) | exact |
| `lib/copy/booking-trip.ts` (new, optional) | copy | n/a | `lib/copy/ops-settings.ts:1-60` (self-contained, typed record) | role |
| `lib/locale-path.ts` (modify `PUBLIC_PAGES`) | config | n/a | itself `:99-109` (F-04) | exact |
| `app/booking/trip/page.tsx` (modify: drop `notFound()`), `trip-screen.tsx` (rewrite) | page + client screen | request-response | `app/booking/trip/*` as they are (`page.tsx:11-20`, `trip-screen.tsx:58-118`); `app/bookings/bookings-screen.tsx` for `initialLocale` | exact |
| `app/ar/booking/trip/page.tsx`, `app/es/booking/trip/page.tsx` (new) | page | static | `app/ar/contact/page.tsx` (force-static + locale prop) | exact |
| `tests/journey/scenes/booking-trip.tsx` (new) | harness scene | n/a | `tests/journey/scenes/journey-cart.tsx`, `tests/journey/scenes/ops-site-status.tsx` | exact |
| `tests/booking-trip-pictures` -> inside `tests/booking-trip.spec.ts` | test (Playwright) | n/a | `tests/ops-stays.spec.ts:157-209` | exact |
| `tests/booking-trip-state.test.mjs` | test | n/a | `tests/journey-choice.test.mjs` (pure module test) | exact |
| `tests/build/server-runtime.spec.ts`, `tests/screens-before-after.spec.ts` rows | test | n/a | itself | exact |

### Plan 04-09: dashboard Bookings and money Settings

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `app/dashboard/(ops)/bookings/page.tsx` (keep), `bookings-screen.tsx` (rewrite: container) | page + client container | CRUD list | `app/dashboard/(ops)/calendar/calendar-screen.tsx:46-198` (container: fetch, errors, reload) | exact |
| `app/dashboard/(ops)/bookings/bookings-list.tsx` (new, presentational) | component | display | `components/ops/list-table.tsx:1-40` (`Column<T>`) + `app/dashboard/(ops)/calendar/calendar-view.tsx` | role |
| `app/dashboard/(ops)/bookings/detail/page.tsx`, `booking-detail-screen.tsx`, `booking-detail.tsx` (new) | page + container + view | CRUD detail | calendar container/view split; `components/ops/edit-page.tsx` for sections | role |
| Record payment / Void / Cancel dialogs (inside `booking-detail.tsx`) | component | form + confirm | `components/ui/confirm-dialog.tsx:1-69` (single-confirm) and `components/ui/sidebar.tsx:1-41` (form dock); form model `app/dashboard/(ops)/calendar/block-form.ts` | partial |
| Notes (add / list) | component | CRUD | `components/ops/` kit + `booking_events` read shape | partial |
| `app/dashboard/(ops)/settings/settings-screen.tsx` (modify: one new section) | client screen | CRUD | itself `:279-317`, `:405-419`, leave-guard `:132-155,421-433` | exact |
| `lib/settings/form.ts` / new `lib/ops/money-form.ts` (pure form model) | utility | validation | `lib/settings/form.ts:41-90` (`isDirty`, `canSave`, `saveBody`) | exact |
| `app/api/ops/bookings/route.ts` (GET list) | route | request-response | `app/api/ops/media/route.ts:11-17` (paged GET) | exact |
| `app/api/ops/booking/route.ts` (GET detail), `.../status/route.ts`, `.../note/route.ts`, `.../payment/route.ts`, `.../void/route.ts` | route | request-response | `app/api/ops/stays/route.ts` | exact |
| `lib/ops/booking-rules.ts` (pure: owner actions per status, list query parse) | utility | validation | `lib/ops/validate-media.ts:128-146` `parseMediaQuery`; `lib/ops/validate.ts` | exact |
| `lib/ops/bookings-api.ts` (handlers, deps injected) | handler | request-response | `lib/ops/catalog-handlers.ts:29-97` (`ok`, `notFound`, `listOrDetail`, `save`) | exact |
| `lib/ops/bank.ts`, `lib/ops/money-settings.ts` | (as 04-08 table) | | | |
| `lib/copy/ops-bookings.ts` (new) | copy | n/a | `lib/copy/ops-settings.ts` (type + `Record<'en'|'ar'|'es'>`) | exact |
| `lib/ops-routes.ts` (modify `OPS_LIVE_SECTIONS` += `/bookings`) | config | n/a | itself `:35-53` | exact |
| `tests/journey/scenes/ops-bookings.tsx`, `ops-booking-detail.tsx`, `ops-money-settings.tsx` (new) | harness scene | n/a | `tests/journey/scenes/ops-stays.tsx`, `ops-calendar.tsx` | exact |
| `tests/ops-bookings.spec.ts`, `ops-booking-detail.spec.ts`, `ops-money-settings.spec.ts` (+ pictures blocks) | test (Playwright) | n/a | `tests/ops-stays.spec.ts` (+ `tests/helpers/ops-stays-api.ts`) | exact |
| `tests/helpers/ops-bookings-api.ts` (new) | test helper | n/a | `tests/helpers/ops-stays-api.ts:1-60` | exact |
| `tests/ops-booking-rules.test.mjs`, `tests/ops-bookings-api.test.mjs`, `tests/ops-bank.test.mjs` | test | n/a | `tests/ops-route.test.mjs`, `tests/ops-validate.test.mjs`, `tests/ops-api-local.test.mjs:1-50` | exact |
| `tests/phase-03-dashboard-lists.test.mjs`, `tests/phase-03-settings.test.mjs`, `tests/ops-settings.spec.ts` (re-scope) | test | n/a | itself | exact |

### Plan 04-05: emails and guest booking page

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `lib/email/shell.ts` (new: brand check, escape, table shell, square teal button, RTL) | utility | transform | `lib/email/magic-link.ts:21-100` (extract, keep magic-link output byte-identical) | exact |
| `lib/email/request-received.ts`, `payment-received.ts`, `request-lapsed.ts`, `owner-notice.ts` (new) | utility | transform | `renderMagicLinkEmail` `lib/email/magic-link.ts:52-100`; owner notice: `composeInquiryEmail` `lib/contact-inquiry.ts:169-184` | exact / role |
| `lib/email/send.ts` (new: Resend sender, idempotency key, `FROM`) | service | request-response | `lib/auth/magic-link-server.ts:24,73-80,122-139`; `app/api/contact/route.ts:98-110` | exact |
| `lib/booking/emails.ts` (new: send per event, writes `email_sent` / `email_failed`) | service | event-driven | `lib/auth/magic-link-server.ts` (deps wiring) + `log_booking_event` | partial |
| `lib/booking/view.ts`, `app/api/booking/view/route.ts` (new) | service + route | request-response (read) | `releaseWebHold` access check `lib/booking/server.ts:466-482` + `app/api/booking/release/route.ts` | exact |
| `app/bookings/trip/page.tsx`, `booking-screen.tsx`; `app/{ar,es}/bookings/trip/page.tsx` (new) | page + client | request-response | `app/auth/confirm/page.tsx:12-18` (referrer), `app/ar/contact/page.tsx` (static locale page) | exact |
| `lib/copy/booking-email.ts`, `lib/copy/booking-page.ts` (new) | copy | n/a | `lib/copy/ops-settings.ts` / `lib/copy/guest.ts` | exact |
| `tests/booking-email.test.mjs`, `tests/booking-view.test.mjs` | test | n/a | `tests/auth-magic-link.test.mjs`, `tests/settings-brand.test.mjs` (email render), `tests/booking-api.test.mjs` | exact |
| `tests/booking-page.spec.ts`, `tests/build/booking-pages.spec.ts` | test | n/a | `tests/ops-settings.spec.ts:20-45` (`page.route`), `tests/build/server-runtime.spec.ts` | exact |

### Plan 04-06: submit request, resume, guest `/bookings` list

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `app/booking/trip/trip-screen.tsx` (submit + resume), `lib/booking/trip-state.ts` | client screen + utility | request-response | 04-03's own files; `lib/journey-choice.ts` for stored-state rules | exact |
| `lib/booking/guest-list.ts` (new) | service | read | `lib/account-preferences.ts` read shape + `booking_by_ref` style RPC | partial |
| `app/bookings/page.tsx`, `app/bookings/bookings-screen.tsx` (rewrite) | page + client | request-response | themselves (`page.tsx:11-19`, `bookings-screen.tsx:14-48`) | exact |
| `lib/copy/guest-bookings.ts` (new) | copy | n/a | `lib/copy/guest.ts` | exact |
| `tests/guest-bookings.test.mjs`, `tests/guest-bookings.spec.ts`, scenes `guest-bookings.tsx` | test | n/a | `tests/phase-03-guest.test.mjs:70-90` (to re-scope), `tests/phase-02-guest-nav.spec.ts` | exact |

---

## 2. Pattern Assignments

### 2.1 `supabase/migrations/<n>_booking_requests.sql` (04-08)

**Analog:** `supabase/migrations/20261005110000_bookings_and_ops.sql` (read it top to bottom once; every convention below is from it).

**File header** (copy the voice of `:1-26` and `20261019130000_ops_save_publish_rules.sql:1-11`): what it adds, "safe on live data" paragraph, "a work session never applies this file; only the controller", local apply = `node tests/helpers/local-supabase.mjs reset`.

**Function skeleton, one grant per function** (`:359-380`, `:1884-1897`):
```sql
create or replace function public.booking_lock(p_booking uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
...
$$;

revoke execute on function public.booking_lock(uuid) from public, anon, authenticated;
grant execute on function public.booking_lock(uuid) to service_role;
```
Every new function: `security definer`, `set search_path = ''`, every name schema-qualified (`public.`, `extensions.` for `gen_random_bytes`), the exact signature in the `revoke`/`grant`. Do **not** copy `ops_list_media`'s missing `security definer` (`20261012120000:30-91`).

**Refusal convention** (`:295-310`): `perform public.booking_fail('<code>', '<field>', jsonb)` raises SQLSTATE `P0001`, message `almar:<code>`, detail JSON with `field`. Owner-side functions raise; guest-side functions (request) return `{ ok: false, reason }` like `create_web_booking` (`:1205-1224`).

**Lock order** (`:23-25`, `:359-377`): per-stay advisory lock, then the booking row (`public.booking_lock(id)`), then nights and payments. Every new function that changes a booking starts with `v_b := public.booking_lock(p_booking); if v_b.id is null then perform public.booking_fail('not_found'); end if;` (`:1348-1351`).

**Request function (guest, link-gated in the route).** Copy the structure of `ops_create_booking`'s hold part:
```sql
-- :1288-1290  the 35-minute floor (B-27 floor 35)
if v_hold_until <= now() + interval '35 minutes' then perform public.booking_fail('hold_too_soon'); end if;
-- :1308-1311  nights re-held to the deadline
v_hold := public.place_hold(v_b.id, v_b.stay_id, v_b.arrive, v_b.leave, v_hold_until);
if v_hold <> 'ok' then perform public.booking_fail(v_hold); end if;
-- :1313-1316  the event
insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
values (v_b.id, 'guest', 'request_sent', 'held', 'awaiting_payment', jsonb_build_object('deadline', ...));
```
Differences: deadline = `now() + (window from the owner-only table)`; a null window returns `{ ok:false, reason:'requests_closed' }` (B-27); the 30-minute hold must still be running (`v_b.hold_expires_at > now()`), else `{ ok:false, reason:'hold_ended' }` (existing reason code); a booking already `awaiting_payment` returns the **same** deadline and no second event (idempotent, so a double click or refresh sends one email, not two). Set `hold_expires_at = deadline` and `status = 'awaiting_payment'` in one update; `place_hold` is called with the stay lock already held (it re-takes it; advisory xact locks are re-entrant). `create_web_booking` stamps its nights `+1 minute` (`:1211-1212`, Stripe margin); the request does not need that margin.

**`ops_record_payment`.** Skeleton: copy `record_payment` `:1616-1710`, with these edits:
- Signature `(p_booking uuid, p_amount_fils bigint, p_received_on date, p_bank_reference text, p_accept_short boolean, p_short_reason text, p_request_id uuid, p_actor uuid)`; actor string `'owner:' || p_actor::text` (`:1376`).
- Idempotency: a client-made `p_request_id` stored in a new `booking_payments.request_id uuid unique`; catch `unique_violation` on that constraint and return the existing row, exactly the `ops_create_booking` pattern (`:1270-1277`, `:1294-1303`).
- Status by recorded total (`paid_fils + amount`): `>= grand` -> `paid_in_full`; `>= deposit_fils` (plan deposit) -> `deposit_paid`; below -> stays `awaiting_payment` (B-32, "part received" is derived: `status='awaiting_payment' and paid_fils > 0`, no column needed). "Accept as paid" (B-33) with a non-empty reason moves the status on and writes the gap into the event detail (`write_off_fils`).
- `expired` / `cancelled`: money recorded, status unchanged, `needs_attention = true`, reason `paid_after_expiry` / `paid_after_cancel`, **no `place_hold`** (F-05, B-34). Compare `:1653-1672`.
- `paid_fils > grand_fils` sets `overpaid` and keeps the money (`:1679-1682`).
- Nights become permanent only when the new status is `deposit_paid` / `paid_in_full`: `update public.booking_nights set expires_at = null where booking_id = v_b.id` (`:1671`).
- Events: `payment_recorded` (new action) with `payment_id`, amount, paid_fils, method; `needs_attention` row when flagged (`:1696-1702`).

**`ops_void_payment`.** Skeleton: `ops_set_booking_status` `:1335-1384` (lock, `p_expected_from`, allowed-matrix check raising `almar:changed` / `almar:not_allowed`, one event). Edits: set the payment row `status='voided'`, `void_reason`, `voided_at`, `voided_by`; `paid_fils` down by the row's amount; recompute status with the same total rules; `confirmed` cannot go below the deposit (`almar:not_allowed`, "Cancel first"); when nothing paid remains on a non-expired booking, back to `awaiting_payment` with a **fresh deadline** by re-running the request logic (`place_hold` with `now() + window`; a `sold_out` here is `almar:sold_out`). A row can be voided once (`almar:changed`). Never `delete`.

**Owner-only bank details and window.** Singleton + RLS + no policy, the way the booking tables do it:
```sql
-- site_settings pattern, spine :128-145
id int primary key default 1 check (id = 1),
-- booking tables pattern, :244-268
alter table public.booking_bank_details enable row level security;
revoke all on public.booking_bank_details from public, anon, authenticated;
```
Outside `site_settings` on purpose (`site_settings` has an anon select policy and column grants, `20261013120000:41-48`; `api_site_settings` is public). Columns: `account_name, bank, iban, swift, bank_address, note_en, note_ar, note_es, transfer_window_minutes` with caps and `check (transfer_window_minutes >= 35)`. Currency is not a column (fixed AED, B-30). `ops_save_money_settings(p, p_actor)` writes this row **and** `site_settings.balance_due_days` in one transaction (the "one Save is one transaction" rule from `20261013120000:75-79`); it validates again in SQL what `lib/ops/bank.ts` validates. The note's AR/ES go in as separate keys; follow memory `translations-omit-key-not-record`: a missing key keeps the stored value, an empty required one on a new row is refused.

**Notes.** `booking_notes (id bigint identity, booking_id, at, actor text, body text check (char_length between 1 and 2000))`, append-only, same RLS/revoke block, `booking_notes_booking_idx`. Add via one function that also writes a `note_added` event; list is part of `ops_get_booking`.

**List and detail.** `ops_list_bookings(p_q text, p_status text, p_after text, p_limit int)` copies the shape of `ops_list_media` (`20261012120000:30-91`): validate the arguments with `booking_fail('invalid','limit')`, case/accent fold the search with the existing `public.media_fold` (`:12-23`), cursor `after`, `limit` 1..60, return `{ items, next }`. Search by ref (`ALMAR-` prefix, any case), guest name, email. Upcoming arrivals first. `needs_attention`, `part_received` and `balance_overdue` (Dubai date: `(now() at time zone 'Asia/Dubai')::date > balance_due_date and paid_fils < grand_fils`) are computed columns in the item. `ops_get_booking(p_ref)` returns the booking, travellers, lines, payments (incl. voided), refunds, disputes (empty), notes, events, in one jsonb. It runs `ops_lapse_holds()` first only if the handler calls it (old 05-01 did, `handleList/handleDetail`); keep that in the handler, not in the read function.

**Lapse with email.** `ops_lapse_holds()` returns `int` and cannot change type (`create or replace`): leave it, add a new function. Copy its loop (`:1403-1416`: `for ... order by b.stay_id, b.id`, `booking_lock`, re-check status inside the lock) and the claim idea of `claim_stripe_event` (`:1842-1846`, a claim that a crashed worker's retry can take over after N minutes). Design: the function lapses due bookings (as `ops_lapse_holds` does) **and** returns, as jsonb rows, every `expired` booking that has a `request_sent` event and no `email_sent` event of kind `lapsed`, claimed with an event row so two overlapping cron runs send one email. `place_hold`'s sweep (`:763-781`) also expires bookings silently, so the email list must come from events, not from the count of rows this run lapsed. The Worker sends, then writes `email_sent` (`detail.kind='lapsed'`) or `email_failed`; Resend's idempotency key `lapsed/<booking_id>` is the second layer.

**`public_booked_nights`** (F-06): `create or replace` with the same signature `returns table (stay_id uuid, day date)`, `stable`, definer, and the grant line `grant execute ... to anon, authenticated, service_role` (`:1922`). pgTAP already asserts that of the 31 functions only this one is anon-executable (`bookings-and-ops.test.sql:162-166`): keep that true and extend the list.

**Checks to replace** (F-07): `alter table public.booking_payments drop constraint booking_payments_status_check, add constraint booking_payments_status_check check (status in ('open','succeeded','expired','failed','voided'));` and the same for `booking_events_action_check`. Verify the generated names on the local stack before writing them.

### 2.2 `supabase/tests/booking-requests.test.sql` (04-08)

**Analog:** `supabase/tests/bookings-and-ops.test.sql`.

Reuse the header and helpers (`:1-70`: `begin; create extension if not exists pgtap with schema extensions; select plan(N);` then `pg_temp` helper functions `d()`, `line()`, `pl()`, `web()`, `ops()`, and the `t_res` result table). Copy the seed block (`:72-100`) or move shared seeds so the two files do not depend on each other.

Privilege checks (`:139-153`, and the table-privilege count `:131-137`):
```sql
set local role anon;
select throws_ok($$select * from public.booking_bank_details$$, '42501', null, 'anon cannot read the bank details');
select throws_ok($$select public.ops_record_payment(...)$$, '42501', null, 'anon cannot call ops_record_payment');
set local role authenticated;
```
Add: the same for `authenticated`; `api_site_settings` columns still exactly the nine (`site_settings_access.test.sql:15-17`) so the new data never leaks through the public view; of the functions of the old and new migration only `public_booked_nights` is executable by anon/authenticated (`:162-166`); every new function is `prosecdef` with `search_path=""` and `service_role` may execute (`:172-176`). Behaviour cases to cover (each one a `throws_ok` with `'P0001', 'almar:<code>'` or a `results_eq`): below deposit stays awaiting and flagged part-received; accept-short with reason moves on; empty reason refused; overpaid kept; expired and cancelled record money, flag, never re-claim (B-34); idempotent on `request_id` under two calls; void recomputes and returns to `awaiting_payment` with a new deadline; void below deposit on `confirmed` refused; request closes when the window is null; request below the 35-minute floor refused; a second request call returns the same deadline and writes one `request_sent`; lapse claim returns each expired request once; web request not in `public_booked_nights`.

Bite checks (10 per plan in 04-02 `## Bite checks`): break one rule, see red, restore by copy (memory `bite-check-revert`).

### 2.3 `lib/booking/server.ts`, `terms.ts`, `origin.ts`, `types.ts`, `validate.ts` (04-08)

**Analog:** the same files.

Gate: replace `liveGate` (`server.ts:447-454`). Keep the file env-free (F-11):
```ts
// new, pure; the route passes what it read
export function requestGate(input: { isTest: boolean; termsArePlaceholder: boolean; linkConfigured: boolean }): { open: boolean } {
  return { open: input.isTest || (!input.termsArePlaceholder && input.linkConfigured) };
}
```
`isTest` from the host (`origin.ts`, next to `HOST_ORIGIN` `:14-18`): test for `preview.almarprivatejourney.com` and the local hosts, real for `almarprivatejourney.com` and `www.`. The hold route today reads it as `const gate = liveGate(process.env.STRIPE_SECRET_KEY)` (`app/api/booking/hold/route.ts:28-30`) and passes `isTest: gate.isTest` (`:40`); change those two lines only.

New server function (same shape as `releaseWebHold` `:466-482`: access check, one `call(db, name, args)`, shape-check the jsonb, `throw new Error('rpc <name>: unreadable answer')`):
```ts
async function call(db: BookingDb, name: string, args: Record<string, unknown>): Promise<unknown> {   // :35-39
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`rpc ${name} failed`);       // the message names the function only, never an argument
  return data;
}
```
`requestBooking(db, input: { ref, t }, deps)` -> `authorizeBookingAccess` (`lib/booking/access.ts:21-42`, token only for the request route; `findByRef` via `bookingByRef` `:162-169`) -> `call(db, "request_booking", { p_booking })` -> `{ ok: true, deadline } | { ok: false, reason }`.

Parser: `parseRequestRequest` = `parseReleaseRequest` (`validate.ts:264-273`, same `{ ref, t }`, `HOLD_REF_KEYS` `:20`, `LINK_TOKEN` `:26`); the language of the email comes from the stored booking `locale`, never from the body.

Types: add the reason code(s) (F-12) and a `RequestResponse` next to `HoldResponse` (`types.ts:134-147`).

### 2.4 `app/api/booking/request/route.ts` (04-08)

**Analog:** `app/api/booking/release/route.ts` (link-only, no limiter) with the gate of `hold/route.ts`.

```ts
// release/route.ts:1-36 (shape), hold/route.ts:28-40 (gate + 503)
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_BODY_BYTES = 4 * 1024;
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedPostOrigin(request.headers.get("origin"), request.headers.get("host"), process.env.NODE_ENV)) {
    return reply({ ok: false, reasons: [{ code: "invalid", field: "origin" }] }, 403);
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return reply({ ok: false, reasons: [{ code: "invalid", field: "body" }] }, body.status);
  const parsed = parseRequestRequest(body.value);
  if (!parsed.ok) return reply({ ok: false, reasons: parsed.reasons }, 400);
  const admin = createSupabaseAdmin();
  if (!admin || !bookingLinkConfigured() || !gate.open) return reply(unavailable, 503);
  try { ... } catch { return reply(unavailable, 503); }
}
```
Rules the source test enforces (`tests/booking-api.test.mjs:988-1000`): POST only, `force-dynamic`, `isAllowedPostOrigin`, `no-store`, no `console.`, no `SUPABASE_SERVICE_ROLE_KEY`. Add `"request"` to that loop. After the RPC succeeds the route sends the two emails (guest request-received with the transfer instructions, owner notice) **after** the commit, and an email failure must not turn a made request into an error: log `email_failed` through `log_booking_event` and still answer 200 with `emailSent:false` (the guest's page shows the same instructions). The route imports the sender from `lib/booking/emails.ts` (04-05); until 04-05 lands it takes an injectable `notify` dep defaulting to a no-op, so 04-08 stays UI- and email-free.

### 2.5 `lib/booking/lapse.ts`, `worker/almar-ops.mjs`, `wrangler.ops.toml` (04-08)

**Analog (deps injection):** `lib/auth/send-link.ts:6-35` (`SendLinkDeps`; every outside call injected so node tests pass fakes) and `lib/ops/translate.ts` `translateHandler(getRun)`.
```ts
export type LapseDeps = {
  claim(): Promise<LapsedBooking[]>;                 // rpc: lapse + list the ones owed an email
  send(b: LapsedBooking): Promise<boolean>;          // Resend, idempotency key lapsed/<id>
  mark(b: LapsedBooking, ok: boolean): Promise<void>; // email_sent / email_failed event
};
export async function runLapse(deps: LapseDeps): Promise<{ lapsed: number; emailed: number; failed: number }> { ... }
```
Never log an address or a payload; log counts only (house rule from `app/api/contact/route.ts:100-110`).

**Worker entry** (current, `worker/almar-ops.mjs:44-50`):
```js
export default {
  fetch: (request, env, ctx) => { ... return handle(request, env, ctx, { serverPaths: OPS_PATHS, nextFetch }); },
};
```
Add a `scheduled(controller, env, ctx) { ctx.waitUntil(...) }` member. There is no in-repo analog (section 6). Constraints: keep the five-import test green or change it (`tests/ops-runtime.test.mjs:236-250`); `process.env` is populated in a scheduled run because `compatibility_date = "2026-09-23"` is past the `nodejs_compat_populate_process_env` default (verify on preview, not assumed); `NEXT_PUBLIC_*` names are Worker **secrets** on `almar-ops`, not inlined, so `createSupabaseAdmin()` (`lib/supabase/clients.ts:39-47`) works there; bundling `lib/supabase/clients.ts` into the entry pulls `next/headers`: measure with `scripts/worker-size.mjs`, or run the lapse through a route instead (a protected `/api/ops/` path is not possible without a session; the alternative is a shared-secret route under `lib/ops-routes.ts` rules, which is a bigger design call for the controller).

**Config:** `wrangler.ops.toml` gets `[triggers]\ncrons = ["*/5 * * * *"]` (cadence is the controller's call; cron triggers on the Free plan are limited per account: verify the count before the owner deploys). `tests/ops-runtime.test.mjs:416` `tables` list and `tests/build/make-ops-test-config.mjs:27` (`DROPPED_BLOCKS`) must learn about `[triggers]`. Deploying is the controller's step on the owner's word, never the work session's (`wrangler.ops.toml:1-7`).

### 2.6 `lib/ops/bank.ts`, `lib/ops/money-settings.ts`, `app/api/ops/money/route.ts` (04-08 / 04-09)

**Route file** (copy `app/api/ops/settings/route.ts`, all 8 lines):
```ts
import { opsGet, opsPost } from "../../../../lib/ops/route";
import { getMoneyRoute, parseMoneySave, postMoneyRoute } from "../../../../lib/ops/money-settings";

export const dynamic = "force-dynamic";
export const GET = opsGet(getMoneyRoute);
export const POST = opsPost(parseMoneySave, postMoneyRoute);
```
(imports only `lib/ops/*`, F-10.)

**Parse** (house style of `lib/settings/validate.ts:30-62` and `lib/ops/validate.ts`): `record(body, "body")`, `onlyKeys(b, [...])` (`validate.ts:41-45`), then one validator per key throwing `OpsInvalid(field)`. Integer days: `int(value, "balance_due_days", { min: 0, max: 365 })` (`:117-120`, matching the column check `:33`). Transfer window: `int(..., { min: 35, max: <owner cap> })`, nullable (empty keeps requests closed, B-27). Text fields: `requiredText(value, field, { max })` / `text(...)` (`:138-152`), counted in characters. The note is `note_en` only on the wire plus optional `note_ar` / `note_es` (auto-translate result or typed fix).

**Pure bank validation** (`lib/ops/bank.ts`, no analog for IBAN, section 6): leaf module, no imports beyond `OpsInvalid`; `normalizeIban` (strip spaces, upper-case), country length table (UAE = 23, `AE` + 2 check digits + 19 digits), mod-97 check; `swift`/BIC regex `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`; caps for name/bank/address. Unit test with symbolic public example IBANs only; never a real account number in a fixture or in chat (owner types values in the dashboard, B-30).

**Handler:** `lib/settings/handlers.ts` is the template: a `readRow(admin)` that returns `{ dbError }` on failure (`:49-53`), `getX({ owner })` returning `{ body: { ok: true, ... } }`, `postX` calling **one** RPC and returning `{ dbError: error }` on error (`:136-154`). Owner id goes in as `p_actor: owner.profile.id` (as `p_owner_id` at `:137`). The GET shape must not be cached and must never be reachable from the public Worker (the route file is under `app/api/ops/`, so `serverPathsFrom` skips it on `almar`, `lib/server-routes.ts:98`).

**Auto-translate on Save** (B-30): the note line is typed in English and AR/ES are filled by the translate route. The pure planner is `components/ops/auto-translate.ts` (`planTranslation`, `applyReplies`, `TRANSLATE_TIMEOUT_MS = 45_000`, `:14-120`); the route is `POST /api/ops/translate` (`lib/ops/translate.ts:49-87`, field names `^[a-z][a-z0-9_]{0,63}$`). The screen calls `planTranslation({ note: english }, { note: savedEnglish }, { ar, es }, touched)`, sends with `opsSend("/api/ops/translate", ..., { timeoutMs })`, then POSTs the money save with the three notes. If the AI fails, the stored AR/ES stays (omit the key, memory `translations-omit-key-not-record`) and the screen says why; Save of the other fields is not blocked by a failed translation of an optional note.

### 2.7 Owner endpoints for bookings (04-09)

**Analog:** `lib/ops/catalog-handlers.ts` and `lib/ops/route.ts`.

Imports and the owner type (`catalog-handlers.ts:10-32`):
```ts
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { errorBody, type OpsOutcome, type OpsResult } from "./route-core";
export type OpsOwner = { profile: { id: string }; admin: SupabaseClient };
function ok(body: Record<string, unknown>): OpsResult { return { body: { ok: true, ...body } }; }
function notFound(): OpsResult { return { status: 404, body: errorBody("not_found") }; }
```
List/detail/save helpers (`:54-78`): `rpc(...)` -> `if (error) return { dbError: error }` -> shape and `ok({ items })`. Writes are single RPCs only. Booking handlers add the F-08 catch before returning `dbError`:
```ts
if (error?.message === "almar:changed") return { status: 409, body: errorBody("changed") };
if (error?.message === "almar:not_allowed") return { status: 409, body: errorBody("not_allowed") };
```
Query parsing for GET: `parseMediaQuery` (`lib/ops/validate-media.ts:128-146`: trim `q`, cap length, digits-only `limit` in 1..N, `after` cursor shape) -> `parseListQuery`. ref: `REF_RE` from `lib/booking/ref.ts` (`isBookingRef`). Owner id for events: `p_actor: owner.profile.id`.

Existing status RPC to **call, not redefine**: `ops_set_booking_status(p_booking uuid, p_to text, p_expected_from text, p_actor uuid)` (`:1335`). Its Cancel branch closes open Stripe payments and returns `closed_sessions` (`:1363-1372`); Phase 4 has no Stripe, so the handler ignores that list and does **not** import any Stripe helper (old 05-01 `expireCheckoutSessions` is gone). A cancelled booking with recorded money keeps `paid_fils` and gets no automatic refund (O-01 / B-31).

### 2.8 Dashboard screens (04-09)

**Container + view split.** Analog: `calendar-screen.tsx` (container) + `calendar-view.tsx` (view). The container owns fetch, errors and the reload counter, and draws nothing:
```tsx
const reply = await opsFetch<BlocksView>("/api/ops/blocks", { ...monthWindow(...), ...filterQuery(filter) });   // :111
if (!reply.ok) { setBlocks([]); return setMonthError(errorText(kit, reply.error)); }                                // never stale data under a new filter
async function add(payload) {                                                                                      // :138-154
  setPanel((old) => (old ? { ...old, busy: true, error: null } : old));
  const reply = await opsSend<BlockAddResult>("/api/ops/blocks", { action: "add", block: payload });
  if (!reply.ok) { ...setPanel(... error: sentence); return false; }
  setPanel(null); setReload((n) => n + 1); return true;
}
```
Use a `latest` ticket ref (`calendar-screen.tsx:109-112`) so a slow list answer never overwrites a newer filter. Locale: `useDashboardLocale()` (`components/ops/use-dashboard-locale.ts`); error text: `errorText(kit, reply.error)` (`components/ops/error-text.ts`).

**List:** `components/ops/list-table.tsx` `Column<T>` (`:12`, each column has `phone: "title"|"meta"|"hidden"`), a status filter as a kit `Select` with a **non-empty sentinel** `"all"` (memory `select-empty-value`; assert the trigger text in the picture spec), statuses drawn with `components/ops/status-chip.tsx` style (static `Chip`, `interactive={false}`). `needs_attention`, "Part received", "Balance overdue" are text flags, never colour-only.

**Detail:** sections on the kit editor (`components/ops/edit-page.tsx`) or plain sections like `settings-screen.tsx:226-262`; tabs are not required. Path is `/bookings/detail?ref=`, read with `new URLSearchParams(window.location.search)` as `calendar-screen.tsx:66` does for its entry link; validate with `isBookingRef` before the first fetch.

**Record payment / Void dialogs.** There is no form-in-dialog component. Two real analogs:
- `components/ui/confirm-dialog.tsx:21-69`: one danger confirm, no outside-dismiss (`preventDismiss` `:11-13`), `Dialog.Title`, optional `description`. Use it for **Cancel booking**. For **Void** the `description` is a `ReactNode`, so a reason `Field` can sit inside it; the confirm button has no `disabled` prop (`:51-55`) and the dialog does not close itself (the parent owns `open`), so the parent's `onConfirm` refuses an empty reason, keeps the dialog open and shows the error line.
- `components/ui/sidebar.tsx:16-41`: a form dock for **Record payment** (amount, date received, bank reference, "Accept as paid" checkbox + reason, confirm). Field model: `block-form.ts` (`blockPayload(values)` returns `{ ok:true, payload } | { ok:false, field }`, `isIsoDay`, `dubaiDay(now)` at `:81-85`) -> `paymentPayload(values)`. "Confirm" is a second explicit step (summary line "Record AED X received on D") before the POST, and the POST carries a client-made `request_id` (idempotency, 2.1).
- Amount entry: text, `^\d{1,10}(\.\d{1,2})?$` like `money()` (`lib/ops/validate.ts:80-86`), converted to fils on the server; the screen never does float math (`lib/money/fils.ts`, `lib/money/format.ts:11-16` for display).

**Settings addition** (F-01): append one `<section>` after the Money group, same classes as `settings-screen.tsx:279-281`:
```tsx
<section className="flex flex-col gap-2 border-t border-line pt-4" aria-labelledby={`${uid}-bank`}>
  <GroupTitle id={`${uid}-bank`}>{copy.bank}</GroupTitle>
  ...Field per value, error={...}
</section>
```
Its own `useEffect` load (`:103-127`), its own dirty/canSave (a new `lib/ops/money-form.ts` modelled on `lib/settings/form.ts:41-90`), its own Save button and `role="status"` line (`:405-419`), and the same leave-guard (`:132-155,421-433`; do not duplicate listeners, extend `dirtyRef`). There is no password field on this screen, so the show/hide-eye rule does not apply; the values are owner-private: never put them in `console`, in a toast with text, or in a URL.

### 2.9 Guest trip page (04-03)

**Analog:** `app/booking/trip/{page,trip-screen}.tsx` (placeholder) for the shell; `components/pages/stay-detail/booking.tsx` for the Book link; `lib/journey-choice.ts` for stored state.

Shell kept from the placeholder (`trip-screen.tsx:1-12,58-85`): `"use client"`, `useSearchParams`, `SiteNav` with `labels={HOME_COPY[locale].nav}`, `setDocumentLocale`, `WhatsApp`. `page.tsx:11-20` loses the `if (process.env.NODE_ENV === "production") notFound();` and keeps the `Suspense` (required for `useSearchParams` in a static page) and `robots: { index:false, follow:false }`, and gains `referrer: "same-origin"` (F-02). Locale pages: `app/ar/booking/trip/page.tsx` = `export const dynamic = "force-static"; export default function Page() { return <TripPage initialLocale="ar" />; }` (shape of `app/ar/contact/page.tsx`); `app/bookings/page.tsx:11-19` shows how the English page passes `initialLocale`.

Book link (copy `booking.tsx:185-199`):
```tsx
export function StayRequestLink({ size }: { size: "bar" | "sheet" | "dock" }) {
  const s = useStay();
  return (<LinkButton href={s.requestHref} target="_blank" rel="noopener noreferrer"
      size={size === "bar" ? "bar-auto" : size === "sheet" ? "lg" : "md"} ...>
```
`BookLink` is the same three sizes, no `target`, `href = tripHref({ stay, from, to, adults, children, infants, locale })` from `lib/booking/trip-link.ts`, mounted beside the WhatsApp link in the bar (`:224`), the sheet's `finalAction` (`:249`) and the dock (`:268`). Query parameters are fine (static page, `matchPublicPage` ignores them, `siteHref` `locale-path.ts:128-134`).

Stored state: `lib/journey-choice.ts:1-40` is the rule set to copy: a named `sessionStorage` key, an exact shape, "a stored value is untrusted: anything that is not exactly this shape is rejected as null, never repaired". The trip state stores the **hold ref and link token** only for resume (04-06); nothing about money. The token must not appear in any URL the page builds or any `<a href>`.

Step rail: `components/journey/step-rail.tsx` already has four steps and reads `copy.steps.pay` (`:55`); rename the visible string to Request in `lib/copy/journey.ts` (`:103`, AR `:279`, ES `:446`) and `cart.note` (`:149`, "Nothing is charged before Pay..."). Do not rename the `pay` key unless every consumer and `tests/journey/scenes/step-rail.tsx` follow in the same commit. Baselines `tests/journey/__screenshots__/step-rail-*` and `journey-cart-*` change: regenerate outside `tests/` and copy in after the dev server stops (memory `snapshot-writes-outside-tests`), checking PNG sizes.

Deposit/full cards: `components/ui/toggle-card.tsx:21-31` (`pressed`, `onPress`, `title`, `detail`, `amount`, `disabled`). The Deposit card is `disabled` with the reason when the quote returns `deposit_unavailable` + `cause` (B-21; `lib/booking/types.ts:34,51`, `DepositBlock` in `lib/money/booking-price.ts:34`).

Client calls: `lib/booking/client.ts` wraps `POST /api/booking/quote|hold|release|request` with the `inquiry-form.tsx:171-200` shape (AbortController + timer, `res.json().catch(() => null)`, one typed result, never a thrown error to the screen). Request bodies use `fetch` with `Content-Type: application/json` and **no** explicit `Origin` handling (the browser sets it; F-02).

Scenes and baselines: a scene file is only a picture/behaviour harness unless it is added to `matrix` in `tests/journey/matrix.ts:53-65`; matrix entries get committed pixel baselines under `tests/journey/__screenshots__` for every state, width and language (the guest journey components have them, the ops scenes do not). Recommended: do **not** add the new trip scenes to `matrix`; shoot them with the spec's picture block into the planning folder and assert in the DOM, so no new baselines are written under `tests/`.

Pictures-first (design before code): the Travellers, Request and booking-confirmed pictures are the owner's signature gate; the spec block follows `tests/ops-stays.spec.ts:157-209` including the `[object|undefined|NaN` body check (`:195-196`), `assertArabicFont` (`:39-49`) and the `copy:` test that every label is a non-empty string in the three languages (`:54-64`).

### 2.10 Emails and the guest booking page (04-05)

**Email shell:** extract from `lib/email/magic-link.ts:21-100`: `checkedBrand` (`:21-31`), `escapeHtml` (`:43-50`), the `<table role="presentation">` skeleton with inline styles, RTL `dir` and `text-align` (`:74-100`), the square primary button `background:${TEAL};color:${WHITE};border-radius:0` (teal fill, white text; gold is lines only, memory `gold-lines-only`), Arabic faces `'Noto Naskh Arabic'` / `'Noto Sans Arabic'`. Keep `renderMagicLinkEmail` output unchanged (tests: `tests/auth-magic-link.test.mjs`, `tests/settings-brand.test.mjs`); easiest is to leave `magic-link.ts` alone and have `shell.ts` import nothing from it (duplicate the 80 lines once) or move to the shell and re-export. The brand comes from `emailBrand(await readSiteSettings(siteSettingsEnv()))` (`lib/site-settings-read.ts:57-68`, `lib/auth/magic-link-server.ts:129`); a failed read falls back to the design system.

**Sender** (copy `lib/auth/magic-link-server.ts:24,73-80,122-139`):
```ts
const FROM = "ALMAR Private Journey <inquiries@almarprivatejourney.com>";
const resendKey = process.env.RESEND_API_KEY?.trim();
const { error } = await new Resend(resendKey).emails.send({ from: FROM, to, subject, html, text });
return !error;
```
Add `{ idempotencyKey }` as the second argument to `emails.send` (Resend 6.29 option; check the type in `node_modules/resend` before relying on it). Contact route sends one email with `replyTo` and logs only an error name (`app/api/contact/route.ts:98-110`); owner notices copy that: `from` and `to` = `INQUIRY_ADDRESS` (`lib/contact-inquiry.ts:13`), `replyTo` = the guest's email so Maria's reply goes to the guest (B-28: the guest replies to the email with the bank receipt; this is what makes that work), plain text, English.

The request-received email carries the bank details and the amount **only here and on the guest's own booking page** (PAY-18). Wording that is the owner's (terms text, "all fees paid by sender" is B-29, drafted) stays a bracketed placeholder until supplied: no invented fee, deadline or legal text. The deadline shown is the stored `hold_expires_at` in UAE time (`Asia/Dubai`), formatted by a pure helper with Western digits (`lib/format.ts`, `lib/money/dates.ts`).

**Guest view API:** `app/api/booking/view/route.ts` copies `release/route.ts` (origin, 4 KB, parse `{ ref, t? }`, same 404 body for unknown and wrong token, 503 when admin is null). Access: `authorizeBookingAccess` (`lib/booking/access.ts:21-42`): a token is the only door when present; without one the signed-in guest's email must match (`readSessionProfile`). The answer comes from one definer RPC `booking_view(p_booking)` returning only guest-safe fields (model: `booking_by_ref` `:670-683` returns just `id/email/link_version/status`); bank details are included **only** while the booking is `awaiting_payment` / part-received and never for a stranger; address and stay access only after `confirmed` / `completed` (B-16, OPS-10). The booking id never leaves the server.

**Page:** copy `app/auth/confirm/page.tsx:12-18` for metadata (`robots` noindex, `referrer: "same-origin"`), `force-static` shell, the screen reads `ref` and `t` from `useSearchParams` and POSTs to the view API. No `session_id` flow (Stripe is gone). Print CSS hides buttons. `PUBLIC_PAGES` + `/bookings/trip` (F-04). Check `isHeldPath("/bookings/trip")` is false and that neither wrangler file's `run_worker_first` matches it (`wrangler.toml:17` `run_worker_first` lists the exact `/bookings`).

### 2.11 Submit, resume, guest list (04-06)

`trip-screen.tsx` posts the request and, on `ok`, navigates to `/bookings/trip?ref=&t=` (a same-origin navigation; do not use `window.open`). Resume after refresh: read the stored `{ ref, t, step }` (trip-state, 2.9), call `view` (not `quote`); if the booking is `held` and the hold has not lapsed, show the Request step with the live countdown from `holdExpiresAt`; if `awaiting_payment`, go to the booking page; if `expired`, restart from the stay with the `hold_ended` reason. Guest list: `app/bookings/page.tsx:11-19` is the server shell (`readSessionProfile`, `redirect("/login?return=bookings")`, `requestLocale`); add a `guest_bookings(p_email)` definer RPC (service-role only, guest-safe columns, no bank, no notes) in 04-08's migration and call it with `createSupabaseAdmin()` from the page; `tests/phase-03-guest.test.mjs:70-90` asserts the old empty-state strings (`copy.noBookingsYet`, `copy.startATrip`, `href="/"`): keep the empty state or re-scope that test.

### 2.12 Tests

- **Node, fake rpc** (`tests/booking-api.test.mjs`): `fakeDb({ name: (args) => data | { __error } })`; route source rules (`:988-1000`); add request, view.
- **Node, real stack** (`tests/booking-hold.db.test.mjs:1-75`, `booking-routes.db.test.mjs:1-60`): `lockStack(t)` from `tests/helpers/local-supabase.mjs:201` (skipped without a stack, fails under `ALMAR_REQUIRE_STACK=1`), take turns with the other DB files, talk only to the stack's `http://127.0.0.1` URL, remove rows by id, `waitReady(admin)` after a reset (PostgREST answers `PGRST001` first). Route handlers load with `tests/helpers/load-route.mjs` (`loadRoute(path)`, stubs `next/headers`).
- **Ops handlers on the stack:** `tests/ops-api-local.test.mjs:12-50` runs `runOps` with a fake `decide` that answers "the owner"; copy it for `bookings-api`.
- **Playwright behaviour:** answer every `/api/ops/*` call with `page.route`, shaped like the contract (`tests/ops-settings.spec.ts:20-45`, `tests/helpers/ops-stays-api.ts`). **Every** endpoint a screen calls on mount must be mocked, or `ops-client` redirects to `/sign-in` on the 403 (`components/ops/ops-client.ts:70`; extend `tests/ops-settings.spec.ts` for `/api/ops/money`).
- Never edit a scene or screen while a picture shoot runs on `next dev` (memory `editor-page-test-traps`).

---

## 3. Shared Patterns

### Owner guard and request order (every `/api/ops/*`)
**Source:** `lib/ops/route-core.ts:264-311` `runOps`, `lib/ops/route.ts:24-46`.
Order is fixed: `decide` (`requireOwner`, `lib/auth/require-owner.ts:21-37`) -> Origin (non-GET; `checkOrigin` `route-core.ts:77-95`) -> JSON type and 64 KiB (`readJsonBody` `:164-200`) -> `parse` -> handler. Errors are `errorBody(code, field, locale, detail)` (`:53-55`); `finish` never puts a database message in a reply (`:210-224`). **Apply to:** every owner route of 04-08/04-09.

### Guest booking API order
**Source:** `app/api/booking/hold/route.ts:21-47`. Origin (`isAllowedPostOrigin`, 403) -> `readJsonBody(request, limit)` (400/413) -> parser (400, one reason) -> admin + secret + gate (503 `unavailable`) -> try/catch -> `reply()` with `no-store`; nothing logged; booking id and link secret never leave the Worker. **Apply to:** `request`, `view`.

### Signed link and access
**Source:** `lib/booking/link.ts:1-28`, `lib/booking/link-token.ts`, `lib/booking/access.ts:21-42`. Token is the only door when present; wrong token, unknown ref and malformed ref answer identically. **Apply to:** `request`, `view`, any resend.

### Money
**Source:** `lib/money/*` (`fils.ts:5-12` `MIN_CHARGE_FILS`, `format.ts:11-16` `formatAed`). All server amounts bigint fils, percentages basis points, rounding only in `lib/money`. The screens format with `formatAed` inside `<bdi dir="ltr">`. Dashboard money input is text, parsed on the server. **Apply to:** record payment, void, emails, booking page.

### Reason codes
**Source:** `lib/booking/types.ts:21-42`; owner-side `P0001 almar:<code>`. Every outcome the guest can cause is a returned reason, never a silent hide or a thrown error (B-02; 04-02 SUMMARY "patterns-established").

### Corners, colour, type
Square corners (`rounded-none`, `--radius-control` 0); gold only as lines (`decoration-gold` underline, `shadow-rule-primary`), primary button teal fill + white text; focus outline `outline-teal`; type scale 12/14/16/20/32/48/64 via the existing classes (`text-label`, `text-body`, `text-title`, `text-heading`); `ar:` variants for Arabic (`ar:normal-case ar:tracking-normal`). Copy every class string from `settings-screen.tsx:226-262` rather than inventing new ones. No second visual system (CLAUDE.local).

### Three languages everywhere
Every component, line, alt and email exists in EN, AR (RTL) and ES. Dashboard is English in content (owner 2026-10-14) but the chrome copy files are `Record<'en'|'ar'|'es', ...>` (`lib/copy/ops-settings.ts:1-60`); dashboard Spanish uses usted. Public ES is neutral Latin American. A `copy:` test asserts equal keys and non-empty strings in all three (`tests/ops-stays.spec.ts:58-68`).

### Pictures first
Design before code for any customer- or operator-visible screen: pictures drawn from real components in the harness, assertions in the DOM, owner signs, then code. Gate in the spec (`tests/ops-stays.spec.ts:168-209`).

### Test hygiene
Run the **full** `node --test tests/*.test.mjs` before reporting (memory `auth-job02-lessons`); heavy runs only with the controller's go (memory `slot-go-every-run`); `--workers=2` at most; one local Supabase stack at a time.

---

## 4. Shared files that need the controller's grant

Rule: `.planning/prompts/00-common-rules.md:98-101` ("Ask the controller ... before you touch a shared file") plus a migration number before writing SQL.

| File | Plans that need it | Change |
|---|---|---|
| `supabase/migrations/<n>_booking_requests.sql` | 04-08 (and 04-09 if it needs a second file) | number reserved by the controller; applied live only by the controller |
| `lib/copy/journey.ts` | 04-03 | `steps.pay` visible text -> Request, `cart.note`, `pay.*` lines (EN/AR/ES) |
| new `lib/copy/*.ts` files: `ops-bookings.ts`, `booking-email.ts`, `booking-page.ts`, `guest-bookings.ts`, `booking-trip.ts` (if separate), `ops-money.ts` (if separate) | 04-03, 04-05, 04-06, 04-09 | each new file needs its slot granted (05-01 header says the same); self-contained, not added to `lib/copy/index.ts` |
| `lib/copy/ops-settings.ts` | 04-09 | new keys for the bank/transfer section (or put them in a new file to avoid the shared edit) |
| `wrangler.toml` | none expected | must **not** change (F-03); `wrangler.preview.toml` likewise |
| `wrangler.ops.toml` | 04-08 | `[triggers] crons`; pinned by `tests/ops-runtime.test.mjs:411-416` and rewritten by `tests/build/make-ops-test-config.mjs` |
| `package.json`, `package-lock.json` | none expected | `resend` 6.29.0 is already a dependency; no new package should be needed (IBAN check is hand-written) |
| `tokens.json`, `app/globals.css`, `next.config.ts`, `tests/design-tokens.test.mjs` | none expected | no new token; if a status colour or width is wanted, ask first |
| `lib/locale-path.ts` | 04-03, 04-05 | `PUBLIC_PAGES` += `/booking/trip`, `/bookings/trip` (F-04) |
| `lib/ops-routes.ts` | 04-09 | `OPS_LIVE_SECTIONS` += `/bookings` (`/settings` is already live, `:38`) |
| `lib/server-routes.ts` | none | `/api/booking/request` and `/view` are picked up from `app/api` by `serverPathsFrom`; no list edit |
| `components/ops/api-types.ts` | 04-09 (avoid) | put booking types in a new `components/ops/booking-types.ts` instead |
| `lib/supabase/database.types.ts` | 04-08 | generated; regenerate with `node tests/helpers/local-supabase.mjs types` if kept current |
| `worker/almar-ops.mjs` | 04-08 | `scheduled` export; pinned by `tests/ops-runtime.test.mjs:236-250` |

---

## 5. Existing tests that pin what these plans change

| Test file (line) | Pins | Plan that must edit it |
|---|---|---|
| `tests/booking-api.test.mjs:916-922` | `liveGate` truth table | 04-08 (replace with the new gate) |
| `tests/booking-api.test.mjs:988-1000` | the three routes' source rules | 04-08 (add `request`), 04-05 (`view`) |
| `tests/server-runtime.test.mjs:94-95` | `serverPathsFrom` of the three booking routes | 04-08, 04-05 |
| `tests/build/server-runtime.spec.ts:100` | the exact server path list of the built Worker | 04-08, 04-05 |
| `tests/ops-runtime.test.mjs:236-250`, `:411-416` | ops Worker imports; `wrangler.ops.toml` tables | 04-08 |
| `tests/build/make-ops-test-config.mjs:27` | blocks dropped for the local ops config | 04-08 |
| `tests/ops-runtime.test.mjs:18-75` (`MANIFEST`, `WANT`) | the exact ops path list | 04-09 (new `/bookings`, `/bookings/detail`, `/api/ops/...`) |
| `tests/ops-route.test.mjs:506-535` | `EXPECTED_ROUTES` and route-file rules | 04-08/04-09 (add names; keep imports `lib/ops/*` only) |
| `tests/secrets.test.mjs:17-21` | where the service key may be named | 04-08 (must stay green) |
| `tests/locale-path.test.mjs:116-126` | `PUBLIC_PAGES` list | 04-03, 04-05 |
| `tests/media-guard.test.mjs:217-220`, `tests/media-manifest.test.mjs:342-368`, `tests/locale-routes.test.mjs:32` | document counts and locale routes from `PUBLIC_PAGES` | 04-03, 04-05 |
| `tests/phase-03-dashboard-lists.test.mjs:24-47` | placeholder bookings screen: columns `Guest/Destination/Dates/Status`, `copy.noBookingsYet`, `copy.newBooking`, `<tbody />`, no `[id]`, no sample names | 04-09 (re-scope bookings assertions only) |
| `tests/phase-03-settings.test.mjs:27-60` | settings group order, Checkbox, `opsSend("/api/ops/settings"`, `disabled={!enabled}` | 04-09 (keep green; new section after Money) |
| `tests/ops-settings.spec.ts:20-45` | mocks only `/api/ops/settings` | 04-09 (also mock `/api/ops/money`) |
| `tests/phase-03-guest.test.mjs:70-90` | guest `/bookings` empty-state strings | 04-06 |
| `tests/phase-03-dashboard-shell.test.mjs:19-21` | `newBooking` copy in `lib/copy/dashboard.ts` | leave `dashboard.ts` alone |
| `tests/journey/__screenshots__/step-rail-*`, `journey-cart-*` | pixel baselines for the Pay -> Request wording | 04-03 (regenerate outside `tests/`) |
| `tests/auth-magic-link.test.mjs`, `tests/settings-brand.test.mjs` | magic-link email render | 04-05 (if `shell.ts` is extracted from it) |
| `tests/phase-02-gates.test.mjs:7` | `re_` needle in app/components/lib (F-09) | all |

---

## 6. No Analog Found

Planner should use RESEARCH.md / the guidance below, not a copy.

| File | Role | Data flow | Reason |
|---|---|---|---|
| `worker/almar-ops.mjs` `scheduled` + cron in `wrangler.ops.toml` | Worker entry | event-driven (cron) | No `scheduled` export or `crons` exists in the repo or its tests (F-03). Cloudflare's `scheduled(controller, env, ctx)` with `ctx.waitUntil`; test it with the scratch-Worker harness (`tests/ops-runtime.test.mjs:252-280`) by importing the entry and calling `mod.default.scheduled(...)` with fake deps. Check Free-plan cron count and measure CPU on preview. |
| `lib/ops/bank.ts` IBAN / BIC check | utility | validation | No IBAN or bank logic exists. Hand-written mod-97 (no new package; `package.json` is a granted file). |
| `components/journey/hold-timer.tsx` | component | event-driven (1 s tick) | No countdown component exists. Drive it from the server's `holdExpiresAt`, not the client clock alone; `aria-live="polite"` only at thresholds (not every second); announce expiry once. |
| Form-in-dialog for Record payment | component | form | The kit has only `ConfirmDialog` (no form) and `Sidebar` (a bare dock). Compose them as in 2.8 rather than adding a kit component (kit changes ripple: memory `publish-follows-save-holds`). |
| `lib/booking/lapse.ts` run loop | service | batch | Deps-injection style exists (`SendLinkDeps`), the batch loop does not. |
| Guest booking page "transfer instructions" screen | page | display | No page shows owner-private data to a guest; the closest are the booking-link rules in `lib/booking/access.ts` and `app/auth/confirm/page.tsx` (metadata/referrer). |
| Dashboard notes list | component | CRUD (append-only) | No notes UI exists; use the detail view sections and a plain `Field` (textarea) + Save. |

---

## 7. Metadata

**Analog search scope:** `supabase/migrations`, `supabase/tests`, `lib/booking`, `lib/ops`, `lib/settings`, `lib/email`, `lib/auth`, `lib/copy`, `lib/money`, `app/api`, `app/booking`, `app/bookings`, `app/dashboard`, `app/auth`, `components/journey`, `components/ops`, `components/ui`, `components/pages/stay-detail`, `worker`, `wrangler*.toml`, `tests` (node, Playwright, helpers, scenes), `scripts`.
**Files scanned (read in full or by range):** about 95, plus `grep` sweeps over `app lib components worker scripts tests`.
**Not run (by instruction):** dev server, build, Playwright, Docker, any database, git checkout/switch/stash/commit.
**Pattern extraction date:** 2026-10-19.
