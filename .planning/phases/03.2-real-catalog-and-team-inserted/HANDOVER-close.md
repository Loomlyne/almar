# Phase 3.2 close: hand-over (job 19)

Branch `gsd/phase-3.2-close`, cut from `origin/main` `dc7edae1`. Work session; nothing pushed to `main`, nothing
deployed, no hosted-database read or write.

## What this branch adds

| File | What |
|---|---|
| `03.2-06-SUMMARY.md`, `-07-`, `-08-`, `-12-`, `-13-`, `-15-` | The six missing summaries, written from each plan, its hand-over and its landed commit (`fa5c3b2`, `40b5b65`, `74db046`, `f789937`, `b1cf7ae`, `6dcbabd`) |
| `03.2-14-SUMMARY.md` | Not in v1 (lead's decision 2026-10-05); the three v1.1 items it carries |
| `03.2-VERIFICATION.md` | GSD verifier on `dc7edae1`: 5/5 roadmap criteria pass in code (SC 2 live-data pending); requirements 3/5, 2 partial |
| `03.2-ITEM7-PRECONDITION.sql` | Read-only gate query for migration `20261019130000`, for the controller |
| `components/ops/edit-page.tsx` | Kit fix: Unpublish with unsaved changes asks the kit's existing "Discard changes?" first |
| `tests/ops-kit.spec.ts` | The published-item test now covers Keep editing and Discard on Unpublish; a new test says a clean page asks nothing |
| `tests/journey/scenes/ops-not-live-path.ts`, `ops-coming-soon.tsx`, `tests/ops-coming-soon.spec.ts` | 03.2-08 review nits: one shared `NOT_LIVE_OPS_PATH`, the comment no longer says Home is the only section off |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` (after `npm ci`) | exit 0 |
| `node --test tests/ops-kit.test.mjs tests/ops-back-guard.test.mjs tests/catalog-forms.test.mjs tests/ops-team-journeys-forms.test.mjs` | 138 pass, 0 fail |
| Verifier's own node runs on `dc7edae1` | no-team-names 1/1, data-boundary 5/5, catalog-migration 13/13, ops-stay-forms 17/17, about-page-copy 10/0 |
| Playwright for the changed specs | **Not run.** Asked the controller for a go (ops-kit, ops-coming-soon, and the five screen specs that click Unpublish: ops-destinations, ops-catalog-items, ops-stays, ops-journeys, ops-team). The five screen specs click Unpublish on a clean page only, so they should not change. Run this in the landing lane |
| Full node suite, build, pgTAP, ops Worker parts | Not run (landing lane) |

## Follow-ups from the board

1. **Kit: Unpublish drops unsaved edits without asking** (board known issue, PR #19 review): **fixed** in the kit, so
   every editor gets it (destinations, experiences and services, stays, packages, team). `requestUnpublish()` in
   `edit-page.tsx` asks "Discard changes?" when `dirty`; Discard unpublishes, Keep editing keeps the typing. The other
   half of the board line, "Publish on a clean page", is already safe: `publish()` saves first whenever the page is
   dirty or a translation save is pending (`edit-page.tsx`, `publish()`), and the stay cards (rates, access) reload only
   on a new stay id, so the re-read after Publish keeps their typing. No new strings, no new design: the dialog,
   its title and both buttons are the kit's, in EN/AR/ES.
2. **03.2-08 review nits** (`ops-coming-soon.tsx:41`, `ops-coming-soon.spec.ts:178`): **fixed**, comment and test
   only. Board lines 198 and 235 can be closed when this lands.

## Item 7 (migration `20261019130000_ops_save_publish_rules.sql`)

- Query: `03.2-ITEM7-PRECONDITION.sql`. It runs in a read-only transaction. Part 1 gives the three gate counts (items
  without a destination, items without a photo, destinations without a hero) plus the published total; all three must
  be 0 (decision `2026-10-19-item7-destinations-first.md`). Part 2 lists the items still without a destination, by
  English name. I did not run it.
- If the count is above 0, the owner fixes it: dashboard → Catalog → Experiences and services → open the item →
  Destinations → tick one or more → Save and update site. Repeat for each item part 2 lists (24 on 2026-10-19: 19
  experiences, 5 services, named in the decision file). This works today because the migration is not live yet.
- **Can 3.2 close with item 7 waiting?** Yes, in my view. SC 2 is met in code: `ops_publish` (live) refuses an item
  with no photo or no destination, and `kind`/`unit` are required by the table. What is open is live data: rows the
  import published without going through `ops_publish`, plus a save-time check that is ready on `main`. Record it as
  "3.2 complete; item 7 live after the owner's destinations" instead of holding the phase. That is the controller's
  and owner's call.

## Gaps the verifier found (owner decisions, not built here)

1. **CMS-02 price sort:** no price sort anywhere, neither in the dashboard list nor on the public `/experiences`.
   Phase 3 drew the control and left it for later (`03-11-PLAN.md:90`); no plan picked it up. Owner: build it (in which
   phase), or drop price sort from CMS-02.
2. **STAY-05 guest side:** the pets rule and fee are on the stay editor, but no guest sees them. They are not in
   `api_stays`, anon cannot read them, and no public page shows them. Owner: show them on the stay page (a new view
   column, `lib/data/stays.ts`, and a line in EN/AR/ES; pictures first), or give it to Phase 4's booking step.
3. STAY-03 guest side (refusing a booking when the stay has no rate) is Phase 4 (`04-CONTEXT.md:29`). Not a 3.2 gap.

## Owner UAT

Run after the controller deploys `almar-ops` and `almar` with this branch on `main`. Sign in at
https://dashboard.almarprivatejourney.com. Use one test row per screen named `[UAT] …`, and delete it at the end.
Public pages are built from published rows. A change shows on the public site only after the site rebuild: the
dashboard's header line goes from "Updating since …" to "Up to date · …" if the publish rebuild (`03.2-PUBLISH-RUNBOOK.md`
§3) is set up; otherwise it shows after the controller's next `almar` deploy.

**Destinations** (Catalog → Destinations)
1. Click New, type the name `[UAT] Test place` and a slug, add a hero photo, then Save. Expected: Draft chip; the Arabic
   and Spanish names are filled by the AI.
2. Click Publish. Expected: Published chip. On https://almarprivatejourney.com/destinations, after the rebuild, the card
   is shown in EN, and under `/ar/` and `/es/`.
3. Change one word in the summary, then click Unpublish **without saving**. Expected: "Discard changes?". Click Keep
   editing: the word is still there. Click Unpublish again, then Discard: the chip says Draft and the word is back to
   the saved one.
4. Delete it. Expected: it asks first, then the row is gone.

**Experiences and services** (Catalog → Experiences and services)
5. Click New, choose type Experience and a unit (person / night / trip), add a photo, and tick a destination.
   Publish. Expected: Published. It shows on `/experiences` under that destination's filter.
6. Untick every destination and click Save and update site. Expected: refused with a sentence asking for one
   destination (after item 7 is live; before that, the dashboard already blocks it).
7. Do the same as steps 5 and 6 with type Service. Then Unpublish and Delete.

**Stays** (Catalog → Stays)
8. Open a stay. Change Capacity and Stay rules, add a photo, connect two experiences, and Save. Expected: all of it is
   kept after a reload.
9. Rates card: set a base nightly rate, add a date range with its own rate, and check a span of nights. Expected: each
   night shows the right rate.
10. Availability card: block three days. Expected: they are listed, and they show on Calendar.
11. Access card: write English notes and Save. Expected: Arabic and Spanish are filled, and the notes are kept after a
    reload. The notes are never on the public stay page.
12. Publish or Unpublish the stay. Expected: `/private-stays` and `/private-stays/<slug>` follow after the rebuild.

**Packages** (Catalog → Packages)
13. Move a journey up, edit its text, and Save and update site. Expected: the home page journeys follow the order and
    the text. There is no New and no Delete (owner decision C-15).

**Team** (Content → Team)
14. Click New, add a name, role, photo and one link, then Publish. Expected: it shows on `/about` in the Team section;
    no fake people (Ana Velásquez, Mateo Ríos, Sofía Marín) are there.
15. Unpublish. Expected: it is gone from `/about` after the rebuild. Then Delete.

**Media** (Content → Media)
16. Upload one image and type its alt text in English. Expected: Arabic and Spanish alt are filled, and the image can be
    picked in a stay's Photos. A photo in use cannot be deleted; the page says why.

**Calendar**
17. Block dates on Calendar for one stay, and for all stays. Expected: the month grid shows them in Dubai days, Monday
    first. Delete one block and it is gone.

**Every screen**
18. Switch the dashboard to Arabic. Expected: mirrored layout, square corners, teal primary buttons, gold only as
    lines. Every button on these screens does something; the Soon pages (Pages, Blog, Legal, Navigation) have no
    controls.

## Not verified

- Any Playwright run of the changed specs (waiting on the controller's go).
- Anything on the live dashboard signed in (STATE 2026-10-20 08:06: signed-in screens not checked).
- The item 7 count on live today.
- Whether the publish rebuild (runbook §3) is set up. That decides whether UAT steps 2, 5, 12, 13, 14 and 15 show
  within minutes or only after the next `almar` deploy.

## Proposed lines (controller writes them on landing)

`ROADMAP.md`, phase list:
`- [x] **Phase 3.2: Real catalog and team** (INSERTED, moved after Phase 2) - The data layer swaps fixtures for Supabase; dashboard Catalog and Team built already wired (14/15 plans landed, 03.2-14 not in v1; verified 2026-10-21; item 7 live after the owner's destinations)`

`ROADMAP.md`, Phase 3.2 section: replace `**Plans:** TBD` with `**Plans:** 15 (01–13, 15 landed; 14 not in v1). Verification: 03.2-VERIFICATION.md. Open: CMS-02 price sort and STAY-05 guest side (owner decision).`

`ROADMAP.md`, progress table:
`| 3.2 Real catalog and team | 14/15 | Complete (14 not in v1; item 7 live pending) | 2026-10-21 |`

`STATE.md`, new top entry (time from `date` at landing):
`**<date> CET:** **Phase 3.2 closed** as `main` `<sha>` (job 19, `gsd/phase-3.2-close`): six summaries + 03.2-14 note, 03.2-VERIFICATION.md (5/5 criteria in code; CMS-02 price sort and STAY-05 guest side to the owner), kit Unpublish asks "Discard changes?" when there are unsaved edits, 03.2-08 nits fixed. Item 7 waits for 0 published items without a destination (03.2-ITEM7-PRECONDITION.sql). Owner UAT: HANDOVER-close.md.`
