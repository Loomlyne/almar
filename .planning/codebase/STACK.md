# Technology Stack

**Analysis Date:** 2026-09-21

## Languages

**Primary:**
- TypeScript 5.x (`package.json` `devDependencies.typescript`) — every page is `app/**/route.ts`. `tsconfig.json` targets ES2021, `strict: true`, `jsx: preserve`, `moduleResolution: bundler`.
- The live page body is not TSX. It is a string constant `HTML` returned as `text/html`. Framer client JS lives inside that string.

**Secondary:**
- JavaScript (CommonJS) — `next.config.js` only (`module.exports`).
- HTML/CSS/JS embedded in the `HTML` string (Framer runtime, Lenis, site CSS).
- Markdown — `README.md`, `.hermes.md`, `PLAN_FIX_ALL.md`.

## Runtime

**Environment:** Node.js 20 (Dockerfile `FROM node:20-alpine`). Local `npm run dev` / `npm start` via Next.js. No Python, no Go, no edge Worker in-repo.

**Package Manager:** npm. `package-lock.json` is present. `package.json` scripts: `dev`, `build`, `start` only. No `lint`, `test`, or `typecheck` script.

**Node Version:** Not pinned in `package.json` (`engines` absent). Docker uses Node 20. Next 14.2.x requires Node 18.17+.

## Frameworks

**Core:**
- Next.js 14.2.35 App Router — route handlers only. No `app/layout.tsx`, no `page.tsx`, no React Server Components in use.
- React 18.3.1 / react-dom 18.3.1 — listed because Next requires them. Pages are not rendered as React trees; `GET` returns a `Response` of prebuilt HTML.

**Why this combination:** Framer→Next.js exporter (`README.md`). Serving verbatim HTML keeps Framer hydration comment nodes (`<!--$-->` / `<!--/$-->`). JSX was tried and reverted (file header on `app/route.ts`).

**Key libraries:**
- None besides Next/React/types. No Tailwind, no CSS-in-JS package, no UI kit, no ORM, no auth SDK.

## Key Dependencies

**Critical:**
- `next@14.2.35` — HTTP server, static generation of route handlers (`export const dynamic = "force-static"` on pages; `force-dynamic` on `app/[...not_found]/route.ts`).
- `react@^18.3.1` / `react-dom@^18.3.1` — Next peer deps.

**Infrastructure:**
- TypeScript 5 + `@types/node` `@types/react` `@types/react-dom` — compile-time only.
- No wrangler, no `@cloudflare/next-on-pages`, no OpenNext config.

**Not present (planned in `.hermes.md`, not in this tree):**
- `@supabase/supabase-js`
- `stripe`
- `resend`

## Configuration

**Environment:**
- No `.env`, `.env.example`, or `.env*.local` in the repo.
- `.gitignore` ignores `.env*.local`, `node_modules`, `.next`, `out`, `.vercel`, `next-env.d.ts`, `*.tsbuildinfo`.
- No secrets in `package.json` / Next config.

**Build:**
- `next.config.js`: `{ reactStrictMode: true }` only. No `output: "export"`, no `images` config, no redirects, no rewrites.
- `tsconfig.json`: Next plugin, `allowJs: true`, no `paths` / `baseUrl`.
- `vercel.json`: leftover exporter headers (`cleanUrls`, `trailingSlash: false`, cache + `X-Content-Type-Options: nosniff`). Do not treat as the live host.
- `_headers`: Netlify-style immutable cache for `/assets/*` and hashed static files.
- `Dockerfile`: `npm install` then `npm run build` then `npm start` on port 3000. Copies `package.json` before the rest of the tree, so the first `npm install` does not use the lockfile.

## Platform Requirements

**Development:**
- Node 18.17+ (20 recommended to match Docker).
- `npm install && npm run dev` → `http://localhost:3000`.

**Production (intended vs leftover):**
- Intended host: Cloudflare Pages/Workers project name `almar` (`.hermes.md`). Not configured in-repo. No `wrangler.toml`. Owner-gated.
- Leftover: `vercel.json` + Dockerfile + `_headers` from the Framer exporter. `README.md` still says “Deploy to Vercel/Netlify”. Do not `vercel deploy`.
- No custom domain wired. Contact strings in HTML: `inquiries@almarprivatejourney.com`, `+971 56 388 3302`.
