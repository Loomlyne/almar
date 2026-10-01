# Architecture Research — ALMAR Booking OS

**Date:** 2026-09-22
**Dimension:** ARCHITECTURE
**Question:** How to structure this rebuild (replace Framer HTML `route.ts` dumps with a React App Router app: public site + `dashboard.almarprivatejourney.com`, one Supabase, Stripe webhooks, Resend, R2 media URLs, design tokens in Settings, `/booking/trip` 30-minute hold, RLS so guests cannot hit ops APIs).

**Constraint:** Owner-gated infra (Cloudflare Worker/Pages + DNS + R2, Supabase project, Stripe live, Resend domain) is not created from this research.

**Brownfield:** Next.js 14.2.35, React 18, 27 Framer HTML `GET` handlers, no `layout.tsx` / `page.tsx` / `lib/` / auth / DB. Map: `.planning/codebase/ARCHITECTURE.md`.

---

## Recommendation (one paragraph)

Keep **one** Next.js 14.2.35 App Router codebase and **one** deploy. Split the UI with **route groups** — public marketing/booking vs ops — and isolate ops at runtime with **host-aware middleware** (`dashboard.almarprivatejourney.com` → internal `/ops`; until DNS, local `/ops` only). Replace each Framer `app/**/route.ts` with `page.tsx` on that same URL (they cannot coexist on one segment). Put all mutations that matter through **server code** that uses three Supabase clients (browser anon, cookie SSR, service role). Enforce “guests cannot hit ops” twice: Next.js gate + Postgres grants/RLS with ops tables ungranted to `anon`/`authenticated`. Own money math in-app; Stripe is Payment Element + PaymentIntents + signed webhooks, not a hosted Checkout page.

Do **not** split into two Next apps, patch Framer HTML strings into a design system, expose ops through the Supabase Data API, or create Cloudflare/Supabase/Stripe/Resend projects in this pass.

---

## Pattern

### Chosen: single App Router app, two hosts, one database

| Surface | Public URL (intended) | In-app path | Auth |
|---|---|---|---|
| Marketing + booking + guest account | apex (intended `almarprivatejourney.com`) | `app/(public)/**` | optional guest |
| Ops dashboard | `dashboard.almarprivatejourney.com` | `app/(ops)/ops/**` | owner only (`maria@almarprivatejourney.com`) |
| Local stand-in | `localhost:3000/ops` | same ops tree | owner only; no public link |

Route groups organize two layout trees without putting `(public)` or `(ops)` in the URL.[2] Middleware runs before routes match and can rewrite by `Host`.[1] Root layout is required once any `page.tsx` exists and must emit `<html>` / `<body>`.[4]

**Why not two Next apps.** Tokens live in Settings and must Publish site-wide on both surfaces. Two deploys would duplicate the design system and race the token CSS. One Cloudflare project name `almar` is the intended host.

**Why not patch Framer `HTML` strings.** Current pages are `GET` → `new Response(HTML)` with no React tree (`.planning/codebase/ARCHITECTURE.md`). A `route.js` and `page.js` cannot occupy the same segment.[5] Booking, CMS, and a tokenized component system cannot live inside those strings.

**Why Payment Intents + Payment Element, not hosted Checkout.** Payment Element is the on-page UI for card / wallets / Link.[8] Stripe’s default for “most integrations” is Checkout Sessions + Payment Element; Payment Intents is the lower-level API when the app owns tax, discounts, currency conversion, and checkout state.[8][10] ALMAR owns VAT %, coupons, live FX locked for 30 minutes, deposit vs full, and a separate damage authorization — so the server computes the amount and creates a PaymentIntent.

**Why one Supabase, no Storage.** Auth + Postgres only. `service_role` bypasses RLS and must stay server-side.[14] Media is Cloudflare R2 https URLs, never Supabase Storage.

**Host (when gated):** `@opennextjs/cloudflare` runs the Next.js Node runtime on Workers and supports App Router, Route Handlers, and Middleware.[20] OpenNext documents that Next.js 14 support was scheduled to drop Q1 2026; the repo pin stays 14.2.35 until an explicit upgrade decision. Do not add `wrangler.toml` or create the `almar` project here.

