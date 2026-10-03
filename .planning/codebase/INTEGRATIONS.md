# External Integrations

**Analysis Date:** 2026-10-02

Scope: what the code at `main` = `68df3b6` actually calls, versus what is only installed, planned, or connected as a Claude MCP tool. Environment variable NAMES only; no values, keys, tokens, or project refs appear here and none may be added.

## Integration Status at a Glance

| Service | Package / endpoint | In code today | Reachable in production Worker |
|---|---|---|---|
| Framer runtime and CDN | `framerusercontent.com` (loaded by the HTML strings) | Yes, all 26 static pages | Yes (browser loads it) |
| Cloudflare Workers static assets | `wrangler.toml` `[assets]` | Yes | Yes (this is production) |
| FX rates feed | `latest.currency-api.pages.dev` | Yes (`lib/fx/rates.ts`) | No (`/fx` is 404 in production and not in `out/`) |
| Resend (newsletter contact) | `resend@6.29.0` | Yes (`app/newsletter/route.ts`) | No (404 in production; no server runtime) |
| Supabase | `@supabase/supabase-js`, `@supabase/ssr` | No imports | No |
| Stripe | none installed | No | No |
| Google Fonts | `next/font/google` | Build time only | n/a |
| WhatsApp / Instagram / maps links | plain `<a href>` | Yes | Yes (outbound links) |

## APIs & External Services

**Page runtime and assets (Framer export):**
- Framer hosted runtime - every `app/**/route.ts` page returns a Framer-published HTML string that loads module scripts from `https://framerusercontent.com/sites/<site-id>/script_main.*.mjs` and sibling `*.mjs` chunks, plus images from `https://framerusercontent.com/images/...` (65 image references in `app/route.ts` alone). This is a live runtime dependency on the Framer CDN. Framer's analytics beacon was removed by the exporter (`README.md`). Images were re-encoded and self-hosted under `public/assets/img` (300 files) and fonts under `public/assets/fonts`, but the Framer JS modules are still fetched from Framer.
  - SDK/Client: none (plain `<script type="module" src="https://framerusercontent.com/...">`)
  - Auth: none
  - Files: `app/route.ts` and the other 25 Framer `route.ts` pages under `app/` (every `route.ts` except `app/fx`, `app/embed/**`, `app/newsletter`)
- Lenis smooth-scroll CSS - `https://unpkg.com/lenis@1.3.23/dist/lenis.css` referenced from the Framer HTML.
- Third-party media inside the Framer HTML: `https://videos.pexels.com/video-files/4932586/4932586-uhd_2732_1440_30fps.mp4` and `https://files.catbox.moe/v0nj1o.mp4` (in `app/about/route.ts`). Google Maps search links on `app/contact/route.ts`.
- Canonical Framer origin referenced in markup: `https://almarprod.framer.website`.

**Currency conversion (AED / USD / EUR):**
- Free community currency feed `https://latest.currency-api.pages.dev/v1/currencies/usd.json` (constant `FX_URL` in `lib/fx/rates.ts`).
  - SDK/Client: global `fetch` in `readFeed()`; one retry; 12-hour in-memory cache (`memory`, `TWELVE_HOURS`) per server process.
  - Auth: none.
  - Consumers: `loadRates()` is called from `app/fx/route.ts` (`GET /fx`, `force-dynamic`, 404 when `NODE_ENV === "production"`) and from `app/dashboard/(ops)/settings/page.tsx` (server page, `notFound()` in production). `homePriceScript()` (a `postMessage` price-rewriting browser script with no caller) was deleted as dead code in the slice 1 money fix (2026-10-03).
  - Production state: not live. The static Worker has no `/fx`, so no rates are fetched in production.

