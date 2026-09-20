# ALMAR Framer — Fix All Audit Findings — Execution Plan

**Scope:** 20 routes (app/**/route.ts), 11 findings from audit, 0 visual regressions.
**Strategy:** Central HTML patch (`app/lib/html-patch.ts`) + minimal per-route edits + 6 new stub routes + 1 custom 404. Avoid editing 20 HTML strings individually — patch at runtime, cache-static.
**Stack:** Next 14.2.35 App Router, route handlers serving verbatim Framer HTML, Vercel deploy.

---

## Phase 0 — Foundation (blocked)
- [ ] `app/lib/html-patch.ts` — single `patchHTML(html: string, opts:{path:string})` that applies all cross-cutting fixes. Exported, unit-tested.
- [ ] Update `tsconfig.json` if needed (no change).
- [ ] Backup verification: `npm run build` passes before/after.

## Phase 1 — Critical: Broken Links 404 (P0)
**Files:** `app/services/*`, `app/blog/*`, `vercel.json`, `app/not-found.tsx` or `app/[...slug]/route.ts`
- Task 1A: Create 3 service detail stubs:
  - `app/services/24-7-private-concierge/route.ts` (clone from `app/services/route.ts` template, title "24/7 Private Concierge | ALMAR", sections for concierge)
  - `app/services/luxury-ground-transport/route.ts`
  - `app/services/vip-airport-meet-greet/route.ts`
  - Reuse HTML structure from services page, adjust H1/H3, keep Framer runtime markers.
- Task 1B: Create 3 blog post stubs:
  - `app/blog/discovering-cartagenas-hidden-colonial-courtyards/route.ts`
  - `app/blog/why-medellin-is-redefining-luxury-travel/route.ts`
  - `app/blog/colombias-coffee-triangle-eje-cafetero/route.ts`
  - Each: clone blog list layout, add article header, keep SEO.
- Task 1C: Fix 404 page — create `app/not-found.tsx` styled to match Framer (cream bg, Questa font) or proxy Framer's 404 HTML. Ensure `curl /nonexistent` returns branded 404 not Next default (181 B).
- Task 1D: Add `vercel.json` redirects fallback (if stub not ready, redirect `/services/24-7*` → `/services`).
- **Agent:** `fix-404-routes` | **Dep:** Phase 0 path lib ready
- **Verify:** `curl -I` 6 routes = 200, click from home works.

## Phase 2 — SEO & Metadata (P0)
**Files:** `app/lib/html-patch.ts`, `public/assets/img/og-*`, all `app/**/route.ts`
- Task 2A: OG/Twitter self-host — download 5 unique OG images (Lh409..., B5n9..., 3ZDk..., qOgg..., plus 12 villa OG) and save as `public/assets/img/og-default.webp`, `og-about.webp`, etc. Replace `https://framerusercontent.com/images|assets/*` with `/assets/img/og-*.webp` via patchHTML regex. Keep `twitter:image` in sync.
- Task 2B: Duplicate H1 de-duplication — detect Framer responsive triple pattern (`Begin Your Journey` x3, `Colombia Beautifully Captured` x2, etc). Patch: add `aria-hidden="true"` to 2nd/3rd variants, ensure only first H1 is visible to crawlers (or downgrade hidden to div with aria). Implement via regex on `framer-` breakpoint classes.
- Task 2C: JSON-LD — inject `<script type="application/ld+json">` for Organization + LodgingBusiness per page (home: TravelAgency, villas: LodgingBusiness with name/address/geo). Add to patchHTML head.
- Task 2D: Canonical already present — verify it points to self-hosted domain (patch `framer.website` → `vercel.app` or custom domain placeholder).
- **Agent:** `fix-seo-meta` | **Dep:** Phase 0
- **Verify:** View source `og:image` = `/assets/img`, 1 H1 per page (axe check), json-ld validator.

## Phase 3 — Accessibility & Images (P0/P1)
**Files:** `app/lib/html-patch.ts`, `public/assets/img/*`
- Task 3A: Alt text — map empty `alt=""` for content images to meaningful alt. Use filename → alt map (e.g., `POk1NFH...` → "Barú Island villa ocean view"). PatchHTML: replace `alt=""` where parent has `data-framer-name` or where image is in gallery. Keep decorative empty but add `role="presentation"`.
- Task 3B: Villa gallery fix — investigate why `getsemani-colonial-house` has 43 imgs vs 85 expected. Compare `app/private-stays/getsemani-colonial-house/route.ts` HTML length (483KB) vs baru (553KB). Re-extract missing gallery batch from Framer export or copy from sibling template; verify `public/assets/img` has 300 files but maybe missing batch for that villa. Fix by re-generating that route.ts HTML string from Framer source or patching in missing `<img>` blocks.
- Task 3C: Image optimization — convert remaining 42 jpg references to webp via patch (rewrite `framerusercontent` jpg URLs to webp where `/assets/img/*.webp` exists). Add `avif` generation todo (future). Ensure `fetchpriority="high"` + `loading="eager"` on hero (first img) vs lazy on rest (currently 0 eager). Patch hero img to `eager`.
- Task 3D: Mixed content — replace `http://unpkg.com/lenis@1.3.23` → `https://` in all routes via patch.
- **Agent:** `fix-a11y-images` | **Dep:** Phase 2A (OG), Phase 0
- **Verify:** `alt` audit drops empty from 29→<5 decorative only, getsemani 85 imgs, Lighthouse a11y 90+.

