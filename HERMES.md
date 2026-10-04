<!-- GSD:project-start source:PROJECT.md -->
## Project

**ALMAR Private Journeys**

A branded booking OS for ALMAR Private Journeys: UAE-based guests book a private Colombia trip (one destination at a time) with stay, add-ons, airport meet, and return — then pay a deposit or in full. Ops runs everything from a branded dashboard (CMS, bookings, customers, calendar, money, brand tokens). The current repo is a Framer→Next.js HTML export (portfolio only). This product is a rebuild, not string-patches on those files.

**Core Value:** A guest can complete a real trip booking (stay + add-ons + pay) and ops can run that booking and the public site from one branded system — no fake controls.

### Constraints

- **Stack**: Next.js 15.5.26 (bumped 2026-09-26 in 02-08), React 18, TypeScript, Tailwind v4. Cloudflare project name `almar`. Supabase + Stripe + Resend planned; create/paid only when Koss gates.
- **Git**: GitHub `Loomlyne/almar`. Since 2026-10-01 only the control session pushes `main`, one commit per job, on the owner's Ship; no PR unless he asks (`decisions/2026-10-01-control-session.md`).
- **Secrets**: none in repo or chat. Owner commands numbered, then wait.
- **Contact**: do not replace `inquiries@almarprivatejourney.com` / `+971 56 388 3302`.
- **Media**: Cloudflare only for files; Supabase never storage.
- **Stripe**: TEST until go-live plan. Custom branded Payment Element.
- **PII**: passport/ID highest security; owner extra confirm; last 4 only for cards.
- **Gated**: Cloudflare Worker/Pages + DNS + R2, Supabase project, Stripe live, Resend domain — one numbered step each, wait.
- **Quality**: every control live through UI, backend, DB, ops, public. No placeholders.
- **A11y**: keyboard, visible focus, field errors, alt text; icon-only needs a name.
- **Timezone**: UAE for calendars/slots. Stay nights as UAE calendar dates.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9.3 (`typescript@^5`) - all app code in `app/`, `components/`, `lib/`. `tsconfig.json`: `strict: true`, `target: ES2021`, `module: esnext`, `moduleResolution: bundler`, `jsx: preserve`, `allowJs: true`, `noEmit: true`, `isolatedModules: true`. Excludes `node_modules` and `framer-export`. No path aliases: every import is relative (`../../components/ui/button`).
- React/TSX - UI in `components/ui/*.tsx`, `components/journey/*.tsx`, and the `*-screen.tsx` client components under `app/`.
- JavaScript ESM (`.mjs`) - build scripts `scripts/*.mjs` and node tests `tests/*.test.mjs`. These import `.ts` files directly (for example `scripts/assemble-cloudflare.mjs` imports `../lib/not-found-document.ts`), so they rely on Node's built-in TypeScript type stripping.
- HTML/CSS/JS embedded as string constants - the 26 Framer-export pages (`app/route.ts` = home, 672 KB; `app/<page>/route.ts`; `app/private-stays/<slug>/route.ts`; `app/blog/<slug>/route.ts`; `app/services/<slug>/route.ts`). Each returns `const HTML = "..."` verbatim with `export const dynamic = "force-static"`. This HTML loads Framer's runtime from the Framer CDN (see `INTEGRATIONS.md`).
- CSS (Tailwind v4) - `app/globals.css`.
- JSON - `tokens.json` (design tokens, single source for the theme), `.mcp.json`, `.planning/config.json`.
## Runtime
- Node.js >= 22.18 is the effective minimum: `wrangler@4.141.0` and `@supabase/supabase-js@2.117.2` declare `engines.node >= 22`, and the scripts/tests import `.ts` from `.mjs`. Local machine: Node v26.7.0, npm 11.19.0.
- No `.nvmrc`, no `.node-version`, and no `engines` field in `package.json` (a `"engines": { "node": ">=22.18" }` entry is job 04 item 2, `.planning/prompts/04-repo-tidy.md`).
- `Dockerfile` uses `node:20-alpine`, copies `package.json` only (no lockfile), runs `npm install`, `npm run build`, `npm start`. It is a Framer-exporter leftover and does not match the Node floor above. Not the deploy path.
- Deployed runtime: Cloudflare Workers (workerd) serving static assets only. `wrangler.toml` has `compatibility_date = "2026-09-23"` and no `main` entry, so no server code runs in production today.
- npm 11.x
- Lockfile: present (`package-lock.json`, lockfileVersion 3). Install with `npm ci`.
- Dependency versions are exact pins except `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@types/node`, `typescript` (caret ranges).
## Frameworks
- Next.js 15.5.26 (App Router) - `app/` directory. Mix of route handlers (`route.ts`, Framer pages) and React pages (`page.tsx` + client `*-screen.tsx`). `next.config.ts` sets `reactStrictMode: true` and a custom `webpack()` hook (two SVG files are imported as raw markup via `asset/source`; see below). No `output: "export"`, no `images` config, no redirects/headers config.
- React 18.3.1 / react-dom 18.3.1 - React 18, not 19. Next 15.5 supports it.
- Tailwind CSS 4.3.3 with `@tailwindcss/postcss` 4.3.3 and PostCSS 8.5.28 - config is CSS-first in `app/globals.css` (`@import "tailwindcss"`, `@custom-variant ar`, `@custom-variant dense`, `@theme static`, `@theme inline`). `postcss.config.mjs` registers only `@tailwindcss/postcss`. No `tailwind.config.*`. No CSS modules (owner decision: Tailwind v4 only).
- Radix UI via the `radix-ui` umbrella package 1.6.7 - primitives in use: `Dialog` (`components/ui/dialog.tsx`, `confirm-dialog.tsx`, `sidebar.tsx`, `components/journey/journey-sheet.tsx`), `Select` (`components/ui/locale-select.tsx`), `Popover` (`components/journey/journey-bar.tsx`). `components/ui/dialog.tsx` and `confirm-dialog.tsx` also import `@radix-ui/react-focus-scope` directly; it resolves to 1.1.16 only as a transitive dependency of `radix-ui` and is not declared in `package.json`.
- class-variance-authority 0.7.1 (variants in 11 component files) and tailwind-merge 3.7.0 (used by `lib/cn.ts`, the shared `cn()` helper).
- @internationalized/date 3.12.4 - `CalendarDate` arithmetic for `components/ui/calendar.tsx`, `components/specimens/hero-booker.tsx`, journey panels.
- Node built-in test runner (`node --test tests/*.test.mjs`) - source-text and pure-function checks (27 `.test.mjs` files).
- Playwright 1.63.0 (`@playwright/test`, chromium project only) - `tests/*.spec.ts` and `tests/journey/*.spec.ts`. Config `playwright.config.ts`: `testDir: "tests"`, snapshots at `{testDir}/{arg}{ext}`, zero-pixel-diff screenshots, dev server on `127.0.0.1:${PW_PORT ?? 3010}` with `ALMAR_HARNESS=1`, `reuseExistingServer: false`.
- `next dev` / `next build` / `next start` - `package.json` scripts `dev`, `build`, `start`.
- Wrangler 4.141.0 - Cloudflare deploys, run by hand with the ALMAR login: `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy` (preview: add `-c wrangler.preview.toml` after `node scripts/assemble-cloudflare.mjs --target=preview`). No `package.json` script deploys.
- `@opennextjs/cloudflare` 1.20.6 - installed (peer: Next >=15.5.24 <16, wrangler ^4.125) but NOT configured: no `open-next.config.ts`, no `.open-next/`, no worker `main` in `wrangler.toml`, no script that calls `opennextjs-cloudflare`. The Next server runtime on Cloudflare does not exist yet.
- esbuild 0.25.4 - hoisted transitive dependency (of `@opennextjs/aws`), not declared. Used only by the dev-only route `app/embed/hero-booker/route.ts`, which shells out to `node_modules/esbuild/bin/esbuild`.
- `scripts/generate-theme.mjs` - `npm run tokens` writes `tokens.json` into the block between `/* GENERATED:THEME:START */` and `/* GENERATED:THEME:END */` in `app/globals.css`; `npm run tokens:check` fails if it is out of date.
- `scripts/assemble-cloudflare.mjs` - runs `npm run build`, copies `public/` into `out/`, copies every `.next/server/app/**/*.body` to `out/<route>.html` (`index.html` for the home page), writes `out/404.html` from `renderStaticNotFound()` in `lib/not-found-document.ts`, copies `_headers`, and throws if `index.html` or `404.html` is missing.
- `scripts/screens-diff.mjs` - before/after screenshot ratios using `playwright-core/lib/coreBundle`; writes `tests/screens/INDEX.md`.
## Key Dependencies
- `next` 15.5.26 - framework; builds the static route-handler output that becomes `out/`.
- `tailwindcss` 4.3.3 + `@tailwindcss/postcss` 4.3.3 - the only styling system. Theme values come from `tokens.json` through `scripts/generate-theme.mjs`; do not hand-edit the generated block in `app/globals.css`.
- `radix-ui` 1.6.7 - accessible primitives for every overlay and select.
- `@internationalized/date` 3.12.4 - date logic for the booking calendar and journey bar.
- `resend` 6.29.0 - the only third-party SDK with an import today: `app/newsletter/route.ts` (`new Resend(apiKey)`, `resend.contacts.create`).
- `@supabase/supabase-js` 2.117.2 and `@supabase/ssr` 0.12.7 - installed for Phase 2 auth; no file in `app/`, `lib/`, `components/` imports them yet.
- `@opennextjs/cloudflare` 1.20.6 and `wrangler` 4.141.0 - Cloudflare tooling (see Build/Dev).
- `stripe` - NOT installed. Stripe (TEST Payment Element) is planned only; no package, no code.
- Known package alerts (`.planning/CONTROL-BOARD.md`, `npm audit` on the 3.1 lockfile): 2 high (`postcss` bundled inside `next`, fix needs Next 16; `undici` inside `wrangler`, fix `wrangler@4.146.0`), 3 moderate.
- Questa Regular (`brand/Font/questa-webfont/2-Questa_Regular.woff`, `--font-questa`) and Lato Regular/Italic/Bold (`brand/Font/lato/*.ttf`, `--font-lato`) via `next/font/local`, applied in `app/layout.tsx`.
- Noto Naskh Arabic (`--font-noto-naskh`) and Noto Sans Arabic (`--font-noto-sans`) via `next/font/google`; the classes are added to `<html>` by `setDocumentLocale("ar")` in `lib/set-document-locale.ts`. `next build` downloads these from Google Fonts at build time.
- Font stacks per locale live in `tokens.json` (`face.display`, `face.body`, `face.display-ar`, `face.body-ar`) and are switched with `:root:lang(ar)`.
## Configuration
- Variable names are listed in `.env.example` (names only, values empty): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- `.gitignore` ignores `.env*.local`. No `.env.local` exists on this checkout; the app is not wired to Supabase.
- Other variables read by code or tests: `NODE_ENV` (production gate, see below), `ALMAR_HARNESS` (`app/%5F%5Fharness/page.tsx`, set only in `playwright.config.ts` `webServer.env`), `PW_PORT` (Playwright port), `SCREENS_MODE` (`tests/screens-before-after.spec.ts`).
- Production gate: every page or route that is not a Framer static page checks `process.env.NODE_ENV === "production"` and returns 404 / `notFound()`. This covers `app/login`, `app/account`, `app/bookings`, `app/booking/trip`, `app/dashboard/**`, `app/fx/route.ts`, `app/newsletter/route.ts`, `app/embed/**`. Only the Framer route handlers, the 404, and public assets are reachable in a production build.
- The design harness route is `app/%5F%5Fharness/` (URL `/__harness`); it 404s unless `ALMAR_HARNESS=1` (enforced by `tests/harness-gate.test.mjs`).
- `next.config.ts` - SVG handling: `brand/Logo Monogram/Curves_black.svg` and `Poly_Black.svg` are imported as raw markup strings (`asset/source`, regex `MARKUP_SVG`); every other SVG (for example `brand/Logo Typography/Stacked_Charcoal.svg`) is a Next static-image object, use `.src`. Types for this are in `svg.d.ts`. `tests/next-config.test.mjs` asserts `next.config.ts` is the only Next config.
- `tsconfig.json`, `postcss.config.mjs`, `playwright.config.ts`, `tokens.json`, `svg.d.ts` at the repo root.
- `wrangler.toml` - Worker `almar`, `workers_dev = true`, `[assets] directory = "./out"`, `html_handling = "auto-trailing-slash"`, `not_found_handling = "404-page"`, two `[[routes]]` custom domains (`almarprivatejourney.com`, `www.almarprivatejourney.com`). No `account_id`, no `main`, no `[vars]`, no bindings, no observability block.
- `_headers` - copied into `out/_headers`; `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, `*.webp`, `*.woff2`, `*.css`, `*.js`.
- Leftovers, not in the deploy path: `vercel.json`, `Dockerfile`, `.dockerignore`, `.vercel` (ignored), `README.md` ("Deploy to Vercel/Netlify"), `_README.txt`, `PLAN_FIX_ALL.md`, `framer-export/` (Framer catalog JSON and component source, excluded from `tsconfig.json`). `tests/host-config.test.mjs` forbids any `vercel` script in `package.json`.
- `.mcp.json` - four HTTP MCP connectors for Claude sessions (Cloudflare, Supabase, Stripe, Resend); OAuth, no keys in the file.
## Platform Requirements
- Node >= 22.18, npm 11, `npm ci`.
- Playwright chromium browser installed locally (`npx playwright install chromium`); tests start their own dev server on port 3010 (port 3000 is held by another local app).
- Checks before a hand-over (see `.planning/CONTROL-BOARD.md`): `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`, `npm run build`, `npx playwright test`.
- Fonts and brand assets are read from `brand/` (committed) and images from `public/assets/img` (300 files) and `public/assets/fonts`.
- Cloudflare Worker `almar` (static assets from `out/`) on the Cloudflare account "Almar Private Journey" (`f1d9a1fa...`, since 2026-10-02). Live domains: `almarprivatejourney.com`, `www.almarprivatejourney.com`, plus `almar.almar-private-journey.workers.dev`.
- Deploy is manual: build with `node scripts/assemble-cloudflare.mjs`, then the ALMAR-login `wrangler deploy` command above (plain `wrangler` uses the Vamos login on this Mac; `wrangler.toml` pins `account_id`). Only on the owner's explicit word. Runbook: `.planning/phases/02-platform-spine/02-RUNTIME-DEPLOY.md`.
- The Next server runtime (OpenNext) is not configured, so production serves only what `scripts/assemble-cloudflare.mjs` puts in `out/`: the Framer static pages, `public/`, `404.html`, `_headers`.
- No CI (`.github/` absent).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case for every source file: `components/journey/date-range-panel.tsx`, `lib/journey-format.ts`, `lib/set-document-locale.ts`.
- One component family per file, named for its main export: `components/ui/button.tsx` exports `Button`; `components/ui/toggle-card.tsx` exports `ToggleCard` and `ToggleCardGroup`.
- A client screen that backs a Next page is `<name>-screen.tsx` next to its `page.tsx`: `app/account/account-screen.tsx`, `app/dashboard/(ops)/catalog/catalog-screen.tsx`.
- Copy catalogues are `lib/copy/<area>.ts` (`home`, `guest`, `dashboard`, `journey`, `framer-source`). Barrel: `lib/copy/index.ts`.
- Test files: `tests/<subject>.test.mjs` (node) and `tests/<subject>.spec.ts` (Playwright). The `phase-0N-*` prefix is legacy; new tests use the subject name (`controls.test.mjs`, `overlays.test.mjs`).
- Next special files keep Next names: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`. The harness folder is the URL-encoded `app/%5F%5Fharness/` (serves `/__harness`).
- Components: PascalCase function declarations, named exports: `export function GuestPanel(...)`. Wrap with `forwardRef` only when a ref is needed (`JourneySegment` in `components/journey/journey-segment.tsx`).
- Helpers and handlers: camelCase verbs (`formatGuestSummary`, `isHttpsUrl`, `canBecomeHttpsUrl`, `setDocumentLocale`). Handlers declared inside the component as `function onSubmit(...)`, `function choose(...)`, `function show(...)`.
- Hooks: `useX` (`useDesktop` in `components/journey/journey-bar.tsx`, `useToast` in `components/ui/toast.tsx`).
- Type guards: `isX(value): value is X` (`isDocumentLocale` in `lib/set-document-locale.ts`).
- Module constants UPPER_SNAKE: `DEFAULT_LABELS`, `NAV_ROW_MIN`, `LOCALE_COOKIE`, `HONEYPOT_FIELDS`, `TOKEN_GROUPS`, `FX_URL`, `MARKUP_SVG`.
- Shared class strings are UPPER_SNAKE constants: `INPUT` in `components/ui/field.tsx`, `LINK` in `components/ui/nav.tsx`, `KICKER` in `components/journey/journey-cart.tsx`.
- Lookup tables are `Record<Locale, ...>` objects: `NUMBER_LOCALE` in `lib/journey-format.ts`, `INTL_TAG` in `components/journey/date-range-panel.tsx`.
- Use `type`, never `interface`. The repo has 96 `type` aliases and no `interface` except the `declare global { interface Window }` augmentation in `lib/framer-hero-booker-mount.tsx`.
- Props are an exported `type <Component>Props` next to the component (`JourneyBarProps`, `GuestPanelProps`, `AddOnListProps`). Small UI primitives may use an inline or unexported `type`.
- Locale union is `"en" | "ar" | "es"`. Canonical names: `Locale` (`lib/copy/index.ts`, re-declared in `components/journey/types.ts`) and `DocumentLocale` (`lib/set-document-locale.ts`). Per-area aliases (`HomeLocale`, `GuestLocale`, `DashboardLocale`, `JourneyLocale`) are the same union; prefer `DocumentLocale` or `Locale` in new code.
- Shared journey contracts live in `components/journey/types.ts` (`JourneyValue`, `Destination`, `AddOnItem`, `CartLine`, `TeamMember`, `ImageRef`). Add new journey types there.
- Derived string-literal unions use `NonNullable<VariantProps<typeof button>["variant"]>` (`components/ui/button.tsx`) or `keyof typeof X`.
## Code Style
- No Prettier, ESLint, Biome or `.editorconfig` is configured. Formatting is by hand; match the surrounding file.
- 2-space indent, double quotes, semicolons, trailing commas in multiline literals and argument lists.
- Long Tailwind `className` strings and `cva` base strings stay on one line (no wrapping, no sorting plugin).
- TypeScript is `strict` (`tsconfig.json`). `npx tsc --noEmit` is the only static gate and it is clean. It covers `app`, `components`, `lib`, `tests/**/*.ts(x)` and `scripts` types; `.mjs` files are not type-checked. `framer-export/` is excluded.
- Do not add `any`, `@ts-ignore` or `@ts-expect-error` (none exist). One `// eslint-disable-next-line react-hooks/exhaustive-deps` remains in `components/journey/journey-bar.tsx` for the memoised popover anchor; ESLint itself is not installed.
- None. Rules are enforced by tests instead: `tests/design-tokens.test.mjs` (styling), `tests/controls.test.mjs` (control markup), `tests/overlays.test.mjs` (z-layers, dismissal), `tests/harness-gate.test.mjs`, `tests/no-team-names.test.mjs`, `tests/phase-02-gates.test.mjs`. See `.planning/codebase/TESTING.md`.
## Styling and Design-System Rules (guarded by `tests/design-tokens.test.mjs`)
- **Single token source:** `tokens.json` -> `npm run tokens` -> the block between `/* GENERATED:THEME:START */` and `/* GENERATED:THEME:END */` in `app/globals.css`. Never hand-edit that block. `npm run tokens:check` fails when it drifts.
- **No CSS modules** (`*.module.css` is banned) and no class or id selectors in `app/globals.css` outside the generated block. `globals.css` must stay under 200 lines, start with `@layer theme, base, components, utilities;`, and keep every rule inside `@layer base`.
- **No raw hex** in scoped source: any `#rrggbb` must exist in `tokens.json`. Use utilities (`bg-teal`, `text-ink`, `bg-ivory`, `bg-surface`, `bg-teal-tint`, `border-line`, `text-muted`, `text-error`). Banned legacy strings: `Bricolage`, `Philosopher`, `#f9f6f3`, `#183e43`, `#a98e58`, `#0f677d`.
- **No arbitrary values:** any Tailwind class containing `[...]` fails (this also blocks raw px font sizes such as `text-[13px]`). Add a token to `tokens.json` instead.
- **Type scale is exactly seven steps:** `text-caption` 12, `text-label` 14, `text-body` 16, `text-title` 20, `text-heading` 32, `text-display` 48, `text-hero` 64. `hero`, `display`, `heading` shrink below 48rem in `app/globals.css` (`@layer base`). Fonts via `font-display` (Questa / Noto Naskh Arabic) and `font-body` (Lato / Noto Sans Arabic). `font-bold` is allowed only in `journey-cart.tsx`, `stepper.tsx`, `date-range-panel.tsx`, `journey-bar.tsx`, `journey-sheet.tsx`.
- **Square corners:** `--radius-control` and `--radius-overlay` are `0`. Write `rounded-none` explicitly on controls; any other `rounded-*` fails. 
- **Gold is a line only:** `border-gold`, `decoration-gold`, `border-t-2 border-gold` are fine; `bg-gold`, `text-gold`, `fill-gold`, `stroke-gold` (with or without opacity) fail.
- **No radio inputs** (`type="radio"` fails in `app/` and `components/`). One-of-many is `ToggleCardGroup` (buttons with `aria-pressed`, `components/ui/toggle-card.tsx`); on/off is `Switch` (`role="switch"`) or `Checkbox`.
- **Spacing scale:** padding, margin, gap, inset, top/bottom/start/end accept only `0, px, 0.5, 1, 2, 3, 4, 6, 8, 12, 16`. Fixed dimensions use named tokens: `h-control` (44px hit target), `h-chip`, `h-bar`, `h-bar-docked`, `h-summary`, `h-entry`, `h-action`, `h-sheet-head`, `w-menu`, `w-search`, `max-w-column`, `max-w-dialog`, `w-sidebar`, `h-row`, `dense:h-row-dense`.
- **Physical-direction utilities are banned:** no `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`. Use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `inset-s-`, `inset-e-`, `text-start`, `text-end`, `border-s`, `border-e`.
- **Other bans:** `.dark` selectors, `dangerouslySetInnerHTML`, `framerusercontent` URLs in non-route code.
- **Custom variants** (`app/globals.css`): `ar:` matches `:lang(ar)` (use `ar:normal-case ar:tracking-normal` next to every `uppercase tracking-kicker`), `dense:` matches `[data-density="dense"]`. Container queries (`@container`, `@6xl:`, `@2xl:`) are used in `components/ui/nav.tsx` and `components/ui/footer.tsx`.
- **Variants and merging:** class-variance-authority for variants, `cn()` from `lib/cn.ts` for merging. `cn` is `tailwind-merge` extended with the token groups; `TOKEN_GROUPS` in `lib/cn.ts` is a hand mirror of `tokens.json` and `tests/cn.test.mjs` fails on drift. Add a token to both.
- **Motion:** `duration-fast` / `duration-mid` with `ease-standard`; entrance animations pair `animate-panel-in motion-reduce:animate-fade-in`; skeleton pulses add `motion-reduce:animate-none`.
- **Focus:** the global `:focus-visible` rule (2px teal outline, 2px offset, `app/globals.css`) is the focus ring. Only `JourneySegment` (`shadow-rule-primary`) and `Field` (`shadow-selected` + teal border) replace it; `tests/journey/a11y.spec.ts` fails any other deviation.
- **Layering:** dialogs and sheets `z-70` with scrim `bg-ink/40`, WhatsApp `z-60`, toast `z-50` (these four are asserted in `tests/overlays.test.mjs`); journey popovers `z-45`, site nav `z-40`. No arbitrary `z-[..]`.
- **Legacy hook classes** `ui-button`, `ui-chip`, `ui-input`, `choice`, `field-*` remain on a few primitives as inert markers (no CSS targets them). Do not add new ones.
- **Passwords:** a password input goes through `Field type="password"` (`components/ui/field.tsx`), which renders the show/hide eye at the inline end. Guest sign-in is magic link only; no password field on guest screens (`tests/phase-03-guest.test.mjs`).
## Import Organization
- None. `tsconfig.json` has no `paths`. All imports are relative (`../../lib/cn`).
- Use `import type { ... }` for type-only imports, and inline `type` specifiers in mixed imports: `import { useState, type ReactNode } from "react";`.
- Radix is imported as the umbrella package: `import { Dialog, Popover, Select } from "radix-ui";` (`@radix-ui/react-focus-scope` is the one direct sub-package).
- Brand SVGs: `Stacked_Charcoal.svg`, `Poly_White.svg`, `Curves_White.svg` import as static-image objects, use `.src` (typed in `svg.d.ts`). `Curves_black.svg` and `Poly_Black.svg` import as markup strings (`asset/source` rule in `next.config.ts`) and become a data URL: `` `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}` ``. Never pass a static-image object through `encodeURIComponent` (becomes `[object Object]`; `tests/status-mark.spec.ts` guards it).
- Files that Node tests import directly (`lib/cn.ts`, `lib/journey-format.ts`, `lib/https-url.ts`, `lib/fx/rates.ts`, `lib/not-found-document.ts`, `lib/copy/<area>.ts`) must load under Node's native type stripping: erasable TypeScript only, no runtime relative imports without a file extension. `lib/journey-format.ts` has no imports on purpose. Tests never import `lib/copy/index.ts`.
## Error Handling
- Pure helpers that can fail return `null` (never throw, never invent a fallback): `parseWrittenAmount`, `convertWrittenAmount`, `loadRates` in `lib/fx/rates.ts`. Network reads sit in `try { ... } catch { return null; }` and validate the JSON shape before use. A feed failure falls back to the last cached value or `null`; no "rate unavailable" string exists anywhere (`tests/phase-03-fx.test.mjs`).
- Route handlers return explicit status codes and a JSON `{ ok: false }` body, no stack text: 400 bad input or honeypot hit, 503 missing `RESEND_API_KEY`, 502 upstream error, 404 in production (`app/newsletter/route.ts`). Success is `{ ok: true, id }` only when `data.id` is a non-empty string.
- Dev-only routes and pages gate on `process.env.NODE_ENV === "production"` and answer 404 (`notFound()` in pages; `new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })` in `route.ts`). Applies to `app/fx`, `app/newsletter`, `app/embed/*`, `app/account`, `app/login`, `app/bookings`, `app/booking/trip` and every `app/dashboard/**` page. The one exception is `app/%5F%5Fharness/page.tsx`, which gates on `ALMAR_HARNESS !== "1"` instead. Server `page.tsx` files stay server components (no `"use client"`) and delegate to the `<name>-screen.tsx` client component.
- Secrets come from `process.env` only. `.env.example` lists names with empty values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`). Never write a value into the repo. `tests/phase-02-gates.test.mjs` fails if the substrings `eyJ` or `re_` appear anywhere under `app/`, `components/`, `lib/`; avoid identifiers that contain them.
- UI validation is inline, never a thrown error: an error line with `role="alert"` (or the `Field` error `<p>`), `aria-invalid="true"` on the control, `aria-describedby` pointing at the message id (`components/journey/journey-bar.tsx`, `components/ui/field.tsx`, `components/ui/toggle-card.tsx`). Typing is never blocked: `canBecomeHttpsUrl` in `lib/https-url.ts` flags an https:// field only once the value can no longer become one.
- Missing provider is the one deliberate throw in components: `useToast()` throws `ToastProvider is missing` (`components/ui/toast.tsx`).
- Route error boundary: `app/error.tsx` renders `StatusFrame` with a `Try again` ghost `Button`; 404 is `app/not-found.tsx` plus the static `out/404.html` from `renderStaticNotFound()` in `lib/not-found-document.ts`.
- Build scripts (`scripts/*.mjs`) throw `Error` with a plain message, or `console.error` plus `process.exit(1)` (`scripts/generate-theme.mjs --check`).
- Never invent data: no seeded rows, no sample people, no real prices. Unknown amounts are brackets: `AED [PRICE]`, `AED [AMOUNT]`, `[RATE]%`. No file under `app/dashboard` or `lib` may be named `seed`. Publish buttons that have no backend are `<Button onClick={() => undefined}>`; do not fake a saved state (`tests/phase-03-catalog.test.mjs`, `tests/phase-03-content.test.mjs`).
## Logging
## Comments
- Exported component props get a one-line JSDoc stating behaviour or the contract, with the decision id in parentheses: `/** Fires only when destination and both dates are set. Never charges (D-37). */`.
- Props that exist only for tests are marked `Harness only:` (`initialOpen`, `forceMissing` in `JourneyBarProps`; `defaultOpen` in `JourneyCartProps`; `initialWarn` in `JourneySheetProps`; `placeholder` in `TeamSection`). Clock inputs are injectable as `today?: CalendarDate` with `/** Injectable for deterministic tests. */`.
- A file may open with a one-line provenance comment naming the plan and decisions: `// Journey copy catalogue (plan 03.1-10, D-08, D-33, D-52, D-58).` Decision ids (`D-nn`) and threat ids (`T-3.1-nn`) trace to `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-CONTEXT.md`.
- Explain why a non-obvious CSS or a11y choice exists (`// The 3px in-segment rule is the only exception to the 2px outline focus rule (D-36).`).
- No `TODO`, `FIXME`, `HACK` in code (none exist). Open work goes to `.planning/`.
- `/** ... */` on exported functions and props; `//` for inline notes. No `@param` / `@returns` tags.
## Function Design
- Components take one destructured props object; defaults are set in the destructuring (`footer = true`, `size = "row"`, `busy = false`).
- Components that show text take `copy: JourneyCopy` and `locale: Locale` as props and never import the catalogue themselves (`components/journey/*`). Primitives take every visible string as a prop (`Stepper` `addLabel`/`removeLabel`, `Dialog` `title`/`closeLabel`).
- Controlled by default: `value` + `onChange`. Optional uncontrolled fallback via internal state only where a call site needs it (`Switch` `defaultChecked`, `SiteNav` `currency`).
- Variants are string unions via `cva` (`size: "hero" | "docked" | "summary"`), not booleans, except `journey`/`inline`/`on`/`muted` flags that toggle one style group.
- Icon-only controls have `aria-label`; SVGs are inline, `currentColor`, `aria-hidden="true"` unless given a `title` (`components/icons/icons.tsx`). Icons come from `components/icons/icons.tsx` only, sizes `16 | 20 | 24`.
- Steppers set `aria-disabled` (not `disabled`) at the bounds so focus stays (`components/ui/stepper.tsx`). Live counts use `aria-live="polite"`. Toggle buttons use `aria-pressed`. Hit targets are 44px (`size-control`, `min-h-control`).
- Dialogs trap focus with `FocusScope trapped loop`; `dismiss="confirm"` blocks Escape and outside press (`components/ui/dialog.tsx`, `components/ui/confirm-dialog.tsx`).
- Date text is Western numerals `DD/MM/YYYY`.
## Module Design
- Named exports everywhere. Default export only for Next special files (`page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`). Route handlers export named `GET` / `POST` functions.
- Types are exported next to their component or from `components/journey/types.ts`.
- Only `lib/copy/index.ts` (`copy[locale].home | guest | dashboard | framerSource | journey`). Components import the file they need directly, there are no `index.ts` barrels in `components/`.
- First line of any file that uses hooks, event handlers, browser APIs or Radix. Server `page.tsx` files must not have it. A few existing leaf files use hooks without the directive (`components/ui/switch.tsx`, `components/ui/field.tsx`, `components/journey/inclusions-list.tsx`, `components/journey/team-section.tsx`); they work only because client modules import them. Do not copy that: add the directive to new hook-using files.
- `app/<route>/route.ts` for the public marketing pages (home, about, blog posts, private stays, services...) are generated Framer HTML served verbatim (`export const dynamic = "force-static"` plus `export function GET()` returning `new Response(html, ...)`, up to ~670 KB each). Do not hand-edit or reformat them; the guard tests skip them. There is no `app/page.tsx` (`tests/phase-03-screens.test.mjs`).
- Real React screens are the dev-gated `app/account`, `app/login`, `app/bookings`, `app/booking/trip`, `app/dashboard/(ops)/**`.
## i18n and RTL
- **Copy lives in `lib/copy/*.ts`**, one `Record<Locale, Type>` per area. Journey copy is the model: an `EN` object literal, `type JourneyCopy = Widen<typeof EN>`, then `AR: JourneyCopy` and `ES: JourneyCopy` so the compiler rejects a missing key, and `tests/copy.test.mjs` rejects an empty string. Plurals are `{ one, two, few, many, other }` forms with `#` for the number, filled by `formatPlural`; named slots are `{name}`, filled by `fill()`; both in `lib/journey-format.ts`.
- **EN, AR and ES in the same pass for every string, label, alt text and aria-label.** AR is Gulf-friendly MSA and ES is neutral Latin American; both are drafts for owner review (`lib/copy/journey.ts` header). Do not translate owner-approved texts; use them verbatim.
- **Arabic is RTL** via `document.documentElement.dir` set by `setDocumentLocale()` (`lib/set-document-locale.ts`), which also swaps in the Noto font classes. Locale persists in the `almar-locale` cookie (`SameSite=Lax`, one year). Layout uses logical utilities only (see bans above). Directional glyphs (chevron, arrow, search) carry `rtl:-scale-x-100`; plus, minus, check, close never flip (`tests/journey/rtl.spec.ts`).
- Latin values inside Arabic text (dates `12/10/2026`, references `ALMAR-000000`) sit in `<bdi dir="ltr">` or `<bdi>`.
- Numbers are Western digits in all locales: `ar-AE-u-nu-latn` (`lib/format.ts`, `lib/journey-format.ts`); Arabic calendar stays Gregorian (`ar-AE-u-ca-gregory-nu-latn`); weeks start Monday (`getDayOfWeek(date, "fr-FR")` or `"en-GB"`). Dates use `@internationalized/date` `CalendarDate`, never JS `Date` arithmetic across zones; the dashboard calendar uses `Asia/Dubai`.
- Radix does not read document direction: pass `dir` explicitly (`LocaleSelect` derives it from the language).
## Known Drift (do not copy; fix when touching)
- Hard-coded English in older primitives: `components/ui/footer.tsx`, `components/ui/nav.tsx` (`DEFAULT_LABELS`), `components/ui/field.tsx` (`Apply`, `optional`, `Hide password` / `Show password`), `components/ui/toast.tsx` (`Dismiss`), `components/ui/sidebar.tsx` (`Close`), `components/ui/whatsapp.tsx` (`WhatsApp`), `app/layout.tsx` (`Skip to content`), dashboard screens (`app/dashboard/(ops)/**`: `Date range`, `Reminders`, `Charts`, stay editor labels). New code takes copy through `lib/copy` and props.
- Local `COPY` tables in `app/account/account-screen.tsx` and `app/login/sign-in-screen.tsx` duplicate `GUEST_COPY` in `lib/copy/guest.ts` and are not covered by `tests/copy.test.mjs`. Use `lib/copy`.
- `bg-white` (not the `surface` token) in `app/dashboard/(ops)/home/home-screen.tsx`; the guard does not catch Tailwind default colours. Use `bg-surface`.
- Duplicated helpers: `pad` / `fmt` / `bdi` / `fillNodes` in `components/journey/journey-bar.tsx`, `journey-sheet.tsx`, `date-range-panel.tsx`; `fill` in `components/specimens/hero-booker.tsx` vs `lib/journey-format.ts`; `formatDate` in `lib/format.ts` vs `components/ui/calendar.tsx`. Reuse `lib/journey-format.ts`.
- Inline `style={{...}}` appears twice (`app/%5F%5Fharness/harness-client.tsx`, `app/dashboard/(ops)/layout.tsx` safe-area padding). Prefer utilities.
- The design skills named in `.claude/rules/connections.md` (`better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, `better-writing`) are global Claude skills, not project files; `.claude/skills/` and `.agents/skills/` do not exist in this repo.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- The only thing the Worker serves is `out/`. Anything that does not produce a `.body` file in `.next/server/app` (React pages, dynamic route handlers, `/__harness`) cannot reach production, whatever its code says.
- Production 404s for React routes are enforced twice: each `page.tsx` calls `notFound()` when `process.env.NODE_ENV === "production"`, and the assemble script never copies their `.html`. Verified with a real `next build` on 2026-10-02: `/account`, `/login`, `/bookings`, `/booking/trip`, `/dashboard` and the 14 `/dashboard/**` pages emit `.html` (+ `.rsc`) holding the `__next_error__` document (`account.meta` reads `"status": 404`) and no `.body`, so none is copied; exactly 26 `.body` files exist.
- No server runtime exists. `@opennextjs/cloudflare`, `@supabase/ssr`, `@supabase/supabase-js` are in `package.json` but nothing in `app/`, `lib/`, `components/` or `scripts/` imports them; there is no `middleware.ts`, no `open-next.config.ts`, no `main` in `wrangler.toml`. `resend` is imported only by the dev-only `app/newsletter/route.ts`.
- No data layer. Dashboard and guest screens hold local `useState` only; forms do not persist.
- Imports are relative (`../../lib/cn`). `tsconfig.json` has no `paths` alias and `@/` is not used.
- `framer-export/` is excluded from TypeScript and is never imported; it holds Framer-side reference material.
## Layers
- Purpose: Serve the Framer pages byte-for-byte.
- Location: `app/route.ts`, `app/about/route.ts`, `app/contact/route.ts`, `app/destinations/route.ts`, `app/experiences/route.ts`, `app/private-stays/route.ts`, `app/services/route.ts`, `app/blog/route.ts` and the 18 nested pages under `app/private-stays/<slug>/`, `app/blog/<slug>/`, `app/services/<slug>/`.
- Contains: one `const HTML = "<!DOCTYPE html>…"` (166 KB to 672 KB) and `export function GET()`; every file has `export const dynamic = "force-static"`.
- Depends on: `public/assets/img/*.webp`, `public/assets/fonts/*.woff2` (referenced by root-relative URLs inside the HTML), Framer's own hosted runtime/CDN.
- Used by: `scripts/assemble-cloudflare.mjs`, Worker static assets.
- Note: the header comment in `app/route.ts` mentions `routeHandler()` in `lib/nextjs-export.ts`; that file does not exist.
- Purpose: Turn the Next build into the `out/` folder the Worker serves.
- Location: `scripts/assemble-cloudflare.mjs`, `wrangler.toml`, `_headers`, `package.json` scripts `build:cloudflare` and `build:preview`.
- Depends on: `next build`, `lib/not-found-document.ts`, `brand/Logo Monogram/Curves_black.svg`.
- Needs Node >= 22.18 because the script imports a `.ts` file directly.
- Purpose: One token set feeds Tailwind v4 `@theme`.
- Location: `tokens.json`, `scripts/generate-theme.mjs`, `app/globals.css`, `lib/cn.ts`, `lib/fonts.ts`.
- `app/globals.css` order: `@layer theme, base, components, utilities;`, `@import "tailwindcss"`, custom variants `ar` (`:lang(ar)`) and `dense` (`[data-density="dense"]`), the generated theme block, then a hand-written `@layer base` (responsive hero/display/heading sizes, body, headings, focus ring, forced-colors).
- Run `npm run tokens` after editing `tokens.json`; `npm run tokens:check` fails when `app/globals.css` is stale.
- Arabic: `:root:lang(ar)` swaps `--face-display`/`--face-body` to Noto Naskh Arabic / Noto Sans Arabic and raises every line height.
- Purpose: Brand-conformant, RTL-safe, accessible building blocks.
- Location: `components/ui/`, `components/journey/`, `components/specimens/`, `components/icons/icons.tsx`, `components/status-frame.tsx`.
- Contains: `cva` variants + `cn()`, Radix primitives via the `radix-ui` package (Popover, Select, Dialog), `@internationalized/date` `CalendarDate` for dates, logical CSS utilities (`ps-`, `ms-`, `start-`, `border-s`, `rtl:`), `ar:` variant for Arabic overrides, square corners (`rounded-none`).
- Journey components take `copy: JourneyCopy` and `locale` as props and never read the cookie; UI primitives either take labels as props (`SiteNav` `labels`) or default to English.
- Depends on: `lib/cn.ts`, `lib/copy/*`, `lib/journey-format.ts`, `brand/` SVGs.
- Used by: React screens, the harness scenes, the embed bundle.
- Purpose: Guest and ops front ends built to the design system, not yet connected to data.
- Location: `app/account/`, `app/login/`, `app/bookings/`, `app/booking/trip/`, `app/dashboard/`, `app/dashboard/(ops)/`.
- Pattern: `page.tsx` (server component: metadata + production gate + render) imports `<name>-screen.tsx` (`"use client"`, local state). Guest screens render `SiteNav` + `<main id="content">` + `WhatsApp`; ops screens render inside `(ops)/layout.tsx`.
- `app/booking/trip/trip-screen.tsx` reads the query `where, check-in, check-out, adults, children, infants` (written by the embed bundle) and shows an empty state; it does not use `components/journey`.
- `components/journey/*` is mounted today only by `tests/journey/scenes/*`; no real route uses it yet.
- Purpose: English, Arabic (RTL) and Spanish for every string.
- Location: `lib/copy/*.ts`, `lib/set-document-locale.ts`, `lib/journey-format.ts`, `lib/format.ts`.
- Types: `DocumentLocale` (`lib/set-document-locale.ts`), `HomeLocale`, `GuestLocale`, `DashboardLocale`, `JourneyLocale`, `Locale` all equal `"en" | "ar" | "es"`.
- Some screens still define a small inline `COPY` object per locale (`app/account/account-screen.tsx`, `app/login/sign-in-screen.tsx`, `app/bookings/bookings-screen.tsx`, `app/booking/trip/trip-screen.tsx`); new copy goes into `lib/copy/`.
- `app/fx/route.ts` (GET rates JSON), `app/newsletter/route.ts` (POST, Resend contact create, honeypot fields, 503 when `RESEND_API_KEY` is unset), `app/embed/hero-booker/route.ts` (esbuild bundle), `app/embed/font/[file]/route.ts` (three Lato TTFs from `brand/Font/lato/`).
- Every handler starts with `if (process.env.NODE_ENV === "production") return 404`.
- Purpose: Deterministic scenes of journey components for Playwright screenshots, RTL and a11y checks.
- Location: `app/%5F%5Fharness/page.tsx` (the on-disk folder name is literally `%5F%5Fharness`; the URL is `/__harness`), `app/%5F%5Fharness/harness-client.tsx`, `tests/journey/`.
- Gate: `export const dynamic = "force-dynamic"`, then `if (process.env.ALMAR_HARNESS !== "1") notFound()` before anything reads `searchParams`. `ALMAR_HARNESS=1` is set only in `playwright.config.ts` `webServer.env`.
- Query: `/__harness?c=<component>&s=<state>&l=<en|ar|es>`; `c` and `s` must match `^[a-z0-9_-]+$`.
- `harness-client.tsx` dynamically imports `tests/journey/scenes/${c}` and renders `scenes[s]({ locale, copy: copy[l].journey, fixtures })`.
- `tests/harness-gate.test.mjs` asserts: the gate precedes data access, the assemble script never mentions the harness, nothing outside `app/%5F%5Fharness` and `tests/` links to `__harness`.
## Data Flow
### Primary Request Path (production, public page)
### Build and Deploy Path
### Hero booker embed (dev, not yet wired into the Framer HTML)
### Locale and RTL
- React `useState` per screen; no global store, no context except `ToastProvider` in `components/ui/toast.tsx` (nothing mounts it in `app/` yet, so `SiteFooter`'s `useToast()` would throw outside a provider).
- Cookie `almar-locale` is the only persisted client state.
- `lib/fx/rates.ts` keeps a module-level `memory` cache of the last FX fetch (server process, 12 hours).
## Key Abstractions
- Purpose: A static page that is a string, not a React tree (React cannot emit Framer's hydration comment nodes).
- Examples: `app/route.ts`, `app/contact/route.ts`, `app/private-stays/baru-island-private-villa/route.ts`.
- Pattern: `export const dynamic = "force-static"; const HTML = "…"; export function GET() { return new Response(HTML, { headers }) }`. They are read-only exports: do not patch them (owner decision 2026-09-28: stop patching Framer HTML; replace pages in React at Phase 3.3 and 6).
- Purpose: Name for a colour, size, spacing, radius, shadow, easing or animation.
- Examples: `tokens.json`, `lib/cn.ts` (`TOKEN_GROUPS`), the generated block in `app/globals.css`.
- Pattern: Utilities use token names (`bg-teal`, `text-label`, `h-control`, `max-w-column`, `shadow-selected`, `tracking-kicker`). Seven type steps only: caption 12, label 14, body 16, title 20, heading 32, display 48, hero 64. `--radius-control` and `--radius-overlay` are `0`.
- Purpose: One component, a closed set of looks.
- Examples: `components/ui/button.tsx` (`variant` primary/secondary/ghost/danger, `size` md/lg/bar/docked), `components/ui/link.tsx`, `components/ui/nav.tsx` (`tone`).
- Pattern: `cva(base, { variants, defaultVariants })` and `className={cn(variants({...}), className)}`.
- Purpose: Booking-path pieces whose state lives in the parent.
- Examples: `components/journey/journey-bar.tsx` (`JourneyBarProps`: `size` hero/docked/summary, `value: JourneyValue`, `onChange`, `onSearch`, `copy`, `locale`, `today`, `blockedDates`, `forceMissing`, `lockDestination`), `components/journey/add-on-row.tsx`, `components/journey/journey-cart.tsx`.
- Pattern: `value` + `onChange`, shared types in `components/journey/types.ts` (`JourneyValue`, `AddOnItem`, `CartLine`, `Destination`, `TeamMember`). Placeholders are bracketed (`AED [PRICE]`), never invented amounts (`tests/journey/fixtures.ts`).
- Purpose: One typed object per locale.
- Examples: `HOME_COPY` (`lib/copy/home.ts`), `DASHBOARD_COPY` (`lib/copy/dashboard.ts`), `JOURNEY_COPY` (`lib/copy/journey.ts`, with `{name}` slots and `#` plural numbers filled by `lib/journey-format.ts`), `GUEST_COPY`.
- Pattern: `Record<Locale, XCopy>` with `en`, `ar`, `es`; the index re-exports them as `copy[locale].<area>`; `tests/copy.test.mjs` fails on a missing `ar` or `es` key.
- Purpose: One state of one component for the harness.
- Examples: `tests/journey/scenes/journey-bar.tsx`, `tests/journey/scenes/journey-cart.tsx`.
- Pattern: `export const scenes: Scenes = { "state-name": (ctx) => <… /> }` with top-level two-space-indented keys; `tests/journey/matrix.ts` reads those keys as text to build the screenshot matrix (phone 390, tablet 834, desktop 1440 × en/ar/es).
## Entry Points
- Location: `app/route.ts` (home) and the other 25 `route.ts` Framer handlers.
- Triggers: Cloudflare request for the path (production) or `next dev`/`next start`.
- Responsibilities: Return the Framer HTML.
- Location: `scripts/assemble-cloudflare.mjs` (`npm run build:cloudflare`, `npm run build:preview`).
- Triggers: The controller session, by hand.
- Responsibilities: Build, assemble `out/`. It never deploys; the ALMAR-login `wrangler deploy` is run by hand.
- Location: `scripts/generate-theme.mjs` (`npm run tokens`, `npm run tokens:check`).
- Triggers: After a `tokens.json` change; CI-style check in the controller's clean-clone run.
- Location: `scripts/screens-diff.mjs`.
- Triggers: Manual; writes `tests/screens/INDEX.md` from `tests/screens/before` vs `tests/screens/after`.
- Location: `npm run dev` (Next dev), `playwright.config.ts` (starts `npm run dev -- -H 127.0.0.1 -p 3010` with `ALMAR_HARNESS=1`; override port with `PW_PORT`), `npm test` = `node --test tests/*.test.mjs && playwright test`.
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
### Hard-coded design values
### Unguarded React route or handler
### Single-locale strings in components
### Importing fixtures or scenes into app code
## Error Handling
- Production-gated pages call `notFound()`; dev-only handlers return `new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })`.
- `app/newsletter/route.ts` returns `400` for honeypot or bad email, `503` when `RESEND_API_KEY` is empty (never a fake success), `502` when Resend returns no id.
- `app/fx/route.ts` returns 404 when no rate can be loaded; `lib/fx/rates.ts` retries the feed once and falls back to the cached value, otherwise `null`.
- `app/error.tsx` renders `StatusFrame` with a "Try again" ghost button calling `reset()`.
- The `/__harness` page returns 404 for a bad `c`, `s` or `l`; unknown scenes render `data-testid="harness-unknown"`, which the Playwright `settle()` helper rejects.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
