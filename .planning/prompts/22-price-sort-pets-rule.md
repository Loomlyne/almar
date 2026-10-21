# Job 22: price sort (CMS-02) and the pets rule shown to guests (STAY-05)

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`, and `.planning/decisions/2026-10-21-owner-answers-after-landing.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

**No tests (owner, 2026-10-21: "I told you, no test. Direct, no test.").** Run no test suite, Playwright, pgTAP, stack, dev server or build. Write the test files the work needs, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed. Hand over with every other check marked "not run (owner: no test)".
No push to `main`, no deploy, no hosted database. Never print a secret. Hand-over: commit name plus `HANDOVER.md` in the job folder named below; message the controller; stop.

Branch `gsd/price-sort-pets-rule` from `origin/main`. Job folder: `.planning/quick/261021-price-sort-pets-rule/`.

1. **CMS-02 price sort (owner #10: "do it").** Read REQUIREMENTS CMS-02 and `03.2-VERIFICATION.md`'s gap note. Add the sort where the requirement puts it (public listing and/or dashboard list), on the real data layer (`lib/data/*`), EN/AR/ES labels, kit Select (use a sentinel, not "", see memory `select-empty-value.md`). Never invent prices: items without a rate sort last and show no number.
2. **STAY-05 pets rule (owner #11: "do it").** Show each stay's pets rule to guests on the stay page, from the stored field, EN/AR/ES, in the existing house-rules or facts pattern of that page (no new visual system).
3. **Job 21 is running at the same time** and moves every page under `/en`, `/ar`, `/es`. Keep your edits to components and data, not to route folders, so its merge stays small.
