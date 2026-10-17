# Hand-over: phase 1–3 follow-ups (DRAFT)

**Status: DRAFT, written 2026-10-17 14:31 CET, updated 14:42 CET after the merge of `origin/main` `82b66bf` and 14:53 CET with item 11 (main `5ade3df` merged in `4ccd821`).** Four runs are still pending: they wait for the controller's "go".
This file is completed and committed again after those runs.

- Job: `.planning/prompts/15-followups-phases-1-3.md`
- Branch: `fix/phase-1-3-followups` (worktree `.claude/worktrees/compassionate-dubinsky-66be64`, local branch
  `claude/compassionate-dubinsky-66be64`), cut from `origin/main` `bfc3326`; `origin/main` `deb3bda` merged in `ef28ffc`;
  `origin/main` `82b66bf` (PR #18, 03.2-06 catalog, landed as `fa5c3b2`) merged in `f97ff70` with no conflicts.
- Code tip at draft time: `99bc83b` (item 10, last). Merges: `f97ff70` (`82b66bf`), `4ccd821` (`5ade3df`). This file's
  commits sit on top; the final commit is named in the final version.
- Item 10 stays last: item 11 came after item 10 was pushed, so `309383d` reverts item 10, `04d93fd` is item 11, and
  `99bc83b` applies item 10 again by cherry-pick of `3bd80f4` (package files identical to `3bd80f4`). No force-push.
- PR #18 and item 2: 06's destination and catalog-item editors mount `EditPage` with the same props; they open and close
  it through React state only (no URL change, no `router.refresh`, no server action), so the back-guard flag is not
  dropped there. PR #18 changes neither `edit-page.tsx` nor any migration. Its specs join run (b).
- Nothing pushed to `main`, no PR, no deploy, nothing run against the live Supabase project.

## Items (one commit each, oldest first)

| Item | Commit | What changed | Failing-first proof (bite from a backup copy, restored by copy) |
|---|---|---|---|
| 1 | `e283641` | The 02-06 site-rebuild seam is gone: `lib/settings/site-rebuild.ts` deleted; `postSettings({ owner, body })` answers `{ ok: true, affects_site }` and the 03.2-05 opsPost `afterWrite` requests the site update. | old handlers: 2 fail |
| 2 | `e9c4986`, `715f8ee` | Editor Back guard (`components/ops/back-guard.ts`, new, pure): the guard entry is flagged on `history.state` (`__almarEditTrap`), not by address and history length; closing or saving takes no history step; a watcher steps past a spare entry. `edit-page.tsx`: no prop or section API change. `playwright.config.ts`: `PW_NEXT=start` runs the browser specs on `next start`. | step at release 4, arm always pushes 1, no Back-past-spare rule 1, no step-off-spare rule 2, no step wait 1, address+length mark 1, old edit-page 1 |
| 3 | `0b1c8b6` | Stack tests take the stack lock before they look for the stack (`lockStack(t)` in `tests/helpers/local-supabase.mjs`); six callers moved. | look-first 1, old helper 1 |
| 5 | `1db1b3d` | A valid public session without the `almar-signed-in` hint gets it back (`needsSignedInHint` in `lib/account-preferences.ts`, set in `middleware.ts`); not on the ops host, not on `/auth*`, GET/HEAD only. | old middleware 3; /auth, POST and ops rules 2 each |
| 9 | `11d589b` | Calendar: a refused Delete's sentence goes on a month change and on a successful add; visibilitychange today spec added. | **pending (c)** |
| 8 | `d4a9e49` | Held stay spec counts text fields with the same selector as the footer check (`TEXT_FIELD`). | **pending (d)** |
| 4 | `560437b` | `worker/handle.mjs` passes `request.signal` into the rebuilt Request, so the visitor's abort reaches Next. | old handle: 1 fail |
| 7 | `d36bc47` | Migration `20261017120000_ops_save_publish_rules.sql` (see below) + pgTAP `supabase/tests/ops_save_publish_rules.test.sql` (24 asserts) + static node test `tests/ops-save-publish-rules-migration.test.mjs`. | static: no hero check 2 fail, no item photo check 2 fail, hero check before the translations save 1 fail. pgTAP: **pending (a)** |
| 11 | `04d93fd` | `components/ui/select.tsx`: the chevron span loses `rtl:-scale-x-100`. CSS runs scale before rotate, so with `rotate-90` the closed chevron pointed up in Arabic (and down when open). Spec in `tests/ui/primitives.spec.ts` (Select block, every locale and width): computed translate, rotate, scale and transform from the trigger to the svg; closed down, open up, closed down again. | **pending (b)**: the old `select.tsx` (backup copy) must fail it in `ar` |
| 10 | `99bc83b` (last; first pushed as `3bd80f4`) | `next` 15.5.27 exact (Dependabot #38–#41). Lockfile changes only `next`, `@next/env`, `@next/swc-*`. The `overrides` block (`next` → `postcss: "$postcss"`) pins no next version and is unchanged. `tests/phase-02-gates.test.mjs` pinned next exactly to 15.5.26; it now pins 15.5.27. | the old pin failed against the bump (1 fail), as expected |
| 6 | — | `database.types.ts` refresh. | **pending (a)**, needs the stack |

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
- **Live database:** the controller applies this migration to the live project at landing, after a second-model check.
  This session does not touch the live project. Before applying, a read-only count on live is worth running:
  published `catalog_items` without `media_id` or without a `catalog_item_destinations` row, and published
  `destinations` without `hero_media_id`. Rows like that are not changed by the migration, but their next Save would be
  refused until the photo or destination is added.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` at `99bc83b` | 0 |
| `npm run tokens:check` at `99bc83b` | theme up to date |
| `node --test tests/*.test.mjs` at `99bc83b` | 1964 tests, 1924 pass, 0 fail, 40 skipped (stack tests skip without a stack) |
| same three at `f97ff70` | 0; up to date; 1964 tests, 1924 pass, 0 fail, 40 skipped |
| same three at `3bd80f4`, before the merge | 0; up to date; 1934 tests, 1897 pass, 0 fail, 37 skipped |
| (a) stack: item 6 `database.types.ts`, item 7 pgTAP (new file + full `supabase/tests`), bite (check removed from a copy must fail the new pgTAP) | **pending, needs go** |
| (b) dev: `tests/ops-kit.spec.ts` "Back guard" (4 specs), `tests/ops-catalog-items.spec.ts`, `tests/ops-destinations.spec.ts` (06's editors on the new back-guard); `tests/ui/primitives.spec.ts` Select block (item 11, with its bite); then a build with the harness flag and `PW_NEXT=start`, same files | **pending, needs go** |
| (c) dev: `tests/ops-calendar.spec.ts` (item 9) + bite (old `calendar-screen.tsx` must fail the refused-Delete specs) | **pending, needs go** |
| (d) build lane: `tests/build/stay-detail/stay-detail-held.spec.ts` (item 8) + bite (a real text input outside the footer must fail) | **pending, needs go** |
| `next build` with next 15.5.27 | **pending**: runs in (b) and in the controller's landing lane |

All browser runs at `--workers=2`, one lane at a time.

## Not verified

- Every browser spec and the build (runs b, c, d above); item 7's pgTAP and item 6 (run a).
- Fix 2 in a real browser under React strict mode and in the build: proved only on a fake tab (10 node tests) so far.
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
