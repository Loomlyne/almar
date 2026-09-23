# Phase 1: Design system - Research

**Researched:** 2026-09-23
**Domain:** Brand tokens, core controls, RTL states, owner `/design`, branded 404
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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
- **D-25:** Guest Who = three steppers always visible in the hero (adults, children, infants). No popover.
- **D-26:** Overlays = centered modal on desktop; end drawer on small screens; end flips in Arabic
- **D-27:** Toasts = bottom center, 4 seconds, pause on hover, stack up to 3
- **D-28:** Input labels sit above the field, always visible; placeholder is an example, not the name
- **D-29:** Checkbox = custom square, radio = custom circle, teal when on. Select = field with chevron; list uses the same overlay as other dialogs
- **D-30:** Stay card in the pick overlay = horizontal row (image, name, price, reason if it cannot be booked). Never hidden
- **D-31:** Add-ons = cards in a grid. Included add-ons stay on and cannot be unchecked
- **D-32:** Price = stacked lines (nights, add-ons, coupon, subtotal, VAT, total), amounts at the end, grand total larger, then deposit or pay in full
- **D-33:** Nav = sticky ivory header. Desktop inline links. Small screens: end drawer, same overlay as other dialogs
- **D-34:** Footer = desktop columns (brand, links, List with us, newsletter); stacked on small screens. Keep current contact
- **D-35:** `/design` is local only until Phase 2 auth. No public URL. No password in the repo
- **D-36:** Questa and Lato via `next/font/local` from `brand/Font`. Arabic Noto via `next/font`, only when language is AR
- **D-37:** Empty = ivory, one line, one action. Field error = semantic red under the label. Page error = toast. Loading = skeleton on cards and lists; spinner on the pressed button
- **D-38:** Scrim = charcoal at low opacity. Click outside closes pickers. Confirm and pay do not close on scrim click
- **D-39:** Hover and press = no lift, no scale. Hover darkens slightly; press darkens more. 150ms
- **D-40:** Prices, dates, and counts use tabular numbers. Western numerals
- **D-41:** Long names wrap to two lines, then ellipsis. Prices never truncate
- **D-42:** Infants stepper always visible in the hero. After a stay is chosen, if infants are off, lock it and show the reason
- **D-43:** Language and currency = two compact dropdowns in the header
- **D-44:** WhatsApp = fixed bottom-end, round, sits above toasts. Opens the locked number
- **D-45:** Links = no underline. Teal, gold on hover. Focus uses the teal ring
- **D-46:** Danger = red outline, charcoal label. Not a gold or teal fill
- **D-47:** Sections = ivory full width, content in a centered column, gold rule between sections
- **D-48:** Stay-row image = 4:3 on the start side, cover crop. Start flips in Arabic
- **D-49:** Header logo = wordmark on desktop, monogram on small screens. Both from `brand/`
- **D-50:** Amounts = currency code before the number. Comma thousands. Two decimals only when not whole
- **D-51:** Overlay close = X at the end of the header. Escape closes. End flips in Arabic
- **D-52:** 404 = large brand monogram on ivory, Questa line, one link home. No stock photo
- **D-53:** WhatsApp colors = official WhatsApp green. Exception to teal/gold controls
- **D-54:** Skeleton = ivory pulse on the white card. No shimmer
- **D-55:** Toast = icon plus one line. No title and body
- **D-56:** Inputs = white fill, hairline charcoal border. Focus uses the teal ring, not a second border color
- **D-57:** Required = charcoal asterisk after the label. Optional fields say optional
- **D-58:** Section column width = measure the live Framer site and snap to the 4px grid
- **D-59:** Stepper floors: adults cannot go below 1. Children and infants can be 0. Minus disables at the floor
- **D-60:** Active nav = teal text, gold rule under it. No pill
- **D-61:** Add-on card = image on top, name, one line, price, checkbox. Included stays checked and locked
- **D-62:** Ops compact = tighter type and padding. Hit target stays 44px
- **D-63:** Primary button on small screens = full width of the column. Ops buttons hug the label
- **D-64:** Add-on image = 16:9 on top, cover crop
- **D-65:** Sticky header = solid ivory, hairline under it, no shadow
- **D-66:** Layer order = modal and drawer, then WhatsApp, then toasts, then sticky header
- **D-67:** Language dropdown = native names: English, العربية, Español
- **D-68:** Unavailable stay reason = charcoal. Red is only for field errors
- **D-69:** Selected dates = teal fill across the range. Gold ring on start and end
- **D-70:** Currency dropdown = codes AED, USD, EUR
- **D-71:** Field hint = smaller charcoal line. Error replaces it in red
- **D-72:** Selected stay row = teal border. Others stay plain
- **D-73:** Checked add-on = teal border. Included cards use that border plus a lock
- **D-74:** Busy button = spinner at the start, label stays, button disabled
- **D-75:** Today on the calendar = charcoal dot under the day. Not a fill
- **D-76:** Unpickable days = muted charcoal, no pointer. Not red
- **D-77:** Missing image = ivory block with the monogram. No broken-image icon
- **D-78:** Days outside the current month are hidden. Empty cells pad the grid
- **D-79:** Footer newsletter = email field and gold button on one row. Stacked on small screens
- **D-80:** Hero booker on desktop = one row: Where, When, three steppers, Search
- **D-81:** Hero booker on small screens = stacked: Where, When, steppers, then full-width Search
- **D-82:** Calendar month header = Questa month and year. Chevron at each end. End flips in Arabic
- **D-83:** Second date, before click = teal wash previews the range
- **D-84:** Where = select overlay, one destination. No free text
- **D-85:** When = one field showing the range. Opens the overlay calendar
- **D-86:** Stepper plus and minus = circular, gold outline, count in the middle
- **D-87:** Password eye = simple eye, token color, inline-end. Not a brand JPG
- **D-88:** Included add-on = lock icon plus the word Included
- **D-89:** Deposit or pay in full = two radio cards. Teal border on the selected one
- **D-90:** 30-minute hold = charcoal tabular time. Not red
- **D-91:** Booking steps = quiet text. Gold rule under the current step. No numbered circles
- **D-92:** Status chip = semantic text on ivory, hairline border. Not a loud fill
- **D-93:** Price lines = hairline charcoal between them. Gold rule stays between page sections only
- **D-94:** Overlay width = narrow for confirm. Wide for stay pick, up to the content column
- **D-95:** Small-screen drawer = full width of the screen
- **D-96:** Dialog actions = cancel at the start, primary at the end. End flips in Arabic
- **D-97:** Icons = 16 inline, 20 in buttons, 24 standing alone
- **D-98:** Empty select = one charcoal line. No fake options
- **D-99:** Ops table = hairline rows, no zebra. Lato header. Hover darkens slightly
- **D-100:** Textarea = same border as inputs, label above, grows with content, min three lines
- **D-101:** Long lists show all. No pager
- **D-102:** Switch = teal when on, ivory track when off. Label beside it
- **D-103:** Avatar = circle. Monogram on ivory if there is no photo
- **D-104:** Copy and share = text button. Toast on success. Not icon-only
- **D-105:** Video = muted by default, pauses off-screen. Quiet corner control, not a full player chrome
- **D-106:** Cookie banner = bottom bar. Necessary on and locked. Analytics and marketing are switches. Gold save
- **D-107:** Search field = same input chrome, icon at the start
- **D-108:** Filter chips = text chips. Teal border when on, ivory when off
- **D-109:** Maintenance banner = full-width ivory bar under the header. Charcoal text. Not red
- **D-110:** File upload = dashed ivory area, charcoal label, gold button. No clipart cloud
- **D-111:** Map = teal pin, quiet map, no extra chrome
- **D-112:** Phone = same input, label above. Placeholder is an example, not the label
- **D-113:** Back = text link at the start. Not a gold button
- **D-114:** Package card = vertical. 16:9 image, name, one line, group price. Request is a secondary button, not gold pay
- **D-115:** Save a stay = heart icon button. Teal, gold when saved. Has a name. Signed-in only
- **D-116:** Sort = same select overlay. Label Sort
- **D-117:** Consultation times = chips in a row. Teal border when selected. Taken slots muted and shown, not hidden
- **D-118:** Booking reference = Lato, tabular, charcoal. Not gold
- **D-119:** Story card = 16:9 image, Questa title, one line. No comments, no share row
- **D-120:** Team block matches the current front-page Meet the Team section. No circular photos. Photo shape is measured from that block. Published names are Maria Del Mar Valdes and María Francis, not the Framer placeholder names
- **D-121:** Destination card = full-bleed image. Name over a charcoal scrim
- **D-122:** Sign-in = split image and form
- **D-123:** Coupon = same input. Secondary Apply beside it. Error replaces the hint
- **D-124:** Address row = Home, Work, or Custom, then the address, text Edit
- **D-125:** UAE airport = three radio cards. Teal border on the selected one
- **D-126:** Legal page = centered column. Questa title. Lato body. Gold rule under the title
- **D-127:** Booking page header = Questa trip name. Ref in Lato tabular. Status chip beside the ref
- **D-128:** Sign-in split = image on the start side, form on the end. Start flips in Arabic
- **D-129:** Damage hold = own line under the total: Temporarily held. Not added into the total again
- **D-130:** Booking terms = checkbox. The label is the sentence, with a link. Required asterisk
- **D-131:** Dates = two inputs, check-in then check-out. Same chrome. Branded date picker, not the native calendar
- **D-132:** Guest names = one row per guest. First and last. Adult 1 required, the rest optional
- **D-133:** Review step = stacked sections. Each has a text Edit. Gold Pay only at the end
- **D-134:** Signed-in account = avatar opens a small menu: Bookings, Account, Sign out
- **D-135:** Date picker = ivory panel. Questa month. Teal fill across the range. Gold ring on start and end
- **D-136:** Saved card on review = last four and brand. Text Change. No card art
- **D-137:** Sign out = confirm modal. Sign out is danger. Cancel is secondary
- **D-138:** WhatsApp opens with the trip name and ref already in the message
- **D-139:** Password rules = charcoal hint under the field until it fails. Then the error replaces it
- **D-140:** Status chips = muted ivory, charcoal text. Gold only for confirmed
- **D-141:** Mobile nav = full-screen ivory overlay. Questa links. Gold close
- **D-142:** Price breakdown = closed by default. Text Show breakdown opens the lines
- **D-143:** Forgot password = email field, then a sent state. No link shown on screen
- **D-144:** Booking list = one row per booking. Trip, dates, status chip, ref
- **D-145:** Language switch = EN and AR as text. Active is charcoal, the other is muted
- **D-146:** Print = text Print. Browser print of the booking page. No separate receipt design
- **D-147:** Reset password = two password fields, both with an eye. Gold Save
- **D-148:** Cancel a booking = text Cancel. Confirm modal. Confirm is danger
- **D-149:** Special requests = same textarea. Optional. Label above
- **D-150:** Header on scroll = stays ivory and solid. No shrink, no hide
- **D-151:** Pay success = ivory page. Questa confirmation. Ref in Lato tabular. No second pay button
- **D-152:** Booking steps = text steps. Current is charcoal. Done is teal. Upcoming is muted. No numbered circles
- **D-153:** Payment failed = inline on review. Charcoal message. Gold Try again. Card stays
- **D-154:** No rooms = empty state on the stay list. One line. Text Change dates
- **D-155:** Phone price = sticky ivory bar. Total and gold Continue. Sits above the page
- **D-156:** Session expired = modal. Charcoal line. Gold Sign in. Form stays underneath
- **D-157:** Disabled = same shape, muted. No gold. Cursor not a pointer
- **D-158:** Server error = same as 404, different line. Text Try again
- **D-159:** Field errors = on submit, then as they fix each field
- **D-160:** FAQ = Questa question. Answer opens under it. One open at a time. No plus icon
- **D-161:** Stay photos = one 16:9. Text Photos opens the rest, one at a time
- **D-162:** Nights = Lato tabular, charcoal, between the two date fields
- **D-163:** Marketing emails = separate checkbox. Off by default. Not the terms box
- **D-164:** Photo viewer = ivory. One image. Text Previous and Next. Gold close
- **D-165:** Hold countdown = Lato tabular, charcoal, next to the status chip. No red
- **D-166:** Account page = one column. Name, email, phone, password. Gold Save at the end
- **D-167:** Language switch = EN, AR, and ES as text. Active is charcoal, the others muted. Replaces D-145
- **D-168:** Deposit or full = two radio cards. Teal border on the selected one. Amount on each card
- **D-169:** Dates = DD/MM/YYYY. Week starts Monday. Western numerals in Arabic
- **D-170:** Inclusions = Lato list. Included has no price. Extras show a price
- **D-171:** Child or infant = name, plus age. Adults stay first and last only
- **D-172:** Booker not staying = checkbox on the booker row. Off by default
- **D-173:** Nationality, emergency contact, passport = same inputs, no asterisk. Passport uses the file upload
- **D-174:** Unbookable stay = card stays. Charcoal reason under the name. The action is muted
- **D-175:** Pets = one charcoal line. Allowed, not allowed, or a fee
- **D-176:** Wifi, door, and exact address = only after Confirmed. Before that, one muted line
- **D-177:** Pay without an account = no wall. Text link under Pay: Create an account later
- **D-178:** Delete account = text Delete. Confirm modal. Confirm is danger
- **D-179:** Newsletter = email input and a secondary Subscribe. Toast on success. No gold
- **D-180:** List with us = footer text link. Same form chrome. Gold Send
- **D-181:** Plan with us = same form chrome. No pay button. Gold Send
- **D-182:** Card payment = Stripe element inside the same input chrome. Gold Pay under it
- **D-183:** Hold expired = modal. Charcoal line. Gold Choose a stay. The pick restarts
- **D-184:** Share = text Share opens Copy, WhatsApp, and the phone share sheet
- **D-185:** Check your email = ivory page. Questa line. No link on screen. Text Resend
- **D-186:** Receipt PDF = text Download on the booking page. Not a second design
- **D-187:** Consultation = Dubai slot, plus the guest’s local time in muted Lato
- **D-188:** Second city = text line. Opens WhatsApp with the booking ref already in the message
- **D-189:** Driver assigned or flights booked = same status chip. No phone number. No flight form on the site
- **D-190:** Change email = same input. Gold Save. Then the check-your-email page
- **D-191:** Too late to book today = charcoal line on the date field. Those dates stay visible, not hidden
- **D-192:** Add an extra after pay = same add-on row. Gold Pay the difference. Other changes are a text request
- **D-193:** Package add-on = shown, no remove control. Charcoal Included
- **D-194:** Airport meet = the included line. Home pickup = an add-on row
- **D-195:** Currency on pay = charcoal line: the hold restarts. Then the new total
- **D-196:** Remainder = same price block. Gold Pay the remainder. Not a new trip
- **D-197:** Ops sign-in = same split sign-in. No marketing nav. No public link
- **D-198:** Contact = name, email, phone, message. Gold Send. Calendar is the consultation chips
- **D-199:** Return home = same address line. Text Change if the return is different
- **D-200:** Change phone = same input. Gold Save. Toast. No email page
- **D-201:** Hero booker = one ivory bar. Destination, dates, guests. Secondary Search. No gold pay
- **D-202:** Map before confirm = teal pin. Charcoal Approximate under it
- **D-203:** Unsigned heart = heart stays. Tap opens sign-in. It does not save
- **D-204:** Package page = 16:9, Questa name, one line, group price. Secondary Request. Not gold pay
- **D-205:** Experiences list = same as add-on rows. Search and filter chips above

