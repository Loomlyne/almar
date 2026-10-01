# Phase 1: Design system - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 1-Design system
**Areas discussed:** Token model, Type + color rules, Component kit

---

## Token model

### How should tokens be named?

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic + brand primitives (—fg, —accent, plus teal/gold as raw) | Semantic + brand primitives (—fg, —accent, plus teal/gold as raw) |  |
| Brand names only (teal, gold, ivory, charcoal) | Brand names only (teal, gold, ivory, charcoal) |  |
| You decide | You decide |  |
| Semantic + brand primitives (fg, accent, plus teal/gold as raw) | Typed answer | ✓ |

**User's choice:** Semantic + brand primitives (fg, accent, plus teal/gold as raw)

---

### Spacing scale?

| Option | Description | Selected |
|--------|-------------|----------|
| 4px grid, snapped from live Framer measure | 4px grid, snapped from live Framer measure | ✓ |
| Use Framer values as-is (even if uneven) | Use Framer values as-is (even if uneven) |  |
| You decide | You decide |  |

**User's choice:** 4px grid, snapped from live Framer measure

---

### Public vs ops density?

| Option | Description | Selected |
|--------|-------------|----------|
| One token set + compact density on ops | One token set + compact density on ops | ✓ |
| Two full token sets (public and ops) | Two full token sets (public and ops) |  |
| You decide | You decide |  |

**User's choice:** One token set + compact density on ops

---

### Radius and shadow?

| Option | Description | Selected |
|--------|-------------|----------|
| Concentric radius + shadow scale from Framer measure | Concentric radius + shadow scale from Framer measure | ✓ |
| Simple sm / md / lg only | Simple sm / md / lg only |  |
| You decide | You decide |  |

**User's choice:** Concentric radius + shadow scale from Framer measure

---

### Motion tokens?

| Option | Description | Selected |
|--------|-------------|----------|
| Short luxury (150 / 250 / 400ms) + reduced-motion | Short luxury (150 / 250 / 400ms) + reduced-motion | ✓ |
| Match Framer / Lenis feel as closely as possible | Match Framer / Lenis feel as closely as possible |  |
| You decide | You decide |  |

**User's choice:** Short luxury (150 / 250 / 400ms) + reduced-motion

---

### Breakpoints?

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind defaults | Tailwind defaults | ✓ |
| Measure Framer breakpoints and use those | Measure Framer breakpoints and use those |  |
| You decide | You decide |  |

**User's choice:** Tailwind defaults

---

### Where do tokens live?

| Option | Description | Selected |
|--------|-------------|----------|
| CSS variables wired through Tailwind @theme | CSS variables wired through Tailwind @theme | ✓ |
| :root CSS only (no Tailwind theme map) | :root CSS only (no Tailwind theme map) |  |
| You decide | You decide |  |

**User's choice:** CSS variables wired through Tailwind @theme

---

### Focus ring?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal 2px offset ring | Teal 2px offset ring |  |
| Gold 2px offset ring | Gold 2px offset ring |  |
| You decide | You decide |  |
| You decide → teal 2px offset ring | Typed answer | ✓ |

**User's choice:** You decide → teal 2px offset ring

---

## Type + color rules

### Questa vs Lato — who does what?

| Option | Description | Selected |
|--------|-------------|----------|
| Questa display/headings, Lato body/UI/forms | Questa display/headings, Lato body/UI/forms | ✓ |
| Questa almost everywhere, Lato only small UI | Questa almost everywhere, Lato only small UI |  |
| You decide | You decide |  |

**User's choice:** Questa display/headings, Lato body/UI/forms

---

### Type sizes?

| Option | Description | Selected |
|--------|-------------|----------|
| Brand book for display, Framer-measured for UI | Brand book for display, Framer-measured for UI |  |
| Follow Brand Guideline.pdf scale only | Follow Brand Guideline.pdf scale only |  |
| Follow live Framer sizes only | Follow live Framer sizes only |  |
| You decide | You decide |  |
| You pick best fit → brand book for display, Framer-measured for UI | Typed answer | ✓ |

**User's choice:** You pick best fit → brand book for display, Framer-measured for UI

---

### Where does gold show up?

| Option | Description | Selected |
|--------|-------------|----------|
| CTAs, rules, icons, focus — never body text | CTAs, rules, icons, focus — never body text | ✓ |
| Headings can be gold too | Headings can be gold too |  |
| You decide | You decide |  |

**User's choice:** CTAs, rules, icons, focus — never body text

---

### Surfaces (backgrounds)?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory page, white cards/inputs, teal ink | Ivory page, white cards/inputs, teal ink | ✓ |
| Ivory everywhere (cards included) | Ivory everywhere (cards included) |  |
| You decide | You decide |  |

**User's choice:** Ivory page, white cards/inputs, teal ink

---

### Primary ink (headings / body)?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal headings, charcoal body | Teal headings, charcoal body | ✓ |
| Teal for both headings and body | Teal for both headings and body |  |
| Charcoal for both, teal only on accents | Charcoal for both, teal only on accents |  |
| You decide | You decide |  |

**User's choice:** Teal headings, charcoal body

---

### Link color?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal, gold on hover | Teal, gold on hover | ✓ |
| Gold links, teal on hover | Gold links, teal on hover |  |
| Same as body, underline only | Same as body, underline only |  |
| You decide | You decide |  |

**User's choice:** Teal, gold on hover

---

### Status colors (error / success / warning)?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate semantic red / green / amber (not gold) | Separate semantic red / green / amber (not gold) | ✓ |
| Tint brand teal/gold only — no extra palette | Tint brand teal/gold only — no extra palette |  |
| You decide | You decide |  |

**User's choice:** Separate semantic red / green / amber (not gold)

---

### Disabled look?

| Option | Description | Selected |
|--------|-------------|----------|
| Lower opacity, no pointer, text still readable | Lower opacity, no pointer, text still readable | ✓ |
| Grey fill + grey text | Grey fill + grey text |  |
| You decide | You decide |  |

**User's choice:** Lower opacity, no pointer, text still readable

---

### Arabic type (used only when language is AR)?

| Option | Description | Selected |
|--------|-------------|----------|
| Noto Naskh headings + Noto Sans Arabic for UI | Noto Naskh headings + Noto Sans Arabic for UI | ✓ |
| IBM Plex Sans Arabic for both headings and UI | IBM Plex Sans Arabic for both headings and UI |  |
| Cairo / Tajawal (common GCC UI) | Cairo / Tajawal (common GCC UI) |  |
| You decide | You decide |  |

**User's choice:** Noto Naskh headings + Noto Sans Arabic for UI
**Notes:** Questa/Lato have no Arabic glyphs. AR locale only.

---

### Primary button?

| Option | Description | Selected |
|--------|-------------|----------|
| Gold fill, teal label | Gold fill, teal label | ✓ |
| Teal fill, ivory label | Teal fill, ivory label |  |
| Gold outline, teal label | Gold outline, teal label |  |
| You decide | You decide |  |

**User's choice:** Gold fill, teal label

---

### Secondary and ghost buttons?

| Option | Description | Selected |
|--------|-------------|----------|
| Secondary = teal outline; ghost = text only | Secondary = teal outline; ghost = text only | ✓ |
| Secondary = white fill + teal border; ghost = text only | Secondary = white fill + teal border; ghost = text only |  |
| You decide | You decide |  |

**User's choice:** Secondary = teal outline; ghost = text only

---

### Default control size (inputs, buttons)?

| Option | Description | Selected |
|--------|-------------|----------|
| 44px min hit; ops uses compact density | 44px min hit; ops uses compact density | ✓ |
| 48px luxury everywhere | 48px luxury everywhere |  |
| 40px public, 36px ops | 40px public, 36px ops |  |
| You decide | You decide |  |

**User's choice:** 44px min hit; ops uses compact density

---

## Component kit

### Component internals?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom React + tokens (no Radix/shadcn) | Custom React + tokens (no Radix/shadcn) |  |
| Headless Radix, restyled with tokens | Headless Radix, restyled with tokens |  |
| You decide | You decide |  |
| You decide → custom visuals; Radix only for a11y primitives (dialog, listbox, focus trap). Not shadcn. | Typed answer | ✓ |

**User's choice:** You decide → custom visuals; Radix only for a11y primitives (dialog, listbox, focus trap). Not shadcn.

---

### /design page layout?

| Option | Description | Selected |
|--------|-------------|----------|
| One long page, jump links per component | One long page, jump links per component | ✓ |
| Sidebar nav, one component per section | Sidebar nav, one component per section |  |
| You decide | You decide |  |

**User's choice:** One long page, jump links per component

---

### Icons (from brand/Icons)?

| Option | Description | Selected |
|--------|-------------|----------|
| Trace brand-book icons to SVG components, token color | Trace brand-book icons to SVG components, token color | ✓ |
| Use brand JPGs as-is | Use brand JPGs as-is |  |
| You decide | You decide |  |

**User's choice:** Trace brand-book icons to SVG components, token color

---

### Date range picker look?

| Option | Description | Selected |
|--------|-------------|----------|
| Luxury overlay calendar, week starts Monday | Luxury overlay calendar, week starts Monday | ✓ |
| Inline calendar in the form | Inline calendar in the form |  |
| You decide | You decide |  |

**User's choice:** Luxury overlay calendar, week starts Monday

---

### Guest stepper: how does Who work?

