# Codebase Concerns

**Analysis Date:** 2026-10-02

Scope: whole repo at `main` `68df3b6` (Phase 3.1 landed and deployed). Verified by reading code, plus `npx tsc --noEmit` (pass), `node --test tests/*.test.mjs` (160 of 160 pass, Node v26.7.0), `npm run tokens:check` (pass) and `npm audit` (5 findings). Not run: `npm run build`, Playwright, any live request.

What is live: only the 26 static Framer pages in `app/**/route.ts` plus the branded 404, assembled by `scripts/assemble-cloudflare.mjs` into `out/` and served by Worker `almar`. Every React page from Phases 3 and 3.1 (`/login`, `/account`, `/bookings`, `/booking/trip`, `/dashboard/*`, `/fx`, `/newsletter`, `/embed/*`, `/__harness`) answers 404 in production. Nothing in `components/journey/*` is imported by any file under `app/` except the test-only harness. Concerns below are tagged **[live]** when they affect the deployed site today and **[dev-only]** when they sit behind the production 404.

## Known Items From The 3.1 Hand-over: Verified

Source: `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-HANDOVER.md`, `03.1-REVIEW.md`, `.planning/CONTROL-BOARD.md`. Line numbers are current (several moved after the W1 to W5 fixes).

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Settings Save does nothing | Confirmed | `app/dashboard/(ops)/settings/settings-screen.tsx:104` `onClick={() => undefined}`; pinned by `tests/phase-03-settings.test.mjs:64` (was :63) |
| 2 | Catalog / Content Publish do nothing | Confirmed | `app/dashboard/(ops)/catalog/catalog-screen.tsx:137`, `app/dashboard/(ops)/content/content-screen.tsx:91` |
| 3 | Calendar Block does nothing | Confirmed | `app/dashboard/(ops)/calendar/calendar-screen.tsx:146` has no handler |
| 4 | Experiences filters do nothing | Confirmed | `catalog-screen.tsx:52-54,83,95,107` set state that nothing reads; Destination select has only "All destinations" (`:110`); table body is always empty (`<tbody />`) |
| 5 | Profile sign-out does nothing | Confirmed | `app/dashboard/(ops)/profile/profile-screen.tsx:56,64` `onConfirm` only closes the dialog |
| 6 | Sign-in submit does nothing | Confirmed | `app/login/sign-in-screen.tsx:48-51` only `setTried(true)`; no request, no success state |
| 7 | Guest nav anchors lead to ids not on guest pages | Confirmed | `components/ui/nav.tsx:75-78` (`#destinations`, `#experiences`, `#about`, `#contact`); logo `href="#content"` at `:173`; `loginHref` default `#log-in` at `:52`; only `app/booking/trip/trip-screen.tsx:87` overrides it |
| 8 | Currency select has no effect | Confirmed | `nav.tsx:81-85,236-242` keeps its own state; none of the four call sites (`app/account/account-screen.tsx`, `app/bookings/bookings-screen.tsx`, `app/login/sign-in-screen.tsx`, `app/booking/trip/trip-screen.tsx`) passes `currency` or `onCurrency`, and none shows a price |
| 9 | Language cookie written, never read | Confirmed for guest pages, nuanced | Written at `components/ui/locale-select.tsx:63` and `app/account/account-screen.tsx:25`. Guest screens start at `"en"` (`account-screen.tsx:19`, `bookings-screen.tsx:17`, `sign-in-screen.tsx:33`, `trip-screen.tsx:58`) and never read it. The dashboard does read it, through nine copy-pasted `readLocale()` functions (see Duplication) |
| 10 | Hand-written font sizes outside `tokens.json` | Confirmed | `app/globals.css:126-128` (`--text-hero: 40px`, `--text-display: 32px`, `--text-heading: 24px`) and `:133-135` (64/48/32); outside the `GENERATED:THEME` markers, so `npm run tokens:check` and `tests/design-tokens.test.mjs` do not see them |
| 11 | 9 repeated brand hexes in settings screen | Confirmed | `settings-screen.tsx:12-22` (`COLOR_TOKENS`). The comment at `:11` says they are "declared in app/globals.css"; they are copies of `tokens.json` |
| 12 | `object-left` logo does not flip in Arabic | Confirmed | `app/dashboard/(ops)/layout.tsx:229` (was :217); the guardrail regex in `tests/design-tokens.test.mjs` bans `left-`/`right-`/`ml`/`mr`/`pl`/`pr`/`border-l`/`border-r` but not `object-left` |
| 13 | English-only "Show/Hide password" and "Apply" | Confirmed | `components/ui/field.tsx:166` (aria-label), `:70` ("Apply"); also `:58` (" optional") |
| 14 | `harness-client.tsx` pulls fixtures into the app build | Confirmed in source, bundle not measured | `app/%5F%5Fharness/harness-client.tsx:5-6` static imports of `tests/journey/fixtures`, `:23` template `import(`../../tests/journey/scenes/${c}`)` makes every scene file a client chunk; `lib/copy/index.ts` also drags in `lib/copy/framer-source.ts` (549 lines). Page still 404s without `ALMAR_HARNESS=1` (`app/%5F%5Fharness/page.tsx`) |
| 15 | `assemble-cloudflare.mjs` imports a `.ts` file | Confirmed | `scripts/assemble-cloudflare.mjs:5` imports `../lib/not-found-document.ts`; `package.json` has no `engines`; no `.nvmrc`, `.node-version` or `.tool-versions`; seven test files also import `.ts` directly (`tests/assemble-404.test.mjs:4`, `tests/cn.test.mjs:4`, `tests/copy.test.mjs:3-7`, `tests/https-url.test.mjs:3`, `tests/journey-format.test.mjs:3-4`, `tests/phase-03-fx.test.mjs:4`, `tests/phase-03-locale.test.mjs:4`). Works on the local Node v26.7.0; needs Node >= 22.18 (native type stripping). `@types/node` is `^20` |
| 16 | Leftover `vercel.json`, `Dockerfile` (node:20), `PLAN_FIX_ALL.md`, `_README.txt` | Confirmed | All four tracked at repo root. Also stale: `.dockerignore`, `README.md`, `HERMES.md`, `.hermes/measure-*.mjs` (see Tech Debt) |
| 17 | `wrangler.toml` has no `account_id` | Confirmed | `wrangler.toml` lines 1-14: `name`, `compatibility_date`, `workers_dev`, `[assets]`, two `[[routes]]`; no `account_id` |
| 18 | `npm audit`: postcss inside next, undici inside wrangler | Confirmed, re-run 2026-10-02 | 5 total: 2 high, 3 moderate. `postcss@8.4.31` nested in `next@15.5.26` (fix `next@16.3.8`, semver-major). `undici@7.29.0` via `miniflare` in `wrangler@4.141.0` (fix `wrangler@4.146.0`, not major). Plus moderate `miniflare`, `wrangler`, `next` |

