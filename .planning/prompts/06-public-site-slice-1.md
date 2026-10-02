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

## Scope — this slice only

- `lib/data/` : types, the modules for stays, destinations, experiences and services, team, and the fixtures.
- `/` home, including the hero journey bar (Where → When → Who working, submit held).
- `/private-stays` list, with its filters and search working.
- The 12 `/private-stays/*` detail pages, with the pre-filled booking bar; blocked dates come from the
  fixture per stay (D-62, D-63 in `03.1-CONTEXT.md`).

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

## Hand-over

Full check set from `00-common-rules.md` on the final commit, plus:
- proof that no component imports a fixture (grep in the hand-over),
- proof that every rendered control works, listing each one and how it was exercised,
- the pages checked at 390, 834 and 1440 in EN, AR and ES,
- the one numbered Cloudflare step for the preview Worker.

`HANDOVER.md` in the phase folder. Push your branch, message the controller, one line to the owner, stop.
