# Coding Conventions

**Analysis Date:** 2026-10-02

Verified from the code at `main` 68df3b6 (Phase 3.1 landed). `HERMES.md` and `README.md` describe the old Framer export and are stale for conventions; the code and `tests/design-tokens.test.mjs` win.

## Naming Patterns

**Files:**
- kebab-case for every source file: `components/journey/date-range-panel.tsx`, `lib/journey-format.ts`, `lib/set-document-locale.ts`.
- One component family per file, named for its main export: `components/ui/button.tsx` exports `Button`; `components/ui/toggle-card.tsx` exports `ToggleCard` and `ToggleCardGroup`.
- A client screen that backs a Next page is `<name>-screen.tsx` next to its `page.tsx`: `app/account/account-screen.tsx`, `app/dashboard/(ops)/catalog/catalog-screen.tsx`.
- Copy catalogues are `lib/copy/<area>.ts` (`home`, `guest`, `dashboard`, `journey`, `framer-source`). Barrel: `lib/copy/index.ts`.
- Test files: `tests/<subject>.test.mjs` (node) and `tests/<subject>.spec.ts` (Playwright). The `phase-0N-*` prefix is legacy; new tests use the subject name (`controls.test.mjs`, `overlays.test.mjs`).
- Next special files keep Next names: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`. The harness folder is the URL-encoded `app/%5F%5Fharness/` (serves `/__harness`).

**Functions and components:**
- Components: PascalCase function declarations, named exports: `export function GuestPanel(...)`. Wrap with `forwardRef` only when a ref is needed (`JourneySegment` in `components/journey/journey-segment.tsx`).
- Helpers and handlers: camelCase verbs (`formatGuestSummary`, `isHttpsUrl`, `canBecomeHttpsUrl`, `setDocumentLocale`). Handlers declared inside the component as `function onSubmit(...)`, `function choose(...)`, `function show(...)`.
- Hooks: `useX` (`useDesktop` in `components/journey/journey-bar.tsx`, `useToast` in `components/ui/toast.tsx`).
- Type guards: `isX(value): value is X` (`isDocumentLocale` in `lib/set-document-locale.ts`).

**Variables and constants:**
- Module constants UPPER_SNAKE: `DEFAULT_LABELS`, `NAV_ROW_MIN`, `LOCALE_COOKIE`, `HONEYPOT_FIELDS`, `TOKEN_GROUPS`, `FX_URL`, `MARKUP_SVG`.
- Shared class strings are UPPER_SNAKE constants: `INPUT` in `components/ui/field.tsx`, `LINK` in `components/ui/nav.tsx`, `KICKER` in `components/journey/journey-cart.tsx`.
- Lookup tables are `Record<Locale, ...>` objects: `NUMBER_LOCALE` in `lib/journey-format.ts`, `INTL_TAG` in `components/journey/date-range-panel.tsx`.

**Types:**
- Use `type`, never `interface`. The repo has 96 `type` aliases and no `interface` except the `declare global { interface Window }` augmentation in `lib/framer-hero-booker-mount.tsx`.
- Props are an exported `type <Component>Props` next to the component (`JourneyBarProps`, `GuestPanelProps`, `AddOnListProps`). Small UI primitives may use an inline or unexported `type`.
- Locale union is `"en" | "ar" | "es"`. Canonical names: `Locale` (`lib/copy/index.ts`, re-declared in `components/journey/types.ts`) and `DocumentLocale` (`lib/set-document-locale.ts`). Per-area aliases (`HomeLocale`, `GuestLocale`, `DashboardLocale`, `JourneyLocale`) are the same union; prefer `DocumentLocale` or `Locale` in new code.
- Shared journey contracts live in `components/journey/types.ts` (`JourneyValue`, `Destination`, `AddOnItem`, `CartLine`, `TeamMember`, `ImageRef`). Add new journey types there.
- Derived string-literal unions use `NonNullable<VariantProps<typeof button>["variant"]>` (`components/ui/button.tsx`) or `keyof typeof X`.

## Code Style

**Formatting:**
- No Prettier, ESLint, Biome or `.editorconfig` is configured. Formatting is by hand; match the surrounding file.
- 2-space indent, double quotes, semicolons, trailing commas in multiline literals and argument lists.
- Long Tailwind `className` strings and `cva` base strings stay on one line (no wrapping, no sorting plugin).
- TypeScript is `strict` (`tsconfig.json`). `npx tsc --noEmit` is the only static gate and it is clean. It covers `app`, `components`, `lib`, `tests/**/*.ts(x)` and `scripts` types; `.mjs` files are not type-checked. `framer-export/` is excluded.
- Do not add `any`, `@ts-ignore` or `@ts-expect-error` (none exist). One `// eslint-disable-next-line react-hooks/exhaustive-deps` remains in `components/journey/journey-bar.tsx` for the memoised popover anchor; ESLint itself is not installed.