Planned fixes already exist for items 15-17 and the wrangler half of 18 in `.planning/prompts/04-repo-tidy.md`; items 1-9 are assigned to Phase 2, 3.2 and 3.3 on the control board.

## Tech Debt

**Controls shown that do nothing (owner rule: a shown control must be live) [dev-only]:**
- Issue: beyond the eight in the verified table, these also have no effect: Dashboard Home date-range buttons (`app/dashboard/(ops)/home/home-screen.tsx:29,52` set `dateRange`, nothing reads it, and the metric cards at `:59-72` show only a heading); Maintenance switch (`settings-screen.tsx:43,100`, local state, no persistence); New booking / New customer / Calendar new-booking sidebars have fields but no save control (`app/dashboard/(ops)/bookings/bookings-screen.tsx`, `customers/customers-screen.tsx`, `calendar/calendar-screen.tsx:129-140`); `<Sidebar open={false} onOpenChange={() => undefined}>` can never open (`app/dashboard/(ops)/layout.tsx:262`); Settings brand logo/favicon/VAT/deposit/email fields are uncontrolled inputs with no save path.
- Files: listed above; tests that lock the no-op in: `tests/phase-03-settings.test.mjs:64`.
- Impact: the owner fills a form, clicks Save, and the value is silently lost.
- Fix approach: hide or disable-with-reason until the backend exists (3.2 for Catalog, Content, Settings; Phase 2 for sign-in and sign-out), and change `tests/phase-03-settings.test.mjs:64` to assert the rule instead of the no-op.

**Production gating by a per-page `NODE_ENV` check:**
- Issue: 23 files call `notFound()` or return 404 when `process.env.NODE_ENV === "production"` (every `page.tsx` under `app/login`, `app/account`, `app/bookings`, `app/booking/trip`, `app/dashboard`, plus `app/newsletter/route.ts`, `app/fx/route.ts`, `app/embed/**/route.ts`). `app/dashboard/(ops)/layout.tsx` and `app/layout.tsx` have no gate and there is no `middleware.ts`.
- Impact: this is the only thing keeping unfinished pages and dev endpoints off the live site. A new page or route added without the line is public; removing the line on a dashboard page before auth exists exposes it.
- Fix approach: replace with one server-side auth/feature gate (layout or middleware) when Phase 2 lands; until then add new pages with the gate and a test that walks `app/` for it.

**Design-token escape hatches:**
- Issue: `app/globals.css:126-135` font sizes (item 10); `settings-screen.tsx:12-22` hexes (item 11); `lib/cn.ts` `TOKEN_GROUPS` is a hand-kept mirror of `tokens.json` (guarded only by `tests/cn.test.mjs`); `lib/not-found-document.ts:22-26` inline hexes and `2rem` for the static 404 (deliberate exception, a test checks the hexes); `app/dashboard/(ops)/home/home-screen.tsx:19,50` use `bg-white` and `hover:bg-line` (default Tailwind palette still resolves under `@import "tailwindcss"`, and the guardrail does not ban it).
- Impact: Phase 5 Settings > Brand (DSGN-04) would edit only the desktop token values; phone sizes and copies drift silently.
- Fix approach: add per-step phone sizes to `tokens.json` and generate them in `scripts/generate-theme.mjs`; read the settings colours from `tokens.json`; add `object-(left|right)`, `bg-white` and default-palette names to the guardrail in `tests/design-tokens.test.mjs`. `app/globals.css` and `tokens.json` are shared files (ask the controller first).

