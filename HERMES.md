<!-- GSD:project-start source:PROJECT.md -->

## Project

**ALMAR Private Journeys**

A branded booking OS for ALMAR Private Journeys: UAE-based guests book a private Colombia trip (one destination at a time) with stay, add-ons, airport meet, and return — then pay a deposit or in full. Ops runs everything from a branded dashboard (CMS, bookings, customers, calendar, money, brand tokens). The current repo is a Framer→Next.js HTML export (portfolio only). This product is a rebuild, not string-patches on those files.

**Core Value:** A guest can complete a real trip booking (stay + add-ons + pay) and ops can run that booking and the public site from one branded system — no fake controls.

### Constraints

- **Stack**: Next.js 14.2.35, React 18, TypeScript — existing pin. Cloudflare project name `almar`. Supabase + Stripe + Resend planned; create/paid only when Koss gates.
- **Git**: GitHub `Loomlyne/almar`. Never push `main`. Branch → PR → CI.
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

- TypeScript 5.x (`package.json` `devDependencies.typescript`) — every page is `app/**/route.ts`. `tsconfig.json` targets ES2021, `strict: true`, `jsx: preserve`, `moduleResolution: bundler`.
- The live page body is not TSX. It is a string constant `HTML` returned as `text/html`. Framer client JS lives inside that string.
- JavaScript (CommonJS) — `next.config.js` only (`module.exports`).
- HTML/CSS/JS embedded in the `HTML` string (Framer runtime, Lenis, site CSS).
- Markdown — `README.md`, `.hermes.md`, `PLAN_FIX_ALL.md`.

## Runtime

## Frameworks

- Next.js 14.2.35 App Router — route handlers only. No `app/layout.tsx`, no `page.tsx`, no React Server Components in use.
- React 18.3.1 / react-dom 18.3.1 — listed because Next requires them. Pages are not rendered as React trees; `GET` returns a `Response` of prebuilt HTML.
- None besides Next/React/types. No Tailwind, no CSS-in-JS package, no UI kit, no ORM, no auth SDK.

## Key Dependencies

- `next@14.2.35` — HTTP server, static generation of route handlers (`export const dynamic = "force-static"` on pages; `force-dynamic` on `app/[...not_found]/route.ts`).
- `react@^18.3.1` / `react-dom@^18.3.1` — Next peer deps.
- TypeScript 5 + `@types/node` `@types/react` `@types/react-dom` — compile-time only.
- No wrangler, no `@cloudflare/next-on-pages`, no OpenNext config.
- `@supabase/supabase-js`
- `stripe`
- `resend`

## Configuration

- No `.env`, `.env.example`, or `.env*.local` in the repo.
- `.gitignore` ignores `.env*.local`, `node_modules`, `.next`, `out`, `.vercel`, `next-env.d.ts`, `*.tsbuildinfo`.
- No secrets in `package.json` / Next config.
- `next.config.js`: `{ reactStrictMode: true }` only. No `output: "export"`, no `images` config, no redirects, no rewrites.
- `tsconfig.json`: Next plugin, `allowJs: true`, no `paths` / `baseUrl`.
- `vercel.json`: leftover exporter headers (`cleanUrls`, `trailingSlash: false`, cache + `X-Content-Type-Options: nosniff`). Do not treat as the live host.
- `_headers`: Netlify-style immutable cache for `/assets/*` and hashed static files.
- `Dockerfile`: `npm install` then `npm run build` then `npm start` on port 3000. Copies `package.json` before the rest of the tree, so the first `npm install` does not use the lockfile.

## Platform Requirements

- Node 18.17+ (20 recommended to match Docker).
- `npm install && npm run dev` → `http://localhost:3000`.
- Intended host: Cloudflare Pages/Workers project name `almar` (`.hermes.md`). Not configured in-repo. No `wrangler.toml`. Owner-gated.
- Leftover: `vercel.json` + Dockerfile + `_headers` from the Framer exporter. `README.md` still says “Deploy to Vercel/Netlify”. Do not `vercel deploy`.
- No custom domain wired. Contact strings in HTML: `inquiries@almarprivatejourney.com`, `+971 56 388 3302`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Every page is `route.ts` under a URL-matching App Router folder. Home is `app/route.ts`. Nested pages follow the public path: `app/private-stays/bocagrande-beach-house/route.ts`, `app/services/24-7-private-concierge/route.ts`.
- Use kebab-case directory names that are the live URL slug. Do not introduce `page.tsx`, `layout.tsx`, or `not-found.tsx` — unknown URLs are handled by `app/[...not_found]/route.ts`.
- Config files keep Next defaults: `next.config.js` (CommonJS), `tsconfig.json`, `package.json`. Do not add `src/`.
- Static assets live under `public/assets/img/` and `public/assets/fonts/` with content-hash filenames (example: `public/assets/img/754fb6d4bd4d3e48.svg`). Do not rename hashes.
- `PLAN_FIX_ALL.md` names a future `app/lib/html-patch.ts`. That file is not in the tree. Until it exists, do not invent a shared lib — keep behavior in the route file.
- Export a named `GET` handler from every `route.ts`. Signature is `export function GET()` with no request argument (`app/route.ts`, `app/contact/route.ts`, `app/[...not_found]/route.ts`).
- Do not export `POST`, `PUT`, `PATCH`, `DELETE`, or default exports from route files.
- Use `camelCase` for any new helper (`patchHTML` is the planned name in `PLAN_FIX_ALL.md`). Do not add helpers inside a generated HTML file unless they are shared and imported.
- Store the page document in an uppercase module constant `HTML` (`app/route.ts`, `app/about/route.ts`).
- Header keys and values are lowercase kebab-case strings: `"content-type"`, `"cache-control"`, `"netlify-cdn-cache-control"`.
- Next.js route segment config uses `export const dynamic` with string literals `"force-static"` or `"force-dynamic"`.
- Do not add TypeScript interfaces, type aliases, or enums in current route files — they are untyped string + `Response`.
- Keep `tsconfig.json` `"strict": true`. New code must type-check under that flag.
- `next.config.js` documents its shape with `/** @type {import('next').NextConfig} */`, not a `.ts` config.
- Do not add path aliases. `tsconfig.json` has no `paths` / `baseUrl`.

