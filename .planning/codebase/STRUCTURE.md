# Codebase Structure

**Analysis Date:** 2026-10-02

Verified at `main` 68df3b6. Excludes `node_modules/`, `.git/`, `.next/`, `out/` (all generated or vendored). Paths are repo-relative from `/Users/koss/Developer/almarprod-Website-Code`.

## Directory Layout

```
almarprod-Website-Code/
├── app/                          # Next.js App Router: Framer page handlers + dev-only React routes
│   ├── layout.tsx                # Root layout (html lang/dir, fonts, skip link) for React pages only
│   ├── globals.css               # Tailwind v4 entry; GENERATED:THEME block written from tokens.json
│   ├── not-found.tsx             # Dev React 404 (StatusFrame)
│   ├── error.tsx                 # Client error boundary
│   ├── route.ts                  # HOME: Framer HTML handler (672 KB string, force-static)
│   ├── about/ contact/ destinations/ experiences/ private-stays/ services/ blog/
│   │   └── route.ts              # Framer HTML handlers (one per page)
│   ├── private-stays/<12 slugs>/route.ts   # Stay detail pages (Framer HTML)
│   ├── blog/<3 slugs>/route.ts             # Blog posts (Framer HTML)
│   ├── services/<3 slugs>/route.ts         # Service pages (Framer HTML)
│   ├── account/                  # React guest screen: page.tsx + account-screen.tsx (prod 404)
│   ├── login/                    # React guest screen: page.tsx + sign-in-screen.tsx (prod 404)
│   ├── bookings/                 # React guest screen: page.tsx + bookings-screen.tsx (prod 404)
│   ├── booking/trip/             # React guest screen: page.tsx + trip-screen.tsx (prod 404)
│   ├── dashboard/
│   │   ├── page.tsx              # /dashboard placeholder "Sign in" (prod 404)
│   │   └── (ops)/                # Route group: layout.tsx (rail) + one folder per section
│   │       ├── home/ bookings/ customers/ calendar/ settings/ profile/
│   │       ├── catalog/{destinations,stays,experiences,packages}/   # share catalog-screen.tsx
│   │       └── content/{pages,blog,team,legal}/                     # share content-screen.tsx
│   ├── fx/route.ts               # GET FX rates (dev only)
│   ├── newsletter/route.ts       # POST Resend contact (dev only)
│   ├── embed/hero-booker/route.ts        # esbuild-bundled hero booker JS (dev only)
│   ├── embed/font/[file]/route.ts        # Lato TTFs for the embed (dev only)
│   └── %5F%5Fharness/            # URL /__harness: test harness, needs ALMAR_HARNESS=1
├── components/
│   ├── ui/                       # Design-system primitives (button, link, field, nav, dialog, ...)
│   ├── journey/                  # Booking-path components + types.ts
│   ├── specimens/hero-booker.tsx # Hero booker bundled for Framer embedding
│   ├── icons/icons.tsx           # All SVG icons (24/20/16)
│   └── status-frame.tsx          # Shared 404/error frame
├── lib/
│   ├── copy/                     # EN/AR/ES string tables + index.ts
│   ├── fx/rates.ts               # FX conversion + 12 h cache
│   ├── cn.ts                     # tailwind-merge with token names
│   ├── fonts.ts                  # next/font: Questa, Lato, Noto Naskh/Sans Arabic
│   ├── format.ts, journey-format.ts, https-url.ts
│   ├── set-document-locale.ts    # lang/dir/Noto class setter, DocumentLocale type
│   ├── not-found-document.ts     # renderStaticNotFound() for out/404.html
│   └── framer-hero-booker-mount.tsx   # Entry of the embed bundle
├── scripts/
│   ├── assemble-cloudflare.mjs   # build -> out/ (the production artefact)
│   ├── generate-theme.mjs        # tokens.json -> app/globals.css
│   └── screens-diff.mjs          # before/after screenshot diff report
├── tests/                        # node:test (*.test.mjs) + Playwright (*.spec.ts)
│   ├── journey/                  # harness scenes, fixtures, matrix, specs, __screenshots__/
│   ├── screens/{before,after}/   # 24 + 24 baseline PNGs and INDEX.md
│   └── account-select/           # 4 PNG baselines for the language select
├── public/assets/{img,fonts}/    # Self-hosted Framer assets (img/ 300 files, fonts/ 34 files), copied into out/
├── brand/                        # Brand source: logos, fonts, colours, icons, guideline PDF
├── framer-export/                # Framer-side reference (JSON + code components); not imported
├── tokens.json                   # Single source of design values
├── wrangler.toml                 # Worker `almar`: assets = ./out, custom domains, 404 page
├── _headers                      # Cache rules, copied into out/
├── next.config.ts                # SVG webpack rules for brand markup SVGs
├── tsconfig.json  svg.d.ts       # TS config (excludes framer-export), SVG module typings
├── postcss.config.mjs            # @tailwindcss/postcss
├── playwright.config.ts          # Dev server on 127.0.0.1:3010 with ALMAR_HARNESS=1
├── package.json  package-lock.json
├── .env.example                  # Names only: Supabase x3, RESEND_API_KEY
├── .mcp.json                     # Cloudflare, Supabase, Stripe, Resend MCP (OAuth, no keys)
├── .planning/                    # GSD project state, phases, decisions, design copies, this map
├── .claude/{rules,worktrees}/    # connections.md; worktrees/ is for work-session worktrees (empty)
├── .hermes/ .hermes.md           # Hermes bot measurement scripts and operating contract
├── CLAUDE.local.md               # Gitignored per-repo rules (read first)
├── HERMES.md README.md PLAN_FIX_ALL.md _README.txt   # Stale; do not trust (see ARCHITECTURE.md)
└── vercel.json Dockerfile .dockerignore               # Framer-exporter leftovers; not used for ALMAR
```