**English-only strings in shared and screen code (breaks the EN/AR/ES rule):**
- Files: `components/ui/field.tsx:58,70,166`; `components/ui/confirm-dialog.tsx:24` (default "Stay signed in"); `components/ui/calendar.tsx:22,28,69,139,153,160` (month and weekday names, "Previous month", "Next month", all `en-GB`, no locale prop, used by `components/specimens/hero-booker.tsx` which does take a `locale`); `app/dashboard/(ops)/calendar/calendar-screen.tsx:14,25,53,88,97`; `components/ui/nav.tsx:174,217` ("ALMAR Private Journeys home", "Primary"); `app/layout.tsx:12` ("Skip to content"); `app/error.tsx`, `app/not-found.tsx`; `components/ui/footer.tsx`, `components/ui/whatsapp.tsx:8`; `app/dashboard/(ops)/layout.tsx:12,231,253` (`INTERIOR_MARK = "DASHBOARD"` as visible text and `aria-label`); table headers and field labels in every dashboard screen (`Name`, `Status`, `Guest`, `Destination`, `Dates`, `Type`, `Price`, `Reminders`, `Charts`, "Date range"); `catalog-screen.tsx:184` and `content-screen.tsx:126` ("Enter a URL that starts with https://.").
- Impact: Arabic and Spanish pages show English labels and English accessible names.
- Fix approach: take labels as props or from `lib/copy/*` (shared file, controller OK first); `components/journey/date-range-panel.tsx` (uses `INTL_TAG[locale]`) is the localized model to copy.

**Duplicated logic:**
- `readLocale()` is copy-pasted into nine files (`app/dashboard/(ops)/layout.tsx:57`, `bookings/bookings-screen.tsx:10`, `content/content-screen.tsx:43`, `profile/profile-screen.tsx:12`, `home/home-screen.tsx:21`, `calendar/calendar-screen.tsx:18`, `catalog/catalog-screen.tsx:43`, `customers/customers-screen.tsx:10`, `settings/settings-screen.tsx:24`). Move one copy to `lib/set-document-locale.ts` (the review already proposed this) and call it on guest pages too.
- Destination list `["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"]` in `components/specimens/hero-booker.tsx:77`, `lib/framer-hero-booker-mount.tsx:11`, `app/booking/trip/trip-screen.tsx:11`. Phase 3.2 makes destinations CMS data; until then keep one constant.
- Two calendar implementations: `components/ui/calendar.tsx` (English-only, used by the legacy hero booker) and `components/journey/date-range-panel.tsx` (localized, blocked dates, 2-month). Plan 23 / 3.3 is meant to retire the first.
- Helpers repeated: `fill` (`components/specimens/hero-booker.tsx:73`, `lib/journey-format.ts:37`), `fillNodes` (`journey-bar.tsx:59`, `journey-sheet.tsx:21`, `date-range-panel.tsx:77`), `formatDate` (`components/ui/calendar.tsx:17`, `lib/format.ts:19`), `compare`/`cmp`/`utc` date helpers in three files.
- Contact constants (phone, email, WhatsApp number) hard-coded in `components/ui/footer.tsx:40-43` and `components/ui/whatsapp.tsx:7`, besides the Framer HTML.

