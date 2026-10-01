# PITFALLS — ALMAR Booking OS

**Dimension:** traps that kill a luxury booking rebuild  
**Date:** 2026-09-22  
**Scope:** Multi-currency Stripe (AED/USD/EUR), auth holds vs capture, 30-minute inventory hold, RTL luxury UI, Next on Cloudflare, no saved cards, passport PII, auto-translate EN→AR/ES, live FX, VAT-then-deposit %, Framer HTML trap.

This is a rebuild, not string-patches on the Framer export. The traps below are the ones that ship a beautiful brochure that cannot take a correct deposit, overbooks a stay, leaks card or passport data, or looks broken in Arabic.

## Pitfall table

| Pitfall | Severity | Why Happens | How to Avoid |
|---|---|---|---|
| Patching Framer HTML as the product | Critical | Home `app/route.ts` is ~672kB of exported HTML strings. No tokens, components, or CMS. Regex on those files breaks the build and cannot host booking, auth, or a dashboard. | Treat current routes as visual reference + interim portfolio. Rebuild UI from the token/component system. Do not concatenate user input into `HTML`. |
| Charging (or authorizing) before the pay step | Critical | Hero search and stay-pick feel like “booking.” Teams place a Stripe hold at search. Product rule: hero never charges; first charge is Deposit or Pay in full. | No PaymentIntent until the pay step. Inventory hold ≠ card hold. |
| Mixing the 30-min inventory hold with the Stripe auth hold | Critical | Unpaid drafts hold the calendar 30 minutes (FOMO). Card authorization is a separate Stripe object with a **7-day** default (longer only with extended authorization). One timer is used for both. | Two clocks: (1) DB hold `expires_at = now+30m` on unpaid draft; (2) Stripe `capture_method: manual` only at pay, only for captured deposit/full **or** the separate damage hold.[7][11] |
| Default 7-day auth expiry on a trip booked months out | Critical | Online card authorizations are typically valid **7 days**; uncaptured funds then drop off.[7] A damage hold at checkout for a stay next season will vanish. Extended authorization can reach **~30 days** (Visa: 29 days 18 hours) for eligible networks/MCCs (hotel/lodging included on Visa/Discover/Amex lodging), requested via `request_extended_authorization`, and Stripe documents it as an **IC+** feature — blended pricing may not have it.[11] Not available when Link is the payment method type (`payment_method.type = link`).[11] | Do not rely on a checkout-time hold covering the stay. For deposit/full: capture promptly after success. For damage: product is “auth hold, ops release/capture only.” If arrival is >7 days out, either request extended auth and **read `capture_before`** (do not assume 30), or take the damage hold closer to arrival. Amex lodging: capture by end of stay even if the window is 30 days.[7][11] |
| Capturing the damage hold with the deposit | Critical | One PaymentIntent, one `amount`. Capturing it takes the damage money too (or you never authorized damage separately). | Two PaymentIntents: (A) deposit/full, capture immediately on success; (B) damage, `capture_method: manual`, never auto-captured. Ops capture/release B only. Show damage as “temporarily held,” not in grand total.[7][18] |
| Fulfilling on `confirmPayment` in the browser | Critical | Customer closes the tab after 3DS. Client `succeeded` is not fulfillment. Stripe: do not fulfill on the client; use `payment_intent.succeeded` / `amount_capturable_updated` webhooks.[18][9] | Webhook is source of truth. Booking → Deposit paid / Confirmed only after verified event. Refresh of pay page retrieves the same PI; it must not create a new charge.[18][15] |
| Skipping webhook signature + idempotency | Critical | Replay, duplicate `payment_intent.succeeded`, or a forged POST marks a draft paid. Stripe retries and can deliver the same event more than once; handlers must be idempotent.[9] Duplicate events are expected.[9] | `constructEvent` with the raw body + `Stripe-Signature`.[9] Store `event.id`. Idempotency keys on create/capture/refund.[15] Return 2xx fast; do heavy work after. |
| Treating `requires_action` as paid | Critical | 3DS / bank challenge. `confirmPayment` does not resolve until that step completes or times out.[18][10] Dashboard maps this to Incomplete.[18] | UI: “authenticate with your bank.” Status stays Draft until `succeeded` (capture) or `requires_capture` (hold).[18] Never email confirmation from the client. |
| Presentment currency ≠ PI currency; mutating `currency` | Critical | Guest switches AED→USD after Elements mounted. PaymentIntent `currency` is set at create. Localize-prices path is: compute amount → create PI in **that** currency (optionally with `fx_quote`).[17][8] | Currency switch before pay: cancel unused PI, create a new one. Never `update` currency. Lock display currency for the 30-min hold. |
| Minor-unit / decimal bugs (AED, USD, EUR) | Critical | Stripe `amount` is in the currency’s minor unit. AED, USD, EUR are two-decimal, **not** zero-decimal.[6] FX math that sends `1050` instead of `105000` fils/cents undercharges 100×. | Always: FX result → round per currency → `× 10^exponent` → integer `amount`.[6][17] Test 1050.00 AED → `105000`. Never send floats to Stripe. |
| Live FX displayed, different rate charged | High | Product: live FX, cache, lock for 30-min hold; FX fail → last cache. Stripe FX Quotes lock `five_minutes`, `hour`, or `day`. **UAE payment locks are `five_minutes` and `hour` only — not `day`.**[17] A 5-minute quote dies during a 30-minute hold. Quotes also expire if the market moves past a 3.5% threshold.[17] | Prefer `lock_duration=hour` for the pay-step hold (UAE-supported).[17] Persist quote id + `lock_expires_at` on the draft. On `fx_quote.expired` / `payment_intent_fx_quote_invalid`, new quote + new PI, never silently reprice after the guest confirmed.[17] Fallback: last good cache, labeled. New booking = new FX. |
| Passing vs eating Stripe FX fees | High | `exchange_rate` includes Stripe FX fee; `base_rate` does not.[17] Guessing mid-market (Frankfurter etc.) then charging through Stripe yields a different settlement. | Quote from Stripe when the PI is created.[17][16] Analytics stay in AED; presentment is guest currency; settlement follows the Stripe account.[12] |
| VAT after deposit % (tax twice or base without VAT) | Critical | Product: VAT % in Settings; example 1000 + 5% = 1050; deposit 30% **of 1050**; remainder is the rest of 1050. UAE standard VAT is **5%** (from 1 Jan 2018).[29] Applying 30% to 1000 then VAT on the deposit (or VAT again on remainder) double-taxes or under-taxes. | Order is fixed: nights + add-ons − coupon → subtotal → **VAT** → grand total → deposit% of grand total. Coupon cannot go below 0. Remainder = grand − captured. VAT is not applied twice. Ops can change deposit % only until first payment. |
| Settlement currency mixed into guest receipts | High | Presentment (what the cardholder sees) and settlement (what lands in the Stripe balance) are different knobs.[12][6] Receipts in AED when the charge was USD destroy trust. | Charge in the **selected** presentment currency.[6][12] Email/PDF/receipt = that currency. Ops analytics convert to AED at the locked rate. |
| Saved cards in our app (PCI + product ban) | Critical | `setup_future_usage`, Customer payment-method attach, or a “card on file” table. PCI DSS applies to anyone who stores, processes, or transmits cardholder data.[19][32] Stripe Elements/Checkout keep PAN on Stripe’s PCI-validated fields; touching PAN yourself jumps SAQ scope (often SAQ D).[19] | No PAN, CVC, or full card in logs, DB, or support tools. Payment Element only.[4][19] Ops sees last 4 only. **No saved cards in our app.** Do not call save-and-reuse for guests.[13] Link is Stripe-hosted wallet, not our vault — allowed at checkout, never copied into Supabase.[5] |
| Custom card `<input>` “for luxury branding” | Critical | Designers reject iframe/Element chrome. Raw PAN on our origin. | Payment Element Appearance API for luxury styling.[4] Never a self-hosted PAN field.[19] TEST keys until a dedicated go-live plan. |
| Inventory check-then-book race | Critical | Two guests, one stay, overlapping nights. Read available → both pay → both Confirmed. Classic hotel TOCTOU; uniqueness on occupancy rows or `SELECT FOR UPDATE` is the fix, not “check then insert.”[25][26] | Atomic allocate: unique constraint (stay_id, night) or equivalent exclusion; insert hold in the same transaction as the availability read.[25][26] Deposit-paid and Confirmed block the calendar; unpaid draft holds 30 min; expiry job deletes draft and frees nights. Overlap is a hard error, never a warning. |
| Hold expiry job on the Next.js request path | High | No worker/cron. Holds expire only when someone loads `/booking`. Cloudflare Workers CPU/duration and subrequest limits also kill long in-request loops.[20] | Scheduled expiry (Workers Cron or equivalent), idempotent, indexed on `expires_at`. Preview in the Workers runtime, not only `next dev`.[1][2] |
| OpenNext as if it were Vercel | High | Cloudflare **recommends vinext for new Next.js apps** and documents OpenNext as the path to **maintain** existing OpenNext apps.[2] Node.js in Middleware (Next 15.2+) is **not yet supported** on the OpenNext adapter.[2] `nodejs_compat` and a compatibility date ≥ 2024-09-23 are required.[2] Image optimization goes through Cloudflare Images, not Vercel’s optimizer.[1][2] | Do not `vercel deploy`. No `@cloudflare/next-on-pages` as the future (legacy). Set Workers Build env for `NEXT_PUBLIC_*` **and** server secrets used at `next build`.[2] Verify route handlers, webhooks, and Server Actions on `opennextjs-cloudflare preview`. Watch CPU/subrequest limits.[20] |
| `dir` only in CSS; physical `left`/`right` | High | Arabic is a first-class locale (same URLs, no `/ar` prefix). `dir` on a wrapper, `margin-left`, `text-align: right`, and flipped logos produce a “RTL skin” that still reads LTR in the browser’s bidi algorithm.[21][24] | `dir="rtl"` on `<html>` for AR (W3C: the `html` element, so CSS and form controls inherit).[21] CSS **logical** properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`, `text-align: start`).[23][24] Nested `dir="ltr"` for booking refs, emails, URLs.[21][22] Western numerals (product). Do not mirror the wordmark, 5-star glyphs, or media play icons.[23] Password eye stays on the **inline-end** (product: right-side in LTR). |
| Payment Element / Apple Pay ignoring `dir` | High | Elements iframe does not inherit your Tailwind `rtl:` variants. | Set Appearance API + document `dir` before mount; remount on language change.[4] Test Apple Pay / Link in AR. |
| Auto-translate EN→AR/ES as publish | High | Ops types English; Publish MT to AR/ES; lockable; re-translate on EN change unless locked. Luxury copy + legal + RTL punctuation break. Same-URL i18n without prefixes is the routing model (`next-intl` without locale segments).[3] | Human review queue for AR/ES before public. Locks persist across EN edits. Never MT passport labels, legal, or prices. Re-run bidi checks after MT.[21] SEO fields from English, then translated — required to publish. |
| Passport / ID in the same Postgres as bookings | Critical | Optional passport/ID, encrypted, owner opens with extra confirm. Passport numbers are personal data. EU “sensitive” special categories are racial origin, political opinions, religion, trade union, genetic, biometric, health, sex life/orientation — not the ID number itself — but biometric **scans** of passports can be.[30] UAE PDPL (Federal Decree-Law No. 45 of 2021) still requires lawful, secure processing of personal data.[28][31] GDPR Art. 32: appropriate security (encryption, access control).[27] | Encrypt at rest (column encryption / Vault), never in client logs or email. Owner reveal = re-auth + audit row. Guest delete strips PII; bookings remain for ops. No passport images in R2 without the same lock. Do not treat “optional” as “unprotected.” |
| Account deletion that erases financial history | High | GDPR-style erasure vs UAE/ops need to keep booking money trail. | Strip PII; keep booking id, amounts, Stripe ids, dates. Document the split in privacy CMS. |
| Refunds from the dashboard “amount” field | High | Ops types 1050 when 31500 fils were captured, or refunds more than captured. Stripe refunds cannot exceed captured (and uncaptured is cancel, not refund).[14] Product: refunds never automatic; original payment only. | Refund API in captured minor units, cap at captured − already refunded.[14] No auto-refund on cancel or chargeback. Remainder unpaid → cancel, **deposit kept**. |
| Stripe hosted Checkout “just for v1” | High | Faster than Payment Element. Product forbids hosted page; custom branded checkout only.[4] | Payment Element on `/booking/trip` pay step. No Checkout Session redirect. |
| Coupon then VAT then deposit, applied twice | High | Client applies coupon; server applies again; deposit computed on pre-coupon. | Server is source of truth. One coupon per checkout. Breakdown order: nights, add-ons, coupon, subtotal, VAT, grand, deposit/full. Damage hold separate. |
| Language/currency in the path or a cookie-only default that ignores header toggle | Medium | `/ar/booking` vs product: same URLs all languages; default EN; toggle remembered. | Locale + currency in cookie/header, not prefix.[3] AR sets `dir=rtl` without changing the path. |
| Cache-bust / CDN headers from the Framer export | Medium | `vercel.json` `s-maxage=30` vs route `s-maxage=31536000`. Stale legal/price pages. | One cache policy on Cloudflare. Verify live with cache-bust after deploy. |
| Vercel/Netlify README + Dockerfile lockfile skip | Medium | Exporter leftovers. Wrong host, non-reproducible image. | Ignore PLAN_FIX_ALL / `vercel --prod`. Cloudflare project `almar`, owner-gated DNS. |

## Warning signs

- A PR edits `app/route.ts` (or any Framer HTML string) to “add checkout.”
- PaymentIntent created on Search or stay overlay; or one PI amount includes damage + deposit.
- `capture_method` missing (defaults to automatic) on a hold that ops is supposed to release.[7]
- Guest FX widget uses a public mid-market API while Stripe charges a different rate, with no `fx_quote` on the PI.[17]
- Deposit % of nightly subtotal, VAT line added after, or VAT on remainder.
- `setup_future_usage` or `customers.payment_methods` in app code despite “no saved cards.”[13]
- Webhook route parses `req.json()` then verifies the signature (body already consumed) — signature will fail or be skipped.[9]
- Booking status flips to Confirmed in the `confirmPayment` callback.[18]
- Availability `SELECT` in one request, `INSERT` booking in another, no unique night occupancy.[25]
- Arabic stylesheet with `margin-left` / `float: right` and `<html>` without `dir`.[21][24]
- `dir="rtl"` on `<body>` only; title/form controls stay LTR.[21]
- Passport number in `bookings` plaintext or in Resend debug.
- `next dev` is the only test; webhook and ISR never run under `opennextjs-cloudflare preview`.[2]
- OpenNext chosen for a **new** app without reading Cloudflare’s vinext recommendation.[2]
- Refund button enabled on an uncaptured damage PI (should be cancel/release).[14][7]
- 3DS test cards never used; only `4242` in TEST.[10]
- Legal URLs still 404 while checkout requires “accept booking terms.”

## Mitigation checklist

**Rebuild, don’t patch**

- [ ] New App Router tree + design-system components; Framer routes stay portfolio until cutover.
- [ ] No user text interpolated into exported HTML strings.

**Money — order of operations**

- [ ] Server quote: nights + add-ons − coupon → subtotal → VAT% → grand total.
- [ ] Deposit = Settings % × grand total (example: 1000 + 5% VAT = 1050; 30% = 315). UAE VAT reference rate is 5%.[29]
- [ ] Pay in full = grand total; no remainder reminders.
- [ ] Damage hold listed separately, not in grand total.
- [ ] Coupon: one, server-side, ≥ 0 floor.

**Stripe — presentment AED/USD/EUR**

- [ ] Charge in guest-selected currency (default AED).[6]
- [ ] Amounts integer minor units; AED/USD/EUR exponent 2.[6]
- [ ] Currency switch = new PaymentIntent; Elements remount.[8]
- [ ] FX: lock ≥ hold window. On UAE Stripe accounts, payment quote locks are 5 minutes or 1 hour (not 24h).[17]
- [ ] Persist locked rate + quote id on the draft; expire with the 30-min hold.
- [ ] FX outage → last cache, visible; never fail open to a guessed rate.

**Stripe — capture vs hold**

- [ ] Deposit/full: confirm and **capture** (or automatic capture). Do not leave the trip deposit uncaptured for 7 days.[7]
- [ ] Damage: second PI, `capture_method: manual`; ops capture or cancel only.[7]
- [ ] Extended authorization only if product must hold >7 days, account is on IC+, MCC/network qualifies, and `capture_before` is stored — still ≤ ~30 days, not “until check-in next season.”[11]
- [ ] Cancel PI to release a hold; do not “refund 0.”[7][14]

**Stripe — PCI, Link, 3DS, webhooks**

- [ ] Payment Element + Apple Pay + Link; no hosted Checkout; no raw PAN.[4][5][19]
- [ ] Link stays on Stripe (not copied to Supabase). Extended auth is unavailable if Link is `payment_method.type = link`.[5][11]
- [ ] No `setup_future_usage` / saved cards in our DB.[13]
- [ ] 3DS when the bank requires; handle `requires_action`.[10][18]
- [ ] Idempotency key per pay attempt (`booking_id + amount + currency + attempt`).[15]
- [ ] Webhook: raw body, signature, `event.id` uniqueness, 2xx then process.[9]
- [ ] Status transitions only from webhook / admin retrieval of PI, not from the browser.[18]
- [ ] Refresh on success page = retrieve PI, never create another.
- [ ] Refunds: captured minor units only, ≤ captured, original charge, ops-initiated.[14]

**Inventory — 30 minutes**

- [ ] Draft hold writes occupancy rows in one transaction with a unique night key.[25][26]
- [ ] `expires_at` 30:00; scheduled job releases; pay success upgrades hold → booked.
- [ ] Sold-out / over-occupancy / min nights return a **reason**, not a silent hide.
- [ ] Deposit-paid and Confirmed block calendar; ops maintenance blocks too.

**Cloudflare / Next**

- [ ] Host Workers/Pages project `almar`; no Vercel.
- [ ] `nodejs_compat`; preview with OpenNext (or vinext if that is the chosen new-app path).[2][1]
- [ ] Webhook and cron routes tested in the Workers runtime; stay inside platform limits.[20]
- [ ] Media: R2/Images HTTPS URLs, never Supabase Storage.
- [ ] Build secrets present in Workers Builds (not only `.env.local`).[2]

**RTL + luxury UI**

- [ ] `<html dir>` flips with language; no path prefix.[21][3]
- [ ] Logical CSS only for spacing/alignment; audit physical `left`/`right`.[23][24]
- [ ] Mixed LTR islands (`ALMAR-XXXXXX`, emails) marked `dir="ltr"`.[22]
- [ ] Western numerals; do not mirror brand mark.
- [ ] `/design` includes AR RTL for every component state (hover, focus, error, disabled).
- [ ] Payment Element remounts on `dir` change.[4]

**PII**

- [ ] Passport/ID encrypted; owner open = extra confirm + audit.[27][28]
- [ ] No passport in emails, logs, or analytics.
- [ ] Guest delete: strip PII, keep booking/money rows.
- [ ] Privacy/terms/booking-terms CMS live **before** checkout accept.

**Translate**

- [ ] EN source of truth; AR/ES generated on Publish; per-field lock.
- [ ] Locked strings do not get overwritten on EN edit.
- [ ] Human pass on AR luxury + legal; bidi re-check after MT.[21]

**Go-live**

- [ ] TEST Stripe until a written go-live plan.
- [ ] 3DS, FX switch, hold expiry, double-submit, webhook retry, AR checkout — all scripted before live keys.

## Sources

[1] https://opennext.js.org/cloudflare
[2] https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext
[3] https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
[4] https://docs.stripe.com/payments/payment-element
[5] https://docs.stripe.com/payments/link
[6] https://docs.stripe.com/currencies
[7] https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
[8] https://docs.stripe.com/payments/payment-intents
[9] https://docs.stripe.com/webhooks
[10] https://docs.stripe.com/payments/3d-secure
[11] https://docs.stripe.com/payments/extended-authorization?platform=web&ui=elements
[12] https://docs.stripe.com/payments/currencies/settlement-payouts
[13] https://docs.stripe.com/payments/save-and-reuse
[14] https://docs.stripe.com/refunds
[15] https://docs.stripe.com/api/idempotent_requests
[16] https://docs.stripe.com/payments/currencies/localize-prices
[17] https://docs.stripe.com/payments/currencies/localize-prices/fx-quotes-api
[18] https://docs.stripe.com/payments/payment-intents/verifying-status
[19] https://stripe.com/guides/pci-compliance
[20] https://developers.cloudflare.com/workers/platform/limits
[21] https://www.w3.org/International/questions/qa-html-dir
[22] https://www.w3.org/International/articles/inline-bidi-markup
[23] https://simplelocalize.io/blog/posts/rtl-design-guide-developers
[24] https://moayyadfaris.com/blog/most-common-rtl-html-css-mistakes
[25] https://amitavroy.com/articles/race-conditions-in-hotel-booking-systems-why-your-technology-choice-matters-more-than-you-think
[26] https://stackoverflow.com/questions/12832570/how-to-prevent-race-condition-in-online-hotel-booking
[27] https://gdpr-info.eu/art-32-gdpr
[28] https://u.ae/en/about-the-uae/digital-uae/data-protection-laws
[29] https://mof.gov.ae/en/public-finance/tax/value-added-tax-vat
[30] https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/sensitive-data/what-personal-data-considered-sensitive_en
[31] https://ai.gov.ae/personal-data-protection-law
[32] https://www.pcisecuritystandards.org/pci_security