### Isolation pattern (guests cannot hit ops)

Defense in depth, all required:

1. **Host + path gate (Next middleware).** `dashboard.*` rewrites to `/ops…` and keeps the address bar on the dashboard host.[1] Public host `/ops` and `/api/ops/*` → 404. Dashboard host does not serve marketing pages. `/api/webhooks/stripe` is excluded from session auth (Stripe signature only).
2. **No Data API surface for ops.** Grants decide whether `anon` / `authenticated` can touch a table at all; RLS then filters rows.[14][16] Revoke client grants on ops tables (`staff_notes`, `audit_log`, `ops_costs`, passport vault, email templates, unpublished drafts). Prefer an unexposed schema (e.g. `ops`) so PostgREST never lists those objects.[16]
3. **Ops mutations use service role only after an owner check in Next.** Browser never ships the secret key.[14] Guest JWT, even if stolen, cannot `GRANT` its way into ops rows.

### Incremental cutover (Framer → React)

Route Handlers do not participate in layouts.[5] Adding `app/layout.tsx` plus new segments (`/booking/trip`, `/ops`) can ship while Framer still owns `/` via `app/route.ts`.

Replace a Framer URL by **deleting** that folder’s `route.ts` **then** adding `page.tsx`. Do not leave both. When the last Framer handler is gone, retire `app/[...not_found]/route.ts` in favor of `app/not-found.tsx` (today the catch-all exists because there is no root layout).

Suggested order (architecture, not a phase plan): design-system primitives → `/ops` shell (local) → `/booking/trip` → swap marketing routes one section at a time → drop Framer runtime.

Keep hashed `public/assets/*` until those files are re-homed as R2 URLs. Do not rename hashes while Framer pages still reference them.

---

## Data Flow

```
                    ┌──────────────────────────────────────────┐
                    │  Host gate (middleware.ts)               │
                    │  apex → (public)                         │
                    │  dashboard.* → rewrite /ops              │
                    │  refresh Supabase cookies                │
                    └─────────────┬────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐
     │ Public RSC     │  │ Ops RSC        │  │ Route Handlers     │
     │ catalog, trip  │  │ CMS, money,    │  │ /api/webhooks/     │
     │ booking UI     │  │ calendar       │  │ stripe  (raw body) │
     └────────┬───────┘  └────────┬───────┘  └─────────┬──────────┘
              │                   │                    │
              │  cookie SSR       │  owner +           │  service_role
              │  (anon key)       │  service_role      │  after constructEvent
              ▼                   ▼                    ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  One Supabase  (auth + Postgres, RLS on, Storage off)       │
     │  published catalog │ bookings/holds │ ops schema (no grants)│
     │  settings.tokens   │ money snapshots│ audit                 │
     └────────┬───────────────────┬───────────────────┬────────────┘
              │                   │                   │
              ▼                   ▼                   ▼
        R2 https URLs      Stripe PaymentIntents    Resend
        (media only)       + manual-capture hold    (server, idempotent)
```

### 1. Public page (CMS + tokens + locale)

1. Middleware reads locale cookie (EN default; AR/ES). Same pathname for every language — no `/en` `/ar` `/es` prefix. next-intl can rewrite internally with `localePrefix: 'never'` if used for chrome strings; CMS rows remain the copy source.[21] Next’s own i18n doc defaults to `app/[lang]` sub-paths, which this product rejects.[6]
2. Root layout loads **published** Settings tokens and inlines CSS variables on `:root` (Deep Teal, Charcoal, Gold, Ivory, uploaded font family, logos). Light theme only. `dir="rtl"` when locale is AR.
3. Server Components read published catalog (RLS `SELECT` for `anon` on published rows only).[14]
4. Images are https URLs (R2 custom domain when gated). R2 buckets are private until explicitly made public via custom domain or `r2.dev` (non-production).[18][19]
5. `app/robots.ts` allows public, disallows `/ops` (and the dashboard host via `Host`).[7]

### 2. `/booking/trip` — 30-minute inventory hold (not Stripe)

Hero search never charges. First money movement is the last step.

