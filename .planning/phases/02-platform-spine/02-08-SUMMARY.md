---
phase: 02-platform-spine
plan: "08"
status: complete
completed: 2026-10-05
commits: [7c4ae8d]
---

# 02-08 Summary: server runtime on Worker almar

- Task 1 (cloud branch, 2026-09-26): approved packages installed, Next bumped to 15.5.26, `@opennextjs/cloudflare` 1.20.6 (`f97f262`, `eabe097`, `6c8a50e`). None of these commits is an ancestor of `main`; the package state reached `main` through the 3.1 squash `9fd6786` (STATE 2026-10-11: "bumped 2026-09-26 in 02-08").
- Task 2 (runtime config, `f10f765`, cloud branch): skipped, not on `main`. Replaced by job 10, plans 02-20 to 02-22 ("static first, server on a short list"): `7c4ae8d` on `main`, 2026-10-05 03:28 +04.
- Live: Worker `almar` `1a2e7498` after job 10 (CONTROL-BOARD, `ad47f00`); later versions come from `wrangler deployments list`, not this file.

Deviations: Task 2 was done as job 10 (`worker/handle.mjs`, `lib/server-routes.ts`, `open-next.config.ts`, `wrangler.toml` edited), not as the plan's `wrangler.server.jsonc`. The plan said no deploy; job 10 deployed on the owner's word.

Open: none recorded for this plan. The plan's file list (`tests/host-config.test.mjs`, `wrangler.server.jsonc`) does not match what landed; not reconciled.
