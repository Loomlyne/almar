# Phase 1: Design system - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 1-Design system
**Areas discussed:** Token model, Type + color, Component kit (partial)
**Status:** Interrupted — remaining gray areas not asked yet

---

## Token model

| Option | Selected |
|--------|----------|
| Semantic + brand primitives | ✓ |
| 4px grid snapped from Framer | ✓ |
| One token set + compact ops | ✓ |
| Concentric radius + shadow from Framer | ✓ |
| Motion 150/250/400ms + reduced-motion | ✓ |
| Tailwind default breakpoints | ✓ |
| CSS variables via Tailwind @theme | ✓ |
| Focus ring You decide → teal 2px offset | ✓ discretion |

---

## Type + color

| Option | Selected |
|--------|----------|
| Questa headings, Lato body/UI | ✓ |
| Type sizes You pick best fit → book display + Framer UI | ✓ discretion |
| Gold CTAs/rules/icons/focus, never body | ✓ |
| Ivory page, white cards/inputs, teal ink | ✓ |
| Teal headings, charcoal body | ✓ |
| Links teal, gold hover | ✓ |
| Semantic red/green/amber | ✓ |
| Disabled lower opacity, readable | ✓ |
| AR: Noto Naskh headings + Noto Sans Arabic UI | ✓ |
| Primary gold fill, teal label | ✓ |
| Secondary teal outline; ghost text | ✓ |
| 44px min hit; ops compact | ✓ |

**Notes:** Questa/Lato have no Arabic glyphs. User asked why, then picked Noto pair.

---

## Component kit (partial)

| Option | Selected |
|--------|----------|
| Internals You decide → custom + Radix a11y only, not shadcn | ✓ discretion |
| /design one long page + jump links | ✓ |
| Trace brand icons to SVG, token color | ✓ |
| Date overlay calendar, week Monday | ✓ |

**Notes:** User required every question to include clickable choices plus Other. Type-only pickers were rejected.

---

## Claude's Discretion

- Focus ring: teal 2px offset
- Type sizes: brand book display + Framer UI
- Internals: custom visuals, Radix for dialog/listbox/focus trap only

## Deferred Ideas

None
