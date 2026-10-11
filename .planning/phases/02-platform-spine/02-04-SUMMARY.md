---
phase: 02-platform-spine
plan: "04"
status: complete
completed: 2026-10-01
---

# 02-04 Summary: ops host, owner gate, TOUCHWORD, Logout-all

Commit `e0be58a`. Owner answers B (reuse dashboard) and C (React header) applied.

- `lib/host.ts` + `middleware.ts`: the Host header picks the shell. On
  `dashboard.almarprivatejourney.com`, `/` is Home for the owner and the ops sign-in for anyone
  else, `/sign-in` is always the sign-in, `/<section>` serves `app/dashboard/(ops)/<section>`, and a
  typed `/dashboard/...` redirects to the clean path. On the marketing host, `/dashboard*` and
  `/ops*` are 404 in production; the dev server keeps `/dashboard` for review. `x-almar-host` is
  read only outside production.
- `(ops)/layout.tsx` is a server owner gate (role owner and owner email). On the ops host every
  section shows `Not ready.` with the full rail; Sign out (local) and Logout-all (global) close the
  rail, both through ConfirmDialog with the locked label pairs.
- Ops sign-in = board 6a, variant ops: heading Sign in, no "New here?", no WhatsApp. A guest email
  stays in the field with "This email cannot be used here." and Supabase is never called.
- TOUCHWORD: `/auth/handoff/start` (public host, owner session) issues a 5-minute single-use token,
  stored as SHA-256 in `host_handoff`, and sends her to `/auth/handoff` on the ops host, which marks
  it used in one statement and signs her in there. Referrer-Policy no-referrer.
- Tests: `host-gate`, `auth-owner`, `host-gate.spec.ts`; phase-03 page-gate tests now assert the
  layout gate instead.

## Landing on main (added 2026-10-11)

- The commit named above sits on the cloud branch `claude/project-thread-8h6bed` and is not on `main`. The work was rebuilt and landed as one squash in job 02: `01d9304` (2026-10-05 14:40 +04), covering plans 02-02, 02-03, 02-04, 02-23 to 02-26.
- Live: Worker `almar` `82569c44` (rollback `e1d0add8`), 2026-10-05 14:50 +04 per STATE. Six server paths open (/login, /auth/confirm, /auth/sign-out, /auth/handoff/start, /account, /bookings).
- Ops host `dashboard.almarprivatejourney.com` is served by Worker `almar-ops` (plan 03.2-03, `45a07e7`, live 2026-10-05 18:43), `d7fdccd4` then `08c248e9`, `1ef92954` from 2026-10-11 18:17 with owner keys set. Owner signed in there 2026-10-11 18:30 (CONTROL-BOARD).
