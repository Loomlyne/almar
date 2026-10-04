---
phase: 02-platform-spine
plan: "22"
status: complete
completed: 2026-10-04
commits: [5fba550, 350a7b6]
---

# 02-22 Summary: review, runbook, hand-over

- **Task 1, security review:** a fresh Opus reviewer read `git diff 6264c59..HEAD`. It found no way to run a held page
  with the committed code. It raised two medium findings (a stale routes file on disk with nothing re-checking it at
  deploy; every asset miss running the Worker) and four low ones. All except the newsletter handler's hardening are
  fixed in `5fba550`. The newsletter handler stays held and is a slice 3 item. A second pass closed every fix. One
  follow-up was done in `350a7b6` (reject `/api` itself at build time); the other (two POSTs in a row keep their
  bodies) is proposed for slice 3 plan 26. Table in `HANDOVER-job-10.md`.
- **Task 2, runbook:** `02-RUNTIME-DEPLOY.md`. Preview first, then production, each on the owner's word. Every
  wrangler line carries ALMAR's full login. Each deploy checks the routes file and a clean tree, then runs a dry-run
  size check. After the deploy come 20 health calls with the tail open (D-SR-02 stop rule) and a browser-tab check,
  then the live checks and a one-command rollback. The plan's verify passed (6+ prefixed lines, no unprefixed
  deploy, rollback or secret line).
- **Task 3, hand-over:** `HANDOVER-job-10.md`, with the four secret steps and three page checks for the owner.
  Pushed; no message to the controller.

Deviation: the first full check set's build suite never started (port bind collision on the shared Mac); it was
rerun on the final code commit on another port: 1,394 passed.
