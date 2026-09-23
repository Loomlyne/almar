# Walking Skeleton — ALMAR Private Journeys

**Phase:** 1
**Generated:** 2026-09-23

## Capability Proven End-to-End

A person runs `npm run dev`, opens `/design`, uses the password show/hide eye on the inline-end, and switches an Arabic preview that sets `dir=rtl` on the html element.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14.2.35 App Router, React 18.3.1, TypeScript strict | Already pinned. Do not upgrade. Do not add `app/page.tsx`. `/` stays `app/route.ts` until Phase 6. |
| Styling | Tailwind CSS 4.3.3 `@theme` via `@tailwindcss/postcss`. No `tailwind.config.js`. Default breakpoints only. | D-06, D-07. Light only. No dark class. |
| Data layer | Deferred. No database read or write in this phase. | Owner-gated Supabase is Phase 2 (PLAT-01). This phase must not invent a Supabase project to satisfy a generic skeleton checklist. Fixture copy only. Specimens do not submit, charge, or call Stripe. |
| Auth | `/design` calls `notFound()` when `NODE_ENV === "production"`. No password, cookie, or shared secret in the repo. | D-35. Owner auth is Phase 2. This is a deploy guard, not a login. |
| Deployment target | Documented local command `npm run dev`. Not a Cloudflare Worker, Pages, or DNS change. | Cloudflare create/DNS is owner-gated. Do not run `wrangler deploy`, `npm run host:cloudflare`, or `vercel deploy`. |
| Directory layout | `app/layout.tsx`, `app/globals.css`, `app/design/page.tsx`, `app/not-found.tsx`, `app/error.tsx`, `components/ui/`, `components/icons/`, `components/specimens/`, `lib/`. Relative imports. No path alias. | RESEARCH structure. Root layout owns html, fonts, and tokens only. It does not render nav or footer. |
| Components | Custom visuals. `radix-ui` only for Dialog, Select/listbox, and FocusScope. Not shadcn. | D-21. |
| Fonts | Questa and Lato via `next/font/local` from `brand/Font`. Noto Naskh Arabic and Noto Sans Arabic via `next/font/google` only while the Arabic preview is on. | D-09, D-17, D-36. Do not download a Questa Bold. Do not ship Bricolage. |
| Icons | Traced SVG components, `currentColor`. Logo SVGs stay files with their hardcoded fill. | DSGN-05. Do not ship `brand/Icons/*.jpg` as the components. |
| Contact | `inquiries@almarprivatejourney.com` and `+971 56 388 3302` | Do not use the brand-book footer contact. |

## Stack Touched in Phase 1

- [x] Project scaffold — Next.js already present. Plans add Tailwind v4, PostCSS, `radix-ui`, `@internationalized/date`, Playwright, and `node --test`. Do not add Jest, Vitest, or shadcn.
- [x] Routing — `/design` (dev kit) and `app/not-found.tsx` (unknown paths). Do not add `app/page.tsx`.
- [ ] Database — **deferred to Phase 2.** No real read and no real write. Reason: Supabase is owner-gated and out of this phase. Do not create a project, table, or client to tick this box.
- [x] UI — one interactive control wired in the page: the password show/hide eye on inline-end. The Arabic preview sets `dir` and `lang` on the html element. There is no API behind either control.
- [x] Deployment — documented local full-stack stand-in: `npm run dev`, then open `http://127.0.0.1:3000/design`. Not a live Cloudflare publish.

## Out of Scope (Deferred to Later Slices)

- Supabase project, schema, auth, and RLS (Phase 2)
- Stripe, Payment Element, Resend, and any charge or email send
- Cloudflare Worker/Pages create, DNS, and `wrangler deploy`
- Settings → Brand publish (DSGN-04, Phase 5)
- Replacing Framer `app/**/route.ts` marketing pages (Phase 6). The only route-handler delete is `app/[...not_found]/route.ts`, after the new 404 is proven and `/contact` still serves Framer HTML
- `app/page.tsx`, dark mode, shadcn, `next-intl`, a custom breakpoint, a password on `/design`
- Booking routes, including `/booking/trip`

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without renegotiating framework, token names, the production `/design` gate (until Phase 2 auth replaces it), or the local-only deploy line:

- Phase 2: Guest and owner can authenticate; public and ops are isolated; language and currency persist on the same URLs
- Phase 3: Ops can publish real stays with rates; overlapping nights cannot be booked
- Phase 4: A guest can complete a real one-destination trip and pay a TEST Stripe deposit or full amount
- Phase 5: Owner can run the booking and the brand from `/ops`
- Phase 6: Public pages are React on the same URLs; remaining CMS replaces the Framer brochure
