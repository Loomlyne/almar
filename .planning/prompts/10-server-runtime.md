# Job 10 — the server runtime on Worker `almar` (Phase 2 plan 02-08, OpenNext)

Read `00-common-rules.md` first. You are a work session, not the controller.

**Branch:** `gsd/phase-02-server-runtime`, cut from `origin/gsd/phase-3.3-slice-1` (slice 1 rewrote the
assembler and the preview config; it lands on `main` before you hand over, and you merge `origin/main` then).
Your first command, inside the worktree the app made for this session:
`git fetch origin && git switch -c gsd/phase-02-server-runtime origin/gsd/phase-3.3-slice-1`
**Model:** Opus 5.5, effort High, lead (it opens a server surface: security rule). Executors Sonnet 5.5.
**Why now (owner, 2026-10-04):** slice 3's contact form and newsletter (plans 03.3-26, 27, 29) need code that
runs on the server, and Phase 2's sign-in needs it after them. He chose "full server job now": OpenNext on
Worker `almar`. Do not re-open that choice; if you measure a blocker, put it to him as one question.

## Today, measured

- Worker `almar` (account `f1d9a1fa3abdda98c15161b00b40385c`) is static assets only: `wrangler.toml` has
  `[assets] directory = "./out"`, `html_handling = "auto-trailing-slash"`, `not_found_handling = "404-page"`,
  no `main`, `workers_dev = false`, custom domains apex and `www`. Live version `f9ba2378` (job 05).
- `scripts/assemble-cloudflare.mjs --target=local|preview|production` (slice 1 plan 08) builds `out/`
  (production) or `out-preview/` (Worker `almar-preview`, `wrangler.preview.toml`, not created yet): the 42
  React documents in three locales with `lang`/`dir` in the served bytes, the 12 Framer pages harvested from
  `route.ts` bodies, three locale 404s (`out/404.html`, `out/ar/404.html`, `out/es/404.html`), `_headers`
  (immutable caching), `robots.txt` / `sitemap.xml` per target with the preview `noindex` kept off production,
  and the media guard (`scripts/media-guard.mjs --deploy`).
- Answering **404 live today, and they must stay 404** until their own phase ships: `/dashboard`, `/account`,
  `/login`, `/booking/*`, `/bookings`, `/fx`, `/newsletter`, `/embed/*`, `/__harness`. Today they are absent
  because the assembler never copies them. **Under OpenNext every route in `app/` can answer.** Turning the
  runtime on must not publish a dashboard, an account page or a sign-in screen that has no auth behind it.
- Inputs, not to be cherry-picked blindly: `.planning/phases/02-platform-spine/02-08-PLAN.md` (written before
  Phase 3.3), and the cloud branch `origin/claude/project-thread-8h6bed` commit `f10f765` ("server runtime
  config for Worker almar, build only": `wrangler.server.jsonc`, `open-next.config.ts`, a guard test).
  `@opennextjs/cloudflare` 1.20.6 and Next 15.5.26 are installed.

## What this job delivers

1. Worker `almar` (and `almar-preview`) built with OpenNext so server code can run, **with every public page
   still served as a static asset first**: same bytes, same `lang`/`dir`, the three locale 404s, the canonical
   slash rules (`/ar/` for a locale home, no slash for a page), `_headers` caching, crawl files per target, the
   media guard, no `noindex` on production. Prove each against today's `out/` on local `wrangler dev`.
2. The routes in the 404 list above stay 404 on both hosts, proven by a test on the built Worker.
3. One way for a slice to add a server endpoint (for example `app/api/contact/route.ts`), documented and
   proven with a local `wrangler dev` request, and no visitor-facing control added by this job. The contact
   route itself is slice 3's plan 26; you do not build it.
4. Secrets and bindings named, never valued: the Resend key and the Supabase names are the owner's, set from
   his terminal at hand-over (one numbered step each). Nothing in a file.
5. The deploy path the controller will run on his word: the exact commands with the ALMAR login
   (`HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c
   ./node_modules/.bin/wrangler`), preview first, then production, with the rollback target (`f9ba2378` or the
   version live at that moment) and the live checks after. `npm run host:cloudflare` (bare `wrangler deploy`,
   the Vamos login) is never used; propose its fix.

`wrangler.toml` is a gated shared file: this job may edit it (the controller grants the slot), but you never
run `wrangler deploy`, never create a Worker, a route or a secret, and never touch DNS or R2.

## Your stops

1. **Discuss**: only questions he alone can answer, through the question form, one decision each,
   recommended option first.
2. **Plan signature**: GSD plans in `.planning/phases/02-platform-spine/`, numbered after the existing ones
   (start at `02-20`; say if that collides), checked by an Opus plan checker, a one-page summary for him.
   Push your branch, ask him to sign, stop.
3. After he signs and says go: build, the full check set from `00-common-rules.md`, a fresh Opus security
   review of the diff, then `HANDOVER.md` in the phase folder with the numbered owner steps. Push your
   branch, tell the owner in one line, stop.

You do not send messages to the controller (messages to other sessions are held for his approval and have
expired before). Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `decisions/` or
`prompts/`. Read `decisions/2026-10-04-slices-reconcile.md` for where this job sits in the landing order.