## Code Style

- No Prettier, ESLint, Biome, or EditorConfig file is present. Match neighboring `route.ts` by hand.
- Two-space indent. Semicolons required. Trailing commas in multi-line objects.
- Double quotes for TypeScript strings and object keys (`"force-static"`, `"content-type"`).
- Generated Framer pages keep `HTML` as one double-quoted string with `\\\"` escapes (`app/route.ts`). The branded 404 is the exception: a backtick template literal so the HTML is readable (`app/[...not_found]/route.ts`).
- Blank line between `export const dynamic`, the `const HTML = ...` assignment, and `export function GET()`.
- Not detected. `package.json` has no `lint` script. `package-lock.json` has no eslint/prettier packages.
- Quality gate for TypeScript is `npm run build` (`package.json` scripts: `dev`, `build`, `start` only).
- Do not convert `next.config.js` to ESM (`module.exports = nextConfig`).

## Import Organization

- Not detected. Use relative imports from `app/` if a lib is added (`../lib/html-patch` from a nested stay, `./lib/html-patch` from `app/route.ts`).

## Error Handling

- Static pages do not use `try/catch` in TypeScript. `GET` always returns `new Response(HTML, { headers })`.
- Unknown paths must hit `app/[...not_found]/route.ts`, which returns `status: 404` plus branded HTML. Do not rely on `app/not-found.tsx` — there is no root layout, so the framework not-found boundary is never entered (comment in that file).
- Do not throw from `GET`. Do not return JSON error bodies from HTML routes.
- `try/catch` that appears inside the `HTML` string is Framer client runtime, not server code. Leave it inside the string; do not lift it into TypeScript.
- Contact copy in HTML must stay `inquiries@almarprivatejourney.com` and `+971 56 388 3302` (`app/contact/route.ts`). Do not invent replacements.

## Logging

- Do not add request logging to static `GET` handlers.
- If logging is required later, use `console.error` only for server failures, never inside the HTML string.

## Comments

- Original Framer pages keep the 12-line file header that explains why HTML is a string (comment nodes / hydration) and a page map of Title / Nav / Sections (`app/route.ts`, `app/about/route.ts`, `app/private-stays/bocagrande-beach-house/route.ts`).
- Stub pages (service details, blog posts) use a 3-line header: auto-generated stub path, preserve Framer markers, template provenance (`app/services/24-7-private-concierge/route.ts`, `app/blog/why-medellin-is-redefining-luxury-travel/route.ts`). Point provenance at `app/services/route.ts` or the cloned source.
- Hand-written 404 explains why a catch-all route handler is required (`app/[...not_found]/route.ts`).
- Comment why a pattern exists, not what the next line does.
- Do not strip `<!-- Made in Framer -->`, `<!--$-->`, or `<!--/$-->` inside `HTML`. Those are Framer hydration markers (`README.md`).
- Not used on route handlers.
- JSDoc `@type` is only on `next.config.js`.
- `next-env.d.ts` is generated (`/// <reference types="next" />`) and listed in `.gitignore` — do not edit it.

## Function Design

- `GET` is a 7–9 line wrapper: construct `Response` from `HTML` and cache headers. Put no business logic in `GET`.
- Keep `HTML` as a single constant. Do not split the Framer document across functions.
- New pages: clone an existing `route.ts` (original export or stub) rather than writing JSX.
- `GET()` takes none. Do not add `request: Request` unless a future dynamic route actually reads it.
- Planned helper shape from `PLAN_FIX_ALL.md`: `patchHTML(html: string, opts: { path: string })`. Apply it at response time; do not mutate twenty HTML strings by hand.
- Always `new Response(htmlString, { headers, status? })`.
- Static pages omit `status` (defaults 200). 404 sets `status: 404`.
- `content-type` is always `"text/html; charset=utf-8"`.

