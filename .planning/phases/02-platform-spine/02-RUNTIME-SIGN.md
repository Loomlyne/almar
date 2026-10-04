# Job 10, server runtime: what you sign (one page)

Branch `gsd/phase-02-server-runtime` (from slice 1 `0f33130`). Plans `02-20`, `02-21`, `02-22` in this folder;
context and measurements in `02-RUNTIME-CONTEXT.md`. Checked by an Opus plan checker; all its findings folded in.

## What changes for a visitor: nothing, plus one address

- Every page stays the same static file: measured, all 57 HTML files byte-identical to today's build.
- New: `https://almarprivatejourney.com/api/health` answers `{"ok":true}` (your answer D-SR-01).
- Still 404, proven by a test on the built Worker for both hosts: `/dashboard`, `/account`, `/login`,
  `/booking/*`, `/bookings`, `/fx`, `/newsletter`, `/embed/*`, `/__harness`.

## How it works

Cloudflare serves a file whenever one matches, without running any code. Only when no file matches does the
Worker run. It hands a request to Next.js only if the address is on a short list. That list is every
`app/api/...` route, plus a named list (empty today). Every other address gets today's branded 404 in EN, AR or ES.

## How a later job adds an endpoint

Slice 3's contact form adds `app/api/contact/route.ts` and nothing else. An address outside `/api` takes one
more line in `lib/server-routes.ts`: the newsletter's `/newsletter` (I propose plan 27 adds it), and later Phase
2's sign-in.

## Plans

| Plan | Does |
|---|---|
| 02-20 | OpenNext config, the Worker entry, the list, `/api/health`; the build script makes the static folder and the server bundle in one run; both Worker files get the script; `npm run host:cloudflare` (deploys with the Vamos login) removed |
| 02-21 | Test on the built Worker, on both Worker files: same bytes, held addresses 404, health, caching, robots; then every check |
| 02-22 | Fresh Opus security review; the deploy runbook; hand-over with your steps |

Shared files it edits: `wrangler.toml`, `wrangler.preview.toml`, `scripts/assemble-cloudflare.mjs`, `package.json`
(scripts only, no package change), `.gitignore`, `README.md`, `playwright.build.config.ts`, and three tests from
slice 1 (changed on purpose, each listed).

## The deploy, later, on your word each time

1. Preview first, on your word.
2. `/api/health` 20 times, with the log open (your answer D-SR-02: Free plan). A processor-limit error stops
   it, preview is rolled back, and you get the upgrade question.
3. Production, on your separate word.
4. Live checks, and a one-command rollback to the version live before the deploy.

Your steps after that: four secrets, set from your terminal, one step per name, on both Workers. The names are
`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## What blocks the build today

Slice 1's plan 08 (preview host files) is not yet on the slice 1 branch or `main`. The build's first task merges it
and stops until it is there. Nothing else waits on you.
