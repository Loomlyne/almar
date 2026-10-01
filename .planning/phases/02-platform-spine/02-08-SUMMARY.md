---
phase: 02-platform-spine
plan: "08"
status: complete
completed: 2026-10-01
---

# 02-08 Summary: server runtime specified, not deployed

**Task 1** (2026-09-26, commits `6c8a50e`, `f97f262`, `eabe097`): host and phase gate tests; approved
packages pinned (`@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7, `resend` 6.29.0,
`@opennextjs/cloudflare` 1.20.6); Next bumped to 15.5.26 so the adapter installs; `.env.example`
with empty values.

**Task 2** (2026-10-01, revised plan signed by the owner the same day):
- `open-next.config.ts`: `defineCloudflareConfig({})`, no R2 cache (owner gate).
- `wrangler.server.jsonc`: Worker `almar`, `main` `.open-next/worker.js`, `nodejs_compat`, assets
  binding. No routes, no R2, no secrets. `wrangler.toml` unchanged.
- `package.json`: `host:server` (build only) and `preview:server` (local `wrangler dev` on 8799).
- `.gitignore`: `/.open-next/`.
- `tests/phase-02-gates.test.mjs`: three new guards (Wrangler server file, build-only script, no
  static export).

## Checks on this commit (cloud thread)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `node --test tests/*.test.mjs` | 160 pass, 0 fail |
| `npm run tokens:check` | theme up to date |
| `npm run host:server` | `.open-next/worker.js` written |
| `npm run preview:server`, GET `/`, `/private-stays` | 200, 200 |
| GET `/nope` | 404, title "Page not found \| ALMAR" |

Not verified here: Playwright; anything on the live Worker (no deploy, by design). Wrangler's
telemetry calls were blocked by the cloud proxy, which does not affect the local preview.

## Next

Plan 02-07 (owner step, Mac control session) switches Worker `almar` to this runtime: routes and
secrets join `wrangler.server.jsonc`, then deploy on his word.
