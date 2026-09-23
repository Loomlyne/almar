# Phase 1: Design system - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 40 new, modified, or deleted files
**Analogs found:** 14 / 40

This repo has no React pages, no `components/`, no `lib/`, no Tailwind, no PostCSS config, and no tests. Public URLs are `app/**/route.ts` handlers that return an HTML string. New files must not copy that handler shape, and must not edit Framer HTML except deleting `app/[...not_found]/route.ts` after `app/not-found.tsx` returns a real 404.

Do not recommend shadcn. D-21 forbids it. Do not add `tailwind.config.js`, `app/page.tsx`, path aliases, or a second client site as an analog.

`.planning/codebase/CONVENTIONS.md` says "do not add `page.tsx` / `layout.tsx` / `not-found.tsx`". CONTEXT.md and RESEARCH.md supersede that for `app/layout.tsx`, `app/design/page.tsx`, `app/not-found.tsx`, and `app/error.tsx` only. `/` stays `app/route.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | batch | `package.json` | exact |
| `postcss.config.mjs` | config | transform | `next.config.js` | partial |
| `app/globals.css` | config | transform | `app/[...not_found]/route.ts` style block + `brand/Font/questa-webfont/style.css` | partial |
| `lib/fonts.ts` | utility | transform | `brand/Font/questa-webfont/style.css` | partial |
| `lib/format.ts` | utility | transform | none — literals in `app/contact/route.ts` | none |
| `app/layout.tsx` | provider | request-response | `<html lang dir>` in `app/[...not_found]/route.ts` | partial |
| `app/design/page.tsx` | route | request-response | none — do not clone `app/contact/route.ts` | none |
| `app/not-found.tsx` | route | request-response | `app/[...not_found]/route.ts` | role-match |
| `app/error.tsx` | route | request-response | `app/[...not_found]/route.ts` | partial |
| `app/[...not_found]/route.ts` | route | request-response | itself — delete | exact |
| `scripts/assemble-cloudflare.mjs` | utility | file-I/O | itself — must change when the catch-all is deleted | exact |
| `playwright.config.ts` | config | request-response | none | none |
| `tests/design-tokens.test.mjs` | test | transform | none | none |
| `tests/design-page.spec.ts` | test | request-response | none | none |
| `tests/design-rtl.spec.ts` | test | request-response | none | none |
| `tests/design-a11y.spec.ts` | test | request-response | none | none |
| `tests/not-found.spec.ts` | test | request-response | none — assert against the current 404, do not copy it | none |
| `tests/design-video.spec.ts` | test | event-driven | `<video>` inside `app/route.ts` line 15 | partial |
| `components/ui/button.tsx` | component | request-response | none | none |
| `components/ui/link.tsx` | component | request-response | none | none |
| `components/ui/field.tsx` | component | request-response | none | none |
| `components/ui/select.tsx` | component | request-response | none | none |
| `components/ui/checkbox.tsx` | component | request-response | none | none |
| `components/ui/radio.tsx` | component | request-response | none | none |
| `components/ui/switch.tsx` | component | request-response | none | none |
| `components/ui/dialog.tsx` | component | request-response | none | none |
| `components/ui/toast.tsx` | component | request-response | none | none |
| `components/ui/calendar.tsx` | component | request-response | none | none |
| `components/ui/stepper.tsx` | component | request-response | none | none |
| `components/ui/nav.tsx` | component | request-response | logo SVGs; 404 `<nav>` is an anti-pattern | partial |
| `components/ui/footer.tsx` | component | request-response | contact strings in `app/route.ts` line 15 and `app/contact/route.ts` | partial |
| `components/ui/chip.tsx` | component | request-response | none | none |
| `components/ui/skip-link.tsx` | component | request-response | none | none |
| `components/icons/*.tsx` | component | transform | `brand/Icons/Icons-01.jpg`–`Icons-14.jpg` and logo SVGs | none |
| `components/specimens/stay-row.tsx` | component | transform | none | none |
| `components/specimens/add-on.tsx` | component | transform | none | none |
| `components/specimens/price.tsx` | component | transform | none | none |
| `components/specimens/hero-booker.tsx` | component | transform | none | none |
| `components/specimens/team.tsx` | component | transform | Meet the Team block in `app/route.ts` line 15 | partial |
| `components/specimens/video.tsx` | component | event-driven | `<video>` in `app/route.ts` line 15 | partial |

Remaining locked visuals (cookie bar, map pin, FAQ, sign-in split, and the rest of D-80–D-205) are static frames composed by `app/design/page.tsx`. They are not routes and they are not extra `app/**/route.ts` files. Fixture copy only. No fetch, no Stripe mount, no Supabase.

Brand files are read-only inputs. Do not move `brand/`. Do not edit SVG fills. Do not rename hashed files under `public/assets/`.

## Pattern Assignments

### `package.json` (config, batch)

**Analog:** `package.json` (modify in place)

**Core pattern** (lines 5–21): scripts are `dev`, `build`, `start`, `host:cloudflare` only. Dependencies are `next@14.2.35`, `react@^18.3.1`, `react-dom@^18.3.1`. There is no `test` script and no Tailwind.

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "host:cloudflare": "node scripts/assemble-cloudflare.mjs && wrangler deploy"
},
"dependencies": {
  "next": "14.2.35",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

Add the RESEARCH install set and the Wave 0 `test` script. Do not upgrade Next. Do not add shadcn, `class-variance-authority`, `lucide-react`, `next-intl`, `react-aria`, or `react-aria-components`.

---

### `postcss.config.mjs` (config, transform)

**Analog:** `next.config.js` (partial — the only JS config). No `postcss.config.*` exists.

**Config shape to keep on the Next file** (`next.config.js` lines 1–3). Do not convert this file to ESM. Do not add a `tailwind.config.js`.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
module.exports = nextConfig;
```