## Directory Purposes

**`app/`:**
- Purpose: Every URL. Two kinds of route live side by side.
- Framer handlers: 26 `route.ts` files (home, 7 section pages, 12 stays, 3 blog posts, 3 services). Each is one HTML string constant plus `GET()`, `force-static`. Only these reach production.
- React routes: `page.tsx` + `*-screen.tsx` pairs; always carry the `NODE_ENV === "production"` gate.
- Dev-only handlers: `app/fx/`, `app/newsletter/`, `app/embed/`.
- Do not add `page.tsx` at `app/` root: `app/route.ts` owns `/`.
- The harness folder is named `%5F%5Fharness` on disk because Next ignores folders starting with `_`; keep that exact name (`tests/harness-gate.test.mjs` reads `app/%5F%5Fharness/page.tsx`).

**`app/dashboard/(ops)/`:**
- Purpose: Ops dashboard shell; `(ops)` is a route group, so it adds no URL segment (`/dashboard/home`, not `/dashboard/ops/home`).
- Key files: `layout.tsx` (client; rail array `RAIL`, mobile menu, `data-density` set to compact), `home/home-screen.tsx`, `catalog/catalog-screen.tsx` (`kind` prop: destinations, stays, experiences, packages), `content/content-screen.tsx` (`kind`: pages, blog, team, legal), `settings/settings-screen.tsx`.
- `settings/page.tsx` is the only page that is `async` (calls `loadRates()` after the production gate).

**`components/ui/`:**
- Purpose: Primitives. Key files: `button.tsx`, `link.tsx`, `field.tsx` (text/area with password eye), `checkbox.tsx`, `switch.tsx`, `chip.tsx`, `stepper.tsx`, `calendar.tsx` (`CalendarPanel`, `formatDate`), `dialog.tsx`, `confirm-dialog.tsx`, `toast.tsx`, `sidebar.tsx` (drawer), `toggle-card.tsx`, `locale-select.tsx`, `nav.tsx` (`SiteNav`), `footer.tsx` (`SiteFooter`), `whatsapp.tsx` (floating WhatsApp link, `wa.me/971563883302`).