**Newsletter / email contacts (Resend):**
- Resend Contacts API - `app/newsletter/route.ts` (`POST`, `runtime = "nodejs"`, `force-dynamic`) validates a honeypot list (`HONEYPOT_FIELDS`: `title`, `website`, `company`, `message`, `subject`, `description`, `feedback`, `notes`, `details`, `remarks`, `comments`), reads form field `Email`, and calls `resend.contacts.create({ email, unsubscribed: false })`. Responses: 400 bad input or honeypot hit, 503 missing key, 502 Resend error or missing `data.id`, 200 `{ ok: true, id }`. Returns 404 when `NODE_ENV === "production"`.
  - SDK/Client: `resend` 6.29.0
  - Auth: env var `RESEND_API_KEY` (server only, trimmed; empty counts as missing)
  - It never sends email (`tests/phase-03-newsletter.test.mjs` forbids `emails.send` and a `from:` address). No audience id is passed.
  - The footer form (`components/ui/footer.tsx`, `SiteFooter.onSubmit`) validates the address and shows the toast "Subscribed. Check your inbox." without calling `/newsletter`; nothing is stored.
  - Production state: not live. No Resend domain verified; "Stripe, Resend: nothing live" per `.planning/CONTROL-BOARD.md`.

**Payments (Stripe):**
- Not integrated. No `stripe` package, no import, no env var name in code. Plan (`.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`): Stripe TEST mode with a custom branded Payment Element until a go-live plan; stored card data limited to last 4. Only the Stripe MCP connector exists (`.mcp.json`).

**Outbound contact links (no API):**
- WhatsApp click-to-chat `https://wa.me/<number>` in `components/ui/whatsapp.tsx` (the number is the public contact already in the HTML; do not change it).
- Instagram profile link in `components/ui/footer.tsx`; `mailto:` and `tel:` links for the public contact in the same file. Do not invent replacement contact details.

**Fonts:**
- Google Fonts (Noto Naskh Arabic, Noto Sans Arabic) via `next/font/google` in `lib/fonts.ts`, fetched during `next build`. Questa and Lato are self-hosted from `brand/Font/`.

## Data Storage

