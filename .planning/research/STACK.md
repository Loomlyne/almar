# STACK — luxury travel booking OS on Cloudflare

**Research date:** 2026-09-22
**Scope:** Rebuild ALMAR (Framer HTML `route.ts` dumps) into a real booking OS. Research only — do not create Cloudflare, Supabase, Stripe, or Resend projects.

**Product pins (binding):** Next.js 14.2.35 App Router, React 18, TypeScript; host Cloudflare project name `almar`; Supabase auth+data (no storage); Stripe Payment Element TEST (AED/USD/EUR, Apple Pay, Link); Resend; Cloudflare R2/Images; same URLs for EN/AR/ES (no `/en` `/ar` `/es`); real RTL Arabic; live FX.

## Constraint vs 2026 host reality

OpenNext for Cloudflare still documents App Router, SSR, middleware, ISR, and Cloudflare Images, and still lists “latest minors of Next.js 14 and 15.”[1] The same page says Next.js 14 support will be dropped Q1 2026.[1] Cloudflare’s Workers Next.js guide now recommends **vinext** (beta, aimed at Next.js 16) as the default path, with OpenNext only for apps that cannot migrate yet.[5][6] `@cloudflare/next-on-pages` is deprecated; its README tells you to use OpenNext instead.[10]

npm disagrees with the “14 still supported” line on the docs site: `@opennextjs/cloudflare@1.20.6` peers `next` at `>=15.5.24 <16 || >=16.3.3`.[11][38] `@opennextjs/cloudflare@1.15.0` is the last published adapter whose peer range still includes `next@^14.2.35`.

**Decision for ALMAR:** stay on Next 14.2.35 + OpenNext **1.15.x** until a gated Next bump. Do not take vinext (beta / Next 16) and do not take latest OpenNext without bumping Next.

## Standard Stack

