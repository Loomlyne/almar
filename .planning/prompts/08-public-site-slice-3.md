# Job 08 — Phase 3.3 slice 3: about, contact and newsletter

Read `00-common-rules.md` first, then `06-public-site-slice-1.md`: slice 1 set the pattern every later slice
inherits (one data layer, no fake controls, the dashboard's component library, per-locale URLs). You are a
work session, not the controller.

**Branch:** `gsd/phase-3.3-slice-3`, cut from `origin/gsd/phase-3.3-slice-1`. Your first command, inside the
worktree the app made for this session: `git fetch origin && git switch -c gsd/phase-3.3-slice-3 origin/gsd/phase-3.3-slice-1`
**Model:** Opus 5.5, effort High, lead. Executors later are Sonnet 5.5 High; none run in this job.
**Mode: design and plans only.** No application code until slice 1 has landed on `main` and the owner says go.
Slice 1 is still being finished (plan 08) by the controller while you work; read it, do not edit it.

## Scope

| Page | Today |
|---|---|
| `/about` | Framer `app/about/route.ts` |
| `/contact` | Framer `app/contact/route.ts` |
| `/newsletter` | `app/newsletter/route.ts`, `force-dynamic`, so it answers 404 live (no server runtime) |

Each in EN, AR and ES (`/ar/…`, `/es/…`). Out of scope: home, private stays (slice 1), destinations,
experiences, services (slice 2, job 07), blog (slice 4, job 09), the legal pages (Phase 6).

## Facts that bind this slice

- Contact stays `inquiries@almarprivatejourney.com` and `+971 56 388 3302`, exactly (ROADMAP 3.3 SC4).
- No invented people. The three Framer team members are fake and stay gone; public Team shows only members
  published from Dashboard → Content → Team, which is not built yet (`decisions/2026-09-28-design-audit.md`).
- Worker `almar` is static assets only: no `main`, no middleware, no server code. A form that posts
  anywhere cannot work today, and Resend has nothing live. So the contact form and the newsletter signup are
  either real end to end or not rendered (job 06 design §4.3 already holds the footer newsletter). The live
  Framer home carries a newsletter email form whose destination is unknown (`CONTROL-BOARD.md`, "Known, not
  fixed"). Put the choice to the owner with the options you verified (for example: hold both until the
  server-runtime job; or contact by email, phone and WhatsApp links only). Do not design around a backend
  that does not exist.
- The live footer Contact link goes to `/legal/privacy-policy` on a plain click; the React `/contact` fixes it.
- You own the newsletter question for every slice: slice 4's post page (D-68) has a newsletter block and
  defers to your answer.

## What the design must cover

Same shape as `.planning/phases/03.3-public-site-in-react/03.3-01-DESIGN.md` (signed 2026-10-02), written to
`.planning/phases/03.3-public-site-in-react/03.3-S3-DESIGN.md`:
1. Board mapping: which canvas boards (`.planning/design/2026-10-01-canvas/`, the live canvas
   https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw) cover each page and section, and where none does.
2. Component inventory against `components/ui`, `components/journey`, `components/pages` as merged in
   slice 1. A missing primitive is proposed for `components/ui/`, never a page one-off.
3. The data: what the about page reads (team: the slice 1 `lib/data` team module, empty until the CMS
   publishes someone; what the page shows when it is empty), fixtures with the real published text in three
   languages, Supabase-shaped types (Phase 3.2 SC5). No invented text, legal text included.
4. Every control and how it works with no backend, and every held one with its reason and the phase that
   brings it back.
5. Images: every new image goes through plan 07's media pipeline (`scripts/media-*.mjs`, the manifest) to
   R2 `almar-media`. The upload is the owner's gate, run by the controller: one numbered step in your plan.
6. Questions for the owner, one decision each.

## Your two stops

1. **Design signature.** Commit the design on your branch, push the branch, then ask him in this chat
   through the question form, one decision per question, recommended option first. Stop until he signs.
2. **Plan signature.** After he signs the design: GSD plans in the phase folder, numbered `03.3-20` to
   `03.3-29` (slice 2 owns 10–19, slice 4 owns 30–39), checked by an Opus plan checker. Each plan lists in
   `shared_files:` every shared file it touches (`lib/copy/*`, `lib/data/types.ts`, `components/ui/*`,
   `tokens.json`, `scripts/assemble-cloudflare.mjs`, tests shared with slice 1) so the controller can order
   slices 2–4. Push, ask him to sign the plans, stop.

You do not send messages to the controller (messages to other sessions are held for his approval and have
expired before). Tell the owner in one line the commit and the file; he brings it to the controller.
Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `decisions/` or `prompts/`: put proposed
changes in your design or plan summary.