**Databases:**
- Supabase Postgres (planned, not wired). One Supabase cloud project exists (plan 02-01, Storage off, one owner user confirmed, redirect allow-list set for `/auth/confirm` on `127.0.0.1:3010` and the ALMAR domains). No migration has been applied; no `.env.local` on this checkout; no code in `main` imports `@supabase/*`.
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public key name; do not add a second public key name), `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`).
  - Client: `@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7 (installed in `package.json`).
  - The Phase 2 auth chain (jobs 02-08, 02-02, 02-03, 02-04) and its migration `20260925120000` live on branch `claude/project-thread-8h6bed`, not on `main`.
  - Supabase Storage stays off by decision.

**File Storage:**
- Production: static files only, from `out/` (copy of `public/` plus assembled HTML). Planned: Cloudflare R2 for media ("Cloudflare only for files; Supabase never storage", `.planning/PROJECT.md`). Not configured: no R2 binding in `wrangler.toml`.
- Brand sources (logos, fonts, colours, icons, brand guideline PDF) are committed under `brand/`.

**Caching:**
- Cloudflare edge/static-asset caching driven by `_headers` (copied to `out/_headers` by `scripts/assemble-cloudflare.mjs`). `vercel.json` carries similar header rules but is not used.
- Per-process in-memory FX cache in `lib/fx/rates.ts` (dev only today). No Redis/KV/D1.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth with email magic link (planned). Not implemented in `main`: `app/login/sign-in-screen.tsx` is UI only (`onSubmit` sets local state, no network call) and `app/login/page.tsx` 404s in production. No session, middleware, or cookie handling exists (`middleware.ts` absent).
  - Planned redirect target: `/auth/confirm` (route not present on `main`). No password login; owner user is created in the Supabase dashboard.
  - Session time-box (30 days) is deferred until the Supabase plan is Pro (`.planning/phases/02-platform-spine/02-USER-SETUP.md`).

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- None configured. `wrangler.toml` has no `[observability]` block; no logging library. `app/error.tsx` and `app/not-found.tsx` are UI only.

**Analytics:**
- None. Framer's analytics beacon was stripped from the exported HTML.

## CI/CD & Deployment

**Hosting:**
- Cloudflare Worker `almar` (static assets from `out/`) on Cloudflare account "Almar Private Journey" (`f1d9a1fa...`), since 2026-10-02. Custom domains `almarprivatejourney.com` and `www.almarprivatejourney.com` (`[[routes]]` with `custom_domain = true`), plus `workers_dev = true` (`almar.almar-private-journey.workers.dev`). Dashboard host `dashboard.almarprivatejourney.com` has no DNS record and must not be named in `wrangler.toml` (`tests/host-config.test.mjs`).
- Deploy command: `npm run host:cloudflare` (`scripts/assemble-cloudflare.mjs`, then `wrangler deploy`). Manual, on the owner's word only. Live version `49112d4b` = `main` `68df3b6` (deployed 2026-10-02 02:25 +04).
- Account safety: the default local `wrangler` login sees only the Vamos Cloudflare account. ALMAR deploys use a separate ALMAR-only login (`HOME` override) plus `CLOUDFLARE_ACCOUNT_ID` (see `.planning/CONTROL-BOARD.md`). `wrangler.toml` does not yet pin `account_id` (job 04 adds it).
- Server runtime: NOT configured. `@opennextjs/cloudflare` 1.20.6 is installed but there is no `open-next.config.ts`, no `.open-next/` build, and `wrangler.toml` has no `main`. Until it is added, `app/newsletter/route.ts`, `app/fx/route.ts`, `app/embed/**`, and any future Supabase-backed route cannot run on the Worker.
- No Cloudflare Pages project: `almar` (`almar-khb.pages.dev`) and the old Worker `almar` on the Vamos account were both deleted on the owner's word on 2026-10-02.
- Not used, leftovers: Vercel (`vercel.json`, `.vercel`, README text) and Docker (`Dockerfile`). Do not `vercel deploy`.

**Source hosting:**
- GitHub `Loomlyne/almar` (private). Branch `main` = the shipped line; one job per branch; only the control session pushes `main`, on the owner's Ship.

**CI Pipeline:**
- None (`.github/` absent). The control session's clean-clone check is the CI: `npm ci`, `tsc`, node tests, `tokens:check`, `npm run build`, Playwright.

## Environment Configuration

**Required env vars (names only):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- Test/dev only: `ALMAR_HARNESS` (`1` enables `/__harness`), `PW_PORT`, `SCREENS_MODE`, `NODE_ENV` (production gate).
- Stripe: no variable names exist yet.

**Secrets location:**
- Never in the repo or chat. `.env.example` holds names with empty values (`tests/phase-03-newsletter.test.mjs` asserts `RESEND_API_KEY=` stays empty). Local values would go in a gitignored `.env.local` (absent now). Deployed values are Cloudflare Worker secrets set from the owner's terminal. The new Worker `almar` has no secrets yet; the old Vamos-account Worker holds the three Supabase names only. Do not read `.env*` files.

**Connected tools for Claude sessions (not runtime):**
- `.mcp.json` registers four OAuth HTTP MCP servers: Cloudflare (`https://mcp.cloudflare.com/mcp?codemode=false`), Supabase (`https://mcp.supabase.com/mcp`), Stripe (`https://mcp.stripe.com`), Resend (`https://mcp.resend.com/mcp`). The claude.ai Cloudflare connector sees only the Vamos account, not the ALMAR account. Vercel and Figma are deliberately not connected.

## Webhooks & Callbacks

**Incoming:**
- None. (Planned: Stripe webhook for payment events, Supabase auth callback `/auth/confirm`; neither exists on `main`.)

**Outgoing:**
- None.

**Cross-window messaging (internal, not a webhook):**
- `homePriceScript()` (`lib/fx/rates.ts`, the `window.postMessage` listener) was deleted as dead code in the slice 1 money fix (2026-10-03); the hero booker mounted by `lib/framer-hero-booker-mount.tsx` navigates `window.top` to `/booking/trip?where=...&check-in=...` via `window.top.location.assign`.

---

*Integration audit: 2026-10-02*
