# Phase 1: Design system - Context

**Gathered:** 2026-09-23
**Status:** Discussion in progress — do not plan yet. Resume remaining gray areas.

<domain>
## Phase Boundary

Tokens, core components, RTL states, owner `/design`. No booking screens. Framer HTML stays until Phase 6. Settings → Brand publish is Phase 5 (DSGN-04).

</domain>

<decisions>
## Implementation Decisions

Locked this session. Do not re-ask.

### Token model
- **D-01:** Semantic tokens + brand primitives (`--fg`, `--accent`, plus raw teal/gold/ivory/charcoal)
- **D-02:** 4px spacing grid, snapped from live Framer measure
- **D-03:** One token set; ops uses compact density
- **D-04:** Concentric radius + shadow scale from Framer measure
- **D-05:** Motion 150 / 250 / 400ms + `prefers-reduced-motion`
- **D-06:** Tailwind default breakpoints
- **D-07:** CSS variables wired through Tailwind `@theme`
- **D-08:** Focus ring = teal 2px offset (Claude discretion)

### Type + color
- **D-09:** Questa = display/headings; Lato = body/UI/forms (Latin)
- **D-10:** Brand book for display sizes; Framer-measured for UI sizes (Claude discretion — user said pick best fit)
- **D-11:** Gold = CTAs, rules, icons, focus — never body text
- **D-12:** Ivory page; white cards/inputs; teal as heading ink
- **D-13:** Teal headings, charcoal body
- **D-14:** Links teal, gold on hover
- **D-15:** Semantic status red / green / amber (not gold)
- **D-16:** Disabled = lower opacity, no pointer, text still readable
- **D-17:** AR only: Noto Naskh headings + Noto Sans Arabic UI (Questa/Lato have no Arabic glyphs)
- **D-18:** Primary button = gold fill, teal label
- **D-19:** Secondary = teal outline; ghost = text only
- **D-20:** 44px min hit area; ops compact density

### Component kit (partial)
- **D-21:** Custom visuals; Radix only for a11y primitives (dialog, listbox, focus trap); not shadcn (Claude discretion)
- **D-22:** `/design` = one long page with jump links per component
- **D-23:** Trace `brand/Icons` to SVG components, token color
- **D-24:** Date range = luxury overlay calendar, week starts Monday

### Claude's Discretion
- D-08 focus ring (teal 2px offset)
- D-10 type sizes (brand book display + Framer UI)
- D-21 component internals (custom + Radix a11y only)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product
- `.planning/PROJECT.md` — design-system Active items, fonts, colors
- `.planning/REQUIREMENTS.md` — DSGN-01..07, PLAT-05
- `.planning/ROADMAP.md` — Phase 1
- `.planning/research/SUMMARY.md` — Tailwind + CSS variables; no shadcn default

### Brand
- `brand/Brand Guideline.pdf`
- `brand/Font/` — Questa, Lato
- `brand/Icons/`
- `brand/Colors/`
- `brand/Logo Monogram/`
- `brand/Logo Typography/`

### Checkpoint (resume)
- `.planning/phases/01-design-system/01-DISCUSS-CHECKPOINT.json`
- `.planning/phases/01-design-system/RESUME-PROMPT.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. No components, no Tailwind, no `layout.tsx`.
- Brand files in `brand/`. Hashed Framer assets in `public/assets/` (do not rename hashes while Framer routes still reference them).

### Established Patterns
- Current site is Framer HTML `route.ts` dumps. Phase 1 adds a React island (`/design`) beside them. Do not patch HTML strings.
- `.planning/codebase/CONVENTIONS.md` “do not add page.tsx” is superseded by PROJECT.md rebuild.

### Integration Points
- New `app/design/` (owner-gated). Root `layout.tsx` required once any `page.tsx` exists; Framer `/` can stay `app/route.ts` until Phase 6.

</code_context>

<specifics>
## Specific Ideas

- User: every discuss question must have clickable options plus Other to type — never a type-only box.
- User: ask many design questions, not only 4 per area — this phase covers most of the build.
- Password eye: right-side / inline-end — already locked in PROJECT.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Still to discuss (resume here)
- Guest stepper (adults / children / infants)
- Modal vs drawer
- Toasts (position, duration)
- Input labels (above vs floating)
- Select / checkbox / radio look
- Stay card, add-on row, price component
- Nav / footer
- `/design` gate before auth exists (Phase 2)
- Font loading (self-host `brand/Font` vs `next/font`)
- Empty / error / loading patterns
- Overlay scrim, hover/press, tabular nums, truncation

</deferred>

---
*Phase: 1-Design system*
*Context gathered: 2026-09-23 (partial — resume remaining)*
