You run the Phase 2 auth chain for ALMAR: plans 02-08, 02-02, 02-03 and 02-04, in that order.
Phase 3.2 needs 02-08 (server runtime) and 02-04 (ops sign-in); 02-04 needs 02-03, 02-03 needs
02-02, 02-02 needs 02-08.

Read `.planning/prompts/00-common-rules.md` first and follow it.

STARTS only after job 01 (Phase 3.1) has landed and the owner says go. Not started on 2026-10-01.

One cloud thread (on the Mac: `/Users/koss/Developer/almar-wt/phase-2-auth`), branch
`gsd/phase-02-auth-chain`, cut from the base named in the common rules. Lead: Opus 5.5 (auth and
security). Executors: Sonnet, one at a time. This job changes sign-in and the database, so a fresh
reviewer thread reads the diff before each hand-over.

02-08 IS PARTLY DONE (found by the control session 2026-10-01): commits `6c8a50e` (host and phase
gate guards), `f97f262` (approved auth and email packages) and `eabe097` (Next bumped to 15.5.26 so
`@opennextjs/cloudflare` 1.20.6 installs), all 2026-09-26: that is Task 1, including `.env.example`.
Not done: Task 2 (`open-next.config.ts`, the Worker pointed at a server runtime without deploying)
and the SUMMARY. Start at Task 2.

STEPS
1. The four plans were written on 2026-09-24 and 25, before Phase 3.1 moved styling to Tailwind
   v4, put copy in `lib/copy/`, added LocaleSelect, deleted `/design` and `/framer` and added the
   harness. Re-check each plan against the code on your branch and list every file or step that
   no longer matches. Bring one revised plan per plan to the owner; he signs before code.
2. 02-08 specifies the server runtime beside the static assets (`open-next.config.ts`). No deploy,
   no Worker change, no DNS change. Install only packages that passed the 02-01 legitimacy check;
   any new package gets the same check first.
3. Supabase keys: the three names in `.planning/phases/02-platform-spine/02-USER-SETUP.md` are
   secrets on Worker `almar` since 2026-09-26. A cloud thread has no keys and never asks for them:
   it builds and tests without the live project, and any step that needs the real project goes to
   the control session on the Mac. On the Mac the owner puts the names into `.env.local` himself,
   one numbered step. Nobody reads or prints a value.
4. Migration `20260925120000_platform_spine.sql` is named in both 02-02 and 02-04. Ask the coordinator
   to confirm the number before you write it. Nothing is applied to the hosted project by you.
5. Owner account `maria@almarprivatejourney.com`: its password is set by the owner in his own
   terminal, never from chat. Password fields have the eye on the inline end.
6. Hand-over per the common rules. Ask the coordinator whether it wants one hand-over per plan or one
   at the end.

DECISIONS THAT STAND (STATE.md, 02-CONTEXT.md)
- The confirmation email is Resend; the magic link is the email. `email-verification-api` is
  rejected.
- The session time-box stays unset until the Supabase plan is Pro.
- Plans 02-09 and 02-10 stay paused (no more patching of Framer HTML).
- Guests never reach ops: a guest on the ops host gets ops sign-in or a refusal, never data.