| Option | Description | Selected |
|--------|-------------|----------|
| Popover from the Who field: minus, count, plus for adults, children, and infants; at max, show the reason under that row | Popover from the Who field: minus, count, plus for adults, children, and infants; at max, show the reason under that row |  |
| Three steppers always visible in the hero, no popover | Three steppers always visible in the hero, no popover | ✓ |
| You decide | You decide |  |

**User's choice:** Three steppers always visible in the hero, no popover

---

### Overlays (confirm, stay pick): modal or drawer?

| Option | Description | Selected |
|--------|-------------|----------|
| Centered modal on desktop, end drawer on small screens (end flips in Arabic) | Centered modal on desktop, end drawer on small screens (end flips in Arabic) | ✓ |
| Always a centered modal | Always a centered modal |  |
| Always a drawer from the end | Always a drawer from the end |  |
| You decide | You decide |  |

**User's choice:** Centered modal on desktop, end drawer on small screens (end flips in Arabic)

---

### Toasts: where, and how long?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom center, 4 seconds, pause on hover, stack up to 3 | Bottom center, 4 seconds, pause on hover, stack up to 3 | ✓ |
| Top end (flips in Arabic), 5 seconds, then gone | Top end (flips in Arabic), 5 seconds, then gone |  |
| Bottom end, stay until dismissed | Bottom end, stay until dismissed |  |
| You decide | You decide |  |

**User's choice:** Bottom center, 4 seconds, pause on hover, stack up to 3

---

### Input labels: where do they sit?

| Option | Description | Selected |
|--------|-------------|----------|
| Label above the field, always visible; placeholder is an example, not the name | Label above the field, always visible; placeholder is an example, not the name | ✓ |
| Floating label inside the field, rests above on focus | Floating label inside the field, rests above on focus |  |
| You decide | You decide |  |

**User's choice:** Label above the field, always visible; placeholder is an example, not the name

---

### Select, checkbox, and radio: what do they look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom: square checkbox and round radio, teal when on; select is a field with a chevron and a list in the same overlay as other dialogs | Custom: square checkbox and round radio, teal when on; select is a field with a chevron and a list in the same overlay as other dialogs | ✓ |
| Native browser controls, tinted teal | Native browser controls, tinted teal |  |
| You decide | You decide |  |

**User's choice:** Custom: square checkbox and round radio, teal when on; select is a field with a chevron and a list in the same overlay as other dialogs

---

### Stay card inside the pick overlay?

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal row: image, name, price, and the reason if it cannot be booked (never hidden) | Horizontal row: image, name, price, and the reason if it cannot be booked (never hidden) | ✓ |
| Vertical cards in a grid | Vertical cards in a grid |  |
| You decide | You decide |  |

**User's choice:** Horizontal row: image, name, price, and the reason if it cannot be booked (never hidden)

---

### Add-on row?

| Option | Description | Selected |
|--------|-------------|----------|
| One row: name, one short line, price at the end, checkbox. Included add-ons stay on and cannot be unchecked | One row: name, one short line, price at the end, checkbox. Included add-ons stay on and cannot be unchecked |  |
| Cards in a grid, same included rule | Cards in a grid, same included rule | ✓ |
| You decide | You decide |  |

**User's choice:** Cards in a grid, same included rule
**Notes:** Included add-ons stay on and cannot be unchecked

---

### Price block?

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked lines (nights, add-ons, coupon, subtotal, VAT, total), amounts at the end, grand total larger, then deposit or pay in full | Stacked lines (nights, add-ons, coupon, subtotal, VAT, total), amounts at the end, grand total larger, then deposit or pay in full | ✓ |
| One total, full breakdown behind a toggle | One total, full breakdown behind a toggle |  |
| You decide | You decide |  |

**User's choice:** Stacked lines (nights, add-ons, coupon, subtotal, VAT, total), amounts at the end, grand total larger, then deposit or pay in full

---

### Nav?

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky ivory header. Desktop: inline links. Small screens: end drawer, same overlay as other dialogs | Sticky ivory header. Desktop: inline links. Small screens: end drawer, same overlay as other dialogs | ✓ |
| Static header. Small screens: full-screen menu | Static header. Small screens: full-screen menu |  |
| You decide | You decide |  |

**User's choice:** Sticky ivory header. Desktop: inline links. Small screens: end drawer, same overlay as other dialogs

---

### Footer?

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop columns: brand, links, List with us, newsletter. Small screens: stacked. Keep the current contact | Desktop columns: brand, links, List with us, newsletter. Small screens: stacked. Keep the current contact | ✓ |
| One stacked column on every size | One stacked column on every size |  |
| You decide | You decide |  |

**User's choice:** Desktop columns: brand, links, List with us, newsletter. Small screens: stacked. Keep the current contact

---

### /design before sign-in exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Local only until Phase 2 auth. No public URL. No password in the repo | Local only until Phase 2 auth. No public URL. No password in the repo | ✓ |
| Ship the route with no gate, and do not deploy until auth | Ship the route with no gate, and do not deploy until auth |  |
| You decide | You decide |  |

**User's choice:** Local only until Phase 2 auth. No public URL. No password in the repo

---

### How do Questa and Lato load?

| Option | Description | Selected |
|--------|-------------|----------|
| next/font/local from brand/Font. Arabic Noto via next/font, only when language is AR | next/font/local from brand/Font. Arabic Noto via next/font, only when language is AR | ✓ |
| CSS @font-face only, no next/font | CSS @font-face only, no next/font |  |
| You decide | You decide |  |

**User's choice:** next/font/local from brand/Font. Arabic Noto via next/font, only when language is AR

---

### Empty, error, and loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty: ivory, one line, one action. Field error: semantic red under the label. Page error: toast. Loading: skeleton on cards and lists, spinner on the pressed button | Empty: ivory, one line, one action. Field error: semantic red under the label. Page error: toast. Loading: skeleton on cards and lists, spinner on the pressed button | ✓ |
| Spinners only. Empty is one line with no action. Errors only in toasts | Spinners only. Empty is one line with no action. Errors only in toasts |  |
| You decide | You decide |  |

**User's choice:** Empty: ivory, one line, one action. Field error: semantic red under the label. Page error: toast. Loading: skeleton on cards and lists, spinner on the pressed button

---

### Overlay scrim?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal at low opacity. Click outside closes pickers. Confirm and pay do not close on scrim click | Charcoal at low opacity. Click outside closes pickers. Confirm and pay do not close on scrim click | ✓ |
| Same scrim. Click outside always closes | Same scrim. Click outside always closes |  |
| You decide | You decide |  |

**User's choice:** Charcoal at low opacity. Click outside closes pickers. Confirm and pay do not close on scrim click

---

### Button and card hover and press?

| Option | Description | Selected |
|--------|-------------|----------|
| No lift, no scale. Hover darkens slightly. Press darkens more. 150ms | No lift, no scale. Hover darkens slightly. Press darkens more. 150ms | ✓ |
| Cards lift on hover. Press scales to 0.98 | Cards lift on hover. Press scales to 0.98 |  |
| You decide | You decide |  |

**User's choice:** No lift, no scale. Hover darkens slightly. Press darkens more. 150ms

---

### Prices, dates, and counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Tabular numbers so columns do not jump. Western numerals | Tabular numbers so columns do not jump. Western numerals | ✓ |
| Proportional numbers | Proportional numbers |  |
| You decide | You decide |  |

**User's choice:** Tabular numbers so columns do not jump. Western numerals

---

### Long names and labels?

| Option | Description | Selected |
|--------|-------------|----------|
| One line, ellipsis. Full text on focus. Prices never truncate | One line, ellipsis. Full text on focus. Prices never truncate |  |
| Wrap to two lines, then ellipsis. Prices never truncate | Wrap to two lines, then ellipsis. Prices never truncate | ✓ |
| You decide | You decide |  |

**User's choice:** Wrap to two lines, then ellipsis. Prices never truncate

---

### Infants in the hero, before a stay is chosen?

| Option | Description | Selected |
|--------|-------------|----------|
| Always show the infants stepper. After a stay is chosen, if infants are off, lock it and show the reason | Always show the infants stepper. After a stay is chosen, if infants are off, lock it and show the reason | ✓ |
| Hide infants until a stay is chosen | Hide infants until a stay is chosen |  |
| You decide | You decide |  |

**User's choice:** Always show the infants stepper. After a stay is chosen, if infants are off, lock it and show the reason

---

### Language and currency in the header?

| Option | Description | Selected |
|--------|-------------|----------|
| Text only: EN / AR / ES and AED / USD / EUR. No flags | Text only: EN / AR / ES and AED / USD / EUR. No flags |  |
| Two compact dropdowns | Two compact dropdowns | ✓ |
| You decide | You decide |  |

**User's choice:** Two compact dropdowns

---

### WhatsApp button?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed bottom-end, round, sits above toasts. Opens the locked number | Fixed bottom-end, round, sits above toasts. Opens the locked number | ✓ |
| Fixed bottom-start, same look | Fixed bottom-start, same look |  |
| You decide | You decide |  |

**User's choice:** Fixed bottom-end, round, sits above toasts. Opens the locked number

---

### Links?

| Option | Description | Selected |
|--------|-------------|----------|
| No underline. Teal, gold on hover. Focus uses the teal ring | No underline. Teal, gold on hover. Focus uses the teal ring | ✓ |
| Underlined always | Underlined always |  |
| Underline on hover only | Underline on hover only |  |
| You decide | You decide |  |

**User's choice:** No underline. Teal, gold on hover. Focus uses the teal ring

---

### Danger actions (cancel, delete)?