1. Guest: Where (one destination) · When · Who → `/booking/trip`.
2. Server creates/updates a **Draft** booking: 1 destination, 1 stay, add-ons, traveler lines, UAE airport, currency.
3. On entering **Pay**: transactionally lock stay+date range; insert calendar hold; set `hold_expires_at = now() + 30 minutes`; snapshot FX + priced lines. Overlap with Deposit-paid / Confirmed / maintenance / other live drafts fails with a reason (sold out, occupancy, min nights) — never a silent hide.
4. Expiry (lazy on next availability read **and** a later cron when gated) deletes the draft hold and sends the guest back to stay pick. New booking gets new FX.
5. This hold is **Postgres occupancy**, not a card authorization. Card authorization windows are measured in days, not 30 minutes.[11]

Guest may edit until Pay. Second city in the same timeline is WhatsApp ops (prefilled booking id), not a second stay on this booking.

### 3. Pay — branded Payment Element + webhook as source of truth

1. Server recomputes: nights + add-ons − coupon → subtotal → VAT % (Settings) → grand total → deposit % or full. Amount is **never** taken from the client.[10]
2. Create or reuse one PaymentIntent for that draft (`idempotencyKey` = booking id + amount + currency) and return `client_secret` only.[10]
3. Client mounts Payment Element + Express Checkout (Apple Pay) + Link; `appearance` maps from the same brand tokens.[8][13]
4. 3DS runs inside Elements when the bank requires it.[10]
5. **Do not** mark paid from the client return. Stripe pushes events to an HTTPS webhook; the handler verifies `Stripe-Signature` with `constructEvent` over the **raw** body (`request.text()`, never `request.json()`).[9][12] Next App Router Route Handlers are the webhook surface.[5]
6. Idempotent fulfill: unique `stripe_event_id`; `payment_intent.succeeded` → Draft → Deposit paid or Confirmed (full pay); send Resend email + persist booking page as source of truth.
7. Refresh after success must not create a second charge (reuse PaymentIntent / idempotency key).[10]

**Damage hold (separate object):** second PaymentIntent with `capture_method=manual` for the stay’s damage amount — authorize now, ops capture or release later. Card-not-present authorizations typically last ~7 days depending on brand; ops must act before expiry.[11] Show as “temporarily held”, not in the captured total.

Refunds: ops-initiated Stripe refund to original, never more than captured. Chargebacks visible, no auto-refund.

### 4. Ops dashboard

1. Logged-out dashboard host → branded ops sign-in (email + password). Guests have zero access.
2. After owner session (30-day): RSC under `app/(ops)/ops/**` use service role **only after** verifying the owner email server-side. Do not use `getSession()` as the authorization decision; verify claims.[15]
3. Nav: Home · Bookings · Customers · Calendar · Catalog · Content · Settings · Profile.
4. Publish (stay/page/story): writes published row + translations; `revalidateTag` / path so public RSC updates. Unpublish hides; old bookings keep snapshot data. One stay record reused (no clone).
5. Settings → Brand: colors, font upload (R2 URL), logos, favicon. Publish rewrites CSS variables immediately (tag revalidation), including Stripe `appearance` on the next checkout.[13]

### 5. Email (Resend)

Server-only `RESEND_API_KEY`. Domain verify is owner-gated; until then do not send production from the product domain.[17] Use `idempotencyKey` on send so webhook retries do not duplicate mail.[17] Templates: EN stored, AR/ES translated; guest language = site language. Receipt + PDF; ops can resend.

### 6. Auth cookies (SSR)

`@supabase/ssr`: browser client + server client; on Next 14 the session refresher is `middleware.ts` (not `proxy.ts`).[15] Copy refreshed cookies onto any middleware `NextResponse` you return (host rewrite included) or users sign out.[15] Do not cache `Set-Cookie` auth responses on the CDN.[15]

Guest: confirm email (branded) then magic link + optional password (eye). Owner: auto-confirm until changed. Later signup merges by email.

---

## Key Abstractions

**Route group `(public)` / `(ops)`**
Two layouts (marketing nav vs dense ops chrome) without URL prefixes.[2] Full page load when crossing groups is acceptable (guest site ↔ dashboard is a different host anyway).

**Host rewrite**
`dashboard.almarprivatejourney.com/bookings/…` → internal `/ops/bookings/…`. Rewrite, not redirect, so the dashboard host stays in the bar.[1] Local: no rewrite, paths are `/ops/...`.

