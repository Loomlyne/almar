# Job 20 — Next.js 16 upgrade: research (2026-10-21)

Sources read live today: nextjs.org/docs/app/guides/upgrading/version-16 (lastUpdated 2026-10-15), opennext.js.org/cloudflare,
the `@opennextjs/cloudflare` GitHub releases 1.20.7–1.20.12, the published tarballs of `@opennextjs/cloudflare@1.20.12` and
`@opennextjs/aws@4.1.11`, npm registry metadata.

## Why the build stopped

`@opennextjs/aws` `checkNextVersionSupport()` (dist/build/helper.js) refuses any Next major whose release date + 2 years is in
the past (`NEXT_RELEASE_DATES`). Next 15 was released 2024-10-21, so from 2026-10-21 every Next 15 build exits 1 unless
`--dangerouslyUseUnsupportedNextVersion` is passed (PR #27). Next 16 (2025-10-21) is supported until 2027-10-21.

## Versions picked

| Package | Before | After | Why |
|---|---|---|---|
| next | 15.5.27 | 16.4.2 (`latest`) | OpenNext 1.20.12 peer: `>=15.5.28 <16 \|\| >=16.4.1`; 16.2.0–16.3.5 carry CVE-2026-94545 (next/og RCE) |
| @opennextjs/cloudflare | 1.20.6 | 1.20.12 (`latest`) | adds Next 16.4 support (via @opennextjs/aws 4.1.11), 16.3 cache-handler patch fix |
| @opennextjs/aws (transitive) | 4.1.4 | 4.1.11 | |
| wrangler | 4.146.0 | 4.151.3 (`latest`) | OpenNext 1.20.12 peer `wrangler ^4.148.0` (npm refused 4.146) |
| react / react-dom | 18.3.1 | 18.3.1 (unchanged) | Next 16 peer still allows `^18.2.0`; the App Router always runs Next's vendored React canary (19.2), as in Next 15. Pages Router is not used. Not required, so not changed |
| @types/react(-dom) | 18 | 18 (unchanged) | `tsc --noEmit` is clean with them |
| eslint-config-next | — | — | not a dependency of this repo; `next lint` is not used anywhere |

## Next 16 breaking changes against this repo

| Change | Applies here? | Handling |
|---|---|---|
| Turbopack default for `next dev` and `next build`; a custom `webpack` config makes `next build` **fail** | Yes: next.config.ts has a webpack rule (Curves_black/Poly_Black SVGs as `asset/source`) | `build` → `next build --webpack`, `dev` → `next dev --webpack`. OpenNext runs `npm run build` (buildNextApp.js), so it gets the flag. Moving the SVG rule to `turbopack.rules` is a separate follow-up |
| `middleware` file renamed to `proxy` (deprecated, still works). `proxy` is Node runtime only; edge stays on `middleware` | Yes: middleware.ts (edge, the default) | **Kept as middleware.ts.** OpenNext Cloudflare calls Node middleware "experimental, not officially maintained" (build.js warning; docs: "Node Middleware … not yet supported"), and issue #1373 reports a proxy.ts bundle of ~4.6 MB for a no-op — over the Workers Free 3 MiB limit. Expect a deprecation warning in the build log |
| Sync `cookies()/headers()/draftMode()/params/searchParams` removed | Code already awaits them (Next 15 types are Promises); `tsc` clean | none needed; async codemod not run |
| `revalidateTag` needs a 2nd arg; `unstable_` cache APIs stabilised | not used | none |
| next/image defaults (qualities, imageSizes, minimumCacheTTL, localPatterns query, local IP, redirects) | `next/image` not used | none |
| `next lint` removed, `eslint` config key removed | not used | none |
| AMP, `serverRuntimeConfig`/`publicRuntimeConfig`, `devIndicators` sub-options, `experimental.dynamicIO/useCache/ppr`, `unstable_rootParams` | not used | none |
| Parallel routes need `default.js` | no `@slot` folders | none |
| Async params in opengraph-image/icon/sitemap | none in app/ | none |
| `scroll-behavior: smooth` no longer overridden on navigation | no `scroll-behavior` in app/, components/, lib/ | none |
| `next dev` writes to `.next/dev`; lockfile stops two `next dev`/`next build` on one project | dev output moves; build output (`.next/server`, `.next/static`, `.next/standalone`) unchanged | watch the first build for path changes in assemble |
| `size` / `First Load JS` removed from build output | nothing parses it | none |
| Node ≥ 20.9, TS ≥ 5.1 | Node 26.7 here, engines ≥ 22.18 | none |
| next/font | `next/font/google` + `next/font/local` unchanged in the guide | watch the Arabic font in the build (memory: font network fallback) |

## Supply chain

- Lockfile resolved from registry.npmjs.org only (every `resolved` URL).
- `@opennextjs/aws` ≥ 4.1.9 pulls `@node-minify/core` 9.0.2 → `glob` 10.3.3 (GHSA-5j98-mcp5-4vw2, glob CLI `-c`; library use is not affected). Pinned with a root override `"@node-minify/core": { "glob": "10.5.0" }`.
- `npm audit` after: 1 high, `source-map-js` 1.2.1 — already on main before this job and fixed by PR #26 (Dependabot, override).
- `sharp` moves to 0.35.5 with next 16.4.2 (main's audit flagged 0.35.4 via wrangler/miniflare; PR #26 also pins it).