| Component | Technology | Why Standard | Our Choice | Rationale |
|---|---|---|---|---|
| UI framework | Next.js App Router + React | App Router is the Next.js default; OpenNext supports it on Workers.[1][37] | **Next.js 14.2.35, React 18.3.x, App Router, Node.js runtime** | Existing pin. Rebuild as real `page.tsx` / layouts / Server Actions — not HTML string `GET` handlers. |
| Language | TypeScript strict | Next.js default; Zod requires `strict`.[37][35] | **TypeScript 5.x, `strict: true`** | Already in-repo. Keep. |
| Node | Node 20 LTS | Current Next install docs require Node 20.9+ for latest; 14.2.x still runs on 18.17+.[37] | **Node 20 (match existing Dockerfile)** | One runtime locally, in CI, and in Workers `nodejs_compat`. |
| Package manager | npm | Lockfile already in repo. | **npm + `package-lock.json`** | Do not switch to pnpm/bun mid-rebuild. |
| Host | Cloudflare Workers | OpenNext transforms `next build` to a Worker; Pages `next-on-pages` is dead.[1][2][10] | **Workers via OpenNext, project name `almar` (owner-gated)** | Booking OS needs SSR, Route Handlers, webhooks — not a static Pages export. |
| Adapter | `@opennextjs/cloudflare` | Official adapter for Next on Workers; `nodejs_compat` + `wrangler.jsonc`.[2][6] | **`@opennextjs/cloudflare@1.15.x` + Wrangler 4.59+** | Last line that peers Next 14.2.35. Latest 1.20.x will not install cleanly on the pin.[38] |
| Worker config | `wrangler.jsonc` + `open-next.config.ts` | Required for preview/deploy and bindings.[2] | **`name: "almar"`**, `nodejs_compat`, `global_fetch_strictly_public`, `ASSETS`, `WORKER_SELF_REFERENCE` | Follow Get Started; do not set `runtime = "edge"` (unsupported).[2] |
| Incremental cache | R2 (+ optional Durable Object queue) | OpenNext stores ISR/data cache in R2.[4] | **R2 bucket bound as `NEXT_INC_CACHE_R2_BUCKET`** | Same product as media storage. Create only when gated. |
| Object storage | Cloudflare R2 | S3-compatible object store, no egress fees.[7] | **R2 for stay/media uploads; public HTTPS URLs only** | Product forbids Supabase Storage. |
| Images | Cloudflare Images + `next/image` | OpenNext Images binding or `/cdn-cgi/image` loader.[3][8] | **`IMAGES` binding + origin allowlist = our R2** | Restrict transform origins to the media bucket.[3] |
| Database | Hosted Postgres | Booking OS needs relational data, RLS, audits. | **One Supabase project: Postgres + Auth only** | No D1 as source of truth. No second database. |
| Data access | Official client + SQL | SSR helpers are the documented Next path.[29][30] | **`@supabase/supabase-js` + `@supabase/ssr`**; generated types | No Prisma/Drizzle unless SQL becomes unmaintainable. RLS on every table. |
| Auth | Cookie SSR session | `@supabase/ssr` browser + server clients; middleware refreshes cookies; `getUser()` not `getSession()`.[29][30] | **Magic link required, then optional password; owner email+password**[31] | Guest checkout without account is product; later signup merges by email. |
| Payments UI | Stripe Payment Element | Embeddable, PCI-safe, wallets via `wallets` option, Appearance API.[15][20][25] | **`@stripe/stripe-js` + `@stripe/react-stripe-js` `PaymentElement` inside branded checkout** | Never hosted Checkout page. Never Card Element / raw PAN. |
| Payments API | Payment Intents | Use when you own tax, discounts, currency conversion, and capture timing.[15][19][24] | **Payment Intents + webhooks as source of truth** | We own VAT, deposit %, coupons, FX lock, remainder. Checkout Sessions would fight that. |
| Payment methods | Card + wallets | Payment Element shows Apple Pay/Google Pay when possible; Link authenticates and autofills.[15][16] | **card + Apple Pay + Link; TEST keys until go-live plan**[21] | Disable BNPL/Klarna. No `setup_future_usage` (no saved cards in our app). |
| Currencies | Stripe presentment | Stripe supports 135+ presentment currencies including AED, USD, EUR (two-decimal).[17] | **Charge in guest-selected AED / USD / EUR** | Convert from AED catalog with our FX, then create the Intent in that currency. |
| Damage hold | Manual capture | Authorize now, capture later; card-not-present windows are ~5–7 days.[18] | **Separate PaymentIntent, `capture_method: manual`** | Not the 30-minute inventory hold. Ops capture/release only. Re-auth if the window expires. |
| 3DS / SCA | PaymentIntents | 3DS is handled inside the Intent lifecycle when the bank requires it.[19][23] | **Let Stripe request 3DS; no homemade card UI** | Idempotent create; webhook repair; refresh must not double-charge.[19] |
| Webhooks | Signed HTTPS endpoint | Stripe pushes async payment/dispute events; verify signatures.[22][26] | **Route Handler `/api/stripe/webhook` + `whsec_` in secrets** | TEST endpoint first. Never trust the browser for “paid”. |
| Email | Resend Node SDK | Documented App Router / Server Action path; idempotency keys.[27] | **`resend` + `RESEND_API_KEY` (server only)** | Branded confirmation, receipts, reminders, flight-booked. Domain verify is gated. |
| Email templates | React Email | Resend renders React Email components.[27][28] | **`@react-email/components` templates, ops-editable EN, translated AR/ES** | Guest language = site language. |
| i18n | next-intl without URL prefixes | If pathnames are not unique per locale, provide locale from a cookie (no `[locale]` routing required).[12] `localePrefix: 'never'` is the prefixed-routing alternative.[13] | **next-intl without i18n routing; cookie `locale`; default `en`** | Same URLs for EN/AR/ES. Do not use `/en` `/ar` `/es`. |
| RTL / format | `lang` + `dir` + timeZone | next-intl locale is BCP 47; set `timeZone` per request; `<html lang>` from `getLocale()`.[14] Locales can encode numbering systems.[13] | **`dir="rtl"` for `ar`; `timeZone: "Asia/Dubai"`; `ar-AE-u-nu-latn` (Western digits)** | Dates DD/MM/YYYY, week starts Monday. |
| FX | Public reference rates | Frankfurter is a free, no-key API covering AED/USD/EUR; cache and convert in app (no convert endpoint).[33] | **Frankfurter → cache in Postgres; lock rate for 30-min pay hold; on fail use last cache** | Live FX is product; we do not use Stripe Adaptive Pricing (Checkout Sessions only). |
| CSS | Tailwind on Next | Current Tailwind install path for App Router.[34] | **Tailwind v4 + CSS variables for brand tokens (Questa, Lato, Deep Teal `#1f3b40`, Gold `#d4ba8a`, Ivory `#fffaf0`)** | Custom design system, not a kit theme. Light theme only. |
| Validation | Zod | TS-first schemas; `strict` required.[35] | **Zod 4 on Server Actions + webhooks** | Pair with React Hook Form on the client. |
| Jobs | Worker Cron | Workers `scheduled()` handler / Cron Triggers.[9] | **Dedicated cron Worker (or trigger) hitting signed Route Handlers** | 30-min hold expiry, remainder reminders, FX refresh. Do not use Vercel cron. |
| Secrets / PII | Vault + app encryption | Vault stores encrypted secrets in Postgres; pgsodium is pending deprecation.[32] | **Vault for keys; app-level encryption for passport/ID; extra owner confirm to decrypt** | Cards: last 4 from Stripe only. Never PAN. |
| E2E | Playwright | Cross-browser E2E, CI workflow option.[36] | **Playwright for booking + pay (TEST) + RTL smoke** | Plus `tsc --noEmit`. No “it works” from mocks. |
| CI | GitHub Actions | Repo is `Loomlyne/almar`; no workflows today. | **PR: typecheck + build + Playwright; never push `main`** | Cloudflare deploy remains owner-gated. |

