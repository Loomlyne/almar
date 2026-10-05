# Phase 4: Book and pay (+ v1 minimal ops) - Research

**Researched:** 2026-10-04 (job 12 session, branch `gsd/plan-v1-backend`, read-only)
**Domain:** Stripe Checkout Sessions with Elements on Cloudflare Workers (OpenNext), Postgres inventory hold, money math, Resend
**Confidence:** HIGH for the Stripe integration choice and webhook mechanics; MEDIUM for Workers runtime behaviour (not measured on Cloudflare); LOW for Adaptive Pricing on a UAE account (not shown in any doc; must be checked in his Dashboard)

## Summary

B-03 ("charge AED, Stripe shows the guest their own currency, on our branded page") is Stripe **Adaptive Pricing**.
Stripe's docs say it runs **only on the Checkout Sessions API**: hosted page, embedded page, embedded form, and
**Elements with Checkout Sessions** (`ui_mode: "elements"`, formerly `custom`). It does **not** run on the Payment
Intents API: "Adaptive Pricing is only supported for Elements with Checkout Sessions. Adaptive Pricing isn't
supported on the Payment Intents API."
[CITED: docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md?payment-ui=embedded-components]
The recommendation is therefore **Checkout Sessions with `ui_mode: "elements"`, the Payment Element and the Currency
Selector Element, mounted on `/booking/trip`**. That is our page and our branding, with no redirect to
`checkout.stripe.com`. If his UAE account turns out to have no Adaptive Pricing, the same code still works: the
Currency Selector shows nothing and the card's bank converts, which is B-03's own fallback. So the choice costs
nothing either way.

The rest of the phase is standard. The webhook is a Next route handler under `/api/stripe/webhook`. It reads
`await request.text()` and verifies with `stripe.webhooks.constructEventAsync(..., Stripe.createSubtleCryptoProvider())`.
The Stripe client uses `httpClient: Stripe.createFetchHttpClient()`. Events are deduped by event id in a table. The
30-minute hold is one row per (stay, night) under a primary key. One `security definer` function, `place_hold`,
clears expired rows and inserts new ones in the same transaction, under a per-stay advisory lock. Ops blocks (C-13)
are checked by the same function. Owner-made holds (O-03) are the same rows with the owner's expiry. Paid bookings
keep their rows with no expiry. Money is a pure TS module in integer fils with one half-up rounding helper. Every
public page stays static. Phase 4 adds only `/api/*` route handlers plus two static page patterns, so job 10's
allow-list needs no exact path outside `/api`.

**Primary recommendation:** Use Checkout Sessions (`mode: "payment"`, `ui_mode: "elements"`, `currency: "aed"`,
`payment_method_types: ["card"]`, `adaptive_pricing: { enabled: true }`, `expires_at` = the hold end). Use
`@stripe/react-stripe-js/checkout` `CheckoutElementsProvider` + `PaymentElement` (with `wallets: { link: "never",
googlePay: "never" }`) + `CurrencySelectorElement`, and confirm with `redirect: "if_required"`. The webhook
(`checkout.session.completed`) is the only thing that marks a booking paid.

## Project Constraints (from CLAUDE.md, connections.md, 00-common-rules.md)

- Work session only: no commit on `main`, no deploy, no hosted SQL, no change to Stripe, Supabase, Cloudflare,
  Resend or DNS. Each of those is an owner gate: one numbered step, then wait.
- Ask the controller for a migration number before writing a migration. Ask before touching shared files:
  `lib/copy/*.ts`, `package.json`, `package-lock.json`, `wrangler.toml`, `next.config.ts`, `app/globals.css`,
  `tokens.json`. `lib/server-routes.ts`, `lib/locale-path.ts`, `middleware.ts` and `tests/build/server-runtime.spec.ts`
  are shared in practice too (jobs 02, 10 and 11 own them).
- Never invent prices, rates, legal text or people. Brackets stay (`[Booking terms]`, `AED [AMOUNT]`).
- EN, AR and ES in the same pass. AR is RTL. Square corners, gold as a line only, no radio controls (toggle cards
  D-17), checked at 390, 834 and 1440.
- Design before code for the Travellers step, Pay with the Payment Element, the booking page and the emails. The
  owner signs the pictures.