**Linting:**
- None. Rules are enforced by tests instead: `tests/design-tokens.test.mjs` (styling), `tests/controls.test.mjs` (control markup), `tests/overlays.test.mjs` (z-layers, dismissal), `tests/harness-gate.test.mjs`, `tests/no-team-names.test.mjs`, `tests/phase-02-gates.test.mjs`. See `.planning/codebase/TESTING.md`.

## Styling and Design-System Rules (guarded by `tests/design-tokens.test.mjs`)

Tailwind v4 only, fed from `tokens.json`. The guard scans `app/`, `components/`, `lib/` (except `lib/copy/`, `lib/not-found-document.ts`, `route.ts` files, `.d.ts`) and fails the suite on any violation.

- **Single token source:** `tokens.json` -> `npm run tokens` -> the block between `/* GENERATED:THEME:START */` and `/* GENERATED:THEME:END */` in `app/globals.css`. Never hand-edit that block. `npm run tokens:check` fails when it drifts.
- **No CSS modules** (`*.module.css` is banned) and no class or id selectors in `app/globals.css` outside the generated block. `globals.css` must stay under 200 lines, start with `@layer theme, base, components, utilities;`, and keep every rule inside `@layer base`.
- **No raw hex** in scoped source: any `#rrggbb` must exist in `tokens.json`. Use utilities (`bg-teal`, `text-ink`, `bg-ivory`, `bg-surface`, `bg-teal-tint`, `border-line`, `text-muted`, `text-error`). Banned legacy strings: `Bricolage`, `Philosopher`, `#f9f6f3`, `#183e43`, `#a98e58`, `#0f677d`.
- **No arbitrary values:** any Tailwind class containing `[...]` fails (this also blocks raw px font sizes such as `text-[13px]`). Add a token to `tokens.json` instead.
- **Type scale is exactly seven steps:** `text-caption` 12, `text-label` 14, `text-body` 16, `text-title` 20, `text-heading` 32, `text-display` 48, `text-hero` 64. `hero`, `display`, `heading` shrink below 48rem in `app/globals.css` (`@layer base`). Fonts via `font-display` (Questa / Noto Naskh Arabic) and `font-body` (Lato / Noto Sans Arabic). `font-bold` is allowed only in `journey-cart.tsx`, `stepper.tsx`, `date-range-panel.tsx`, `journey-bar.tsx`, `journey-sheet.tsx`.
- **Square corners:** `--radius-control` and `--radius-overlay` are `0`. Write `rounded-none` explicitly on controls; any other `rounded-*` fails. 
- **Gold is a line only:** `border-gold`, `decoration-gold`, `border-t-2 border-gold` are fine; `bg-gold`, `text-gold`, `fill-gold`, `stroke-gold` (with or without opacity) fail.
- **No radio inputs** (`type="radio"` fails in `app/` and `components/`). One-of-many is `ToggleCardGroup` (buttons with `aria-pressed`, `components/ui/toggle-card.tsx`); on/off is `Switch` (`role="switch"`) or `Checkbox`.
- **Spacing scale:** padding, margin, gap, inset, top/bottom/start/end accept only `0, px, 0.5, 1, 2, 3, 4, 6, 8, 12, 16`. Fixed dimensions use named tokens: `h-control` (44px hit target), `h-chip`, `h-bar`, `h-bar-docked`, `h-summary`, `h-entry`, `h-action`, `h-sheet-head`, `w-menu`, `w-search`, `max-w-column`, `max-w-dialog`, `w-sidebar`, `h-row`, `dense:h-row-dense`.
- **Physical-direction utilities are banned:** no `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`. Use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `inset-s-`, `inset-e-`, `text-start`, `text-end`, `border-s`, `border-e`.
- **Other bans:** `.dark` selectors, `dangerouslySetInnerHTML`, `framerusercontent` URLs in non-route code.
- **Custom variants** (`app/globals.css`): `ar:` matches `:lang(ar)` (use `ar:normal-case ar:tracking-normal` next to every `uppercase tracking-kicker`), `dense:` matches `[data-density="dense"]`. Container queries (`@container`, `@6xl:`, `@2xl:`) are used in `components/ui/nav.tsx` and `components/ui/footer.tsx`.
- **Variants and merging:** class-variance-authority for variants, `cn()` from `lib/cn.ts` for merging. `cn` is `tailwind-merge` extended with the token groups; `TOKEN_GROUPS` in `lib/cn.ts` is a hand mirror of `tokens.json` and `tests/cn.test.mjs` fails on drift. Add a token to both.

  ```tsx
  const chip = cva("ui-chip relative h-chip px-4 border font-body text-label rounded-none", {
    variants: { on: { true: "bg-teal border-teal text-ivory", false: "border-muted text-ink bg-transparent" } },
    defaultVariants: { on: false },
  });
  // <button className={cn(chip({ on }), className)}>
  ```
