# Job 23: cleanup: planning drift and the preview rate-limit namespace

Read first: `.planning/prompts/00-common-rules.md`, `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md`, and `.planning/decisions/2026-10-21-owner-answers-after-landing.md`.
Controller: `local_2a268540-fee7-461a-a9c2-49fa6015a12f`.

**No tests (owner, 2026-10-21: "I told you, no test. Direct, no test.").** Run no test suite, Playwright, pgTAP, stack, dev server or build. Write the test files the work needs, unrun. `npx tsc --noEmit` and `npm run tokens:check` are allowed. Hand over with every other check marked "not run (owner: no test)".
No push to `main`, no deploy, no hosted database. Never print a secret. Hand-over: commit name plus `HANDOVER.md` in the job folder named below; message the controller; stop.

Branch `fix/cleanup-2026-10-21` from `origin/main`. Job folder: `.planning/quick/261021-cleanup/`.

1. Apply the ROADMAP/REQUIREMENTS wording fixes proposed in the three `HANDOVER-close.md` files (phases 02, 03.2, 03.3: G1, G2, G5 and the 26-vs-22 pages wording) and in `03.3-VERIFICATION.md`. Do not change any phase status the controller already set (2b86bc24).
2. `wrangler.preview.toml` shares `FORM_LIMITER` `namespace_id = "1001"` with production, so preview posts count against real visitors. Give preview its own namespace id; check the Cloudflare docs for how a ratelimit namespace id is chosen and whether it must be created first; say what the controller must do at the next preview deploy.
3. HERMES.md: refresh any line still describing the Framer bridge, `/fx` or the Next 15 setup.
