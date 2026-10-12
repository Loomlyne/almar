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

`node scripts/assemble-cloudflare.mjs` runs the OpenNext build (`opennextjs-cloudflare build`, which runs
`next build`) into `.open-next/`, then writes `out/`: `public/`, every static page body from
`.next/server/app` as `.html`, the branded `404.html` and `_headers`, plus `.open-next/almar-server-routes.json`.
It refuses to start when a `NEXT_PUBLIC_*` variable other than `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in the shell, when a service-role variable is set, or (for `--target=preview`,
`production` and `ops`, which read the catalogue from the database) when one of those two names is missing. It never
passes those two names to Next, so they are not inlined into any Worker or browser file. It refuses to finish when a `.env`
value would be bundled into the Worker or when the Worker bundle is over 2,560 KiB gzipped (measured with
`wrangler deploy --dry-run`, which uploads nothing; `scripts/worker-size.mjs`).

Worker `almar` (`wrangler.toml`) serves `out/` as static assets on the Cloudflare account "Almar Private
Journey", pinned by `account_id`. Since job 10 the Worker also runs `worker/almar.mjs`. A request for a file in
`out/` runs no Worker. The script runs first for `/api/*` and, when no file matches, for every request except a
browser navigation (`Sec-Fetch-Mode: navigate`, which gets the 404 page without it). So curl, fetch, bots and
scanners that miss do invoke the Worker, and they count toward the Free plan's 100k Worker requests a day. The
script forwards the exact paths in `lib/server-routes.ts` (every `app/api` route) to Next through OpenNext, and
everything else gets the static 404. `npm run build:cloudflare` (or `build:preview`) builds both; it never
deploys.

Only the ALMAR control session deploys, and only on the owner's word, with the ALMAR Cloudflare login and the
commands in `.planning/phases/02-platform-spine/02-RUNTIME-DEPLOY.md`. Work sessions never deploy. There is no
Vercel, Netlify or Docker path.
