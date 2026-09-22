# Project Research Summary

**Project:** ALMAR Private Journeys
**Domain:** Luxury private-stay booking OS (Airbnb-like search + DMC concierge + ops CMS)
**Researched:** 2026-09-22
**Confidence:** HIGH

## Executive Summary

ALMAR is a rebuild, not a Framer HTML patch. Guests will judge it against Airbnb (Where / When / Who, itemized total, pay at confirm) and against Colombia DMCs (deposit, WhatsApp, 24/7 specialist). The product is both: Instant Book of one stay plus a UAE→Colombia accompanied journey. Competitors sell inquiry; copying that contradicts PROJECT.md. Copying Airbnb BNPL / $0 reserve / extra-person fees also contradicts it.

Recommended approach: one Next.js 14.2.35 App Router app on Cloudflare Workers via OpenNext **1.15.x** (last adapter that still peers Next 14.2.35). One Supabase (Postgres + Auth, no Storage). Stripe Payment Intents + Payment Element (TEST). Resend. R2 for all media. Cookie locale (EN/AR/ES, no URL prefixes). Design tokens + components first, then `/booking/trip`, then `/ops`.

Main risks: treating Framer `route.ts` strings as the product; mixing the 30-minute inventory hold with the Stripe damage auth; charging in the wrong minor units or VAT order; fulfilling on the browser `confirmPayment`; OpenNext 1.20.x / vinext on the Next 14 pin.

## Key Findings

### Recommended Stack

Stay on the existing Next 14.2.35 pin. Host is Workers, not Pages and not Vercel. Do not take vinext (beta / Next 16) or OpenNext 1.20.x (peer `next >=15.5.24`). Details: [STACK.md](STACK.md).

**Core technologies:**
- Next.js 14.2.35 + React 18 + TypeScript strict — existing pin; real `page.tsx` / layouts / Server Actions
- `@opennextjs/cloudflare@1.15.x` + Wrangler — last line that peers Next 14.2.35; project name `almar` (owner-gated)
- Supabase Postgres + `@supabase/ssr` — auth + data only; RLS; no Storage
- Stripe Payment Element + Payment Intents + signed webhooks — branded checkout; card + Apple Pay + Link; TEST until go-live
- Cloudflare R2 + Images — all media HTTPS URLs; incremental cache
- Resend + React Email — branded EN templates, AR/ES translated
- next-intl without i18n routing — cookie locale; `dir=rtl` on `<html>` for AR; `timeZone: Asia/Dubai`
- Tailwind + CSS variables — Questa / Lato / Deep Teal `#1f3b40` / Gold `#d4ba8a` / Ivory `#fffaf0`; light only
- Frankfurter → Postgres cache — live FX AED/USD/EUR; lock 30-min hold; fail → last cache
- Playwright + `tsc` — booking path on TEST Stripe; RTL smoke

### Expected Features

Details: [FEATURES.md](FEATURES.md).

**Must have (table stakes):**
- Hero Where / When / Who → stay results with sold-out reasons
- Itemized nights + fees + VAT before pay
- Deposit or pay in full on branded Payment Element
- Confirmation email + booking page; address after Confirmed
- Hard-block calendar (no overlap)
- WhatsApp `+971 56 388 3302` + ops bookings list

**Should have (competitive / luxury):**
- Add-ons, UAE airport meet, inclusions kit, remainder reminders
- EN/AR/ES same URLs + AED/USD/EUR live FX
- Damage hold as separate Stripe auth
- Full ops CMS (destinations, stays, experiences, packages, pages, blog, team, legal)

**Differentiator (v1 product, not optional):**
- Instant Book stay **plus** concierge journey in `/booking/trip`
- Security + guide + insurance as default inclusions
- Ops-booked flights after deposit; Driver assigned without phone
- One branded OS: public + `dashboard.almarprivatejourney.com` (until then `/ops`)

**Defer (later in this product, not first paid booking):**
- Packages Explorer/Resident/Sovereign as the multi-city path
- Consultation calendar, Plan with us, List with us
- Coupons, receipt PDF, profit charts, favorites, cookies/newsletter, blog
- Passport vault, address book, owner 2FA, dashboard DNS

### Architecture Approach

One App Router codebase, two hosts, one database. Route groups `(public)` vs `(ops)`. Middleware rewrites `dashboard.*` → `/ops`; public `/ops` 404s. Three Supabase clients (browser anon, cookie SSR, service role). Ops tables ungranted to `anon`/`authenticated`. Money math in-app; Stripe never owns VAT/coupon/FX. Incremental cutover: add `layout.tsx` + new segments while Framer still owns `/`; delete `route.ts` before adding `page.tsx` on the same URL. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

**Major components:**
1. Host gate (`middleware.ts`) — public vs ops, cookie refresh, webhook exclusion
2. Public RSC + `/booking/trip` — catalog, hold, checkout UI
3. Ops RSC (`/ops`) — CMS, money, calendar
4. Stripe webhook Route Handler — source of truth for paid
5. R2 media + Settings tokens — Publish site-wide on both surfaces

### Critical Pitfalls

Details: [PITFALLS.md](PITFALLS.md).