| Option | Description | Selected |
|--------|-------------|----------|
| Red outline, charcoal label. Not a gold or teal fill | Red outline, charcoal label. Not a gold or teal fill | ✓ |
| Red fill, ivory label | Red fill, ivory label |  |
| No separate style. Use the secondary button | No separate style. Use the secondary button |  |
| You decide | You decide |  |

**User's choice:** Red outline, charcoal label. Not a gold or teal fill

---

### Page sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory full width. Content in a centered column. Gold rule between sections | Ivory full width. Content in a centered column. Gold rule between sections | ✓ |
| Stacked white cards. No rules | Stacked white cards. No rules |  |
| You decide | You decide |  |

**User's choice:** Ivory full width. Content in a centered column. Gold rule between sections

---

### Stay-row image?

| Option | Description | Selected |
|--------|-------------|----------|
| 4:3 on the start side. Cover crop. Start flips in Arabic | 4:3 on the start side. Cover crop. Start flips in Arabic | ✓ |
| Square on the start side | Square on the start side |  |
| You decide | You decide |  |

**User's choice:** 4:3 on the start side. Cover crop. Start flips in Arabic

---

### Header logo?

| Option | Description | Selected |
|--------|-------------|----------|
| Wordmark on desktop. Monogram on small screens. Both from brand/ | Wordmark on desktop. Monogram on small screens. Both from brand/ | ✓ |
| Wordmark at every size | Wordmark at every size |  |
| Monogram at every size | Monogram at every size |  |
| You decide | You decide |  |

**User's choice:** Wordmark on desktop. Monogram on small screens. Both from brand/

---

### How do amounts read?

| Option | Description | Selected |
|--------|-------------|----------|
| Code before the amount. Comma thousands. Two decimals only when not whole | Code before the amount. Comma thousands. Two decimals only when not whole | ✓ |
| Code after the amount | Code after the amount |  |
| You decide | You decide |  |

**User's choice:** Code before the amount. Comma thousands. Two decimals only when not whole

---

### How do overlays close?

| Option | Description | Selected |
|--------|-------------|----------|
| X at the end of the header. Escape closes. End flips in Arabic | X at the end of the header. Escape closes. End flips in Arabic | ✓ |
| No X. Escape, and scrim where scrim-close is allowed | No X. Escape, and scrim where scrim-close is allowed |  |
| You decide | You decide |  |

**User's choice:** X at the end of the header. Escape closes. End flips in Arabic

---

### 404?

| Option | Description | Selected |
|--------|-------------|----------|
| Questa heading, one line, one link home. Same quiet empty pattern | Questa heading, one line, one link home. Same quiet empty pattern |  |
| Illustrated full page | Illustrated full page | ✓ |
| You decide | You decide |  |

**User's choice:** Illustrated full page
**Notes:** Follow-up locked the illustration: large brand monogram on ivory, Questa line, one link home. No stock photo

---

### 404 illustration?

| Option | Description | Selected |
|--------|-------------|----------|
| Large brand monogram on ivory, Questa line, one link home. No stock photo | Large brand monogram on ivory, Questa line, one link home. No stock photo | ✓ |
| Layout only this phase. Art comes later | Layout only this phase. Art comes later |  |
| You decide | You decide |  |

**User's choice:** Large brand monogram on ivory, Questa line, one link home. No stock photo

---

### WhatsApp button colors?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal fill, gold icon. Not the green WhatsApp bubble | Teal fill, gold icon. Not the green WhatsApp bubble |  |
| Official WhatsApp green | Official WhatsApp green | ✓ |
| You decide | You decide |  |

**User's choice:** Official WhatsApp green
**Notes:** Exception to teal/gold controls

---

### Skeleton while cards load?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory pulse on the white card. No shimmer | Ivory pulse on the white card. No shimmer | ✓ |
| Teal shimmer | Teal shimmer |  |
| You decide | You decide |  |

**User's choice:** Ivory pulse on the white card. No shimmer

---

### What is inside a toast?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon plus one line. No title and body | Icon plus one line. No title and body | ✓ |
| Text only | Text only |  |
| You decide | You decide |  |

**User's choice:** Icon plus one line. No title and body

---

### Input border?

| Option | Description | Selected |
|--------|-------------|----------|
| White fill, hairline charcoal border. Focus uses the teal ring, not a second border color | White fill, hairline charcoal border. Focus uses the teal ring, not a second border color | ✓ |
| White fill, gold line under the field, no box | White fill, gold line under the field, no box |  |
| You decide | You decide |  |

**User's choice:** White fill, hairline charcoal border. Focus uses the teal ring, not a second border color

---

### How do we mark required fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Asterisk after the label, charcoal. Optional fields say optional | Asterisk after the label, charcoal. Optional fields say optional | ✓ |
| No asterisk. Only optional fields are marked | No asterisk. Only optional fields are marked |  |
| You decide | You decide |  |

**User's choice:** Asterisk after the label, charcoal. Optional fields say optional

---

### Section column width?

| Option | Description | Selected |
|--------|-------------|----------|
| Measure the live Framer site and snap to the 4px grid | Measure the live Framer site and snap to the 4px grid | ✓ |
| Fixed 1120px | Fixed 1120px |  |
| You decide | You decide |  |

**User's choice:** Measure the live Framer site and snap to the 4px grid

---

### Stepper minimums?

| Option | Description | Selected |
|--------|-------------|----------|
| Adults cannot go below 1. Children and infants can be 0. Minus disables at the floor | Adults cannot go below 1. Children and infants can be 0. Minus disables at the floor | ✓ |
| All three can be 0 | All three can be 0 |  |
| You decide | You decide |  |

**User's choice:** Adults cannot go below 1. Children and infants can be 0. Minus disables at the floor

---

### Active nav link?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal text, gold rule under it. No pill | Teal text, gold rule under it. No pill | ✓ |
| Gold text, no rule | Gold text, no rule |  |
| You decide | You decide |  |

**User's choice:** Teal text, gold rule under it. No pill

---

### Add-on card?

| Option | Description | Selected |
|--------|-------------|----------|
| Image on top, name, one line, price, checkbox. Included stays checked and locked | Image on top, name, one line, price, checkbox. Included stays checked and locked | ✓ |
| No image. Name, one line, price, checkbox | No image. Name, one line, price, checkbox |  |
| You decide | You decide |  |

**User's choice:** Image on top, name, one line, price, checkbox. Included stays checked and locked

---

### Ops compact density?

| Option | Description | Selected |
|--------|-------------|----------|
| Tighter type and padding. Hit target stays 44px | Tighter type and padding. Hit target stays 44px | ✓ |
| 36px hit in ops | 36px hit in ops |  |
| You decide | You decide |  |

**User's choice:** Tighter type and padding. Hit target stays 44px

---

### Primary button on small screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Full width of the column. Ops buttons still hug the label | Full width of the column. Ops buttons still hug the label | ✓ |
| Hug the label everywhere | Hug the label everywhere |  |
| You decide | You decide |  |

**User's choice:** Full width of the column. Ops buttons still hug the label

---

### Add-on image?

| Option | Description | Selected |
|--------|-------------|----------|
| 16:9 on top. Cover crop | 16:9 on top. Cover crop | ✓ |
| 4:3 on top, same as the stay row | 4:3 on top, same as the stay row |  |
| You decide | You decide |  |

**User's choice:** 16:9 on top. Cover crop

---

### Sticky header chrome?

| Option | Description | Selected |
|--------|-------------|----------|
| Solid ivory, hairline under it. No shadow | Solid ivory, hairline under it. No shadow | ✓ |
| Solid ivory, soft shadow | Solid ivory, soft shadow |  |
| You decide | You decide |  |

**User's choice:** Solid ivory, hairline under it. No shadow

---

### What sits on top of what?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal and drawer above WhatsApp, above toasts, above the sticky header | Modal and drawer above WhatsApp, above toasts, above the sticky header | ✓ |
| Toasts above everything, including modals | Toasts above everything, including modals |  |
| You decide | You decide |  |

**User's choice:** Modal and drawer above WhatsApp, above toasts, above the sticky header

---

### Language dropdown labels?

| Option | Description | Selected |
|--------|-------------|----------|
| Native names: English, العربية, Español | Native names: English, العربية, Español | ✓ |
| Codes: EN, AR, ES | Codes: EN, AR, ES |  |
| You decide | You decide |  |

**User's choice:** Native names: English, العربية, Español

---

### Unavailable stay reason?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal. Red is only for field errors | Charcoal. Red is only for field errors | ✓ |
| Amber warning | Amber warning |  |
| You decide | You decide |  |

**User's choice:** Charcoal. Red is only for field errors

---

### Selected dates in the calendar?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal fill across the range. Gold ring on start and end | Teal fill across the range. Gold ring on start and end | ✓ |
| Gold fill across the range | Gold fill across the range |  |
| You decide | You decide |  |

**User's choice:** Teal fill across the range. Gold ring on start and end

---

### Currency dropdown?

| Option | Description | Selected |
|--------|-------------|----------|
| Codes: AED, USD, EUR | Codes: AED, USD, EUR | ✓ |
| Full names | Full names |  |
| You decide | You decide |  |

**User's choice:** Codes: AED, USD, EUR

---

### Hint and error under a field?

| Option | Description | Selected |
|--------|-------------|----------|
| Smaller charcoal hint. Error replaces it in red | Smaller charcoal hint. Error replaces it in red | ✓ |
| Hint stays. Error adds a second line | Hint stays. Error adds a second line |  |
| You decide | You decide |  |