**Dead code and leftovers:**
- `lib/copy/framer-source.ts` (549 lines): only consumers are `lib/copy/index.ts` and tests; ships into the harness bundle.
- `lib/fx/rates.ts`: `homePriceScript()` (`:167`, ~100 lines of inline JS in a string), `rewriteHomeAmounts()` (`:113`) and the `WRITTEN` price table have no caller; only `loadRates()` is used (by `app/fx/route.ts` and the settings page).
- Unused components: `components/ui/footer.tsx`, `components/ui/checkbox.tsx`, `components/ui/toggle-card.tsx` (imported nowhere); `components/specimens/hero-booker.tsx:89` `GUEST_ROWS`.
- Dead class hooks with no CSS: `field`, `field-label`, `field-coupon`, `field-control`, `is-password`, `field-error`, `field-hint`, `ui-input`, `ui-button-inline` in `components/ui/field.tsx`; `choice`, `choice-mark` in `checkbox.tsx`; comments claiming "legacy rules" are stale.
- `data-density="compact"` set on `<html>` at `app/dashboard/(ops)/layout.tsx:91-99`; the only CSS variant is `dense` (`app/globals.css:5`).
- Two "skip to content" links on dashboard pages: `app/layout.tsx:11-13` and `app/dashboard/(ops)/layout.tsx:209-214`.
- Test-only props in production components: `initialOpen`, `forceMissing` (`components/journey/journey-bar.tsx:40-43`), `defaultOpen` (`journey-cart.tsx:36`), a "Harness only" prop in `journey-sheet.tsx:114`.
- Stale root files **[repo hygiene]**: `PLAN_FIX_ALL.md` (Next 14.2.35 / Vercel plan, cites a `app/lib/html-patch.ts` that does not exist), `_README.txt`, `vercel.json` (with `cleanUrls` and headers nothing reads), `Dockerfile` (`node:20-alpine`, copies only `package.json` so it ignores the lockfile, runs `npm install`), `.dockerignore`, `README.md` and `HERMES.md` (both describe Next 14 and Vercel; `.planning/config.json` sets `claude_md_path` to `./HERMES.md`, so GSD agents receive stale stack facts), `.hermes/measure-33-38.mjs` and `.hermes/measure-short.mjs` (drive the deleted `/design` route), `framer-export/` (300 KB catalog and code components, excluded from `tsconfig.json`), comment in `app/route.ts:6` pointing at a missing `lib/nextjs-export.ts`, `.claude/rules/connections.md` saying "Supabase has no project yet".
- Superseded planning snapshots: `.planning/design/2026-09-29-system/` (3.9 MB) is replaced by `.planning/design/2026-10-01-canvas/` (3.8 MB).

**Framer HTML-as-app [live]:**
- Issue: each public page is one string constant in `app/**/route.ts` (26 files, 11.3 MB total; `app/route.ts` is 672 KB; the three services and three blog pages are 166 KB each).
- Impact: no component reuse, no tokens, no CMS; changing copy means patching a 600 KB single-line string. The Framer runtime is what makes the page work.
- Fix approach: Phase 3.3 and Phase 6 replace these with React pages and remove the Framer bridge. Until then do not edit them by hand; never open them unfiltered (a single `Read` can exhaust context).

## Known Bugs

**Fake team members are published on the live site [live]:**
- Symptoms: "Ana Velásquez", "Mateo Ríos", "Sofía Marín" appear in `app/route.ts`, `app/about/route.ts` and `app/contact/route.ts` (Meet the Team block). The owner decided on 2026-09-28 (`.planning/decisions/2026-09-28-design-audit.md`) that they are fake and must be removed; the verifier records it as a deferral to 3.3 and Phase 6 (D-56).
- Files: the three `route.ts` files above; `tests/no-team-names.test.mjs` deliberately excludes `route.ts`.
- Trigger: any visitor to `/`, `/about`, `/contact`.
- Workaround: none in code. Needs an owner decision on whether to strip the block from the HTML now (a scripted edit of three files) or wait for 3.3.

**Placeholder stub pages are published [live]:**
- Symptoms: `/services/24-7-private-concierge`, `/services/luxury-ground-transport`, `/services/vip-airport-meet-greet` and `/blog/why-medellin-is-redefining-luxury-travel`, `/blog/colombias-coffee-triangle-eje-cafetero`, `/blog/discovering-cartagenas-hidden-colonial-courtyards` are clones of the list pages with only title, meta description, canonical and one `<h1>` swapped (file header: "Auto-generated stub ... placeholder HTML"; a `diff` of two blog stubs shows differences only in those lines). Blog "posts" have no article body.
- Files: `app/services/*/route.ts`, `app/blog/*/route.ts`.
- Impact: breaks the "no placeholders" rule; near-duplicate pages hurt search ranking.
- Fix approach: remove from navigation and sitemap until real content exists, or drive from the CMS (3.2 / 3.3).

**Broken internal links on every page [live]:**
- Symptoms: the Framer footer links to `./legal/privacy-policy`, `./legal/terms-of-service`, `./legal/liability-waiver`, `./legal/disclaimer`, `./legal/booking-terms`; there is no `app/legal/`. Stay links `./private-stays/yury-house-cartagena`, `./private-stays/corona-island`, `./private-stays/baru-house` have no route (12 stay routes exist). All answer the branded 404.
- Impact: a site that will collect personal data has no privacy policy or terms. Legal copy must come from the owner (do not invent it).
- Fix approach: owner supplies text; build the pages in the dashboard Content > Legal flow (`app/dashboard/(ops)/content/legal`) or as interim static routes.

**Canonical and structured data point at the wrong host [live]:**
- Symptoms: `<link rel="canonical" href="/">` and `og:url` are root-relative in every Framer page (a runtime script patches them in the browser); the JSON-LD `@id` and `url` in `app/route.ts` are `https://almarprod.framer.website/`. `public/` has no `robots.txt` or `sitemap.xml`. `wrangler.toml:3` `workers_dev = true` also serves the whole site on a second public hostname.
- Impact: crawlers that do not run the patch script see invalid canonicals; the duplicate workers.dev hostname is indexable.
- Fix approach: absolute canonical and `og:url` for `https://almarprivatejourney.com`, correct the JSON-LD, add `robots.txt` and `sitemap.xml` to `public/`, set `workers_dev = false` (owner-gated deploy).