`postcss.config.mjs` itself has no analog. RESEARCH cites the Tailwind v4 Next guide (`@tailwindcss/postcss`, `@import "tailwindcss"`). Follow that guide for the new PostCSS file. Do not invent a v3 `content` array.

`tsconfig.json` has `"strict": true`, `"jsx": "preserve"`, and no `paths` / `baseUrl` (lines 11–18, 26–30). New modules use relative imports. Do not add a path alias.

---

### `app/globals.css` (config, transform)

**Analog:** style block in `app/[...not_found]/route.ts` lines 27–49, and `brand/Font/questa-webfont/style.css` lines 3–7. Copy neither as tokens.

**Do not copy** (404 lines 28–45): Bricolage `@font-face`, `#f9f6f3`, `#0f677d`, `border-radius: 999px`, physical `left: 0; right: 0`, `opacity: 0.8` / `0.6` for text, pill CTA.

```css
@font-face { font-family: "Bricolage Grotesque"; src: url(/assets/fonts/1ed9594761d535c5.woff2) format('woff2'); font-display: swap; font-style: normal; font-weight: 400 }
body { background: #f9f6f3; color: #1f3b40; font-family: 'Bricolage Grotesque', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
.link-primary { display: inline-block; background: #1f3b40; color: #fffaf0; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0.04em; }
```

**Font file that does exist** (`brand/Font/questa-webfont/style.css` lines 3–7). Load it through `next/font/local`, not by importing this CSS.

```css
@font-face {
font-family: 'Questa';
font-style: normal;
font-weight: normal;
src: local('Questa'), url('2-Questa_Regular.woff') format('woff');
}
```

Token values come from UI-SPEC, not from the Framer export. Warning amber in UI-SPEC is `#8a3b12`. RESEARCH A5 used `#8a5a12`. The approved UI contract wins. Do not put raw hex in `components/`. Banned as tokens: `#f9f6f3`, `#183e43`, `#a98e58`, `#0f677d`, Bricolage, Philosopher.

