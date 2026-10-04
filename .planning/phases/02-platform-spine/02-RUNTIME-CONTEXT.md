# Job 10 — server runtime on Worker `almar`: context for plans 02-20, 02-21, 02-22

Written by the job 10 lead (Opus 5.5, work session "ALMAR job 10: server runtime (OpenNext)"), 2026-10-04 14:51 +04,
on branch `gsd/phase-02-server-runtime` cut from `origin/gsd/phase-3.3-slice-1` at `0f33130`. Prompt:
`.planning/prompts/10-server-runtime.md`. Supersedes plan 02-08's Task 2 and the cloud commit `f10f765`
(`wrangler.server.jsonc`, `host:server`), which are not used.

## Owner decisions (question form, 2026-10-04 ~14:50 +04)

| ID | Question | His answer |
|---|---|---|
| D-SR-01 | Should the live site answer `/api/health` with only `{"ok":true}`? | **Yes, add `/api/health`** on both hosts; the controller's live proof after each deploy |
| D-SR-02 | The account is on the Workers Free plan (10 ms processor time per server request). What do we do? | **Stay Free, measure on preview.** The controller deploys preview first and calls `/api/health` 20 times; any CPU-limit error stops the deploy and goes to him as an upgrade question |

Not re-opened: "full server job now, OpenNext on Worker `almar`" (owner, 2026-10-04, in the prompt).

## Measured in this session (throwaway spike, never committed; its source files removed at 14:49, its build output left in the ignored `.next/` and `.open-next/` until the next build replaces them)

| What | Result |
|---|---|
| `opennextjs-cloudflare build -c <a wrangler file whose main is a wrapper, not .open-next/worker.js>` | Builds; runs the project's `next build` in standalone mode itself; writes `.open-next/worker.js`. No complaint about `main` |
| Served HTML from that build vs today's `node scripts/assemble-cloudflare.mjs` | All 57 HTML files and every other `out/` file byte-identical once the build id is replaced; the only differences are the build id and the per-route chunk names that change because a new route (`app/api/health`) was added |
| Worker size (`wrangler deploy --dry-run`) | 9,991 KiB raw, **1,599 KiB gzip**: under the Free plan's 3 MiB compressed limit |
| Worker startup (`wrangler check startup`) | negligible (one sample); OpenNext loads routes lazily |
| Asset hit with a Worker present | served without running the Worker; headers identical to today |
| Asset miss with `not_found_handling = "404-page"` and a Worker present | **the Worker runs**; `env.ASSETS.fetch(request)` returns the nearest branded 404 (`/ar/nope` gets the Arabic one) with today's status, `content-type`, `cache-control` and `ETag` |
| Same probe list (34 requests: pages, slash redirects, the held paths, POST/PUT/HEAD, `_next/image`, `?_rsc=`) on today's static config vs the wrapper | identical on every line except the intended `/api/health` (200 JSON). Today a POST to any path answers 405; it still does |
| `_headers` rules on a response returned through `env.ASSETS.fetch` | applied (a `/*` noindex rule reached a 404 served by the Worker); **not** applied to a response Next produces |
| `process.env` inside a route handler under `wrangler dev` | carries the Worker's variables (so secrets set with `wrangler secret put` reach `process.env.RESEND_API_KEY`) |
| Account plan, read-only `cf accounts subscriptions get` on `f1d9a1fa…` | "R2 Paid" (account) and "Cloudflare Free Plan" (zone). **No Workers Paid** subscription |

## The design

1. `out/` (and `out-preview/`) stays the static-assets folder, built by the same assembler, so every public byte is
   unchanged. `.open-next/` holds the server bundle only; its own `assets/` folder is never served.
2. `wrangler.toml` and `wrangler.preview.toml` gain `main = "worker/almar.mjs"`, an `ASSETS` binding and the
   `nodejs_compat` flags. No `run_worker_first`: a request that matches a file never runs the Worker.