**`components/journey/`:**
- Purpose: Journey bar and booking-path pieces; props contract in `types.ts`. Key files: `journey-bar.tsx`, `journey-segment.tsx`, `destination-menu.tsx`, `date-range-panel.tsx`, `guest-panel.tsx`, `journey-sheet.tsx`, `step-rail.tsx`, `add-on-row.tsx`, `inclusions-list.tsx`, `journey-cart.tsx`, `team-section.tsx`.

**`lib/copy/`:**
- Purpose: Locale tables. `home.ts` (nav, home page, stays, services), `guest.ts` (login/bookings/account), `dashboard.ts` (rail, empty states, buttons), `journey.ts` (journey bar and cart, plural forms), `framer-source.ts` (EN/AR/ES for Framer home strings; currently unused outside tests), `index.ts` (`copy[locale]`).

**`tests/`:**
- Purpose: Source-level guardrails and Playwright specs. See Testing section below and `.planning/codebase/TESTING.md`.
- `tests/journey/scenes/<component>.tsx` must match a `components/journey/<component>.tsx` name and be listed in `tests/journey/matrix.ts`.
- `tests/screens/before/` is never regenerated.

**`public/assets/`:**
- Purpose: `img/` holds 245 `.webp`, 21 `.svg` and 34 font files that duplicate `fonts/`; `fonts/` holds 33 `.woff2` and 1 `.woff`. Referenced by root-relative URL (`/assets/img/<16-hex>.webp`) from the Framer HTML and from test fixtures. Copied wholesale into `out/`. Names are content hashes; do not rename.

**`brand/`:**
- Purpose: Owner-supplied brand source. Used by code: `brand/Logo Typography/Stacked_Charcoal.svg` (nav and dashboard header), `Poly_White.svg` (nav on image), `Poly_Black.svg`, `Curves_White.svg`, `brand/Logo Monogram/Curves_black.svg` (404 and `StatusFrame`), `brand/Font/questa-webfont/2-Questa_Regular.woff` and `brand/Font/lato/Lato-{Regular,Italic,Bold}.ttf` (loaded by `lib/fonts.ts`, also served by `app/embed/font/[file]/route.ts`). Everything else (`*.ai`, `*.jpg`, `*.png`, `Brand Guideline.pdf`, `Colors/`, `Icons/`) is reference only.

**`framer-export/`:**
- Purpose: Framer project reference (`canvas-components.json`, `component-bits.json`, `catalog.json`, `catalog.html`, `code/NotFoundCompass.tsx`, `code/NotFoundItinerary.tsx`, `code/Workshop/BlockScrollLoader.tsx`). Excluded from `tsconfig.json`; nothing imports it.

**`.planning/`:**
- Purpose: GSD and control-session records. `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `GOAL.md`, `CONTROL-BOARD.md`, `HANDOFF-2026-10-01-projects.md`, `config.json`; `phases/` (`01-design-system/`, `02-platform-spine/`, `03-public-site-and-dashboard/`, `03.1-design-system-and-journey-bar-inserted/`); `decisions/` (owner decisions, one dated file each + `README.md`); `prompts/` (work-session prompts, `00-common-rules.md` first); `research/`; `design/` (read-only copies of the claude.ai canvas and earlier audits); `codebase/` (this map). Work sessions do not edit `STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `GOAL.md`, `decisions/`, `prompts/`.

## Key File Locations

**Entry Points:**
- `app/route.ts`: home page (Framer HTML).
- `app/layout.tsx`: root layout for React pages.
- `scripts/assemble-cloudflare.mjs`: production build artefact (`npm run host:cloudflare`).
- `wrangler.toml`: Worker config.
- `app/%5F%5Fharness/page.tsx`: test harness (`/__harness?c=&s=&l=`).

**Configuration:**
- `tokens.json`: design values. `app/globals.css`: Tailwind v4 entry and generated theme. `postcss.config.mjs`, `next.config.ts`, `tsconfig.json`, `svg.d.ts`.
- `playwright.config.ts`, `package.json` scripts: `dev`, `build`, `start`, `host:cloudflare`, `test`, `tokens`, `tokens:check`.
- `.env.example`: variable names. `.env*.local` is gitignored; there is no `.env.local`.
- `_headers`: Cloudflare cache headers.

