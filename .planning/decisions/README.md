# Owner decisions

One file per decision or decision set, named `YYYY-MM-DD-topic.md`. Owner-approved texts are used
verbatim. The control session writes these files; a work session sends it the decision instead.

When the owner decides something in a work session, the control session copies it here, so every
session reads the same truth. A newer decision wins over an older file or spec; the older one gets
a line saying what replaced it.

Older decisions also live in:
- `.planning/PROJECT.md`, "Key Decisions" and "Out of Scope".
- `.planning/STATE.md`, "Decisions".
- Phase CONTEXT files: `01-CONTEXT.md`, `02-CONTEXT.md`, `03-CONTEXT.md`, and
  `03.1-CONTEXT.md` (D-01 to D-93).

| File | What |
|---|---|
| `2026-09-28-design-audit.md` | Fake team removed, teal tint, brand-book copy, phase order, journey bar redesign, phone entry |
| `2026-09-28-phase-3.1-discuss.md` | Canvas is the design system, Tailwind v4 only, teal primary, gold lines only, type scale |
| `2026-09-29-public-pages-gate.md` | Cart in the nav, one experiences and services page with overlay, pre-filled stay bar |
| `2026-10-01-control-session.md` | ALMAR runs like Vamos: one control session lands and deploys; jobs land as one commit on `main` |
| `2026-10-01-cloud-project.md` | Work moves to a Claude cloud project; shipping stays on the Mac with the control session |
| `2026-10-02-cleanup.md` | New controller, ALMAR on Cloudflare account f1d9a1fa, 3.1 shipped and deployed, old Worker and Pages deleted, worktrees in `.claude/worktrees`, job 04 repo tidy with the fake-team and dead-link fixes |