**Nav marks "Destinations" as the current page by default [dev-only]:**
- Symptoms: `components/ui/nav.tsx:53,221` `markCurrent = true` sets `aria-current="page"` on the first link; all four call sites pass `false`, so only the default is wrong.
- Fix approach: default to `false` or derive from the route.

**Footer would crash and lie when mounted [dev-only, latent]:**
- Symptoms: `components/ui/footer.tsx:10` calls `useToast()`, which throws "ToastProvider is missing" (`components/ui/toast.tsx`); no layout mounts a `ToastProvider`. When it does render, a valid email only runs `push("Subscribed. Check your inbox.")` at `:23` and sends nothing. Footer links `#destinations`, `#experiences`, `#list-with-us` lead nowhere.
- Fix approach: mount the provider, POST to a real endpoint, show success only on `ok: true`, link to real routes.

**Dashboard calendar and shared calendar accessibility gaps [dev-only]:**
- `app/dashboard/(ops)/calendar/calendar-screen.tsx:108` and `components/ui/calendar.tsx:167` use `role="grid"` and `role="gridcell"` with no `role="row"`; the dashboard grid has up to 31 separate Tab stops and no arrow-key navigation (review item I3).

## Security Considerations

**No authentication exists; the dashboard is protected only by the production 404:**
- Risk: `app/dashboard/(ops)/*` renders with no session check. Anything that builds with `NODE_ENV !== "production"`, or removes a page's gate, exposes it.
- Files: `app/dashboard/(ops)/layout.tsx`, each `app/dashboard/(ops)/**/page.tsx`.
- Current mitigation: per-page production 404 (see Tech Debt); `tests/phase-02-gates.test.mjs` and `tests/harness-gate.test.mjs` check this by reading source text.
- Recommendations: Phase 2 auth chain (02-02 to 02-04, 02-08) must replace the env gate with a server-side session check before any dashboard page is un-gated.

