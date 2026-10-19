# Hand-over: phase 1–3 follow-ups

**Status: DRAFT, written 2026-10-17 14:31 CET, updated 14:42 CET after the merge of `origin/main` `82b66bf` and 14:53 CET with item 11 (main `5ade3df` merged in `4ccd821`), and 15:28 CET after run (a), 2026-10-19 11:27 CET after run (b) (main `f9d7cb1` merged in `4832169`), and finished 2026-10-19 12:56 CET after
runs (c)+(d) and the merge of `origin/main` `9b71d59` in `a98f0a8`.**
Every run is done. The final commit is the one that adds this version of the file, on top of `a98f0a8`.

- Job: `.planning/prompts/15-followups-phases-1-3.md`
- Branch: `fix/phase-1-3-followups` (worktree `.claude/worktrees/compassionate-dubinsky-66be64`, local branch
  `claude/compassionate-dubinsky-66be64`), cut from `origin/main` `bfc3326`; `origin/main` `deb3bda` merged in `ef28ffc`;
  `origin/main` `82b66bf` (PR #18, 03.2-06 catalog, landed as `fa5c3b2`) merged in `f97ff70` with no conflicts.
- Last code commit: `25f99f0` (item 10). Merges after it: `4832169` (`f9d7cb1`, docs only), `c4adcad` (`dc91813`,
  docs only), `a98f0a8` (`9b71d59`: PR #20 `77f8d51` auth and 03.2-07 `40b5b65` Stays, no conflicts, no file in common
  with this branch, no package change). Earlier: `f97ff70` (`82b66bf`), `4ccd821` (`5ade3df`). Only this file's commits
  sit on top of `a98f0a8`.
- Item 10 stays last: item 11 came after item 10 was pushed, so `309383d` reverts item 10, `04d93fd` is item 11, and
  `99bc83b` applies item 10 again by cherry-pick of `3bd80f4` (package files identical to `3bd80f4`). Item 6 came after
  that: `7c693e5` reverts item 10 again, `417dbaf` is item 6, `2c07126` is item 10 by cherry-pick of `3bd80f4`. After
  run (b): `5d39d52` reverts item 10, `31c0ad9` (fix 2) and `bd3a053` (item 11 spec), `4191877` item 10; `9b2cc54`
  reverts it, `f49fc37` (fix 2: no PW_NEXT), `25f99f0` item 10. Each item 10 commit is the cherry-pick of `3bd80f4`
  (package files identical). No force-push.
- PR #18 and item 2: 06's destination and catalog-item editors mount `EditPage` with the same props; they open and close
  it through React state only (no URL change, no `router.refresh`, no server action), so the back-guard flag is not
  dropped there. PR #18 changes neither `edit-page.tsx` nor any migration. Its specs ran in run (b): 64 passed, 90 skipped (picture shoots), 0 failed.
- Nothing pushed to `main`, no PR, no deploy, nothing run against the live Supabase project.

## Items (one commit each, oldest first)

| Item | Commit | What changed | Failing-first proof (bite from a backup copy, restored by copy) |
|---|---|---|---|
| 1 | `e283641` | The 02-06 site-rebuild seam is gone: `lib/settings/site-rebuild.ts` deleted; `postSettings({ owner, body })` answers `{ ok: true, affects_site }` and the 03.2-05 opsPost `afterWrite` requests the site update. | old handlers: 2 fail |
| 2 | `e9c4986`, `715f8ee`, `31c0ad9`, `f49fc37` | Editor Back guard (`components/ops/back-guard.ts`, new, pure): the guard entry is flagged on `history.state` (`__almarEditTrap`), not by address and history length; closing or saving takes no history step; a watcher steps past a spare entry. `edit-page.tsx`: no prop or section API change. `31c0ad9` (run b): a second `loaded()` (strict mode's double mount: loaded, arm, release, loaded, arm) never steps off this document's own entry; it did, and EditPage then asked "Discard changes?" at once. `f49fc37`: `playwright.config.ts` is main's again (no `PW_NEXT`): a production build drops the harness scenes (03.2-12), so the build path is **not browser-tested** for fix 2. | node: step at release 4, arm always pushes 1, no Back-past-spare rule 1, no step-off-spare rule 2, no step wait 1, address+length mark 1, old edit-page 1; `31c0ad9`'s sequence test 1 (restored: 11 pass). Browser, dev strict mode (run b, 2026-10-19): 4 passed; bite back-guard.ts before `31c0ad9`: 1 failed, 0 passed; bite edit-page.tsx as on main: 1 failed, 0 passed |
| 3 | `0b1c8b6` | Stack tests take the stack lock before they look for the stack (`lockStack(t)` in `tests/helpers/local-supabase.mjs`); six callers moved. | look-first 1, old helper 1 |
| 5 | `1db1b3d` | A valid public session without the `almar-signed-in` hint gets it back (`needsSignedInHint` in `lib/account-preferences.ts`, set in `middleware.ts`); not on the ops host, not on `/auth*`, GET/HEAD only. | old middleware 3; /auth, POST and ops rules 2 each |
| 9 | `11d589b` | Calendar: a refused Delete's sentence goes on a month change and on a successful add; visibilitychange today spec added. | Run (c) dev: 44 passed, 63 skipped (pictures), 0 failed; bite `calendar-screen.tsx` as on main: 2 failed, 0 passed (both refused-Delete specs, alert count 1 not 0); restored by copy, identical |
| 8 | `d4a9e49` | Held stay spec counts text fields with the same selector as the footer check (`TEXT_FIELD`). | Run (d) build: 31 passed, 0 failed; bite (a `type="text"` input with `className="hidden"` in the stay hero, re-assembled): 1 failed, 0 passed (`en getsemani-colonial-house @390`, "with the sheet open at When: no text box outside the footer", 1 not 0). The input is display:none, so `getByRole("textbox")` cannot see it; only the item 8 selector does. Restored by copy, identical, re-assembled |
| 4 | `560437b` | `worker/handle.mjs` passes `request.signal` into the rebuilt Request, so the visitor's abort reaches Next. | old handle: 1 fail |
| 7 | `d36bc47` | Migration `20261017120000_ops_save_publish_rules.sql` (see below) + pgTAP `supabase/tests/ops_save_publish_rules.test.sql` (24 asserts) + static node test `tests/ops-save-publish-rules-migration.test.mjs`. | static: no hero check 2 fail, no item photo check 2 fail, hero check before the translations save 1 fail. pgTAP (run a): 24/24 pass; bite (both checks removed from a copy): 10 of 24 fail (tests 1-4, 12-17), restored copy identical, 24/24 pass again |
| 11 | `04d93fd`, `bd3a053` | `components/ui/select.tsx`: the chevron span loses `rtl:-scale-x-100`. CSS runs scale before rotate, so with `rotate-90` the closed chevron pointed up in Arabic (and down when open). Spec in `tests/ui/primitives.spec.ts` (Select block, every locale and width): computed translate, rotate, scale and transform from the trigger to the svg; closed down, open up, closed down again. | Run (b) dev: Select block 45 passed (after `bd3a053`: the spec finds the trigger by CSS, an open Radix Select hides it from the accessibility tree); bite old `select.tsx`, ar only: 3 failed, 0 passed (2026-10-17 and 2026-10-19) |
| 10 | `25f99f0` (last; first pushed as `3bd80f4`) | `next` 15.5.27 exact (Dependabot #38–#41). Lockfile changes only `next`, `@next/env`, `@next/swc-*`. The `overrides` block (`next` → `postcss: "$postcss"`) pins no next version and is unchanged. `tests/phase-02-gates.test.mjs` pinned next exactly to 15.5.26; it now pins 15.5.27. | the old pin failed against the bump (1 fail), as expected |
| 6 | `417dbaf` | `lib/supabase/database.types.ts` from `local-supabase.mjs types` after a reset that applied every migration. New: `api_site_settings`, the nine bookings tables, `stripe_events`. Gone: `site_settings_public` (dropped by `20261013120000`). | a generated file: proof is the run (a) output plus tsc 0 and node 0 fail with it |

## Item 7 in detail

The new bodies of `ops_save_destination` and `ops_save_catalog_item` are the latest definitions in
`20261005100000_catalog_and_team.sql` plus one check each. That migration is the only one that defines either function
(checked with `grep -rln` over `supabase/migrations`; the controller confirmed the same), and it defines each one
once (lines 1209 and 1396). No later migration replaces them; the static node test fails if one does.

Diff of each function against `20261005100000` (the check lines are the only change):

```diff
--- 20261005100000 ops_save_destination
+++ 20261017120000 ops_save_destination
@@ -46,6 +46,10 @@
 
   perform public.catalog_save_translations('destination', v_id, p -> 'translations', v_create);
   select d.is_published into v_pub from public.destinations d where d.id = v_id;
+  -- A published destination keeps what ops_publish required of it: its hero photo.
+  if v_pub and (select d.hero_media_id from public.destinations d where d.id = v_id) is null then
+    perform public.catalog_invalid('hero_media_id');
+  end if;
   return jsonb_build_object('id', v_id, 'affects_site', v_pub);
 end;
 $$;
```

```diff
--- 20261005100000 ops_save_catalog_item
+++ 20261017120000 ops_save_catalog_item
@@ -90,6 +90,13 @@
   end if;
 
   select c.is_published into v_pub from public.catalog_items c where c.id = v_id;
+  -- A published item keeps what ops_publish required of it: its photo and at least one destination.
+  if v_pub and (select c.media_id from public.catalog_items c where c.id = v_id) is null then
+    perform public.catalog_invalid('media_id');
+  end if;
+  if v_pub and not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = v_id) then
+    perform public.catalog_invalid('destination_ids');
+  end if;
   return jsonb_build_object('id', v_id, 'affects_site', v_pub);
 end;
 $$;
```

- Surfaces as 409 `invalid` with field `hero_media_id`, `media_id` or `destination_ids` (as a slug change on a
  published row does). The whole save rolls back. Draft rows are not checked (ops_publish checks them).
- No table or row change; the revoke/grant lines are stated again as they were (service_role only).
- **Safe on real rows: yes.** `20261017120000` only replaces two function bodies (`create or replace`); it runs no
  `update`, `insert` or `delete` and changes no table, so applying it cannot change or lose a live row. Its only effect
  is on later saves: a Save of a published row that already lacks its hero photo, photo or destination is refused (409)
  until that is added. Whether such rows exist on live is not known here (this session never reads live); the read-only
  count below answers it.
- **Live database:** the controller applies this migration to the live project at landing, after a second-model check.
  This session does not touch the live project. Before applying, a read-only count on live is worth running:
  published `catalog_items` without `media_id` or without a `catalog_item_destinations` row, and published
  `destinations` without `hero_media_id`. Rows like that are not changed by the migration, but their next Save would be
  refused until the photo or destination is added.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` at `25f99f0` | 0 |
| `npm run tokens:check` at `25f99f0` | theme up to date |
| `node --test tests/*.test.mjs` at `25f99f0` | 1965 tests, 1925 pass, 0 fail, 40 skipped (stack tests skip without a stack) |
| same three at `2c07126` | 0; up to date; 1964 tests, 1924 pass, 0 fail, 40 skipped |
| same three at `f97ff70` | 0; up to date; 1964 tests, 1924 pass, 0 fail, 40 skipped |
| same three at `3bd80f4`, before the merge | 0; up to date; 1934 tests, 1897 pass, 0 fail, 37 skipped |
| (a) stack, 2026-10-17, go 15:23 CET, log `~/.almar-followups-work/run-a.log`, 15:24:44-15:25:45 CET, exit=0 | start 0; reset 0 (6 migrations); types 0 (1426 lines); full `supabase/tests` 7 files, 729 tests, PASS; bite: new pgTAP 10/24 fail, code 1; restored by copy, identical, matches the commit; reset 0, new pgTAP 24/24 PASS; stop 0, status running false |
| (b) first try 2026-10-17 15:37 (`run-b.log`) | void: a zsh string held the Playwright command, every call 127, 0 tests; only the build ran (0) |
| (b) 2026-10-17 15:41 CET to 06:45 CET the next day (`run-b2.log`, on `d2cc6a1`) | dev Back guard 1 failed 3 passed (strict-mode fault, fixed in `31c0ad9`); catalog 64 passed 90 skipped; Select 9 failed 36 passed (chevron spec's open check, fixed in `bd3a053`); bite old edit-page 1 failed 1 passed (not valid); bite old select ar 3 failed 0 passed; build 0; every `next start` spec timed out (harness not in a build; switch removed in `f49fc37`). The Mac slept on battery: step 6 stamped 06:45 the next day |
| (b) dev re-run 2026-10-19 11:23:22-11:24:57 CET (`run-b3.log`, on `4191877`), exit=0, AC power | Back guard 4 passed; Select block 45 passed; bite back-guard.ts before `31c0ad9`: 1 failed, 0 passed; bite edit-page.tsx as on main: 1 failed, 0 passed; bite old select.tsx ar: 3 failed, 0 passed; each file restored by copy, identical, matches the commit; git clean, port 3010 free |
| (c)+(d) one run, 2026-10-19, go 12:51 CET, log `~/.almar-followups-work/run-cd.log`, 12:51:36-12:54:32 CET, exit=0, AC power, on `c4adcad` | (c) `tests/ops-calendar.spec.ts` dev: 44 passed, 63 skipped, 0 failed; bite old `calendar-screen.tsx`, `-g "refused Delete"`: 2 failed, 0 passed; restored by copy, identical, matches the commit; port 3010 free. (d) assemble (local target, fixtures) 0, 69 html, 3 404s; `stay-detail-held.spec.ts` 31 passed, 0 failed; bite hero input, re-assemble 0, `-g "en getsemani-colonial-house @390"`: 1 failed, 0 passed; restored by copy, identical, matches the commit; re-assemble 0; port 8787 free; git clean |
| (d) leftover check | the script's own count of bite inputs left in `out/` was void (zsh globbed `--include=*.html`: "no matches found"); counted again by hand with a quoted grep: 0 files in `out/` and `.open-next`, 0 "bite" in `hero.tsx`. `run-d.sh` line 41 now quotes `--include='*.html'` (checked: prints a count, no glob error) |
| `npx tsc --noEmit`, `npm run tokens:check`, `node --test tests/*.test.mjs` at `a98f0a8` (after the merge of `9b71d59`, which holds `40b5b65`) | tsc 0; theme up to date; 2000 tests, 1958 pass, 0 fail, 42 skipped (`node-suite-10.log`) |
| `next build` with next 15.5.27 | `ALMAR_HARNESS=1 npm run build` 0 in run (b) (2026-10-17); the assembled build runs in (d) and in the controller's landing lane |

All browser runs at `--workers=2`, one lane at a time.

## Not verified

- `database.types.ts` was not regenerated after the merge: main's `20261019120000_owner_emails.sql` only replaces the
  trigger function `handle_new_auth_user` and updates rows, which the generated types do not list; tsc is 0.
- Migration order on live: item 7's `20261017120000` is older than `20261019120000_owner_emails`, which main already
  carries (applied live at about 11:53 for PR #20, per `STATE.md`). Applying item 7 after it is an out-of-order version;
  `supabase db push` would need `--include-all`, the Management API path does not care. The two touch different
  functions. Renaming item 7's version is the controller's call at landing.
- Fix 2 on the build path: a production build drops the harness scenes (03.2-12), so the Back guard is browser-tested in
  dev strict mode only (plus node).
- The node stack tests (`ALMAR_REQUIRE_STACK=1`, e.g. fix 3's lock callers) were not part of run (a); they skip without a stack.
- Fix 2 caveat (documented in `back-guard.ts`): a Next refresh or server action replaces `history.state` without the
  flag; the editors use fetch, so none runs while a page is open. If one did, one Back stays on the page.

## Follow-ups proposed (not in this job)

- A published row's whole Arabic or Spanish translation record sent as null is still deleted by
  `catalog_save_translations` (item 7 does not cover translations).
- `ops_save_stay`: a published stay saved without its hero photo was not in scope; same check likely wanted.
- Deleting a draft destination cascades its `catalog_item_destinations` rows and may leave a published item with no
  destination (not checked).
- `someLeft` in the prompt is obsolete: it went with kit panel B.
- Same bug as item 11 elsewhere: `app/dashboard/(ops)/ops-shell.tsx:243`, the catalog nav chevron, combines
  `rtl:-scale-x-100` with `-rotate-90` / `rotate-90`, so in Arabic it points the wrong way too. Not changed here.
- Item 11 changes Arabic pictures with a Select (e.g. `tests/account-select.spec.ts` `ar-closed.png` / `ar-open.png`,
  Arabic dashboard and contact-form shots): their baselines show the old up chevron and need a re-baseline when
  those suites run.
