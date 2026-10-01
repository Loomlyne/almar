# Technology Stack

**Analysis Date:** 2026-10-02

Verified against `package.json`, `package-lock.json` (lockfileVersion 3), `wrangler.toml`, `next.config.ts`, `tsconfig.json`, `tokens.json`, `scripts/`, and the app source at `main` = `68df3b6` (Phase 3.1 landed). `HERMES.md` still says Next 14.2.35 and is stale; `.planning/config.json` (`claude_md_path`) still points at it. `.hermes.md`, this file, and `package.json` are current.

## Languages

**Primary:**
- TypeScript 5.9.3 (`typescript@^5`) - all app code in `app/`, `components/`, `lib/`. `tsconfig.json`: `strict: true`, `target: ES2021`, `module: esnext`, `moduleResolution: bundler`, `jsx: preserve`, `allowJs: true`, `noEmit: true`, `isolatedModules: true`. Excludes `node_modules` and `framer-export`. No path aliases: every import is relative (`../../components/ui/button`).
- React/TSX - UI in `components/ui/*.tsx`, `components/journey/*.tsx`, and the `*-screen.tsx` client components under `app/`.

**Secondary:**
- JavaScript ESM (`.mjs`) - build scripts `scripts/*.mjs` and node tests `tests/*.test.mjs`. These import `.ts` files directly (for example `scripts/assemble-cloudflare.mjs` imports `../lib/not-found-document.ts`), so they rely on Node's built-in TypeScript type stripping.
- HTML/CSS/JS embedded as string constants - the 26 Framer-export pages (`app/route.ts` = home, 672 KB; `app/<page>/route.ts`; `app/private-stays/<slug>/route.ts`; `app/blog/<slug>/route.ts`; `app/services/<slug>/route.ts`). Each returns `const HTML = "..."` verbatim with `export const dynamic = "force-static"`. This HTML loads Framer's runtime from the Framer CDN (see `INTEGRATIONS.md`).
- CSS (Tailwind v4) - `app/globals.css`.
- JSON - `tokens.json` (design tokens, single source for the theme), `.mcp.json`, `.planning/config.json`.

## Runtime

**Environment:**
- Node.js >= 22.18 is the effective minimum: `wrangler@4.141.0` and `@supabase/supabase-js@2.117.2` declare `engines.node >= 22`, and the scripts/tests import `.ts` from `.mjs`. Local machine: Node v26.7.0, npm 11.19.0.
- No `.nvmrc`, no `.node-version`, and no `engines` field in `package.json` (a `"engines": { "node": ">=22.18" }` entry is job 04 item 2, `.planning/prompts/04-repo-tidy.md`).
- `Dockerfile` uses `node:20-alpine`, copies `package.json` only (no lockfile), runs `npm install`, `npm run build`, `npm start`. It is a Framer-exporter leftover and does not match the Node floor above. Not the deploy path.
- Deployed runtime: Cloudflare Workers (workerd) serving static assets only. `wrangler.toml` has `compatibility_date = "2026-09-23"` and no `main` entry, so no server code runs in production today.

**Package Manager:**
- npm 11.x
- Lockfile: present (`package-lock.json`, lockfileVersion 3). Install with `npm ci`.
- Dependency versions are exact pins except `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@types/node`, `typescript` (caret ranges).

## Frameworks

**Core:**
- Next.js 15.5.26 (App Router) - `app/` directory. Mix of route handlers (`route.ts`, Framer pages) and React pages (`page.tsx` + client `*-screen.tsx`). `next.config.ts` sets `reactStrictMode: true` and a custom `webpack()` hook (two SVG files are imported as raw markup via `asset/source`; see below). No `output: "export"`, no `images` config, no redirects/headers config.
- React 18.3.1 / react-dom 18.3.1 - React 18, not 19. Next 15.5 supports it.
- Tailwind CSS 4.3.3 with `@tailwindcss/postcss` 4.3.3 and PostCSS 8.5.28 - config is CSS-first in `app/globals.css` (`@import "tailwindcss"`, `@custom-variant ar`, `@custom-variant dense`, `@theme static`, `@theme inline`). `postcss.config.mjs` registers only `@tailwindcss/postcss`. No `tailwind.config.*`. No CSS modules (owner decision: Tailwind v4 only).
- Radix UI via the `radix-ui` umbrella package 1.6.7 - primitives in use: `Dialog` (`components/ui/dialog.tsx`, `confirm-dialog.tsx`, `sidebar.tsx`, `components/journey/journey-sheet.tsx`), `Select` (`components/ui/locale-select.tsx`), `Popover` (`components/journey/journey-bar.tsx`). `components/ui/dialog.tsx` and `confirm-dialog.tsx` also import `@radix-ui/react-focus-scope` directly; it resolves to 1.1.16 only as a transitive dependency of `radix-ui` and is not declared in `package.json`.
- class-variance-authority 0.7.1 (variants in 11 component files) and tailwind-merge 3.7.0 (used by `lib/cn.ts`, the shared `cn()` helper).
- @internationalized/date 3.12.4 - `CalendarDate` arithmetic for `components/ui/calendar.tsx`, `components/specimens/hero-booker.tsx`, journey panels.

