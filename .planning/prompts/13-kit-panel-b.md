# Job: kit panel B (03.2 shared editor), owner pick 2026-10-14

You are an ALMAR work session (not the controller). Branch `gsd/phase-3.2-kit-panel-b`, cut from `origin/main` in this
thread's T3 worktree.

Read first:
1. `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md` ("Product", "One job, one branch, one ship"; gitignored, use the absolute path).
2. `.planning/prompts/00-common-rules.md`.
3. `.planning/decisions/2026-10-14-auto-translate-and-panel-redesign.md` (all six points; point 6 is the pick).
4. The option-B pictures and their mock code: `git fetch origin gsd/phase-3.2-p06-catalog` and read
   `.planning/phases/03.2-real-catalog-and-team-inserted/pictures/03.2-06/panel-options/` plus the mock spec/scene that
   drew them (commits `361f37f`, `ca93e52`). Do not open PNGs; read the code that drew them.
5. Plan 03.2-10 (translate route) and the current kit: `components/ops/edit-panel.tsx`, `publish-bar.tsx`,
   `locale-tabs.tsx`, `translate-button.tsx`, `lib/copy/ops-kit.ts`, and its one live user, the media library
   (`app/dashboard/(ops)/content/media/`).

Goal: the shared kit editor becomes option B, and translation becomes automatic, so 03.2-06/-07/-13/-15 can mount
their forms in it without touching the kit.
1. **Full-page editor (B).** It replaces the list view, with a back link to the list. A top bar holds the title, the
   status, Save (outlined) and Publish (teal fill, white text). Delete is a link. Sections are cards in two columns at
   desktop width (the caller says which column each section goes in) and one column on a phone. Square corners, gold
   for lines only, tokens.json only. Keep the unsaved-changes guard and the keyboard and focus rules the drawer has
   today (Escape, focus return), adapted to a page.
2. **Automatic translation in the kit.** English fields only. On Save the kit calls the existing 03.2-10 translate
   route for the changed English fields and stores Arabic and Spanish. Then it shows the line "Arabic and Spanish
   updated". If the AI fails, Publish is disabled and an alert says why in words. A small "Edit translations" link
   opens the Arabic and Spanish fields for a fix. `LocaleTabs` and the Translate button leave every editor, and are
   deleted if nothing else uses them.
3. **Copy.** Kit strings go in `lib/copy/ops-kit.ts` in EN/AR/ES. Reuse the drafts 03.2-06 wrote in its `panel` group
   (`lib/copy/ops-catalog.ts` on its branch) rather than inventing new ones. Change every Spanish string in
   `ops-kit.ts` to usted. Mark new lines as drafts in HANDOVER. No legal wording, no prices.
4. **Media library** moves to the new editor, so the kit has one live user on main and stays proven.
5. **Tests.** Update `tests/ops-kit.test.mjs`, `tests/ops-media.test.mjs` and the journey scenes. Add Playwright for:
   the page editor at 390 and 1440 in EN and AR, the Save → translate → "updated" line, a translate failure blocking
   Publish, the "Edit translations" link, and the unsaved guard. Bite-check the failure gate: break it from a backup
   copy, then restore it by copy.
6. **Pictures for the controller** (option B is already signed): the media editor in the new kit, in EN, AR and ES, at
   390, 834 and 1440, plus the failure state at 390 and 1440. Run the label-string check. Do not open the pictures.

Rules: local Supabase only through `tests/helpers/local-supabase.mjs`, and only if needed. Playwright `--workers=2`,
only the specs you touched. Run long jobs detached with `nohup` and an `exit=` line. Read in chunks of 300 lines or
fewer. Never write a secret. No push to `main`, no PR, no deploy. Machine rule: one stack and one build at a time; a
check lane may be running, so keep your runs small.

Hand-over: merge `origin/main` (the base wins), re-run tsc, tokens and the full node suite, then build once. Commit
`.planning/phases/03.2-real-catalog-and-team-inserted/03.2-KIT-B-HANDOVER.md`, push the branch, and message the
controller (`t3_thread_send` to `8f8a7977-34a1-4959-819e-3a011d5e7e6f`) with the tip and one line per point. Stop.
