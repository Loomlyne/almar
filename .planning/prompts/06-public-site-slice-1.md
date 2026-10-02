# Job 06 — Phase 3.3 slice 1: the data layer, home, and the private stays

Read `00-common-rules.md` first. You are a work session, not the controller.

**Branch:** `gsd/phase-3.3-slice-1` · **Worktree:** `.claude/worktrees/phase-3.3-slice-1`, from `origin/main`
**Model:** Opus 5.5 lead (the data contract outlives this job), Sonnet 5.5 executors
**Phase:** 3.3 — Public site in React. Read its block in `ROADMAP.md`; success criteria 1–6 are the contract.

## Why this phase runs now

The owner's answers of 2026-10-02 13:30–13:35 (`decisions/2026-10-02-cleanup.md`): the frontend is finished
before the backend is connected. Phase 3.1 is 29 plans deep and no visitor-facing page uses it — the 26 live
pages are still the Framer export. This phase needs no database, no auth and nothing owner-gated.

## The two rules that define this job

**1. One data layer.** Every read goes through `lib/data/<entity>.ts`:

```ts
// lib/data/stays.ts
export async function getStays(): Promise<Stay[]>        // reads lib/data/fixtures/stays.json today
export async function getStay(slug: string): Promise<Stay | null>
```

Async, returning the shape Supabase will actually return — snake_case columns, nullable where the column is
nullable, ids and timestamps present. Types in `lib/data/types.ts`, kept compatible with Supabase generated
types. **No component imports a fixture.** Phase 3.2 later edits only these modules; if a component has to
change to make that swap, this job failed. Fixtures carry the real published content lifted from the Framer
pages, including the three home prices the owner accepted on 2026-10-02 — never invent a price or a person.

**2. No fake controls.** Every control rendered works end to end. Filters, search, the stay overlay, language,
currency, the journey bar's Where → When → Who — all of them work against the data layer. The journey bar's
final submit is **not rendered** until Phase 4; do not render a disabled or placeholder one. No invented
team members (`decisions/2026-09-28-design-audit.md`). The Mariven sentence that job 05 deletes must not
reappear in a fixture.

## Three languages: per-locale URLs, decided before you start

The owner decided on 2026-10-02: **EN / AR / ES are baked as per-locale URLs at build time** —
`/about`, `/ar/about`, `/es/about`. Not the client cookie switch that exists today. Verified reasons: no
`app/` page calls `cookies()`, `almar-locale` is read in 10 client components and written in
`app/account/account-screen.tsx:25`, and every live page serves `<html lang="en" dir="ltr">` — so AR and ES
do not exist in served HTML, Arabic would paint LTR before flipping, and job 04's "Arabic" screenshots were
byte-identical English pages for exactly this reason.

**Slice 1 establishes the pattern and every later slice inherits it, so get it right once:**

1. Route shape: an `app/[locale]/…` segment with `generateStaticParams` over `en`, `ar`, `es`, or three built
   trees. English stays at the root (`/about`) so today's live URLs and their SEO do not move; AR and ES are
   prefixed. Emit `hreflang` for all three. `<html lang>` and `dir` are set from the segment, server-side.
2. The switcher changes URL. The `almar-locale` cookie becomes a remembered preference that can redirect a
   first visit, never the source of truth. Say in the hand-over whether the dashboard's own cookie reads stay
   as they are — they are a different surface and are not in this slice.
3. `scripts/assemble-cloudflare.mjs` harvests `.html` from `.next/server/app` and writes `out/<rel>.html`
   (line 39-40). It must emit nested locale paths and create those directories. 26 pages become 78.
4. `wrangler.toml` has `html_handling = "auto-trailing-slash"` and `not_found_handling = "404-page"`. Check
   both behave for `/ar/about` and `/ar/`. Do not edit `wrangler.toml` — report if it must change.
5. The branded 404 comes from `renderStaticNotFound()` in `lib/not-found-document.ts`, hardcoded
   `<html lang="en" dir="ltr">`, and `tests/assemble-404.test.mjs` guards the single one. There are now three
   404s to consider. Propose, do not silently change the guard.
6. `tests/no-dead-links.test.mjs` resolves every `<a href>` against the routes in `app/`, and its `HIDDEN` and
   52 `KNOWN_DEAD` entries are path literals. Locale-prefixed hrefs will read as dead links until its
   resolver learns the prefixes.
7. Currency needs rethinking against URL-based locale. Do not invent the rule — put it to the owner as one
   question with a recommendation, through the controller.

## Scope — this slice only

- `lib/data/` : types, the modules for stays, destinations, experiences and services, team, and the fixtures.
- `/` home, including the hero journey bar (Where → When → Who working, submit held).
- `/private-stays` list, with its filters and search working.
- The 12 `/private-stays/*` detail pages, with the pre-filled booking bar; blocked dates come from the
  fixture per stay (D-62, D-63 in `03.1-CONTEXT.md`).
- All of the above in three locales: 14 pages become 42 built documents in this slice.

Out of scope: destinations, experiences, about, contact, services, blog. Later slices. Do not start them.

## Design is signed before code

Per `00-common-rules.md`: put the design to the owner first — the canvas boards that cover these pages, or
screenshots at 390, 834 and 1440 in EN and AR. One question, recommended option first. The Framer look on 3.1
tokens is the reference; square corners, gold is a line only, no radio controls, EN/AR/ES in the same pass
with real RTL. Wait for his signature, then build.

## Preview host — write the config, do not deploy

Verified 2026-10-02 13:25: preview URLs are off on Worker `almar` (`workers_dev = false` from job 04), so the
owner's review URL is a **separate** Worker. Write `wrangler.preview.toml` in this job: name `almar-preview`,
the same `[assets]` block as `wrangler.toml`, `account_id = "f1d9a1fa3abdda98c15161b00b40385c"`, one custom
domain route `preview.almarprivatejourney.com`. Ship a preview-only `noindex` header and a `robots.txt`
disallow with it. **You do not run wrangler.** Creating the Worker and its hostname is the owner's gate — one
numbered step at your hand-over, the controller runs it. Do not touch `wrangler.toml` itself.

## Two standing cautions

- **Every guard is a browser assertion, not a file-text one.** Job 04's footer fix passed its node tests and
  was still a fake control, because Framer's client router overrode the server `href` at click time. It cost
  the owner that job twice. Click the control, assert the result.
- **Questions go through the controller, not straight to the owner.** Two sessions asking him in two chats is
  what caused today's duplicate work. Send the question to the controller with your recommendation.

## Hand-over

Full check set from `00-common-rules.md` on the final commit, plus:
- proof that no component imports a fixture (grep in the hand-over),
- proof that every rendered control works, listing each one and how it was exercised,
- the pages checked at 390, 834 and 1440 in EN, AR and ES,
- the one numbered Cloudflare step for the preview Worker.

`HANDOVER.md` in the phase folder. Push your branch, message the controller, one line to the owner, stop.