**Testing:**
- Node built-in test runner (`node --test tests/*.test.mjs`) - source-text and pure-function checks (27 `.test.mjs` files).
- Playwright 1.63.0 (`@playwright/test`, chromium project only) - `tests/*.spec.ts` and `tests/journey/*.spec.ts`. Config `playwright.config.ts`: `testDir: "tests"`, snapshots at `{testDir}/{arg}{ext}`, zero-pixel-diff screenshots, dev server on `127.0.0.1:${PW_PORT ?? 3010}` with `ALMAR_HARNESS=1`, `reuseExistingServer: false`.

**Build/Dev:**
- `next dev` / `next build` / `next start` - `package.json` scripts `dev`, `build`, `start`.
- Wrangler 4.141.0 - Cloudflare deploys. `npm run host:cloudflare` = `node scripts/assemble-cloudflare.mjs && wrangler deploy`.
- `@opennextjs/cloudflare` 1.20.6 - installed (peer: Next >=15.5.24 <16, wrangler ^4.125) but NOT configured: no `open-next.config.ts`, no `.open-next/`, no worker `main` in `wrangler.toml`, no script that calls `opennextjs-cloudflare`. The Next server runtime on Cloudflare does not exist yet.
- esbuild 0.25.4 - hoisted transitive dependency (of `@opennextjs/aws`), not declared. Used only by the dev-only route `app/embed/hero-booker/route.ts`, which shells out to `node_modules/esbuild/bin/esbuild`.
- `scripts/generate-theme.mjs` - `npm run tokens` writes `tokens.json` into the block between `/* GENERATED:THEME:START */` and `/* GENERATED:THEME:END */` in `app/globals.css`; `npm run tokens:check` fails if it is out of date.
- `scripts/assemble-cloudflare.mjs` - runs `npm run build`, copies `public/` into `out/`, copies every `.next/server/app/**/*.body` to `out/<route>.html` (`index.html` for the home page), writes `out/404.html` from `renderStaticNotFound()` in `lib/not-found-document.ts`, copies `_headers`, and throws if `index.html` or `404.html` is missing.
- `scripts/screens-diff.mjs` - before/after screenshot ratios using `playwright-core/lib/coreBundle`; writes `tests/screens/INDEX.md`.

## Key Dependencies

**Critical:**
- `next` 15.5.26 - framework; builds the static route-handler output that becomes `out/`.
- `tailwindcss` 4.3.3 + `@tailwindcss/postcss` 4.3.3 - the only styling system. Theme values come from `tokens.json` through `scripts/generate-theme.mjs`; do not hand-edit the generated block in `app/globals.css`.
- `radix-ui` 1.6.7 - accessible primitives for every overlay and select.
- `@internationalized/date` 3.12.4 - date logic for the booking calendar and journey bar.
- `resend` 6.29.0 - the only third-party SDK with an import today: `app/newsletter/route.ts` (`new Resend(apiKey)`, `resend.contacts.create`).

**Infrastructure:**
- `@supabase/supabase-js` 2.117.2 and `@supabase/ssr` 0.12.7 - installed for Phase 2 auth; no file in `app/`, `lib/`, `components/` imports them yet.
- `@opennextjs/cloudflare` 1.20.6 and `wrangler` 4.141.0 - Cloudflare tooling (see Build/Dev).
- `stripe` - NOT installed. Stripe (TEST Payment Element) is planned only; no package, no code.
- Known package alerts (`.planning/CONTROL-BOARD.md`, `npm audit` on the 3.1 lockfile): 2 high (`postcss` bundled inside `next`, fix needs Next 16; `undici` inside `wrangler`, fix `wrangler@4.146.0`), 3 moderate.

