# Codebase Structure

**Analysis Date:** 2026-09-21

## Directory Layout

```
almarprod-Website-Code/
├── app/                    # Only application code: one route.ts per URL
│   ├── route.ts            # Home
│   ├── [...not_found]/     # Branded 404
│   ├── about/
│   ├── contact/
│   ├── destinations/
│   ├── experiences/
│   ├── services/           # index + 3 stub detail pages
│   ├── blog/               # index + 3 stub posts
│   └── private-stays/      # index + 12 stay pages
├── public/
│   └── assets/
│       ├── fonts/          # Self-hosted woff/woff2 (hashed names)
│       └── img/            # Self-hosted images (hashed names)
├── .planning/
│   └── codebase/           # GSD map (this folder)
├── next.config.js
├── tsconfig.json
├── package.json
├── package-lock.json
├── vercel.json             # Exporter leftover — not the host
├── Dockerfile
├── _headers                # Netlify-style cache
├── .hermes.md              # Bot contract
├── README.md
├── PLAN_FIX_ALL.md         # Old Vercel-era fix list — not current GSD plan
└── .gitignore
```

No `src/`, no `components/`, no `lib/`, no `app/api/`, no `middleware.ts`, no `wrangler.toml`, no `.github/`.

## Directory Purposes

**app/:**
- Purpose: URL → HTML. Folder name is the slug.
- Contains: only `route.ts` files.
- Key files: `app/route.ts` (home, ~670k), `app/[...not_found]/route.ts` (hand-written 404).
- Subdirectories: one per public section. Nested stays/services/blog use kebab-case slugs.

**public/assets/:**
- Purpose: hashed static files referenced as `/assets/img/…` and `/assets/fonts/…`.
- Do not rename hashes. Favicon is `public/assets/img/754fb6d4bd4d3e48.svg`.

**.planning/codebase/:**
- Purpose: GSD brownfield map. Not runtime.

## Key File Locations

**Entry Points:**
- `app/route.ts`: `/`
- `app/<section>/route.ts`: section indexes
- `app/[...not_found]/route.ts`: unknown paths

**Configuration:**
- `next.config.js`: Next config (reactStrictMode only)
- `tsconfig.json`: TypeScript
- `package.json`: Next 14.2.35, React 18
- `vercel.json`: leftover cache headers
- `_headers`: leftover Netlify cache
- `.hermes.md`: process/stack contract
- `Dockerfile`: Node 20 alpine, port 3000

**Core Logic:**
- Not detected as separate modules. Behavior is “return HTML”.

**Testing:**
- Not detected.

**Documentation:**
- `README.md`: exporter how-it-works
- `PLAN_FIX_ALL.md`: stale Vercel task list (mentions `app/lib/html-patch.ts` which does not exist)
- No `CLAUDE.md`

## Naming Conventions

**Files:**
- Always `route.ts` inside a kebab-case directory.
- Hashed asset filenames (16 hex chars + ext).

**Directories:**
- kebab-case URL segments (`private-stays`, `24-7-private-concierge`).
- Catch-all: `[...not_found]`.

**Special Patterns:**
- No `index.ts` barrels.
- No `page.tsx` / `layout.tsx`.
- Stub files keep a 3-line header pointing at template provenance.

## Where to Add New Code

| Change | Where |
|---|---|
| New static marketing URL | `app/<slug>/route.ts` copying an existing GET + HTML pattern |
| Shared HTML rewrite | Planned `app/lib/html-patch.ts` — does not exist yet |
| React UI / design system | New tree (`app` components or `src/`) — not present; requires architecture change |
| API / booking / auth | Not present; would be new `app/api/*` or Cloudflare Worker — do not hide inside `HTML` strings |
| Tests | None yet; do not invent a runner until a phase adds one |
| Cloudflare | `wrangler.toml` + owner-gated project — do not add until gated |

## Special Directories

**app/[...not_found]/:** Must stay a route handler. Replacing with `not-found.tsx` without a root layout will drop branded 404s.

**Do not create (from this bot):** other client sites, Vercel project files as the deploy path, paid cloud projects without a gate.
