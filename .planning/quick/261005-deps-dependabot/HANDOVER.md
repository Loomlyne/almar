# deps-dependabot hand-over: the 4 open Dependabot alerts (postcss)

Work session, 2026-10-05 11:36–about 14:44 +04 (the session ended without finishing this file; the Mac restarted at 15:21) (Opus 5.5, inline, no sub-agents). Prompt: the owner's message in this
session (no prompt file). Not a GSD plan; quick folder only.

## Branch

- Branch `gsd/deps-dependabot`, cut from `origin/main` `a7a8c70`. `origin/main` moved to `01d9304` (job 02)
  during the checks; merged in as `d130211` (no conflict: job 02 does not touch `package.json` or
  `package-lock.json`).
- Code commit: `6d7b463` (`fix(deps): override Next's pinned postcss 8.4.31 with root postcss 8.5.28`).
- Final checked commit: `d130211`. After it, one planning-only commit: this file.
- `git diff origin/main` on the final commit = `package.json` (+5) and `package-lock.json` (−28), nothing else.
- Folder `.claude/worktrees/deps-dependabot` clean after the last commit; `.next/`, `.open-next/`, `out/`,
  `test-results/` and `node_modules/` are ignored and left for the controller's clean-up.

## Alerts before and after

GitHub, open on `main` at 11:36 (all four are the same package, `postcss`, transitive, runtime scope,
manifest `package-lock.json`):

| # | Advisory | Severity | Vulnerable | First fixed |
|---|---|---|---|---|
| 24 | GHSA-r28c-9q8g-f849, path traversal in source-map auto-loading | high | <= 8.5.17 | 8.5.18 |
| 23 | GHSA-6g55-p6wh-862q, arbitrary file read via `sourceMappingURL` | high | <= 8.5.11 | 8.5.12 |
| 25 | GHSA-fxqj-rqcc-2cmp, incomplete fix of the one above | moderate | <= 8.5.22 | 8.5.23 |
| 6 | GHSA-qx2v-qp2m-jg93, XSS via unescaped `</style>` in stringify | moderate | < 8.5.10 | 8.5.10 |

The only vulnerable copy was `node_modules/next/node_modules/postcss` **8.4.31**. Next pins it exactly
(`"postcss": "8.4.31"`) in every 15.5.x release, including the newest backport `15.5.27`; only Next 16
(`16.3.8`, a major) moves to 8.5.23. The root `postcss` (8.5.28, used by `@tailwindcss/postcss`) was already
safe. So a Next patch bump cannot fix it, and Dependabot cannot open a PR for it.

After, on this branch: `npm audit` **0** (before, on `origin/main`'s lockfile: 2 = high `postcss`, moderate
`next` "via postcss"). One `postcss` in the tree: `npm ls postcss --all` shows `next@15.5.26 → postcss@8.5.28
deduped`; `require.resolve("postcss")` from inside `next` lands on the root 8.5.28. GitHub closes the four
alerts only when `main` carries the fix: **not verifiable before landing**.

Exposure, for the record: Next loads `postcss` only at build time (webpack CSS pipeline,
`next/dist/build/webpack/config/blocks/css`, `resolve-url-loader`) over our own CSS. The Worker never ships it.

## What changed

- `package.json`: `"overrides": { "next": { "postcss": "$postcss" } }`, i.e. Next uses the root's exact
  `postcss` 8.5.28. Nothing else moved: Next 15.5.26, React 18.3, Tailwind 4.3.3, `@tailwindcss/postcss`
  4.3.3, `@opennextjs/cloudflare` 1.20.6, wrangler 4.146.0.
- `package-lock.json`: the `node_modules/next/node_modules/postcss` 8.4.31 entry removed (28 lines). npm
  11.19 did not apply the new override to an existing lock entry on `npm install`; the entry had to be
  dropped and `npm install` rerun. `npm ci` from the resulting lockfile is clean (455 packages, 0
  vulnerabilities).
- When the project moves to Next 16, delete the override (Next 16 ships 8.5.23+).

## Checks on `d130211` (final)

Not recorded by the work session. The controller checks the landing candidate in a clean clone (board, 2026-10-05).

## Checks on `6d7b463` (before the job 02 merge)

Not recorded by the work session.

## Not verified

- GitHub alert closure: happens only after `main` has the fix.
- The default Playwright config (`playwright.config.ts`, `next dev`): not run; the prompt named the build
  config only.
- No deploy, no live probe (nothing on the live site changes until a deploy; the build output is what the
  build Playwright run served).

## Shared files and other branches

`package.json` and `package-lock.json` are on the shared-file list. Merge test (`git merge-tree`) of this branch
against every open branch at 13:3x: `gsd/phase-02-auth-chain`, `gsd/phase-3.3-i18n-review`,
`gsd/phase-3.3-i18n-fix` clean. `gsd/phase-3.2-p11-ops-kit` conflicts in `tests/data-boundary.test.mjs` and
`claude/project-thread-8h6bed` (the ended cloud project) in `package.json` / `package-lock.json`, but both
conflicts already exist against `origin/main`; this branch adds none.

## Proposed board / state change (controller applies)

- CONTROL-BOARD: "deps-dependabot — postcss override (`overrides.next.postcss = $postcss`), 4 Dependabot
  alerts (#6, #23, #24, #25) closed on landing; remove the override at Next 16." No deploy needed for the alerts;
  the next normal deploy carries it.

## Owner test steps (after landing)

1. Open https://github.com/Loomlyne/almar/security/dependabot → expected: **0 open** alerts; #6, #23, #24, #25
   listed as fixed.
2. Nothing to click on the site: the change is build-time only.

## Lessons

Not recorded by the work session.