**Fonts (self-hosted and build-time fetched), `lib/fonts.ts`:**
- Questa Regular (`brand/Font/questa-webfont/2-Questa_Regular.woff`, `--font-questa`) and Lato Regular/Italic/Bold (`brand/Font/lato/*.ttf`, `--font-lato`) via `next/font/local`, applied in `app/layout.tsx`.
- Noto Naskh Arabic (`--font-noto-naskh`) and Noto Sans Arabic (`--font-noto-sans`) via `next/font/google`; the classes are added to `<html>` by `setDocumentLocale("ar")` in `lib/set-document-locale.ts`. `next build` downloads these from Google Fonts at build time.
- Font stacks per locale live in `tokens.json` (`face.display`, `face.body`, `face.display-ar`, `face.body-ar`) and are switched with `:root:lang(ar)`.

## Configuration

**Environment:**
- Variable names are listed in `.env.example` (names only, values empty): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- `.gitignore` ignores `.env*.local`. No `.env.local` exists on this checkout; the app is not wired to Supabase.
- Other variables read by code or tests: `NODE_ENV` (production gate, see below), `ALMAR_HARNESS` (`app/%5F%5Fharness/page.tsx`, set only in `playwright.config.ts` `webServer.env`), `PW_PORT` (Playwright port), `SCREENS_MODE` (`tests/screens-before-after.spec.ts`).
- Production gate: every page or route that is not a Framer static page checks `process.env.NODE_ENV === "production"` and returns 404 / `notFound()`. This covers `app/login`, `app/account`, `app/bookings`, `app/booking/trip`, `app/dashboard/**`, `app/fx/route.ts`, `app/newsletter/route.ts`, `app/embed/**`. Only the Framer route handlers, the 404, and public assets are reachable in a production build.
- The design harness route is `app/%5F%5Fharness/` (URL `/__harness`); it 404s unless `ALMAR_HARNESS=1` (enforced by `tests/harness-gate.test.mjs`).

**Build:**
- `next.config.ts` - SVG handling: `brand/Logo Monogram/Curves_black.svg` and `Poly_Black.svg` are imported as raw markup strings (`asset/source`, regex `MARKUP_SVG`); every other SVG (for example `brand/Logo Typography/Stacked_Charcoal.svg`) is a Next static-image object, use `.src`. Types for this are in `svg.d.ts`. `tests/next-config.test.mjs` asserts `next.config.ts` is the only Next config.
- `tsconfig.json`, `postcss.config.mjs`, `playwright.config.ts`, `tokens.json`, `svg.d.ts` at the repo root.
- `wrangler.toml` - Worker `almar`, `workers_dev = true`, `[assets] directory = "./out"`, `html_handling = "auto-trailing-slash"`, `not_found_handling = "404-page"`, two `[[routes]]` custom domains (`almarprivatejourney.com`, `www.almarprivatejourney.com`). No `account_id`, no `main`, no `[vars]`, no bindings, no observability block.
- `_headers` - copied into `out/_headers`; `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, `*.webp`, `*.woff2`, `*.css`, `*.js`.
- Leftovers, not in the deploy path: `vercel.json`, `Dockerfile`, `.dockerignore`, `.vercel` (ignored), `README.md` ("Deploy to Vercel/Netlify"), `_README.txt`, `PLAN_FIX_ALL.md`, `framer-export/` (Framer catalog JSON and component source, excluded from `tsconfig.json`). `tests/host-config.test.mjs` forbids any `vercel` script in `package.json`.
- `.mcp.json` - four HTTP MCP connectors for Claude sessions (Cloudflare, Supabase, Stripe, Resend); OAuth, no keys in the file.

## Platform Requirements

**Development:**
- Node >= 22.18, npm 11, `npm ci`.
- Playwright chromium browser installed locally (`npx playwright install chromium`); tests start their own dev server on port 3010 (port 3000 is held by another local app).
- Checks before a hand-over (see `.planning/CONTROL-BOARD.md`): `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`, `npm run build`, `npx playwright test`.
- Fonts and brand assets are read from `brand/` (committed) and images from `public/assets/img` (300 files) and `public/assets/fonts`.

**Production:**
- Cloudflare Worker `almar` (static assets from `out/`) on the Cloudflare account "Almar Private Journey" (`f1d9a1fa...`, since 2026-10-02). Live domains: `almarprivatejourney.com`, `www.almarprivatejourney.com`, plus `almar.almar-private-journey.workers.dev`.
- Deploy is manual: `npm run host:cloudflare`, run with the ALMAR-only wrangler login and `CLOUDFLARE_ACCOUNT_ID` set (the default `~/.wrangler` login sees only the Vamos account; `wrangler.toml` has no `account_id` yet). Only on the owner's explicit word.
- The Next server runtime (OpenNext) is not configured, so production serves only what `scripts/assemble-cloudflare.mjs` puts in `out/`: the Framer static pages, `public/`, `404.html`, `_headers`.
- No CI (`.github/` absent).

---

*Stack analysis: 2026-10-02*
