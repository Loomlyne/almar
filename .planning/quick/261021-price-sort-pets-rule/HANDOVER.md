# Job 22 hand-over: price sort (CMS-02) and pets rule (STAY-05)

Branch `gsd/price-sort-pets-rule` from `origin/main` 39546d56. No push to main, no deploy, no hosted database.

## CMS-02 price sort
- `lib/data/catalog-filter.ts`: `PriceSort`, `parsePriceSort`, `sortByPrice` (unpriced items last in both directions, ties keep position order); `?sort=price_asc|price_desc` in `parseCatalogQuery` / `toCatalogQuery`.
- Public `/experiences`: `CatalogState.sort`, a kit Select (values `position|price_asc|price_desc`, no empty value) in the rail and the compact toolbar, `price_aed` passed to the browser item. No price number is drawn on cards.
- Dashboard Experiences & services list: same Select in the filter row (`catalog-items-view.tsx`), `filterCatalogRows` sorts by `price`; reorder is off while a sort is on.
- Labels EN/AR/ES: `lib/copy/experiences-page.ts` (`sort`), `lib/copy/ops-catalog.ts` (`sortPosition/sortLow/sortHigh`). AR/ES are drafts for the owner's review.

## STAY-05 pets rule
- Migration `supabase/migrations/20261021120000_stay_pets_rule_public.sql`: grants `stays.pets_rule`, `pets_fee_aed` to anon and appends them to `api_stays` (view otherwise verbatim). **NOT applied; the controller applies it before the build bakes live rows.** Decision for the controller: the fee amount becomes public (it is the owner-typed flat fee, not a nightly rate; `nightly_rate_aed` stays null in the view).
- `lib/data/stays.ts` + `types.ts`: `pets_rule`, `pets_fee_aed` on `Stay` (absent in fixtures/old reads = not set).
- Stay page: a "Pets" fact in the existing facts row (`stay-detail-page.tsx`, `petsText`); shown only when a rule is set (a fee rule with no fee shows nothing). Copy `lib/copy/stay-detail.ts` EN/AR/ES (AR/ES drafted).
- No fixture values were invented: until the owner sets rules in the dashboard and the build re-bakes, no stay shows the fact.

## Checks
- `npx tsc --noEmit`: pass. `npm run tokens:check`: pass ("theme up to date"). (node_modules borrowed by symlink from another worktree, removed after.)
- Everything else: not run (owner: no test). Unrun test added: `tests/catalog-price-sort.test.mjs`. Scene file `tests/journey/scenes/ops-catalog-items.tsx` updated for the new `price` / `sort` fields. Copy tests that pin `stay-detail` / `experiences-page` key sets may need the new keys (`pets`, `sort`).
- Not verified: rendering, RTL layout of the new Select, the migration against Postgres, job 21 merge (I touched no route folders; `components/pages/experiences-page.tsx` got one line).
