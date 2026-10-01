# Testing Patterns

**Analysis Date:** 2026-10-02

Counts below were measured on `main` 68df3b6: `node --test tests/*.test.mjs` runs and passes **160** tests (about 0.4 s); `npx playwright test --list` reports **1,141** tests in 19 files. `npx tsc --noEmit` and `npm run tokens:check` are clean.

## Test Framework

**Runners (two, no others):**
- **Node built-in test runner** (`node:test` + `node:assert/strict`) for unit, contract and guard tests in `tests/*.test.mjs`. Needs Node >= 22.18 (tests and `scripts/assemble-cloudflare.mjs` import `.ts` files through native type stripping; Node v26.7.0 on the Mac). No Jest, Vitest, jsdom or React Testing Library.
- **Playwright 1.63.0**, one project `chromium` (headless shell build 1243), for behaviour, a11y, RTL and screenshot specs in `tests/**/*.spec.ts`.
- Config: `playwright.config.ts` (`testDir: "tests"`). Defaults: 30 s per test, no retries, no `fullyParallel`, workers = half the cores unless overridden. Screenshot expectations: `maxDiffPixelRatio: 0`, `animations: "disabled"`, `caret: "hide"`. `snapshotPathTemplate: "{testDir}/{arg}{ext}"` puts every baseline under `tests/`.
- Dev server: Playwright starts `npm run dev -- -H 127.0.0.1 -p 3010` with env `ALMAR_HARNESS=1` and `reuseExistingServer: false`. The port must be free; override with `PW_PORT` (port 3000 belongs to another product). `npm run build` kills a running dev server (shared `.next`); restart it after a build.

**Assertion Library:**
- `node:assert/strict` in `.mjs` tests; Playwright `expect` (auto-waiting web-first assertions) in specs.

**Run Commands:**
```bash
node --test tests/*.test.mjs                                   # 160 node tests, run from the repo root (paths are cwd-relative)
npx tsc --noEmit                                               # type gate (covers tests/**/*.ts(x) and scenes)
npm run tokens:check                                           # globals.css theme block matches tokens.json
npm run build                                                  # Next build
npx playwright test --workers=1                                # full Playwright set (1,141 listed)
npx playwright test tests/journey/ --workers=1                 # journey harness set (1,094 listed)
npx playwright test tests/journey/panels.spec.ts --workers=1   # one file
npx playwright test --list                                     # counts without running
PW_PORT=3011 npx playwright test --workers=1                   # if 3010 is taken
npx playwright test tests/journey/visual.spec.ts --workers=1 --update-snapshots   # intended visual change only
SCREENS_MODE=after npx playwright test tests/screens-before-after.spec.ts --workers=1
node scripts/screens-diff.mjs                                  # ratios, rewrites tests/screens/INDEX.md
```
- **Always `--workers=1`.** The `chooseArabic` helper in `tests/screens-before-after.spec.ts` races the Menu and Language clicks under parallel workers and flakes (`login-ar-834`, `booking-trip-ar-390`, `booking-trip-ar-1440` failed on different runs, then passed on rerun). `npm test` is `node --test tests/*.test.mjs && playwright test` with default parallel workers: do not use it as the gate.
- **Full check set for a hand-over** (`.planning/prompts/00-common-rules.md`): `npm ci`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`, `npm run build`, then `npx playwright test --workers=1`. Work agents run only the files they touched; the lead runs the full set once. A page-load timeout under heavy Mac load: rerun that file and report both results.
- The 28 skipped Playwright tests in a full run are the "first Tab lands on the first tabbable" checks on scenes with nothing tabbable (`test.skip(first === null, ...)` in `tests/journey/a11y.spec.ts`). Expected: 1,066 passed + 28 skipped for `tests/journey/`.
- There is no CI (no GitHub Actions). The control session's clean-clone check is the CI. No coverage tooling.

## Test File Organization

**Location:** separate `tests/` folder, no co-located tests.

**Naming:**
- Node: `tests/<subject>.test.mjs`. Playwright: `tests/<subject>.spec.ts`; journey specs under `tests/journey/`.
- `phase-0N-*.test.mjs` files are older per-plan contract tests; name new ones by subject.

**Structure:**
```
tests/
├── *.test.mjs                  # 27 node files (160 tests)
├── *.spec.ts                   # root-level Playwright specs (route, locale, screens, regression)
├── journey/
│   ├── harness.spec.ts         # harness gate and smoke (5)
│   ├── visual.spec.ts          # screenshot matrix (429)
│   ├── a11y.spec.ts            # names, icons, focus ring, tab order (421)
│   ├── rtl.spec.ts             # Arabic direction checks (142)
│   ├── journey-bar.spec.ts, journey-sheet.spec.ts, panels.spec.ts,
│   │   steps-addons.spec.ts, cart-team.spec.ts   # behaviour per component (97)
│   ├── matrix.ts               # component x state x locale x viewport matrix + settle()
│   ├── fixtures.ts             # shared fixtures (bracket placeholders only)
│   ├── scene-types.ts          # Scene / Scenes / SceneContext
│   ├── scenes/<component>.tsx  # one file per component, exports `scenes`
│   ├── visual.css              # hides nextjs-portal in screenshots
│   └── __screenshots__/        # 411 committed PNG baselines
├── account-select/             # 4 PNG baselines (en/ar x closed/open)
└── screens/
    ├── before/                 # 24 committed PNGs, never regenerated
    ├── after/                  # gitignored output of the screens guard
    └── INDEX.md                # written by scripts/screens-diff.mjs
