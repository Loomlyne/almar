# v1 backend — the plans on one page (job 12)

For the owner's signature: one per phase. From his answers of 2026-10-04 22:10 – 2026-10-05 00:20 (+04)
(`04-book-and-pay/V1-BACKEND-DISCUSSION-LOG.md`, 27 answers). Decisions: `03.2-…/03.2-CONTEXT.md`,
`04-book-and-pay/04-CONTEXT.md`, `05-ops-os/05-CONTEXT.md`. Every plan was checked by an Opus plan checker, fixed,
and re-checked. Build starts Oct 7, after job 02 (sign-in) lands; executors Sonnet, an Opus reviewer after every
money, sign-in or database change.

## Phase 3.2 — catalogue and team (14 plans for v1; 03.2-14 is a v1.1 list)

| Ship | Wave | Plan | What it delivers |
|---|---|---|---|
| 3.2a (target Oct 9) | 1 | 01 | Database for the catalogue (migration `20261005100000`), owner check, import of today's content (controller runs it) |
| 3.2a | 1 | 03 | Second Worker `almar-ops` for `dashboard.almarprivatejourney.com`; CPU measured right after |
| 3.2a | 1 | 11 | Shared dashboard editor kit (EN/AR/ES tabs, side panel, publish bar) — needed by 05 |
| 3.2a | 2 | 02 | Public pages read the database at build; built site byte-identical to today |
| 3.2a | 2 | 04 | Owner-only dashboard API (save, publish, unpublish; publish needs all three languages) |
| 3.2a | 3 | 05 | Publish rebuilds the public site from branch `live`; "Up to date / Updating / Update failed" line |
| 3.2b | 1 | 12 | Pages, Blog, Legal, Navigation shown as "Coming soon"; test harness out of the live build |
| 3.2b | 3 | 09 | Photos: pick from the library or upload to R2, alt text in three languages |
| 3.2b | 3 | 10 | Translate button (Workers AI), model chosen by a check on 3 real ALMAR texts you see first |
| 3.2b | 4 | 06 | Destinations; Experiences and services (incl. "UAE-side" and "Home pickup · starts added") |
| 3.2b | 4 | 07 | Stays: details, pets, infants, min nights, photos, connections |
| 3.2b | 4 | 15 | Stay tabs: Rates (base + date ranges), Availability, Access (address, wifi, door) |
| 3.2b | 4 | 08 | Team; Packages = the three home journeys (name, price line, text, photo, show/hide) |
| 3.2b | 4 | 13 | Calendar: block dates for one stay, one destination or everything |
| — | — | 14 | v1.1 only: three 3.1 leftovers (phone font sizes into tokens, logo in Arabic, field labels). Your 2026-10-02 assignment of them to 3.2 moves to v1.1; the Settings colours item is gone because ops rewrites Settings |

## Phase 4 — book and pay (7 plans)

| Wave | Plan | What it delivers |
|---|---|---|
| 1 | 04-01 | Money engine: nights, add-ons, VAT on subtotal, deposit of grand total, balance, full-only when arrival is within the due days |
| 2 | 04-02 | Bookings database (migration `20261005110000`), 30-minute hold, live quote with reasons, release |
| 3 | 04-03 | "Book" on the stay page → `/booking/trip`: Add-ons → Travellers → Pay (pictures first) |
| 3 | 04-04 | Stripe TEST: Payment Element on our page, AED, local currency where Stripe offers it, card + Apple Pay, webhook |
| 4 | 04-05 | Branded emails (guest in their language, you at inquiries@), booking page, Pay balance |
| 4 | 04-06 | Payment form on the trip page, resume after refresh, signed-in guest's `/bookings` list |
| 5 | 04-07 | Your numbered TEST UAT on `preview.almarprivatejourney.com` |

## Minimal ops (2 plans)

| Wave | Plan | What it delivers |
|---|---|---|
| 5 | 05-01 | Settings (VAT %, deposit %, balance due days); bookings list; booking detail; Confirm / Completed / Cancel; Resend email (own migration `20261005120000`) |
| 6 | 05-02 | New booking by hand, holding nights until your date, pay link emailed to the guest |

## Side by side

3.2a and 04-01 start together; 04-02 starts once 3.2-01 is merged; 3.2b screens and 04-03/04-04 run in
parallel; ops runs after 04-05/04-06. Shared files (controller grants each slot; edits additive):
`lib/server-routes.ts`, both `wrangler*.toml`, `tests/server-runtime*`, `lib/ops-routes.ts`, `lib/copy/*.ts`,
`lib/locale-path.ts`, `package.json` (Stripe), `components/ops/api-types.ts`, `03.2-API-CONTRACT.md`.

## Your steps (one at a time, when the plan reaches them)

1. Supabase keys on both Workers and in `.env.local` (job 02's list).
2. Create Worker `almar-ops`, attach `dashboard.almarprivatejourney.com` (DNS), its R2 and Workers AI bindings.
3. Rebuild on Publish: connect branch `live` in Cloudflare Workers Builds and create its deploy hook.
4. Stripe TEST keys and webhook secrets (your existing UAE account for now); turn on Adaptive Pricing if offered.
5. Apple Pay domains (main, www, preview) in Stripe.
6. Resend domain for `inquiries@almarprivatejourney.com`.
7. `BOOKING_LINK_SECRET` and `PUBLIC_ORIGIN` (preview while TEST) from your terminal.
8. After the first `almar-ops` CPU measurement: yes/no on Cloudflare's paid Workers plan.

## Owed by you by Oct 9

Real nightly rates and date ranges; prices and units for experiences and services, and which one is home pickup;
balance due days; booking terms text; the two team members' details and photos.
