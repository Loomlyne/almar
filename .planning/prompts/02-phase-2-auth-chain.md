You finish job 02, the Phase 2 auth chain for ALMAR (plans 02-08, 02-02, 02-03, 02-04), on the Mac.
The code was built in the cloud on 2026-10-01 on branch `claude/project-thread-8h6bed` and stopped
there by the owner's local-only rule. Your job: bring it onto `main`, prove it on this Mac, pass his
gates and his test, hand over. Phase 3.2 needs 02-08 (server runtime) and 02-04 (ops sign-in).

Read `.planning/prompts/00-common-rules.md` first and follow it.

STARTS NOW (owner, 2026-10-04 ~22:05: v1 in ten days, `decisions/2026-10-04-ten-day-v1.md`). Target: hand-over
by Oct 8.

Your app-made worktree, branch `gsd/phase-02-auth-chain`, cut from **`origin/gsd/phase-02-server-runtime`** (job 10,
`466ec4c`, handed over, lands after slice 1). Job 10 already did 02-08 (OpenNext on Worker `almar`, deny-by-default
server paths in `lib/server-routes.ts`): **skip the cloud `f10f765`**; its 02-08 is superseded. Every new server
path you open goes through job 10's allow-list, and the 404 list stays 404 until your gates pass. Before the
hand-over merge `origin/main` (slice 1 and job 10 will be there); `main` wins on layout and pages.
`git fetch origin && git switch -c gsd/phase-02-auth-chain origin/gsd/phase-02-server-runtime`
Lead: Opus 5.5 (sign-in, database and security). Executors: Sonnet, one at a time. After every change
to sign-in or the database, a fresh Opus reviewer agent reads the diff before the hand-over.

WHAT IS ON THE OLD BRANCH (tip `3e2d58c`, kept on GitHub until this job lands)
- Plan revisions: `9d170d5`, `6440aeb`, `a0c02dd` (re-checked against 3.1; owner answers A, B, C).
- `f10f765` 02-08 server runtime config (build only), `4155797` plans aligned with the signed discuss
  refresh, `2598290` 02-02 magic link and account hub, `5b6739d` 02-03 language cookie on login,
  account, bookings and 404, `e0be58a` 02-04 ops host, owner gate, TOUCHWORD, Logout-all, `393964f`
  summaries, `e30e518` review fixes (security: anon could write `site_settings_public`, plus 4 more),
  `3e2d58c` its hand-over `.planning/phases/02-platform-spine/HANDOVER.md` (the owner's 6 gates and
  8 test steps).
- `f0c7cef` is a merge of the old base: skip it. Everything older is already in `main`.

STEPS
1. `/gsd-progress` to confirm Phase 2 position, then move the work:
   `git cherry-pick $(git rev-list --no-merges --reverse archive/ship-3.1..origin/claude/project-thread-8h6bed | grep -v '^f10f765')` (resolve the short id to the full one first).
   Expected conflicts: `app/account`, `app/login`, `components/ui/nav.tsx`, the ops layout,
   `tests/phase-03-*`. `main` wins on 3.1 styling and structure; job 02 wins on sign-in behaviour. List
   every conflict and how you solved it in the hand-over.
2. Run the full check set (common rules) and the Mac screenshots. Expected red, by design:
   `tests/screens-before-after.spec.ts` for account (6) and login (4 of 6), because those pages were
   redrawn to the signed canvas (6a, 6b). Show him the shots; he decides. Never regenerate
   `tests/screens/before/`.
3. Fresh Opus reviewer agent on the whole moved diff (sign-in, database, host gate). Fix what it finds.
4. Migration `supabase/migrations/20260925120000_platform_spine.sql`: ask the controller to confirm the
   number. You never apply it; the controller does, on the owner's word.
5. His gates, one numbered step each, in this order, then wait (from the old hand-over): Supabase
   project named and the migration applied (controller); Supabase Auth: new sign-ups off and the
   password provider off; Resend: verify the sending domain for `inquiries@almarprivatejourney.com`;
   `.env.local` on the Mac with the names in `02-USER-SETUP.md` (he types the values; nobody prints
   them); Cloudflare rate limit or Turnstile on POST `/login`; DNS for `dashboard.almarprivatejourney.com`
   and the 02-07 runtime switch (later, his call).
6. His test: the 8 numbered steps in the old hand-over (magic link, profile save, Arabic, guest refused
   on the ops host, TOUCHWORD, Logout-all), updated for anything step 1 changed.
7. Also in this job, as separate plans he signs before code: 3.1 open items W6 for sign-in submit and
   Profile sign-out (wire or hide), W7 guest nav anchors, W8 currency select, W9 language cookie read.
   W7 to W9 are shared with 3.3: propose, do not build, if they need 3.3 pages.
8. Hand-over per the common rules, in `.planning/phases/02-platform-spine/HANDOVER.md` (replace the
   cloud one).

DECISIONS THAT STAND (STATE.md, 02-CONTEXT.md, 02-DISCUSS-2026-10-01.md)
- The confirmation email is Resend; the magic link is the email and creates the account (no Create
  account tab). `email-verification-api` is rejected.
- Login shows only on React pages. `/account` is a working hub showing only parts that work. Profile
  names and phone are editable. TOUCHWORD is written in capitals.
- Owner account `maria@almarprivatejourney.com`: its password is set by the owner in his own terminal,
  never from chat. Password fields have the eye on the inline end.
- The session time-box stays unset until the Supabase plan is Pro.
- Plans 02-09 and 02-10 stay paused (no more patching of Framer HTML).
- Guests never reach ops: a guest on the ops host gets ops sign-in or a refusal, never data.
- No deploy. The server runtime goes live only on the owner's word, through the controller.
