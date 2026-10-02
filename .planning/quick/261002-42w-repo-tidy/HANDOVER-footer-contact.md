# Hand-over: footer Contact click fix (261002-42w follow-up)

Branch `fix/footer-contact-click`, commit `0832d2d2bc30c45094ddde68345e4e01367ce703` (on top of `2350b51`, based on `main` `6416b51`). Not pushed. This file is not in the commit (the commit cannot name its own hash).

## What changed
- 20 Framer pages (every file whose HTML holds `<div class="framer-1pmr5p9-container">`): one capture-phase click delegate script injected immediately before the single `</body>`. 1 injection per file, 20 files, 20 insertions / 20 deletions (one-line HTML string each). Anchors and hide rule untouched.
- `tests/footer-contact-link.spec.ts` (new, Playwright): on `/`, `/about`, `/contact`, `/private-stays` finds the visible `a[href="/contact"]` in `.framer-1pmr5p9-container`, plain-clicks it, asserts the URL path is `/contact`. Waits for network idle plus 1.5 s before the click (Framer's router only takes over after hydration; clicking earlier lets the plain href win and hides the bug) and 1.5 s after landing (catches a late redirect). Fifth test: no visible `footer a` on `/about` resolves to the 5 dead `/legal/*` paths.
- `tests/no-dead-links.test.mjs`: one new test, all 20 footer pages contain the script exactly once.

## Checks (from this worktree)
- `npx tsc --noEmit`: exit 0.
- `node --test tests/*.test.mjs`: 197 pass, 0 fail.
- `npm run tokens:check`: "theme up to date".
- `node scripts/assemble-cloudflare.mjs`: exit 0, "assembled 27 html files into out/". (First run in this worktree crashed inside `next build` with a Node stack trace; I only saw the tail. Two reruns passed. Cause not established, see below.)
- `PW_PORT=3023 npx playwright test --workers=1`: 1118 passed, 28 skipped, 0 failed (17.2 min). The 5 new tests are among the passes.
- From built `out/`: script present in 20 files, once each; `href="/contact"` count 99 (includes nav and other links, not only the footer); team-name grep (Velásquez / Mateo Ríos / Sofía Marín): 0; dead-path href grep (privacy-policy, booking-terms, disclaimer, liability-waiver, terms-of-service, baru-house, corona-island, yury-house): 0.
- `git status --short` after the Playwright run: only the intended 20 app files and 2 test files (now committed); nothing generated.

## Proof that both guards are real
Pre-change tree: `git archive 2350b51 | tar -x -C /tmp/fcc-before`, new test files copied in, node_modules symlinked, port 3023. Temp dir deleted afterwards.
- Node assertion: `all 20 footer pages carry the click-delegate script exactly once` FAILED; the other 7 tests passed (7 pass / 1 fail).
- Playwright, final version of the spec, run twice: all 4 click tests failed (`/`, `/about`, `/contact`, `/private-stays`), `Expected: "/contact"  Received: "/legal/privacy-policy"`; the dead-link test passed (1 passed / 4 failed both runs).
- First draft of the spec (no hydration wait) failed only on `/`; `/about`, `/private-stays` passed by racing the router. That is why the wait was added; with it the guard fails on every page in the old tree.
- This branch: node test passes (197/197), all 5 Playwright tests pass.

## Not verified
- Browsers other than Chromium; real touch/keyboard activation (Enter on the focused link) and middle-click / ctrl-click (the delegate hijacks those too and forces same-tab navigation).
- The three breakpoint copies individually: the test clicks whichever copy is visible at Playwright's default viewport (desktop) only.
- The live site: nothing deployed, nothing pushed.
- Cause of the single first-run `next build` crash in this worktree (not reproduced on two reruns); I did not capture the error text.
- The `/contact` Playwright case clicks a link on the target page itself: it proves the click does not go to `/legal/privacy-policy`, not that a navigation happens.
- No-JS behaviour (plain href) was not run in a browser; it follows from the 2350b51 markup test only.
