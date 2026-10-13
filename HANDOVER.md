# HANDOVER: job 03.2-02b (fix-up for the 03.2-02 review, PR #7 verdict "fix first")

Branch `fix/3.2-02b-live-build-guards`, cut from `origin/main` `9572732`, merged with `origin/main` `9235f86` (planning note only, no conflict).
No migration, no change to the database, Cloudflare, Stripe or Resend. No push to `main`, no PR, no deploy.

## Per finding

1. **Medium, preview/production accept any URL: fixed.** `scripts/assemble-cloudflare.mjs`: new `LIVE_SUPABASE_HOST` (`jkdkaldgeiowkhlfmsft.supabase.co`) and `assertLiveSupabaseUrl`; `dataSourceFor` calls it for `--target=preview` and `production` (not `local`, not `ops`) after the anon-key check. Required: `https:`, that exact host, no port, no credentials, no path, query or hash. The message names the variable and the expected host, never the value given. Because `dataSourceFor` runs first in `main()`, a refused run builds and removes nothing.
   *Not done in `lib/data/source.ts`:* `source.ts` does not know the target, and the parity and rebuild tests must read the local stack through it with `--target=local`. The assembler is the only path that produces `out*/` and the Worker, so the pin lives there. Say if you also want a target-aware check in `source.ts`.
   Tests (`tests/data-source.test.mjs`): `assertLiveSupabaseUrl` accepts the live origin and refuses 14 look-alikes (local stack, `localhost`, http, another project, suffix and `@` tricks, port, credentials, path, query, bare host, junk, empty); `dataSourceFor('preview'|'production')` refuses the local stack, another project and http; `local` still accepts the local stack. Existing tests that used `example-project.invalid` or `http://127.0.0.1:1` for preview/production now use the live URL (`tests/data-source.test.mjs`, `tests/assemble-target.test.mjs`, `tests/anon-key.test.mjs`).
2. **Medium, no snapshot check: fixed.** `lib/data/source.ts`: `readAll` reads `api_site_version.requested_seq` before the first view and after the last; a different value throws `api_site_version: requested_seq moved from A to B …`. A missing view, an error, no row or a null value also throws. Compared as strings, so a bigint-as-string is safe. Tests: read first and last (twice, `select("requested_seq")`), moved 7→8 fails, unchanged loads, string values compare exactly, error / empty / null fail. Call-count tests now expect views + 2.
   *Not covered (said in the review too):* each Next build process takes its own snapshot, so a publish between two processes' reads is not caught here. That is 03.2-05's `build-live.mjs` (a before/after read around the whole build); the review already wrote it into 03.2-05.
3. **Low-medium, only stays checked for emptiness: fixed.** `source.ts`: `api_stays`, `api_catalog`, `api_journey_tiers` and `api_destinations` must have a row, else `<view>: no published rows (…)`. Team stays allowed empty. Tests: one per added view; the old "other views may be empty" test now covers only team and the translation views.
4. **Low, missing alt becomes `alt=""` or English: fixed at build time.** `source.ts` `assertAltTexts`: every image (`id` + `media_key`) inside the database-read stays, destinations, catalogue, team and journey tiers needs a non-blank alt in en, ar and es in the merged alt list; otherwise the build fails naming up to 10 `id (locale)` pairs. A blank alt counts as missing. `resolveImage` is unchanged (it is also used by fixtures mode and by the block images that stay in fixtures). Pictures of the fixture-kept page blocks are not checked (their alts come from the reviewed fixtures; all 173 fixture images have en/ar/es). Tests: all three present loads; each of en/ar/es missing fails naming picture and language; blank counts as missing for each of the five entity views.
5. **Low, Flight row order: accepted by the controller, no change.** `--strict` stays out of the deploy gate.
6. **Nit, docs: fixed.** `README.md` now says preview and production need both names and the live URL, and `--target=ops` reads fixtures and needs neither. Same correction in the `lib/data/source.ts` header comment (it said "every assembled target"). `02-RUNTIME-DEPLOY.md` sections 1 and 3 already speak only of preview and production, so unchanged. Test: README text check plus `dataSourceFor("ops", {})`.

## What I ran

| Run | Result |
|---|---|
| `npm ci` | exit 0 |
| `node --test tests/data-source.test.mjs tests/anon-key.test.mjs tests/assemble-target.test.mjs` | 81 pass, 0 fail |
| Same data-source tests with the fix reverted (`git apply -R`) | file fails to load (new exports missing), so the new tests fail without the fix |
| Local stack (`tests/helpers/local-supabase.mjs start`, colima) then `ALMAR_REQUIRE_STACK=1 node --test tests/data-parity.test.mjs tests/import-catalog.test.mjs` | 23 pass, 0 fail, 0 skipped: the real views, `api_site_version` read, and the three-language alt check pass on the imported live-shaped catalogue |
| `node --test tests/*.test.mjs` (stack up, after merging `origin/main`) | 1,599 tests: 1,582 pass, 0 fail, 17 skipped (the "route deleted, skipped" cases) |
| `npx tsc --noEmit` | no output |
| `ALMAR_REBUILD_PROOF=1 ALMAR_REQUIRE_STACK=1 node --test tests/rebuild-fresh.test.mjs` (two real `next build`s, `--target=local`, local stack, new checks active) | 1 pass, 0 fail |

## Not checked

- Playwright (`playwright test`) and the build shards: nothing here touches page output. `scripts/parity-build.mjs` (full A/B build parity) was not run.
- No real `--target=preview|production` assemble (it needs the live URL and key in a shell; secrets stay out of this session). The pin is tested as a function and by the order test in `main()`, not by a real run.
- The cross-process publish race (finding 2, see above).
- Local stack left running for this worktree; the controller can `node tests/helpers/local-supabase.mjs stop`.
