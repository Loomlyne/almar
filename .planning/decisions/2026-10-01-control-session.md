# ALMAR runs like Vamos: one control session (owner, 2026-10-01)

His request, in the session "ALMAR project setup and control session": get every ALMAR chat into
one Claude Code project, learn from the Vamos Taxi control session how it works (control session,
work sessions, confirmation, which model does what) and run ALMAR the same way.

What it means here:

1. All ALMAR sessions sit in the sidebar group **ALMAR**.
2. The session "ALMAR control session" (`local_90a0e6e2-4bce-4142-b7d6-2fd05b2a84e1`, pinned) is
   the only one that lands work on GitHub, applies migrations to the live Supabase project and
   deploys Worker `almar`. It builds nothing itself.
3. Every other session does one job, on one branch, in its own folder under
   `/Users/koss/Developer/almar-wt/`, started from a prompt file in `.planning/prompts/`, and hands
   over by commit name and a `HANDOVER.md`.
4. The control session checks each hand-over in a clean clone, then asks the owner for Ship through
   the question form. Only his own answer is a Ship.
5. Models, as measured on Vamos: the control session on the strongest model; leads of money,
   database, auth or security jobs on Opus 5.5; mechanical jobs on Sonnet 5.5; Sonnet executes,
   Opus plans and checks plans.

The method: skill `control-session` (written by the Vamos control session, 2026-10-01).
The binding text: `CLAUDE.local.md`, section "One job, one branch, one ship".
Open: how a job lands on `main` (straight push on his Ship, as Vamos does, or a PR as ALMAR does
today). Until he answers, the ALMAR rule stands: `main` is never pushed directly.
