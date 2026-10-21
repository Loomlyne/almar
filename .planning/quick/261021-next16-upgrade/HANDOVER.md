# Job 20 — Next.js 16 upgrade: hand-over (2026-10-21)

- Branch `gsd/next16-upgrade`, worktree `.claude/worktrees/jolly-chaum-ce63aa`. Final commit: the one that adds this file
  (code tip before it: `45f80b88`). Folder clean. origin/main merged at `792659c3` (PR #27 `29759a81`, PR #24 `3d6caf5a`).
- Research: `RESEARCH.md` in this folder (live docs, 2026-10-21).

## Versions

| Package | Before | After |
|---|---|---|
| next | 15.5.27 | 16.4.2 |
| @opennextjs/cloudflare | 1.20.6 | 1.20.12 (@opennextjs/aws 4.1.4 → 4.1.11) |
| wrangler (dev) | 4.146.0 | 4.151.3 (OpenNext peer `^4.148.0`) |
| react, react-dom, @types/react(-dom) | 18.3.1 / 18 | unchanged (Next 16 peer still allows 18; App Router uses Next's vendored React 19.2 as before) |
| eslint-config-next | not a dependency | — |
| sharp (via next/miniflare) | 0.35.4 | 0.35.5 |
| overrides | `next.postcss = $postcss` | kept; added `@node-minify/core.glob = 10.5.0` |

Lockfile: every `resolved` URL is registry.npmjs.org.

## Breaking changes and how each was handled

1. **OpenNext refuses Next 15 after 2026-10-21.** Next 16 is supported until 2027-10-21. PR #27's
   `--dangerouslyUseUnsupportedNextVersion` removed from `scripts/assemble-cloudflare.mjs`; its pin test in
   `tests/assemble-target.test.mjs` removed. New `tests/next16-upgrade.test.mjs` fails if the flag comes back.
2. **Turbopack is the default; a custom webpack config fails `next build`.** `next.config.ts` keeps the markup-SVG
   webpack rule, so `package.json` scripts are now `next build --webpack` and `next dev --webpack`. OpenNext runs
   `npm run build`, so production/preview/ops builds get the flag. Pinned by `tests/next16-upgrade.test.mjs`.
3. **`middleware` → `proxy` rename.** Not done on purpose: `proxy.ts` is Node-runtime only, and OpenNext Cloudflare runs
   Node middleware only as an unmaintained experiment (~4.6 MB bundle reported, over the Free 3 MiB limit). `middleware.ts`
   stays edge; the build prints a deprecation warning. Pinned by the new test (no `proxy.ts`, no `runtime` export).
4. **tsconfig.** `next build` set `jsx: "react-jsx"` (mandatory) and added `.next/dev/types/**/*.ts` (dev now writes to
   `.next/dev`). Committed as Next wrote it; `tsc` clean after.
5. **`tests/phase-02-gates.test.mjs` "next stays 15.5.27"** → "next stays 16.4.2".
6. No change needed (checked): async request APIs (already awaited), `revalidateTag`, next/image defaults (no
   `next/image`), `next lint`, AMP, runtime config, parallel-route `default.js`, metadata image params, scroll-behavior,
   `next/font` (unchanged API; no font errors in the build).

## Checks on this branch

| Check | Result |
|---|---|
| `npm ci` (start) / `npm install` from registry.npmjs.org | ok |
| `npx tsc --noEmit` on 45f80b88 | exit 0 |
| `npm run tokens:check` | "theme up to date" |
| `node --test tests/*.test.mjs` on 45f80b88 | 2,012 pass, 0 fail |
| `npm audit` | 1 high: `source-map-js` 1.2.1 (on main before this job; PR #26 fixes it). glob advisory closed by the override |
| `npm run build` (controller go, 1fee5e86) | exit 0, 69/69 static pages |
| `node scripts/assemble-cloudflare.mjs --target=ops` | exit 0, Worker 1914 KiB gzip, no version refusal |
| `node scripts/assemble-cloudflare.mjs --target=local` | exit 0, 69 html (en/ar/es 22 each), 3 404s, Worker 1913 KiB gzip, same 13 server paths |
| next/font grep of the build log | 0 hits |

Log: `~/Library/Logs/almar-job20/run-1.log`. Build warnings: React 18 deprecated (removed in 17), middleware convention
deprecated, the pre-existing `.p-\[var\(\.\.\)\]` CSS warning (03.3-04), Next's own `process.cwd` edge note.

## Not verified

- **No Playwright run** (dev or build shards), so no screenshot comparison: "no visual change" is expected, not shown.
  Left to the controller's landing lane. `next dev --webpack` was never started.
- **The Worker was never run** (no `wrangler dev`): middleware, sign-in, `/api/*`, ops API on workerd under Next 16 are
  untested at runtime. The build-shard Playwright (ops-runtime/ops-api specs) covers this.
- `--target=preview` and `--target=production` (need live rows) not built; same OpenNext path as ops/local.
- Nothing deployed, no hosted database touched.

## Risks for the live Workers

- `almar`, `almar-preview`, `almar-ops`: new Next server runtime and OpenNext patches (1.20.7 rewrote the cache-handler
  patch for 16.3+; 1.20.9 isolates module-loading timers). Worker size 1913–1914 KiB gzip, inside the earlier range
  (1413–1946) and under 3 MiB. Rollback = previous version via `wrangler deployments list`.
- Middleware deprecated, not removed: a future Next minor may drop edge `middleware`; OpenNext Node-middleware support is the
  path out. React 18 support ends with Next 17.

## Proposed for the controller (board/state)

- Follow-ups: (a) move the SVG rule to `turbopack.rules` and drop `--webpack`; (b) React 19 + `@types/react` 19 before Next 17;
  (c) revisit `proxy.ts` when OpenNext Cloudflare supports Node middleware.
- Owner test steps after a preview deploy (each on `preview.almarprivatejourney.com` unless named):
  1. Open `/`, `/ar`, `/es`: pages look as before, Arabic in Noto Sans Arabic, right to left.
  2. Open `/login`, ask for a magic link with the owner email: the "check your email" screen shows.
  3. Open `dashboard.almarprivatejourney.com` signed in as owner: the dashboard home loads; signed out: the sign-in page.
  4. Open a missing path such as `/nope`: the branded 404.
