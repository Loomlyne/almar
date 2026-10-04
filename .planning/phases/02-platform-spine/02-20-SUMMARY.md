---
phase: 02-platform-spine
plan: "20"
status: complete
completed: 2026-10-04
commits: [37a509e, 4188ce6, a413034, 72ad1bd, 2e93124]
---

# 02-20 Summary: static first, server on a short list

Job 10, built by the Opus lead in the job's worktree. Executed directly by the lead rather than by Sonnet
executors: the code is small and every line of it is on the security boundary.

## Task 1: base and before-build

- Merged `origin/gsd/phase-3.3-slice-1` at `6264c59` (plan 08 merged there as `693c21a`) into the branch as
  `37a509e`: clean, no conflict. `scripts/crawl-files.mjs`, `wrangler.preview.toml` and
  `tests/preview-config.test.mjs` present.
- Before-build of the merged base, before any edit: `node scripts/assemble-cloudflare.mjs` gave 57 HTML files
  (12 Framer, React 14 per language, 3 404s), build id `cHLc3cI_EqsKjUpd2q6sa`. Saved in the session scratchpad
  (`before-out/`), outside the repo.

## Tasks 2-4: what was built

| File | What |
|---|---|
| `lib/server-routes.ts` | `HELD_PATHS` (the nine sections), `SERVER_PATHS_OUTSIDE_API` (empty), `isHeldPath()`, `serverPathsFrom()`; the how-to for a slice in its header |
| `worker/handle.mjs` | the router: exact raw pathname in the server list goes to Next with `x-robots-tag: noindex` added; anything else `env.ASSETS.fetch(request)` untouched |
| `worker/almar.mjs` | the Worker entry: OpenNext handler and the generated list into the router |
| `open-next.config.ts` | `defineCloudflareConfig({})`, no cache |
| `app/api/health/route.ts` | GET `{"ok":true}`, `no-store` (D-SR-01) |
| `app/newsletter/route.ts` | the 3-line `NODE_ENV` gate replaced by one comment line (slice 3 plans 26/27 precondition c) |
| `scripts/assemble-cloudflare.mjs` | runs `opennextjs-cloudflare build --config <file for the target>` instead of `npm run build`; refuses a bundled `.env` value; refuses a prerendered file under `/api` or a held section; writes `.open-next/almar-server-routes.json` |
| `wrangler.toml`, `wrangler.preview.toml` | `compatibility_flags`, `main = "worker/almar.mjs"`, `preview_urls = false`, `binding = "ASSETS"`; folders, routes, account unchanged |
| `package.json` | `host:cloudflare` removed; `build:cloudflare`, `build:preview` (build only). No dependency change; `package-lock.json` untouched |
| `.gitignore` | `/.open-next/` |
| `README.md` | how the Worker routes now; deploy points at the runbook |
| `tests/server-runtime.test.mjs` | 29 cases: the list, the router (path tricks included), the assembler's three refusals, the two Worker files, the scripts, source guards |
| `tests/preview-config.test.mjs` (plan 08's) | runtime lines added on purpose; the "no main" and "identical to origin/main" checks replaced; its "no preview" regex narrowed to the preview Worker and host (`preview_urls` holds the word) |
| `tests/assemble-target.test.mjs` (plan 08's) | follows the new build command (lookup text and ENOENT refusal) |
| `tests/harness-gate.test.mjs` | one named exemption: `lib/server-routes.ts` (a deny entry) |

## Checks on `2e93124`

| Check | Result |
|---|---|
| `node --test tests/*.test.mjs` | 585 tests, 581 pass, 0 fail, 4 skipped (unchanged skips from before this plan) |
| `npx tsc --noEmit` | pass |
| `npm run tokens:check` | theme up to date |
| `node scripts/assemble-cloudflare.mjs` | 57 HTML files; `server paths: /api/health`; `.open-next/almar-server-routes.json` = `["/api/health"]`; `next-env.mjs` all three modes `{}` |
| `grep -c "^main = " wrangler.toml` | 1 |
| Same bytes, non-HTML (scratch `cmp-out.mjs`, exit 0) | 463 files before, 464 after: 444 identical; `_buildManifest.js` differs (allowed); 18 per-route chunks each gain exactly one chunk id, `2772`, the new route's (allowed); one added file, the health route's own chunk. `_headers`, `robots.txt`, `sitemap.xml`, images, fonts, CSS: identical |
| Same bytes, HTML (scratch `cmp-html-sets.mjs`) | 57 files: 56 byte-identical, 1 differs only in the ORDER of its streamed React data chunks (same chunks, same document). Two builds of this same commit differ the same way (56 identical, 1 reordered), so the order is build-to-build variation, not this job |
| `wrangler deploy --dry-run --config wrangler.toml` | 10,122.85 KiB raw / **1,627.16 KiB gzip**, under 3,072 KiB; binding `env.ASSETS` only |

## Deviations

- The first HTML comparison flagged 42 pages. Two reasons, both in the comparison script, not the build: Next writes
  the build id into an HTML comment with `-` turned into `_`, and the streamed chunk order varies between builds.
  The script now normalises both id forms and compares the flight chunks as a set; proven against a second build
  of the same commit.
- Task 4 ran as two commits (4a assembler `72ad1bd`, 4b configs `2e93124`), as the plan's checker note asked.
- `tests/assemble-target.test.mjs` also had two stale comments and two "the build was not reached" regexes; they
  now name the OpenNext build too.