- A shown control works end to end, or it is not shown. No "Record payment" (O-04), no refund button (O-01).
- Secrets: names only (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, plus the new ones
  named below). Never in `.env` files (job 10's assembler refuses them). Never inline `NEXT_PUBLIC_*` without
  review (job 10 hand-over, gap row).
- Opus reviews every diff that touches money, the database or auth. Hand-over check set:
  `npm ci`, `tsc`, `node --test tests/*.test.mjs`, `tokens:check`, `build`, `playwright --workers=4`, each failure
  rerun at `--workers=1`.
- Kill processes only by port. Never `git stash`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (04-CONTEXT.md)
- **B-01:** Booking starts from "Book" on the stay page beside "Request on WhatsApp". It opens `/booking/trip`
  (`/ar/…`, `/es/…`) with destination, stay, dates and guests filled. Home Search stays on `/private-stays`. No stay
  overlay inside `/booking/trip`.
- **B-02:** Steps Stay (locked) → Add-ons → Travellers → Pay. Back and edit until Pay. Availability, min nights,
  over max guests and missing rates are checked live and shown as a reason.
- **B-03:** Charge in AED. Where Stripe offers it, its form shows the guest's own currency at Stripe's rate;
  otherwise the card's bank converts. Pages keep "about USD/EUR". No FX lock.
- **B-04:** TEST starting values: VAT 5 %, deposit 30 %, editable in Dashboard → Settings, confirmed by him
  before live.
- **B-05:** nights → add-ons → subtotal → VAT on subtotal → grand → deposit (% of grand) or full. VAT once. No
  coupon line, no damage-hold line. Server computes everything. Snapshot of every price, VAT % and deposit %.
- **B-06:** Minor units (fils), integer arithmetic, one tested rounding rule.
- **B-07:** Card and Apple Pay (domain verified: owner gate). Link off. Never a Stripe hosted page, never raw
  card numbers, ops sees last 4 only.
- **B-08:** Pay is idempotent. Webhook is the source of truth. A refresh never charges twice. 3DS when asked.
- **B-09:** Entering Pay holds nights for 30 minutes. On expiry, restart from the stay. Postgres, one row per
  stay-night, unique. Expired holds are cleared in the transaction that places a new one. No cron. Paid nights
  block for good.
- **B-10:** Guest checkout without an account. Name, email and phone required. Nationality, special requests and
  emergency contact optional. Traveller lines match the guest count, "I am not staying" option, children and
  infants give name and age. The booking is linked to the email. A signed-in guest with that email sees it in
  `/bookings`.
- **B-11:** UAE airport DXB / AUH / SHJ, return the same. Airport meet included. Home pickup is a UAE add-on that
  starts added, with one pickup address reused for the return.
- **B-12:** Inclusions kit shown as included, no price.
- **B-13:** Booking terms checkbox required. `[Booking terms]` until he supplies the text. Live payments stay off
  until then.
- **B-14:** Branded receipt email in the site language, from `inquiries@almarprivatejourney.com`. No PDF. The
  booking page prints cleanly.
- **B-15:** "Pay balance" on the booking page, same checkout, due [N] days before arrival (Settings). No
  reminders or auto-cancel. Ops sees "balance overdue".
- **B-16:** Booking page = source of truth. Reached by a signed link in the email, or by a signed-in guest with
  that email. Exact address and access only after Confirmed.
- **B-17:** `ALMAR-XXXXXX`: 6 characters, unambiguous alphabet, unique.
- **B-18:** Every paid booking emails the owner at `inquiries@almarprivatejourney.com`.
- **B-19:** TEST on Koss's existing UAE Stripe account. It moves to the ALMAR owner's account before live. Keys
  are names only. Switching accounts is a key change, nothing in code.

### Locked Decisions (05-CONTEXT.md, minimal ops)
- IN v1: bookings list (search ref or guest, status filter, upcoming first, overdue flag); detail (guest,
  travellers, stay, dates, add-ons, airport, paid / balance / due, payments and refunds, last 4); Confirm / Mark
  completed / Cancel (no auto refund); Resend confirmation; Settings VAT %, deposit %, balance due days; owner
  email on every paid booking; **New booking by hand** (O-02).
- **O-01:** Refunds in Stripe's dashboard. The webhook records refunds and disputes.
- **O-02:** Hand-made booking: guest, stay, dates (checked against availability and blocks), add-ons, deposit
  or full. Emails the guest a pay link to the same checkout via the booking page.
- **O-03:** Hand-made unpaid booking blocks the nights until an owner-set "hold until" (UAE time). Then it turns
  Expired, lazily.
- **O-04:** No offline payment recording.
- **O-05:** Held (web, 30 min) / Awaiting payment (hand-made) → Deposit paid / Paid in full → Confirmed →
  Completed. Cancelled, Expired. Confirm is his click.
- **O-06:** Every status change and resend stored with time and actor.
- **O-07:** Canvas `DashBookings`, `DashBookingDetailA/B`, `DashNewBookingA/B`, `DashSettingsA`, dense, phone
  versions. Owner-only through `/api/ops/*` with `requireOwner()`.
- **O-08:** Deposit % in force is copied onto each booking at creation.
- 03.2 **C-11** (base rate + date ranges, most specific wins, equal-length ranges may not overlap, AED),
  **C-12** (no base rate = not bookable), **C-13** (ops blocks full days: stay / destination / everything; min
  nights default 1; infants-count toggle), **C-14** (stay access in a table no public view exposes),
  **C-19** (`/api/ops/*`, `isOwnerProfile`, service role after the check).

### Claude's Discretion
- PaymentIntents vs Checkout Sessions custom UI → **decided below: Checkout Sessions, `ui_mode: "elements"`**.
- Booking page URL shape within job 10's allow-list → **decided below**.
- Pictures for undrawn screens before code.
- Ops list page size, search matching, tie order.

### Deferred Ideas (OUT OF SCOPE)
Damage hold (PAY-13), coupons (PAY-05, OPS-12), PDF receipt, USD/EUR charging with FX lock (PAY-15), reminders
and auto-cancel (PAY-11), refunds from our app (PAY-12), guest add-ons after pay (ADDN-02), stay overlay in
`/booking/trip`, saved address book, and the Phase 5 OUT list (analytics, customers, notes, audit screen, CSV,
In trip / Driver / Flights, cancellation requests, passport, brand editing).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (short) | Research support |
|----|---|---|
| BOOK-02 | `/booking/trip` steps, back and edit until pay | §Architecture: static shell + `/api/booking/quote`; StepRail exists |
| BOOK-03 | 30-min hold on pay, restart on expiry | §Hold: `place_hold`, session `expires_at` aligned |
| BOOK-04 | one destination per booking | single `stay_id` per booking; WhatsApp link from job 11 |
| BOOK-08 | exact address only after Confirmed | `/api/booking/view` joins C-14 access only when `status in (confirmed, completed)` |
| STAY-01/02/03/04/06 | reasons not hidden; max guests; no rate; hard block; min nights | §Quote reasons |
| JOUR-01..04 | airport, pickup address, inclusions | columns on `bookings`; add-on `is_uae` from 3.2 |
| IDEN-01/02 | contact, terms, travellers | `bookings` contact columns, `booking_travellers` |
| PAY-01/02/03 | breakdown order, VAT then deposit, deposit or full | §Money |
| PAY-06/07/08/09/10/14 | branded Element, no saved cards, TEST, idempotent webhook, balance same checkout, ref | §Stripe, §Schema |
| PAY-17 (subset) | email receipt in site language, ops resend | §Email |
| AUTH-01 | guest checkout, email remembers | §Guest access |
| OPS-05 (subset), OPS-06, OPS-10, OPS-13 | statuses, hand-made booking + pay link, access after Confirmed, booking page | §Schema, §Ops |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Steps UI, cart display, Payment Element, Currency Selector | Browser (static page, client components) | — | Pages are static files (job 10). Card data stays in Stripe's iframe |
| Quote (nights, add-ons, VAT, deposit, reasons) | API (`/api/booking/quote`, pure TS module) | DB (rates, blocks, nights) | B-05: server computes; client numbers are display only |
| Hold, booking create, reference | DB (`place_hold`, `create_web_booking` RPC) | API (validation, calls RPC with service role) | Race safety needs one transaction |
| Checkout Session create / reuse / expire | API (stripe-node, fetch client) | Stripe | Secret key on the Worker only |
| Paid state, refunds, disputes | API webhook → DB | Stripe (source) | PAY-09 |
| Booking page data | API (`/api/booking/view`, token or session email) | DB | No anon RLS access |
| Emails | API (Resend) | — | Webhook and ops endpoints send |
| Ops list/detail/status/new/settings | API `/api/ops/*` (`requireOwner`) | Browser (dashboard screens) | C-19 |

## Q1. B-03: local-currency display, which Stripe API (answer)

| Question | Answer | Evidence |
|---|---|---|
| Is this Adaptive Pricing? | Yes. "Let customers pay in their local currency… Stripe… automatically calculates the localized price and handles all currency conversion" | [CITED: docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md?payment-ui=embedded-components] |
| (a) PaymentIntents + Payment Element? | **No.** "Adaptive Pricing isn't available for businesses using Elements with the Payment Intents API." | same page, Restrictions |
| (b) Checkout Sessions with Elements? | **Yes.** `ui_mode: "elements"` (the API enum also has `embedded_page`, `form`, `hosted_page`; stripe-node added `elements` alongside the older `custom`) | [CITED: docs.stripe.com/api/checkout/sessions/create], [VERIFIED: stripe-node CHANGELOG line 631 "new values `elements`, `embedded_page`, `form`, and `hosted_page`"] |
| Never a Stripe hosted page? | Satisfied. Elements mode renders on our page. `success_url` and `cancel_url` are not allowed in elements mode; only `return_url` is | API create, `success_url` / `cancel_url` notes |
| UAE merchant eligible? | **Not stated anywhere.** The only merchant-country exclusion in the docs is India. AE is listed as a *customer* market. AED is the UAE account's settlement currency, which meets "currency for your prices… one of your settlement currencies" | Adaptive Pricing page; [CITED: support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae] (lists Checkout, not Adaptive Pricing) — **[ASSUMED] eligible; owner checks `dashboard.stripe.com/settings/adaptive-pricing` in TEST** |
| TEST? | "You can enable Adaptive Pricing in a sandbox and live mode." Simulate a country with a `+location_XX` email (e.g. `test+location_FR@example.com`) as `customer_email`, or with the Stripe.js testing assistant | same page, Testing |
| Currencies | Local currency of 150+ markets (lists include US, GB, EU members, SA, QA, CO and more). No conversion when the customer is not cross-border (a UAE card sees AED only) | same page, Supported currencies, Troubleshoot |
| What the guest sees | A **Currency Selector Element** on our page (required: "You must render the Currency Selector Element"), showing local and AED amounts, plus the localized total in the Session object. The rate includes a **2–4 % conversion fee paid by the customer**; the merchant pays 0 %. The rate is guaranteed for 24 h. The guest can choose to pay in AED instead | same page, Pricing / Exchange rate |
| What we get back | We settle the AED amount ("the merchant will receive 100 USD… less fees"). `presentment_details { presentment_amount, presentment_currency }` exists on Checkout Session, PaymentIntent, Charge and Refund | [CITED: support.stripe.com/questions/adaptive-pricing]; [CITED: docs.stripe.com/api/payment_intents/object?query=presentment_details]; stripe-node CHANGELOG line 1174 |
| Refunds | Refund in AED; Stripe refunds the guest in their currency at the original rate | Adaptive Pricing page, Refunds |
| Restrictions that matter | Not with `capture_method: manual` (irrelevant now, but the v1.1 damage hold, a manual-capture PaymentIntent, will never be localized). Not with `currency_options` prices (we use inline `price_data`) | Restrictions |
| Confirm rule | `actions.confirm()` **throws unless the page reads `total.total.amount`** (or minor units + divisor) from the checkout object and shows it | [CITED: docs.stripe.com/js/custom_checkout/confirm] |

**Recommendation (Claude's discretion, decided):** Checkout Sessions API, `ui_mode: "elements"`. It is also what
Stripe now recommends by default ("Stripe recommends using the Checkout Sessions API with the Payment Element over
Payment Intents for most integrations") [CITED: docs.stripe.com/payments/quickstart-checkout-sessions].
B-07 is met: `payment_method_types: ["card"]` (Apple Pay shows as a wallet of `card`), plus Payment Element
`wallets: { applePay: "auto", googlePay: "never", link: "never" }` [CITED: docs.stripe.com/js/custom_checkout/create_payment_element].
Also turn Link off in the Dashboard as a second guard (owner gate).

**Fallback if his account has no Adaptive Pricing:** no code change. `currencyOptions` stays empty, the selector
renders nothing ("If there are no currencyOptions and the Currency Selector Element is mounted, nothing displays"),
the charge is AED and the bank converts (B-03's own fallback). Render the selector only when `currencyOptions` is
non-empty.

**What the owner must know (pricing-adjacent, ask before plan lock):** the guest pays the 2–4 % FX markup only if
they accept their local currency. Our "about USD/EUR" line uses the site feed (`lib/fx/rates.ts`), so it will
differ from Stripe's localized figure. The Pay step should say the localized amount is Stripe's.

**Arabic inside the Element (open):** Stripe.js Elements supports `ar`, but the Checkout column of the locale
table does not list `ar` [CITED: docs.stripe.com/js/appendix/supported_locales], and the Checkout Session `locale`
enum has no `ar`. Whether Checkout Elements renders Arabic labels from `loadStripe(pk, { locale: "ar" })` is
**unverified**. Plan a TEST probe in Wave 0. If it does not, the Element shows English labels inside an RTL page,
which is acceptable but needs his OK.

## Q2. Apple Pay on almarprivatejourney.com

- Register every domain that shows the button: `almarprivatejourney.com`, `www.almarprivatejourney.com`,
  `preview.almarprivatejourney.com`. Do it in Dashboard → Settings → Payment method domains, or with
  `POST /v1/payment_method_domains domain_name=…`. Registering in **live** mode also registers it in sandboxes;
  registering in a sandbox covers TEST only. Register once per account.
  [CITED: docs.stripe.com/payments/payment-methods/pmd-registration.md?dashboard-or-api=api; docs.stripe.com/apple-pay?platform=web]
- **No `.well-known` file is required now.** The current docs say "Stripe handles Apple merchant validation for
  you, including creating an Apple Merchant ID and Certificate Signing Request". Neither page mentions
  `apple-developer-merchantid-domain-association`. Job 10's assets need no change. [CITED: docs.stripe.com/apple-pay?platform=web]
  If the Dashboard ever asks for the file, it would go in `public/.well-known/…`. The assembler copies `public/` and
  refuses only files under `/api` or held paths (job 10 `assemble-cloudflare.mjs:72-82`). [ASSUMED: Workers static assets serve dot-folders]
- B-19: domains are **per Stripe account**, so they must be registered again on the ALMAR owner's account before
  live. Put this in the go-live runbook.
- Testing Apple Pay: use a real card in Wallet with **test** keys; Stripe returns a test token. Test cards cannot
  be added to Wallet. Safari / iOS on a registered HTTPS domain only, so `localhost` will not show it; use the
  preview host. [CITED: docs.stripe.com/apple-pay?platform=web]
- The Element must load in a top-level page on the registered origin (no cross-origin iframe). Our page meets this.

## Q3. Stripe on Workers via OpenNext route handlers

**Client:** create it once per request (env is read at request time):

```ts
// lib/stripe/server.ts — server only
import Stripe from "stripe";
export function stripeServer(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1 });
}
```

stripe-node ships a `workerd` / `worker` export that defaults to the fetch client and SubtleCrypto
[VERIFIED: stripe-node package.json `exports.workerd`; `src/platform/WebPlatformFunctions.ts`]. OpenNext may still
resolve the Node build (Node `http` client), so **set both explicitly**. A third-party PR titled "Stripe Fetch HTTP
client for Cloudflare Workers (checkout hang)" shows the failure mode [LOW: github.com/gackvictor7-alt/Inner-Circle/pull/40].

**Webhook:** `app/api/stripe/webhook/route.ts`:

```ts
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const stripe = stripeServer(); const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sig = request.headers.get("stripe-signature");
  if (!stripe || !secret || !sig) return new Response("unavailable", { status: 503 }); // Stripe retries
  const body = await request.text();               // raw body, read once, never request.json()
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch { return new Response("bad signature", { status: 400 }); }
  // 1) insert into stripe_events(id) on conflict do nothing → if no row inserted, return 200 (duplicate)
  // 2) handle by type (below) through one RPC per event; on error delete the event row and return 500 so Stripe retries
  return Response.json({ received: true });
}
```

- The synchronous `constructEvent` throws with SubtleCrypto ("SubtleCryptoProvider cannot be used in a synchronous
  context"), so use the async form. [VERIFIED: stripe-node `src/crypto/SubtleCryptoProvider.ts`]. Default tolerance
  is 5 minutes; never pass 0. [CITED: docs.stripe.com/webhooks]
- **Raw body under OpenNext is unverified** (job 10 hand-over, "Not verified"). `worker/handle.mjs` re-wraps the
  request as `new Request(request, { headers })`, which keeps the body stream, and job 02's `middleware.ts` matcher
  includes `/api/*` but never reads the body. **Wave 0 test:** run the assembled build under `wrangler dev`
  (production config). POST a body signed with `stripe.webhooks.generateTestHeaderString`, twice in a row; both
  must verify. Then `stripe listen --forward-to` against `wrangler dev`.
- Recommend excluding `/api/stripe/webhook` from job 02's middleware matcher. That saves CPU and keeps the body
  untouched. It is a shared file: the controller decides.
- **Idempotency keys:** every Stripe POST gets `{ idempotencyKey }`. Keys last at least 24 h, at most 255
  characters, and reusing one with different parameters errors. Do not put email or PII in keys.
  [CITED: docs.stripe.com/api/idempotent_requests]. Use the `payments.id` uuid created in our DB before the call:
  `cs-create:<payment_id>`, `cs-expire:<session_id>`.
- **Events to subscribe (only these):**

| Event | Action |
|---|---|
| `checkout.session.completed` (with `payment_status === "paid"`) | `record_payment` RPC: payment row succeeded; booking → `deposit_paid` / `paid_in_full` (or keep `confirmed`); nights made permanent; then retrieve PaymentIntent `expand: ["latest_charge"]` for brand, last4, wallet type, `presentment_details`; then send guest and owner emails |
| `checkout.session.expired` | payment row expired; if booking `held` → `expired` and its hold rows deleted (frees nights early) |
| `charge.refunded` | upsert `booking_refunds` by refund id (from `charge.refunds`, or retrieve); history row |
| `charge.dispute.created` (+ optional `charge.dispute.closed`) | upsert `booking_disputes`; history row |

  Fulfillment must be safe when called several times, even at once, for the same session
  [CITED: docs.stripe.com/checkout/fulfillment.md?payment-ui=embedded-page]. Dedupe by event id; for a second Event
  object about the same thing, also by `data.object.id` + type [CITED: docs.stripe.com/webhooks "Handle duplicate events"].
  Ordering is not guaranteed. Live mode retries for up to 3 days; sandbox retries 3 times over a few hours.
  Return 2xx quickly. Also call the same idempotent `fulfill` from the return page's status check (`/api/booking/status`).
  Stripe recommends this so the guest sees "paid" before the webhook lands.
- **Return flow:** confirm with `redirect: "if_required"`. Card and Apple Pay normally don't redirect, and 3DS opens
  in Stripe's modal. `return_url` = the booking page URL plus `&session_id={CHECKOUT_SESSION_ID}`, used only if a
  redirect happens. [CITED: docs.stripe.com/js/custom_checkout/confirm]
- **CPU on Workers Free (10 ms):** waiting on `fetch` (Stripe, Supabase, Resend) does **not** count toward CPU
  [CITED: developers.cloudflare.com/workers/platform/limits/]. HMAC via WebCrypto is native and sub-millisecond for
  a few-KB body. The unknown is OpenNext/Next per-request overhead, which job 10 also has not measured. **Measure on
  preview** (owner's rule) before relying on it: webhook, quote, hold. Exceeding the limit gives Error 1102. Keep
  handlers lean: no React email rendering (string templates, as job 02 does), no big JSON transforms. Free plan
  also caps 50 subrequests per request; the webhook uses about 5.

## Q4. Hold design (B-09, O-03, C-13)

**Tables (one migration, number from the controller):**

```sql
create table public.booking_nights (
  stay_id    uuid not null references public.stays(id),
  night      date not null,                       -- the night of `night` (arrive <= night < leave)
  booking_id uuid not null references public.bookings(id) on delete cascade,
  expires_at timestamptz,                          -- null = permanent (paid, or confirmed)
  primary key (stay_id, night)
);
create index on public.booking_nights (booking_id);
create index on public.booking_nights (expires_at) where expires_at is not null;
```

**`place_hold(p_booking uuid, p_stay uuid, p_from date, p_to date, p_expires timestamptz) returns text`**, with
`security definer`, `set search_path = ''`, execute granted to `service_role` only (job 02's `claim_link_slot`
pattern):
1. `perform pg_advisory_xact_lock(hashtextextended(p_stay::text, 0));` serializes holds per stay. The primary key
   still guarantees correctness without it; the lock just turns a unique-violation into a clean reason.
2. Sweep: `delete from booking_nights where stay_id = p_stay and night >= p_from and night < p_to and expires_at
   is not null and expires_at < now() - interval '2 minutes' returning booking_id`. Set those bookings `held →
   expired` / `awaiting_payment → expired` and write history rows (actor `system`). The 2-minute grace covers a
   payment confirmed just before the session expired (see Pitfall 3).
3. Ops blocks: if any C-13 block (`scope = all`, or `destination_id` = the stay's destination, or `stay_id` =
   p_stay) covers a night in `[p_from, p_to)`, return `'blocked'`.
4. `insert into booking_nights select p_stay, d::date, p_booking, p_expires from generate_series(p_from, p_to -
   1, '1 day') d on conflict do nothing`. If the inserted row count < nights, `raise` (rolls the whole
   transaction back), and the caller maps that to `'sold_out'`. Otherwise return `'ok'`.

- **Web hold:** `p_expires = now() + interval '31 minutes'`. The Checkout Session gets `expires_at` = the same
  instant (Stripe allows 30 min to 24 h). The guest sees 30:00.
- **Hand-made hold (O-03):** the same function with the owner's "hold until" (UAE time → `timestamptz`). The
  booking status is `awaiting_payment`.
- **Paid:** `record_payment` sets `expires_at = null` for the booking's rows. If the rows are gone (hold expired,
  nights taken by someone else), it **re-runs the claim**. If that fails, the booking is marked
  `needs_attention = true` (paid but nights lost). Ops sees it and refunds in Stripe (O-01). Never silently drop a
  paid booking.
- **Cancel / expire:** delete the booking's rows. Completed keeps them (history of occupancy).
- **Blocks vs bookings race:** 3.2's block endpoint warns when bookings overlap (D-87). It should take the same
  per-stay advisory lock for stay-scoped blocks. Destination and "everything" blocks are rare owner actions: warn,
  don't lock.
- **Reads (calendar, stay page "booked"):** an availability view = permanent rows + rows with `expires_at > now()`
  + blocks. Nothing needs a cron. Expired `held` bookings are shown as Expired in ops through a computed status
  (`case when status in ('held','awaiting_payment') and hold_expires_at < now() then 'expired' …`) until the next
  sweep writes it.

**Quote endpoint** `/api/booking/quote` (POST JSON `{ stay, from, to, adults, children, infants, addons:[{id,qty}], plan }`)
returns either `{ ok: true, breakdown, reasons: [] }` or `{ ok: false, reasons: [...] }`. Reason codes (copy keys
in `lib/copy/journey.ts`, shared file):
`stay_unavailable` (unpublished/unknown), `no_rate` (no base rate, C-12/STAY-03), `below_min_nights` (with `min`),
`over_max_guests` (adults + children (+ infants if the stay counts them), STAY-02, with `max`), `blocked` (ops
block, with nights), `sold_out` (nights held or booked), `dates_invalid` (past, `to <= from`), `addon_unavailable`
(not offered for this stay/destination, or no price), `settings_missing` (VAT/deposit/balance days null),
`deposit_unavailable` (arrival within balance due days, see Open Q3). The quote does **not** hold. Pay calls
`/api/booking/hold`, which re-quotes on the server, then holds.

## Q5. Money module (B-04…B-06)

`lib/money/booking-price.ts`: pure, no imports, so Node tests load it the way job 11's leaf modules are loaded.

- **Units:** every amount is an integer of **fils** (1 AED = 100 fils; AED is a 2-decimal currency, and the UAE
  minimum charge is 2.00 AED [CITED: support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae]).
  Percent is stored `numeric(5,2)` in `site_settings`. Convert it to **basis points** by parsing the decimal string
  (`"5.00"` → 500), never `Number(x) * 100` on floats.
- **Rounding (written once):** `pct(amount, bp) = Math.floor((amount * bp + 5000) / 10000)`, half-up on
  non-negative integers. Safe: amounts below 9e11 fils × 10000 < 2^53. Assert `Number.isSafeInteger` and throw
  otherwise.
- **Nights:** for each night `d` in `[from, to)`, the rate is that of the **shortest** range with `start <= d <=
  end` (C-11; equal-length overlaps are forbidden by 3.2, so there is no tie), else the base rate. Base null →
  `no_rate`. Store a per-night snapshot `[{ night, rate_fils, source: "base" | range_id }]`.
- **Add-ons (D-46):** `person`: qty 0…(adults+children+infants). `night`: qty 0…nights. `trip`: qty 0|1.
  `line = unit_price_fils × qty`. An item with `price_aed = null` is not offered.
- **Totals:** `subtotal = nights + addons`. `vat = pct(subtotal, vat_bp)`. `grand = subtotal + vat`.
  `deposit = pct(grand, deposit_bp)`. `balance = grand - deposit` (balance is computed by subtraction so the two
  always add up). `full` plan: `due_now = grand`, `balance = 0`.
- **Snapshot columns on `bookings`:** `nights_fils`, `addons_fils`, `subtotal_fils`, `vat_bp`, `vat_fils`,
  `grand_fils`, `deposit_bp`, `deposit_fils`, `balance_fils`, `plan` (`deposit|full`), `nights_snapshot jsonb`;
  plus `booking_lines` rows (name, unit, unit_price_fils, qty, line_fils).

**Test cases** (symbolic test values, not real prices; PAY-02's own example is case 1):

| # | Input | Expected (fils) |
|---|---|---|
| 1 | subtotal 100000, VAT 500 bp, deposit 3000 bp | vat 5000, grand 105000, deposit 31500, balance 73500 |
| 2 | subtotal 33333, 500 bp, 3000 bp | vat 1667 (1666.65↑), grand 35000, deposit 10500, balance 24500 |
| 3 | subtotal 10010, 500 bp, 3000 bp | vat 501 (500.5↑ half-up), grand 10511, deposit 3153 (3153.3↓), balance 7358 |
| 4 | subtotal 10001, 500 bp, 3000 bp | vat 500 (500.05↓), grand 10501, deposit 3150, balance 7351 |
| 5 | base 100000/night; range A 7 nights 120000; range B 1 night 150000 inside A; 3 nights: one B, one A-only, one base | nights 370000 (B wins over A on its night) |
| 6 | base null, range covers all nights | `no_rate` |
| 7 | add-on person 10000 × qty 4 with 2 adults + 1 child + 1 infant | 40000. qty 5 → rejected |
| 8 | add-on night qty > nights; trip qty 2 | rejected |
| 9 | plan full | due_now = grand, balance 0 |
| 10 | VAT "5.5" → 550 bp; deposit "0" | parse OK; deposit 0 → refuse deposit plan (would charge 0) |
| 11 | property: any subtotal 0…1e9, bp 0…10000 | `deposit + balance === grand`, all integers |

## Q6. Booking schema (proposal, names at the planner's discretion)

All new tables: RLS on, `revoke all … from public, anon, authenticated`. Access only through route handlers with
the service role, after a token check, a session-email check or `requireOwner()`. Every `security definer` function
gets `set search_path = ''` and execute for `service_role` only (job 02's `platform_spine.sql` pattern).

- **`bookings`**: `id uuid pk`, `ref text unique not null check (ref ~ '^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$')`,
  `status text check in ('held','awaiting_payment','deposit_paid','paid_in_full','confirmed','completed','cancelled','expired')`,
  `source text check in ('web','ops')`, `stay_id`, `destination_id`, `arrive date`, `leave date`, `adults`,
  `children`, `infants`, `guest_name`, `email text not null` (lowercased), `phone`, `nationality`,
  `special_requests`, `emergency_name`, `emergency_phone`, `locale check in ('en','ar','es')`,
  `currency text not null default 'aed' check (currency = 'aed')`, `airport check in ('DXB','AUH','SHJ')`,
  `pickup_address`, `terms_accepted_at`, `terms_version`, money snapshot (Q5), `paid_fils` (maintained by the
  webhook), `balance_due_date date` (= `arrive - balance_due_days` from Settings at creation), `hold_expires_at`,
  `needs_attention bool`, `link_version int default 1`, `created_by uuid null` (owner for ops),
  `created_at`/`updated_at`.
  `status` is the lifecycle. Money state is `paid_fils` vs `grand_fils`, so a Confirmed booking can still owe a
  balance. "Balance overdue" = `paid_fils < grand_fils and balance_due_date < (now() at time zone 'Asia/Dubai')::date
  and status not in ('cancelled','expired')`.
- **Reference:** generate inside the create RPC. Use 6 characters from the 31-character alphabet
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I, L, O, 0, 1; about 887 million values), via `gen_random_bytes` with
  rejection sampling. Loop on `unique_violation`, at most 5 tries.
- **`booking_travellers`**: `booking_id`, `position`, `kind check in ('adult','child','infant')`, `full_name`,
  `age int null` (required for child/infant by check), `is_booker bool`, `not_staying bool`.
- **`booking_lines`**: `booking_id`, `kind check in ('addon')` (nights live in the snapshot), `catalog_item_id`,
  `name` (EN snapshot), `unit`, `unit_price_fils`, `quantity`, `line_fils`.
- **`booking_payments`**: `id uuid` (also the idempotency key), `booking_id`, `kind check in ('deposit','full','balance')`,
  `amount_fils`, `currency 'aed'`, `status check in ('open','succeeded','expired','failed')`,
  `checkout_session_id unique`, `payment_intent_id unique`, `charge_id`, `card_brand`, `card_last4`,
  `wallet` (`apple_pay|null`), `presentment_amount`, `presentment_currency`, `paid_at`.
  Add a partial unique index `(booking_id) where status = 'open'` so there is **one open session per booking**.
  This makes "a refresh never makes a second charge" structural.
- **`booking_refunds`** (`stripe_refund_id unique`, `charge_id`, `amount_fils`, `status`, `created_at`) and
  **`booking_disputes`** (`stripe_dispute_id unique`, `charge_id`, `amount_fils`, `reason`, `status`), both from
  the webhook (O-01).
- **`booking_events`** (O-06): `booking_id`, `at timestamptz default now()`, `actor text` (`system`, `guest`,
  `owner:<uuid>`, `stripe:<event_id>`), `action` (`created`, `status`, `payment`, `refund`, `dispute`,
  `email_resent`, `hold_expired`), `from_status`, `to_status`, `detail jsonb`.
- **`stripe_events`**: `id text pk`, `type`, `received_at`, `processed_at`.
- **`site_settings`** (job 02, exists): `vat_percent numeric(5,2)`, `deposit_percent numeric(5,2)` exist and are
  nullable. **Add `balance_due_days int check (balance_due_days between 0 and 365)`.** Seed TEST values 5 / 30
  (B-04, his words) with `insert … on conflict (id) do update … where … is null`. Leave `balance_due_days` null
  until he gives N. `site_settings_public` already exposes vat/deposit to anon. Decide whether to add
  `balance_due_days` there (display only).
- Stay access (C-14) stays in 3.2's private table. `/api/booking/view` selects it only for `confirmed`/`completed`.

**Status transitions** (enforced in RPCs, each writes `booking_events`): `held|awaiting_payment →
deposit_paid|paid_in_full` (webhook). `deposit_paid → paid_in_full` (balance webhook). `deposit_paid|paid_in_full →
confirmed` (owner). `confirmed → completed` (owner). Any non-terminal state → `cancelled` (owner; rows freed; no
refund). `held|awaiting_payment → expired` (lazy). A payment arriving on `confirmed` updates `paid_fils` and leaves
the status alone.

## Q7. Guest booking page access (AUTH-01, B-16)

**Recommendation: an HMAC-signed link** (B-16's literal wording), plus job 02's session as the second door.

- Token = base64url(HMAC-SHA256(`BOOKING_LINK_SECRET`, `"booking-link:v1:" + booking.id + ":" + link_version`)),
  via WebCrypto `crypto.subtle` (native on Workers, negligible CPU). Compare in constant time. Bumping
  `link_version` revokes old links (v1.1 control; the column exists now). New Worker secret
  `BOOKING_LINK_SECRET`: an owner step, 32+ random bytes, set from his terminal like the others.
- URL: `/bookings/trip?ref=ALMAR-XXXXXX&t=<token>` (and `/ar/…`, `/es/…`). Query parameters only, so it passes job
  10's exact-path rule. The page is a **static shell** (see Q9) that POSTs `{ ref, t }` to `/api/booking/view`. The
  token never reaches a server log as a path.
- Signed-in guest: `/bookings/trip?ref=…` with no `t`. `/api/booking/view` runs job 02's `readSessionProfile()`
  (`getUser`, never `getSession`) and allows access when `profile.email === booking.email`. The `/bookings` list
  (job 02 page) queries bookings by the verified email with the admin client.
- Why not a magic link only: it would force an account and a second email before the guest sees what they paid
  for, and AUTH-01 says checkout without an account. The magic link stays the way into `/bookings`.
- Add `Referrer-Policy: no-referrer` for that page (in `_headers`, via job 10's per-target headers file) so the
  token does not leak to Stripe or WhatsApp links. Mark it `noindex` (the sitemap already excludes `booking`/`bookings`:
  `scripts/crawl-files.mjs:78`).

## Q8. Emails (Resend)

- Reuse job 02's sender: `FROM = "ALMAR Private Journey <inquiries@almarprivatejourney.com>"`
  (`lib/auth/magic-link-server.ts:12` on `gsd/phase-02-auth-chain`). Reuse its shell: table layout, inline styles,
  `escapeHtml`, `dir="rtl"` for AR, square button (`lib/email/magic-link.ts`). Put the shell in
  `lib/email/shell.ts` so three templates share it.
- Templates (pure render functions + node tests): `booking-confirmed` (guest, site language: ref, stay, dates,
  guests, add-ons, paid, balance + due date, booking page link); `booking-paid-owner` (EN, to `inquiries@…`,
  including deposit and balance payments); `booking-pay-link` (O-02, guest language, link to the booking page with
  token). The text part is required.
- `resend.emails.send(payload, { idempotencyKey: "booking-confirmed/<payment_id>" })`. Keys last 24 h; the same
  key with a different payload gives 409. "Resend confirmation" (ops) uses `resend/<booking_id>/<event_id>`, so it
  really resends. [CITED: resend.com/docs/dashboard/emails/idempotency-keys]
- Send **after** the DB commit in the webhook. Do not fail the webhook on an email error: record
  `email_failed` in `booking_events` and show it in ops (Resend button). CPU: string templates only.
- Copy (EN, plus AR/ES drafts) is new customer-facing text: pictures and his signature first. Whether the Resend
  domain is verified for `inquiries@` is an owner fact to confirm (job 02 depends on it too).

## Q9. Server paths and shared files

Job 10 rule: every static `app/api/**/route.ts` is served automatically. **No dynamic segments under `/api`**
(`lib/server-routes.ts`, `serverPathsFrom` throws), so ids go in the query or the body.

| Path | Method | Who |
|---|---|---|
| `/api/booking/quote` | POST | public |
| `/api/booking/hold` | POST (create booking + travellers + hold + Checkout Session; returns `clientSecret`, `publishableKey`, `holdExpiresAt`, `ref`) | public |
| `/api/booking/view` | POST `{ref,t}` | token or session |
| `/api/booking/pay` | POST `{ref,t}` (balance, or the hand-made booking's first payment): reuse the open session or expire it and create a new one | token or session |
| `/api/booking/status` | GET `?session_id` (return page; runs idempotent fulfill) | public |
| `/api/stripe/webhook` | POST | Stripe |
| `/api/ops/bookings` | GET list (`q`, `status`, `page`) | owner |
| `/api/ops/booking` | GET `?id` detail | owner |
| `/api/ops/booking/status` | POST `{id, to}` | owner |
| `/api/ops/booking/resend` | POST `{id}` | owner |
| `/api/ops/booking/create` | POST (O-02; uses `place_hold` with the owner's expiry) | owner |
| `/api/ops/booking/quote` | POST (same module, ops view) | owner |
| `/api/ops/settings` | GET / POST money fields | owner |

**Pages: static shells, no new server paths outside `/api`.** `/booking/trip` and `/bookings/trip` become
force-static client pages in all three locales:
- `lib/locale-path.ts` `PUBLIC_PAGES` += `"/booking/trip"`, `"/bookings/trip"` (the assembler ships only matching
  HTML, `assemble-cloudflare.mjs:58`).
- `lib/server-routes.ts` `HELD_PATHS`: remove `"/booking"`. `"/bookings"` is moved by job 02 plan 02-23. Its
  page `/bookings` stays a server path; `/bookings/trip` is a separate static file. Check that
  `isHeldPath("/bookings/trip")` is false after 02-23.
- `app/booking/trip/page.tsx`: remove the production `notFound()`.
- `tests/build/server-runtime.spec.ts`: flip the `/booking` entries, add `/api/stripe/webhook` POST probes.
- `wrangler.toml` / `wrangler.preview.toml`: **no change** (`/api/*` already runs the Worker first).
- `middleware.ts` (job 02): optional matcher exclusion for `/api/stripe/webhook`.
- `package.json` + lockfile: add `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- `lib/copy/journey.ts`, `lib/copy/dashboard.ts`, `lib/copy/guest.ts`: new strings.
- New Worker secrets (names): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `BOOKING_LINK_SECRET` (preview and production, set separately).

**Publishable key at runtime, not in the build:** return `STRIPE_PUBLISHABLE_KEY` from `/api/booking/hold` and
`/api/booking/pay`, and call `loadStripe` on the client after that. A switch of account (B-19) is then a secret
change only, with no rebuild and no `NEXT_PUBLIC_*` inline (job 10's warning).

**Ops screens reachability (blocking question, see Open Q1):** `/dashboard` is in `HELD_PATHS`, and job 02's
middleware answers 404 for `/dashboard` on the marketing host in production. 02-23 says the ops host "is not on
Worker `almar` (owner gate 6, later)". Unless the controller opens a host for the dashboard in v1, the minimal ops
screens built here cannot be reached live.

## Architecture Patterns

```
Stay page "Book" ──► /booking/trip?stay&from&to&adults… (static shell, client)
   Add-ons / Travellers ──► POST /api/booking/quote ──► price module ◄── rates, add-ons, blocks, nights, settings (DB)
   "Continue to pay" ──► POST /api/booking/hold
        ├─ re-quote (server)        ├─ RPC create_web_booking: ref, travellers, lines, snapshot
        ├─ RPC place_hold (31 min)  └─ Stripe checkout.sessions.create (elements, aed, expires_at=hold, idemKey=payment.id)
        ◄── {clientSecret, publishableKey, ref, holdExpiresAt}
   CheckoutElementsProvider → CurrencySelector + PaymentElement → actions.confirm({redirect:"if_required"})
        └─► (3DS modal) ─► Stripe ── checkout.session.completed ──► POST /api/stripe/webhook
                                                                    ├─ verify (raw body, SubtleCrypto)
                                                                    ├─ stripe_events dedupe
                                                                    ├─ RPC record_payment (status, paid_fils, nights permanent)
                                                                    └─ Resend: guest (locale) + owner
   Client after confirm ──► /bookings/trip?ref&t (static) ──► POST /api/booking/view (polls /api/booking/status until paid)
Ops (/api/ops/*, requireOwner) ──► list/detail/status/resend/create(place_hold with owner expiry)/settings
```

Recommended structure: `lib/money/booking-price.ts` (pure); `lib/booking/{reasons,ref,link-token,status}.ts` (pure);
`lib/booking/server.ts` (RPC wrappers); `lib/stripe/{server,checkout,webhook}.ts`;
`lib/email/{shell,booking-confirmed,booking-paid-owner,booking-pay-link}.ts`; `app/api/booking/*`,
`app/api/stripe/webhook`, `app/api/ops/*`; `components/journey/{travellers-step,pay-step,payment-panel}.tsx`;
`app/bookings/trip/*`; one migration `supabase/migrations/<number>_bookings.sql`.

### Anti-patterns
- Marking paid from `confirm()`'s client result. The webhook (or the server-side `status` check that retrieves the
  session) decides.
- `request.json()` before verifying, or verifying a re-serialized body.
- One PaymentIntent reused across amounts. In this design each payment is its own Checkout Session.
- Holding nights from the client timer: the server time `hold_expires_at` is the only truth.
- Floats anywhere in money, `toFixed` for rounding.
- Exposing booking rows to anon/authenticated through RLS "just for the guest page".
- Creating a second Checkout Session without expiring the open one (two tabs → two charges).

## Don't Hand-Roll

| Problem | Don't build | Use |
|---|---|---|
| Card form, 3DS, Apple Pay sheet | Own inputs | Payment Element via Checkout Elements |
| Currency conversion display | Own FX on the pay step | Adaptive Pricing + Currency Selector Element |
| Webhook signature | Manual HMAC | `constructEventAsync` + `createSubtleCryptoProvider` |
| Retry-safe Stripe writes | Own dedupe of API calls | `idempotencyKey` |
| Overlap prevention | App-side "check then insert" | PK on (stay_id, night) + one transactional RPC |
| Email dedupe on retries | Own sent-log only | Resend `idempotencyKey` (+ history row) |

## Common Pitfalls

1. **Raw body lost or altered under OpenNext:** signatures fail in production only. Prove it with `wrangler dev`
   and a signed test header before writing handlers (Wave 0). Warning sign: 400s in Stripe's "Event deliveries".
2. **Node HTTP client on Workers:** Stripe calls hang until the Worker times out. Always pass
   `createFetchHttpClient()`.
3. **Hold vs session expiry mismatch:** a guest who pays at 30:59 when the nights expired at 30:00 is paid
   without nights. Align `expires_at`, keep the 2-minute sweep grace, and have `record_payment` re-claim the nights
   or flag `needs_attention`.
4. **Checkout Session `expires_at` minimum is 30 minutes:** a hand-made hold ending in under 30 minutes cannot
   get a session. Refuse with a reason ("Hold ends too soon"). For hand-made holds longer than 24 h, create the
   session on the guest's click (`/api/booking/pay`), never when the owner creates the booking.
5. **Two open sessions for one balance:** enforce the partial unique index and expire the old session before
   creating a new one.
6. **`confirm()` throws** if the page does not show `total.total.amount` from the checkout object. The Pay
   button label must read it.
7. **Adaptive Pricing totals differ from our cart:** the Element can show EUR 287.xx while our cart shows AED. Label
   it, or the owner will get "wrong price" messages.
8. **Arabic in the Element** may fall back to English (see Q1). Test it.
9. **Event ordering:** `charge.refunded` can arrive before our `checkout.session.completed` is processed. Upsert by
   Stripe ids; tolerate a missing payment row (look it up by `payment_intent`, retrying via 500 if not found).
10. **CPU 10 ms:** a cold isolate plus Next routing may exceed it. Measure on preview. Upgrading is the owner's
    call (discuss #23).
11. **Live mode off until terms exist (B-13):** add a server guard. If the secret key is `sk_live_…` and the terms
    text is still the placeholder, `/api/booking/hold` refuses.
12. **Domain registration is per account (B-19):** re-register on her account and re-create the webhook endpoint
    there (new `whsec_`).
13. **Settings null:** `vat_percent`, `deposit_percent` and `balance_due_days` are nullable in job 02's table, so
    the quote must return `settings_missing`, never default to 0.
14. **Timezone:** due dates, "hold until" and "overdue" are UAE dates (`Asia/Dubai`); `date` columns for nights.

## Code Examples

Server, create session (stripe-node, fetch client):
```ts
// Source: docs.stripe.com/payments/quickstart-checkout-sessions + api/checkout/sessions/create
const session = await stripe.checkout.sessions.create({
  mode: "payment", ui_mode: "elements", currency: "aed",
  payment_method_types: ["card"],
  adaptive_pricing: { enabled: true },
  customer_email: booking.email,
  client_reference_id: booking.id,
  metadata: { booking_id: booking.id, ref: booking.ref, kind: payment.kind, payment_id: payment.id },
  payment_intent_data: { description: `${booking.ref} ${payment.kind}`, metadata: { booking_id: booking.id, payment_id: payment.id } },
  line_items: [{ quantity: 1, price_data: { currency: "aed", unit_amount: payment.amount_fils,
    product_data: { name: `${booking.ref} · ${stayTitleEn}` } } }],
  expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
  return_url: `${origin}${localePath(locale, "/bookings/trip")}?ref=${booking.ref}&t=${token}&session_id={CHECKOUT_SESSION_ID}`,
}, { idempotencyKey: `cs-create:${payment.id}` });
```

Client:
```tsx
// Source: docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md?payment-ui=embedded-components
import { CheckoutElementsProvider, PaymentElement, CurrencySelectorElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
<CheckoutElementsProvider stripe={stripePromise /* loadStripe(publishableKey, { locale }) */}
  options={{ clientSecret, adaptivePricing: { allowed: true }, elementsOptions: { appearance /* from tokens, borderRadius 0 */ } }}>
  {/* CurrencySelectorElement only when checkout.currencyOptions has entries */}
  <PaymentElement options={{ wallets: { applePay: "auto", googlePay: "never", link: "never" } }} />
</CheckoutElementsProvider>
// pay: const r = await checkout.confirm({ redirect: "if_required" }); r.type === "error" → show message
```

## Standard Stack

| Library | Version (recommended pin) | Purpose | Why |
|---|---|---|---|
| `stripe` | **22.6.2** (pins API `2026-08-26.dahlia`) | server API, webhooks | The quickstart's Node sample uses `^22.6.0`; 23.0.0 (API `2026-09-30.endive`) is 3 days old with breaking changes [VERIFIED: npm, stripe-node CHANGELOG] |
| `@stripe/stripe-js` | **9.17.0** | `loadStripe` (loads `js.stripe.com/dahlia/stripe.js`) | Same API family as stripe 22.x [VERIFIED: tarball] |
| `@stripe/react-stripe-js` | **6.12.0** | `./checkout`: `CheckoutElementsProvider`, `PaymentElement`, `CurrencySelectorElement`, `useCheckoutElements` | Exports verified in the 6.12.0 tarball; peer React ≥16.8 <20 fits React 18.3 |
| `resend` | 6.29.0 (already pinned in `package.json`) | email | existing |
| `@supabase/supabase-js` / `@supabase/ssr` | 2.117.2 / 0.12.7 (existing) | RPC, session | existing |

Alternative: the newest majors (`stripe@23.0.0`, `stripe-js@10.0.0`, `react-stripe-js@7.0.0`, all published
2026-10-01). Take them only if a needed field is missing in 22.x; then pin all three together.

Install (after the controller's OK on `package.json`): `npm install --save-exact stripe@22.6.2 @stripe/stripe-js@9.17.0 @stripe/react-stripe-js@6.12.0`

## Package Legitimacy Audit

slopcheck could not run here (it shells out to `pip`, which is missing on this Mac: `FileNotFoundError: 'pip'`).
The packages are named in Stripe's own docs and published from the `stripe` GitHub org. By the protocol they are
still tagged [ASSUMED] for legitimacy, and the planner gates the install behind one `checkpoint:human-verify`.

| Package | Registry | Age | Source repo | slopcheck | Disposition |
|---|---|---|---|---|---|
| stripe | npm | 10+ yrs | github.com/stripe/stripe-node | unavailable | Approved pending checkpoint (no postinstall script) |
| @stripe/stripe-js | npm | 5+ yrs | github.com/stripe/stripe-js | unavailable | Approved pending checkpoint (no postinstall) |
| @stripe/react-stripe-js | npm | 5+ yrs | github.com/stripe/react-stripe-js | unavailable | Approved pending checkpoint (no postinstall) |

Removed: none. Flagged suspicious: none.

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| PaymentIntents + Payment Element as the default | Checkout Sessions + Elements is Stripe's default recommendation | stripe-node 21.x/22.x era (`ui_mode: elements`) | Local-currency display only on this path |
| `ui_mode: "custom"`, `initCheckout`, `CheckoutProvider` | `ui_mode: "elements"`, `initCheckoutElementsSdk`, `CheckoutElementsProvider` | 2026 (dahlia) | Use the new names; old snippets online will mislead |
| Apple Pay `.well-known` file hosting | Payment method domain registration only; Stripe does merchant validation | current docs | No static-asset work in job 10 |
| `.planning/research/ARCHITECTURE.md:122-128` (PaymentIntent + Link + FX lock) | Superseded by B-03/B-07/B-15 | 2026-10-04 discuss | Planner ignores those lines |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | His UAE account can enable Adaptive Pricing | Q1 | Guest sees AED only; B-03 fallback applies; no code change |
| A2 | `presentment_details` is populated on the PaymentIntent/Charge for Checkout Elements payments, and session/PI `amount` stays AED | Q1, schema | Store the wrong currency; verify on the first TEST payment |
| A3 | Arabic labels render in Checkout Elements | Q1 | English labels in an RTL page; needs his OK |
| A4 | Workers static assets serve `public/.well-known` if ever needed | Q2 | Only matters if Stripe asks for the file |
| A5 | Retrieving a Checkout Session returns its `client_secret` for reuse after refresh | Q3/Q6 | Else store an encrypted copy, or expire and recreate |
| A6 | Half-up rounding to the fils on VAT is acceptable for UAE VAT | Q5 | His accountant may want a different rule; one function changes |
| A7 | Deposit not offered when arrival is within balance due days | Q4 | Pricing/policy decision; ask him |
| A8 | OpenNext request overhead fits 10 ms CPU | Q3 | Error 1102; Workers Paid upgrade (his call) |

## Open Questions

1. **How does the owner reach `/dashboard` in v1?** It is held, and the ops host is not on the Worker (02-23).
   The controller must pick: open `dashboard.almarprivatejourney.com` on Worker `almar` (DNS and route: owner
   gate), or serve the ops screens on the marketing host behind `requireOwner`. This blocks ops UAT.
   **RESOLVED (2026-10-05):** B-22 / C-20 / O-09 — `dashboard.almarprivatejourney.com` on a second Worker `almar-ops`
   (03.2-03); checkout APIs and the webhook stay on `almar`.
2. **Adaptive Pricing on his account:** one read-only look at `dashboard.stripe.com/settings/adaptive-pricing`
   in TEST. Also: is he fine with guests paying Stripe's 2–4 % FX markup when they accept local currency?
   **RESOLVED (2026-10-05):** B-20 — Adaptive Pricing on where offered; the guest pays Stripe's conversion fee only if
   they switch. Whether his account offers it is checked in 04-04's owner step 4 and 04-07 (A1).
3. **Balance due days N, and a late booking** (arrival sooner than N days): full payment only? Pricing/policy
   question for him (A7).
   **RESOLVED for the late booking (2026-10-05):** B-21 — full payment only in v1. N itself is still his value, owed by
   Oct 9 (04-07 step a).
4. **Resend domain status** for `inquiries@almarprivatejourney.com` (shared with job 02). **Still open:** an owner
   step (job 02's gate; 04-05 owner step 2).
5. **Webhook endpoint per host:** preview (`https://preview.almarprivatejourney.com/api/stripe/webhook`, TEST)
   and production get separate `whsec_` values. Owner steps. **RESOLVED as owner steps:** 04-04 owner step 3 (preview,
   TEST); production at the live switch.
6. **3.2 schema names** for rates, ranges, blocks, add-on prices and stay access: Phase 4's RPCs join them. The
   planner sequences the 3.2 migration first or agrees the names in both plans. **RESOLVED (2026-10-05):**
   `03.2-API-CONTRACT.md` is the source of names; 04-02 runs after 03.2-01 and uses `stay_night_rates` /
   `stay_ops_blocked_days`.

## Environment Availability

| Dependency | Needed for | Available | Version | Fallback |
|---|---|---|---|---|
| Node | build, tests | yes | 26.7.0 (repo needs ≥22.18) | — |
| Stripe CLI | `stripe listen`, `trigger`, signed test events | yes | 1.50.10 | `generateTestHeaderString` in node tests |
| Supabase CLI | local DB for RPC tests | yes | 2.119.0 | — |
| Docker | `supabase start` | binary yes (29.7.2), daemon not confirmed | — | start Docker Desktop (his click) |
| psql | ad-hoc SQL | no | — | `supabase db` / node `pg` via tests |
| wrangler | `wrangler dev` raw-body proof | yes (repo pins 4.141) | 4.124 global | `./node_modules/.bin/wrangler` |
| Stripe TEST keys, webhook secrets, domain registration | everything paid | owner gate | — | none |

## Validation Architecture

| Property | Value |
|---|---|
| Framework | `node --test` (pure modules, `.ts` loaded directly) + Playwright (dev config, `--workers=4`) + build config spec under `wrangler dev` |
| Quick run | `node --test tests/booking-*.test.mjs tests/stripe-*.test.mjs` |
| Full suite | hand-over check set (00-common-rules) |

| Req | Behaviour | Type | Command | Exists |
|---|---|---|---|---|
| PAY-01/02, B-06 | price module cases 1–11 | unit | `node --test tests/booking-price.test.mjs` | Wave 0 |
| PAY-14 | ref format, alphabet, uniqueness retry | unit + SQL | `node --test tests/booking-ref.test.mjs` | Wave 0 |
| STAY-01..04, BOOK-03 | `place_hold`: race (two parallel holds, one wins), sweep, blocks, re-claim | integration (local Supabase) | `node --test tests/booking-hold.db.test.mjs` | Wave 0 |
| PAY-09 | webhook: bad signature 400; duplicate event no-op; completed → paid; expired → released; refunded/dispute rows | unit (signed with `generateTestHeaderString`) | `node --test tests/stripe-webhook.test.mjs` | Wave 0 |
| PAY-09 | raw body survives Worker, two POSTs in a row | build spec | `npx playwright test -c playwright.build.config.ts tests/build/stripe-webhook.spec.ts` | Wave 0 |
| AUTH-01, B-16 | link token sign/verify/version; session-email match; address only when confirmed | unit | `node --test tests/booking-link.test.mjs` | Wave 0 |
| B-14, B-18 | email renders EN/AR(RTL)/ES; owner email | unit | `node --test tests/booking-email.test.mjs` | Wave 0 |
| O-07 | `/api/ops/*` refuse non-owner (401/403) | unit | `node --test tests/ops-bookings.test.mjs` | Wave 0 |
| server paths | `/booking` unheld; new `/api/*` listed; no dynamic segment | unit | `node --test tests/server-runtime.test.mjs` | exists (job 10), update |
| BOOK-02, PAY-06 | flow to Pay, Element mounts, test card 4242 and a 3DS card, booking page shows paid | e2e (TEST keys, preview) | manual UAT + Playwright with Stripe test keys | manual (secrets) |

Sampling: quick run per task; full set per wave; full set + TEST payment UAT before `/gsd-verify-work`.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V2 Authentication | yes (guest session, owner) | job 02 `getUser`; `requireOwner()` on every `/api/ops/*` |
| V3 Session | yes | job 02 cookies; the booking link token is a capability with `link_version` revocation |
| V4 Access control | yes | RLS on with everything revoked; service role only after a token, email or owner check; access data only when Confirmed |
| V5 Input validation | yes | hand-written validators in pure modules (repo has no zod); server re-quotes; ids are uuid or ref regex; reject unknown keys |
| V6 Cryptography | yes | WebCrypto HMAC-SHA256, constant-time compare; Stripe signature via SDK |
| V9/V10 Communications / malicious code | yes | webhook signature + 5-min tolerance; no secret in the bundle (runtime publishable key) |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Client-tampered amount | Tampering | server computes amount from DB; Stripe amount from snapshot only |
| Forged webhook | Spoofing | `constructEventAsync`; 400 on failure |
| Replayed webhook / duplicate fulfil | Repudiation/Tampering | `stripe_events` PK, idempotent RPC, tolerance |
| Hold spamming (blocking a stay's dates) | DoS | 30-min expiry; rate limit `/api/booking/hold` per IP and email (reuse 02-23's `claim_link_slot` pattern); one open held booking per email per stay |
| Booking enumeration via ref | Info disclosure | ref alone grants nothing; token or session required |
| Token leak via Referer | Info disclosure | `Referrer-Policy: no-referrer` on `/bookings/trip` |
| Double charge (two tabs) | Tampering | one open session per booking (partial unique index), expire before create |
| Email header injection | Tampering | `escapeHtml`; Resend fields set by code, never raw input |

## Sources

### Primary (HIGH)
- https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md?payment-ui=embedded-components — PaymentIntents unsupported; Elements + Checkout Sessions; testing; restrictions; fees; refunds
- https://support.stripe.com/questions/adaptive-pricing — integrations, settlement in integration currency
- https://docs.stripe.com/payments/quickstart-checkout-sessions — `ui_mode: "elements"`, `CheckoutElementsProvider`, sample versions
- https://docs.stripe.com/api/checkout/sessions/create — `ui_mode`, `expires_at` 30 min–24 h, `locale` enum, elements-mode limits
- https://docs.stripe.com/js/custom_checkout/create_payment_element — `wallets.applePay/googlePay/link`
- https://docs.stripe.com/js/custom_checkout/confirm — `redirect: "if_required"`, must display total
- https://docs.stripe.com/js/custom_checkout/init — `adaptivePricing.allowed`, `elementsOptions`
- https://docs.stripe.com/js/appendix/supported_locales — `ar` Elements yes, Checkout no
- https://docs.stripe.com/api/payment_intents/object?query=presentment_details
- https://docs.stripe.com/api/checkout/sessions/expire
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/webhooks — duplicates, ordering, retries, raw body, tolerance
- https://docs.stripe.com/checkout/fulfillment.md?payment-ui=embedded-page — idempotent fulfil, events
- https://docs.stripe.com/payments/payment-methods/pmd-registration.md?dashboard-or-api=api ; https://docs.stripe.com/apple-pay?platform=web
- https://support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae — methods, 2.00 AED minimum
- https://developers.cloudflare.com/workers/platform/limits/ — 10 ms CPU, I/O not counted, 50 subrequests
- https://resend.com/docs/dashboard/emails/idempotency-keys
- stripe-node repo (CHANGELOG, `package.json` exports, `SubtleCryptoProvider.ts`, `WebPlatformFunctions.ts`, `examples/webhook-signing`); npm registry versions (2026-10-04)
- Repo: `lib/server-routes.ts`, `worker/handle.mjs`, `wrangler.toml`, `scripts/assemble-cloudflare.mjs`, `scripts/crawl-files.mjs`, `HANDOVER-job-10.md` (job 10); `platform_spine.sql`, `lib/supabase/clients.ts`, `lib/auth/*`, `lib/email/magic-link.ts`, `middleware.ts`, `02-23-PLAN.md` (job 02); `lib/data/types.ts`, `booking.tsx`, `lib/journey-choice.ts` (job 11); `components/journey/*`, `lib/copy/journey.ts` (this branch)

### Tertiary (LOW)
- https://github.com/gackvictor7-alt/Inner-Circle/pull/40 — fetch client fixes a checkout hang on Workers (third-party)

## Metadata

- Standard stack: HIGH (official docs + tarball check). Architecture: HIGH for Stripe, MEDIUM for the Workers runtime (unmeasured). Pitfalls: MEDIUM-HIGH.
- Valid until 2026-10-18 (Stripe ships monthly API versions; re-check `ui_mode` and Adaptive Pricing pages at plan time if later).