**User's choice:** Smaller charcoal hint. Error replaces it in red

---

### Selected stay row?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal border. Others stay plain | Teal border. Others stay plain | ✓ |
| Teal wash behind the row | Teal wash behind the row |  |
| You decide | You decide |  |

**User's choice:** Teal border. Others stay plain

---

### Checked add-on card?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal border when checked. Included cards use the same border plus a lock | Teal border when checked. Included cards use the same border plus a lock | ✓ |
| Checkbox only. No border change | Checkbox only. No border change |  |
| You decide | You decide |  |

**User's choice:** Teal border when checked. Included cards use the same border plus a lock

---

### Button while it is working?

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner at the start. Label stays. Button disabled | Spinner at the start. Label stays. Button disabled | ✓ |
| Spinner replaces the label | Spinner replaces the label |  |
| You decide | You decide |  |

**User's choice:** Spinner at the start. Label stays. Button disabled

---

### Today on the calendar?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal dot under the day. Not a fill | Charcoal dot under the day. Not a fill | ✓ |
| Teal circle on today | Teal circle on today |  |
| You decide | You decide |  |

**User's choice:** Charcoal dot under the day. Not a fill

---

### Days you cannot pick (past, blocked)?

| Option | Description | Selected |
|--------|-------------|----------|
| Muted charcoal, no pointer. Not red | Muted charcoal, no pointer. Not red | ✓ |
| Struck through | Struck through |  |
| You decide | You decide |  |

**User's choice:** Muted charcoal, no pointer. Not red

---

### Missing image?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory block with the monogram. No broken-image icon | Ivory block with the monogram. No broken-image icon | ✓ |
| Hide the image slot | Hide the image slot |  |
| You decide | You decide |  |

**User's choice:** Ivory block with the monogram. No broken-image icon

---

### Days outside the current month?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden. Empty cells pad the grid | Hidden. Empty cells pad the grid | ✓ |
| Shown muted, not selectable | Shown muted, not selectable |  |
| You decide | You decide |  |

**User's choice:** Hidden. Empty cells pad the grid

---

### Footer newsletter?

| Option | Description | Selected |
|--------|-------------|----------|
| Email field and gold button on one row. Stacked on small screens | Email field and gold button on one row. Stacked on small screens | ✓ |
| Button always under the field | Button always under the field |  |
| You decide | You decide |  |

**User's choice:** Email field and gold button on one row. Stacked on small screens

---

### Hero booker on desktop?

| Option | Description | Selected |
|--------|-------------|----------|
| One row: Where, When, three steppers, Search | One row: Where, When, three steppers, Search | ✓ |
| Where and When on the first row. Steppers and Search on the second | Where and When on the first row. Steppers and Search on the second |  |
| You decide | You decide |  |

**User's choice:** One row: Where, When, three steppers, Search

---

### Hero booker on small screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked: Where, When, steppers, then full-width Search | Stacked: Where, When, steppers, then full-width Search | ✓ |
| Steppers stay on one row. The rest stacks | Steppers stay on one row. The rest stacks |  |
| You decide | You decide |  |

**User's choice:** Stacked: Where, When, steppers, then full-width Search

---

### Calendar month header?

| Option | Description | Selected |
|--------|-------------|----------|
| Questa month and year. Chevron at each end. End flips in Arabic | Questa month and year. Chevron at each end. End flips in Arabic | ✓ |
| Lato month and year, same chevrons | Lato month and year, same chevrons |  |
| You decide | You decide |  |

**User's choice:** Questa month and year. Chevron at each end. End flips in Arabic

---

### Second date, before it is clicked?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal wash previews the range | Teal wash previews the range | ✓ |
| No preview. Fill only after both dates | No preview. Fill only after both dates |  |
| You decide | You decide |  |

**User's choice:** Teal wash previews the range

---

### Where in the hero?

| Option | Description | Selected |
|--------|-------------|----------|
| Select overlay, one destination. No free text | Select overlay, one destination. No free text | ✓ |
| Typeahead | Typeahead |  |
| You decide | You decide |  |

**User's choice:** Select overlay, one destination. No free text

---

### When field?

| Option | Description | Selected |
|--------|-------------|----------|
| One field showing the range. Opens the overlay calendar | One field showing the range. Opens the overlay calendar | ✓ |
| Two fields, from and to, same overlay | Two fields, from and to, same overlay |  |
| You decide | You decide |  |

**User's choice:** One field showing the range. Opens the overlay calendar

---

### Stepper plus and minus?

| Option | Description | Selected |
|--------|-------------|----------|
| Circular, gold outline, count in the middle | Circular, gold outline, count in the middle | ✓ |
| Square, same border as inputs | Square, same border as inputs |  |
| You decide | You decide |  |

**User's choice:** Circular, gold outline, count in the middle

---

### Password eye?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple eye, token color, inline-end. Not a brand JPG | Simple eye, token color, inline-end. Not a brand JPG | ✓ |
| You decide | You decide |  |

**User's choice:** Simple eye, token color, inline-end. Not a brand JPG

---

### Included add-on?

| Option | Description | Selected |
|--------|-------------|----------|
| Lock icon plus the word Included | Lock icon plus the word Included | ✓ |
| Lock icon only | Lock icon only |  |
| You decide | You decide |  |

**User's choice:** Lock icon plus the word Included

---

### Deposit or pay in full?

| Option | Description | Selected |
|--------|-------------|----------|
| Two radio cards. Teal border on the selected one | Two radio cards. Teal border on the selected one | ✓ |
| Two buttons, gold for the selected choice | Two buttons, gold for the selected choice |  |
| You decide | You decide |  |

**User's choice:** Two radio cards. Teal border on the selected one

---

### 30-minute hold countdown?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal tabular time. Not red | Charcoal tabular time. Not red | ✓ |
| Red the whole time | Red the whole time |  |
| You decide | You decide |  |

**User's choice:** Charcoal tabular time. Not red

---

### Keep asking?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep asking | Keep asking | ✓ |
| Enough — write the context | Enough — write the context |  |

**User's choice:** Keep asking

---

### Booking steps?

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet text. Gold rule under the current step. No numbered circles | Quiet text. Gold rule under the current step. No numbered circles | ✓ |
| Numbered circles | Numbered circles |  |
| You decide | You decide |  |

**User's choice:** Quiet text. Gold rule under the current step. No numbered circles

---

### Status chip?

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic text on ivory, hairline border. Not a loud fill | Semantic text on ivory, hairline border. Not a loud fill | ✓ |
| Filled pill | Filled pill |  |
| You decide | You decide |  |

**User's choice:** Semantic text on ivory, hairline border. Not a loud fill

---

### Lines inside the price block?

| Option | Description | Selected |
|--------|-------------|----------|
| Hairline charcoal between lines. Gold rule stays between page sections only | Hairline charcoal between lines. Gold rule stays between page sections only | ✓ |
| Gold between price lines too | Gold between price lines too |  |
| You decide | You decide |  |

**User's choice:** Hairline charcoal between lines. Gold rule stays between page sections only

---

### Overlay width?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow for confirm. Wide for stay pick, up to the content column | Narrow for confirm. Wide for stay pick, up to the content column | ✓ |
| One width for every overlay | One width for every overlay |  |
| You decide | You decide |  |

**User's choice:** Narrow for confirm. Wide for stay pick, up to the content column

---

### Small-screen drawer?

| Option | Description | Selected |
|--------|-------------|----------|
| Full width of the screen | Full width of the screen | ✓ |
| Partial width, scrim beside it | Partial width, scrim beside it |  |
| You decide | You decide |  |

**User's choice:** Full width of the screen

---

### Dialog actions?

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel at the start. Primary at the end. End flips in Arabic | Cancel at the start. Primary at the end. End flips in Arabic | ✓ |
| Primary at the start | Primary at the start |  |
| You decide | You decide |  |

**User's choice:** Cancel at the start. Primary at the end. End flips in Arabic

---

### Icon sizes?

| Option | Description | Selected |
|--------|-------------|----------|
| 16 inline, 20 in buttons, 24 standing alone | 16 inline, 20 in buttons, 24 standing alone | ✓ |
| One size, 20 everywhere | One size, 20 everywhere |  |
| You decide | You decide |  |

**User's choice:** 16 inline, 20 in buttons, 24 standing alone

---

### Empty select list?

| Option | Description | Selected |
|--------|-------------|----------|
| One charcoal line. No fake options | One charcoal line. No fake options | ✓ |
| Hide the overlay if nothing matches | Hide the overlay if nothing matches |  |
| You decide | You decide |  |

**User's choice:** One charcoal line. No fake options

---

### Ops table?

| Option | Description | Selected |
|--------|-------------|----------|
| Hairline rows, no zebra. Lato header. Hover darkens slightly | Hairline rows, no zebra. Lato header. Hover darkens slightly | ✓ |
| Zebra ivory and white | Zebra ivory and white |  |
| You decide | You decide |  |

**User's choice:** Hairline rows, no zebra. Lato header. Hover darkens slightly

---

### Textarea?

| Option | Description | Selected |
|--------|-------------|----------|
| Same border as inputs. Label above. Grows with content, min three lines | Same border as inputs. Label above. Grows with content, min three lines | ✓ |
| Fixed height, scroll inside | Fixed height, scroll inside |  |
| You decide | You decide |  |

**User's choice:** Same border as inputs. Label above. Grows with content, min three lines

---

### Long lists (stays, add-ons, selects)?

