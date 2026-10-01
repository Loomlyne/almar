<!-- refreshed: 2026-10-02 -->
# Architecture

**Analysis Date:** 2026-10-02

Verified against the code at `main` 68df3b6 (Phase 3.1 landed, not deployed) and a real `next build`. `HERMES.md`, `README.md`, `PLAN_FIX_ALL.md` and the `<!-- GSD -->` blocks inside `HERMES.md` are stale (they describe Next 14, no root layout, a `[...not_found]` catch-all, "never rewrite pages as React"). The code wins.

## System Overview

One Next.js 15.5 App Router project that produces two unrelated things:

1. The **live public site**: 26 Framer-exported HTML pages, served as static files by Cloudflare Worker `almar`.
2. A **React front end** (design system, guest screens, ops dashboard screens) that exists only in development and tests. In production every React route answers 404 and is never shipped to the Worker.

```text
 BUILD TIME (npm run host:cloudflare = scripts/assemble-cloudflare.mjs, then wrangler deploy)
┌──────────────────────────────────────────────────────────────────────────┐
│ next build  ->  .next/server/app/                                         │
│  26 x force-static route handlers   -> <route>.body   (verbatim Framer)   │
│  React pages (NODE_ENV=production)  -> <route>.html   (404 __next_error__)│
│  dynamic handlers, /__harness       -> server bundles only, no static file│
└───────────────┬──────────────────────────────────────────────────────────┘
                │ assemble copies ONLY *.body, plus public/, _headers,
                │ and writes 404.html from renderStaticNotFound()
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ out/   index.html  about.html  private-stays/<slug>.html  ...  404.html   │
│        assets/img/*.webp  assets/fonts/*.woff2  _headers   (gitignored)   │
└───────────────┬──────────────────────────────────────────────────────────┘
                ▼
 RUNTIME (Cloudflare, account f1d9a1fa…, `wrangler.toml`)
┌──────────────────────────────────────────────────────────────────────────┐
│ Worker `almar` = assets only (no `main`, no server code)                  │
│ almarprivatejourney.com, www.…   html_handling=auto-trailing-slash        │
│ not_found_handling=404-page  ->  out/404.html with status 404             │
└──────────────────────────────────────────────────────────────────────────┘

 DEV / TEST ONLY (npm run dev, Playwright webServer on 127.0.0.1:3010)
┌───────────────────────┬─────────────────────────┬────────────────────────┐
│ React guest screens   │ React ops dashboard     │ /__harness (needs      │
│ /account /login       │ /dashboard/(ops)/*      │ ALMAR_HARNESS=1)       │
│ /bookings /booking/trip│ `app/dashboard/(ops)/` │ `app/%5F%5Fharness/`   │
├───────────────────────┴─────────────────────────┴────────────────────────┤
│ components/ui  components/journey  components/specimens  components/icons │
│ lib/copy (EN/AR/ES)  lib/cn.ts  lib/set-document-locale.ts  lib/fonts.ts  │
├──────────────────────────────────────────────────────────────────────────┤
│ tokens.json -> scripts/generate-theme.mjs -> app/globals.css (@theme)     │
└──────────────────────────────────────────────────────────────────────────┘
 Dev-only handlers: /fx  /newsletter  /embed/hero-booker  /embed/font/[file]
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Framer page handlers (26) | Return one Framer HTML string constant as `text/html`; `force-static` | `app/route.ts`, `app/<page>/route.ts`, `app/private-stays/<slug>/route.ts`, `app/blog/<slug>/route.ts`, `app/services/<slug>/route.ts` |
| Assemble script | Runs `npm run build`, copies `public/` and every `.body` into `out/`, writes `out/404.html`, copies `_headers`, fails if `index.html` or `404.html` is missing | `scripts/assemble-cloudflare.mjs` |
| Worker config | Assets-only Worker named `almar`, custom domains, 404 handling | `wrangler.toml` |
| Static 404 | Standalone HTML string with inline tokens-only CSS and the inlined monogram SVG; no React | `lib/not-found-document.ts` (`renderStaticNotFound()`) |
| Dev 404 and error UI | React 404 and error boundary using `StatusFrame` | `app/not-found.tsx`, `app/error.tsx`, `components/status-frame.tsx` |
| Root layout | `<html lang="en" dir="ltr">`, font CSS variables, skip link, imports `app/globals.css`; applies to React pages only (route handlers bypass it) | `app/layout.tsx` |
| Token pipeline | `tokens.json` is the single source of design values; the generator rewrites the block between `/* GENERATED:THEME:START */` and `END` in `app/globals.css` | `tokens.json`, `scripts/generate-theme.mjs`, `app/globals.css` |
| Class merge | `cn()` = `tailwind-merge` extended with the token names (hard-coded mirror of `tokens.json`, drift is a test failure) | `lib/cn.ts` |
| UI primitives | Button, Link, Field, Checkbox, Switch, Chip, Stepper, Calendar, Dialog, ConfirmDialog, Toast, Sidebar, ToggleCard, LocaleSelect, SiteNav, SiteFooter, WhatsApp | `components/ui/*.tsx` |
| Journey components | Controlled booking-path components: JourneyBar, JourneySegment, DestinationMenu, DateRangePanel, GuestPanel, JourneySheet/JourneyEntry (phone), StepRail, AddOnRow/AddOnList, InclusionsList, JourneyCart, TeamSection; prop contracts in `components/journey/types.ts` | `components/journey/*.tsx` |
| Hero booker specimen | Self-contained search form bundled for embedding into Framer HTML | `components/specimens/hero-booker.tsx` |
| Embed bundle entry | Sets `window.AlmarMountHeroBooker(host)`, accepts `{locale}` via `postMessage`, redirects the top window to `/booking/trip?where=…` | `lib/framer-hero-booker-mount.tsx` |
| Embed route | esbuild-bundles the entry to an IIFE and serves it as JS; dev only | `app/embed/hero-booker/route.ts` |
| Copy catalogue | Per-locale string tables `copy[locale].{home,guest,dashboard,framerSource,journey}` | `lib/copy/index.ts`, `lib/copy/home.ts`, `guest.ts`, `dashboard.ts`, `journey.ts`, `framer-source.ts` |
| Locale runtime | Sets `<html lang>`, `dir`, Noto Arabic font classes; `almar-locale` cookie is the shared preference | `lib/set-document-locale.ts`, `components/ui/locale-select.tsx` |
| Formatters | Western-numeral amounts and dates, plural and list formatting for en/ar/es | `lib/format.ts`, `lib/journey-format.ts` |
| FX | USD/AED/EUR conversion helpers and a 12-hour in-memory rate cache; served by `/fx` and read by Settings | `lib/fx/rates.ts`, `app/fx/route.ts` |
| Dashboard shell | Client layout with the left rail (Home, Bookings, Customers, Calendar, Catalog group, Content group, Settings, Profile) | `app/dashboard/(ops)/layout.tsx` |
| Dashboard screens | One `*-screen.tsx` client component per section, mounted by a thin `page.tsx` | `app/dashboard/(ops)/<section>/<section>-screen.tsx` |
| Test harness | Renders one named scene of one component for visual and a11y tests | `app/%5F%5Fharness/page.tsx`, `app/%5F%5Fharness/harness-client.tsx`, `tests/journey/scenes/*.tsx` |

## Pattern Overview

**Overall:** Static export of verbatim Framer HTML (transitional) alongside a gated React component system that will replace it page by page (roadmap Phases 3.3 and 6). Presentational, prop-driven React components, token-driven Tailwind v4 styling, copy tables per locale.

**Key Characteristics:**
- The only thing the Worker serves is `out/`. Anything that does not produce a `.body` file in `.next/server/app` (React pages, dynamic route handlers, `/__harness`) cannot reach production, whatever its code says.
- Production 404s for React routes are enforced twice: each `page.tsx` calls `notFound()` when `process.env.NODE_ENV === "production"`, and the assemble script never copies their `.html`. Verified with a real `next build` on 2026-10-02: `/account`, `/login`, `/bookings`, `/booking/trip`, `/dashboard` and the 14 `/dashboard/**` pages emit `.html` (+ `.rsc`) holding the `__next_error__` document (`account.meta` reads `"status": 404`) and no `.body`, so none is copied; exactly 26 `.body` files exist.
- No server runtime exists. `@opennextjs/cloudflare`, `@supabase/ssr`, `@supabase/supabase-js` are in `package.json` but nothing in `app/`, `lib/`, `components/` or `scripts/` imports them; there is no `middleware.ts`, no `open-next.config.ts`, no `main` in `wrangler.toml`. `resend` is imported only by the dev-only `app/newsletter/route.ts`.
- No data layer. Dashboard and guest screens hold local `useState` only; forms do not persist.
- Imports are relative (`../../lib/cn`). `tsconfig.json` has no `paths` alias and `@/` is not used.
- `framer-export/` is excluded from TypeScript and is never imported; it holds Framer-side reference material.

## Layers

**Delivery (public site):**
- Purpose: Serve the Framer pages byte-for-byte.
- Location: `app/route.ts`, `app/about/route.ts`, `app/contact/route.ts`, `app/destinations/route.ts`, `app/experiences/route.ts`, `app/private-stays/route.ts`, `app/services/route.ts`, `app/blog/route.ts` and the 18 nested pages under `app/private-stays/<slug>/`, `app/blog/<slug>/`, `app/services/<slug>/`.
- Contains: one `const HTML = "<!DOCTYPE html>…"` (166 KB to 672 KB) and `export function GET()`; every file has `export const dynamic = "force-static"`.
- Depends on: `public/assets/img/*.webp`, `public/assets/fonts/*.woff2` (referenced by root-relative URLs inside the HTML), Framer's own hosted runtime/CDN.
- Used by: `scripts/assemble-cloudflare.mjs`, Worker static assets.
- Note: the header comment in `app/route.ts` mentions `routeHandler()` in `lib/nextjs-export.ts`; that file does not exist.

**Build and host:**
- Purpose: Turn the Next build into the `out/` folder the Worker serves.
- Location: `scripts/assemble-cloudflare.mjs`, `wrangler.toml`, `_headers`, `package.json` script `host:cloudflare`.
- Depends on: `next build`, `lib/not-found-document.ts`, `brand/Logo Monogram/Curves_black.svg`.
- Needs Node >= 22.18 because the script imports a `.ts` file directly.

**Design tokens and styles:**
- Purpose: One token set feeds Tailwind v4 `@theme`.
- Location: `tokens.json`, `scripts/generate-theme.mjs`, `app/globals.css`, `lib/cn.ts`, `lib/fonts.ts`.
- `app/globals.css` order: `@layer theme, base, components, utilities;`, `@import "tailwindcss"`, custom variants `ar` (`:lang(ar)`) and `dense` (`[data-density="dense"]`), the generated theme block, then a hand-written `@layer base` (responsive hero/display/heading sizes, body, headings, focus ring, forced-colors).
- Run `npm run tokens` after editing `tokens.json`; `npm run tokens:check` fails when `app/globals.css` is stale.
- Arabic: `:root:lang(ar)` swaps `--face-display`/`--face-body` to Noto Naskh Arabic / Noto Sans Arabic and raises every line height.

**Components:**
- Purpose: Brand-conformant, RTL-safe, accessible building blocks.
- Location: `components/ui/`, `components/journey/`, `components/specimens/`, `components/icons/icons.tsx`, `components/status-frame.tsx`.
- Contains: `cva` variants + `cn()`, Radix primitives via the `radix-ui` package (Popover, Select, Dialog), `@internationalized/date` `CalendarDate` for dates, logical CSS utilities (`ps-`, `ms-`, `start-`, `border-s`, `rtl:`), `ar:` variant for Arabic overrides, square corners (`rounded-none`).
- Journey components take `copy: JourneyCopy` and `locale` as props and never read the cookie; UI primitives either take labels as props (`SiteNav` `labels`) or default to English.
- Depends on: `lib/cn.ts`, `lib/copy/*`, `lib/journey-format.ts`, `brand/` SVGs.
- Used by: React screens, the harness scenes, the embed bundle.

**Screens (dev only):**
- Purpose: Guest and ops front ends built to the design system, not yet connected to data.
- Location: `app/account/`, `app/login/`, `app/bookings/`, `app/booking/trip/`, `app/dashboard/`, `app/dashboard/(ops)/`.
- Pattern: `page.tsx` (server component: metadata + production gate + render) imports `<name>-screen.tsx` (`"use client"`, local state). Guest screens render `SiteNav` + `<main id="content">` + `WhatsApp`; ops screens render inside `(ops)/layout.tsx`.
- `app/booking/trip/trip-screen.tsx` reads the query `where, check-in, check-out, adults, children, infants` (written by the embed bundle) and shows an empty state; it does not use `components/journey`.
- `components/journey/*` is mounted today only by `tests/journey/scenes/*`; no real route uses it yet.

**Copy and locale:**
- Purpose: English, Arabic (RTL) and Spanish for every string.
- Location: `lib/copy/*.ts`, `lib/set-document-locale.ts`, `lib/journey-format.ts`, `lib/format.ts`.
- Types: `DocumentLocale` (`lib/set-document-locale.ts`), `HomeLocale`, `GuestLocale`, `DashboardLocale`, `JourneyLocale`, `Locale` all equal `"en" | "ar" | "es"`.
- Some screens still define a small inline `COPY` object per locale (`app/account/account-screen.tsx`, `app/login/sign-in-screen.tsx`, `app/bookings/bookings-screen.tsx`, `app/booking/trip/trip-screen.tsx`); new copy goes into `lib/copy/`.

**Dev-only services:**
- `app/fx/route.ts` (GET rates JSON), `app/newsletter/route.ts` (POST, Resend contact create, honeypot fields, 503 when `RESEND_API_KEY` is unset), `app/embed/hero-booker/route.ts` (esbuild bundle), `app/embed/font/[file]/route.ts` (three Lato TTFs from `brand/Font/lato/`).
- Every handler starts with `if (process.env.NODE_ENV === "production") return 404`.

**Test harness:**
- Purpose: Deterministic scenes of journey components for Playwright screenshots, RTL and a11y checks.
- Location: `app/%5F%5Fharness/page.tsx` (the on-disk folder name is literally `%5F%5Fharness`; the URL is `/__harness`), `app/%5F%5Fharness/harness-client.tsx`, `tests/journey/`.
- Gate: `export const dynamic = "force-dynamic"`, then `if (process.env.ALMAR_HARNESS !== "1") notFound()` before anything reads `searchParams`. `ALMAR_HARNESS=1` is set only in `playwright.config.ts` `webServer.env`.
- Query: `/__harness?c=<component>&s=<state>&l=<en|ar|es>`; `c` and `s` must match `^[a-z0-9_-]+$`.
- `harness-client.tsx` dynamically imports `tests/journey/scenes/${c}` and renders `scenes[s]({ locale, copy: copy[l].journey, fixtures })`.
- `tests/harness-gate.test.mjs` asserts: the gate precedes data access, the assemble script never mentions the harness, nothing outside `app/%5F%5Fharness` and `tests/` links to `__harness`.

## Data Flow

### Primary Request Path (production, public page)

1. Browser requests `https://almarprivatejourney.com/private-stays/getsemani-colonial-house`.
2. Cloudflare routes the custom domain to Worker `almar` (`wrangler.toml` `[[routes]]`).
3. The Worker's assets layer resolves `out/private-stays/getsemani-colonial-house.html` (`html_handling = "auto-trailing-slash"`), a verbatim copy of `.next/server/app/private-stays/getsemani-colonial-house.body`.
4. Images and fonts load from `out/assets/img/*.webp` and `out/assets/fonts/*.woff2` (copied from `public/`); `out/_headers` sets immutable caching for `/assets/*`, `*.webp`, `*.woff2`, `*.css`, `*.js`.
5. Framer's runtime (inside the HTML) hydrates the page; the `cache-control` headers set inside each `GET()` have no effect on the Worker.
6. Unknown path: `not_found_handling = "404-page"` returns `out/404.html` with status 404.

### Build and Deploy Path

1. `npm run host:cloudflare` runs `node scripts/assemble-cloudflare.mjs` (`scripts/assemble-cloudflare.mjs:11`).
2. It runs `npm run build` (needs network for `next/font/google` Noto fonts), deletes and recreates `out/`, copies `public/` into it.
3. It walks `.next/server/app` for `*.body`; `index.body` becomes `out/index.html`, every other `<path>.body` becomes `out/<path>.html` (26 files).
4. It writes `out/404.html` from `renderStaticNotFound()` and copies `_headers`.
5. It throws unless `out/index.html` and `out/404.html` exist, then `wrangler deploy` uploads `out/`. Only the ALMAR controller session deploys, and only on the owner's word.

### Hero booker embed (dev, not yet wired into the Framer HTML)

1. A page loads `/embed/hero-booker`; the handler checks the newest mtime of the files listed in `SOURCES` and re-bundles `lib/framer-hero-booker-mount.tsx` with `node_modules/esbuild/bin/esbuild` into `.next/cache/almar-hero-booker.js`.
2. The script defines `window.AlmarMountHeroBooker(host)`, which renders `HeroBooker` into the host element.
3. On Search it validates `where` against five destinations and calls `window.top.location.assign("/booking/trip?where=…&check-in=…&check-out=…&adults=…&children=…&infants=…")`.
4. The parent page may post `{ locale }` to switch language; only same-origin messages from `window.parent` are accepted.
5. No generated Framer page contains the mount call today (searched all 26 handlers).

### Locale and RTL

1. `app/layout.tsx` renders `lang="en" dir="ltr"` for every React page.
2. A screen mounts and calls `setDocumentLocale(locale)` (client effect), which sets `documentElement.lang`, `dir` and adds/removes the Noto font variable classes for Arabic.
3. `LocaleSelect` (kind `language`) writes cookie `almar-locale` (`Path=/`, one year, `SameSite=Lax`). Dashboard screens read it with `document.cookie` in an effect (`readLocale()` is duplicated per screen).
4. CSS reacts through `:root:lang(ar)` (font faces, line heights) and the `ar:` Tailwind variant.

**State Management:**
- React `useState` per screen; no global store, no context except `ToastProvider` in `components/ui/toast.tsx` (nothing mounts it in `app/` yet, so `SiteFooter`'s `useToast()` would throw outside a provider).
- Cookie `almar-locale` is the only persisted client state.
- `lib/fx/rates.ts` keeps a module-level `memory` cache of the last FX fetch (server process, 12 hours).

## Key Abstractions

**Framer page handler:**
- Purpose: A static page that is a string, not a React tree (React cannot emit Framer's hydration comment nodes).
- Examples: `app/route.ts`, `app/contact/route.ts`, `app/private-stays/baru-island-private-villa/route.ts`.
- Pattern: `export const dynamic = "force-static"; const HTML = "…"; export function GET() { return new Response(HTML, { headers }) }`. They are read-only exports: do not patch them (owner decision 2026-09-28: stop patching Framer HTML; replace pages in React at Phase 3.3 and 6).

**Design token:**
- Purpose: Name for a colour, size, spacing, radius, shadow, easing or animation.
- Examples: `tokens.json`, `lib/cn.ts` (`TOKEN_GROUPS`), the generated block in `app/globals.css`.
- Pattern: Utilities use token names (`bg-teal`, `text-label`, `h-control`, `max-w-column`, `shadow-selected`, `tracking-kicker`). Seven type steps only: caption 12, label 14, body 16, title 20, heading 32, display 48, hero 64. `--radius-control` and `--radius-overlay` are `0`.

**Variant component:**
- Purpose: One component, a closed set of looks.
- Examples: `components/ui/button.tsx` (`variant` primary/secondary/ghost/danger, `size` md/lg/bar/docked), `components/ui/link.tsx`, `components/ui/nav.tsx` (`tone`).
- Pattern: `cva(base, { variants, defaultVariants })` and `className={cn(variants({...}), className)}`.

**Controlled journey component:**
- Purpose: Booking-path pieces whose state lives in the parent.
- Examples: `components/journey/journey-bar.tsx` (`JourneyBarProps`: `size` hero/docked/summary, `value: JourneyValue`, `onChange`, `onSearch`, `copy`, `locale`, `today`, `blockedDates`, `forceMissing`, `lockDestination`), `components/journey/add-on-row.tsx`, `components/journey/journey-cart.tsx`.
- Pattern: `value` + `onChange`, shared types in `components/journey/types.ts` (`JourneyValue`, `AddOnItem`, `CartLine`, `Destination`, `TeamMember`). Placeholders are bracketed (`AED [PRICE]`), never invented amounts (`tests/journey/fixtures.ts`).

**Copy table:**
- Purpose: One typed object per locale.
- Examples: `HOME_COPY` (`lib/copy/home.ts`), `DASHBOARD_COPY` (`lib/copy/dashboard.ts`), `JOURNEY_COPY` (`lib/copy/journey.ts`, with `{name}` slots and `#` plural numbers filled by `lib/journey-format.ts`), `GUEST_COPY`.
- Pattern: `Record<Locale, XCopy>` with `en`, `ar`, `es`; the index re-exports them as `copy[locale].<area>`; `tests/copy.test.mjs` fails on a missing `ar` or `es` key.

**Scene (test):**
- Purpose: One state of one component for the harness.
- Examples: `tests/journey/scenes/journey-bar.tsx`, `tests/journey/scenes/journey-cart.tsx`.
- Pattern: `export const scenes: Scenes = { "state-name": (ctx) => <… /> }` with top-level two-space-indented keys; `tests/journey/matrix.ts` reads those keys as text to build the screenshot matrix (phone 390, tablet 834, desktop 1440 × en/ar/es).

## Entry Points

**Public pages:**
- Location: `app/route.ts` (home) and the other 25 `route.ts` Framer handlers.
- Triggers: Cloudflare request for the path (production) or `next dev`/`next start`.
- Responsibilities: Return the Framer HTML.

**Assemble and deploy:**
- Location: `scripts/assemble-cloudflare.mjs` (`npm run host:cloudflare`).
- Triggers: The controller session, by hand.
- Responsibilities: Build, assemble `out/`, deploy.

**Token generation:**
- Location: `scripts/generate-theme.mjs` (`npm run tokens`, `npm run tokens:check`).
- Triggers: After a `tokens.json` change; CI-style check in the controller's clean-clone run.

**Screens before/after report:**
- Location: `scripts/screens-diff.mjs`.
- Triggers: Manual; writes `tests/screens/INDEX.md` from `tests/screens/before` vs `tests/screens/after`.

**Dev server and tests:**
- Location: `npm run dev` (Next dev), `playwright.config.ts` (starts `npm run dev -- -H 127.0.0.1 -p 3010` with `ALMAR_HARNESS=1`; override port with `PW_PORT`), `npm test` = `node --test tests/*.test.mjs && playwright test`.

**Root layout:**
- Location: `app/layout.tsx`, wraps React pages, `not-found.tsx` and `error.tsx`.

## Architectural Constraints

- **Threading:** Node server in dev only; production has no server code. Embed bundling uses a child process (`execFile` of esbuild) inside `app/embed/hero-booker/route.ts`.
- **Global state:** `memory` in `lib/fx/rates.ts`; `cached` in `app/embed/hero-booker/route.ts`; `window.AlmarMountHeroBooker` and two `WeakMap`s in `lib/framer-hero-booker-mount.tsx`. Nothing else is module-level mutable.
- **Circular imports:** None detected.
- **Production gate is per page:** `app/dashboard/(ops)/layout.tsx` is a client component with no gate; every new React page and every new route handler must carry its own `NODE_ENV === "production"` check until a real runtime and auth exist.
- **`.body` is the only way into `out/`:** a new public page must be a `force-static` route handler returning HTML, or the assemble script must change (and `tests/harness-gate.test.mjs` still requires it to name only `.body` files and never the harness).
- **Brand SVG imports:** `next.config.ts` makes `Curves_black.svg` and `Poly_Black.svg` markup strings (`asset/source`); `Stacked_Charcoal.svg`, `Poly_White.svg`, `Curves_White.svg` are static-image objects (use `.src`). Do not pass an imported object through `encodeURIComponent`. Typings are in `svg.d.ts`.
- **Build needs network:** `lib/fonts.ts` uses `next/font/google` for Noto Naskh/Sans Arabic.
- **Node >= 22.18:** `scripts/assemble-cloudflare.mjs` and `tests/*.test.mjs` import `.ts` files natively. `package.json` has no `engines` field yet.
- **`npm run build` kills a running dev server**; restart it after (playwright config uses `reuseExistingServer: false`).
- **Square corners, no radios, gold is lines only:** enforced by `tests/design-tokens.test.mjs` and `tests/controls.test.mjs`; the Framer-era hexes `#f9f6f3`, `#183e43`, `#a98e58`, `#0f677d` and fonts Bricolage/Philosopher are banned in code.
- **`/design` and `/framer` are deleted** (Phase 3.1); `tests/removed-routes.spec.ts` asserts both are 404. The design system now lives in the claude.ai canvas (copy in `.planning/design/2026-10-01-canvas/`); code takes values from `tokens.json` only.

## Anti-Patterns

### Patching Framer HTML

**What happens:** Editing the `HTML` string inside an `app/**/route.ts` (copy, prices, team names, contact details).
**Why it's wrong:** Files are 166 KB to 672 KB of one line, regenerate-by-export artefacts, and the owner stopped patching them (2026-09-28). `tests/phase-03-locale.test.mjs` asserts `app/route.ts` stays a read-only `GET`.
**Do this instead:** Rebuild the page in React on the same URL with `components/ui` and `components/journey` (Phase 3.3), behind the production gate until the owner signs it.

### Hard-coded design values

**What happens:** Hex colours, pixel font sizes or raw spacing in components or `app/globals.css`.
**Why it's wrong:** `tests/design-tokens.test.mjs` fails; the canvas and code drift. (Known open item: hand-written font sizes in `app/globals.css` base layer and repeated hexes in `app/dashboard/(ops)/settings/settings-screen.tsx`.)
**Do this instead:** Add the value to `tokens.json`, run `npm run tokens`, use the utility (`text-label`, `bg-teal`, `h-control`). Update `TOKEN_GROUPS` in `lib/cn.ts` too.

### Unguarded React route or handler

**What happens:** A new `page.tsx` or `route.ts` without the production check.
**Why it's wrong:** Auth and data do not exist; the page would prerender real UI into a production build (it still would not reach `out/`, but `next start` and any future OpenNext runtime would serve it).
**Do this instead:** Copy the pattern from `app/account/page.tsx`: `if (process.env.NODE_ENV === "production") notFound();`.

### Single-locale strings in components

**What happens:** English literals in JSX, or per-screen inline `COPY` objects.
**Why it's wrong:** Every component, line, alt and section needs EN, AR and ES (owner rule); inline tables are not covered by the copy parity test.
**Do this instead:** Add keys to the right `lib/copy/*.ts` table (all three locales) and pass them down as props.

### Importing fixtures or scenes into app code

**What happens:** `harness-client.tsx` dynamically imports `tests/journey/scenes/*` and `tests/journey/fixtures`, which pulls test data into the Next build graph (listed open item).
**Why it's wrong:** Test code ships in the server bundle.
**Do this instead:** Keep every other import of `tests/` out of `app/`, `components/` and `lib/`.

## Error Handling

**Strategy:** Fail closed with 404; no custom error logging.

**Patterns:**
- Production-gated pages call `notFound()`; dev-only handlers return `new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })`.
- `app/newsletter/route.ts` returns `400` for honeypot or bad email, `503` when `RESEND_API_KEY` is empty (never a fake success), `502` when Resend returns no id.
- `app/fx/route.ts` returns 404 when no rate can be loaded; `lib/fx/rates.ts` retries the feed once and falls back to the cached value, otherwise `null`.
- `app/error.tsx` renders `StatusFrame` with a "Try again" ghost button calling `reset()`.
- The `/__harness` page returns 404 for a bad `c`, `s` or `l`; unknown scenes render `data-testid="harness-unknown"`, which the Playwright `settle()` helper rejects.

## Cross-Cutting Concerns

**Logging:** None. No logging library, no error tracker, no analytics (Framer's beacon was removed from the exported HTML).
**Validation:** Inline and local: `lib/https-url.ts` (`isHttpsUrl`, `canBecomeHttpsUrl`) for URL fields; `Field` shows errors; the newsletter handler validates email and honeypots; `isDocumentLocale()` guards locale values; embed code whitelists the five destinations.
**Authentication:** Not built. `/login` is a front-end shell ("Access with magic link") with no submit target; Supabase auth chain is planned in Phase 2 (job 02, branch `claude/project-thread-8h6bed`, not on `main`).
**Accessibility:** Skip link in `app/layout.tsx` targets `#content` (each screen provides `<main id="content">`); visible focus ring from `app/globals.css`; `inert` on closed dashboard nav; keyboard trap handling in `app/dashboard/(ops)/layout.tsx`.
**Security headers / secrets:** `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (names only, no values); `tests/phase-02-gates.test.mjs` scans `app`, `components`, `lib` for key material.

---

*Architecture analysis: 2026-10-02*
