# Architecture

**Analysis Date:** 2026-09-21

## Pattern Overview

**Overall:** Static HTML document server. Next.js App Router is used only as a file-based HTTP router. There is no application layer, no domain model, no database, no auth.

**Core flow:** Request path → matching `app/<path>/route.ts` `GET` → `new Response(HTML)` → browser runs Framer’s client runtime from that document.

**Key characteristic:** 27 `route.ts` files, zero React components, zero shared `lib/`. Stubs clone Framer-looking HTML for missing detail pages.

## Layers

**HTTP (Next route handlers):**
- Purpose: Map URL → HTML bytes + cache headers.
- Location: `app/**/route.ts`
- Contains: `export const dynamic`, `const HTML`, `export function GET()`
- Depends on: Next.js 14 App Router
- Used by: Browser / CDN

**Document (Framer export):**
- Purpose: Visual site — nav, sections, forms, animation.
- Location: the `HTML` string inside each route file
- Contains: full `<!DOCTYPE html>` documents, Framer hydration comments, inline/runtime JS
- Depends on: `framerusercontent.com` + local `/assets/*`
- Used by: Browser only

**Static assets:**
- Purpose: Self-hosted fonts and many images.
- Location: `public/assets/fonts/`, `public/assets/img/`
- Depends on: nothing
- Used by: HTML `src` / `@font-face`

**Missing layers (target product, not this tree):**
- Booking / payments / customers / CMS / dashboard / email / auth.

```
┌─────────────────────────────────────────┐
│  Browser                                │
│  Framer runtime + Lenis + forms         │
└─────────────────┬───────────────────────┘
                  │ GET /
                  ▼
┌─────────────────────────────────────────┐
│  Next.js 14 App Router                  │
│  app/**/route.ts  GET → Response(HTML)  │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│ public/assets/* │  │ Remote Framer CDN  │
│ img + fonts     │  │ images / search    │
└─────────────────┘  └────────────────────┘
```

No DB, no Worker, no Stripe, no Resend in this path.

## Data Flow

**Page view:**
1. Browser requests `/destinations` (example).
2. `app/destinations/route.ts` `GET` returns `HTML` with `content-type: text/html` and long `s-maxage`.
3. Browser hydrates Framer. Further image/font requests hit `/assets/*` or `framerusercontent.com`.

**Unknown URL:**
1. No matching static route.
2. `app/[...not_found]/route.ts` (`force-dynamic`) returns branded HTML with `status: 404`.
3. There is no `app/layout.tsx`, so `not-found.tsx` would never run — that is why the catch-all exists.

**Contact / inquiry:**
1. User fills a Framer `<form>` on `/` or `/contact`.
2. Server has no `POST` handler. Submit behavior is whatever Framer embedded. Unverified.

**State:** None on the server. No cookies, sessions, or CMS.

## Key Abstractions

**`HTML` constant:**
- Purpose: Entire page.
- Examples: `app/route.ts`, `app/about/route.ts`, stay/service/blog files
- Pattern: One document per file. Do not split into components without a new architecture.

**`GET()` handler:**
- Purpose: HTTP GET only.
- Signature: `export function GET()` — no `Request` argument on current files.
- Pattern: Always `new Response(HTML, { headers })`.

**`export const dynamic`:**
- `"force-static"` — all real pages.
- `"force-dynamic"` — 404 catch-all only.

**Stubs vs full exports:**
- Full Framer pages: home, about, contact, destinations, experiences, services index, blog index, private-stays index + stay detail pages.
- Stub aesthetic pages: three service details, three blog posts (`app/services/<slug>/route.ts`, `app/blog/<slug>/route.ts`). Headers say “placeholder HTML”.

## Entry Points

**Program entry:** Next `npm run dev` / `npm start`. No custom server.

**HTTP routes (27 handlers):**
- `/` — `app/route.ts`
- `/about` `/contact` `/destinations` `/experiences` `/services` `/blog` `/private-stays`
- `/services/24-7-private-concierge` `/services/luxury-ground-transport` `/services/vip-airport-meet-greet`
- `/blog/why-medellin-is-redefining-luxury-travel` `/blog/discovering-cartagenas-hidden-colonial-courtyards` `/blog/colombias-coffee-triangle-eje-cafetero`
- 12 `/private-stays/<slug>` stay pages
- catch-all 404 — `app/[...not_found]/route.ts`

**CLI:** none.

**Background jobs:** none.

**Legal URLs** (`./legal/booking-terms` etc.) are linked from HTML. There is no `app/legal/` directory — those paths 404.

## Error Handling

**Strategy:** Static success path. 404 is a dedicated handler. No `try/catch` in TypeScript.

**Patterns:**
- 404: branded HTML, `robots: noindex`, real 404 status (`app/[...not_found]/route.ts`).
- No JSON error bodies.
- No Sentry.

## Cross-Cutting Concerns

**Auth:** None.

**Logging:** None.

**Validation:** None on the server.

**i18n:** HTML `lang="en"` only. No locale routing.
