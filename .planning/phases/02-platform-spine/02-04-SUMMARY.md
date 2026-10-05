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