```

## Test Types and What Each Covers

**Node unit tests (pure logic, import `.ts` directly):**
- `tests/cn.test.mjs` (tailwind-merge token groups, plus drift check of `TOKEN_GROUPS` against `tokens.json`), `tests/journey-format.test.mjs` (plural forms, guest summary in en/ar/es, `fill`), `tests/https-url.test.mjs`, `tests/phase-03-fx.test.mjs` (`lib/fx/rates.ts`), `tests/assemble-404.test.mjs`.

**Node parity and guard tests (read the repo as text or data):**
- `tests/copy.test.mjs`: for each of the five copy tables (`home`, `guest`, `dashboard`, `framer-source`, `journey`) and each of `ar`, `es`, every `en` key exists with a non-empty string and arrays have equal length. Includes a self-test of the `walk` helper.
- `tests/design-tokens.test.mjs` (301 lines): the styling guard described in `.planning/codebase/CONVENTIONS.md` (no raw hex, no arbitrary values, no physical-direction or rounded utilities, gold never fill or text, spacing scale, type steps, layer order, `globals.css` shape, no `module.css`). Exports `stripComments`, `classTokens`, `topLevel`, `unlayered` and has its own probe test (`layer analysis flags an unlayered probe rule`).
- `tests/controls.test.mjs` (button, link, chip, toggle-card markup; no `type="radio"` under `app/` or `components/`), `tests/overlays.test.mjs` (z-layers, scrim, dismiss handlers, calendar has no gold), `tests/no-team-names.test.mjs` (fake team names banned in `app`, `components`, `lib`), `tests/phase-02-gates.test.mjs` (no Vercel script, Next pinned at `15.5.26`, no key material: substrings `eyJ` and `re_` anywhere in `app/`, `components/`, `lib/`), `tests/host-config.test.mjs`, `tests/next-config.test.mjs`, `tests/embed-sources.test.mjs` (every file the embed bundle imports is listed in `SOURCES` in `app/embed/hero-booker/route.ts`).
- `tests/harness-gate.test.mjs`: the harness route 404s unless `ALMAR_HARNESS` is `1`, is `force-dynamic`, imports no scene data at module top, is never named by `scripts/assemble-cloudflare.mjs`, `ALMAR_HARNESS` is set only in `playwright.config.ts` `webServer.env`, and no file outside the harness folder mentions `__harness`.

**Node source-contract tests (`phase-03-*.test.mjs`):** they `readFileSync` a page or screen and `assert.match` / `includes` on exact source text: pages gate `NODE_ENV` and call `notFound()`, are not `"use client"`, import `./<name>-screen`; screens use `copy.noBookingsYet`, `copy.newStay`, an empty `<tbody />`, `<Button onClick={() => undefined}>{copy.publish}</Button>`; Resend route has the honeypot fields and 400/502/503 statuses. They do not render anything. A refactor that renames a copy key, a prop or a status code breaks them on purpose: update the test in the same commit.

**Playwright specs:**
- **Harness behaviour** (`tests/journey/*.spec.ts`): component behaviour in isolation on `/__harness` (selection, keyboard, min/max, Missing state, alert text, CSS values such as `72px` bar height, `2px` gold top rule `rgb(212, 186, 138)`, teal `rgb(31, 59, 64)`).
- **Visual** (`tests/journey/visual.spec.ts`): every component x state x locale (en, ar, es) x viewport. 429 tests = 411 baselines + 18 "renders nothing" assertions (`team-section/none`, `inclusions-list/empty`, 9 each).
- **A11y** (`tests/journey/a11y.spec.ts`, English): controls have an accessible name, SVGs are `aria-hidden` or inside a named control and drawn in `currentColor`, the focus ring is the global 2px teal outline offset 2px (exceptions: `JourneySegment` rule, `Field` border), first Tab lands on the first tabbable, modal dialogs keep Tab inside, tab order follows visual order (LTR and RTL).
- **RTL** (`tests/journey/rtl.spec.ts`, Arabic): `html[dir=rtl][lang=ar]`, no horizontal overflow, mirrored directional glyphs equal the opposite sign of the English scene, plus/minus/check/close never mirrored, Latin dates and `ALMAR-*` references inside `<bdi>` or `[dir=ltr]`, inline-start positions of segments, step rail, stepper, cart Remove.
- **Routes and regressions** (root `*.spec.ts`): `review-fixes.spec.ts` (keyboard focus, https:// typing on `/dashboard/catalog/stays` and `/dashboard/content/team`, hero-booker embed), `account-select.spec.ts` (language select, 4 screenshots, Escape returns focus), `locale-switch.spec.ts` (AR sets rtl, URL unchanged, `almar-locale` cookie), `removed-routes.spec.ts` (`/design`, `/framer` are 404; `/` and `/embed/hero-booker` serve), `not-found.spec.ts`, `status-mark.spec.ts` (404 mark is real SVG, not `[object Object]`), `embed-hero-booker.spec.ts`, `phase-03-whatsapp.spec.ts`, `phase-03-dashboard.spec.ts`.
- **Screens guard** (`tests/screens-before-after.spec.ts`, 24 tests): `/dashboard`, `/account`, `/login`, `/booking/trip` x en, ar x 390, 834, 1440, full-page. Default mode `after` writes `tests/screens/after/<route>-<locale>-<width>.png` and compares against `tests/screens/before/` at `maxDiffPixelRatio: 0.35` as a gross-break guard. `SCREENS_MODE=before` (with `--update-snapshots`) writes baselines: do not run it. **`tests/screens/before/` is never regenerated.**

**E2E:** no checkout, auth or database flow exists yet (Supabase, Stripe and Resend are not wired). Playwright runs against the local dev server only; nothing hits a live host.

## Test Structure

**Node suite pattern:**
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cn, TOKEN_GROUPS } from "../lib/cn.ts";   // explicit .ts extension, leaf files only

const tokens = JSON.parse(readFileSync("tokens.json", "utf8"));   // cwd = repo root

test("two font sizes collapse to the last", () => {
  assert.equal(cn("text-body", "text-title"), "text-title");
});

test("TOKEN_GROUPS match tokens.json (drift)", () => {
  assert.deepEqual([...TOKEN_GROUPS.color], Object.keys(tokens.color));
});
```
- Flat `test("sentence", ...)` calls, no `describe`. Names are sentences and cite decision ids where relevant (`(D-13)`).
- Loops generate tests: `tests/copy.test.mjs` creates one test per table and locale (10), so "160" is not the count of `test(` literals.
- Negative checks: `assert.equal(text.includes("x"), false, "why")`; always give a message naming the file or value.
- Collect-then-assert for tree scans: push offenders into an array and `assert.deepEqual(hits, [])` so the failure prints every offender (`tests/design-tokens.test.mjs`, `tests/harness-gate.test.mjs`).
- Import only leaf files under `lib/`. `lib/copy/index.ts`, `lib/set-document-locale.ts` (imports `next/font`) and anything with an extensionless runtime relative import cannot load under Node; read those as text instead.

**Playwright spec pattern:**
```typescript
import { test, expect, type Page } from "@playwright/test";

const url = (c: string, s: string, l = "en") => `/__harness?c=${c}&s=${s}&l=${l}`;
const seg = (p: Page, i: 0 | 1 | 2) => p.getByRole("search").locator("button").nth(i);

test.describe("JourneyBar hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Search with nothing set: both Missing, one alert, focus on Destination", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    await page.getByRole("search").locator("button").nth(3).click();
    await expect(page.locator("p[role=alert]")).toHaveCount(1);
    await expect(seg(page, 0)).toHaveAttribute("aria-invalid", "true");
    await expect(seg(page, 0)).toBeFocused();
    await expect(page.getByTestId("search-calls")).toHaveText("0");
  });
});
```
- Locate by role and accessible name first (`getByRole`, `getByLabel`, `getByText`); `data-testid` only for harness wrappers and counters (`harness-*`, `search-calls`, `guest-summary`, `hero-sentinel`).
- Day buttons are found by `button[aria-label^="12/10/2026"]` (labels start with `DD/MM/YYYY`).
- Assert computed style as pixels or `rgb(...)` strings (`toHaveCSS`, `getComputedStyle`), not class names, except where the class is the contract (`toHaveClass(/shadow-selected/)`).
- Viewports: set in `beforeEach` or `test.use({ viewport })`. Standard sizes: phone 390x844, tablet 834x1194, desktop 1440x900 (`VIEWPORTS` in `tests/journey/matrix.ts`); `review-fixes.spec.ts` also uses 1024 and 375.
- Avoid `waitForTimeout`. The only two uses are 300 ms settles before a screenshot (`tests/screens-before-after.spec.ts`, `tests/account-select.spec.ts`). Use `expect(...).toPass({ timeout })` for hydration races (`chooseArabic`, `journey-bar.spec.ts`).

## The Harness (journey component test bench)

- **Route:** `/__harness?c=<component>&s=<state>&l=<en|ar|es>` (`app/%5F%5Fharness/page.tsx`, `harness-client.tsx`). `notFound()` unless `process.env.ALMAR_HARNESS === "1"`; `force-dynamic`; `c` and `s` must match `/^[a-z0-9_-]+$/`; `l` must be a valid locale. Bad input is a real 404; an unknown state is a visible 200 with `data-testid="harness-unknown"`.
- **Scenes:** `tests/journey/scenes/<component>.tsx` exports `scenes: Scenes` (state name -> `(ctx) => ReactNode`, ctx = `{ locale, copy, fixtures }`). The client imports the scene file at runtime by name (`import(`../../tests/journey/scenes/${c}`)`). Interactive scenes wrap the component in a small `Live` component holding state and an observable output:
  ```tsx
  function Live({ ctx, initial }: { ctx: SceneContext; initial: GuestCounts }) {
    const [counts, setCounts] = useState(initial);
    return <div data-testid="harness-panel"><GuestPanel counts={counts} onChange={setCounts} onDone={() => undefined} locale={ctx.locale} copy={ctx.copy} /></div>;
  }
  export const scenes: Scenes = {
    default: (ctx) => <Live ctx={ctx} initial={{ adults: 1, children: 0, infants: 0 }} />,
    filled: (ctx) => <Live ctx={ctx} initial={ctx.fixtures.guestsFamily} />,
  };
  ```
  `tests/journey/scenes/_smoke.tsx` is the smoke scene used by `harness.spec.ts`.
- **Matrix:** `tests/journey/matrix.ts` lists components and which viewports each state exists at (`ALL`, `UP` = tablet+desktop, `PHONE`). State names are read from the scene file as text (regex on top-level keys at **two-space indent**, `"name": ` or `name: `), so formatting scene keys differently silently drops states. Scene modules are not imported there because they pull in `.svg` imports Node cannot parse.
- **settle(page):** waits for `#harness-root` visible and non-empty (blank-page guard), reloads once if the dev server did not hydrate after a recompile, awaits `document.fonts.ready` and finite animations. Call it after every `goto` in matrix-driven specs.
- **Determinism:** fixtures use brackets (`AED [PRICE]`, `AED [AMOUNT]`, `[RATE]%`, `ALMAR-000000`) and no real people or amounts (`tests/journey/fixtures.ts`). The clock is injected: scenes pass `today = new CalendarDate(2026, 9, 29)`.
- **Production safety:** the harness imports from `tests/` and must never ship. It is gated at runtime, kept out of the Cloudflare assemble step, and `tests/harness-gate.test.mjs` fails if anything else references it. Do not link to `/__harness` from `app/`, `components/`, `lib/`, `scripts/` or `public/`.

**Add a new journey component to the suite:**
1. Create `tests/journey/scenes/<component>.tsx` exporting `scenes` (two-space-indented keys, one per state).
2. Add `entry("<component>", viewportsFn)` to `matrix` in `tests/journey/matrix.ts`; add the key to `RENDERS_NOTHING` if its contract is "renders nothing".
3. Add behaviour tests in a `tests/journey/<name>.spec.ts` using the `url(c, s, l)` helper.
4. Generate baselines on the Mac: `npx playwright test tests/journey/visual.spec.ts --workers=1 --update-snapshots -g "<component>"`, then run without the flag twice and expect zero diff. a11y and RTL tests pick the scenes up automatically.
5. Commit the PNGs with the change. Run `node --test tests/*.test.mjs` (the token guard scans the new component).

## Screenshot Baselines

- **Where:** `tests/journey/__screenshots__/<component>-<state>-<locale>-<width>.png` (411 files, committed); `tests/account-select/{en,ar}-{closed,open}.png` (4); `tests/screens/before/<route>-<locale>-<width>.png` (24, committed, frozen).
- **Made on the Mac** (the owner's machine; font rasterisation is platform-specific and the tolerance is `maxDiffPixelRatio: 0`). Do not generate or refresh baselines on another OS or in another environment. Update only for an intended visual change, review the diff, and never to silence a failure.
- The capture is clipped to the union of `#harness-root`, open `[role=dialog]` / `[data-radix-popper-content-wrapper]` and fixed-position children (`captureRect` in `tests/journey/visual.spec.ts`), with `tests/journey/visual.css` hiding `nextjs-portal` (Next dev overlay). `beforeAll` warms every component once (timeout 600 s) so no baseline is taken from a half-compiled page.
- Run the visual file twice after any style change; identical results twice is the pass.
- `tests/screens/after/` is gitignored scratch output.

## Mocking

**Framework:** none. No `jest.mock`, no `page.route`, no MSW.

**Patterns:**
- Node: stub a global in `try/finally` and restore it:
  ```javascript
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try { /* call every export of lib/fx/rates.ts with junk args, assert none returns "rate unavailable" */ }
  finally { globalThis.fetch = originalFetch; }
  ```
  Because `tests/phase-03-fx.test.mjs` calls every exported function in `lib/fx/rates.ts` with trial arguments, keep every export in that module safe to call with arbitrary input.
- Dependency injection through props instead of mocks: `today`, `copy`, `locale`, `initialOpen`, `forceMissing`, fixtures in `tests/journey/fixtures.ts`.
- The embed bundle is tested by fetching `/embed/hero-booker`, `page.setContent('<div id="host"></div>')` and evaluating the script (`tests/embed-hero-booker.spec.ts`, `tests/review-fixes.spec.ts`).

**What to Mock:** only the network (`globalThis.fetch`) in Node tests of `lib/`. **What NOT to Mock:** components, Radix, the dev server, `Intl` (the plural and locale tests exercise the real `Intl.PluralRules` / `Intl.ListFormat`).

## Fixtures and Factories

**Test Data:**
```typescript
export const PRICE = "AED [PRICE]";
export const destinations: Destination[] = [
  { id: "cartagena", name: "Cartagena", shortLine: "[Short line]" },
  // ...
];
export const dates = { start: new CalendarDate(2026, 10, 12), end: new CalendarDate(2026, 10, 17), nights: 5, startLabel: "12/10/2026", endLabel: "17/10/2026" };
export const filledJourney: JourneyValue = { destinationId: "cartagena", /* ... */ };
```

**Location:** `tests/journey/fixtures.ts` (single shared module, also imported by `app/%5F%5Fharness/harness-client.tsx`). Never add invented prices, rates or real people.

## Coverage

**Requirements:** none enforced; no coverage tool installed.

**View Coverage:** not available.

**Known gaps:**
- Route handlers `app/newsletter/route.ts` and `app/fx/route.ts` are checked by source text only; nothing executes them or asserts the HTTP behaviour. `loadRates` caching and the 12 h window in `lib/fx/rates.ts` are untested.
- `components/ui/{field,switch,checkbox,toast,footer,nav,locale-select}.tsx` and `components/specimens/hero-booker.tsx` have no harness scenes; they are reached only through `/account`, `/login`, `/dashboard/*` specs and the embed specs. Add a scene when changing them.
- Dashboard screens (`app/dashboard/(ops)/**`) are covered by source-contract tests and a handful of Playwright checks (`tests/review-fixes.spec.ts` W1 and W5, `tests/phase-03-dashboard.spec.ts`); there are no screenshots of Calendar, Catalog or Content (`.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-18-SUMMARY.md`).
- `.mjs` tests are not type-checked. The 26 Framer `route.ts` HTML pages are not asserted beyond `/` and `/contact` returning 200 and the source checks on `app/route.ts`.
- `.hermes/measure-*.mjs` are one-off Playwright measuring scripts aimed at the deleted `/design` page; they are not part of the suite.

## Common Patterns

**Async Testing (Playwright):**
```typescript
await page.goto(url("date-range-panel", "empty"));
await day(page, "12/10/2026").click();
await expect(day(page, "12/10/2026")).toHaveAttribute("aria-label", /arrival/);
await expect(page.locator("[aria-live=polite]")).toContainText("5 nights");
```
Never `sleep`; rely on `expect` retries.

**Error and gate testing:**
```typescript
for (const url of ["/__harness?c=../app&s=ok&l=en", "/__harness?c=_smoke&s=ok&l=fr", "/__harness"]) {
  const res = await request.get(url);
  expect(res.status(), url).toBe(404);
}
```
Use the `request` fixture for status-only checks; pass the URL as the assertion message.

**Locale-parametrised tests:**
```typescript
for (const [l, dir] of [["ar", 1], ["en", -1]] as const) {
  await open(page, `/__harness?c=step-rail&s=step-2&l=${l}`, "desktop");
  expect(Math.sign(a.x - d.x), l).toBe(dir);   // RTL is the sign-flipped LTR result
}
```

**Matrix-generated tests:** `for (const s of scenesOf()) test(`${s.component} / ${s.state} / ${s.locale} / ${width}`, ...)`. Use `scenesOf(["ar"])` or `scenesOf(["en"])` to limit the locale; skip `RENDERS_NOTHING` scenes in a11y and rtl loops.

## Test Gotchas

- A first request to the dev server compiles the route; expect a slow first test. Do not lower the timeouts in `settle()` or the `beforeAll` warm-up.
- Tests that need a built app do not exist; everything runs on `next dev`. Pages that are `notFound()` in production (`/account`, `/login`, `/dashboard/*`, `/booking/trip`, `/fx`) only respond 200 in dev, and Playwright's dev server is the reason the specs work.
- `tests/phase-02-gates.test.mjs` fails on any occurrence of the substrings `re_` or `eyJ` in `app/`, `components/`, `lib/`, including identifiers (`store_id`, `core_`). Rename the identifier.
- Several source-contract tests assert literal strings (`"No bookings yet"`, `copy.publish`, `Pets`, `Min nights`, `Max nights` absent). Changing UI copy or a screen's structure means updating the matching test in the same change.
- Playwright needs the headless shell build 1243; another project's install can remove it. Ask the owner before `npx playwright install --only-shell chromium` (about 95 MB).

---

*Testing analysis: 2026-10-02*
