---
phase: 02-platform-spine
plan: "21"
status: complete
completed: 2026-10-04
commits: [00af2e5, 5fba550]
---

# 02-21 Summary: the built Worker, proven on both Worker files

## Task 1: the spec and the config switch (`00af2e5`, navigation probes added in `5fba550`)

- `playwright.build.config.ts`: `--config ${PW_WRANGLER_CONFIG ?? "wrangler.toml"}`; header comment says to assemble
  first (the Worker imports `.open-next/`).
- `tests/build/server-runtime.spec.ts`, 10 tests per Worker file, Playwright's `request` fixture, `maxRedirects: 0`:
  config and bundle present; every page's exact bytes (54 pages); the pinned nine held sections equal `HELD_PATHS`
  and each is probed; GET on 14 held probes plus 4 other misses = the nearest locale 404's bytes; POST and PUT on
  them = 404 or 405, never JSON, never `noindex`; `/api/health` (GET, query, HEAD, POST 405); **browser navigations**
  (`Sec-Fetch-Mode: navigate`) reach `/api/health` and still get the 404 on held paths; pages, caching, robots and
  sitemap per host; redirects; an RSC request gets the static file.

| Run | Result |
|---|---|
| `wrangler.toml` (out/) | 9/9 at `00af2e5`; 10/10 at `5fba550` |
| `wrangler.preview.toml` (out-preview/) | 9/9 at `00af2e5`; 10/10 in the final check set (HANDOVER) |
| Bite check: `/newsletter` moved from `HELD_PATHS` to `SERVER_PATHS_OUTSIDE_API`, reassembled | 4 tests red: pinned list differs; GET `/newsletter` got Next's 405; POST reached the handler. Reverted; list rebuilt to `["/api/health"]` |
| Navigation check: `run_worker_first` removed from `wrangler.toml` in a scratch edit | test 4 red (`/api/health` navigation got 404); restored |

## Deviations

- Two probes the plan listed as 404s are answered 307 by Cloudflare's static layer, before any Worker code: any
  percent-encoded path is redirected to its decoded form (`/api%2Fhealth` → `/api/health`, `/api/%68ealth` →
  `/api/health`, `/dashboard%2Fhome` → `/dashboard/home`). Moved to the redirect test; the redirect target meets the
  same exact-match rule. Measured on `wrangler dev`, 2026-10-04.
- I skipped the plan's "revert, reassemble" after the bite check, so `.open-next/almar-server-routes.json` still held
  `/newsletter` when the security review read it (finding 1). Rebuilt. The Worker now refuses to start with such a
  list, and the runbook checks the file before each deploy.

## Task 2: full check set

Counts in `HANDOVER-job-10.md`. Dev-config suite 1,859 passed, 28 skipped, 0 failed (`d958b93`); build suite
1,394 passed, 0 failed (`350a7b6`, after the first attempt failed to bind a port and ran no test); runtime spec 10/10
on both Worker files.
