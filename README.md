# ALMAR Private Journeys

The site at https://almarprivatejourney.com (and `www`). Next.js 15, Tailwind v4, hosted on Cloudflare.

## What is live

The public pages are Framer exports. Each one is a static route handler (`app/<route>/route.ts`) that
returns the page HTML as a string, including the comment nodes Framer's runtime needs to hydrate. They
are not patched any more; Phase 3.3 and Phase 6 replace them with React pages.

The React pages (`/account`, `/login`, `/booking/trip`, `/bookings`, `/dashboard`) and the route
handlers `/fx`, `/newsletter` and `/embed/*` answer 404 in production until their phases ship.

## Run and check

Node 22.18 or later (the assemble script and the node tests import `.ts` files directly).

```bash
npm ci
npm run dev -- -H 127.0.0.1 -p 3010
```

Checks, as the controller runs them on a clean clone:

```bash
npx tsc --noEmit
node --test tests/*.test.mjs
npm run tokens:check
npm run build
npx playwright test --workers=1
```

Design tokens live in `tokens.json`; `npm run tokens` regenerates the theme block in `app/globals.css`.

## Build and deploy

`node scripts/assemble-cloudflare.mjs` runs `npm run build`, then writes `out/`: `public/`, every
static page body from `.next/server/app` as `.html`, the branded `404.html` and `_headers`.

Worker `almar` (`wrangler.toml`) serves `out/` as static assets on the Cloudflare account "Almar Private
Journey", pinned by `account_id`. There is no server code in production.

Only the ALMAR control session deploys, and only on the owner's word (`npm run host:cloudflare` with
the ALMAR Cloudflare login). Work sessions never deploy. There is no Vercel, Netlify or Docker path.