- **Motion:** `duration-fast` / `duration-mid` with `ease-standard`; entrance animations pair `animate-panel-in motion-reduce:animate-fade-in`; skeleton pulses add `motion-reduce:animate-none`.
- **Focus:** the global `:focus-visible` rule (2px teal outline, 2px offset, `app/globals.css`) is the focus ring. Only `JourneySegment` (`shadow-rule-primary`) and `Field` (`shadow-selected` + teal border) replace it; `tests/journey/a11y.spec.ts` fails any other deviation.
- **Layering:** dialogs and sheets `z-70` with scrim `bg-ink/40`, WhatsApp `z-60`, toast `z-50` (these four are asserted in `tests/overlays.test.mjs`); journey popovers `z-45`, site nav `z-40`. No arbitrary `z-[..]`.
- **Legacy hook classes** `ui-button`, `ui-chip`, `ui-input`, `choice`, `field-*` remain on a few primitives as inert markers (no CSS targets them). Do not add new ones.
- **Passwords:** a password input goes through `Field type="password"` (`components/ui/field.tsx`), which renders the show/hide eye at the inline end. Guest sign-in is magic link only; no password field on guest screens (`tests/phase-03-guest.test.mjs`).

## Import Organization

**Order (observed):**
1. `"use client";` directive (first line, when needed)
2. `react` and `next/*`
3. Third-party (`radix-ui`, `@radix-ui/react-focus-scope`, `@internationalized/date`, `class-variance-authority`)
4. Sibling and parent UI components (`../ui/button`, `../icons/icons`)
5. `lib/` helpers (`../../lib/cn`, `../../lib/journey-format`)
6. Local siblings and `import type` lines last (`./date-range-panel`, `./types`)

**Path Aliases:**
- None. `tsconfig.json` has no `paths`. All imports are relative (`../../lib/cn`).
- Use `import type { ... }` for type-only imports, and inline `type` specifiers in mixed imports: `import { useState, type ReactNode } from "react";`.
- Radix is imported as the umbrella package: `import { Dialog, Popover, Select } from "radix-ui";` (`@radix-ui/react-focus-scope` is the one direct sub-package).
- Brand SVGs: `Stacked_Charcoal.svg`, `Poly_White.svg`, `Curves_White.svg` import as static-image objects, use `.src` (typed in `svg.d.ts`). `Curves_black.svg` and `Poly_Black.svg` import as markup strings (`asset/source` rule in `next.config.ts`) and become a data URL: `` `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}` ``. Never pass a static-image object through `encodeURIComponent` (becomes `[object Object]`; `tests/status-mark.spec.ts` guards it).
- Files that Node tests import directly (`lib/cn.ts`, `lib/journey-format.ts`, `lib/https-url.ts`, `lib/fx/rates.ts`, `lib/not-found-document.ts`, `lib/copy/<area>.ts`) must load under Node's native type stripping: erasable TypeScript only, no runtime relative imports without a file extension. `lib/journey-format.ts` has no imports on purpose. Tests never import `lib/copy/index.ts`.

