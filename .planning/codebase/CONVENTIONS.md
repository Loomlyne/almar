# Coding Conventions

**Analysis Date:** 2026-09-21

## Naming Patterns

**Files:**
- Every page is `route.ts` under a URL-matching App Router folder. Home is `app/route.ts`. Nested pages follow the public path: `app/private-stays/bocagrande-beach-house/route.ts`, `app/services/24-7-private-concierge/route.ts`.
- Use kebab-case directory names that are the live URL slug. Do not introduce `page.tsx`, `layout.tsx`, or `not-found.tsx` — unknown URLs are handled by `app/[...not_found]/route.ts`.
- Config files keep Next defaults: `next.config.js` (CommonJS), `tsconfig.json`, `package.json`. Do not add `src/`.
- Static assets live under `public/assets/img/` and `public/assets/fonts/` with content-hash filenames (example: `public/assets/img/754fb6d4bd4d3e48.svg`). Do not rename hashes.
- `PLAN_FIX_ALL.md` names a future `app/lib/html-patch.ts`. That file is not in the tree. Until it exists, do not invent a shared lib — keep behavior in the route file.

**Functions:**
- Export a named `GET` handler from every `route.ts`. Signature is `export function GET()` with no request argument (`app/route.ts`, `app/contact/route.ts`, `app/[...not_found]/route.ts`).
- Do not export `POST`, `PUT`, `PATCH`, `DELETE`, or default exports from route files.
- Use `camelCase` for any new helper (`patchHTML` is the planned name in `PLAN_FIX_ALL.md`). Do not add helpers inside a generated HTML file unless they are shared and imported.

**Variables:**
- Store the page document in an uppercase module constant `HTML` (`app/route.ts`, `app/about/route.ts`).
- Header keys and values are lowercase kebab-case strings: `"content-type"`, `"cache-control"`, `"netlify-cdn-cache-control"`.
- Next.js route segment config uses `export const dynamic` with string literals `"force-static"` or `"force-dynamic"`.

**Types:**
- Do not add TypeScript interfaces, type aliases, or enums in current route files — they are untyped string + `Response`.
- Keep `tsconfig.json` `"strict": true`. New code must type-check under that flag.
- `next.config.js` documents its shape with `/** @type {import('next').NextConfig} */`, not a `.ts` config.
- Do not add path aliases. `tsconfig.json` has no `paths` / `baseUrl`.

## Code Style

**Formatting:**
- No Prettier, ESLint, Biome, or EditorConfig file is present. Match neighboring `route.ts` by hand.
- Two-space indent. Semicolons required. Trailing commas in multi-line objects.
- Double quotes for TypeScript strings and object keys (`"force-static"`, `"content-type"`).
- Generated Framer pages keep `HTML` as one double-quoted string with `\\\"` escapes (`app/route.ts`). The branded 404 is the exception: a backtick template literal so the HTML is readable (`app/[...not_found]/route.ts`).
- Blank line between `export const dynamic`, the `const HTML = ...` assignment, and `export function GET()`.

**Linting:**
- Not detected. `package.json` has no `lint` script. `package-lock.json` has no eslint/prettier packages.
- Quality gate for TypeScript is `npm run build` (`package.json` scripts: `dev`, `build`, `start` only).
- Do not convert `next.config.js` to ESM (`module.exports = nextConfig`).

## Import Organization

**Order:**
1. Current route files import nothing. Do not add unused imports.
2. If a shared helper is introduced (planned `app/lib/html-patch.ts`), put it first, then Next/runtime types, then local modules.
3. Config remains CommonJS in `next.config.js` (`const nextConfig = { reactStrictMode: true }; module.exports = nextConfig;`).

**Path Aliases:**
- Not detected. Use relative imports from `app/` if a lib is added (`../lib/html-patch` from a nested stay, `./lib/html-patch` from `app/route.ts`).

## Error Handling

**Patterns:**
- Static pages do not use `try/catch` in TypeScript. `GET` always returns `new Response(HTML, { headers })`.
- Unknown paths must hit `app/[...not_found]/route.ts`, which returns `status: 404` plus branded HTML. Do not rely on `app/not-found.tsx` — there is no root layout, so the framework not-found boundary is never entered (comment in that file).
- Do not throw from `GET`. Do not return JSON error bodies from HTML routes.
- `try/catch` that appears inside the `HTML` string is Framer client runtime, not server code. Leave it inside the string; do not lift it into TypeScript.
- Contact copy in HTML must stay `inquiries@almarprivatejourney.com` and `+971 56 388 3302` (`app/contact/route.ts`). Do not invent replacements.

## Logging

**Framework:** Not detected (no `console.log` / `console.error` in `app/**/*.ts`)

**Patterns:**
- Do not add request logging to static `GET` handlers.
- If logging is required later, use `console.error` only for server failures, never inside the HTML string.

## Comments

