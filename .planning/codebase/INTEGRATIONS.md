# External Integrations

**Analysis Date:** 2026-09-21

## APIs & External Services

**Payment Processing:**
- Not detected in code. No Stripe SDK, no checkout routes, no webhooks.
- Planned (Hermes contract / MCP only): Stripe. Do not treat as live.

**Email/SMS:**
- Not detected in code. Contact is `mailto:` / displayed phone in HTML (`inquiries@almarprivatejourney.com`, `+971 56 388 3302`).
- Planned: Resend. MCP is enabled on the bot; no Resend client in `package.json`.

**External APIs:**
- No server-side fetch in TypeScript. Every `GET` returns a constant `HTML` string.
- Contact forms exist inside Framer HTML (`<form class="framer-…">` on home/contact). No `framerusercontent.com/forms` / `api.framer` submit URL found in a bounded scan. Treat form submit as unverified until UAT.
- Framer search index meta still points at `https://framerusercontent.com/sites/2GKmoXZ0OfHUpoaax6QTaM/searchIndex-*.json` (`app/route.ts` head).

## Data Storage

**Databases:**
- Not detected. No Supabase project, no Prisma, no SQL, no SQLite.
- Planned: Supabase. Create only when Koss gates it.

**File Storage:**
- Local: `public/assets/img/` (hashed WebP/SVG) and `public/assets/fonts/` (woff/woff2).
- Remote still referenced from HTML: `framerusercontent.com/images`, `framerusercontent.com/sites`, some `videos.pexels.com`, at least one `files.catbox.moe` on home (`app/route.ts`).
- No S3 / R2 / Cloudflare Images client.

**Caching:**
- Response headers on page `GET`: `cache-control: public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400` plus `netlify-cdn-cache-control`.
- `vercel.json` page source uses `s-maxage=30` — conflicts with route handlers (`PLAN_FIX_ALL.md`).
- `_headers` immutable 1y for `/assets/*`.
- No Redis.

## Authentication & Identity

**Auth Provider:**
- Not detected. No login routes, no cookies, no JWT, no Supabase Auth.
- July 2026 Notion decisions: inquiry-first, no login this phase. Current product ask (this session) is a full booking OS with sign-in — not implemented.

**OAuth Integrations:**
- Not detected.

## Monitoring & Observability

**Error Tracking:**
- Not detected.

**Analytics:**
- `README.md` says the exporter removed Framer’s analytics beacon. Verify per page; do not assume a replacement (GA/Pixel) exists.
- JSON-LD on home still `@id` / `url` `https://almarprod.framer.website/` (bounded extract of `app/route.ts`).

**Logs:**
- Not detected. No `console.log` in `app/**/*.ts`.

## CI/CD

**GitHub:**
- Remote: `https://github.com/Loomlyne/almar`.
- No `.github/workflows` in this tree. No in-repo CI config.

**Hosting leftovers:**
- `vercel.json` — exporter. Do not deploy to Vercel.
- `Dockerfile` — Node 20, `npm start` :3000. Unused for the intended Cloudflare path until owner-gated.
- `_headers` — Netlify-style.

## Webhooks

- Not detected.

## Browser / CDN runtime (client, inside HTML)

These are not npm packages. They load when the browser parses the Framer document:

- `framerusercontent.com` — images, site chunks, search index.
- `unpkg.com/lenis@1.3.23` — smooth scroll CSS on home.
- Social hrefs in nav/footer: Instagram, Facebook, YouTube, TikTok (and a `koussay.com` href count from the home HTML scan — treat as a leak to verify, not a product integration).
- `framer.com/edit` links in exported markup.

## MCP (operator, not app)

Hermes profile has Cloudflare, Resend, Supabase, Stripe MCP. None of those SDKs are imported by this Next app. Do not invent live keys or projects.