## Error Handling

**Patterns:**
- Pure helpers that can fail return `null` (never throw, never invent a fallback): `parseWrittenAmount`, `convertWrittenAmount`, `loadRates` in `lib/fx/rates.ts`. Network reads sit in `try { ... } catch { return null; }` and validate the JSON shape before use. A feed failure falls back to the last cached value or `null`; no "rate unavailable" string exists anywhere (`tests/phase-03-fx.test.mjs`).
- Route handlers return explicit status codes and a JSON `{ ok: false }` body, no stack text: 400 bad input or honeypot hit, 503 missing `RESEND_API_KEY`, 502 upstream error, 404 in production (`app/newsletter/route.ts`). Success is `{ ok: true, id }` only when `data.id` is a non-empty string.
- Dev-only routes and pages gate on `process.env.NODE_ENV === "production"` and answer 404 (`notFound()` in pages; `new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })` in `route.ts`). Applies to `app/fx`, `app/newsletter`, `app/embed/*`, `app/account`, `app/login`, `app/bookings`, `app/booking/trip` and every `app/dashboard/**` page. The one exception is `app/%5F%5Fharness/page.tsx`, which gates on `ALMAR_HARNESS !== "1"` instead. Server `page.tsx` files stay server components (no `"use client"`) and delegate to the `<name>-screen.tsx` client component.
- Secrets come from `process.env` only. `.env.example` lists names with empty values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`). Never write a value into the repo. `tests/phase-02-gates.test.mjs` fails if the substrings `eyJ` or `re_` appear anywhere under `app/`, `components/`, `lib/`; avoid identifiers that contain them.
- UI validation is inline, never a thrown error: an error line with `role="alert"` (or the `Field` error `<p>`), `aria-invalid="true"` on the control, `aria-describedby` pointing at the message id (`components/journey/journey-bar.tsx`, `components/ui/field.tsx`, `components/ui/toggle-card.tsx`). Typing is never blocked: `canBecomeHttpsUrl` in `lib/https-url.ts` flags an https:// field only once the value can no longer become one.
- Missing provider is the one deliberate throw in components: `useToast()` throws `ToastProvider is missing` (`components/ui/toast.tsx`).
- Route error boundary: `app/error.tsx` renders `StatusFrame` with a `Try again` ghost `Button`; 404 is `app/not-found.tsx` plus the static `out/404.html` from `renderStaticNotFound()` in `lib/not-found-document.ts`.
- Build scripts (`scripts/*.mjs`) throw `Error` with a plain message, or `console.error` plus `process.exit(1)` (`scripts/generate-theme.mjs --check`).
- Never invent data: no seeded rows, no sample people, no real prices. Unknown amounts are brackets: `AED [PRICE]`, `AED [AMOUNT]`, `[RATE]%`. No file under `app/dashboard` or `lib` may be named `seed`. Publish buttons that have no backend are `<Button onClick={() => undefined}>`; do not fake a saved state (`tests/phase-03-catalog.test.mjs`, `tests/phase-03-content.test.mjs`).

## Logging

**Framework:** none. There is no `console.*` in `app/`, `components/`, `lib/`. Only `scripts/*.mjs` print (`console.log` / `console.error`). Do not add runtime logging without a decision.

## Comments

**When to Comment:**
- Exported component props get a one-line JSDoc stating behaviour or the contract, with the decision id in parentheses: `/** Fires only when destination and both dates are set. Never charges (D-37). */`.
- Props that exist only for tests are marked `Harness only:` (`initialOpen`, `forceMissing` in `JourneyBarProps`; `defaultOpen` in `JourneyCartProps`; `initialWarn` in `JourneySheetProps`; `placeholder` in `TeamSection`). Clock inputs are injectable as `today?: CalendarDate` with `/** Injectable for deterministic tests. */`.
- A file may open with a one-line provenance comment naming the plan and decisions: `// Journey copy catalogue (plan 03.1-10, D-08, D-33, D-52, D-58).` Decision ids (`D-nn`) and threat ids (`T-3.1-nn`) trace to `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-CONTEXT.md`.
- Explain why a non-obvious CSS or a11y choice exists (`// The 3px in-segment rule is the only exception to the 2px outline focus rule (D-36).`).
- No `TODO`, `FIXME`, `HACK` in code (none exist). Open work goes to `.planning/`.