Homepage export (inside `app/route.ts` line 15, not a separate CSS file) is the measure source only:

- Content column: `max-width:1240px` (5 hits). Snap already on the 4px grid. Token `--column: 1240px` (D-58 / RESEARCH A2).
- Radius literals are `0` and `40px`. Do not promote the 404's `999px`.
- Do not reset Tailwind breakpoints. The export's `809.98px` cluster is not a new breakpoint.

---

### `lib/fonts.ts` (utility, transform)

**Analog:** `brand/Font/questa-webfont/style.css` lines 3–7, plus the hashed `@font-face` rules embedded in `app/route.ts` line 15. No `next/font` call exists.

Homepage font rules (same line 15 string; do not keep these URLs for the React island):

```css
@font-face { font-family: "Lato"; src: url(/assets/fonts/a4bbb840febca7ae.woff2); font-display: swap; font-style: normal; font-weight: 400 }
@font-face { font-family: "Questa Regular"; src: url(/assets/fonts/f2a9e3735ebb9669.woff); font-display: swap; font-style: normal; font-weight: 400 }
```

Load the repo files RESEARCH names, not the hashed `public/assets/fonts/` copies and not a Google serif:

- `brand/Font/questa-webfont/2-Questa_Regular.woff` — weight 400 only. No Bold/Grand file is in the repo.
- `brand/Font/lato/Lato-Regular.ttf`, `Lato-Italic.ttf`, `Lato-Bold.ttf` only. Do not load Hairline, Thin, Light, Medium, Semibold, Heavy, or Black. Those files are on disk and are out of the contract.

Arabic faces are not on disk. `next/font/google` (`Noto_Naskh_Arabic`, `Noto_Sans_Arabic`) applies only while the `/design` preview language is AR. No component in this repo shows that conditional class pattern. There is nothing to copy.

---

### `app/layout.tsx` (provider, request-response)

**Analog:** the document element in `app/[...not_found]/route.ts` lines 9–10. Copy `lang` and `dir` onto `<html>`. Do not copy the `<nav>`, `<footer>`, generator meta, or Bricolage.

```html
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="generator" content="Framer 089ff9b">
```

Homepage HTML (inside `app/route.ts` line 15) uses the same attributes plus a Framer timezone flag. Do not copy `data-redirect-timezone`.

```html
<html lang="en" data-redirect-timezone="1" dir="ltr">
```

Layout owns `<html>`, font variables, `globals.css`, `color-scheme: light`, and the skip link. It does not render product nav or footer. Route handlers are not wrapped by the layout, which is why adding it does not restyle Framer pages — provided no `route.ts` imports `globals.css`.

---

### `app/not-found.tsx` (route, request-response)

**Analog:** `app/[...not_found]/route.ts` (role-match). This file is what the new boundary replaces. Copy the document title and the `<h1>` string. Do not copy chrome, type, or color.

**Why the framework boundary does not run today** (lines 1–6, 83–90):

