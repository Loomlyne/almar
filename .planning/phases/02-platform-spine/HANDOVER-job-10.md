# Hand-over: job 10, the server runtime on Worker `almar` (plans 02-20, 02-21, 02-22)

Work session "ALMAR job 10: server runtime (OpenNext)", Opus 5.5 lead, 2026-10-04. Plans signed by the owner
2026-10-04 (question form, "Signed, go"; then his message "Plans 02-20 to 02-22 signed … merge it first. Build in
your worktree, no deploy, no secret, then hand over").

## Branch

- `gsd/phase-02-server-runtime`, worktree `.claude/worktrees/phase-02-server-runtime`.
- Cut from `origin/gsd/phase-3.3-slice-1` at `0f33130`; merged slice 1 at `6264c59` (with plan 08) and `origin/main`
  at `28bc1fb` (planning notes). Slice 1 is **not** on `main` yet: this branch carries slice 1's commits. Land slice 1
  first (the landing order in `decisions/2026-10-04-slices-reconcile.md`), then merge `origin/main` here again; this
  branch's own diff over slice 1 is `git diff 6264c59...HEAD`.
- Code checked at: `350a7b6` (the last code commit). The commit after it holds planning files only (this file and the
  summaries). Folder clean.

## What it does

Static first, server on a short list. Every page is still the same static file; Cloudflare runs the Worker only for
`/api/*`; the Worker forwards to Next only the exact paths in the generated list (every static `app/api` route,
today `/api/health`); everything else is today's branded 404. Details: `02-RUNTIME-CONTEXT.md`. How a slice adds an
endpoint: the header of `lib/server-routes.ts`.

## Checks

Two runs, both from the plan's full check set. The first ran on `d958b93`. The second ran on `350a7b6`, which differs
from it only in `lib/server-routes.ts` and its node test (the `/api` follow-up). That file is read by the assembler
and the Worker, not by any page, so the dev-config suite from the first run still holds for the pages.

| Check | `d958b93` (17:51–18:17) | `350a7b6` (18:18–18:57) |
|---|---|---|
| `npm ci` | exit 0 | (same lockfile, not rerun) |
| `npx tsc --noEmit` | pass | pass |
| `node --test tests/*.test.mjs` | 588: 584 pass, 0 fail, 4 skipped | 589: 585 pass, 0 fail, 4 skipped |
| `npm run tokens:check` | up to date | up to date |
| `npm run build` | exit 0 | (not rerun; the assembler runs it) |
| `npx playwright test --workers=1` (dev config, port 3047) | **1,859 passed, 28 skipped, 0 failed** (24.0 min) | not rerun (no page reads the changed file) |
| `node scripts/assemble-cloudflare.mjs` | 57 HTML, `server paths: /api/health` | same |
| `npx playwright test -c playwright.build.config.ts --workers=1` (production config) | **did not start**: `wrangler dev` could not bind a port ("Address already in use") on this shared Mac; no test ran | **1,394 passed, 0 failed** (port 8796, 36.7 min) |
| `--target=preview` assemble + `server-runtime.spec.ts` on `wrangler.preview.toml` | 10 passed | 10 passed |
| `server-runtime.spec.ts` on `wrangler.toml` | 10 passed (`5fba550`, port 8793) | inside the 1,394 |

The skipped node tests are the same 4 as before this job (a Framer pin already proven, the media checks that need
`MEDIA_CHECK_OUT=1` or `media-staging/`).

## Same bytes (02-20)

Against a before-build of the merged base: 56 of 57 HTML files byte-identical, 1 differs only in the order of its
streamed React data chunks (two builds of the same commit vary the same way); every non-HTML file identical except
the route manifest and 18 per-route chunks that each gain exactly one chunk id (the new route's), plus that route's
own chunk. Worker: 10,123 KiB raw / 1,627 KiB gzip (Free plan cap 3,072 KiB).

## Security review (fresh Opus, two passes)

| # | Finding | Outcome |
|---|---|---|
| 1 | MEDIUM: the generated routes file on disk held `/newsletter` (my bite-check leftover) and nothing re-checked it at deploy | Fixed `5fba550`: the Worker refuses to start on a held or disallowed path (proven on `wrangler dev`); runbook checks the file and a clean tree before each deploy; file rebuilt |
| 2 | MEDIUM: every asset miss ran the Worker (Free plan 100k requests a day) | Fixed: `run_worker_first = ["/api/*"]`; other misses never run it |
| 3 | LOW: a browser navigation to `/api/health` got the static 404 | Fixed by the same line; spec test 4 fails without it, passes with it |
| 4 | LOW: visitor-sent `x-forwarded-host` / `x-forwarded-for` reach Next | Fixed: dropped / replaced by `cf-connecting-ip` |
| 5 | LOW: `/newsletter` handler has no Origin check, no rate limit, returns the Resend contact id | Not reachable (held three ways). **Slice 3 plan 27 must fix before switching it on** (proposed below) |
| 6 | LOW: `public/` files under `/api` or held paths would be served | Fixed: the assembler refuses them |
| 7-12 | INFO: no header steers a forwarded request to another route; every path form fails safe; assets unchanged; robots header correct; no secret in any bundle; config fine | — |
| re-check | All closed. Follow-ups: reject `/api` itself at build time (done, `350a7b6`); prove two POSTs in a row keep their bodies once an endpoint reads a body (proposed for slice 3 plan 26) | |
| gap | `NEXT_PUBLIC_*` values set in the build shell are inlined into the browser bundle without passing the `.env` guard | For Phase 2 (proposed below) |

## Not verified

- Anything on Cloudflare itself: real CPU per request on the Free plan, the daily request quota, the custom domains
  running the Worker script, secrets reaching `process.env` on a deployed Worker. The runbook measures these.
- A request body surviving OpenNext's `Request` subclass on the second request (no route reads a body yet).
- The Mac's live site: no live request was made (no deploy).

## Migrations, environment

- Migrations: none.
- Environment names added: none set. Named for the owner's steps below: `RESEND_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Proposed changes for the controller

1. Board and STATE: "02-08 (server runtime, job 10: plans 02-20, 02-21, 02-22) landed …" in those words, so slice 3
   plan 27's precondition (d) finds it.
2. Slice 3 plan 26 (`/api/contact`): no code change needed (every `app/api` route is served). Add to its Task 3: two
   POSTs in a row to `/api/contact` under the build runner, each answered from its own body (review follow-up).
3. Slice 3 plan 27 (`/newsletter`), amendment: add `"/newsletter"` to `SERVER_PATHS_OUTSIDE_API`, remove it from
   `HELD_PATHS` (`lib/server-routes.ts`), add it to `run_worker_first` in both Worker files, and flip its entries in
   `tests/build/server-runtime.spec.ts` (pinned list, probes). Before that, harden the handler: Origin check, rate
   limiting, no contact id in the response.
4. Job 02 (Phase 2 auth, `claude/project-thread-8h6bed`): drop `f10f765`'s `wrangler.server.jsonc`, `host:server`,
   `preview:server` and its three gate tests. Sign-in paths go through `SERVER_PATHS_OUTSIDE_API` and
   `run_worker_first`; middleware runs only for those. Never put a value in a `.env` file (the assembler refuses it)
   or in the build shell as `NEXT_PUBLIC_*` without a review of what the browser bundle then holds.
5. CONTROL-BOARD line about `npm run host:cloudflare`: fixed (the script is gone). Stale mentions to update:
   `.planning/codebase/ARCHITECTURE.md` lines 16, 101, 158, 224; `CONCERNS.md` 132, 193; `INTEGRATIONS.md` 95;
   `STACK.md` 48, 102; `HERMES.md` lines naming `host:cloudflare`.
6. Deploy: `02-RUNTIME-DEPLOY.md`, preview first and production second, each on his word.

## The owner's steps (after the controller's deploy of each Worker)

Run each in your own terminal from the main ALMAR folder; paste the value only at wrangler's prompt. Expected each
time: `Success! Uploaded secret <NAME>`.

1. `RESEND_API_KEY`:
   `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler secret put RESEND_API_KEY --config wrangler.preview.toml`,
   then the same with `--config wrangler.toml`.
2. `SUPABASE_SERVICE_ROLE_KEY`: the same two commands with that name.
3. `NEXT_PUBLIC_SUPABASE_URL`: the same two commands with that name (server code only; browser use is Phase 2's build decision).
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the same two commands with that name (same note).
5. Open https://almarprivatejourney.com/api/health — expected `{"ok":true}`.
6. Open https://almarprivatejourney.com/dashboard — expected the branded "Page not found".
7. Open https://almarprivatejourney.com/ar/ — expected the Arabic home, right to left, unchanged.

## Lessons

- A mutation (bite) check must be reverted **and rebuilt** before anything reads the build output: the security
  review found my leftover list. The Worker now refuses such a list on its own.
- Cloudflare answers navigation misses from the assets layer unless `run_worker_first` names the path; a request-API
  test without `Sec-Fetch-Mode: navigate` cannot see it.