**JSDoc/TSDoc:**
- `/** ... */` on exported functions and props; `//` for inline notes. No `@param` / `@returns` tags.

## Function Design

**Size:** helpers are small and pure and sit at module top (`pad`, `fmt`, `cmp`, `key`); a component keeps state and handlers inside and reads left to right: state, derived values, handlers, JSX. Large screens (`components/journey/journey-bar.tsx`, 359 lines; `components/specimens/hero-booker.tsx`, 572 lines) split by `size`/`variant` branches with early returns.

**Parameters:**
- Components take one destructured props object; defaults are set in the destructuring (`footer = true`, `size = "row"`, `busy = false`).
- Components that show text take `copy: JourneyCopy` and `locale: Locale` as props and never import the catalogue themselves (`components/journey/*`). Primitives take every visible string as a prop (`Stepper` `addLabel`/`removeLabel`, `Dialog` `title`/`closeLabel`).
- Controlled by default: `value` + `onChange`. Optional uncontrolled fallback via internal state only where a call site needs it (`Switch` `defaultChecked`, `SiteNav` `currency`).
- Variants are string unions via `cva` (`size: "hero" | "docked" | "summary"`), not booleans, except `journey`/`inline`/`on`/`muted` flags that toggle one style group.

**Return Values:** components return JSX or `null`; zero-item components render `null` (`TeamSection`, `InclusionsList`). Helpers return `string | number | null`. State changes go through callbacks, never mutation of props.

**Accessibility baked into components:**
- Icon-only controls have `aria-label`; SVGs are inline, `currentColor`, `aria-hidden="true"` unless given a `title` (`components/icons/icons.tsx`). Icons come from `components/icons/icons.tsx` only, sizes `16 | 20 | 24`.
- Steppers set `aria-disabled` (not `disabled`) at the bounds so focus stays (`components/ui/stepper.tsx`). Live counts use `aria-live="polite"`. Toggle buttons use `aria-pressed`. Hit targets are 44px (`size-control`, `min-h-control`).
- Dialogs trap focus with `FocusScope trapped loop`; `dismiss="confirm"` blocks Escape and outside press (`components/ui/dialog.tsx`, `components/ui/confirm-dialog.tsx`).
- Date text is Western numerals `DD/MM/YYYY`.

## Module Design

**Exports:**
- Named exports everywhere. Default export only for Next special files (`page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`). Route handlers export named `GET` / `POST` functions.
- Types are exported next to their component or from `components/journey/types.ts`.

**Barrel Files:**
- Only `lib/copy/index.ts` (`copy[locale].home | guest | dashboard | framerSource | journey`). Components import the file they need directly, there are no `index.ts` barrels in `components/`.

**`"use client"`:**
- First line of any file that uses hooks, event handlers, browser APIs or Radix. Server `page.tsx` files must not have it. A few existing leaf files use hooks without the directive (`components/ui/switch.tsx`, `components/ui/field.tsx`, `components/journey/inclusions-list.tsx`, `components/journey/team-section.tsx`); they work only because client modules import them. Do not copy that: add the directive to new hook-using files.

**Route handlers and Framer pages:**
- `app/<route>/route.ts` for the public marketing pages (home, about, blog posts, private stays, services...) are generated Framer HTML served verbatim (`export const dynamic = "force-static"` plus `export function GET()` returning `new Response(html, ...)`, up to ~670 KB each). Do not hand-edit or reformat them; the guard tests skip them. There is no `app/page.tsx` (`tests/phase-03-screens.test.mjs`).
- Real React screens are the dev-gated `app/account`, `app/login`, `app/bookings`, `app/booking/trip`, `app/dashboard/(ops)/**`.