### Claude's Discretion
- D-08 focus ring (teal 2px offset)
- D-10 type sizes (brand book display + Framer UI)
- D-21 component internals (custom + Radix a11y only)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSGN-01 | Owner can open `/design` (owner-only) and see every core component in hover, focus, disabled, loading, error, and empty states | One long `/design` page (D-22) with a state matrix. Dev-only gate (D-35). Core set is the ROADMAP success list; remaining D-80–D-205 locks are static specimens on that page, not booking screens. |
| DSGN-02 | Guest and ops see the same token system (Questa primary, Lato secondary; Deep Teal `#1f3b40`, Charcoal `#262626`, Gold `#d4ba8a`, Ivory `#fffaf0`; light theme only) | One `@theme` token set (D-01, D-03, D-07). Ops is a `data-density="compact"` variant, not a second palette (D-62). No dark mode. |
| DSGN-03 | Guest sees RTL-flipped components when language is Arabic (`dir=rtl` on `<html>`, logical CSS, password eye on inline-end) | `/design` preview sets `dir` and `lang` on `<html>`, not a wrapper. Logical utilities only. Eye uses `inset-inline-end` (D-87). Arabic fonts load only in that preview (D-17, D-36). |
| DSGN-05 | Guest sees icons as vector components using token colors; icon-only controls have an accessible name | Trace `brand/Icons/*.jpg` to `currentColor` SVG components. No SVG files exist today. Sizes 16/20/24 (D-97). Eye is a separate simple SVG (D-87). |
| DSGN-06 | Guest sees branded 404 using Questa/Lato (no Bricolage) | Current 404 is `app/[...not_found]/route.ts` and hardcodes Bricolage. Replace it with `app/not-found.tsx` after a root layout exists (D-52). |
| DSGN-07 | Autoplay video is muted and pauses when off-screen; motion is kept | Specimen on `/design`: `muted` + `playsInline`, `IntersectionObserver` pause. `prefers-reduced-motion` shortens UI transitions (D-05) and does not delete the video (requirement says motion is kept). |
| PLAT-05 | Keyboard, visible focus, field errors, and translated alt text work on public and ops | Every control is a real button/link/input. Teal 2px offset ring on `:focus-visible` (D-08). Field error replaces the hint (D-37, D-71). Icon-only controls have an accessible name. `/design` shows EN/AR/ES alt strings; next-intl is Phase 2. |
</phase_requirements>

