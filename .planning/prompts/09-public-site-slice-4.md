# Job 09 — Phase 3.3 slice 4: the blog and its three posts

Read `00-common-rules.md` first, then `06-public-site-slice-1.md`: slice 1 set the pattern every later slice
inherits (one data layer, no fake controls, the dashboard's component library, per-locale URLs). You are a
work session, not the controller.

**Branch:** `gsd/phase-3.3-slice-4`, cut from `origin/gsd/phase-3.3-slice-1`. Your first command, inside the
worktree the app made for this session: `git fetch origin && git switch -c gsd/phase-3.3-slice-4 origin/gsd/phase-3.3-slice-1`
**Model:** Opus 5.5, effort Medium, lead. Executors later are Sonnet 5.5; none run in this job.
**Mode: design and plans only.** No application code until slice 1 has landed on `main` and the owner says go.
Slice 1 is still being finished (plan 08) by the controller while you work; read it, do not edit it.

## Scope

| Page | Today |
|---|---|
| `/blog` | Framer `app/blog/route.ts` |
| `/blog/colombias-coffee-triangle-eje-cafetero` | Framer `route.ts` |
| `/blog/discovering-cartagenas-hidden-colonial-courtyards` | Framer `route.ts` |
| `/blog/why-medellin-is-redefining-luxury-travel` | Framer `route.ts` |

Each in EN, AR and ES (`/ar/…`, `/es/…`). Out of scope: home, private stays (slice 1), destinations,
experiences, services (slice 2, job 07), about, contact, newsletter (slice 3, job 08).

## Already decided — do not re-ask

D-68 (`03.1-CONTEXT.md`, owner 2026-09-29): the post page carries reading time, a destination tag, an
on-this-page list, featured stay and experience cards, share, a plan-this-journey bar pre-filled with the
destination, related posts and a newsletter block. **No invented author or people.**

Held, not rendered, until each is real (job 06 design §4.3): the cart and every **Add** control on the
featured cards (D-65, D-66), Login, checkout. The newsletter block follows slice 3's answer (job 08 owns the
newsletter question for every slice): until that answer exists, design it as held. The plan-this-journey bar
is the slice 1 journey bar: its final submit stays unrendered until Phase 4.

## Questions only he can answer

- The three posts exist in English only. Arabic and Spanish bodies are content, not code: who writes them,
  and does anything ship before they exist? Recommend one option; never machine-translate and present it as
  his text without his word.
- Images with text need three versions (EN, AR, ES); other images keep one file and three alt texts.

## What the design must cover

Same shape as `.planning/phases/03.3-public-site-in-react/03.3-01-DESIGN.md` (signed 2026-10-02), written to
`.planning/phases/03.3-public-site-in-react/03.3-S4-DESIGN.md`:
1. Board mapping: which canvas boards (`.planning/design/2026-10-01-canvas/`, the live canvas
   https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw) cover the blog list and the post page, and where none does.
2. Component inventory against `components/ui`, `components/journey`, `components/pages` as merged in
   slice 1. A missing primitive is proposed for `components/ui/`, never a page one-off.
3. The data: a `lib/data/posts.ts` module, async and Supabase-shaped like the slice 1 modules (Phase 3.2
   SC5), fixtures carrying the real published post text, how a post links its destination, stay and
   experiences through the slice 1 modules, and how reading time is computed (not typed by hand).
4. Every control and how it works with no backend (share, on-this-page, related posts, language), and
   every held one with its reason and the phase that brings it back.
5. Images: every new image goes through plan 07's media pipeline (`scripts/media-*.mjs`, the manifest) to
   R2 `almar-media`. The upload is the owner's gate, run by the controller: one numbered step in your plan.
6. Questions for the owner, one decision each.

## Your two stops

1. **Design signature.** Commit the design on your branch, push the branch, then ask him in this chat
   through the question form, one decision per question, recommended option first. Stop until he signs.
2. **Plan signature.** After he signs the design: GSD plans in the phase folder, numbered `03.3-30` to
   `03.3-39` (slice 2 owns 10–19, slice 3 owns 20–29), checked by an Opus plan checker. Each plan lists in
   `shared_files:` every shared file it touches (`lib/copy/*`, `lib/data/types.ts`, `components/ui/*`,
   `tokens.json`, `scripts/assemble-cloudflare.mjs`, tests shared with slice 1) so the controller can order
   slices 2–4. Push, ask him to sign the plans, stop.

You do not send messages to the controller (messages to other sessions are held for his approval and have
expired before). Tell the owner in one line the commit and the file; he brings it to the controller.
Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `decisions/` or `prompts/`: put proposed
changes in your design or plan summary.