1. **Patching Framer HTML** — rebuild from tokens; do not concatenate into `HTML` strings
2. **Two clocks mixed** — 30-min DB inventory hold ≠ Stripe damage auth (7-day default; extended ~30 days, not for Link)
3. **Two PaymentIntents** — (A) deposit/full capture now; (B) damage `capture_method: manual`, ops only
4. **Webhook is fulfillment** — never mark paid from `confirmPayment`; verify signature on raw body; idempotent `event.id`
5. **VAT then deposit** — nights + add-ons − coupon → VAT → grand → deposit % of grand (example 1000 + 5% = 1050; 30% = 315)
6. **Minor units** — AED/USD/EUR are two-decimal; 1050.00 AED → `105000`; never floats to Stripe
7. **Atomic occupancy** — unique (stay_id, night) in the same transaction as the hold; overlap is a hard error
8. **RTL on `<html>`** — logical CSS; password eye on inline-end; do not mirror the wordmark
9. **Passport encryption** — not plaintext on bookings; owner re-auth + audit to reveal
10. **OpenNext pin** — 1.15.x on Next 14; no `runtime = "edge"`; no `vercel deploy`

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Design system
**Rationale:** PROJECT.md: tokens + every core component before screens. Same system on public and dashboard.
**Delivers:** Tokens, primitives, RTL states, owner-gated `/design`, Settings → Brand publish hook (can be stubbed until ops).
**Addresses:** Design-system Active items
**Avoids:** Patching Framer HTML; shadcn default / dark mode / Bricolage

### Phase 2: Platform spine
**Rationale:** Auth, RLS, host gate, i18n cookie, FX cache, wrangler commented until gated.
**Delivers:** Supabase clients, guest confirm + magic link + optional password (eye), owner email+password, locale/currency header, maintenance mode stub.
**Uses:** `@supabase/ssr`, next-intl, Frankfurter cache
**Implements:** Isolation pattern (guests cannot hit ops)

### Phase 3: Catalog + calendar
**Rationale:** Instant Book is impossible without rates and a hard-block calendar.
**Delivers:** Destinations (seed 5), stays, rates, occupancy rules, Experiences & Services, inclusions kit, Draft → Publish.
**Avoids:** Check-then-book race; stay bookable without rates

### Phase 4: Guest booking + pay
**Rationale:** Core value — one destination, one stay, add-ons, pay.
**Delivers:** Hero → `/booking/trip` (summary → stay → add-ons → travelers → pay), 30-min hold, branded Payment Element TEST, VAT/deposit/coupon math, damage hold PI, webhook, `ALMAR-XXXXXX`, confirmation email + booking page.
**Avoids:** Charge before pay; one PI for deposit+damage; fulfill on client

### Phase 5: Ops OS
**Rationale:** A booking without ops cannot run the trip.
**Delivers:** `/ops` Home, Bookings, Customers, Calendar, Catalog, Content, Settings; pay link; notes; audit; Driver assigned; Flights booked + Send email; refunds ≤ captured.
**Implements:** Host rewrite + service-role after owner check

### Phase 6: Site chrome + later Active
**Rationale:** Marketing rebuild + remaining Active (packages, consult, coupons, PDF, cookies, blog, passport vault) after the paid path exists.
**Delivers:** Replace Framer routes with React pages; EN/AR/ES publish-translate; WhatsApp; legal; packages request-then-pay; Contact calendar.
**Avoids:** Locale prefixes; fake testimonials

### Phase Ordering Rationale

- Design system first so every later screen uses real tokens (PROJECT.md)
- Platform before booking so RLS and locale exist
- Catalog before checkout so search is real inventory
- Pay before ops polish so Core Value is testable
- Framer cutover last so the portfolio stays up until each URL is replaced
- This avoids the Framer-patch pitfall and the “beautiful brochure that cannot take a deposit” failure

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** Stripe FX quotes vs Frankfurter cache; UAE `lock_duration` hour vs 30-min hold; damage auth window vs trip months out
- **Phase 2/5:** OpenNext 1.15.x + Next 14.2.35 middleware/cookies on Workers; webhook raw body
- **Phase 6:** next-intl without prefixes + MT EN→AR/ES quality on legal copy

Phases with standard patterns (skip research-phase):
- **Phase 1:** Token/component system — follow brand book + better-* skills at UI gates
- **Phase 3:** CRUD CMS + calendar uniqueness — well-documented Postgres patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official OpenNext/Stripe/Supabase/next-intl docs; npm peer range checked |
| Features | HIGH | Mapped to PROJECT.md + Airbnb/DMC public policies |
| Architecture | HIGH | App Router + RLS + PaymentIntents is the documented path |
| Pitfalls | HIGH | Stripe auth windows, VAT order, occupancy races, RTL on `html` |

**Overall confidence:** HIGH

### Gaps to Address

- Stripe FX Quotes `hour` lock vs product 30-min hold — confirm in Phase 4 plan; persist quote id
- Damage hold for stays >7 days out — extended auth or hold closer to arrival; not Link
- OpenNext 1.15.x vs Cloudflare’s 2026 vinext recommendation — stay pinned until a gated Next bump
- Auto-translate quality — human review queue before legal/AR public
- Owner-gated infra not created in research — Cloudflare/Supabase/Stripe/Resend still wait

## Sources

### Primary (HIGH confidence)
- https://opennext.js.org/cloudflare — adapter, caching, images, Next 14 drop note
- https://docs.stripe.com/payments/payment-element — Payment Element, Intents, webhooks, holds
- https://supabase.com/docs/guides/auth/server-side/nextjs — cookie SSR, `getUser()`
- https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing — same URLs
- https://registry.npmjs.org/@opennextjs/cloudflare — peer `next` ranges

### Secondary (MEDIUM confidence)
- Airbnb Help pricing / confirmation address — guest table-stakes
- Amakuna T&Cs — 50% deposit, USD, airfare excluded
- Galavanta / Magical Colombia / Cielo — inquiry DMC pattern
- W3C RTL / CSS logical properties — Arabic on `<html>`

### Tertiary (LOW confidence)
- Frankfurter as FX source vs Stripe `fx_quote` settlement — validate in Phase 4
- UAE VAT 5% as **example** only — Settings VAT %, do not hardcode tax law

---
*Research completed: 2026-09-22*
*Ready for roadmap: yes*