| Option | Description | Selected |
|--------|-------------|----------|
| Show all. No pager | Show all. No pager | ✓ |
| Load more button | Load more button |  |
| You decide | You decide |  |

**User's choice:** Show all. No pager

---

### Keep asking?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep asking | Keep asking | ✓ |
| Enough — write the context | Enough — write the context |  |

**User's choice:** Keep asking

---

### On and off switch?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal when on, ivory track when off. Label beside it | Teal when on, ivory track when off. Label beside it | ✓ |
| Checkbox only. No switch | Checkbox only. No switch |  |
| You decide | You decide |  |

**User's choice:** Teal when on, ivory track when off. Label beside it

---

### Avatar?

| Option | Description | Selected |
|--------|-------------|----------|
| Circle. Monogram on ivory if there is no photo | Circle. Monogram on ivory if there is no photo | ✓ |
| Square. Same fallback | Square. Same fallback |  |
| You decide | You decide |  |

**User's choice:** Circle. Monogram on ivory if there is no photo

---

### Copy and share?

| Option | Description | Selected |
|--------|-------------|----------|
| Text button. Toast on success. Not icon-only | Text button. Toast on success. Not icon-only | ✓ |
| Icon-only | Icon-only |  |
| You decide | You decide |  |

**User's choice:** Text button. Toast on success. Not icon-only

---

### Video?

| Option | Description | Selected |
|--------|-------------|----------|
| Muted by default. Pauses off-screen. Quiet corner control, not a full player chrome | Muted by default. Pauses off-screen. Quiet corner control, not a full player chrome | ✓ |
| Browser default controls | Browser default controls |  |
| You decide | You decide |  |

**User's choice:** Muted by default. Pauses off-screen. Quiet corner control, not a full player chrome

---

### Cookie banner?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom bar. Necessary on and locked. Analytics and marketing are switches. Gold save | Bottom bar. Necessary on and locked. Analytics and marketing are switches. Gold save | ✓ |
| Centered modal that blocks the page | Centered modal that blocks the page |  |
| You decide | You decide |  |

**User's choice:** Bottom bar. Necessary on and locked. Analytics and marketing are switches. Gold save

---

### Search field?

| Option | Description | Selected |
|--------|-------------|----------|
| Same input chrome. Icon at the start | Same input chrome. Icon at the start | ✓ |
| Plain input, no icon | Plain input, no icon |  |
| You decide | You decide |  |

**User's choice:** Same input chrome. Icon at the start

---

### Filter chips?

| Option | Description | Selected |
|--------|-------------|----------|
| Text chips. Teal border when on, ivory when off | Text chips. Teal border when on, ivory when off | ✓ |
| Dropdowns only. No chips | Dropdowns only. No chips |  |
| You decide | You decide |  |

**User's choice:** Text chips. Teal border when on, ivory when off

---

### Maintenance banner?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width ivory bar under the header. Charcoal text. Not red | Full-width ivory bar under the header. Charcoal text. Not red | ✓ |
| Modal that blocks the site | Modal that blocks the site |  |
| You decide | You decide |  |

**User's choice:** Full-width ivory bar under the header. Charcoal text. Not red

---

### File upload?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashed ivory area, charcoal label, gold button. No clipart cloud | Dashed ivory area, charcoal label, gold button. No clipart cloud | ✓ |
| Native file input only | Native file input only |  |
| You decide | You decide |  |

**User's choice:** Dashed ivory area, charcoal label, gold button. No clipart cloud

---

### Map pin?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal pin. Quiet map. No extra chrome | Teal pin. Quiet map. No extra chrome | ✓ |
| No map component in this phase | No map component in this phase |  |
| You decide | You decide |  |

**User's choice:** Teal pin. Quiet map. No extra chrome

---

### Phone field?

| Option | Description | Selected |
|--------|-------------|----------|
| Same input. Label above. Placeholder is an example, not the label | Same input. Label above. Placeholder is an example, not the label | ✓ |
| Country code split from the number | Country code split from the number |  |
| You decide | You decide |  |

**User's choice:** Same input. Label above. Placeholder is an example, not the label

---

### Back on a booking step?

| Option | Description | Selected |
|--------|-------------|----------|
| Text link at the start. Not a gold button | Text link at the start. Not a gold button | ✓ |
| Secondary button | Secondary button |  |
| You decide | You decide |  |

**User's choice:** Text link at the start. Not a gold button

---

### Package card under the booker?

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical card. 16:9 image, name, one line, group price. Request is a secondary button, not gold pay | Vertical card. 16:9 image, name, one line, group price. Request is a secondary button, not gold pay | ✓ |
| Horizontal row, same as a stay | Horizontal row, same as a stay |  |
| You decide | You decide |  |

**User's choice:** Vertical card. 16:9 image, name, one line, group price. Request is a secondary button, not gold pay

---

### Save a stay?

| Option | Description | Selected |
|--------|-------------|----------|
| Heart icon button. Teal, gold when saved. Has a name. Signed-in only | Heart icon button. Teal, gold when saved. Has a name. Signed-in only | ✓ |
| Text Save | Text Save |  |
| You decide | You decide |  |

**User's choice:** Heart icon button. Teal, gold when saved. Has a name. Signed-in only

---

### Sort?

| Option | Description | Selected |
|--------|-------------|----------|
| Same select overlay. Label Sort | Same select overlay. Label Sort | ✓ |
| Text chips | Text chips |  |
| You decide | You decide |  |

**User's choice:** Same select overlay. Label Sort

---

### Keep asking?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep asking | Keep asking | ✓ |
| Enough — write the context | Enough — write the context |  |

**User's choice:** Keep asking

---

### Consultation times?

| Option | Description | Selected |
|--------|-------------|----------|
| Chips in a row. Teal border when selected. Taken slots muted and shown, not hidden | Chips in a row. Teal border when selected. Taken slots muted and shown, not hidden | ✓ |
| A list, one time per row | A list, one time per row |  |
| You decide | You decide |  |

**User's choice:** Chips in a row. Teal border when selected. Taken slots muted and shown, not hidden

---

### Booking reference?

| Option | Description | Selected |
|--------|-------------|----------|
| Lato, tabular, charcoal. Not gold | Lato, tabular, charcoal. Not gold | ✓ |
| Questa display | Questa display |  |
| You decide | You decide |  |

**User's choice:** Lato, tabular, charcoal. Not gold

---

### Story card?

| Option | Description | Selected |
|--------|-------------|----------|
| 16:9 image, Questa title, one line. No comments, no share row | 16:9 image, Questa title, one line. No comments, no share row | ✓ |
| Title only, no image | Title only, no image |  |
| You decide | You decide |  |

**User's choice:** 16:9 image, Questa title, one line. No comments, no share row

---

### Team card?

| Option | Description | Selected |
|--------|-------------|----------|
| Circle photo, Questa name, Lato role. Contact links as text, not a row of brand icons | Circle photo, Questa name, Lato role. Contact links as text, not a row of brand icons |  |
| Horizontal: photo, name, role, icon links | Horizontal: photo, name, role, icon links |  |
| You decide | You decide |  |
| Match the front-page Meet the Team block. No circle. Measure the photo shape from that page. Published names stay Maria Del Mar Valdes and María Francis, not the Framer placeholders | Typed answer | ✓ |

**User's choice:** Match the front-page Meet the Team block. No circle. Measure the photo shape from that page. Published names stay Maria Del Mar Valdes and María Francis, not the Framer placeholders
**Notes:** User: do you see a circle on the front page? No. Do it as it is.

---

### Destination card?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-bleed image. Name over a charcoal scrim | Full-bleed image. Name over a charcoal scrim | ✓ |
| 16:9 with the name under the image, like a story card | 16:9 with the name under the image, like a story card |  |
| You decide | You decide |  |

**User's choice:** Full-bleed image. Name over a charcoal scrim

---

### Sign-in page?

| Option | Description | Selected |
|--------|-------------|----------|
| Centered narrow card on ivory. Wordmark above the form. No side image | Centered narrow card on ivory. Wordmark above the form. No side image |  |
| Split image and form | Split image and form | ✓ |
| You decide | You decide |  |

**User's choice:** Split image and form

---

### Coupon field?

| Option | Description | Selected |
|--------|-------------|----------|
| Same input. Secondary Apply beside it. Error replaces the hint | Same input. Secondary Apply beside it. Error replaces the hint | ✓ |
| Apply under the field | Apply under the field |  |
| You decide | You decide |  |

**User's choice:** Same input. Secondary Apply beside it. Error replaces the hint

---

### Address row?

| Option | Description | Selected |
|--------|-------------|----------|
| One row: Home, Work, or Custom, then the address, text Edit | One row: Home, Work, or Custom, then the address, text Edit | ✓ |
| Cards in a grid | Cards in a grid |  |
| You decide | You decide |  |

**User's choice:** One row: Home, Work, or Custom, then the address, text Edit

---

### UAE airport?

| Option | Description | Selected |
|--------|-------------|----------|
| Three radio cards. Teal border on the selected one | Three radio cards. Teal border on the selected one | ✓ |
| Select overlay | Select overlay |  |
| You decide | You decide |  |

**User's choice:** Three radio cards. Teal border on the selected one

---

### Legal page?

| Option | Description | Selected |
|--------|-------------|----------|
| Centered column. Questa title. Lato body. Gold rule under the title | Centered column. Questa title. Lato body. Gold rule under the title | ✓ |
| Same as a story, no rule | Same as a story, no rule |  |
| You decide | You decide |  |

**User's choice:** Centered column. Questa title. Lato body. Gold rule under the title

---

