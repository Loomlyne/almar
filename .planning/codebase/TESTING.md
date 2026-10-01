# Testing Patterns

**Analysis Date:** 2026-09-21

## Test Framework

**Runner:**
- Not detected. There is no Jest, Vitest, Playwright, Cypress, Mocha, or Testing Library dependency in `package.json` or `package-lock.json`.
- No config files: no `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`.
- No test files: zero `*.test.*` / `*.spec.*` anywhere in the repo.

**Assertion Library:**
- Not detected.

**Run Commands:**
```bash
# There is no test script. package.json scripts are only:
npm run dev        # next dev
npm run build      # next build — the only automated TypeScript/route check
npm start          # next start
```

Do not invent `npm test`, `npm run test:watch`, or coverage commands. They are not wired.

## Test File Organization

**Location:**
- Not applicable — no test directory and no co-located tests next to `app/**/route.ts`.

**Naming:**
- Not detected.

**Structure:**
```
# No tests/ or __tests__/ tree.
# Source under test (untested):
app/route.ts
app/about/route.ts
app/contact/route.ts
app/destinations/route.ts
app/experiences/route.ts
app/blog/route.ts
app/blog/<slug>/route.ts          # 3 stub posts
app/services/route.ts
app/services/<slug>/route.ts      # 3 stub services
app/private-stays/route.ts
app/private-stays/<slug>/route.ts # 12 stays
app/[...not_found]/route.ts
```

`PLAN_FIX_ALL.md` Phase 0 asks for a unit-tested `app/lib/html-patch.ts`. That module is not in the tree, so there is still no suite to extend.

## Test Structure

**Suite Organization:**
```typescript
// Not applicable — no describe/it/test blocks exist in the codebase.
```

**Patterns:**
- Setup pattern: Not detected.
- Teardown pattern: Not detected.
- Assertion pattern: Not detected.

## Mocking

**Framework:** Not detected.

**Patterns:**
```typescript
// Not applicable — no mocks, no vi.mock, no jest.mock.
```

**What to Mock:**
- Not applicable until a runner exists.

**What NOT to Mock:**
- Do not mock the Framer `HTML` string constants in `app/**/route.ts`. Those strings are the product. Treat them as fixtures, not as units to stub.

## Fixtures and Factories

**Test Data:**
```typescript
// Not applicable — no factories or fixture modules.
// The only "fixtures" are the HTML constants themselves, e.g. `HTML` in
// `app/route.ts` and the template-literal `HTML` in `app/[...not_found]/route.ts`.
```

**Location:**
- Not detected.

## Coverage

**Requirements:** None enforced. No coverage reporter, no `coverage/` output, no CI coverage gate.

**View Coverage:**
```bash
# Not applicable — no coverage command.
```

## Test Types

**Unit Tests:**
- Not used. 27 `route.ts` files export `GET` with no extracted helpers to unit-test.
- Planned (not present): unit tests for `patchHTML` in `app/lib/html-patch.ts` (`PLAN_FIX_ALL.md` Phase 0). Do not create that file or its tests unless a signed plan says so.

**Integration Tests:**
- Not used. No tests hit `GET()` or assert `Response` status/headers/body.

**E2E Tests:**
- Not used. No Playwright/Cypress. Manual checks listed in `PLAN_FIX_ALL.md` Phase 6 and `README.md` are the substitute, not an automated suite.

## Common Patterns

**Async Testing:**
```typescript
// Not applicable — GET handlers are synchronous (`export function GET()` in
// `app/route.ts`, `app/contact/route.ts`, `app/[...not_found]/route.ts`).
```

**Error Testing:**
```typescript
// Not applicable — no error-path tests.
// 404 behavior lives only in `app/[...not_found]/route.ts` (`status: 404`).
```

## Current Verification (not a test suite)

Until a runner is added, the repo checks quality with build and manual HTTP. These are operational checks, not tests:

1. Typecheck + App Router compile: `npm run build` (`package.json`). This is the only command that fails on TypeScript errors in `app/**/route.ts`.
2. Local run: `npm run dev` then open `http://localhost:3000` (`README.md`).
3. Docker smoke (documented in `PLAN_FIX_ALL.md`, `Dockerfile`): `docker build` then `docker run -p 3001:3000`, click nav.
4. HTTP status: `curl -I` on routes; unknown paths must return branded HTML with 404 from `app/[...not_found]/route.ts`, not the default Next 404.
5. Live verify with cache-bust (`.hermes.md`). Placeholders and local-only success do not count as done.

`PLAN_FIX_ALL.md` Phase 6 also lists Lighthouse thresholds (perf/a11y/SEO > 90). There is no Lighthouse CI config in the repo.

## If Tests Are Added Later

Match existing code conventions (`CONVENTIONS.md`):

- Put unit tests next to a real extracted module (e.g. `app/lib/html-patch.ts` → `app/lib/html-patch.test.ts`) once that module exists. Do not sprinkle tests beside 200–600 KB generated `route.ts` HTML dumps.
- First assertions worth writing, in order:
  1. `GET()` on `app/[...not_found]/route.ts` returns `status === 404` and `content-type` `text/html; charset=utf-8`.
  2. Static `GET()` on `app/route.ts` returns 200 and the cache headers in that file.
  3. Response body starts with `<!DOCTYPE html` and still contains `<!-- Made in Framer`.
  4. Contact strings `inquiries@almarprivatejourney.com` and `+971 56 388 3302` remain in `app/contact/route.ts` output.
- Add a `test` script to `package.json` only when a runner is installed. Do not leave a script that points at a missing binary.
- Do not use JSX tests (`@testing-library/react`) for these routes — pages are HTML strings, not React trees. There is no `app/layout.tsx` / `app/page.tsx`.

## What Is Untested (inventory)

| Area | Files | Automated tests |
|------|-------|-----------------|
| Home HTML route | `app/route.ts` | None |
| Marketing pages | `app/about/route.ts`, `app/contact/route.ts`, `app/destinations/route.ts`, `app/experiences/route.ts`, `app/services/route.ts`, `app/blog/route.ts`, `app/private-stays/route.ts` | None |
| Villa pages (12) | `app/private-stays/*/route.ts` | None |
| Service stubs (3) | `app/services/24-7-private-concierge/route.ts`, `app/services/luxury-ground-transport/route.ts`, `app/services/vip-airport-meet-greet/route.ts` | None |
| Blog stubs (3) | `app/blog/colombias-coffee-triangle-eje-cafetero/route.ts`, `app/blog/discovering-cartagenas-hidden-colonial-courtyards/route.ts`, `app/blog/why-medellin-is-redefining-luxury-travel/route.ts` | None |
| Branded 404 | `app/[...not_found]/route.ts` | None |
| Next config | `next.config.js` | None |
| Cache headers | `vercel.json`, `_headers` | None |
| Shared HTML patcher | `app/lib/html-patch.ts` (missing) | None |
| CI | `.github/` (missing) | None |

There is no GitHub Actions (or other CI) workflow in this working tree. `.hermes.md` requires branch → PR → CI before merge; that pipeline is not defined in-repo.

---

*Testing analysis: 2026-09-21*
