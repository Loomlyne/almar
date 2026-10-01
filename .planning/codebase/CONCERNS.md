# Codebase Concerns

**Analysis Date:** 2026-09-21

## Tech Debt

**Framer HTML-as-app:**
- Issue: Every page is a giant string constant. Home `app/route.ts` is ~672kB. No components, tokens, or CMS.
- Why: Framer exporter needed comment nodes for hydration (`app/route.ts` header).
- Impact: A design system, dashboard, or booking flow cannot be “added” to these files. They must be replaced or wrapped by a new Next/React (or Workers) app.
- Fix approach: Treat current routes as a visual reference + interim portfolio. Rebuild UI from a token/component system; do not patch strings as the long-term product.

**Stub service and blog pages:**
- Issue: `/services/*` detail and `/blog/*` posts are placeholder HTML (`app/services/24-7-private-concierge/route.ts` header).
- Why: Exporter/stubs to avoid 404s.
- Impact: Public URLs look live but are not real CMS content.
- Fix approach: Either remove from nav until real, or drive from dashboard CMS. Do not ship fake inventory.

**Legal links without routes:**
- Issue: HTML links to `./legal/booking-terms`, privacy, terms, waiver, disclaimer. No `app/legal/` directory.
- Why: Framer sitemap vs incomplete export.
- Impact: Those URLs hit the branded 404.
- Fix approach: Add pages or strip links until copy exists.

**Host leftovers:**
- Issue: `vercel.json`, `_headers`, Dockerfile, README “Deploy to Vercel/Netlify”. Intended host is Cloudflare project `almar` (`.hermes.md`). No wrangler.
- Why: Exporter defaults.
- Impact: Someone following README deploys to the wrong platform. Cache headers disagree (`vercel.json` `s-maxage=30` vs route `s-maxage=31536000`).
- Fix approach: Owner-gated Cloudflare. Do not `vercel deploy`. Unify cache when a real host exists.

**Dockerfile install:**
- Issue: `COPY package.json` then `npm install` then `COPY . .` — lockfile not used on install.
- Why: Thin exporter Docker.
- Impact: Non-reproducible image if this path is used.
- Fix approach: Copy lockfile before install, or drop Docker if Cloudflare-only.

**PLAN_FIX_ALL.md:**
- Issue: Vercel-era checklist (`vercel --prod`, `html-patch.ts` that does not exist).
- Why: Prior repair pass.
- Impact: Agents may execute a dead plan.
- Fix approach: GSD `.planning/` is source of truth after init. Do not execute PLAN_FIX_ALL.

## Known Bugs

**Canonical / JSON-LD still Framer domain:**
- Symptoms: Organization schema `@id` / `url` `https://almarprod.framer.website/` on home.
- Trigger: View source of `/`.
- Workaround: None in code.
- Root cause: Export leftovers. No live custom domain yet — do not invent one.

**Remote media mixed with self-hosted:**
- Symptoms: Many `/assets/img` hits plus hundreds of `framerusercontent.com/images` references; home also uses `videos.pexels.com` and `files.catbox.moe`.
- Trigger: Load home.
- Workaround: None.
- Root cause: Partial image rewrite in the exporter.

**koussay.com hrefs in home HTML:**
- Symptoms: Bounded scan counted `koussay.com` links on home.
- Trigger: Home footer/nav scrape.
- Workaround: None.
- Root cause: Likely exporter/dev leftover. Confirm before public launch.

**Contact form backend unverified:**
- Symptoms: `<form>` in Framer HTML; no Next `POST`.
- Trigger: Submit contact.
- Workaround: mailto / WhatsApp numbers in the brief.
- Root cause: Static export.

## Security Considerations

**No auth / no admin:**
- Risk: None today (static). Future dashboard must not ship without auth, RLS, and CSRF on mutations.
- Current mitigation: No dashboard.
- Recommendations: Supabase (or equivalent) only when gated. Password fields need show/hide eye. No secrets in repo.

**Supply chain / XSS surface:**
- Risk: Huge HTML strings with inline scripts. Editing them by regex is easy to break and easy to inject.
- Current mitigation: Static trusted export.
- Recommendations: Do not concatenate user input into `HTML`. Rebuild forms in React/Workers.

**Headers:**
- Risk: Only `X-Content-Type-Options: nosniff` in `vercel.json`. No CSP, HSTS, or frame-ancestors in Next config.
- Current mitigation: Static site, limited.
- Recommendations: Set on Cloudflare when the project is created.

**PII / contact:**
- Risk: Phone and email are public by design. Do not invent replacements.
- Current mitigation: Values from brief/HTML.
- Recommendations: Keep them. Do not log form bodies in clients.

## Performance Bottlenecks

**Home document size:**
- Problem: `app/route.ts` ~672kB of source; HTML payload is hundreds of KB before images/video.
- Measurement: file size on disk 672399 bytes.
- Cause: Full Framer page inlined.
- Improvement path: Rebuild sections; lazy media; drop unused Framer runtime.

**Framer client re-render:**
- Problem: File header records JSX attempt dropped mobile Performance 94 → 62 if comment nodes are stripped.
- Measurement: that comment only; not re-measured this map.
- Cause: Framer hydration markers.
- Improvement path: Leave markers until a non-Framer UI exists.

**CDN header split:**
- Problem: Route vs `vercel.json` cache disagree.
- Cause: Exporter + later header tweak.
- Improvement path: One header source on the real host.

## Fragile Areas

**HTML string constants:**
- Why fragile: One escaped quote break kills the build. Files are too large for normal review.
- Common failures: Search-replace of contact, canonical, or class names.
- Safe modification: Prefer additive new routes over editing 600kB strings.
- Test coverage: None.

**404 vs static collision:**
- Why fragile: Catch-all is `force-dynamic`. New `page.tsx` layouts could swallow routes.
- Safe modification: Keep handler-only until a real App Router tree is designed.
- Test coverage: None.

**Stubs that look real:**
- Why fragile: Operators will treat stub inventory as CMS.
- Safe modification: Label internally; do not add booking against stub slugs.

## Scaling Limits

- No database: cannot store customers, bookings, or CMS.
- No auth: cannot have a dashboard.
- No payment: cannot take deposits.
- Vertical scale of Next `GET` is fine for a brochure; the limit is product, not QPS.

## Workarounds

**Inquiry-first vs booking OS:**
- What: Notion July 2026 says inquiry-first, no login, no homepage date search. This session asks for hero booking, sign-in, purchase, and a branded dashboard.
- Why: Scope changed.
- Instead of: Pretending the OS exists in Framer HTML.
- Proper: GSD milestone that rebuilds the app. Map is the brownfield baseline.

**No design tokens in code:**
- What: Brand lives in Framer CSS + a brand book outside the workspace (`/Users/koss/Downloads/Almar-BrandBook`).
- Why: Export has no token pipeline.
- Instead of: Guessing hex from screenshots.
- Proper: Ingest brand book into the repo during GSD init (copy, do not edit Downloads).

## Areas Requiring Care

**Owner-gated Cloudflare:**
- Why: DNS/Worker/Pages must be one numbered step, then wait.
- Risks: Creating `almar` on the wrong account or inventing a domain.
- Testing: None until gated.

**Contact strings:**
- Why: Product ruling.
- Risks: “Fixing” email/phone in a bulk HTML patch.
- Testing: grep those two values after any HTML rewrite.

**Other products:**
- Why: This bot is ALMAR-only.
- Risks: Skills/docs that mention Vamos/Invios/Clickit.
- Testing: Refuse those workspaces.