```typescript
// Branded 404 catch-all. Every page in this app is a route handler
// (app/**/route.ts) with no root layout, so the framework's not-found
// boundary (app/not-found.tsx) is never entered for arbitrary paths.
export const dynamic = "force-dynamic";

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

**Strings worth keeping** (lines 15, 67–71): title `Page not found | ALMAR`, heading `Page not found`. The link label in the file is `Return Home`. UI-SPEC locks `Return home`. Use the contract string. The current page also links Destinations and Contact. The new page has one link, `href="/"`.

```html
<title>Page not found | ALMAR</title>
<h1>Page not found</h1>
<a class="link-primary" href="/">Return Home</a>
<a class="link-secondary" href="/destinations">Destinations</a>
<a class="link-secondary" href="/contact">Contact</a>
```

Monogram asset for the new page (not used by the current 404): `brand/Logo Monogram/Curves_black.svg`. Fills are hardcoded `rgb(38,38,38)` on the sibling wordmark (`brand/Logo Typography/Poly_Black.svg` line 7). Do not recolor the file. Do not mirror it in RTL.

```svg
<path d="M0,19.902L27.491,19.902..." style="fill:rgb(38,38,38);fill-rule:nonzero;"/>
```

---

### `app/error.tsx` (route, request-response)

**Analog:** same catch-all 404. No `error.tsx` exists. Share the 404 layout (ivory, monogram, Questa line, no nav, no footer, no Bricolage). Line is `This page did not load.` Action is text `Try again`, not a second home link. There is no retry helper in the repo to copy.

---

### `app/[...not_found]/route.ts` (route, request-response) — delete

**Analog:** itself. Delete only after `app/layout.tsx` and `app/not-found.tsx` exist and an unknown path returns 404 with no `Bricolage`, and `GET` on `/contact` still returns the Framer HTML string.

Do not edit any other `app/**/route.ts`.

---

### `scripts/assemble-cloudflare.mjs` (utility, file-I/O)

**Analog:** itself. RESEARCH does not name this file. It is coupled to the catch-all. Deleting `app/[...not_found]/route.ts` without changing this script breaks `npm run host:cloudflare`.

**Read of the catch-all** (lines 9, 45–50, 66–67):

```javascript
const notFoundRoute = path.join(root, "app/[...not_found]/route.ts");