## i18n and RTL

- **Copy lives in `lib/copy/*.ts`**, one `Record<Locale, Type>` per area. Journey copy is the model: an `EN` object literal, `type JourneyCopy = Widen<typeof EN>`, then `AR: JourneyCopy` and `ES: JourneyCopy` so the compiler rejects a missing key, and `tests/copy.test.mjs` rejects an empty string. Plurals are `{ one, two, few, many, other }` forms with `#` for the number, filled by `formatPlural`; named slots are `{name}`, filled by `fill()`; both in `lib/journey-format.ts`.
- **EN, AR and ES in the same pass for every string, label, alt text and aria-label.** AR is Gulf-friendly MSA and ES is neutral Latin American; both are drafts for owner review (`lib/copy/journey.ts` header). Do not translate owner-approved texts; use them verbatim.
- **Arabic is RTL** via `document.documentElement.dir` set by `setDocumentLocale()` (`lib/set-document-locale.ts`), which also swaps in the Noto font classes. Locale persists in the `almar-locale` cookie (`SameSite=Lax`, one year). Layout uses logical utilities only (see bans above). Directional glyphs (chevron, arrow, search) carry `rtl:-scale-x-100`; plus, minus, check, close never flip (`tests/journey/rtl.spec.ts`).
- Latin values inside Arabic text (dates `12/10/2026`, references `ALMAR-000000`) sit in `<bdi dir="ltr">` or `<bdi>`.
- Numbers are Western digits in all locales: `ar-AE-u-nu-latn` (`lib/format.ts`, `lib/journey-format.ts`); Arabic calendar stays Gregorian (`ar-AE-u-ca-gregory-nu-latn`); weeks start Monday (`getDayOfWeek(date, "fr-FR")` or `"en-GB"`). Dates use `@internationalized/date` `CalendarDate`, never JS `Date` arithmetic across zones; the dashboard calendar uses `Asia/Dubai`.
- Radix does not read document direction: pass `dir` explicitly (`LocaleSelect` derives it from the language).

## Known Drift (do not copy; fix when touching)

- Hard-coded English in older primitives: `components/ui/footer.tsx`, `components/ui/nav.tsx` (`DEFAULT_LABELS`), `components/ui/field.tsx` (`Apply`, `optional`, `Hide password` / `Show password`), `components/ui/toast.tsx` (`Dismiss`), `components/ui/sidebar.tsx` (`Close`), `components/ui/whatsapp.tsx` (`WhatsApp`), `app/layout.tsx` (`Skip to content`), dashboard screens (`app/dashboard/(ops)/**`: `Date range`, `Reminders`, `Charts`, stay editor labels). New code takes copy through `lib/copy` and props.
- Local `COPY` tables in `app/account/account-screen.tsx` and `app/login/sign-in-screen.tsx` duplicate `GUEST_COPY` in `lib/copy/guest.ts` and are not covered by `tests/copy.test.mjs`. Use `lib/copy`.
- `bg-white` (not the `surface` token) in `app/dashboard/(ops)/home/home-screen.tsx`; the guard does not catch Tailwind default colours. Use `bg-surface`.
- Duplicated helpers: `pad` / `fmt` / `bdi` / `fillNodes` in `components/journey/journey-bar.tsx`, `journey-sheet.tsx`, `date-range-panel.tsx`; `fill` in `components/specimens/hero-booker.tsx` vs `lib/journey-format.ts`; `formatDate` in `lib/format.ts` vs `components/ui/calendar.tsx`. Reuse `lib/journey-format.ts`.
- Inline `style={{...}}` appears twice (`app/%5F%5Fharness/harness-client.tsx`, `app/dashboard/(ops)/layout.tsx` safe-area padding). Prefer utilities.
- The design skills named in `.claude/rules/connections.md` (`better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, `better-writing`) are global Claude skills, not project files; `.claude/skills/` and `.agents/skills/` do not exist in this repo.

---

*Convention analysis: 2026-10-02*
