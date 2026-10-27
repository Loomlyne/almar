# 06-01 summary: schema, data contracts, translation lock

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-27, from the `date` at each step. Lead: Opus 5.5.
The migration was written by a `worker-deep` (Opus) agent. Reviews: Sonnet, picked by `jev-review`.

## Signature
Pictures: `pictures/06-01/index.html` at `6fc08bb3`. Signed by the owner 2026-10-27 22:41 +0100, in the controller's
question form: "Approve as drawn" for the five lock states and "Approve drafts" for the five AR/ES lines. Record:
`decisions/2026-10-27-06-01-pictures-signed.md` on main. The pictures are one hand-drawn HTML page with real tokens
(owner rule: no Playwright run, so no PNG shoot). The plan's `tests/ops-translation-lock-pictures.spec.ts` and the
`ops-kit.tsx` scenes were not written.

## What landed on the branch
| Commit | Task |
|---|---|
| `6fc08bb3` | 1: lock pictures (5 states × EN/AR/ES × 390/834/1440) |
| `c23cd3e8` | 4: `page-sections.ts`, `page-blocks.ts`, readers on the views, `site-requests/types.ts`, `site-cms-api.ts`, api-types, `parsePublish` + post/legal_page, `import-site-content.mjs`, 3 node tests + helper |
| `00939cfc` | 1/4: lock copy EN/AR/ES (slot granted); `import-catalog.mjs` exports `applyImport` (no behaviour change, slot granted) |
| `e24155d7` | 3: migration `20261025120000_site_cms.sql` (~3,250 lines) + `supabase/tests/site_cms.test.sql` (plan 225); `catalog_schema.test.sql` follows F-02 |
| `b69a6e08` | 3: review answers (slug format → `almar:invalid`), `ops_list_media` returns `alt_locked` |
| `ee17c151` | 5–6: the lock in the kit, the validators and every editor |
| `eaec4c04` | kit review answers (locks read back, lock-only dirty, blank unlocks, focus, stale reply) |

## Choices the plan left open
- **Page-section list:** a new `ops_list_page(p_page)` (not `ops_list('page_section:<page>')`). It returns
  `{page, sections: [section detail + items]}`.
- **Slot list in SQL:** a helper, `page_section_slots()`, read by `ops_save_page_section` and the list/get functions.
  It is the SQL copy of `MEDIA_SLOTS`.
- **Request name and email:** sent inside `payload` (required) and copied into the `site_requests` columns.
- **`ops_list_media` replaced as well** (not in the plan's list): it adds `alt_locked` so the Media editor reloads the
  lock it saved. The same signature, order and paging.
- **Screens added to Task 6 beyond the plan's list:**
  - stays: `stay-forms.ts`, `stays-screen.tsx`, `stay-editor.tsx`, `access-notes.ts`;
  - media: `media-screen.tsx`, `components/ops/media-alt.ts`, `media-types.ts`, `lib/ops/media-upload.ts`;
  - `journey-forms.ts`, `team-forms.ts`;
  - the two views that render `EditPage`: `destinations-view.tsx` and `catalog-items-view.tsx`;
  - four journey scenes (type only).
- **`calendar-view.tsx` not touched:** it has no translated fields.
- **Supabase mode reads no fixture file.** In `source.ts`, `BLOCK_FIXTURES`, `blockImageIds` and the fixture alt merge
  are gone. `tests/data-source.test.mjs` is updated to match.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass, on `eaec4c04` (after merging `origin/main` at `97a68aaa`) |
| `npm run tokens:check` | pass ("theme up to date") |
| node tests, pgTAP, build, Playwright, `import-site-content.mjs` dry run | **not run (owner: no test)** |

Written and not run:
- node: `tests/site-cms-import.test.mjs`, `tests/page-blocks.test.mjs`, `tests/data-source-site-cms.test.mjs`,
  `tests/ops-translation-lock.test.mjs`, plus the new cases in `tests/ops-kit.test.mjs` and `tests/data-source.test.mjs`;
- pgTAP: `supabase/tests/site_cms.test.sql`;
- helper: `tests/helpers/site-cms-views.mjs`.

## Reviews
- **Migration (Sonnet, deep tier per `jev-review`): verdict ship.** Fixed: raw-error slugs, and the stale header
  reference. Open (HANDOVER):
  - `consult_slots` cost on the public path;
  - anon can read the uuids of unpublished stays through the base-table grants;
  - unpublished seeded journeys are now deletable;
  - `ops_save_consult` `::int` casts;
  - `ops_list('journey_tier')` has no legs;
  - pgTAP gaps.
- The jev tier also calls for **Fable** as the second pass. That needs the owner's yes, which has not been asked here.
- **Kit and screens (Sonnet): verdict fix first.** All seven findings answered in `eaec4c04`; list in HANDOVER.
