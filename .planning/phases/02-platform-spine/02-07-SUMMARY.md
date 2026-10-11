---
phase: 02-platform-spine
plan: "07"
status: complete
completed: 2026-10-05
commits: [7c4ae8d, 01d9304, 45a07e7]
---

# 02-07 Summary: runtime and ops host applied by the owner

The plan was a stop: one numbered owner step for the ops host route and the Resend domain, no agent deploy,
no `wrangler.toml` edit. It was carried out through other plans, all on the owner's word.

- Server runtime on Worker `almar`: job 10 (plans 02-20 to 02-22), `7c4ae8d` (2026-10-05 03:28 +04), live as `1a2e7498` (STATE/CONTROL-BOARD `ad47f00`).
- Sign-in paths on `almar`: job 02, `01d9304`, live `82569c44` (2026-10-05 14:50 +04).
- Ops host `dashboard.almarprivatejourney.com`: Worker `almar-ops`, plan 03.2-03, `45a07e7`, live 2026-10-05 18:43 +04 as `d7fdccd4`; sign-in failed closed until the owner set `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` on it (2026-10-11 18:17, now `1ef92954`).

Deviations: the plan said "route on the existing Worker `almar`, do not create a second Worker". What was applied is a second Worker `almar-ops` with its own custom domain (the board's decision, 03.2-03). The plan's `wrangler.toml` unchanged guard no longer holds (job 10 edited it).

Open / not recorded: the Resend domain `almarprivatejourney.com` verification is not recorded in STATE or CONTROL-BOARD; the DNS record step is not recorded separately (the custom domain is read live). Resend key on Worker `almar` (guest sign-in mail): not recorded.
