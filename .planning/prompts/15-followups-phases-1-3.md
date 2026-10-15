# Job: phase 1–3 follow-ups (small fixes), controller brief 2026-10-15

You are an ALMAR work session (not the controller). Branch `fix/phase-1-3-followups`, new, cut from `origin/main`. You run
in an app-made worktree under `.claude/worktrees/`; push with `git push origin HEAD:fix/phase-1-3-followups`. The
controller is `local_2a268540-fee7-461a-a9c2-49fa6015a12f` (`SendMessage`: start, blocked, slot?, hand-over).

Read first: `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md` (absolute path), `.planning/prompts/00-common-rules.md`,
`.planning/HANDOFF-2026-10-15-controller.md` ("Follow-ups"), and the PR threads named below
(`gh pr view <n> --repo Loomlyne/almar --comments`).

## The fixes (one commit each, each with a test that fails without it; prove it by breaking from a backup copy and
restoring by copy, never `git checkout` a file)
1. **Dead seam.** `lib/settings/site-rebuild.ts` was the 02-06 stand-in for 03.2-05's publish rebuild. Prove nothing
   imports it (`grep -rn site-rebuild app lib components worker tests scripts`), remove it and its fakes in tests.
2. **Kit editor history trap** (PR #15, Grok round 3 minors): the unsaved-changes trap's flag on `history.state` —
   Forward after a reload, and the browser history cap. Read the round-3 comment for the exact cases; fix in
   `components/ops/edit-page.tsx` without changing anything a wave 4 job mounts (props and section API stay as they are).
   Same fix, reported by 03.2-06 on 2026-10-15: opening `EditPage` with `dirty=true` in dev pops "Discard changes?" at
   once, because React strict mode runs the Back-guard effect twice and the cleanup's `history.back()` lands as a
   popstate on the second setup. Make the guard idempotent under a double effect; prove it in dev (strict) and build.
   Third case, found by 03.2-13 on 2026-10-15: after Save closes the page, the guard's cleanup `history.back()` races
   a navigation that starts right away (Playwright `page.goto` aborted with `net::ERR_ABORTED`). Closing the page must not
   undo or abort the next navigation; prove it with a test that navigates immediately after Save.
3. **Test helper race.** `tests/helpers/local-supabase.mjs`: `requireStack` runs before the lock is taken, so two
   callers can race. Take the lock first. Test it without starting a stack.
4. **Translate route signal** (03.2-10 follow-up): `worker/handle.mjs` passes no `signal` to the translate call, and
   `someLeft` shows only when both targets return. Read PR #9's thread. **`worker/handle.mjs` is also edited by PR #16
   (3.3 part B):** PR #16 landed on `main` as `7cf9ce2` on 2026-10-15 03:12. Do this item last, and merge `origin/main`
   before you touch the file.
5. **Language hint cookie** (02-05 follow-up): a signed-in session without the hint cookie gets it set; read PR #4–#7
   review threads and `02-05-SUMMARY.md` for the case.
6. **`database.types.ts` refresh** from the migrations on main. This needs a local Supabase stack: ask the controller
   "slot? stack" and wait for "go" (its landing check holds the one stack now). Do it last with item 4.
7. **Publish rules on Save** (PR #18 review, 2026-10-15): `ops_save_catalog_item` and `ops_save_destination` do not
   re-check the publish rules (photo, at least one destination) when the row is already published; only `ops_publish`
   does. 03.2-06 blocks it in the dashboard; the server must refuse it too. Needs a migration: ask the controller for a
   number first, pgTAP for each refusal, no change for draft rows.
8. **Held-spec selector** (PR #16 review round 3, 2026-10-15): `tests/build/stay-detail/stay-detail-held.spec.ts:106`, the
   "no text field outside the footer" count behind the phone sheet, excludes only `type=hidden`; make it exclude
   submit, button, checkbox and radio like `expectFooterNewsletter` in `tests/build/newsletter/_footer.ts`. Test-only;
   prove the spec still fails when a real text field is added outside the footer.
9. **Calendar errors** (PR #17 review round 2, 2026-10-15): `app/dashboard/(ops)/calendar/calendar-screen.tsx` (the
   `deleteError` block near line 157) keeps a failed Delete's sentence through a month change and a later good add, with no
   dismiss: clear it on those. Add a spec for the `visibilitychange` path of the `today` refresh (near line 67; only
   `focus` is tested). Lands after PR #17.

Not in this job: the primary button's text colour (ivory vs white), the nosniff header on the media host and the
`wrangler tail` CPU reading (deploy-time items for the controller).

## Checks and hand-over
Before hand-over: merge `origin/main` (the base wins), `npx tsc --noEmit`, `npm run tokens:check`,
`node --test tests/*.test.mjs`, one build (`node scripts/assemble-cloudflare.mjs --target=local`) and the Playwright
specs you touched with `--workers=2` — the build and any Playwright run only after the controller's "go" for the slot.
Write `.planning/HANDOVER-fix-phase-1-3-followups.md` (final commit, every check with its result, what was NOT verified),
push, message the controller with the tip and one line per fix. Stop. No push to `main`, no PR, no deploy, nothing
against the live Supabase project.

Machine rules: no stack, no build, no Playwright without the controller's "go"; long runs detached with `nohup` and an
`exit=` line, logs outside `/tmp`; read files in chunks of 300 lines or fewer; never write a secret.