## Summary

Phase 1 adds a React design island beside the Framer HTML routes. It does not rebuild the site, does not book, and does not publish tokens. The stack is already locked by CONTEXT.md and `.planning/research/STACK.md`: Next.js 14.2.35, React 18, TypeScript, Tailwind v4 theme variables, custom controls, Radix only for dialog / listbox / focus trap. Do not introduce shadcn, a second theme, or dark mode. [CITED: `.planning/research/STACK.md`, `.planning/research/SUMMARY.md`]

The repo has no `app/layout.tsx`, no `page.tsx`, no Tailwind, and no tests. Every public URL is a `route.ts` that returns a Framer HTML string. Unknown URLs hit `app/[...not_found]/route.ts`, which is why the framework `not-found` boundary never runs today — the file says so, and the HTML sets `font-family: 'Bricolage Grotesque'`. A root layout is required once `/design` is a page. Route handlers are not wrapped by that layout, so Framer pages stay untouched if the plan does not edit their HTML strings. [VERIFIED: `app/[...not_found]/route.ts` lines 1–34; `package.json`; no `app/layout.tsx`]

Brand files are in the repo and match the locked hexes (`#1f3b40`, `#262626`, `#d4ba8a`, `#fffaf0`). Latin fonts are local: Lato is a full OFL family of TTFs; Questa is a single Regular WOFF. Arabic faces are not on disk; Next 14's Google font manifest includes Noto Naskh Arabic and Noto Sans Arabic, and they must load only for the Arabic preview. Icons are 14 JPGs plus an Illustrator file — there is no SVG to import. [VERIFIED: `brand/`]

