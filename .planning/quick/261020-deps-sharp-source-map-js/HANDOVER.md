# deps-sharp-source-map-js hand-over: Dependabot #43 (sharp) and #42 (source-map-js)

Work session, 2026-10-20; checks at 08:25, hand-over written at 08:27 (machine clock `date`, which reads +0100
today) (Opus 5.5, inline, no sub-agents). Started by the controller `local_2a268540-…`; not a GSD plan, quick folder only.

## Branch

- Worktree `.claude/worktrees/inspiring-merkle-42b23d` (app-made), local branch `claude/inspiring-merkle-42b23d`,
  pushed as **`fix/deps-sharp-source-map-js`** (the prompt named no branch; `fix/<slug>` per the common rules).
- Cut from `origin/main` `82e0273b`; `origin/main` had not moved at commit time (0 commits ahead), so no merge.
- Code commit and final checked commit: **`0e5a2999`** `fix(deps): sharp 0.35.5 and source-map-js 1.2.2
  (Dependabot #43, #42)`. After it, one planning-only commit: this file.
- `git diff origin/main` on `0e5a2999` = `package.json` (+2 −1) and `package-lock.json` (+121 −121), nothing else.
- Folder clean after the last commit. `node_modules/` and `test-results/node-suite.log` are ignored and left for
  the controller's clean-up.

## Alerts before and after

GitHub, open on `main` at 08:25 (`gh api …/dependabot/alerts`), both runtime, manifest `package-lock.json`:

| # | Package | Advisory | Vulnerable | First fixed | Before | After |
|---|---|---|---|---|---|---|
| 43 | `sharp` | GHSA-wq5f-xc86-pv6w (librsvg CVE-2026-96889) | < 0.35.5 | 0.35.5 | 0.35.4 | **0.35.5** |
| 42 | `source-map-js` | GHSA-68fv-2mgg-jv7q (event-loop DoS) | >= 1.0.0 < 1.2.2 | 1.2.2 | 1.2.1 | **1.2.2** |

`npm audit`: `origin/main`'s lockfile **4 high** (`sharp`, `source-map-js`, plus `miniflare` and `wrangler` only
"via sharp"); this branch **0**. GitHub closes the two alerts only when `main` carries the fix: **not
verifiable before landing**.

## Who pulls each package in, and why the change has this shape

- `sharp`: one copy, deduped. `wrangler@4.146.0 → miniflare@5.20261001.0-alpha` pins it **exactly**
  (`"sharp": "0.35.4"`); `next@15.5.27` lists it as optional `^0.34.3 || ^0.35.4`. Because miniflare pins an
  exact old version, a root override is the only way short of a wrangler bump: `"overrides": { "sharp":
  "^0.35.5" }`. The caret keeps it inside 0.35.x, which next already accepts; the lockfile holds the exact 0.35.5.
- `source-map-js`: `postcss@8.5.28` and `@tailwindcss/node@4.3.3` both ask `^1.2.1`, so 1.2.2 fits; no override,
  lockfile bump only (`npm update source-map-js`).
- No project code imports `sharp`. It is loaded by miniflare (local `wrangler dev`) and by Next's image
  optimizer; the Worker never ships it.

## Lockfile diff summary (`package-lock.json`, 28 entries changed, 0 added, 0 removed)

| Package(s) | From | To |
|---|---|---|
| `sharp` | 0.35.4 | 0.35.5 |
| `@img/sharp-{darwin-arm64, darwin-x64, freebsd-wasm32, linux-arm, linux-arm64, linux-ppc64, linux-riscv64, linux-s390x, linux-x64, linuxmusl-arm64, linuxmusl-x64, wasm32, webcontainers-wasm32, win32-arm64, win32-ia32, win32-x64}` (16) | 0.35.4 | 0.35.5 |
| `@img/sharp-libvips-{darwin-arm64, darwin-x64, linux-arm, linux-arm64, linux-ppc64, linux-riscv64, linux-s390x, linux-x64, linuxmusl-arm64, linuxmusl-x64}` (10) | 1.3.3 | 1.3.4 (the bundled librsvg fix) |
| `source-map-js` | 1.2.1 | 1.2.2 |

Every other entry is byte-identical (compared entry by entry against `origin/main`'s lockfile). Next 15.5.27,
wrangler 4.146.0, miniflare, postcss 8.5.28, Tailwind 4.3.3 unchanged. `sharp`'s runtime reports
`sharp 0.35.5`, `vips 8.18.7`, `rsvg 2.63.2` after `npm ci`.

## Checks on `0e5a2999` (working tree identical to the commit; Node 26.7.0, npm 11.19.0)

| Check | Result |
|---|---|
| `npm ci` | pass, 455 packages (same count as before) |
| `npm ls sharp source-map-js --all` | `sharp@0.35.5` (next; miniflare deduped), `source-map-js@1.2.2` (postcss; @tailwindcss/node deduped) |
| `npx tsc --noEmit` | pass, exit 0 |
| `node --test tests/*.test.mjs` | pass: 2,054 tests, 2,007 pass, 0 fail, 0 cancelled, 47 skipped, exit 0 |
| `npm run tokens:check` | pass, "theme up to date" |
| `npm audit` | 0 vulnerabilities (before: 4 high) |

## Not verified

- `npm run build`, the assemble scripts and Playwright: slot runs, not started (no controller go). The fix is a
  patch bump of a native image library that no project code calls, so the landing lane's build is the check.
- `wrangler dev` / miniflare's images binding with sharp 0.35.5: not run (slot).
- GitHub alert closure: only after the fix is on `main`.
- The Mac was on battery power during these checks (`pmset -g batt`); none of them is a long run.

## Observation, not changed

npm 11.19 prints `install-scripts … not yet covered by allowScripts` for `esbuild@0.25.4`, `esbuild@0.28.1`,
`workerd@1.20261001.1` and `fsevents@2.3.3` on `npm ci`. Same on `origin/main` before this change; out of scope.

## When to remove the override

When a wrangler/miniflare release pins `sharp` >= 0.35.5, bump wrangler and delete `"sharp"` from `overrides`.

## Migrations, environment names, owner steps

None. No migration, no new environment name, nothing for the owner to click (no UI change).

## Proposed board / state lines (controller applies at ship)

- `CONTROL-BOARD.md` / `STATE.md`: "Dependabot #43 (sharp 0.35.5) and #42 (source-map-js 1.2.2) fixed on
  `fix/deps-sharp-source-map-js` `0e5a2999`; npm audit 0; alerts close when it lands on `main`."