3. `worker/almar.mjs` runs only on an asset miss. It forwards a request to OpenNext **only** when its exact path is
   a server path; every other request goes back to `env.ASSETS.fetch(request)`, which is today's branded 404.
   Deny by default: `/dashboard`, `/account`, `/login`, `/booking/*`, `/bookings`, `/fx`, `/newsletter`,
   `/embed/*`, `/__harness` never reach Next, even though OpenNext compiles them.
4. Server paths = every static `app/api/**/route.ts` (read from Next's `app-paths-manifest.json` at assemble time)
   plus an explicit list in `lib/server-routes.ts` for paths outside `/api` (empty in this job). A page under
   `app/api/`, a dynamic segment under `app/api/`, or a held path in the list stops the assembler.
5. The one way for a slice to add an endpoint: add `app/api/<name>/route.ts` (`dynamic = "force-dynamic"`, no
   `runtime = "edge"`). Nothing else. A path outside `/api` (the newsletter's `/newsletter`, Phase 2's `/login`)
   also needs one line in `lib/server-routes.ts` and leaves the held list there.
6. Server responses carry `x-robots-tag: noindex` (added by the wrapper) and `cache-control` set by the route.
7. Secrets are read from `process.env` on the server only. Named here, never valued: `RESEND_API_KEY` (slice 3
   plans 26, 27, 29), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Phase 2; the two `NEXT_PUBLIC_` names are inlined at build time for browser code, so Phase 2 decides where
   the build reads them). Nothing in a file.

## Contracts with other jobs

- **Slice 1 plan 08** (`scripts/crawl-files.mjs`, `--target`, `wrangler.preview.toml`, `tests/preview-config.test.mjs`)
  is on local branch `gsd/phase-3.3-s1-p08` at `8d3c7e7`, not yet in `origin/gsd/phase-3.3-slice-1`. Plan 02-20
  Task 1 merges it in through the slice 1 branch (or `origin/main`) and stops if it is absent.
  `tests/preview-config.test.mjs` asserts "no `main`" and "`wrangler.toml` byte-identical to `origin/main`": this
  job flips both on purpose.
- **Slice 3 plan 26** (`/api/contact`) checks (a) `open-next.config.ts` exists, (b) `wrangler.toml` has a top-level
  `main =`, (c) no `NODE_ENV === "production"` in `app/newsletter/route.ts`. This job makes all three true.
  `/api/contact` needs no other edit: every `app/api` route is served. Its Task 3 runs the build runner, which after
  this job serves the route through `wrangler dev`.
- **Slice 3 plan 27** (`/newsletter`) posts to the existing `/newsletter` handler. This job removes that handler's
  production gate (plan 27's precondition) but keeps `/newsletter` held at the Worker, as the prompt requires.
  Proposed amendment for the controller: plan 27 adds `"/newsletter"` to `SERVER_PATHS_OUTSIDE_API` and removes it
  from `HELD_PATHS` in `lib/server-routes.ts`, and flips its entry in `tests/build/server-runtime.spec.ts`.
- **Job 02** (Phase 2 auth, cloud branch `claude/project-thread-8h6bed`): drop `f10f765`'s `wrangler.server.jsonc`,
  `host:server`, `preview:server` and its three gate tests when it is rebased. Middleware runs only for forwarded
  requests (never on an asset hit): Phase 2 lists `/login`, `/auth/confirm`, `/account`… in
  `SERVER_PATHS_OUTSIDE_API` when it ships, and its pages must stop being prerendered as public HTML.
- `npm run host:cloudflare` (bare `wrangler deploy`, Vamos login) is removed; `build:cloudflare` and
  `build:preview` build only. Deploy stays the controller's manual command with ALMAR's login.

## Out of scope

The contact route, the newsletter switch-on, Supabase wiring, sign-in, middleware, R2 incremental cache, image
optimisation (`/_next/image` stays 404), rate limiting (proposed by slice 3 plan 29 as an owner gate), DNS,
creating Worker `almar-preview`, any deploy, any secret.