**Primary recommendation:** Install Tailwind v4 + `radix-ui` + `@internationalized/date`, put tokens in `@theme`, build custom controls with logical CSS, render every required state on a dev-only `/design`, and replace the Bricolage catch-all with `app/not-found.tsx` only after the root layout exists.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tokens, fonts, component CSS | Browser / Client | CDN / Static | CSS variables and `next/font` files ship with the page. No Settings publish in this phase (DSGN-04 is Phase 5). |
| `/design` owner gate | Frontend Server (SSR) | — | `notFound()` when `NODE_ENV === 'production'` so a later Cloudflare deploy cannot serve the kit. No password, no auth (D-35; auth is Phase 2). |
| RTL preview | Browser / Client | Frontend Server (SSR) | The preview control sets `document.documentElement.dir` and `lang`. The root layout owns the initial `ltr` attributes. Do not set `dir` on a wrapper. [CITED: `.planning/research/PITFALLS.md`] |
| 404 | Frontend Server (SSR) | Browser / Client | `not-found.tsx` must return a real 404. The catch-all route handler currently swallows unmatched URLs. |
| Calendar math | Browser / Client | — | `@internationalized/date` for Monday weeks and range math. No API. |
| Dialog focus trap / listbox | Browser / Client | — | Radix primitives. Visuals stay custom (D-21). |
| Video pause off-screen | Browser / Client | — | `IntersectionObserver` in the specimen. No player backend. |
| Framer marketing pages | CDN / Static | — | Stay `app/**/route.ts` until Phase 6. Do not patch HTML strings. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 (pinned) | App Router pages for `/design` and `not-found` | Already installed. Do not upgrade. Route handlers keep serving Framer HTML. [VERIFIED: `package.json`] |
| react / react-dom | 18.3.1 (installed range `^18.3.1`) | Component runtime | Peer of Next 14.2.35 is `react@^18.2.0`. [VERIFIED: `npm view next@14.2.35 peerDependencies`] |
| tailwindcss | 4.3.3 (published 2026-09-08) | Utility API for the locked tokens | Project research pins Tailwind v4 + CSS variables, not a kit theme. [VERIFIED: `npm view`; CITED: `.planning/research/STACK.md`] |
| @tailwindcss/postcss | 4.3.3 (published 2026-09-08) | Next 14 PostCSS integration | Current official Next.js guide. No `tailwind.config.js` in v4. [CITED: https://tailwindcss.com/docs/guides/nextjs] |
| postcss | 8.5.28 (published 2026-09-03) | Required by the Tailwind PostCSS plugin | Same guide. [VERIFIED: `npm view`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| radix-ui | 1.6.7 (published 2026-07-31) | Dialog, Select/listbox, FocusScope only | Modal, drawer, select overlay, account menu. Peers include React 18. [VERIFIED: `npm view radix-ui peerDependencies`] |
| @internationalized/date | 3.12.4 (published 2026-09-23) | CalendarDate, Monday week start, range math | Date-range specimen. Do not mount React Aria's calendar UI. |
| @playwright/test | 1.63.0 (published 2026-09-23) | Keyboard, focus, RTL, 404 assertions | Dev dependency. Next 14.2.35 peers `^1.41.2`, so 1.63 is in range. [VERIFIED: `npm view`] |
| next/font/local | bundled with Next 14.2.35 | Questa + Lato | D-36. Do not add a font package. |
| next/font/google | bundled with Next 14.2.35 | Noto Naskh Arabic + Noto Sans Arabic | Only when the Arabic preview is on. Both names exist in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`. [VERIFIED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind v4 `@theme` | Tailwind v3 `tailwind.config.js` | Rejected. Contradicts D-07 and STACK.md. |
| Custom controls + Radix primitives | shadcn/ui | Rejected. D-21 and SUMMARY.md. shadcn ships its own theme, dark mode, and Bricolage-adjacent defaults. |
| `@internationalized/date` | Native `<input type="date">` or a full date-picker kit | Rejected. D-131 forbids the native calendar. A kit would fight the locked overlay visuals. |
| `radix-ui` Toast | Custom `role="status"` toast | Use the custom toast. D-21 does not authorize a Toast primitive. Timer, pause, and a stack of 3 are small. |
| Google Fonts at runtime | `next/font/google` at build | Rejected for Latin (files are local) and unnecessary for Arabic (Next self-hosts at build). |

**Installation:**

```bash
npm install tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.28 radix-ui@1.6.7 @internationalized/date@3.12.4
npm install -D @playwright/test@1.63.0
```

Gate each install behind `checkpoint:human-verify`. slopcheck is not on this machine, so package legitimacy is `[ASSUMED]` even though registry versions were verified.

**Do not install:** `shadcn`, `@radix-ui/themes`, `react-aria`, `react-aria-components`, `lucide-react`, `date-fns`, `moment`, `next-intl`, `class-variance-authority`, any icon font, any dark-mode plugin.

## Package Legitimacy Audit

> slopcheck was not available (`command -v slopcheck` failed). Registry identity, age, downloads, repo, and `scripts.postinstall` were checked. Disposition follows the missing-slopcheck rule: planner must human-verify before install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| tailwindcss@4.3.3 | npm | created 2017-10-06 | 95,576,864 / week | github.com/tailwindlabs/tailwindcss | [ASSUMED] | Flagged — human-verify before install |
| @tailwindcss/postcss@4.3.3 | npm | created 2024-02-02 | 27,016,134 / week | github.com/tailwindlabs/tailwindcss | [ASSUMED] | Flagged — human-verify before install |
| postcss@8.5.28 | npm | created 2013-11-04 | 229,706,637 / week | github.com/postcss/postcss | [ASSUMED] | Flagged — human-verify before install |
| radix-ui@1.6.7 | npm | created 2022-08-01 | 9,804,637 / week | github.com/radix-ui/primitives | [ASSUMED] | Flagged — human-verify before install |
| @internationalized/date@3.12.4 | npm | created 2021-10-28 | 11,036,505 / week | github.com/adobe/react-spectrum | [ASSUMED] | Flagged — human-verify before install |
| @playwright/test@1.63.0 | npm | created 2020-09-24 | 44,409,707 / week | github.com/microsoft/playwright | [ASSUMED] | Flagged — human-verify before install |

No `scripts.postinstall` on any of the six. [VERIFIED: `npm view <pkg> scripts.postinstall` returned empty]

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck did not run; nothing was recommended that failed a registry check)
**Packages flagged as suspicious [SUS]:** none on registry signals. All six still need a human-verify checkpoint because slopcheck did not run.

## Architecture Patterns

### System Architecture Diagram

```text
next dev
  │
  ├─ app/**/route.ts ──────────────► raw Framer HTML (no layout, no Tailwind)
  │
  └─ app/layout.tsx (fonts + tokens on <html>)
        │
        ├─ /design  ── NODE_ENV=production? ── yes ──► notFound() 404
        │                 │
        │                 no (next dev)
        │                 ▼
        │            one long specimen page
        │            jump links + state matrix
        │            AR toggle sets <html dir=rtl lang=ar>
        │
        └─ unmatched URL
              after catch-all route.ts is removed
              ▼
           app/not-found.tsx
              monogram + Questa line + one home link
              status 404, no Bricolage
```

### Recommended Project Structure

```text
app/
├── layout.tsx                 # <html lang dir>, font variables, globals.css. No marketing nav.
├── globals.css                # @import "tailwindcss"; @theme tokens
├── design/page.tsx            # dev-only kit. notFound() in production.
├── not-found.tsx              # D-52. Replaces the catch-all.
└── [...not_found]/route.ts    # DELETE only after not-found.tsx is proven to return 404
components/
├── ui/                        # button, field, select, checkbox, calendar, toast, nav, footer, …
├── icons/                     # traced SVGs, currentColor. Eye is separate from brand JPGs.
└── specimens/                 # stay row, add-on, price, hero booker — static, no data layer
lib/
├── fonts.ts                   # next/font/local + conditional Arabic loaders
└── format.ts                  # currency code before number; Western digits; DD/MM/YYYY
brand/                         # do not move. Fonts and logos stay here.
```

Do not add `app/page.tsx`. `/` is `app/route.ts` until Phase 6. A `page.tsx` beside that `route.ts` is a route conflict. [VERIFIED: `app/route.ts` exists; `app/page.tsx` does not]

### Pattern 1: Tokens through `@theme`

**What:** Brand primitives and semantic colors are CSS variables that also generate utilities.
**When to use:** Every color, font, radius, and motion value in `components/`.
**Example:**

```css
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  --color-teal: #1f3b40;
  --color-charcoal: #262626;
  --color-gold: #d4ba8a;
  --color-ivory: #fffaf0;
  --color-card: #ffffff;
  --color-fg: #262626;
  --color-heading: #1f3b40;
  --color-accent: #d4ba8a;
  --radius-control: 40px;
  --ease-brand: cubic-bezier(0.2, 0, 0, 1);
}

@theme inline {
  --font-display: var(--font-questa), Georgia, serif;
  --font-body: var(--font-lato), Arial, sans-serif;
}
```

`@theme` must be top-level, not nested in a selector. Use `@theme inline` when the value is another variable (`next/font` sets `--font-questa` on `<html>`). [CITED: https://tailwindcss.com/docs/theme]

Do not reset `--breakpoint-*`. D-06 keeps Tailwind defaults (sm 40rem / 640px, md 48rem / 768px, lg 64rem / 1024px, xl 80rem / 1280px, 2xl 96rem / 1536px). The Framer export's 809px cluster is not a new breakpoint.

### Pattern 2: Root layout does not own marketing chrome

**What:** `app/layout.tsx` only sets `<html>`, fonts, and the token class.
**When to use:** As soon as the first `page.tsx` exists.
**Why:** D-52's 404 is a monogram, a Questa line, and one home link. If nav and footer live in the root layout, the 404 inherits them. Nav and footer are specimens and components, composed by `/design`, not by the root layout.

Route handlers are not rendered inside `layout.tsx`. Adding the layout does not restyle Framer HTML. [CITED: Next.js route handlers are not part of the page/layout tree — https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers]

### Pattern 3: `dir` on `<html>`

**What:** Arabic preview sets `document.documentElement.dir = "rtl"` and `lang = "ar"`, and adds the Arabic font variables.
**When to use:** The language control on `/design` (D-167 names: EN, AR, ES).
**Why:** W3C requires `dir` on the `html` element so form controls and CSS inherit it. A wrapper `dir` leaves the browser bidi algorithm in LTR. Project PITFALLS already forbids `margin-left` / `text-align: right` skins. [CITED: https://www.w3.org/International/questions/qa-html-dir; `.planning/research/PITFALLS.md`]

Logical properties only inside `components/`: `ms-*`, `me-*`, `ps-*`, `pe-*`, `inset-inline-*`, `text-start`, `text-end`. The password eye is `inset-inline-end`, never `right`. Do not flip the wordmark SVG. [CITED: `.planning/research/SUMMARY.md`]

### Pattern 4: Dev-only `/design`

**What:** The page calls `notFound()` when `process.env.NODE_ENV === "production"`.
**When to use:** `app/design/page.tsx` for this phase.
**Why:** D-35 forbids a public URL and forbids a password in the repo. `next build` runs with `NODE_ENV=production`, so the built page is a 404. `next dev` renders the kit. Phase 2 replaces this with owner auth. Do not add a shared secret, basic auth, or a cookie.

### Pattern 5: Specimens, not flows

**What:** Stay row, add-on, price, calendar, hero booker, and the rest of D-80–D-205 render with fixture copy on `/design`.
**When to use:** Every locked visual that is not in the ROADMAP success list still needs a specimen, because CONTEXT says those locks are specimens the system must be able to render.
**Why:** Building `/booking/trip`, Stripe Elements (D-182), or Supabase here violates the phase boundary. The price block shows the line order with hardcoded amounts. The Stripe chrome is a same-looking input frame with no Element mounted.

### Anti-Patterns to Avoid

- **Patching Framer HTML strings** to "add" tokens. CONTEXT and ARCHITECTURE both forbid it. The island is new React.
- **`app/not-found.tsx` while `app/[...not_found]/route.ts` still exists.** The catch-all matches first. The 404 will keep shipping Bricolage.
- **Physical `left`/`right` utilities** in components. They will not flip when `dir=rtl`.
- **Gold as text on ivory.** Contrast is 1.80:1. Gold is fill, rule, icon, and the calendar selection ring — not body copy. Keyboard focus is the teal ring (D-08), even though D-11 lists gold as a focus accent. Date start/end uses the gold ring (D-69); keyboard focus does not.
- **Loading every Lato file and both Noto families on every route.** Lato: Regular, Italic, Bold. Arabic fonts: only when the preview sets AR.
- **Using the brand-book contact** `Koussay.zayani0@gmail.com` / `+971 50 975 8018`. That is in the PDF footer. Product contact is `inquiries@almarprivatejourney.com` / `+971 56 388 3302`. [VERIFIED: brand PDF extract vs REQUIREMENTS SITE-13]
- **Using `#f9f6f3`, `#183e43`, or `#a98e58`** because they appear in the Framer export. Locked ivory/teal/gold win. Those hexes are live-site drift, not tokens.
- **Pill radius from the current 404** (`border-radius: 999px`). Homepage export radii are `0` and `40px`. Stepper buttons are circles because D-86 says so, not because the 404 is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap, escape-to-close, scroll lock | A custom modal focus loop | `radix-ui` Dialog + FocusScope | Missing focus return and inert background fail PLAT-05. D-21 already picks Radix for this. |
| Select listbox keyboard | A `div` menu with click handlers | `radix-ui` Select (listbox) with custom field visuals | Arrow keys, typeahead, and `aria-activedescendant` are the bug farm. D-29 says the list uses the same overlay as other dialogs — style the popup, don't replace the behavior. |
| Calendar grid math | Hand-rolled month lengths and weekday indexes | `@internationalized/date` | Monday start, month lengths, and range preview (D-83) are easy to get wrong. The panel chrome stays custom (D-135). |
| Font loading | `<link>` to Google or a new `@font-face` in the 404 | `next/font/local` and `next/font/google` | Next self-hosts and emits the CSS variable. A raw `@font-face` is how Bricolage got into the 404. |
| Icon set | lucide, heroicons, or `<img src="Icons-0N.jpg">` | Traced SVG components, `currentColor` | DSGN-05 requires vectors and token color. JPGs cannot take `currentColor`. |
| Password eye | A brand JPG or an icon-font glyph | One 20px eye SVG, `inset-inline-end` | D-87. |

**Key insight:** Hand-roll the visuals. Do not hand-roll focus management, listbox keyboard, or calendar arithmetic.

Toast is the exception that stays custom: `role="status"`, 4s timer, pause on hover, max 3, bottom center (D-27, D-55). Do not add Radix Toast.

## Common Pitfalls

### Pitfall 1: Catch-all 404 hides `not-found.tsx`
**What goes wrong:** Planner adds `app/not-found.tsx` and a root layout, leaves `app/[...not_found]/route.ts` in place, and the live 404 still uses Bricolage.
**Why it happens:** The catch-all was written because there was no root layout. That comment is still true until the layout exists, and it stays true after the layout exists if the catch-all remains.
**How to avoid:** Add `app/layout.tsx` and `app/not-found.tsx` first. Then delete `app/[...not_found]/route.ts`. Request an unknown path and assert status 404, body has no `Bricolage`, and a known Framer path (`/contact`) still returns the Framer HTML.
**Warning signs:** Response HTML contains `font-family: 'Bricolage Grotesque'` or `generator` Framer on a path that should be the new 404.

### Pitfall 2: `dir` on a div
**What goes wrong:** Arabic preview flips a section with `dir="rtl"` or `rtl:` variants while `<html dir="ltr">` stays. Password fields and native controls do not flip. The eye stays on the physical right.
**Why it happens:** Tailwind `rtl:` variants feel sufficient. They are not. [CITED: `.planning/research/PITFALLS.md`]
**How to avoid:** Toggle `document.documentElement`. Use logical properties. Assert in Playwright that `html` has `dir=rtl` and the eye's inline-end edge matches the field's inline-end edge.
**Warning signs:** Components use `ml-`, `mr-`, `left-`, `right-`, `text-left`, or `text-right`.

### Pitfall 3: Gold text and a missing focus ring
**What goes wrong:** Primary label is ivory or white on gold, or focus is `outline: none` because D-56 says the border color does not change.
**Why it happens:** D-11 and D-56 get read as "no extra border" and "gold is the focus color."
**How to avoid:** Primary label is teal on gold (contrast 6.37:1, passes AA). Keyboard focus is `outline: 2px solid #1f3b40; outline-offset: 2px` on `:focus-visible`. The input border stays the hairline charcoal. [VERIFIED: contrast math; CITED: WCAG 2.4.7, https://www.w3.org/WAI/WCAG22/Understanding/focus-visible]
**Warning signs:** `outline-none` without a replacement ring. Gold used as `color` on ivory (1.80:1).

### Pitfall 4: Questa Grand is not in the repo
**What goes wrong:** The plan specifies Questa Grand / Questa Sans weights the brand book implies, then the build fails or substitutes a Google serif.
**Why it happens:** The brand PDF names QUESTA as primary and does not ship a file list. The only webfont is `brand/Font/questa-webfont/2-Questa_Regular.woff` (42,732 bytes, weight 400). [VERIFIED]
**How to avoid:** Load that one file as the display face. Do not download Questa. Do not substitute Playfair, Freight, or Philosopher (Philosopher appears as a specimen artifact in the Lato section of the PDF — ignore it). Headings stay weight 400 until a licensed heavier file is added later.
**Warning signs:** A new font file appears that was not in `brand/Font` at research time.

### Pitfall 5: Icons shipped as JPGs
**What goes wrong:** `/design` uses `<img src="/brand/Icons/Icons-02.jpg">`. Color cannot follow tokens. RTL and `currentColor` do nothing. DSGN-05 fails.
**Why it happens:** `brand/Icons/` has `Icons-01.jpg` through `Icons-14.jpg` and `Icons.ai`. No SVG. [VERIFIED]
**How to avoid:** Trace each mark into `components/icons` as a 24-viewBox SVG using `currentColor`. `Icons.ai` is not a runtime asset. The eye, chevron, close, lock, and heart can be simple geometric SVGs where D-87 or the control spec says "simple" rather than "brand JPG."
**Warning signs:** Any `<img>` whose src ends in `Icons-*.jpg` inside `components/`.

### Pitfall 6: Tailwind preflight or layout CSS leaking into Framer
**What goes wrong:** Someone imports `globals.css` from a route handler, or converts `app/route.ts` into a page to "share" the layout.
**Why it happens:** It looks like the easy way to put Questa on the homepage.
**How to avoid:** Homepage stays a route handler until Phase 6. Tokens apply to `/design` and `not-found` only.
**Warning signs:** `app/page.tsx` exists, or a Framer route imports React components.

### Pitfall 7: Hit target shrinks in compact density
**What goes wrong:** Ops compact reduces the button to the Framer 40px height and fails the 44px rule.
**Why it happens:** The homepage export's most common explicit height is 40px. D-20 and D-62 override that.
**How to avoid:** `min-height: 44px` and `min-width: 44px` on every control, including compact. Compact changes type size and padding, not the hit box.
**Warning signs:** A control's border box is under 44px in either density.

### Pitfall 8: Arabic digits
**What goes wrong:** `lang="ar"` causes a formatter to emit Arabic-Indic numerals.
**Why it happens:** Default `ar` numbering is not latn. D-40 and D-169 require Western numerals.
**How to avoid:** Specimens hardcode Western digits. Format helpers use `ar-AE-u-nu-latn` if `Intl` is called. `font-variant-numeric: tabular-nums` on prices, dates, counts, refs, and the hold timer. [CITED: `.planning/research/STACK.md`]
**Warning signs:** A specimen string contains `٠١٢٣٤٥٦٧٨٩`.

## Code Examples

### Fonts

```typescript
// Source: https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts
import localFont from "next/font/local";

export const questa = localFont({
  src: "../brand/Font/questa-webfont/2-Questa_Regular.woff",
  weight: "400",
  style: "normal",
  variable: "--font-questa",
  display: "swap",
});

export const lato = localFont({
  src: [
    { path: "../brand/Font/lato/Lato-Regular.ttf", weight: "400", style: "normal" },
    { path: "../brand/Font/lato/Lato-Italic.ttf", weight: "400", style: "italic" },
    { path: "../brand/Font/lato/Lato-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-lato",
  display: "swap",
});
```

Adjust the relative path to wherever `lib/fonts.ts` lives. Call the Arabic loaders from the same module, but apply their `variable` class on `<html>` only while the preview language is AR (D-36). Next font names: `Noto_Naskh_Arabic`, `Noto_Sans_Arabic`, subset `arabic`. [VERIFIED: font-data.json weights exist]

### Logos

- Desktop wordmark: `brand/Logo Typography/Poly_Black.svg` (fills are `#000`, so it sits on ivory as charcoal-black). Gold and white siblings exist (`Poly_Gold.svg`, `Poly_White.svg`) for later surfaces. Do not recolor the SVG by editing the file; use the black file on ivory.
- Small-screen monogram: `brand/Logo Monogram/Curves_black.svg`. White sibling: `Curves_White.svg`.
- 404 monogram: the same Curves SVG, large, on ivory (D-52). Not a JPG, not a stock photo.

### Focus ring

```css
/* Source: https://www.w3.org/WAI/WCAG22/Techniques/css/C45 */
:focus-visible {
  outline: 2px solid #1f3b40;
  outline-offset: 2px;
}
```

Do not set a second border color on inputs (D-56). Do not use `outline: none` on mouse `:focus` in a way that also kills `:focus-visible`.

### Layer scale

D-66, top of stack first:

| Layer | z-index | Notes |
|-------|---------|--------|
| Modal and drawer | 70 | Scrim is charcoal at low opacity (D-38). Confirm/pay specimens do not close on scrim click. |
| WhatsApp | 60 | `bottom` + `inset-inline-end`. Official WhatsApp green (D-53). Number `+971 56 388 3302`. [VERIFIED: REQUIREMENTS SITE-03] |
| Toasts | 50 | Bottom center, under the WhatsApp button (D-44). |
| Sticky header | 40 | Solid ivory, hairline, no shadow (D-65). No shrink on scroll (D-150). |

### Measured tokens to snap

From `app/route.ts` (the deployed homepage source), not a live computed-style pass. The in-app browser was unavailable.

| Measured | Count signal | Snap | Token |
|----------|--------------|------|--------|
| width/max-width 1440 | artboard | keep as canvas reference only | — |
| max-width 1240, padding 120 on large | explicit content width | 1240 is already on the 4px grid | `--column: 1240px` (D-58) |
| width 390 | mobile artboard | not a breakpoint | — |
| gap 10px (53 hits) | off-grid | snap to 8px | `--space-2` |
| gap 12px | already on grid | keep 12 | `--space-3` |
| gaps 4, 8, 16, 20, 24, 32, 40, 64 | on grid | keep | spacing scale |
| radius 0 and 40px | only literal radii | 40 outer; inner = max(0, 40 − padding) | `--radius-control: 40px` |
| box-shadow literals | none (only Framer variables) | overlay shadow is a discretion value, see Assumptions | — |
| font-size cluster 12, 14, 16, 18 | UI | keep; do not ship 10/11/12.5/13 as a scale | Lato UI |
| font-size 26, 28, 30, 32, 45 | display | snap to 24, 28, 32, 40, 48 | Questa display |
| letter-spacing `-0.02em` | 39 hits on homepage | display tracking | — |
| line-height 1.5 / 1.2 | body / display | Lato 1.5, Questa 1.15–1.2 | — |

UI type recommendation (D-10 discretion): Lato 12 / 14 / 16 / 18. Display Questa 32 / 40 / 48 / 72 only where a specimen needs a title (404 title can use the existing clamp max of 72). Do not invent a brand-book pixel scale — the PDF typography pages have no extracted sizes. [VERIFIED: PDF text extract has no px type scale]

### Status colors

Not in the brand book (D-15). Use these on ivory; all pass 4.5:1. [VERIFIED: contrast math] [ASSUMED: the exact hexes]

| Role | Hex | Contrast on `#fffaf0` |
|------|-----|------------------------|
| Error red | `#8f2d2d` | 7.82 |
| Success green | `#1e6b45` | 6.22 |
| Warning amber | `#8a5a12` | 5.68 |

Red is field errors only (D-68). Unavailable reasons, hold timers, and disabled controls stay charcoal.

### Contrast that must not be "fixed" by changing the brand

| Pair | Ratio | Use |
|------|-------|-----|
| `#1f3b40` on `#fffaf0` | 11.48 | Headings, links, focus ring |
| `#262626` on `#fffaf0` | 14.55 | Body |
| `#1f3b40` on `#d4ba8a` | 6.37 | Primary button label |
| `#d4ba8a` on `#fffaf0` | 1.80 | Never text |

### `/design` state matrix

ROADMAP success criterion 1 is the minimum visible set: link, button, input, password+eye, select, checkbox, radio, date range, guest stepper, card, modal, toast, nav, footer, stay card, add-on row, price, icons.

For each, show the states that apply from DSGN-01 (hover, focus, disabled, loading, error, empty). Label N/A where a state cannot apply (a link has no loading state). Do not invent a fake loading link.

Also render static specimens for the locked booking visuals (hero booker, calendar, price lines, deposit radios, status chip, cookie bar, video, WhatsApp, language/currency). Fixture data only. No fetch, no Stripe, no Supabase.

Copy rules for specimens:

- Contact: `inquiries@almarprivatejourney.com` / `+971 56 388 3302`
- Team names if shown: Maria Del Mar Valdes and María Francis (D-120)
- Amounts: `AED 1,240` or `AED 1,240.50` — code before number, comma thousands, decimals only when not whole (D-50)
- Dates: `DD/MM/YYYY`, week Monday (D-169)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@theme` + `@tailwindcss/postcss` | Tailwind v4 (this registry: 4.3.3 on 2026-09-08) | Do not add a JS config. Next 14 still uses PostCSS, which is the supported path. [CITED: https://tailwindcss.com/docs/guides/nextjs] |
| `@radix-ui/react-dialog` one package per primitive | `radix-ui` barrel, peers React 18 | Package 1.6.7 | One dependency. Import Dialog / Select / FocusScope only. |
| Framer catch-all 404 with Bricolage | `app/not-found.tsx` once a root layout exists | This phase | Required for DSGN-06. |
| shadcn as the design system | Custom visuals, Radix for a11y only | Locked in CONTEXT D-21 | Do not run the shadcn CLI. |

**Deprecated/outdated:**

- Bricolage Grotesque on the 404: remove with the catch-all. Do not keep the `@font-face` "just in case."
- `#f9f6f3` page wash and `#0f677d` link teal in the current 404: not tokens.
- CONVENTIONS.md "do not add page.tsx": superseded for this phase by CONTEXT.md. Add `app/design/page.tsx` and `app/not-found.tsx` only. Do not add `app/page.tsx`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 10px Framer gaps snap to 8px (nearest 4px grid step; 12 was equally far and would loosen the most common gap). | Measured tokens | Spacing looks tighter than the live site. Planner can flip the token to 12px without a new discuss. |
| A2 | Content column is 1240px because that max-width is explicit in the homepage export. 120px page padding on a 1440 artboard would imply 1200px. | Measured tokens | Column is 40px off. Both are on the 4px grid. |
| A3 | Overlay shadow is `0 16px 40px rgb(38 38 38 / 0.12)`. Homepage CSS has no literal `box-shadow` values, only Framer variables. Header stays shadowless (D-65). | Pattern 1 | Overlay feels heavier or lighter than the live site. Not a brand-book value. |
| A4 | Scrim opacity is 0.40 charcoal (`#262626`). D-38 says low opacity and does not give a number. | Layer scale | Scrim too strong or too weak. |
| A5 | Status hexes `#8f2d2d` / `#1e6b45` / `#8a5a12`. Contrast on ivory is verified; the hues are not in the brand book. | Status colors | Owner rejects the hues. They still must not be gold, and they must stay ≥ 4.5:1. |
| A6 | `radix-ui` named exports are `Dialog`, `Select`, and `FocusScope` from the package barrel (`exports["."]` exists). Exact specifier was not imported in this session. | Standard Stack | One-line import fix at install. Behavior is still Radix primitives, not shadcn. |
| A7 | Homepage export CSS matches what the live site paints. Live browser measurement failed (`ERR_TUNNEL_CONNECTION_FAILED`). | Measured tokens | A computed style (actual header height, actual column) differs from the exported rules. Re-measure in `next dev` during planning if the owner cares about a 4px difference. |
| A8 | Display sizes 32/40/48/72 are a discretion fit. The brand PDF does not contain a numeric type scale. | D-10 | Owner wants different display sizes. UI sizes 12/14/16/18 are measured. |

**User confirmation:** A1–A5 and A8 are discretion inside locked decisions, not new product questions. Do not re-ask D-01–D-205. A6 is an install-time check. A7 is optional re-measure.

## Open Questions

1. **Which of the 14 icon JPGs map to which control?**
   - What we know: 14 JPG specimens plus `Icons.ai`. No SVG. No labels in the filenames.
   - What's unclear: A stable name map (stay, guest, calendar, and so on) was not transcribed from the sheets in this pass.
   - Recommendation: During implementation, open `brand/Icons/Icons-01.jpg` through `Icons-14.jpg` and name the traces in `components/icons`. Do not block planning on the names. Do not ship the JPGs as the components.

2. **Is there a licensed Questa Bold/Grand file the owner can drop in later?**
   - What we know: Only Regular WOFF is in `brand/Font`.
   - What's unclear: Whether a heavier cut exists outside the repo.
   - Recommendation: Ship Regular. Do not fetch a commercial face. A later file drop is a token change, not a phase blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Next 14 build | ✓ | v26.7.0 | — |
| npm | Package install | ✓ | 11.19.0 | — |
| Next.js / React / TypeScript | Existing app | ✓ | 14.2.35 / 18.3.1 / ^5 | — |
| slopcheck | Package legitimacy gate | ✗ | — | Human-verify checkpoint before each install |
| Playwright browsers | RTL and focus tests | ✗ | — | Wave 0: `npx playwright install chromium` |
| Knowledge graph | Cross-doc discovery | ✗ | — | Research used the planning docs directly |
| Live site browser | Framer computed-style measure | ✗ | tunnel failed | Measured `app/route.ts` CSS instead |

**Missing dependencies with no fallback:**
- None that block planning. Installs happen in Wave 0 / plan execution, not in this research pass.

**Missing dependencies with fallback:**
- slopcheck — human-verify before `npm install`.
- Playwright browsers — install Chromium in Wave 0.
- Live browser — export CSS measure, flagged as A7.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed. Wave 0 adds Node's built-in test runner for static checks, plus `@playwright/test@1.63.0` for interaction. Do not add Jest or Vitest. [VERIFIED: `.planning/codebase/TESTING.md`; `package.json` has no test script] |
| Config file | none — see Wave 0 |
| Quick run command | `node --test tests/design-tokens.test.mjs` |
| Full suite command | `node --test tests/design-tokens.test.mjs && npx playwright test && npx tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DSGN-01 | `/design` in dev lists link, button, input, password+eye, select, checkbox, radio, date range, guest stepper, card, modal, toast, nav, footer, stay card, add-on row, price, icons, each with its applicable states | e2e | `npx playwright test tests/design-page.spec.ts` | ❌ Wave 0 |
| DSGN-02 | Computed styles use `#1f3b40`, `#262626`, `#d4ba8a`, `#fffaf0`; Questa/Lato family names; no dark class | unit + e2e | `node --test tests/design-tokens.test.mjs` | ❌ Wave 0 |
| DSGN-03 | Arabic preview sets `html[dir=rtl]`; eye sits on inline-end; no `margin-left` in `components/` | unit + e2e | `npx playwright test tests/design-rtl.spec.ts` | ❌ Wave 0 |
| DSGN-05 | Icon components are inline SVG with `currentColor`; icon-only controls expose an accessible name | e2e | `npx playwright test tests/design-a11y.spec.ts` | ❌ Wave 0 |
| DSGN-06 | Unknown path returns 404, body has no `Bricolage`, uses the monogram and one home link | e2e | `npx playwright test tests/not-found.spec.ts` | ❌ Wave 0 |
| DSGN-07 | Video specimen is `muted` and pauses when scrolled off-screen | e2e | `npx playwright test tests/design-video.spec.ts` | ❌ Wave 0 |
| PLAT-05 | Tab reaches every control; `:focus-visible` ring is visible; field error is under the label; alt text differs in the AR preview | e2e | `npx playwright test tests/design-a11y.spec.ts` | ❌ Wave 0 |

Static token test (no browser) should also fail if `components/` or `app/globals.css` contains `Bricolage`, `#f9f6f3` as a token, or `outline: none` without a `:focus-visible` rule.

### Sampling Rate

- **Per task commit:** `node --test tests/design-tokens.test.mjs`
- **Per wave merge:** `node --test tests/design-tokens.test.mjs && npx playwright test && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `playwright.config.ts` — `webServer` runs `npm run dev`, `baseURL` `http://127.0.0.1:3000`, chromium only for the quick loop
- [ ] `tests/design-tokens.test.mjs` — DSGN-02, DSGN-06 string bans, logical-CSS grep
- [ ] `tests/design-page.spec.ts` — DSGN-01 inventory
- [ ] `tests/design-rtl.spec.ts` — DSGN-03
- [ ] `tests/design-a11y.spec.ts` — DSGN-05, PLAT-05
- [ ] `tests/not-found.spec.ts` — DSGN-06 status and body
- [ ] `tests/design-video.spec.ts` — DSGN-07
- [ ] Framework install: `npm install -D @playwright/test@1.63.0 && npx playwright install chromium`
- [ ] `package.json` scripts: `"test": "node --test tests/design-tokens.test.mjs && playwright test"` — do not invent this script until Wave 0 adds it

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 2. D-35 forbids a password in the repo. Do not add one. |
| V3 Session Management | no | No session in this phase. |
| V4 Access Control | yes | `/design` calls `notFound()` in production so the kit is not a public URL. This is a deploy guard, not owner auth. |
| V5 Input Validation | yes | Specimens do not submit. Newsletter, contact, and coupon controls on `/design` are inert. No `dangerouslySetInnerHTML`. SVG icons are hand-authored, not uploaded. |
| V6 Cryptography | no | No secrets, no hashing. |

ASVS level for this project is 1 (`security_asvs_level` in `.planning/config.json`).

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `/design` shipped on the public Worker | Information disclosure | Production `notFound()`. Test a production build, not only `next dev`. |
| XSS via unsanitized SVG or HTML fixture | Tampering | No `dangerouslySetInnerHTML`. No runtime SVG upload. Icons are source files. |
| CSS injection via token publish | Tampering | Out of scope. Settings → Brand is Phase 5 (DSGN-04). Tokens are constants. |
| Open redirect on 404 home link | Spoofing | Home link is hardcoded `/`. |
| Framer HTML edited while "fixing" 404 | Tampering | Do not change `app/**/route.ts` except deleting the catch-all after `not-found.tsx` works. |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-design-system/01-CONTEXT.md` — locked D-01–D-205
- `.planning/REQUIREMENTS.md` — DSGN-01, DSGN-02, DSGN-03, DSGN-05, DSGN-06, DSGN-07, PLAT-05
- `.planning/ROADMAP.md` — Phase 1 success criteria
- `.planning/research/STACK.md`, `SUMMARY.md`, `PITFALLS.md`, `ARCHITECTURE.md` — do not contradict; cited above
- `package.json`, `next.config.js`, `app/[...not_found]/route.ts`, `app/route.ts` CSS histogram
- `brand/Brand Guideline.pdf` text extract — hexes `1f3b40`, `262626`, `d4ba8a`, `fffaf0`; Questa primary, Lato secondary
- `brand/Font/` file inventory
- `npm view` for tailwindcss 4.3.3, @tailwindcss/postcss 4.3.3, postcss 8.5.28, radix-ui 1.6.7, @internationalized/date 3.12.4, @playwright/test 1.63.0 (2026-09-23)
- Next 14 font manifest — `Noto Naskh Arabic`, `Noto Sans Arabic`

### Secondary (MEDIUM confidence)

- https://tailwindcss.com/docs/guides/nextjs — `@tailwindcss/postcss`, `@import "tailwindcss"`
- https://tailwindcss.com/docs/theme — `@theme`, `@theme inline`, namespaces
- https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts — `next/font/local`, CSS variables
- https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers — route handlers vs pages
- https://www.w3.org/International/questions/qa-html-dir — `dir` on `<html>`
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible — visible keyboard focus
- https://www.radix-ui.com/primitives/docs/components/dialog — focus scope, dismiss, a11y
- npm download counts, week of 2026-09-23

### Tertiary (LOW confidence)

- None. Live computed-style measurement did not run; that gap is A7, not a guessed pixel value presented as fact.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified on npm this session; choices locked by CONTEXT and project STACK.md
- Architecture: HIGH — route-handler vs layout split is in the repo; phase boundary is explicit
- Pitfalls: HIGH — Bricolage 404, missing Questa cuts, JPG icons, and `dir` placement are file-backed

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 (package versions move; architecture locks do not)

## Planning notes (prescriptive)

1. Wave 0: human-verify the six packages, install them, add Playwright + the static test, do not build screens yet.
2. Tokens and fonts in `app/globals.css` + `lib/fonts.ts`. One token set. Compact density is a data attribute.
3. Root layout, then `app/not-found.tsx` (D-52), then delete `app/[...not_found]/route.ts` and prove `/contact` still serves Framer HTML.
4. Controls, in an order that unblocks specimens: link, button, field (input, password+eye, textarea), select, checkbox, radio, switch, then dialog (modal + end drawer), toast, calendar, stepper.
5. Compose nav, footer, stay row, add-on, price, hero booker, and the other locked specimens on `/design` with jump links (D-22).
6. Arabic toggle on `<html>`. Logical CSS review before calling DSGN-03 done.
7. Video specimen last (DSGN-07). Reuse a video URL already in the Framer homepage HTML if one is there. Do not add a new video host. `muted`, `playsInline`, pause when off-screen.
8. Stop. No booking route, no Stripe mount, no Supabase, no Settings → Brand, no Cloudflare change.