**`.gitignore`, `.dockerignore` and editor-file gaps:**
- Risk: `.gitignore` ignores only `.env*.local`, so a plain `.env`, `.env.production` or a wrangler `.dev.vars` would be committable. `.DS_Store` is not ignored (it shows as untracked in `git status`) and `.claude/worktrees/` is not ignored (every work session creates worktrees there). `.dockerignore` (`node_modules`, `.next`, `.git`) does not exclude `.env*`, `CLAUDE.local.md` or `.claude`, so `COPY . .` in the `Dockerfile` would bake local secrets into an image layer.
- Files: `.gitignore`, `.dockerignore`, `Dockerfile`.
- Current mitigation: `.env.example` holds names only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`); a `git grep` for key-shaped strings outside the Framer HTML and planning docs found none; `CLAUDE.local.md` is ignored; job 04 adds `.DS_Store` and `.claude/worktrees/`.
- Recommendations: also ignore `.env`, `.env.*` (keep `!.env.example`) and `.dev.vars*`; delete the Dockerfile and `.dockerignore` (job 04 item 1).

**Deploy can reach the wrong Cloudflare account:**
- Risk: `wrangler.toml` has no `account_id`, and `package.json` `host:cloudflare` runs `node scripts/assemble-cloudflare.mjs && wrangler deploy`. The default `wrangler` login on this Mac sees only the Vamos account (control board), so a plain deploy targets another product's account.
- Files: `wrangler.toml`, `package.json:9`.
- Current mitigation: the controller deploys with an ALMAR-only `HOME` and `CLOUDFLARE_ACCOUNT_ID`.
- Recommendations: pin `account_id` (job 04 item 3) and extend `tests/host-config.test.mjs` to assert it.

**No security headers on the live site [live]:**
- Risk: `_headers` sets only `Cache-Control` for `/assets/*`, `*.webp`, `*.woff2`, `*.css`, `*.js`. No CSP, HSTS, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy or frame-ancestors. `vercel.json` has `nosniff` but is not used by Cloudflare.
- Files: `_headers`, `vercel.json`.
- Recommendations: add the standard set to `_headers`. A CSP must allow `framerusercontent.com`, `unpkg.com`, `files.catbox.moe` and `videos.pexels.com` until the Framer pages are replaced, and the Framer runtime needs inline scripts.

**Third-party code and media run on the live origin [live]:**
- Risk: the Framer runtime modules are loaded from `framerusercontent.com/sites/2GKmoXZ0OfHUpoaax6QTaM/*.mjs` (39 references in `app/route.ts`), plus 65 hosted image URLs; `https://unpkg.com/lenis@1.3.23/dist/lenis.css` has no integrity attribute; the home hero video is `https://files.catbox.moe/v0nj1o.mp4` (an anonymous file host) and a second video comes from `videos.pexels.com`. Framer controls scripts that run with full DOM access, and unpublishing or downgrading the Framer project breaks the site.
- Recommendations: self-host the hero video under `public/assets/`; pin or self-host the Lenis CSS; keep the Framer project published until Phase 6.

**`/newsletter` handler is thin [dev-only today]:**
- Risk: `app/newsletter/route.ts` validates the email with `includes("@")` (`:49`), has only a field-name honeypot, no origin check, rate limit or body-size limit. The honeypot list (`title`, `website`, `company`, `message`, `subject`, `comments`, `notes`, ...) would reject a legitimate form that posts any of those names. It returns 404 in production (`:35`) and no Framer page posts to it (0 references to `/newsletter` in `app/route.ts` and `app/contact/route.ts`).
- Current mitigation: production 404; key read only from `process.env.RESEND_API_KEY`; tests check source strings only.
- Recommendations: before enabling, add Cloudflare Turnstile or rate limiting, an Origin check, real email validation, and a behavioural test. Where the live Framer forms submit cannot be verified from this repo (the Framer runtime handles them); confirm leads actually arrive.

**`ALMAR_HARNESS=1` is the only guard on the harness route:**
- Risk: setting that variable in a deployed environment serves `/__harness` and any file in `tests/journey/scenes/` by name (`harness-client.tsx:23`). The name is validated (`app/%5F%5Fharness/page.tsx` `NAME` regex) so it cannot traverse paths.
- Recommendations: exclude the folder from production builds (item 14 fix) rather than rely on the variable.

**Dependency alerts (npm audit, 2026-10-02):**
- `postcss@8.4.31` inside `next` (high: `</style>` XSS in stringify output; file read via `sourceMappingURL`): runs only at build time on this repo's own CSS, so practical risk is low. Fix is Next 16 (see Dependencies at Risk).
- `undici@7.29.0` inside `miniflare` inside `wrangler` (high: WebSocket permessage-deflate DoS, RetryHandler body leak): dev tooling only. Fix `wrangler@4.146.0` (job 04 item 4).
- GitHub's 27 Dependabot alerts date from the August lockfile and need a re-scan (control board).

**Secrets handling when Supabase is wired (Phase 2):**
- The three Supabase names were set as secrets on the old Worker on the Vamos account (since deleted per `.planning/STATE.md`); the current Worker has none. `SUPABASE_SERVICE_ROLE_KEY` must stay server-only; `NEXT_PUBLIC_*` names are exposed to the browser by design. `@supabase/ssr` and `@supabase/supabase-js` are installed and unused.

## Performance Bottlenecks

**Framer pages are heavy [live]:**
- Problem: 400-670 KB of HTML per page for the main pages (`app/route.ts` 672 KB, stays about 510-590 KB each) before the 39 Framer module requests and 65 hosted images; hero videos are hot-linked from third parties (`preload="none"`, so they load on interaction).
- Files: `app/**/route.ts`, `public/assets/img/` (245 webp, 29 MB).
- Cause: Framer's published output served verbatim (the comment nodes must stay for hydration).
- Improvement path: replace with React pages in 3.3 and Phase 6; self-host and compress the videos now.

**Build depends on the network and builds everything:**
- Problem: `lib/fonts.ts` uses `next/font/google` for Noto Naskh Arabic and Noto Sans Arabic, fetched at build time; `scripts/assemble-cloudflare.mjs:11` runs a full `npm run build`, compiling all dev-only pages and 11 MB of route strings, then copies only `.body` files.
- Improvement path: self-host the Noto fonts with `next/font/local` like Questa and Lato; consider excluding dev-only routes from the production build.

**Repository weight:**
- `brand/` is 24 MB (18 Lato TTFs of which `lib/fonts.ts` uses 3, `.ai` files, a 6.7 MB PDF); `tests/journey/__screenshots__` is 15 MB (463 PNGs); `.git` is 62 MB after four commits.
- Improvement path: keep only used font files and the logos the code imports in the deployable tree; store the guideline PDF and `.ai` sources outside the repo.

**Client-side locale and cookie reads:**
- Every dashboard screen starts at `useState("en")` and corrects in `useEffect`, so Arabic and Spanish users see an English, left-to-right first paint; the `<html lang dir>` in `app/layout.tsx:8-9` is fixed to `en`/`ltr` and changed only by `setDocumentLocale` after hydration. When pages become server-rendered, read the cookie on the server.

## Fragile Areas

**`app/**/route.ts` Framer strings:**
- Files: 26 route files, 166 KB to 672 KB each.
- Why fragile: single-line strings with escaped quotes; unfiltered grep/read output is enormous; the hydration comment nodes must survive any edit; tests deliberately exclude them.
- Safe modification: script the change (read file, targeted replace, write), diff before and after, never hand-edit; use `grep -o` with a short context window.
- Test coverage: `tests/embed-sources.test.mjs` and a few source-string checks only.

**Cloudflare assemble path:**
- Files: `scripts/assemble-cloudflare.mjs`, `lib/not-found-document.ts`, `wrangler.toml`.
- Why fragile: relies on Next's internal `.next/server/app/**/*.body` output layout (not a public contract), on Node >= 22.18 type stripping, and on `process.cwd()` being the repo root (`lib/not-found-document.ts:11`). `wrangler.toml` serves static assets only: there is no `main`, no OpenNext config (`open-next.config.*` absent), so none of the React pages could be served if their gates were removed.
- Safe modification: run `npm run host:cloudflare` only from the repo root with the ALMAR Cloudflare environment; add `engines`; test `out/` contents after assemble.
- Test coverage: `tests/assemble-404.test.mjs` checks the 404 document and script text only; nothing asserts which pages land in `out/`.

**`next.config.ts` webpack hook:**
- Files: `next.config.ts`.
- Why fragile: mutates Next's built-in image rule (`rules.find(...).exclude = MARKUP_SVG`) and adds an `asset/source` rule; the comment itself lists a fallback. Next 16 builds with Turbopack by default and is expected to reject a custom `webpack` config unless `--webpack` is passed, which would block the postcss fix.
- Safe modification: replace the two markup SVG imports (`components/status-frame.tsx`) with `readFileSync` or inline SVG before upgrading.

**Source-text tests:**
- Files: most of `tests/phase-0*.test.mjs`, `tests/harness-gate.test.mjs`, `tests/host-config.test.mjs`.
- Why fragile: they assert exact JSX or regexes over source (`tests/phase-03-settings.test.mjs:64` requires the no-op Save; `tests/phase-02-gates.test.mjs:39` pins `next` to exactly 15.5.26; `tests/phase-03-locale.test.mjs` pins `framer-source.ts`). A correct refactor fails them, and a wrong behaviour can pass.
- Safe modification: change the test in the same commit as the code and say so in the hand-over.

**Hand-rolled focus traps and key handling:**
- Files: `components/ui/nav.tsx:121-150` (listener at `:149`), `app/dashboard/(ops)/layout.tsx:109-146` (listener at `:143`), `components/specimens/hero-booker.tsx`, `components/ui/calendar.tsx`, `components/journey/date-range-panel.tsx`.
- Why fragile: each overlay re-implements Escape, Tab wrap, scroll lock and focus restore with `document.addEventListener("keydown")`; W1, W2 and W4 were bugs of exactly this kind.
- Safe modification: extract one shared hook, or move to Radix `Dialog`; keep `tests/review-fixes.spec.ts` and `tests/journey/a11y.spec.ts` green.

**Phantom dependencies:**
- `components/ui/dialog.tsx:5` and `components/ui/confirm-dialog.tsx:5` import `@radix-ui/react-focus-scope`, which is not in `package.json` (only the umbrella `radix-ui`); `app/embed/hero-booker/route.ts:35` execs `node_modules/esbuild/bin/esbuild`, which exists only because `wrangler` and `@opennextjs/aws` hoist it. A different install layout or an upgrade breaks both.

**`components/ui/field.tsx` lacks `"use client"`:**
- It calls `useState` (`:151`) but only works because every importer is already a client component. Importing it from a server component fails at build.

**Dates and time zones:**
- Guest components use the browser zone for "today" (`components/ui/calendar.tsx:61`, `components/journey/date-range-panel.tsx:98` via `getLocalTimeZone()`; `components/specimens/hero-booker.tsx:134,150`); the dashboard calendar uses `Asia/Dubai` (`calendar-screen.tsx:13`); `.planning/PROJECT.md` requires UAE dates for calendars and slots. Server-rendered use of `today(...)` would mismatch at hydration near midnight.
- `components/specimens/hero-booker.tsx` and `lib/framer-hero-booker-mount.tsx:30` send `check-in` and `check-out` to `/booking/trip` as `DD/MM/YYYY` display strings. Use ISO `YYYY-MM-DD` before 3.3 parses them.

**Playwright and test environment:**
- `playwright.config.ts`: fixed port 3010, `reuseExistingServer: false`, runs `next dev` (not the production build), `maxDiffPixelRatio: 0`, `snapshotPathTemplate` without a platform suffix, so the 463 committed PNGs are Mac-only and every screenshot test fails on Linux; the `chooseArabic` helper flakes with parallel workers while `npm test` runs `playwright test` without `--workers=1`; the headless shell build 1243 is shared with other projects on this Mac; heavy load causes 30 s timeouts in journey-sheet a11y tests.
- No CI: there is no `.github/`; the controller's clean-clone run is the only gate.

## Scaling Limits

**FX rates cache:**
- Current capacity: `lib/fx/rates.ts:55` keeps rates in a module variable for 12 hours (`TWELVE_HOURS`), per server instance or isolate.
- Limit: every cold isolate fetches `https://latest.currency-api.pages.dev/v1/currencies/usd.json` (`:16`), a free third-party feed with no key or SLA; one retry, then the stale cached value, then `null`.
- Scaling path: before Phase 4 money logic, move rates to a stored, dated row refreshed by a scheduled job, with the booking recording the rate it used.

