# Hand-over: plan 03.2-02 review fixes (round 2)

Branch `gsd/phase-3.2-p02`, worktree `.claude/worktrees/phase-3.2-p02`. Base: `origin/main` `ce796e6`, merged clean (`5a1071a`).

## Commits on top of e9a96c9
- `5a1071a` merge origin/main ce796e6
- `9578460` ops builds from fixtures; anon key checked by value; block-only alt merge; parity cleans its output
- `e145213` anon-key check moved to `lib/data/anon-key.ts` (scratch data trees carry it), no key-like literal
- `ecd07e4` Sonnet review: any three-part value must be an anon JWT; `sb_secret_` any case or quoted; `--keep` after an early failure removes the folders
- plus the docs commit with this file and the SUMMARY section "Review fixes, round 2"

## Checks (own stack, 2026-10-11)
- tsc clean; tokens up to date
- node suite with the stack: 1,482 tests, 1,467 pass, 1 fail, 14 skipped. The fail is main's `tests/ops-api-local.test.mjs`
  (not changed here): `requireStack` calls `supabase status` before taking the stack lock, so it sees "no stack" while a
  parallel file resets. Alone: 11/11 pass. Proposed fix for main (not mine to make): take `acquireStackLock()` before
  `requireStack(t)` in that test.
- pgTAP: 3 files, 634 tests, PASS
- `npm run build` exit 0; assemble ops (empty shell) exit 0; production and preview on the local stack exit 0
- ops specs: plain config 21 passed / 4 skipped; stack config `ops-api` 10 passed
- `parity-build.mjs`: PARITY OK, 588 files, 0 differing; `--against-today`: PARITY OK, A vs C the same 39 stay files
- `tests/build/*.test.mjs`: 272 pass
- Sonnet 5.5 review of the three fix commits: no blocker; both low items fixed in `ecd07e4`

## Before the first production deploy after this lands
In a clean clone of `main`, with exactly the two public names exported (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, live project `jkdkaldgeiowkhlfmsft`) and nothing else ALMAR_* / service-role:

    node scripts/parity-build.mjs --live --keep

Expect `PARITY OK`. `--keep` leaves `out/` and `.open-next/` from the parity run and prints "re-assemble before deploy":
run `node scripts/assemble-cloudflare.mjs --target=production` before any `wrangler deploy`.

## Not done by me
`--live`, deploy, any hosted database or secret. Stack stopped.