**When to Comment:**
- Original Framer pages keep the 12-line file header that explains why HTML is a string (comment nodes / hydration) and a page map of Title / Nav / Sections (`app/route.ts`, `app/about/route.ts`, `app/private-stays/bocagrande-beach-house/route.ts`).
- Stub pages (service details, blog posts) use a 3-line header: auto-generated stub path, preserve Framer markers, template provenance (`app/services/24-7-private-concierge/route.ts`, `app/blog/why-medellin-is-redefining-luxury-travel/route.ts`). Point provenance at `app/services/route.ts` or the cloned source.
- Hand-written 404 explains why a catch-all route handler is required (`app/[...not_found]/route.ts`).
- Comment why a pattern exists, not what the next line does.
- Do not strip `<!-- Made in Framer -->`, `<!--$-->`, or `<!--/$-->` inside `HTML`. Those are Framer hydration markers (`README.md`).

**JSDoc/TSDoc:**
- Not used on route handlers.
- JSDoc `@type` is only on `next.config.js`.
- `next-env.d.ts` is generated (`/// <reference types="next" />`) and listed in `.gitignore` — do not edit it.

## Function Design

**Size:**
- `GET` is a 7–9 line wrapper: construct `Response` from `HTML` and cache headers. Put no business logic in `GET`.
- Keep `HTML` as a single constant. Do not split the Framer document across functions.
- New pages: clone an existing `route.ts` (original export or stub) rather than writing JSX.

**Parameters:**
- `GET()` takes none. Do not add `request: Request` unless a future dynamic route actually reads it.
- Planned helper shape from `PLAN_FIX_ALL.md`: `patchHTML(html: string, opts: { path: string })`. Apply it at response time; do not mutate twenty HTML strings by hand.

**Return Values:**
- Always `new Response(htmlString, { headers, status? })`.
- Static pages omit `status` (defaults 200). 404 sets `status: 404`.
- `content-type` is always `"text/html; charset=utf-8"`.

## Module Design

**Exports:**
- Every page module exports exactly:
  1. `export const dynamic = "force-static"` (or `"force-dynamic"` on `app/[...not_found]/route.ts` only)
  2. `export function GET()`
- `HTML` stays file-private (`const`, not exported).
- `next.config.js` exports the config object via `module.exports`.

**Barrel Files:**
- Not detected. Do not add `index.ts` barrels under `app/`. App Router folders are routes, not packages.

## Route Handler Pattern (copy this)

Original Framer page (`app/about/route.ts`, `app/route.ts`, `app/private-stays/*/route.ts` except stubs):

```typescript
// Auto-generated from the original Framer page. Served verbatim — including
// the HTML comment nodes, which are Framer's React hydration (Suspense
// boundary) markers: rendering this through JSX instead was tried and
// reverted because React cannot emit comment nodes, and losing them forces
// Framer's runtime into a slow client-side re-render (measured 94 -> 62
// mobile Performance). See routeHandler() in lib/nextjs-export.ts.
//
// Page map (orientation only — search this file for a title below to
// jump to that spot in the HTML string constant further down):
//   Title: "…"
//   Nav: …
//   Sections: …
export const dynamic = "force-static";

const HTML = "<!DOCTYPE html><!-- Made in Framer · framer.com ✨ -->…";

export function GET() {
  return new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
    },
  });
}
```

Stub page (`app/services/24-7-private-concierge/route.ts`, `app/blog/*/route.ts` except `app/blog/route.ts`):

```typescript
// Auto-generated stub for /services/24-7-private-concierge — serves Framer-aesthetic placeholder HTML.
// Preserves Framer comment hydration markers verbatim (<!-- Made in Framer -->, <!--$--> / <!--/$--> etc.)
// See app/services/route.ts for template provenance.
export const dynamic = "force-static";

const HTML = "<!DOCTYPE html><!-- Made in Framer · framer.com ✨ -->…";

export function GET() {
  return new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
    },
  });
}
```

Branded 404 (`app/[...not_found]/route.ts`):

```typescript
export const dynamic = "force-dynamic";

const HTML = `<!DOCTYPE html>
<html lang="en" dir="ltr">
...
</html>`;

export function GET() {
  return new Response(HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
```

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

From `tsconfig.json`:
- `"strict": true`, `"noEmit": true`, `"jsx": "preserve"`, `"allowJs": true`, `"moduleResolution": "bundler"`, `"target": "ES2021"`.
- Include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`. Exclude `node_modules`.

## Contact and Copy

- Public contact in current HTML: `inquiries@almarprivatejourney.com` / `+971 56 388 3302` (`app/contact/route.ts`). Reuse those strings.
- Brand voice in hand-written HTML (404): cream background `#f9f6f3`, ink `#1f3b40`, fonts `Questa Regular` and `Bricolage Grotesque` loaded from `public/assets/fonts/` (`app/[...not_found]/route.ts`).

---

*Convention analysis: 2026-09-21*
