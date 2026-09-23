# Phase 1: Design system - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

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

</deferred>

---
*Phase: 1-Design system*
*Context gathered: 2026-09-23*