**Core Logic:**
- `components/ui/*.tsx`, `components/journey/*.tsx`: UI.
- `lib/copy/*.ts`: all text. `lib/set-document-locale.ts`: locale/RTL runtime. `lib/cn.ts`: class merge.
- `lib/fx/rates.ts`: currency conversion.
- `lib/not-found-document.ts`: static 404 document.
- `lib/framer-hero-booker-mount.tsx` + `app/embed/hero-booker/route.ts`: Framer embed.

**Testing:**
- `tests/*.test.mjs` (27 files): run with `node --test`. `tests/*.spec.ts` and `tests/journey/*.spec.ts` (19 files): Playwright. `tests/journey/{fixtures.ts,matrix.ts,scene-types.ts,scenes/}`: harness data. `tests/journey/__screenshots__/` (411 baseline PNGs), `tests/screens/`, `tests/account-select/`.

## Naming Conventions

**Files:**
- Components and libs: kebab-case, one component family per file: `journey-bar.tsx`, `date-range-panel.tsx`, `locale-select.tsx`, `set-document-locale.ts`.
- Route-local client component: `<section>-screen.tsx` next to its `page.tsx` (`account-screen.tsx`, `sign-in-screen.tsx`, `home-screen.tsx`).
- Route files are always `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`.
- Copy modules: lowercase noun (`home.ts`, `journey.ts`); exports are `UPPER_SNAKE_COPY` (`HOME_COPY`, `DASHBOARD_COPY`, `JOURNEY_COPY`, `GUEST_COPY`, `FRAMER_SOURCE_COPY`) with PascalCase types (`HomeCopy`, `JourneyCopy`).
- Tests: `<topic>.test.mjs` for node:test (`cn.test.mjs`, `harness-gate.test.mjs`, `phase-03-fx.test.mjs`), `<topic>.spec.ts` for Playwright (`not-found.spec.ts`, `journey/journey-bar.spec.ts`). Scenes: `tests/journey/scenes/<component-file-name>.tsx`. Screenshot baselines: `<component>-<state>-<locale>-<width>.png`, `<route>-<en|ar>-<width>.png`.
- Generated or hashed assets: `public/assets/img/<hash>.webp`.

**Directories:**
- Route folders mirror the URL (kebab-case slugs: `private-stays/getsemani-colonial-house`). Route groups in parentheses (`(ops)`). Dynamic segment `[file]`. The harness uses the encoded name `%5F%5Fharness`.
- Component folders by role (`ui`, `journey`, `specimens`, `icons`), never by page.

**Identifiers:**
- Components and types PascalCase; variables and functions camelCase; constants UPPER_SNAKE (`RAIL`, `DESTINATIONS`, `LOCALE_COOKIE`).
- Locale codes are always lowercase `"en" | "ar" | "es"`. Cookie name `almar-locale`.
- Imports are relative with explicit depth (`../../../lib/cn`); no path alias exists.

## Where to Add New Code

**New public page (production):**
- Today a public page is a `force-static` route handler returning HTML at `app/<slug>/route.ts` so the assemble script picks up its `.body`. Per the roadmap, new/rebuilt public pages are React (Phase 3.3 and 6): build them as `app/<slug>/page.tsx` + `<slug>-screen.tsx` behind the production gate, and the owner signs the cut-over that changes the assemble step.
- Tests: add a Playwright spec in `tests/` and a source guard in `tests/*.test.mjs` if a rule must not regress.

**New React screen (dev only):**
- Guest: `app/<route>/page.tsx` (metadata, `notFound()` in production, render) + `app/<route>/<name>-screen.tsx` (`"use client"`; `SiteNav`, `<main id="content">`, `WhatsApp`; call `setDocumentLocale`).
- Ops: `app/dashboard/(ops)/<section>/page.tsx` + `<section>-screen.tsx`; add the rail entry to `RAIL` in `app/dashboard/(ops)/layout.tsx` and its labels to `DashboardCopy.rail` in `lib/copy/dashboard.ts` (en, ar, es).