## Module Design

- Every page module exports exactly:
- `HTML` stays file-private (`const`, not exported).
- `next.config.js` exports the config object via `module.exports`.
- Not detected. Do not add `index.ts` barrels under `app/`. App Router folders are routes, not packages.

## Route Handler Pattern (copy this)

## Cache and Headers

- Static HTML routes use `max-age=0` on the browser and long `s-maxage` on the CDN (`app/route.ts`).
- 404 uses short CDN cache (`s-maxage=60`) and no Netlify header (`app/[...not_found]/route.ts`).
- Immutable static files: `_headers` (`/assets/*`, `*.webp`, `*.woff2`, `*.css`, `*.js`) and `vercel.json` `Cache-Control: public, max-age=31536000, immutable`.
- `vercel.json` also sets `X-Content-Type-Options: nosniff` on `/(.*)`. Do not drop that header when editing `vercel.json`.
- `next.config.js` keeps `reactStrictMode: true`.

## HTML / Framer Invariants

- Serve verbatim HTML strings from route handlers. Do not rewrite pages as React JSX (`README.md`). React cannot emit the HTML comment nodes Framer uses as Suspense/hydration markers.
- Keep `export const dynamic = "force-static"` on every real page so HTML stays CDN-cacheable.
- Self-host images and fonts under `public/assets/`. Prefer `/assets/img/…` and `/assets/fonts/…` over new `framerusercontent.com` URLs when adding assets.
- Canonical and `og:url` in exported HTML are root-relative (example in `app/private-stays/bocagrande-beach-house/route.ts`: `href=\"/private-stays/bocagrande-beach-house\"`). Do not point them at Framer's domain.
- Do not add a root `app/layout.tsx`. The site has no React layout tree.

## TypeScript Config to Honor

- `"strict": true`, `"noEmit": true`, `"jsx": "preserve"`, `"allowJs": true`, `"moduleResolution": "bundler"`, `"target": "ES2021"`.
- Include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`. Exclude `node_modules`.

## Contact and Copy

- Public contact in current HTML: `inquiries@almarprivatejourney.com` / `+971 56 388 3302` (`app/contact/route.ts`). Reuse those strings.
- Brand voice in hand-written HTML (404): cream background `#f9f6f3`, ink `#1f3b40`, fonts `Questa Regular` and `Bricolage Grotesque` loaded from `public/assets/fonts/` (`app/[...not_found]/route.ts`).

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

## Layers

- Purpose: Map URL → HTML bytes + cache headers.
- Location: `app/**/route.ts`
- Contains: `export const dynamic`, `const HTML`, `export function GET()`
- Depends on: Next.js 14 App Router
- Used by: Browser / CDN
- Purpose: Visual site — nav, sections, forms, animation.
- Location: the `HTML` string inside each route file
- Contains: full `<!DOCTYPE html>` documents, Framer hydration comments, inline/runtime JS
- Depends on: `framerusercontent.com` + local `/assets/*`
- Used by: Browser only
- Purpose: Self-hosted fonts and many images.
- Location: `public/assets/fonts/`, `public/assets/img/`
- Depends on: nothing
- Used by: HTML `src` / `@font-face`
- Booking / payments / customers / CMS / dashboard / email / auth.

```

```

## Data Flow

## Key Abstractions

- Purpose: Entire page.
- Examples: `app/route.ts`, `app/about/route.ts`, stay/service/blog files
- Pattern: One document per file. Do not split into components without a new architecture.
- Purpose: HTTP GET only.
- Signature: `export function GET()` — no `Request` argument on current files.
- Pattern: Always `new Response(HTML, { headers })`.
- `"force-static"` — all real pages.
- `"force-dynamic"` — 404 catch-all only.
- Full Framer pages: home, about, contact, destinations, experiences, services index, blog index, private-stays index + stay detail pages.
- Stub aesthetic pages: three service details, three blog posts (`app/services/<slug>/route.ts`, `app/blog/<slug>/route.ts`). Headers say “placeholder HTML”.

## Entry Points

- `/` — `app/route.ts`
- `/about` `/contact` `/destinations` `/experiences` `/services` `/blog` `/private-stays`
- `/services/24-7-private-concierge` `/services/luxury-ground-transport` `/services/vip-airport-meet-greet`
- `/blog/why-medellin-is-redefining-luxury-travel` `/blog/discovering-cartagenas-hidden-colonial-courtyards` `/blog/colombias-coffee-triangle-eje-cafetero`
- 12 `/private-stays/<slug>` stay pages
- catch-all 404 — `app/[...not_found]/route.ts`

## Error Handling

- 404: branded HTML, `robots: noindex`, real 404 status (`app/[...not_found]/route.ts`).
- No JSON error bodies.
- No Sentry.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.hermes/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