**Three Supabase clients** (`lib/supabase/`)

| Client | Key | Where | RLS |
|---|---|---|---|
| `browser` | publishable / anon | Client Components | yes |
| `server` | publishable + cookies | RSC, Server Actions, guest Route Handlers | yes |
| `admin` | service role | webhooks, hold expiry, ops after owner check, Resend jobs | bypass |

Never import `admin` from a `"use client"` file.[14][15]

**Published vs draft**
Catalog tables carry `status` + `published_at`. Anon policies: `status = 'published'`. Drafts: no `anon`/`authenticated` grant (ops schema or explicit revoke).[16]

**Booking**
One row: destination, stay, date range, occupancy, add-ons, journey (UAE airport meet, optional home pickup, return), money snapshot, `ALMAR-XXXXXX`, status `Draft → Deposit paid → Confirmed → In trip → Completed | Cancelled`. Calendar occupancy is derived; hard-block overlap in a transaction.

**Inventory hold vs card hold**
- Inventory: Draft + `hold_expires_at` (30 min) + calendar rows.
- Card damage: PaymentIntent `capture_method=manual`.[11]
Do not implement the FOMO timer as a Stripe authorization.

**Money snapshot**
Immutable lines on the booking at hold time: nightly AED, add-ons, coupon, VAT %, deposit %, FX rates for AED/USD/EUR, charged currency. Remainder and extra-charge reuse the same Element against new PaymentIntents. VAT once on grand total.

**Brand tokens**
Single Settings row → CSS variables for both surfaces + Stripe Appearance `variables` (`colorPrimary`, `fontFamily`, …).[13] `/design` is owner-only and renders every component state.

**Media URL**
CMS fields store `https://…` only. Upload path (when R2 is gated) is an ops Server Action → R2 → persist URL. No Supabase Storage bucket.

**Locale**
Cookie `almar_locale=en|ar|es` (default `en`). `<html lang dir>`. Chrome strings from a small dictionary; page/stay/legal/email copy from CMS translations (ops types EN; Publish auto-fills AR/ES unless locked).

---

## Recommended Structure

```
almarprod-Website-Code/
├── app/
│   ├── layout.tsx                 # <html lang dir>, token <style>, fonts
│   ├── not-found.tsx              # branded 404 (after Framer catch-all dies)
│   ├── robots.ts                  # allow public; disallow /ops
│   ├── sitemap.ts                 # published URLs only
│   ├── (public)/
│   │   ├── layout.tsx             # nav, footer, WhatsApp, cookie banner
│   │   ├── page.tsx               # home (replaces app/route.ts)
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx       # form + 30-min Dubai consultation
│   │   ├── destinations/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── experiences/page.tsx   # merged Experiences & Services
│   │   ├── private-stays/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── legal/[slug]/page.tsx
│   │   ├── booking/trip/page.tsx  # summary → stay → add-ons → travelers → pay
│   │   ├── account/               # guest bookings, verify-email landing
│   │   ├── login/page.tsx
│   │   ├── plan-with-us/page.tsx
│   │   └── design/page.tsx        # owner-gated component gallery
│   ├── (ops)/
│   │   └── ops/
│   │       ├── layout.tsx         # dense ops chrome; owner gate
│   │       ├── page.tsx           # analytics Home
│   │       ├── login/page.tsx
│   │       ├── bookings/
│   │       ├── customers/
│   │       ├── calendar/
│   │       ├── catalog/           # destinations, stays, experiences, packages
│   │       ├── content/           # pages, blog, team, legal
│   │       ├── settings/page.tsx  # tokens, VAT, deposit %, templates, FX
│   │       └── profile/page.tsx
│   └── api/
│       ├── webhooks/stripe/route.ts   # POST, raw body, Node runtime
│       ├── cron/holds/route.ts        # expire drafts (when cron is gated)
│       └── ops/                       # extra JSON only if RSC/actions cannot
├── components/
│   ├── ui/                        # icons → link → button → inputs → … sections
│   ├── public/
│   └── ops/
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── supabase/admin.ts          # service role; server-only
│   ├── stripe.ts
│   ├── resend.ts
│   ├── tokens.ts                  # Settings → CSS vars + Stripe appearance
│   ├── money/                     # nights, FX lock, coupon, VAT, deposit
│   ├── booking/hold.ts            # 30-min occupancy lock
│   ├── auth/owner.ts              # maria@… check
│   └── i18n/                      # cookie locale + chrome dictionaries
├── emails/                        # Resend React templates (EN + translated)
├── middleware.ts                  # host rewrite, cookie refresh, /ops gate
├── supabase/                      # migrations + RLS tests — only after gate
│   ├── migrations/
│   └── tests/
├── brand/                         # already in repo (Guideline, Questa, Lato)
├── public/assets/                 # hashed Framer leftovers until R2 cutover
├── next.config.js                 # stay CJS; later images/R2 remotePatterns
└── package.json                   # next@14.2.35 — do not silently bump
```