### Booking page header?

| Option | Description | Selected |
|--------|-------------|----------|
| Questa trip name. Ref in Lato tabular. Status chip beside the ref | Questa trip name. Ref in Lato tabular. Status chip beside the ref | ✓ |
| Ref only, no trip name | Ref only, no trip name |  |
| You decide | You decide |  |

**User's choice:** Questa trip name. Ref in Lato tabular. Status chip beside the ref

---

### Sign-in split?

| Option | Description | Selected |
|--------|-------------|----------|
| Image on the start side, form on the end. Start flips in Arabic | Image on the start side, form on the end. Start flips in Arabic | ✓ |
| Image always on the left | Image always on the left |  |
| You decide | You decide |  |

**User's choice:** Image on the start side, form on the end. Start flips in Arabic

---

### Damage hold on the price block?

| Option | Description | Selected |
|--------|-------------|----------|
| Own line under the total: Temporarily held. Not added into the total again | Own line under the total: Temporarily held. Not added into the total again | ✓ |
| Inside the grand total | Inside the grand total |  |
| You decide | You decide |  |

**User's choice:** Own line under the total: Temporarily held. Not added into the total again

---

### Booking terms?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox. The label is the sentence, with a link. Required asterisk | Checkbox. The label is the sentence, with a link. Required asterisk | ✓ |
| A gold button that means accept | A gold button that means accept |  |
| You decide | You decide |  |

**User's choice:** Checkbox. The label is the sentence, with a link. Required asterisk

---

### Keep asking?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep asking | Keep asking | ✓ |
| Enough — write the context | Enough — write the context |  |

**User's choice:** Keep asking

---

### Date field?

| Option | Description | Selected |
|--------|-------------|----------|
| Two inputs, check-in then check-out. Same chrome. Native calendar on tap | Two inputs, check-in then check-out. Same chrome. Native calendar on tap |  |
| One range field that opens a calendar overlay | One range field that opens a calendar overlay |  |
| You decide | You decide |  |
| Two inputs, check-in then check-out. Same chrome but branded date picker | Typed answer | ✓ |

**User's choice:** Two inputs, check-in then check-out. Same chrome but branded date picker
**Notes:** User rejected native calendar. Branded picker still needs its own look.

---

### Guest names?

| Option | Description | Selected |
|--------|-------------|----------|
| One row per guest. First and last. Adult 1 required, the rest optional | One row per guest. First and last. Adult 1 required, the rest optional | ✓ |
| One free-text box for all names | One free-text box for all names |  |
| You decide | You decide |  |

**User's choice:** One row per guest. First and last. Adult 1 required, the rest optional

---

### Review step?

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked sections. Each has a text Edit. Gold Pay only at the end | Stacked sections. Each has a text Edit. Gold Pay only at the end | ✓ |
| One summary table, no Edit links | One summary table, no Edit links |  |
| You decide | You decide |  |

**User's choice:** Stacked sections. Each has a text Edit. Gold Pay only at the end

---

### Signed-in account menu?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar opens a small menu: Bookings, Account, Sign out | Avatar opens a small menu: Bookings, Account, Sign out | ✓ |
| Name as a text link to Account | Name as a text link to Account |  |
| You decide | You decide |  |

**User's choice:** Avatar opens a small menu: Bookings, Account, Sign out

---

### Date picker look?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory panel. Questa month. Teal fill across the range. Gold ring on start and end | Ivory panel. Questa month. Teal fill across the range. Gold ring on start and end | ✓ |
| Same, but gold fill across the range | Same, but gold fill across the range |  |
| You decide | You decide |  |

**User's choice:** Ivory panel. Questa month. Teal fill across the range. Gold ring on start and end

---

### Saved card on review?

| Option | Description | Selected |
|--------|-------------|----------|
| Last four and brand. Text Change. No card art | Last four and brand. Text Change. No card art | ✓ |
| Last four only, no brand | Last four only, no brand |  |
| You decide | You decide |  |

**User's choice:** Last four and brand. Text Change. No card art

---

### Sign out?

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm modal. Sign out is danger. Cancel is secondary | Confirm modal. Sign out is danger. Cancel is secondary | ✓ |
| Signs out immediately. No confirm | Signs out immediately. No confirm |  |
| You decide | You decide |  |

**User's choice:** Confirm modal. Sign out is danger. Cancel is secondary

---

### WhatsApp opens with?

| Option | Description | Selected |
|--------|-------------|----------|
| Trip name and ref already in the message | Trip name and ref already in the message | ✓ |
| Blank chat | Blank chat |  |
| You decide | You decide |  |

**User's choice:** Trip name and ref already in the message

---

### Password rules?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal hint under the field until it fails. Then the error replaces it | Charcoal hint under the field until it fails. Then the error replaces it | ✓ |
| A checklist that ticks as they type | A checklist that ticks as they type |  |
| You decide | You decide |  |

**User's choice:** Charcoal hint under the field until it fails. Then the error replaces it

---

### Status chips?

| Option | Description | Selected |
|--------|-------------|----------|
| Muted ivory, charcoal text. Gold only for confirmed | Muted ivory, charcoal text. Gold only for confirmed | ✓ |
| A different color for every status | A different color for every status |  |
| You decide | You decide |  |

**User's choice:** Muted ivory, charcoal text. Gold only for confirmed

---

### Mobile nav?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen ivory overlay. Questa links. Gold close | Full-screen ivory overlay. Questa links. Gold close | ✓ |
| A drawer from the side | A drawer from the side |  |
| You decide | You decide |  |

**User's choice:** Full-screen ivory overlay. Questa links. Gold close

---

### Price breakdown?

| Option | Description | Selected |
|--------|-------------|----------|
| Closed by default. Text Show breakdown opens the lines | Closed by default. Text Show breakdown opens the lines | ✓ |
| Always open | Always open |  |
| You decide | You decide |  |

**User's choice:** Closed by default. Text Show breakdown opens the lines

---

### Forgot password?

| Option | Description | Selected |
|--------|-------------|----------|
| Email field, then a sent state. No link shown on screen | Email field, then a sent state. No link shown on screen | ✓ |
| Email field that shows the reset link on screen | Email field that shows the reset link on screen |  |
| You decide | You decide |  |

**User's choice:** Email field, then a sent state. No link shown on screen

---

### Booking list?

| Option | Description | Selected |
|--------|-------------|----------|
| One row per booking. Trip, dates, status chip, ref | One row per booking. Trip, dates, status chip, ref | ✓ |
| Cards, one booking per card | Cards, one booking per card |  |
| You decide | You decide |  |

**User's choice:** One row per booking. Trip, dates, status chip, ref

---

### Language switch?

| Option | Description | Selected |
|--------|-------------|----------|
| EN and AR as text. The active one is charcoal, the other is muted | EN and AR as text. The active one is charcoal, the other is muted | ✓ |
| A select overlay | A select overlay |  |
| You decide | You decide |  |

**User's choice:** EN and AR as text. The active one is charcoal, the other is muted

---

### Print receipt?

| Option | Description | Selected |
|--------|-------------|----------|
| Text Print. Browser print of the booking page, no separate receipt design | Text Print. Browser print of the booking page, no separate receipt design | ✓ |
| A separate receipt page | A separate receipt page |  |
| You decide | You decide |  |

**User's choice:** Text Print. Browser print of the booking page, no separate receipt design

---

### Reset password?

| Option | Description | Selected |
|--------|-------------|----------|
| Two password fields, both with an eye. Gold Save | Two password fields, both with an eye. Gold Save | ✓ |
| One field, no confirm | One field, no confirm |  |
| You decide | You decide |  |

**User's choice:** Two password fields, both with an eye. Gold Save

---

### Cancel a booking?

| Option | Description | Selected |
|--------|-------------|----------|
| Text Cancel. Confirm modal. Confirm is danger | Text Cancel. Confirm modal. Confirm is danger | ✓ |
| A gold Cancel button, no confirm | A gold Cancel button, no confirm |  |
| You decide | You decide |  |

**User's choice:** Text Cancel. Confirm modal. Confirm is danger

---

### Special requests?

| Option | Description | Selected |
|--------|-------------|----------|
| Same textarea. Optional. Label above | Same textarea. Optional. Label above | ✓ |
| A row of chips | A row of chips |  |
| You decide | You decide |  |

**User's choice:** Same textarea. Optional. Label above

---

### Header on scroll?

| Option | Description | Selected |
|--------|-------------|----------|
| Stays ivory and solid. No shrink, no hide | Stays ivory and solid. No shrink, no hide | ✓ |
| Hides on scroll down, returns on scroll up | Hides on scroll down, returns on scroll up |  |
| You decide | You decide |  |

**User's choice:** Stays ivory and solid. No shrink, no hide

---

### After a successful pay?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory page. Questa confirmation. Ref in Lato tabular. No second pay button | Ivory page. Questa confirmation. Ref in Lato tabular. No second pay button | ✓ |
| Modal over the review step | Modal over the review step |  |
| You decide | You decide |  |

**User's choice:** Ivory page. Questa confirmation. Ref in Lato tabular. No second pay button

---

### Booking steps?

| Option | Description | Selected |
|--------|-------------|----------|
| Text steps. Current is charcoal. Done is teal. Upcoming is muted. No numbered circles | Text steps. Current is charcoal. Done is teal. Upcoming is muted. No numbered circles | ✓ |
| Numbered circles | Numbered circles |  |
| You decide | You decide |  |

**User's choice:** Text steps. Current is charcoal. Done is teal. Upcoming is muted. No numbered circles