**Supabase plan:**
- The Free plan rejects time-boxed sessions; the 30-day session time-box stays unset until Pro (`.planning/STATE.md`). Limit applies when Phase 2 auth ships.

## Dependencies at Risk

**`next@15.5.26` (exact pin, test-pinned):**
- Risk: nested `postcss@8.4.31` is vulnerable; the only fix is `next@16.3.8` (major). `tests/phase-02-gates.test.mjs:39` asserts the exact version.
- Impact: audit stays at 2 high until the upgrade; upgrade touches `next.config.ts`, `@opennextjs/cloudflare`, React 19 peer ranges and the guardrail test.
- Migration plan: dedicated upgrade job after Phase 2's server runtime is configured; change the version test in the same commit.

**`wrangler@4.141.0`:** upgrade to exactly `4.146.0` (job 04 item 4) clears the `undici` high and the `miniflare` moderate.

**Declared but never imported:** `@opennextjs/cloudflare@1.20.6`, `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.117.2` (no import in `app/`, `components/`, `lib/`, `scripts/`, `tests/`). They are intended for Phase 2 (02-08) and pull `@opennextjs/aws` and `esbuild@0.25.4` into every install.

**Loose version ranges:** `react`, `react-dom`, `@types/*` and `typescript` use `^` while all other dependencies are exact; `@types/node` is `^20` while the repo needs Node >= 22.18.