const source = fs.readFileSync(notFoundRoute, "utf8");
const match = source.match(/const HTML = `([\s\S]*)`;\r?\n\r?\nexport function GET/);
if (!match) {
  throw new Error("could not extract branded 404 HTML");
}
fs.writeFileSync(path.join(outDir, "404.html"), match[1]);
```

The regex only matches the backtick `HTML` template in the catch-all. A React `not-found.tsx` will not satisfy it. The planner must replace this extraction after the catch-all is deleted (build output, or a static render of the new 404). Do not leave the script pointing at a deleted file. Do not run `wrangler deploy` in this phase.

---

### `components/ui/nav.tsx` (component, request-response)

**Analog:** logo files, not the 404 nav.

**Do not copy** (`app/[...not_found]/route.ts` lines 35–63): fixed bar, physical `left`/`right`, pill `nav-cta`, letter-spaced uppercase links, `z-index: 50`.

```css
nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; padding: 18px 32px; background: rgba(249,246,243,0.92); backdrop-filter: blur(8px); }
.nav-cta { color: #f9f6f3; background: #1f3b40; padding: 8px 16px; border-radius: 999px; }
```

**Do copy as assets, unmodified:**

- Desktop wordmark: `brand/Logo Typography/Poly_Black.svg` (`viewBox="0 0 2787 670"`, fill `rgb(38,38,38)`).
- Small-screen monogram: `brand/Logo Monogram/Curves_black.svg` (`viewBox="0 0 2944 1612"`).

Homepage nav labels in the `app/route.ts` page map (line 11) are Framer duplicates (`DESTINATIONSDESTINATIONS`). UI-SPEC header specimen links are Destinations, Experiences & Services, About, Contact, Log in. Do not copy the duplicated Framer labels.

---

### `components/ui/footer.tsx` (component, request-response)

**Analog:** strings inside `app/route.ts` line 15 and `app/contact/route.ts` line 15. No footer component exists. The 404 footer (lines 77–79) is the wrong chrome (Bricolage, extra links, `#0f677d`).

Homepage line 15 contains:

- `mailto:inquiries@almarprivatejourney.com`
- `https://www.instagram.com/almarprivatejourney/` (four hits; current markup uses `https://www.instagram.com/almarprivatejourney/`)

`+971 56 388 3302` does not appear in `app/route.ts` (count 0). It is in `app/contact/route.ts` line 15, twelve times, including the description meta. Use that number. Do not use the brand-book footer contact.

```html
<meta name="description" content="Call +971 56 388 3302 or email inquiries@almarprivatejourney.com. Tell us your dates and we plan the rest.">
```

`List with us` is not in the homepage HTML (count 0). It is a new specimen label from D-180, not a string to recover from Framer.

---

### `components/specimens/team.tsx` (component, transform)

**Analog:** Meet the Team in `app/route.ts` line 15. Measure the frame. Do not copy the names.

Section id and label (same line 15):

```html
<section class="framer-1qmund0" data-framer-name="Meet the Team" id="team">
```

Portrait frame CSS (same line 15):

```css
.framer-b5axmx{height:420px;overflow:var(--overflow-clip-fallback,clip);flex:none;width:100%;position:relative}
.framer-15zeqp4{grid-template-columns:repeat(3,minmax(280px,1fr));gap:32px;width:100%;display:grid}
```

Image is 900×1350, `object-fit:cover`, `border-radius:inherit`. The portrait rule sets no radius, so the live shape is a rectangle, not a circle. Alt text in the export is the placeholder name:

```html
<img width="900" height="1350" alt="Ana Velásquez" style="display:block;width:100%;height:100%;border-radius:inherit;object-position:center;object-fit:cover">
```

Published names are Maria Del Mar Valdes and María Francis (D-120). The export's `Ana Velásquez`, `Mateo Ríos`, and `Sofía Marín` are placeholders (page map, `app/route.ts` line 12, four hits each). Do not ship them.

---

### `components/specimens/video.tsx` (component, event-driven)

**Analog:** the homepage background video inside `app/route.ts` line 15. Copy the URL and the muted / playsinline attributes. Do not add a new host. Do not copy `preload="none"` as the whole pause behavior — DSGN-07 needs an `IntersectionObserver` pause, which does not exist in this repo.

```html
<video src="https://files.catbox.moe/v0nj1o.mp4" loop="" preload="none" poster="/assets/img/caedcb84dd0d35bb.webp" muted="" playsinline="" style="cursor:auto;width:100%;height:100%;border-radius
```

Poster hash `caedcb84dd0d35bb.webp` is a Framer asset. Do not rename it. A quiet corner control (`Pause video` / `Play video`) has no analog.

---

### `app/contact/route.ts` and `app/route.ts` (do not modify)

**Analog for "what a page is today."** New pages must not follow this.

`app/route.ts` lines 1–6 and 13–25, and the same shape in `app/contact/route.ts` lines 13–25:

```typescript
// rendering this through JSX instead was tried and
// reverted because React cannot emit comment nodes
export const dynamic = "force-static";

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

`/design` is a React `page.tsx`, not a third HTML string. Putting `page.tsx` beside `app/route.ts` would conflict with `/`. Do not.

## Shared Patterns

### Request shape today

**Source:** `app/contact/route.ts` lines 13–25 and `app/[...not_found]/route.ts` lines 83–90
**Apply to:** every existing Framer URL. Do not apply to `app/layout.tsx`, `app/design/page.tsx`, `app/not-found.tsx`, or `app/error.tsx`.

Named `GET`, no request argument, no `try/catch`, no JSON body. Static pages omit `status`. The catch-all sets `status: 404` and `dynamic = "force-dynamic"`. Header keys are lowercase. Double quotes. Semicolons. Two-space indent. No imports.

### Authentication

**Source:** none. `package.json` has no auth dependency. D-35 forbids a password, cookie, or shared secret in the repo.
**Apply to:** `app/design/page.tsx`

The only gate this phase has is `notFound()` when `NODE_ENV === "production"`. That call has no analog in the repo. Phase 2 replaces it. Do not add basic auth.

### Error handling

**Source:** `app/[...not_found]/route.ts` lines 83–90
**Apply to:** the delete-and-replace of the catch-all, and to `tests/not-found.spec.ts`

Unknown paths must keep a real 404 status. The new boundary must not throw a generic 500, must not include `Bricolage`, and must not include `generator` Framer. `/contact` must still be the Framer string from `app/contact/route.ts`.

There is no `try/catch` in application TypeScript. Do not add request logging.

### Validation

**Source:** none. Specimens do not submit.
**Apply to:** field, coupon, newsletter, and contact specimens on `/design`

Field error replaces the hint. `aria-invalid` and `aria-describedby` have no existing component to copy. No `dangerouslySetInnerHTML` anywhere in `app/**/route.ts` TypeScript (HTML is a string constant, which is a different risk — do not introduce HTML injection in React).

### Contact and locale literals

**Source:** `app/contact/route.ts` line 15; `app/route.ts` line 15
**Apply to:** footer, WhatsApp, and any specimen that shows contact

- Email: `inquiries@almarprivatejourney.com`
- Phone: `+971 56 388 3302`
- WhatsApp URL is not in the routes. UI-SPEC locks `https://wa.me/971563883302`. Do not invent another number.
- Instagram: `https://www.instagram.com/almarprivatejourney/`
- Document language today is `lang="en"` `dir="ltr"` on every route, including the 404 (line 9). Arabic preview must set those attributes on `document.documentElement`, not on a wrapper. No component does this yet.

### Logical CSS

**Source:** the 404 and the homepage are the counter-examples.
**Apply to:** every file under `components/`

404 nav uses `left: 0; right: 0` (line 35). Homepage team image wrapper uses `top:0;right:0;bottom:0;left:0` (`app/route.ts` line 15). Do not copy physical edges. New controls use `inset-inline-*`, `padding-inline`, `text-align: start` / `end`. Password eye is `inset-inline-end`.

### Icons

**Source:** `brand/Icons/` (14 JPGs + `Icons.ai`) and the logo SVGs. No SVG icon component exists. No `<svg>` in `app/**/*.ts`.
**Apply to:** `components/icons/*.tsx`

Do not `<img src="brand/Icons/Icons-0N.jpg">`. Trace to `currentColor` SVG components. Eye, chevron, close, lock, heart, and spinner are geometric, not brand JPGs. Logo SVGs keep their hardcoded fill and are referenced as files, not recolored.

## No Analog Found

Planner should use RESEARCH.md and UI-SPEC.md for these. The closest file actually read is cited so the absence is verified.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/format.ts` | utility | transform | No `Intl` helper, no currency formatter. Closest literals are the contact meta in `app/contact/route.ts` line 15. Amounts, `DD/MM/YYYY`, and `ar-AE-u-nu-latn` are not in the repo. |
| `app/design/page.tsx` | route | request-response | No `page.tsx`. Closest request file is `app/contact/route.ts` lines 13–25, which returns an HTML string. Do not clone it. Production `notFound()` has no call site to copy. |
| `playwright.config.ts` | config | request-response | No Playwright, Jest, or Vitest config. `.planning/codebase/TESTING.md` records zero `*.test.*` / `*.spec.*`. Closest check is `npm run build` in `package.json`. |
| `tests/design-tokens.test.mjs` | test | transform | No test runner. Node's built-in runner is the RESEARCH choice. Nothing in-repo uses `node:test`. |
| `tests/design-page.spec.ts` | test | request-response | No e2e. Inventory must be asserted against UI-SPEC, not against Framer DOM classes (`framer-*`). |
| `tests/design-rtl.spec.ts` | test | request-response | No RTL toggle. Every current document is `dir="ltr"` (`app/[...not_found]/route.ts` line 9). |
| `tests/design-a11y.spec.ts` | test | request-response | No focus-ring rule in application CSS. The 404 sets no `:focus-visible`. Do not treat missing outline as the pattern. |
| `tests/not-found.spec.ts` | test | request-response | No test. The behavior to reject is the current body: `Bricolage Grotesque`, `#f9f6f3`, three links (`app/[...not_found]/route.ts` lines 29–73). |
| `components/ui/button.tsx` | component | request-response | No `<button>` component. Closest painted control is `.link-primary` in the 404 (lines 45–46): teal fill, ivory label, 999px radius, 14px type. That contradicts D-18 (gold fill, teal label) and D-20 (44px). Do not copy. |
| `components/ui/link.tsx` | component | request-response | Links in the 404 are `<a class="nav-link">` (line 37): 12px, `letter-spacing: 0.12em`, no gold hover. Contract is teal, no underline, gold hover, teal focus ring. |
| `components/ui/field.tsx` | component | request-response | No input component. Framer forms are inside HTML strings. Placeholder-as-label is what D-28 forbids. There is no eye control to copy. |
| `components/ui/select.tsx` | component | request-response | No listbox. Radix is not installed (`package.json` lines 11–15). |
| `components/ui/checkbox.tsx` | component | request-response | No custom checkbox. |
| `components/ui/radio.tsx` | component | request-response | No custom radio. |
| `components/ui/switch.tsx` | component | request-response | No switch. |
| `components/ui/dialog.tsx` | component | request-response | No dialog, no focus trap. Do not hand-roll one. RESEARCH requires `radix-ui` Dialog / FocusScope. Package is not installed. |
| `components/ui/toast.tsx` | component | request-response | No toast. Custom `role="status"` is specified because D-21 does not authorize Radix Toast. No timer code exists. |
| `components/ui/calendar.tsx` | component | request-response | No calendar. `@internationalized/date` is not installed. Do not mount a React Aria calendar UI. |
| `components/ui/stepper.tsx` | component | request-response | No stepper. D-86 circles are not the 404 pill. |
| `components/ui/chip.tsx` | component | request-response | No status chip. Do not use gold as chip text (1.80:1). |
| `components/ui/skip-link.tsx` | component | request-response | No skip link. UI-SPEC requires `Skip to content` as the first focusable on `/design`, the 404, and the server error. |
| `components/icons/*.tsx` | component | transform | `brand/Icons/` is JPG + `Icons.ai`. Logo SVGs are wordmarks, not the icon set, and their fill is `rgb(38,38,38)` (`Poly_Black.svg` line 7), not `currentColor`. |
| `components/specimens/stay-row.tsx` | component | transform | No stay-row component. Stay pages are Framer HTML strings (`app/private-stays/*/route.ts`). Do not parse those strings into React. |
| `components/specimens/add-on.tsx` | component | transform | No add-on card. |
| `components/specimens/price.tsx` | component | transform | No price block. Fixture math is in UI-SPEC, not in code. |
| `components/specimens/hero-booker.tsx` | component | transform | No booker. Homepage hero is Framer HTML in `app/route.ts` line 15. Do not extract it into JSX. |

## Metadata

**Analog search scope:** `app/**/route.ts`, `package.json`, `next.config.js`, `tsconfig.json`, `scripts/assemble-cloudflare.mjs`, `brand/Font/questa-webfont/style.css`, `brand/Logo Typography/Poly_Black.svg`, `brand/Logo Monogram/Curves_black.svg`, `brand/Icons/`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/STRUCTURE.md`
**Files scanned:** 27 `route.ts` handlers, 3 config files, 1 deploy script, brand font CSS, 2 logo SVGs, icon directory listing. No `page.tsx`, `layout.tsx`, `error.tsx`, `globals.css`, `components/`, `lib/`, `postcss.config.*`, or `*.test.*` / `*.spec.*` exists.
**Pattern extraction date:** 2026-09-23

**Planner constraints verified in this repo:**

- Do not edit Framer `app/**/route.ts` HTML. The only route-handler delete is `app/[...not_found]/route.ts`, after the new 404 is proven and `/contact` still serves Framer HTML.
- Deleting that catch-all also requires a change to `scripts/assemble-cloudflare.mjs` lines 45–50. The script regex-extracts `const HTML = \`...\`` from that file and writes `out/404.html`.
- Do not add `app/page.tsx`.
- Do not add shadcn, a JS Tailwind config, dark mode, or path aliases.
- Warning hex for new tokens is UI-SPEC `#8a3b12`, not RESEARCH `#8a5a12`.
