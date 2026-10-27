# Job 26: Phase 6 (site and rest of the CMS), execute 06-01 first

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`,
`.planning/phases/06-site-and-rest-of-cms/06-CONTEXT.md`, `.planning/phases/06-site-and-rest-of-cms/HANDOVER.md`,
`.planning/decisions/2026-10-21-phase-6-discuss.md`. Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

- **Branch:** `phase-06-site-and-rest-of-cms`, cut from `origin/main` (Phase 4 is landed and live there, `3c5e8bc5`).
  Push with `git push origin HEAD:phase-06-site-and-rest-of-cms`. Merge `origin/main` before each hand-over (main wins).
- **Order:** 06-01 now (wave 1: schema, data contracts, translation lock, import). Then wave 2 (06-02, 06-03), wave 3
  (06-04, 06-05, 06-07), wave 4 (06-06), each only after the plans it depends on are handed over.
- **Migration:** `supabase/migrations/20261025120000_site_cms.sql` (reserved). It runs after Phase 4's
  `20261019160000`, which is live; `20261019170000` was never created, so ignore that reference. Never apply it to
  the hosted project: the controller applies it after the owner signs the wave 2–4 pictures.
- **No tests (owner, 2026-10-21 and 2026-10-27).** No pgTAP, node suite, Playwright, stack, dev server or build. Write
  the tests the plans name, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed.
- **Pictures:** a plan step that asks the owner to sign pictures: draw them (real tokens, EN/AR/ES, 390/834/1440), put
  them in one HTML page per plan, push, and message the controller the path (it serves the page over http for the
  owner). Continue with the non-visual tasks while waiting. Build no visible screen before its pictures are signed.
- **Lead:** Opus; database, money, auth and security tasks with skill `deep-change` or `worker-deep`, UI with `worker`.
  Reviews of a finished plan: `~/.claude/scripts/jev-review base..head --author <model> --host claude-code`, reviewer
  agents read-only (no checkout or switch).
- **Never:** push `main`, deploy, set secrets, touch the hosted database. Hand over per plan by commit name in the phase
  `HANDOVER.md`, message the controller, and carry on with the next plan in order.