**Third parties on the critical path:** Framer's CDN (`framerusercontent.com`), `files.catbox.moe`, `videos.pexels.com`, `unpkg.com`, Google Fonts at build time, and the currency feed above.

## Missing Critical Features

**Server runtime, auth, database, payments, email:**
- Problem: Worker `almar` serves static files only. No migration is applied; no `.env.local`; no secrets on the Worker; Stripe and Resend are not live; `app/newsletter/route.ts` is the only Resend code and it is gated off.
- Blocks: sign-in, sign-out, bookings, customers, catalogue saves, any dashboard use. Phase 2 (jobs 02, 02-08 runtime), then 3.2.

**The new journey bar is not on any page:**
- Problem: `components/journey/*` (bar, sheet, cart, step rail, add-ons) is imported only by `tests/journey/scenes/*` through the harness. The live home page still uses the Framer booker; `components/specimens/hero-booker.tsx` is mounted only by the dev-only `/embed/hero-booker`, which no live page references.
- Blocks: the booking path (3.3, Phase 4). `/booking/trip` is a stub that prints its query string.

**Legal pages and site metadata:** privacy policy, terms, booking terms, waiver and disclaimer (see Known Bugs); `robots.txt`; `sitemap.xml`.

**CMS-driven content:** team, destinations, stays, services, blog, prices. Prices live as strings in `lib/copy/home.ts:131-145,241-255,351-365` and in `lib/fx/rates.ts` `WRITTEN`; destinations are code constants.

**Server-side locale:** the `almar-locale` cookie is never read on the server, so guest pages cannot render Arabic or Spanish on first paint.

**CI and dependency updates:** no GitHub Actions, no Dependabot configuration, no automated install-test-build on `main`.

## Test Coverage Gaps

**Behaviour of the assembled live site:**
- What's not tested: which pages land in `out/`, that dev-only routes are absent from it, that the 26 pages and the 404 respond, headers, and the Framer HTML's link targets (the 8 broken links above passed every test).
- Files: `scripts/assemble-cloudflare.mjs`, `_headers`, `app/**/route.ts`.
- Risk: a build change in Next's output layout could silently drop pages.
- Priority: High.

**Dead controls are asserted as correct:**
- What's not tested: that a shown control does something. `tests/phase-03-settings.test.mjs:64` requires the no-op.
- Priority: High (owner rule).

**Server-side behaviour:**
- What's not tested: `app/newsletter/route.ts` and `app/fx/route.ts` are checked only by reading their source (`tests/phase-03-newsletter.test.mjs`, `tests/phase-03-fx.test.mjs`); no request-level test of the 400, 502 and 503 paths.
- Priority: Medium (dev-only today, High when enabled).

**Production build under the harness gate:**
- What's not tested: that no fixture or scene chunk appears in `.next/static` (item 14); `tests/harness-gate.test.mjs` reads `page.tsx` only.
- Priority: Medium.

**Visual and accessibility suites cannot run off the Mac:**
- What's not tested: Linux or CI runs of the 1,141 Playwright tests (screenshots fail on font rendering); contrast of `muted` `#63615f` text on ivory was not measured (3.1 verification).
- Priority: Medium.

**i18n correctness:** `tests/copy.test.mjs` checks key parity across EN, AR and ES, not that components use the catalogue (English strings above); AR and ES copy is a draft awaiting owner review.

## Planning Drift To Reconcile

- Reconciled by the controller on 2026-10-02: the board, `CLAUDE.local.md` and the prompts now agree (old Worker and Pages project deleted; work folders in `.claude/worktrees/<job>`).
- `.hermes.md` names `CLAUDE.md` as the engineering source of truth; no `CLAUDE.md` exists in the repo.

---

*Concerns audit: 2026-10-02*