---

### Payment failed?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on review. Charcoal message. Gold Try again. Card stays | Inline on review. Charcoal message. Gold Try again. Card stays | ✓ |
| Full-page error | Full-page error |  |
| You decide | You decide |  |

**User's choice:** Inline on review. Charcoal message. Gold Try again. Card stays

---

### No rooms for those dates?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state on the stay list. One line. Text Change dates | Empty state on the stay list. One line. Text Change dates | ✓ |
| A modal | A modal |  |
| You decide | You decide |  |

**User's choice:** Empty state on the stay list. One line. Text Change dates

---

### Price on a phone?

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky ivory bar. Total and gold Continue. Sits above the page | Sticky ivory bar. Total and gold Continue. Sits above the page | ✓ |
| Only at the bottom of the form | Only at the bottom of the form |  |
| You decide | You decide |  |

**User's choice:** Sticky ivory bar. Total and gold Continue. Sits above the page

---

### Session expired?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal. Charcoal line. Gold Sign in. Form stays underneath | Modal. Charcoal line. Gold Sign in. Form stays underneath | ✓ |
| Full page that throws the form away | Full page that throws the form away |  |
| You decide | You decide |  |

**User's choice:** Modal. Charcoal line. Gold Sign in. Form stays underneath

---

### Disabled control?

| Option | Description | Selected |
|--------|-------------|----------|
| Same shape, muted. No gold. Cursor not a pointer | Same shape, muted. No gold. Cursor not a pointer | ✓ |
| Hidden until it can be used | Hidden until it can be used |  |
| You decide | You decide |  |

**User's choice:** Same shape, muted. No gold. Cursor not a pointer

---

### Server error page?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as 404, different line. Text Try again | Same as 404, different line. Text Try again | ✓ |
| A toast only, stay on the page | A toast only, stay on the page |  |
| You decide | You decide |  |

**User's choice:** Same as 404, different line. Text Try again

---

### When do field errors show?

| Option | Description | Selected |
|--------|-------------|----------|
| On submit, then as they fix each field | On submit, then as they fix each field | ✓ |
| As they leave each field | As they leave each field |  |
| You decide | You decide |  |

**User's choice:** On submit, then as they fix each field

---

### FAQ?

| Option | Description | Selected |
|--------|-------------|----------|
| Questa question. Answer opens under it. One open at a time. No plus icon | Questa question. Answer opens under it. One open at a time. No plus icon | ✓ |
| All answers open | All answers open |  |
| You decide | You decide |  |

**User's choice:** Questa question. Answer opens under it. One open at a time. No plus icon

---

### Stay photos?

| Option | Description | Selected |
|--------|-------------|----------|
| One 16:9. Text Photos opens the rest, one at a time | One 16:9. Text Photos opens the rest, one at a time | ✓ |
| A filmstrip under the hero | A filmstrip under the hero |  |
| You decide | You decide |  |

**User's choice:** One 16:9. Text Photos opens the rest, one at a time

---

### Nights between the dates?

| Option | Description | Selected |
|--------|-------------|----------|
| Lato tabular, charcoal, between the two date fields | Lato tabular, charcoal, between the two date fields | ✓ |
| Only inside the price breakdown | Only inside the price breakdown |  |
| You decide | You decide |  |

**User's choice:** Lato tabular, charcoal, between the two date fields

---

### Marketing emails?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate checkbox. Off by default. Not the terms box | Separate checkbox. Off by default. Not the terms box | ✓ |
| Folded into the terms checkbox | Folded into the terms checkbox |  |
| You decide | You decide |  |

**User's choice:** Separate checkbox. Off by default. Not the terms box

---

### Photo viewer?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory. One image. Text Previous and Next. Gold close | Ivory. One image. Text Previous and Next. Gold close | ✓ |
| Dark full-screen with arrows | Dark full-screen with arrows |  |
| You decide | You decide |  |

**User's choice:** Ivory. One image. Text Previous and Next. Gold close

---

### A held booking counting down?

| Option | Description | Selected |
|--------|-------------|----------|
| Lato tabular, charcoal, next to the status chip. No red | Lato tabular, charcoal, next to the status chip. No red | ✓ |
| A gold bar across the page | A gold bar across the page |  |
| You decide | You decide |  |

**User's choice:** Lato tabular, charcoal, next to the status chip. No red

---

### Account page?

| Option | Description | Selected |
|--------|-------------|----------|
| One column. Name, email, phone, password. Gold Save at the end | One column. Name, email, phone, password. Gold Save at the end | ✓ |
| A side nav of settings | A side nav of settings |  |
| You decide | You decide |  |

**User's choice:** One column. Name, email, phone, password. Gold Save at the end

---

### Language switch? Requirements are EN, AR, and ES.

| Option | Description | Selected |
|--------|-------------|----------|
| EN, AR, and ES as text. Active is charcoal, the others muted | EN, AR, and ES as text. Active is charcoal, the others muted | ✓ |
| EN and AR only | EN and AR only |  |
| You decide | You decide |  |

**User's choice:** EN, AR, and ES as text. Active is charcoal, the others muted
**Notes:** Replaces the earlier EN and AR only answer.

---

### Deposit or pay in full?

| Option | Description | Selected |
|--------|-------------|----------|
| Two radio cards. Teal border on the selected one. Amount on each card | Two radio cards. Teal border on the selected one. Amount on each card | ✓ |
| A switch | A switch |  |
| You decide | You decide |  |

**User's choice:** Two radio cards. Teal border on the selected one. Amount on each card

---

### How dates are written?

| Option | Description | Selected |
|--------|-------------|----------|
| DD/MM/YYYY. Week starts Monday. Western numerals in Arabic | DD/MM/YYYY. Week starts Monday. Western numerals in Arabic | ✓ |
| Browser locale | Browser locale |  |
| You decide | You decide |  |

**User's choice:** DD/MM/YYYY. Week starts Monday. Western numerals in Arabic

---

### Inclusions on a trip?

| Option | Description | Selected |
|--------|-------------|----------|
| Lato list. Included has no price. Extras show a price | Lato list. Included has no price. Extras show a price | ✓ |
| Chips | Chips |  |
| You decide | You decide |  |

**User's choice:** Lato list. Included has no price. Extras show a price

---

### Child or infant row?

| Option | Description | Selected |
|--------|-------------|----------|
| Name, plus age. Adults stay first and last only | Name, plus age. Adults stay first and last only | ✓ |
| Same as adults, no age | Same as adults, no age |  |
| You decide | You decide |  |

**User's choice:** Name, plus age. Adults stay first and last only

---

### Booker is not staying?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox on the booker row. Off by default | Checkbox on the booker row. Off by default | ✓ |
| A question above the names | A question above the names |  |
| You decide | You decide |  |

**User's choice:** Checkbox on the booker row. Off by default

---

### Nationality, emergency contact, passport?

| Option | Description | Selected |
|--------|-------------|----------|
| Same inputs, no asterisk. Passport uses the file upload | Same inputs, no asterisk. Passport uses the file upload | ✓ |
| Hidden unless they open More | Hidden unless they open More |  |
| You decide | You decide |  |

**User's choice:** Same inputs, no asterisk. Passport uses the file upload

---

### A stay that cannot be booked?

| Option | Description | Selected |
|--------|-------------|----------|
| Card stays. Charcoal reason under the name. The action is muted | Card stays. Charcoal reason under the name. The action is muted | ✓ |
| Hidden | Hidden |  |
| You decide | You decide |  |

**User's choice:** Card stays. Charcoal reason under the name. The action is muted

---

### Pets on a stay?

| Option | Description | Selected |
|--------|-------------|----------|
| One charcoal line. Allowed, not allowed, or a fee | One charcoal line. Allowed, not allowed, or a fee | ✓ |
| Hidden unless allowed | Hidden unless allowed |  |
| You decide | You decide |  |

**User's choice:** One charcoal line. Allowed, not allowed, or a fee

---

### Wifi, door, and exact address?

| Option | Description | Selected |
|--------|-------------|----------|
| Shown only after Confirmed. Before that, one muted line | Shown only after Confirmed. Before that, one muted line | ✓ |
| Always visible | Always visible |  |
| You decide | You decide |  |

**User's choice:** Shown only after Confirmed. Before that, one muted line

---

### Pay without an account?

| Option | Description | Selected |
|--------|-------------|----------|
| No account wall. A text link under Pay: Create an account later | No account wall. A text link under Pay: Create an account later | ✓ |
| Must sign in before pay | Must sign in before pay |  |
| You decide | You decide |  |

**User's choice:** No account wall. A text link under Pay: Create an account later

---

### Delete account?

| Option | Description | Selected |
|--------|-------------|----------|
| Text Delete. Confirm modal. Confirm is danger | Text Delete. Confirm modal. Confirm is danger | ✓ |
| A gold button, no confirm | A gold button, no confirm |  |
| You decide | You decide |  |

**User's choice:** Text Delete. Confirm modal. Confirm is danger

---

### Footer newsletter?

| Option | Description | Selected |
|--------|-------------|----------|
| Email input and a secondary Subscribe. Toast on success. No gold | Email input and a secondary Subscribe. Toast on success. No gold | ✓ |
| Gold Subscribe | Gold Subscribe |  |
| You decide | You decide |  |

**User's choice:** Email input and a secondary Subscribe. Toast on success. No gold

---

### List with us?

| Option | Description | Selected |
|--------|-------------|----------|
| Footer text link. Same form chrome. Gold Send | Footer text link. Same form chrome. Gold Send | ✓ |
| A card on the home page | A card on the home page |  |
| You decide | You decide |  |

