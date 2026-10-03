# Job 07 — Phase 3.3 slice 2: destinations, experiences and services, and the three service pages

Read `00-common-rules.md` first, then `06-public-site-slice-1.md`: slice 1 set the pattern every later slice
inherits (one data layer, no fake controls, the dashboard's component library, per-locale URLs). You are a
work session, not the controller.

**Branch:** `gsd/phase-3.3-slice-2`, cut from `origin/gsd/phase-3.3-slice-1`. Your first command, inside the
worktree the app made for this session: `git fetch origin && git switch -c gsd/phase-3.3-slice-2 origin/gsd/phase-3.3-slice-1`
**Model:** Opus 5.5, effort High, lead. Executors later are Sonnet 5.5 High; none run in this job.
**Mode: design and plans only.** No application code until slice 1 has landed on `main` and the owner says go.
Slice 1 is still being finished (plan 08) by the controller while you work; read it, do not edit it.

## Scope

| Page | Today |
|---|---|
| `/destinations` | Framer `app/destinations/route.ts` |
| `/experiences` | Framer `app/experiences/route.ts` |
| `/services` | Framer `app/services/route.ts` |
| `/services/24-7-private-concierge`, `/services/luxury-ground-transport`, `/services/vip-airport-meet-greet` | Framer `route.ts` each |

Each in EN, AR and ES (`/ar/…`, `/es/…`). Out of scope: home, private stays (slice 1), about, contact,
newsletter (slice 3, job 08), blog (slice 4, job 09). The 7 destination, 38 experience and 7 service card
links that answer 404 today (`tests/no-dead-links.test.mjs`, `KNOWN_DEAD`) are this slice's to resolve.

## Already decided — do not re-ask, but one conflict to put to him

`03.1-CONTEXT.md` D-64 to D-67 (owner, 2026-09-29): services and experiences are **one page**, `/experiences`,
filtered by type, destination and private stay, with a search (D-64); **no experience or service detail page**:
a card opens an overlay with the details and a fixed bottom bar (D-67); `/services` and its detail pages go
away (D-64). The owner's 2026-10-03 brief names "the 3 service pages" in this slice. That is the **first
discuss question**: keep D-64/D-67 and give the four `/services` URLs a permanent redirect (the static Worker
supports a `_redirects` file; check Cloudflare's docs for Workers static assets before you recommend it), or
rebuild the three service pages. One question, recommended option first, the live URLs named.

Held, not rendered, until each is real (job 06 design §4.3): the cart, every **Add** control (D-65, D-66),
Login, checkout. The overlay's bottom bar shows what is real (the price, if a real one exists) and no Add.
Do not ask about the cart or checkout.

## What the design must cover

Same shape as `.planning/phases/03.3-public-site-in-react/03.3-01-DESIGN.md` (signed 2026-10-02), written to
`.planning/phases/03.3-public-site-in-react/03.3-S2-DESIGN.md`:
1. Board mapping: which canvas boards (`.planning/design/2026-10-01-canvas/`, the live canvas
   https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw) cover each page and section, and where none does.
2. Component inventory against `components/ui`, `components/journey`, `components/pages` as merged in
   slice 1. A missing primitive is proposed for `components/ui/`, never a page one-off.
3. The data: `lib/data/destinations.ts`, `experiences.ts`, `services.ts` exist from slice 1 — what they
   return today, what this slice adds, fixtures carrying the real published Framer content in three
   languages, no invented price, rate, person or text. Types stay Supabase-shaped (Phase 3.2 SC5).
4. Every control and how it works with no backend (filters, search, overlay, language, currency), and
   every held one with its reason and the phase that brings it back.
5. Images: every new image goes through plan 07's media pipeline (`scripts/media-*.mjs`, the manifest) to
   R2 `almar-media`. The upload is the owner's gate, run by the controller: one numbered step in your plan.
6. Questions for the owner, one decision each.

## Your two stops

1. **Design signature.** Commit the design on your branch, push the branch, then ask him in this chat
   through the question form, one decision per question, recommended option first. Stop until he signs.
2. **Plan signature.** After he signs the design: GSD plans in the phase folder, numbered `03.3-10` to
   `03.3-19` (slice 3 owns 20–29, slice 4 owns 30–39), checked by an Opus plan checker. Each plan lists in
   `shared_files:` every shared file it touches (`lib/copy/*`, `lib/data/types.ts`, `components/ui/*`,
   `tokens.json`, `scripts/assemble-cloudflare.mjs`, tests shared with slice 1) so the controller can order
   slices 2–4. Push, ask him to sign the plans, stop.

You do not send messages to the controller (messages to other sessions are held for his approval and have
expired before). Tell the owner in one line the commit and the file; he brings it to the controller.
Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `decisions/` or `prompts/`: put proposed
changes in your design or plan summary.