## Anti-Patterns

- **Keep Framer `HTML` string routes as the product.** They cannot host a design system, CMS, auth, or checkout. Rebuild.
- **`@cloudflare/next-on-pages` or Cloudflare Pages as the Next host.** Package is deprecated; OpenNext targets Workers.[10][2] Pages remains valid only for a static `output: "export"` site, which this is not.[5]
- **vinext as the v1 host.** Cloudflare recommends it for new Workers Next apps, but it is beta and documented around Next.js 16.[5] Out of pin.
- **`@opennextjs/cloudflare@latest` (1.20.x) on Next 14.2.35.** Peer range no longer includes 14.[38]
- **`export const runtime = "edge"`.** OpenNext Cloudflare does not support the Edge runtime yet.[2]
- **Vercel / `vercel deploy` / treating `vercel.json` as production.** Leftover exporter. Host is Cloudflare.
- **Supabase Storage.** Media is R2/Images only.[7][3]
- **Stripe-hosted Checkout / Payment Links as the guest pay UI.** Product requires a branded Payment Element.[15]
- **Card Element or any field that touches PAN.** Payment Element keeps PAN in Stripe’s iframe.[15]
- **Checkout Sessions as the money engine.** Stripe prefers it for generic checkouts.[15][24] We own VAT, deposit, coupons, FX lock, remainder, and a second manual-capture hold.[19][18]
- **`setup_future_usage` / saved cards in our app, BNPL, split pay, gift cards.**
- **Trusting the client for “paid”.** Confirm via webhook signature verification.[22][26]
- **Locale prefixes (`/en`, `/ar`, `/es`) or `localePrefix: 'always'`.** Use cookie locale without i18n routing.[12]
- **`supabase.auth.getSession()` in middleware/server code.** Use `getUser()` (or `getClaims()` on current docs).[29][30]
- **localStorage sessions.** SSR cookies via `@supabase/ssr`.[30]
- **D1 / KV as the booking database.** Cache only.
- **Prisma/Drizzle + a second Postgres.** One Supabase.
- **Auth0, Clerk, NextAuth.**
- **SendGrid, Mailgun, Nodemailer, AWS SES.**
- **pgsodium as new encryption.** Pending deprecation; Vault is the replacement for secrets.[32]
- **Google Analytics / pixels without the cookie banner.**
- **Dark mode, shadcn default theme, Bricolage on 404.**
- **Careem/Uber APIs.**
- **Live Stripe charges** until a dedicated go-live plan.[21]
- **Creating Cloudflare/Supabase/Stripe/Resend resources from this research.** Owner-gated, one numbered step, then wait.

## Recommended Baseline

Pin and files (install when a signed plan says so; still no cloud projects):

```
next@14.2.35
react@18.3.1
react-dom@18.3.1
typescript@5.x
@opennextjs/cloudflare@1.15.x
wrangler@^4.59.2
@supabase/supabase-js
@supabase/ssr
stripe
@stripe/stripe-js
@stripe/react-stripe-js
resend
@react-email/components
next-intl
tailwindcss @tailwindcss/postcss
zod
react-hook-form
```

Repo shape:

- `app/` real App Router (public site + `/booking/trip` + auth + `/ops` until dashboard DNS).
- `i18n/request.ts` — cookie locale, messages from CMS/JSON, `timeZone: "Asia/Dubai"`.[12][14]
- `middleware.ts` — compose Supabase cookie refresh; no locale prefix rewrites.[29]
- `wrangler.jsonc` — Worker `almar`, `nodejs_compat`, R2 + Images bindings (commented until gated).[2]
- `open-next.config.ts` — R2 incremental cache.[2][4]
- `next.config` — `initOpenNextCloudflareForDev()`; no `runtime: "edge"`.[2]
- Stripe: server creates PaymentIntent (amount in selected currency, idempotency key); client mounts Payment Element with Appearance tokens; webhook marks booking paid.[19][20][26]
- FX: cron pull `https://api.frankfurter.dev/v2/rates?base=aed&quotes=usd,eur` into `fx_rates`; snapshot onto the booking at hold.[33]
- Tests: Playwright booking path on TEST Stripe; RTL `dir` assertion; webhook signature unit test.

**Next bump (later, gated):** Next 15.5.24+ or 16.3.3+ unlocks OpenNext 1.20.x.[38] Revisit vinext only if it leaves beta and matches the pin.

## What NOT to Use

| Do not use | Use instead |
|---|---|
| Next 15/16, vinext, OpenNext 1.16+ | Next 14.2.35 + OpenNext 1.15.x |
| `@cloudflare/next-on-pages`, Pages as SSR host, Vercel | Workers + OpenNext |
| `runtime = "edge"` | Default Node runtime |
| Framer HTML `route.ts`, Framer CDN, Pexels/catbox | React tree + R2/Images |
| Supabase Storage, S3, Cloudinary | R2 + Cloudflare Images |
| D1 as booking DB | Supabase Postgres |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` |
| Stripe Checkout hosted, Payment Links, Card Element | Payment Element + Payment Intents |
| Stripe live mode | TEST / sandbox until go-live plan |
| Klarna/Affirm/BNPL, saved cards | Card + Apple Pay + Link |
| next-i18next, `app/[locale]/…` prefixes | next-intl, cookie, same URLs |
| SendGrid / SES / Nodemailer | Resend + React Email |
| Vercel Cron | Cloudflare Cron Triggers |
| shadcn/Radix unthemed, dark mode | Brand tokens + custom primitives |
| Google Maps (unless gated) | Approximate public map; exact address after Confirmed |
| Secrets in git/chat | `.dev.vars` / Worker secrets, owner-gated |

## Sources

[1] https://opennext.js.org/cloudflare
[2] https://opennext.js.org/cloudflare/get-started
[3] https://opennext.js.org/cloudflare/howtos/image
[4] https://opennext.js.org/cloudflare/caching
[5] https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs
[6] https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext
[7] https://developers.cloudflare.com/r2
[8] https://developers.cloudflare.com/images/transform-images
[9] https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled
[10] https://github.com/cloudflare/next-on-pages
[11] https://www.npmjs.com/package/@opennextjs/cloudflare
[12] https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
[13] https://next-intl.dev/docs/routing/configuration
[14] https://next-intl.dev/docs/usage/configuration
[15] https://docs.stripe.com/payments/payment-element
[16] https://docs.stripe.com/payments/link
[17] https://docs.stripe.com/currencies
[18] https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
[19] https://docs.stripe.com/payments/payment-intents
[20] https://docs.stripe.com/elements/appearance-api
[21] https://docs.stripe.com/testing
[22] https://docs.stripe.com/webhooks
[23] https://docs.stripe.com/payments/3d-secure
[24] https://docs.stripe.com/payments/advanced
[25] https://docs.stripe.com/sdks/stripejs-react
[26] https://docs.stripe.com/webhooks/signatures
[27] https://resend.com/docs/send-with-nextjs
[28] https://react.email/docs/introduction
[29] https://supabase.com/docs/guides/auth/server-side/nextjs
[30] https://supabase.com/docs/guides/auth/server-side/creating-a-client
[31] https://supabase.com/docs/guides/auth/auth-email-passwordless
[32] https://supabase.com/docs/guides/database/vault
[33] https://www.frankfurter.app/docs
[34] https://tailwindcss.com/docs/installation/framework-guides/nextjs
[35] https://zod.dev
[36] https://playwright.dev/docs/intro
[37] https://nextjs.org/docs/app/getting-started/installation
[38] https://registry.npmjs.org/@opennextjs/cloudflare