**User's choice:** Footer text link. Same form chrome. Gold Send

---

### Plan with us?

| Option | Description | Selected |
|--------|-------------|----------|
| Same form chrome. No pay button. Gold Send | Same form chrome. No pay button. Gold Send | ✓ |
| Looks like checkout, with a price | Looks like checkout, with a price |  |
| You decide | You decide |  |

**User's choice:** Same form chrome. No pay button. Gold Send

---

### Card payment on our page?

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe element inside the same input chrome. Gold Pay under it | Stripe element inside the same input chrome. Gold Pay under it | ✓ |
| A button that leaves the site | A button that leaves the site |  |
| You decide | You decide |  |

**User's choice:** Stripe element inside the same input chrome. Gold Pay under it

---

### The 30-minute hold runs out?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal. Charcoal line. Gold Choose a stay. The pick restarts | Modal. Charcoal line. Gold Choose a stay. The pick restarts | ✓ |
| A toast, stay on pay | A toast, stay on pay |  |
| You decide | You decide |  |

**User's choice:** Modal. Charcoal line. Gold Choose a stay. The pick restarts

---

### Share a stay?

| Option | Description | Selected |
|--------|-------------|----------|
| Text Share opens Copy, WhatsApp, and the phone share sheet | Text Share opens Copy, WhatsApp, and the phone share sheet | ✓ |
| Three buttons always visible | Three buttons always visible |  |
| You decide | You decide |  |

**User's choice:** Text Share opens Copy, WhatsApp, and the phone share sheet

---

### Check your email?

| Option | Description | Selected |
|--------|-------------|----------|
| Ivory page. Questa line. No link on screen. Text Resend | Ivory page. Questa line. No link on screen. Text Resend | ✓ |
| The link shown on screen | The link shown on screen |  |
| You decide | You decide |  |

**User's choice:** Ivory page. Questa line. No link on screen. Text Resend

---

### Receipt PDF?

| Option | Description | Selected |
|--------|-------------|----------|
| Text Download on the booking page. Not a second design | Text Download on the booking page. Not a second design | ✓ |
| A designed receipt page | A designed receipt page |  |
| You decide | You decide |  |

**User's choice:** Text Download on the booking page. Not a second design

---

### Consultation time?

| Option | Description | Selected |
|--------|-------------|----------|
| Dubai slot, plus the guest’s local time in muted Lato | Dubai slot, plus the guest’s local time in muted Lato | ✓ |
| Dubai time only | Dubai time only |  |
| You decide | You decide |  |

**User's choice:** Dubai slot, plus the guest’s local time in muted Lato

---

### A second city in the same trip?

| Option | Description | Selected |
|--------|-------------|----------|
| Text line. Opens WhatsApp with the booking ref already in the message | Text line. Opens WhatsApp with the booking ref already in the message | ✓ |
| A second destination field | A second destination field |  |
| You decide | You decide |  |

**User's choice:** Text line. Opens WhatsApp with the booking ref already in the message

---

### Driver assigned, or flights booked?

| Option | Description | Selected |
|--------|-------------|----------|
| Same status chip. No phone number. No flight form on the site | Same status chip. No phone number. No flight form on the site | ✓ |
| A card with the driver’s number | A card with the driver’s number |  |
| You decide | You decide |  |

**User's choice:** Same status chip. No phone number. No flight form on the site

---

### Change email?

| Option | Description | Selected |
|--------|-------------|----------|
| Same input. Gold Save. Then the check-your-email page | Same input. Gold Save. Then the check-your-email page | ✓ |
| Saves immediately, no re-verify | Saves immediately, no re-verify |  |
| You decide | You decide |  |

**User's choice:** Same input. Gold Save. Then the check-your-email page

---

### Too late to book today?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal line on the date field. Those dates stay visible, not hidden | Charcoal line on the date field. Those dates stay visible, not hidden | ✓ |
| The dates disappear | The dates disappear |  |
| You decide | You decide |  |

**User's choice:** Charcoal line on the date field. Those dates stay visible, not hidden

---

### Add an extra after pay?

| Option | Description | Selected |
|--------|-------------|----------|
| Same add-on row. Gold Pay the difference. Other changes are a text request | Same add-on row. Gold Pay the difference. Other changes are a text request | ✓ |
| A new checkout from scratch | A new checkout from scratch |  |
| You decide | You decide |  |

**User's choice:** Same add-on row. Gold Pay the difference. Other changes are a text request

---

### An add-on included in the package?

| Option | Description | Selected |
|--------|-------------|----------|
| Shown, no remove control. Charcoal Included | Shown, no remove control. Charcoal Included | ✓ |
| Can be unchecked | Can be unchecked |  |
| You decide | You decide |  |

**User's choice:** Shown, no remove control. Charcoal Included

---

### Airport meet or home pickup?

| Option | Description | Selected |
|--------|-------------|----------|
| Airport meet is the included line. Home pickup is an add-on row | Airport meet is the included line. Home pickup is an add-on row | ✓ |
| Two equal radio cards | Two equal radio cards |  |
| You decide | You decide |  |

**User's choice:** Airport meet is the included line. Home pickup is an add-on row

---

### Changing currency on the pay step?

| Option | Description | Selected |
|--------|-------------|----------|
| Charcoal line: the hold restarts. Then the new total | Charcoal line: the hold restarts. Then the new total | ✓ |
| Silent switch, same hold | Silent switch, same hold |  |
| You decide | You decide |  |

**User's choice:** Charcoal line: the hold restarts. Then the new total

---

### Remainder still due?

| Option | Description | Selected |
|--------|-------------|----------|
| Same price block. Gold Pay the remainder. Not a new trip | Same price block. Gold Pay the remainder. Not a new trip | ✓ |
| A second booking card | A second booking card |  |
| You decide | You decide |  |

**User's choice:** Same price block. Gold Pay the remainder. Not a new trip

---

### Ops sign-in?

| Option | Description | Selected |
|--------|-------------|----------|
| Same split sign-in. No marketing nav. No public link | Same split sign-in. No marketing nav. No public link | ✓ |
| The public homepage with a hidden form | The public homepage with a hidden form |  |
| You decide | You decide |  |

**User's choice:** Same split sign-in. No marketing nav. No public link

---

### Contact form?

| Option | Description | Selected |
|--------|-------------|----------|
| Name, email, phone, message. Gold Send. Calendar is the consultation chips | Name, email, phone, message. Gold Send. Calendar is the consultation chips | ✓ |
| One field only | One field only |  |
| You decide | You decide |  |

**User's choice:** Name, email, phone, message. Gold Send. Calendar is the consultation chips

---

### Return home?

| Option | Description | Selected |
|--------|-------------|----------|
| Same address line. Text Change if the return is different | Same address line. Text Change if the return is different | ✓ |
| A second address form, always open | A second address form, always open |  |
| You decide | You decide |  |

**User's choice:** Same address line. Text Change if the return is different

---

### Change phone?

| Option | Description | Selected |
|--------|-------------|----------|
| Same input. Gold Save. Toast. No email page | Same input. Gold Save. Toast. No email page | ✓ |
| Same as email, check-your-email page | Same as email, check-your-email page |  |
| You decide | You decide |  |

**User's choice:** Same input. Gold Save. Toast. No email page

---

### Hero booker?

| Option | Description | Selected |
|--------|-------------|----------|
| One ivory bar. Destination, dates, guests. Secondary Search. No gold pay | One ivory bar. Destination, dates, guests. Secondary Search. No gold pay | ✓ |
| Gold Search | Gold Search |  |
| You decide | You decide |  |

**User's choice:** One ivory bar. Destination, dates, guests. Secondary Search. No gold pay

---

### Map before the stay is confirmed?

| Option | Description | Selected |
|--------|-------------|----------|
| Teal pin. Charcoal Approximate under it | Teal pin. Charcoal Approximate under it | ✓ |
| No label | No label |  |
| You decide | You decide |  |

**User's choice:** Teal pin. Charcoal Approximate under it

---

### Unsigned guest and the heart?

| Option | Description | Selected |
|--------|-------------|----------|
| Heart stays. Tap opens sign-in. It does not save | Heart stays. Tap opens sign-in. It does not save | ✓ |
| Heart hidden until signed in | Heart hidden until signed in |  |
| You decide | You decide |  |

**User's choice:** Heart stays. Tap opens sign-in. It does not save

---

### Package page?

| Option | Description | Selected |
|--------|-------------|----------|
| 16:9, Questa name, one line, group price. Secondary Request. Not gold pay | 16:9, Questa name, one line, group price. Secondary Request. Not gold pay | ✓ |
| Same as a stay card, gold Request | Same as a stay card, gold Request |  |
| You decide | You decide |  |

**User's choice:** 16:9, Questa name, one line, group price. Secondary Request. Not gold pay

---

### Experiences list?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as add-on rows. Search and filter chips above | Same as add-on rows. Search and filter chips above | ✓ |
| Cards in a grid | Cards in a grid |  |
| You decide | You decide |  |

**User's choice:** Same as add-on rows. Search and filter chips above

---

### Keep asking?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep asking | Keep asking |  |
| Enough — write the context | Enough — write the context | ✓ |

**User's choice:** Enough — write the context

---

## Claude's Discretion

None recorded as a selected "You decide" answer. CONTEXT.md lists D-08, D-10, and D-21 as discretion.

## Deferred Ideas

None — discussion stayed within phase scope.