## Phase 4 — Performance & Design Polish (P1)
**Files:** `app/lib/html-patch.ts`, `app/route.ts` (home footer), `next.config.js`, `vercel.json`
- Task 4A: Font preload — inject `<link rel="preload" href="/assets/fonts/XXXX.woff2" as="font" type="font/woff2" crossorigin>` for Questa Regular + primary sans. Add to patchHTML head (first 2 fonts). Keep `font-display: swap` (already true).
- Task 4B: Cache headers — unify `vercel.json:19` (`s-maxage=30`) vs `route.ts:21` (`s-maxage=31536000`). Set patch or route handler to `s-maxage=31536000` + `stale-while-revalidate=86400` for static routes, keep 30s for blog? Document.
- Task 4C: Spacing sanity — verify no horizontal scroll at 375/768/1280. Add CSS patch: `html{overflow-x:hidden}` + `img{max-width:100%}` via injected `<style>`. Check `gap`/`padding` tokens already coherent (10/20/40) — no code change, just guardrail.
- Task 4D: Lenis vs anchor — fix `href="#top"` dupIds 2. Ensure `id="top"` exists once at `<html>`; patch adds `id="top"` to body if missing, and ensures Lenis smooth scroll init targets it. Add missing `tel:` CTA (extract from mailto, add `tel:+57...` placeholder).
- **Agent:** `fix-perf-design` | **Dep:** Phase 0
- **Verify:** Lighthouse perf 90+, no CLS, no horiz scroll on 375px.

## Phase 5 — Content & Footer Consistency (P1)
**Files:** `app/blog/route.ts`, `app/destinations/route.ts`, `app/experiences/route.ts`, `app/private-stays/route.ts`, `app/about/route.ts`
- Task 5A: Footer missing on blog/destinations/experiences/private-stays/services — patchHTML injects footer (email + insta) from home template if not present (check `inquiries@almarprivatejourney.com` count). Ensure 1 footer not 3.
- Task 5B: About copy drift — `Meet ALMAR` vs `Your Private Colombia` — add H2 `Meet ALMAR` if missing, keep both.
- Task 5C: Private-stays listing `Fully Vetted` keyword — inject H3 if missing.
- **Agent:** `fix-content-footer` | **Dep:** Phase 0

## Phase 6 — Verification & Ship (P0)
- [ ] `npm run build` — all 26 routes (20 + 6 new) static, no TS errors.
- [ ] Local QA: `docker build -t almarprod-framer-website . && docker run -p 3001:3000` — click all nav + 6 new links + villas.
- [ ] `vercel --prod --yes` deploy, `curl -I` 26 routes 200, 404 returns branded page.
- [ ] Lighthouse CI: perf/a11y/SEO >90, check `og:image` self-hosted, single H1, alt audit.
- **Agent:** `verify-ship` (no code, just checks).

---

## Dependency Graph
Phase 0 → Phases 1,2,3,4,5 parallel → Phase 6

## Agent Dispatch Plan (5 parallel workers)
1. `fix-404-routes` — Phase 1
2. `fix-seo-meta` — Phase 2
3. `fix-a11y-images` — Phase 3
4. `fix-perf-design` — Phase 4
5. `fix-content-footer` — Phase 5
Final: `verify-ship` after all.

## Risk Mitigation
- Do not edit raw Framer comment nodes (`<!-- Made in Framer...`); patchHTML preserves them.
- Keep `dynamic = "force-static"` on all routes.
- Test `app/lib/html-patch.ts` regex on 1 route before bulk apply.
- Git commit per phase for rollback.

## Estimated Files Changed
- New: `app/lib/html-patch.ts`, 6 stub routes, `app/not-found.tsx`, 5-15 OG webp files.
- Modified: 20 route.ts (add `import { patchHTML }` + `return new Response(patchHTML(HTML, {path}))`), `vercel.json`, `next.config.js` (optional).

