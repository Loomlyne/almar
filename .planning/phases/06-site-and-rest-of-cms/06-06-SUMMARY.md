# 06-06 summary: packages (public page, request form, home card, dashboard editor)

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-30, from `date`. Lead: Opus 5.5; built by a `worker-deep` (Opus) agent. Review: Sonnet. Fable: one pass on the whole Phase 6 PR, by the controller.

## Signature
`pictures/06-06/index.html`, signed 2026-10-30 (`decisions/2026-10-30-06-06-pictures-signed.md`): `/<locale>/journeys/<slug>`; heading plus "See this journey" on the home card; cities as square boxes, all ticked; form full width after the route and Included; Delete in the editor under Settings; the existing Included words. Price hint and "Phone / WhatsApp" as the owner wrote them.

## What landed
| Commit | What |
|---|---|
| `670ab183` | copy, `PackageView`, `JourneyLegs`, `JourneyAddons`, home card |
| `7971b6d3` | parser, editor, data reader, package request, form, node tests |
| `13b1a294` | routes, route-kinds, locale-path, expected-public-paths, pins, specs |
| `bdb1eb3d`, `29f5c468` | granted slots: `[journey]` enumerator, build specs, node test pins |
| latest `fix(06-06)` | Sonnet's findings |

The first two commits do not compile alone; `tsc` holds from `13b1a294`.

## Deviations
- Outside the plan's list: `app/dashboard/(ops)/catalog/packages/journey-addons.tsx` (the kit's `ConnectPicker` draws Connected the other way round), `tests/package-view-render.test.mjs`, `scripts/expected-public-paths.mjs`; `components/pages/home/home-journeys.tsx` and its scene (edited before a slot; the controller confirmed them).
- **Signed page not followed, real or shared part kept:** status line instead of a Settings switch (the kit's Publish/Unpublish does it); `LockedAddress` for the read-only address; `ConfirmDialog`'s outlined danger button; Draft chip hidden on a new package; home heading stays `text-heading`, kicker tracking stays the token; real `PublicFrame`; 44px fields and native date inputs, as 06-05.
- Words not on the signed page: `waMessage` AR and ES (drafts); `legsFull` "Up to six cities." in three languages (with the owner); email labels "Package name:" and "Page:". Unused from the table: `price`, `dest2`, `slugPh`.
- Plan changes: `leg_<k>` for `leg.<key>.nights_label` (the translate route refuses dots); `tier.href` for `hrefFor(slug)`; `buildPackageAskMessage` in `lib/site-requests/package.ts`; leg shaping in `catalog-handlers`; error key `cities`; no no-JS fallback on the form (as 06-05); the editor stops at 6 cities, the parser at 12.
- Destination names are capped at 120 (was 160): each is a ticked city on the form, and `cities` caps at 120.

## Checks
`npx tsc --noEmit` and `npm run tokens:check` pass. Node tests, pgTAP, build, Playwright: **not run (owner: no test)**. Nothing has been seen in a browser; the city boxes have no browser test at all, because fixtures have no legs. No migration change.