Private folders (`_components` inside a route) are opt-out of routing if colocation is preferred; they are not required.[3]

**Do not add until owner-gated:** `wrangler.toml`, Cloudflare project `almar`, DNS for apex or `dashboard.`, R2 bucket, Supabase project, Stripe live keys, Resend production domain. Code may introduce clients behind env vars and no-op when unset.

**Do not:** `vercel deploy`, Figma MCP, invent a live custom domain, store the owner password from chat, put secrets in the repo.

---

## RLS sketch (when Supabase exists)

Enable RLS on every exposed table; revoke default `anon`/`authenticated` grants; grant back only what that role needs.[14][16]

| Object | anon | authenticated (guest) | service_role (server) |
|---|---|---|---|
| published destinations/stays/experiences/pages/legal/blog | SELECT | SELECT | all |
| drafts / unpublished | none | none | all |
| bookings | none | SELECT/UPDATE own (add-ons + pay difference if unverified; requests if signed-in) | all |
| traveler PII / passport vault | none | none (owner extra confirm via server) | all |
| staff notes, audit, costs, reminder jobs | none | none | all |
| settings (published token view) | SELECT view | SELECT view | all |
| `ops.*` schema | not exposed | not exposed | all |

Policy tests: `supabase/tests/<table>_rls.test.sql` then `supabase test db`.[14] Views over protected tables need `security_invoker = true` or they leak.[14]

---

## Open questions (do not block the tree)

- OpenNext vs 14.2.35 compatibility on the day Cloudflare is gated — confirm adapter, do not bump Next silently.[20]
- Cron for hold expiry: `pg_cron` vs Cloudflare Cron vs lazy-only until gated.
- Cookie domain split (apex vs `dashboard.`) once DNS exists; localhost uses `Path=/ops` for the owner session.
- Whether chrome i18n uses next-intl `localePrefix: 'never'` or a 20-line cookie helper — CMS copy does not need `[locale]` URLs either way.[21]

---

## Sources

[1] https://nextjs.org/docs/14/app/building-your-application/routing/middleware
[2] https://nextjs.org/docs/14/app/building-your-application/routing/route-groups
[3] https://nextjs.org/docs/14/app/building-your-application/routing/colocation
[4] https://nextjs.org/docs/14/app/building-your-application/routing/pages-and-layouts
[5] https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers
[6] https://nextjs.org/docs/14/app/building-your-application/routing/internationalization
[7] https://nextjs.org/docs/14/app/api-reference/file-conventions/metadata/robots
[8] https://docs.stripe.com/payments/payment-element
[9] https://docs.stripe.com/webhooks
[10] https://docs.stripe.com/payments/payment-intents
[11] https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
[12] https://docs.stripe.com/webhooks/signature
[13] https://docs.stripe.com/elements/appearance-api
[14] https://supabase.com/docs/guides/database/postgres/row-level-security
[15] https://supabase.com/docs/guides/auth/server-side/nextjs
[16] https://supabase.com/docs/guides/api/securing-your-api
[17] https://resend.com/docs/send-with-nextjs
[18] https://developers.cloudflare.com/r2
[19] https://developers.cloudflare.com/r2/buckets/public-buckets
[20] https://opennext.js.org/cloudflare
[21] https://next-intl.dev/docs/routing/configuration