**New UI primitive:**
- `components/ui/<name>.tsx`: `cva` variants, `cn()`, token utilities only, logical CSS properties, `rounded-none`, `ar:` variants for Arabic. If the hero embed imports it, add the file to `SOURCES` in `app/embed/hero-booker/route.ts` (`tests/embed-sources.test.mjs` enforces this).

**New journey/booking component:**
- `components/journey/<name>.tsx` with props typed from `components/journey/types.ts`; copy keys in `lib/copy/journey.ts` (all three locales); a scene file `tests/journey/scenes/<name>.tsx` exporting `scenes`, an entry in `tests/journey/matrix.ts`, and a spec under `tests/journey/`.

**New design value:**
- Edit `tokens.json`, run `npm run tokens`, add the name to `TOKEN_GROUPS` in `lib/cn.ts`, update `tests/design-tokens.test.mjs` only with the controller's OK (shared file).

**New strings:**
- `lib/copy/<area>.ts` for en, ar and es together; expose through `lib/copy/index.ts`; use `fill()`/`formatPlural()` from `lib/journey-format.ts` for slots and plurals; numerals stay Western in Arabic.

**Utilities:**
- Shared helpers in `lib/<name>.ts` (pure, no React, importable by `node:test` without a loader: avoid importing `.svg` or `next/*` from files the node tests load).

**Dev-only API handler:**
- `app/<name>/route.ts` with `force-dynamic` and the production 404 guard as the first statement.

**Brand assets:**
- Put files in `brand/` and import them from there (charcoal logo: `import logo from "../../brand/Logo Typography/Stacked_Charcoal.svg"` then `logo.src`). Add a matching `declare module` to `svg.d.ts` for a new static-image SVG, or extend the `MARKUP_SVG` regex in `next.config.ts` for a markup SVG.

**Shared files (ask the controller first):** `lib/copy/*.ts`, `tokens.json`, `app/globals.css`, `next.config.ts`, `package.json`, `package-lock.json`, `wrangler.toml`, `tests/design-tokens.test.mjs`.

## Special Directories

**`out/`:**
- Purpose: Worker asset folder produced by `scripts/assemble-cloudflare.mjs`.
- Generated: Yes. Committed: No (`.gitignore`).

**`.next/`:**
- Purpose: Next build and dev cache; the assemble script reads `.next/server/app`; the embed route writes `.next/cache/almar-hero-booker.js`.
- Generated: Yes. Committed: No.

**`app/%5F%5Fharness/`:**
- Purpose: Flag-gated harness (`ALMAR_HARNESS=1`). Generated: No. Committed: Yes. Not copied into `out/`.

**`tests/journey/__screenshots__/`, `tests/screens/before/`, `tests/account-select/`:**
- Purpose: Playwright baseline images (`snapshotPathTemplate: "{testDir}/{arg}{ext}"`). Committed: Yes. `tests/screens/before/` is a frozen baseline.

**`tests/screens/after/`:**
- Purpose: Regenerated comparison images. Listed in `.gitignore`, yet 24 files are tracked.

**`.claude/worktrees/`:**
- Purpose: Git worktrees for work sessions (`.claude/worktrees/<job>`; never a sibling folder). Empty now. Not committed.

**`.planning/design/`:**
- Purpose: Read-only snapshots of the design canvas (`2026-10-01-canvas/` is current; `2026-09-28-audit/`, `2026-09-29-system/` are older). Never edit; the controller recopies on a canvas change.

**`.hermes/`:**
- Purpose: Old measurement scripts for the Hermes bot (`measure-short.mjs` still targets the deleted `/design`). Not part of the app.

**`node_modules/`:**
- Vendored; `esbuild` is present only as a transitive dependency (used by `app/embed/hero-booker/route.ts` without being declared in `package.json`).

---

*Structure analysis: 2026-10-02*
