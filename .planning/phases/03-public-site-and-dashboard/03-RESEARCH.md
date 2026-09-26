# Phase 3: Public site and dashboard - Research

**Researched:** 2026-09-27
**Domain:** Next.js App Router screens on the existing `/framer` shell, plus named guest and dashboard screens. Four connections only: Hero Search, live FX, language, WhatsApp, newsletter.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Locked this session. Do not re-ask.

### Dashboard rooms
- **D-01:** Catalog screens (Destinations, Stays, Experiences & Services, Packages) show every field and button, named. Nothing saves.
- **D-02:** Home shows the layout with named empty slots. No sample numbers.
- **D-03:** Bookings and Customers show full table chrome, no rows. Each control is named.
- **D-04:** Calendar is a month grid. Days are named. No bookings are drawn.
- **D-05:** Content (Pages, Blog, Team, Legal) and Settings (brand, VAT, deposit, templates) show every field and button, named. Nothing saves.
- **D-06:** Superseded by D-16. Booking, customer, and stay details are sidebars, not full pages. They stay reachable with zero rows.
- **D-07:** An empty Bookings, Customers, or Stays list has one named action. That action opens the empty detail.
- **D-08:** Profile shows every field and button, named. Nothing saves.
- **D-09:** The Home date control (this month, last 30, custom) is drawn and named. It does not filter.
- **D-10:** Catalog and Content empty lists have one named action. That action opens the empty editor, which is a sidebar (D-16).
- **D-11:** Settings is one page. Fields are grouped.
- **D-12:** Calendar days open an empty day screen in the sidebar if the day is empty. Owner words: "They open an empty day screen in the sidebar if it's empty"
- **D-13:** A sidebar opens on top of the screen. The screen under it stays as it is and does not shrink. Every sidebar from now on opens on top. Owner words: "The side bar will open on top of the month grid. The month grid will stay as it is. It will not shrink but the side bar will open on top. Every side bar from now on will open on top of the screen"
- **D-14:** The empty day sidebar shows that day's fields, named and empty. Nothing saves.
- **D-15:** Opening a second empty day replaces the sidebar. One sidebar only.
- **D-16:** Booking, customer, stay, and editors also open as sidebars on top. The list or page under them does not shrink.
- **D-17:** A sidebar has a named close control. Click outside closes it.
- **D-18:** A sidebar uses the end side. It flips in Arabic.
- **D-19:** Settings groups are Brand, Money, Email, Maintenance, in that order.
- **D-20:** The empty-list action says New, then the thing. Examples: New booking, New stay, New destination.
- **D-21:** The empty-list line says No [things] yet, plus the New action.
- **D-22:** Sign out and Logout-all sit on Profile only, next to each other. Not in the dashboard header.
- **D-23:** On a phone or tablet, the dashboard header is a logo and a menu icon. The ops nav is inside the menu.
- **D-24:** Bookings columns are guest, destination, dates, and status.
- **D-25:** Customers columns are name, email, phone, and bookings count.
- **D-26:** An empty day sidebar shows the date, an empty bookings list, and a named Block control. Nothing saves. That list uses the D-21 line.
- **D-27:** On desktop, the ops nav is a start-side rail. It stays when a sidebar opens.
- **D-28:** Settings fields: Brand holds tokens, logos, and favicon. Money holds VAT, deposit, and FX. Email holds templates, reminders, and confirmation. Maintenance holds maintenance mode.
- **D-29:** Profile shows name, email, and a photo, plus Sign out and Logout-all.
- **D-30:** Catalog and Content lists show name and status.
- **D-31:** Home empty slots are bookings, revenue, cost, outstanding, occupancy, reminders, and charts. No sample numbers. Reminders uses the D-21 line.
- **D-32:** Catalog and Content children are always open in the desktop rail.
- **D-33:** A sidebar heading is New, then the thing. A day uses its date.
- **D-34:** The sidebar close control says Close.
- **D-35:** The dashboard header uses the same wordmark as the public header.
- **D-36:** The Experiences list shows type, price sort, and destination. They are named. They do not filter.

### Framer pages
- **D-37:** Superseded by D-47. The two looks are not every public URL this phase.
- **D-38:** Build both looks as real screens. The owner will choose which one later. Owner words: "Give me both options. Build, like you build the /design-kit and the current Framer look, and rebuild it as real screens and I will choose which one. In the current Framer look the only changes I want you to make when you create both are: to change the nav bar (the header), and to add the booking flow in the hero section of the home screen."
- **D-39:** Rebuilt public pages use the /design nav: wordmark, Destinations, Experiences, About, Contact, then currency, language, Login. Services stays a real URL. It is not in that nav.
- **D-40:** `/booking/trip` is named screens. Nothing saves and nothing charges.
- **D-41:** Contact, List with us, Plan with us, and the consultation calendar are drawn, named, and not sending.
- **D-42:** Superseded by D-47. Not two full trees.
- **D-43:** The kit home uses the current home section order, restyled.
- **D-44:** A kit stay page uses the current stay blocks, restyled.
- **D-45:** The kit footer is brand, links, List with us, and newsletter.
- **D-46:** Copy is in both looks. `/design` follows Framer, not the reverse. Owner words: "I want to copy in both looks but see, what I want you is this: even in /design I want that to follow the Framer page. Any element, any section, any component in Framer needs to be done in /design not the opposite. New: /design needs to follow /Framer not the opposite"
- **D-47:** The two looks are the home screen only, for now. URLs are `/framer` and `/design`. Other pages are later. Owner words: "only create both on the home screen that I told you to create, so I can see them... The URL right now that we have as a local screen, as a localhost, is like that: /framer. The other one is /design. Just to home/home/framer/design, like that, to see it. That's just the home screen for now. Later we will figure out." The `/kit` prefix is not the lock.
- **D-48:** `/design` pieces that Framer does not have stay, after the Framer set.
- **D-49:** One dashboard. It is not duplicated.
- **D-50:** After a look is chosen, the other comes out.
- **D-51:** `/framer` is the chosen look. Owner words: "I choose / framer one"
- **D-52:** `/` stays the live Framer site until a later phase.
- **D-53:** `/design` specimens stay at `/design`. They are not the public home.
- **D-54:** The floating WhatsApp control is on `/framer` and the later public pages.
- **D-55:** Local dashboard screens are at `/dashboard` on this dev server.
- **D-56:** Next area is Guest account.
- **D-57:** Guest screens drawn now are Bookings, Account, and Sign in. Named. Nothing saves.
- **D-58:** An empty guest booking list uses the D-21 line, plus a named way to start a trip.
- **D-59:** Account shows name, email, phone, and language. Named. Nothing saves.
- **D-60:** The guest opens those screens from the signed-in header menu: Bookings, Account, Sign out.
- **D-61:** Sign in on `/framer` is the email field, named. It does not send.
- **D-62:** Hero Search books. Owner words: "Why doesn't the hero search do bookings? Let's make it do bookings"
- **D-63:** Currency is connected to FX. Owner words: "No let's make it. Connect it, the FX, let's connect it"
- **D-64:** Language is connected. Owner words: "Let's connect them. Why don't they? Let's connect them"
- **D-65:** WhatsApp is connected and works. Owner words: "let's connect them and make it work"
- **D-66:** Newsletter is connected and works. Owner words: "let's connect them and make it work"

### Claude's Discretion

None yet.

### Deferred Ideas (OUT OF SCOPE)

Catalogue records stay out of this phase. A calendar day that already has a booking is not this phase. Price calculation beyond the connected FX is not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

Roadmap still lists these IDs on Phase 3. CONTEXT.md is the screen lock and supersedes the roadmap success criteria. Do not implement a deferred ID. Do not invent an ID.

| ID | Description | This phase |
|----|-------------|------------|
| STAY-03 | Guest cannot book a stay with no rates | Deferred. Catalogue and rates stay out. A Stay editor may label `Rates` and leave it empty. It does not calculate. |
| STAY-04 | Overlapping Deposit-paid or Confirmed nights are a hard block; unpaid draft holds 30 minutes; ops maintenance blocks dates | Deferred. No booking rows. No hold timer. No maintenance that turns the site off. |
| STAY-05 | Guest sees pets rule per stay | Deferred as data. Stay editor field `Pets` is named and empty. It does not save. |
| STAY-06 | Min nights default to 1; no max nights | Deferred as a rule. Stay editor field `Min nights` is named and empty. Do not draw a max-nights field. |
| STAY-07 | Same-day Instant Book respects ops cutoff hours/days per destination (UAE timezone) | Deferred. Do not draw a cutoff control. The ops calendar's "today" dot uses Asia/Dubai. |
| JOUR-05 | Ops can turn inclusions on/off per destination and override per stay | Deferred. Do not draw inclusion toggles. UI-SPEC says they are catalogue work. |
| PAY-16 | Nightly AED month/season rates, date overrides, Stripe fees, service, cleaning | Deferred. FX display is D-63, not this requirement. Do not calculate a trip price. |
| OPS-09 | Calendar is UAE timezone; conversion code exists but is off; overlap is a hard block | Deferred as behavior. Draw the empty month grid. Do not draw bookings. Do not implement overlap. |
| CMS-01 | Destinations CMS; seed five; add/remove without code | Deferred as records. Draw the empty Destinations list and empty editor. Do not seed rows. The hero Where list may keep the five names already in `HeroBooker`. That is not a catalogue. |
| CMS-02 | Experiences & Services catalog with type, price sort, destination filter | Deferred as data. Draw the three named controls. They do not filter. |
| CMS-04 | One stay record reused on search / destination / home | Deferred. No stay records. Search opens `/booking/trip` with an empty stay list. |
| CMS-05 | Draft → Publish; SEO required to publish | Deferred as a workflow. Editor button `Publish` is the one gold fill. It does not publish. |
| CMS-06 | Media is https URLs only; never Supabase storage | Screen only. Media fields are labeled URL fields. They do not upload. Reject a non-https value in the field, do not store it. |

No other requirement moves into this phase. BOOK-01, SITE-03, SITE-08, I18N-01, and PAY-15 stay on later phases. D-62 through D-66 are the only connections, and they are narrower than those IDs.
</phase_requirements>

## Summary

Phase 3 draws screens and connects five controls. It does not build the catalogue, a database, or a second public site. `/` stays the Framer HTML in `app/route.ts`. `/design` stays the specimen kit. `/framer` is already the chosen look: `FramerShell` paints `SiteNav` over an iframe of `/framer/source`, which hides the Framer nav and mounts `HeroBooker` in the hero. Keep that shell. Do not rebuild the home as React.

The five connections are missing on that shell today. Search submits and then shows "Search is a preview on this page." Currency is `useState` inside `SiteNav` and never fetches a rate. Language changes the dropdown value and does not change page copy or `dir`. WhatsApp is not in the home HTML and `components/ui/whatsapp.tsx` does not exist. The footer form exists inside the Framer HTML ("Join the List", honeypot `name="title"`) and does not post anywhere. `SiteFooter` fakes a toast and must not be used for D-66.

Dashboard, guest, and `/booking/trip` routes do not exist. Draw them as `page.tsx` segments. Do not add `page.tsx` beside an existing `route.ts`. New dev screens 404 in production, the same way `/framer` and `/design` already do. Do not deploy. Do not create a Supabase project, a Resend domain, a Worker, or an API key.

**Primary recommendation:** Extend the existing `/framer` iframe shell and the existing UI primitives. Add named React screens at new URL segments. Connect Search, FX, language, WhatsApp, and the existing footer form. Do not install a package.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/` live Framer HTML | CDN / Static | — | `app/route.ts` already serves it. This phase does not touch that handler. |
| `/framer` header, scroll state, WhatsApp | Browser / Client | — | `FramerShell` is already a client overlay. The iframe is a separate document. |
| Hero Search | Browser / Client | Frontend Server (SSR) | The booker runs inside the iframe. A complete search navigates the top window to `/booking/trip`. The trip screen is a React page, not an iframe. |
| FX rate | Frontend Server (SSR) | Browser / Client | Fetch the locked keyless URL on the server. The browser only receives two numbers. Do not let the guest type a rate. |
| Language | Browser / Client | — | Same URL. `dir` and copy change in place. No `/ar` route. No `next-intl`. |
| Newsletter | Frontend Server (SSR) | Browser / Client | The existing iframe form posts to a route handler. The handler calls Resend. The browser does not hold the key. |
| Guest and dashboard screens | Browser / Client | — | Named, empty, nothing saves. No database tier this phase. |
| Sidebar | Browser / Client | — | One overlay on top of the current screen. Not a route. Not a layout shrink. |

## Project Constraints (from HERMES.md)

HERMES.md is generated and stale against the tree. These directives still bind, except where a later lock already won.

- Workspace is this repo only. Do not touch other products.
- Never push `main`. This research does not commit.
- Do not `vercel deploy`. Do not create a Cloudflare Worker, Pages project, or DNS record.
- Contact stays `inquiries@almarprivatejourney.com` and `+971 56 388 3302`.
- Do not invent a domain, a key, or a second Worker.
- Supabase is data and auth only, never storage. The project is not created. Do not create it. Do not tell the planner to create it.
- Stripe stays out of this phase. Nothing charges.
- Secrets stay out of the repo and out of chat.
- Owner-gated steps stay gated: Worker/DNS/R2, Supabase project, Stripe live, Resend domain. One numbered step, then wait. This phase takes none of those steps.
- Light theme only. Square corners. No radio controls.
- Arabic is RTL. Dates are `DD/MM/YYYY`. Week starts Monday. Western numerals in Arabic.
- Calendars use UAE time. Stay nights are UAE calendar dates.
- Icon-only controls need an accessible name. Keyboard and visible focus stay.
- Do not rewrite Framer HTML route files as JSX. `app/route.ts` is the live `/` document.

Stale lines the planner must not obey:

- "Next.js 14.2.35" and "do not add `page.tsx` / `layout.tsx`". The installed pin is `next@15.5.26`. `app/layout.tsx`, `app/design/page.tsx`, and `app/framer/page.tsx` already exist. Do not revert the pin. Do not delete the layout.
- "Do not add a root layout" in the conventions block. The layout exists and loads `app/globals.css`. New screens use it.
- "vinext / OpenNext 1.20.x / Next 15–16" in REQUIREMENTS out-of-scope. The bump is already in `package.json` (`next@15.5.26`, `@opennextjs/cloudflare@1.20.6`). Do not bump again. Do not deploy.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.26 | App Router pages and route handlers | Already installed. Do not bump. `[VERIFIED: package.json]` |
| react / react-dom | 18.3.1 | Client screens | Already installed. `[VERIFIED: package.json]` |
| typescript | 5.x | Strict compile | `tsconfig.json` `strict: true`. `[VERIFIED: package.json]` |
| Existing CSS | `app/globals.css` | Tokens, `.site-nav`, `.hero-search-bar`, `.ops-table` | UI-SPEC forbids a second theme and a Tailwind config file. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| radix-ui | 1.6.7 | Dialog focus trap, listbox, dismiss | Sidebar and confirms only. Not shadcn. `[VERIFIED: package.json]` |
| @internationalized/date | 3.12.4 | Monday week, `DD/MM/YYYY`, Asia/Dubai today | Already used by `CalendarPanel`. `[VERIFIED: package.json]` |
| resend | 6.29.0 | `contacts.create` for the footer form | Already installed. No new package. `[VERIFIED: package.json]` |
| @playwright/test | 1.63.0 | Screen tests on port 3010 | Already the project runner. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `/framer` iframe | A React rebuild of every Framer section | Rejected. D-38 only changes the header and the hero booker. The shell already does that. |
| `next-intl` | A string table in the repo | Rejected. Phase 2 already forbids it. Same URLs. No locale prefix. |
| An FX npm package | The locked keyless URL | Rejected. Phase 2 plan 02-10 forbids `currency-api-date-range`. |
| `SiteFooter` toast | The Framer footer form | Rejected. UI-SPEC says the newsletter already on the `/framer` footer. `SiteFooter` does not send. |
| shadcn | `components/ui` | Forbidden. `components.json` is absent. Phase 1 D-21. |

**Installation:**

```bash
# Do not npm install. Every library this phase needs is already in package.json.
```

**Version verification:** `node -e` against `package.json` on 2026-09-27. `next` is `15.5.26`. No registry lookup was required because nothing new is installed.

## Package Legitimacy Audit

This phase installs no external package. The Package Legitimacy Gate was not run against a new name. `slopcheck` is not on the machine. That does not matter here: there is no install step.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| none | — | — | — | — | not run | No install |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Do not add `next-intl`, `currency-api-date-range`, an icon pack, a calendar widget, a table library, or shadcn.

## Architecture Patterns

### System Architecture Diagram

```
Guest browser
    │
    ├─ GET /                         → app/route.ts HTML. Unchanged. No injection.
    │
    ├─ GET /framer                   → FramerShell (SiteNav + WhatsApp)
    │       │
    │       └─ iframe GET /framer/source
    │               ├─ hides Framer nav
    │               ├─ mounts HeroBooker (esbuild bundle /embed/hero-booker)
    │               ├─ postMessage: locale + currency
    │               └─ existing footer form POST /newsletter
    │
    ├─ Search complete               → top window GET /booking/trip?...
    │
    ├─ GET /fx                       → server fetch of the locked rate URL
    │                                    returns { aed, eur, date } only
    │
    ├─ POST /newsletter              → Resend contacts.create
    │                                    no key in the client
    │
    └─ GET /dashboard/*              → React screens. One sidebar overlay.
                                       production: notFound
```

`/design` is not in that flow. Do not float WhatsApp on it. Do not restyle it into the public home.

### Recommended Project Structure

```
app/framer/                      # existing shell. Extend. Do not replace.
app/framer/source/route.ts       # injection point for home-only copy and prices
app/booking/trip/page.tsx        # new. Empty trip screens.
app/login/page.tsx               # new. Email field. Does not send.
app/bookings/page.tsx            # new. Guest empty list.
app/account/page.tsx             # new. Named fields. No Save.
app/dashboard/page.tsx           # new. Logged-out title is Sign in.
app/dashboard/home/page.tsx      # and the other named rooms
app/fx/route.ts                  # new. GET numbers only. Dev 404 in production.
app/newsletter/route.ts          # new. POST. Dev 404 in production.
lib/fx/rates.ts                  # new. The Phase 2 URL and parse rules.
components/ui/nav.tsx            # lift currency the way locale is already lifted
```

Do not add `app/page.tsx`. It conflicts with `app/route.ts`. `[CITED: https://nextjs.org/docs/app/getting-started/route-handlers]`

Do not add `middleware.ts`. Phase 2 plan 02-05 owns it and it does not exist yet. A client cookie plus `postMessage` is enough for this phase.

Do not add `app/ops`. The local path is `/dashboard` (D-55).

### Pattern 1: Keep the iframe shell

**What:** `/framer` is a client header over `/framer/source`. The source handler calls `homeGet()` from `app/route.ts`, hides `.framer-16ndy5u-container`, and runs `injectHeroBooker`.
**When to use:** Every home-only change: language copy, price rewrite, footer button label.
**Example:**

```typescript
// Source: app/framer/source/route.ts
const response = homeGet();
const html = await response.text();
const withNavHidden = html.replace("</head>", `${HIDE_FRAMER_NAV}</head>`);
const withBooker = injectHeroBooker(withNavHidden);
```

Apply new injection only in this handler. Never in `app/route.ts`. That file is `/`.

### Pattern 2: Search leaves the iframe

**What:** `HeroBooker` is mounted by `lib/framer-hero-booker-mount.tsx` inside the iframe. `onSubmit` currently calls `preventDefault` and the notice becomes `t.preview` ("Search is a preview on this page.").
**When to use:** D-62. A complete search navigates the top window. A missing destination or range shows the locked lines and does not navigate.
**Example:**

```typescript
// Source: components/specimens/hero-booker.tsx onSubmit, current behavior
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setTried(true);
  setOpen(null);
}
```

Replace the preview notice with `window.top.location.assign("/booking/trip?...")` only when `where`, `start`, and `end` are set. Hidden fields already exist: `where`, `check-in`, `check-out`, `adults`, `children`, `infants`. The booker bundle is rebuilt by `app/embed/hero-booker/route.ts` when those sources change. Do not fork a second booker.

### Pattern 3: FX on the server, prices in the iframe

**What:** Fetch `https://latest.currency-api.pages.dev/v1/currencies/usd.json`. Read `usd.aed` and `usd.eur` as numbers. `$` means USD. A written `AED` amount stays AED when the selected currency is AED. Conversion is `amount * rate` from the written currency, not from a catalogue.
**When to use:** The six amounts already in the home HTML: `$20,000`, `$3,000`, `$3,500`, `AED 120,000`, `AED 200,000`, `AED 80,000`. Only inside `/framer/source`. Not on `/`. Not on other Framer pages. That wider pass is Phase 2 plan 02-10 and is not built.
**Verified feed:** On 2026-09-27 the URL returned `date: 2026-09-26`, `usd.aed: 3.6725`, `usd.eur: 0.87786534`. Do not hardcode those numbers. `[VERIFIED: curl of the locked URL]`

Cache in memory for 12 hours. On failure, retry the same URL once, then use the last good cache. If there is no cache, leave the written amount as written. Do not invent a peg. Do not show a guest-facing error. Do not interpolate the raw JSON into HTML.

Settings → Money shows the fetched rate as text. She cannot type it. If the rate is not in yet, show nothing she can edit. No sample rate.

`SiteNav` keeps currency in local state and does not accept a callback. Lift `currency` / `onCurrency` the same way `locale` / `onLocale` already work, with the current internal state as the default so `/design` does not break.

### Pattern 4: Language changes the page, not just the chrome

**What:** The discuss log rejected "It switches the chrome. Page copy stays English." D-64 is a page change. Same URL. Closed labels stay `EN`, `AR`, `ES` (UI-SPEC conflict 11). Arabic sets `lang="ar"` and `dir="rtl"` on the shell document and on the iframe document.
**When to use:** `/framer` home copy, the booker, nav labels, guest screens, dashboard screens, and alt text on new screens. Not every `app/**/route.ts` page. That map is Phase 2 plan 02-09 and D-47 says other public pages are later.
**How:** A string table in the repo, following `lib/home-copy.ts`. The shell `postMessage`s the locale into the iframe. The iframe replaces text nodes. It does not set `innerHTML` from a query param. Standard Arabic and Spanish. The owner corrects them at UAT. Do not install `next-intl`.

The iframe does not inherit the parent font classes. Arabic in that document needs the existing `notoNaskh` and `notoSans` from `lib/fonts.ts`. Do not load another face.

Cookie names, if a cookie is set at all: `almar-locale` (`en` | `ar` | `es`) and `almar-currency` (`AED` | `USD` | `EUR`). Those names are already locked in Phase 2 plan 02-05. Do not invent new names. Account persistence is not this phase.

### Pattern 5: One sidebar, on top

**What:** Radix `Dialog` already provides the scrim, Escape, and focus trap (`components/ui/dialog.tsx` imports `Dialog` from `radix-ui`).
**When to use:** Every editor, booking, customer, stay, and empty day.
**Do not use `KitDialog` as the sidebar.** It is a centered specimen with an icon Close, plus Cancel and Continue. The sidebar close control is the text `Close`. Confirm dialogs (Sign out, Logout-all) do not close on scrim click. `KitDialog` already has that lock for `dismiss="confirm"`. Reuse the primitive, not the specimen chrome.

Width `min(32rem, 100%)`. Full width below `48rem`. `inset-inline-end: 0`. Do not hard-code `right`. The rail does not shrink. One sidebar. Opening another replaces it.

### Pattern 6: Production 404

**What:** `app/framer/page.tsx` and `app/design/page.tsx` call `notFound()` when `NODE_ENV === "production"`.
**When to use:** Every new screen and the `/fx` and `/newsletter` handlers. This phase does not ship to the live Worker.

### Anti-Patterns to Avoid

- **Rebuilding the home as JSX.** The shell already is the chosen look. A second home will drift from `/`.
- **Editing `app/route.ts` to connect FX or language.** That changes the live `/` page.
- **`Button variant="primary"` as the gold fill.** That variant is an ivory background with a gold border (`components/ui/button.tsx`). The gold fill is `.hero-search-submit` (`background: var(--color-accent)`, teal label). Dashboard `New` and `Publish` and `Save` need that fill, not the specimen primary variant.
- **A second header, a second booker, a second newsletter, a second WhatsApp.**
- **A route for each sidebar.** Sidebars are state on the list page.
- **Sample numbers, sample rows, a typed FX rate, a guest-facing rate error.**
- **Saying dashboard on `/framer` or any public page.** The word `touchword` is untranslated and only for the owner email, in the signed-in menu. There is no session this phase, so the item stays hidden. Do not hardcode a bypass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap and scrim | A custom overlay | `radix-ui` Dialog | Escape, outside click, and trap already exist. |
| Month math | A date library install | `@internationalized/date` | `getDayOfWeek(date, "en-GB")` is 0 on Monday. Verified 2026-09-28. `today("Asia/Dubai")` returned 2026-09-27. |
| Amount formatting | A new formatter | `lib/format.ts` `formatAmount` / `formatAmountLatn` | Code before number, comma thousands, two decimals only when not whole, Western digits in Arabic. |
| FX | A peg constant or an npm client | The locked URL, parsed to two numbers | A hardcoded 3.6725 is an invented rate the moment the feed moves. |
| Newsletter | A mailto link or a fake toast | `resend.contacts.create` | `SiteFooter` already fakes "Subscribed. Check your inbox." That fails D-66. |
| i18n routing | `next-intl` or `/ar` | Same URL, string table, `dir` | Locked. |
| Icons | An icon font or a second set | `components/icons/icons.tsx` | Add one WhatsApp glyph there. `currentColor`, stroke 1.5. No WhatsApp icon exists today. |
| Auth | Supabase session, magic link send | Named screens that do not send | D-61. The project does not exist. |

**Key insight:** The hard parts of this phase are already half-built in the shell. New libraries would duplicate them and violate the locks.

## Common Pitfalls

### Pitfall 1: Search stays a preview

**What goes wrong:** The bar looks done and still does not open `/booking/trip`.
**Why it happens:** `onSubmit` only sets `tried`. The success notice is the English string "Search is a preview on this page."
**How to avoid:** Navigate `window.top`, not the iframe's own location. Missing destination or dates stay on the hero and show the three locked lines.
**Warning signs:** The notice still contains "preview".

### Pitfall 2: Currency state never leaves SiteNav

**What goes wrong:** The dropdown switches and the six prices do not.
**Why it happens:** `currency` is `useState` inside `SiteNav`. Prices live in the iframe document.
**How to avoid:** Lift the value. `postMessage` into the iframe. Rewrite text nodes from the server-fetched rates.
**Warning signs:** A guest-facing "rate unavailable", or a rate typed into Settings.

### Pitfall 3: Language only flips the dropdown

**What goes wrong:** The owner already rejected chrome-only.
**Why it happens:** `FramerShell` stores locale and passes it to `SiteNav`, which still renders `DEFAULT_LABELS` in English unless `labels` is passed. The iframe document stays `lang="en"` `dir="ltr"`.
**How to avoid:** Pass translated labels. Set `dir` on both documents. Replace home text nodes.
**Warning signs:** Arabic selected and the hero is still LTR English.

### Pitfall 4: A second newsletter

**What goes wrong:** A React footer is added under the iframe, or `SiteFooter` is wired and toasts success.
**Why it happens:** `components/ui/footer.tsx` looks like the product footer. It is the kit footer. The `/framer` form is inside the HTML: placeholder "Your email address", button text "Join the List", hidden honeypot `name="title"`.
**How to avoid:** Post that existing form. Relabel the button to `Subscribe`. Make it secondary, not gold. Ignore the honeypot when it is filled. Do not add a captcha.
**Warning signs:** Two email fields. A gold Subscribe. A success toast with no Resend id.

### Pitfall 5: Sidebar shrinks the grid

**What goes wrong:** A layout grid gives the sidebar a column and the month compresses.
**Why it happens:** A drawer pattern from another product.
**How to avoid:** `position` overlay, `inset-inline-end: 0`, scrim on top of the page. The rail stays. One sidebar.
**Warning signs:** The month grid width changes when a day opens.

### Pitfall 6: `page.tsx` beside `route.ts`

**What goes wrong:** The build fails, or `/` stops serving the Framer HTML.
**Why it happens:** Next.js cannot have `page` and `route` in the same segment. `[CITED: https://nextjs.org/docs/app/getting-started/route-handlers]`
**How to avoid:** New screens get new segments. `/`, `/contact`, `/about`, and the stay slugs stay `route.ts`.
**Warning signs:** A new `app/page.tsx`.

### Pitfall 7: Gold fill from the wrong button

**What goes wrong:** `New booking` is an ivory button with a gold border, or Subscribe becomes the gold fill.
**Why it happens:** `Button variant="primary"` is not the accent fill. `.hero-search-submit` is.
**How to avoid:** One gold fill per view, using the accent fill. Subscribe stays secondary.
**Warning signs:** Two gold buttons on the hero or on a list.

### Pitfall 8: Dashboard reachable as a public word

**What goes wrong:** A nav link says dashboard, or the logged-out page title says dashboard.
**Why it happens:** OPS-01 and Phase 2 D-141. UI-SPEC conflict 12.
**How to avoid:** No public link. Logged-out title is `Sign in`. After the interior is drawn, the text beside the wordmark may say `DASHBOARD`. Production `notFound`. Do not implement a session to hide the interior, or the owner cannot see the screens this phase exists to draw. Do not persist that open path.

### Pitfall 9: Newsletter claimed sent without a key

**What goes wrong:** The toast says subscribed and nothing left the machine.
**Why it happens:** `RESEND_API_KEY` is unset. No `.env`, `.env.local`, or process value. Creating a domain or a key is forbidden.
**How to avoid:** Call `resend.contacts.create` only when the existing key is in the server environment. Toast success only when Resend returns an id. If the key is absent, do not invent one and do not toast success. See Open Questions.
**Warning signs:** `from: onboarding@resend.dev` used to mail an arbitrary subscriber. Do not do that. `[ASSUMED]` that the shared onboarding sender cannot deliver to arbitrary guests. Contacts do not need a from address. `[CITED: https://resend.com/docs/api-reference/contacts/create-contact]`

### Pitfall 10: Tests hit port 3000

**What goes wrong:** Playwright attaches to Twenty CRM.
**Why it happens:** STATE.md records `127.0.0.1:3000` held by Twenty. This repo's Playwright config uses port 3010.
**How to avoid:** Use `playwright.config.ts` as written. Do not change the port.

## Code Examples

### Route segment conflict

```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers
// app/page.ts and app/route.ts in the same segment are a conflict.
// app/page.ts and app/api/route.ts are valid.
```

Do not add `app/page.tsx`. Add `app/booking/trip/page.tsx` and `app/fx/route.ts`.

### cookies() if a server read is required

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/cookies
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("almar-locale");
  return locale?.value ?? "en";
}
```

`cookies()` is async in Next.js 15. Prefer not to need it. This phase can switch language in the client. Do not add middleware to read the cookie.

### FX parse

```typescript
// Source: Phase 2 plan 02-10, URL re-fetched 2026-09-27
// GET https://latest.currency-api.pages.dev/v1/currencies/usd.json
// Use only usd.aed and usd.eur as numbers.
// $20,000 is 20000 USD. AED 120,000 is 120000 AED.
// convert(120000, "AED", "AED", table) returns 120000.
```

### Resend contact

```typescript
// Source: https://resend.com/docs/api-reference/contacts/create-contact
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.contacts.create({
  email: submittedEmail,
  unsubscribed: false,
});
```

Read the key from the environment. Do not write it into the repo. Do not pass a from address. Do not create a segment, topic, or domain. Reject the post when the honeypot `title` is non-empty. Validate the email on the server. Empty email stays the client line `Enter an email address.`

### Monday and Dubai today

```typescript
// Source: @internationalized/date, executed in this repo 2026-09-27
import { CalendarDate, getDayOfWeek, today } from "@internationalized/date";

getDayOfWeek(new CalendarDate(2026, 9, 28), "en-GB"); // 0, Monday
today("Asia/Dubai"); // 2026-09-27 on that date
```

The ops month grid uses these helpers. It is not `CalendarPanel`. That panel is the booker's range picker. Days outside the month are hidden. Empty cells pad the grid. Today is a charcoal dot, not a fill. No bookings are drawn.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next 14 route handlers only | Next 15.5.26 with `page.tsx` for `/design` and `/framer` | Already in the tree | New screens are pages. Live URLs stay `route.ts`. |
| `cookies()` sync | `cookies()` async | Next.js 15 | Await it if used. `[CITED: https://nextjs.org/docs/app/api-reference/functions/cookies]` |
| Framer nav inside the HTML | `SiteNav` over the iframe, Framer nav hidden | Already in `/framer/source` | Do not build a third nav. |
| Preview Search | Search opens `/booking/trip` | D-62, not built | The only booker behavior change. |

**Deprecated/outdated:**

- HERMES.md stack block that says there is no `layout.tsx` and the pin is 14.2.35. The tree has moved. Do not follow those two lines.
- Phase 2 plan 02-05 closed labels `English` / `العربية` / `Español` on the live bar. UI-SPEC conflict 11: `/framer` reuses SiteNav `EN` / `AR` / `ES`. Do not add a second language control. Do not restyle `/`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `contacts.create` is the D-66 send. A confirmation email would need a verified from domain, which this phase must not create. | Don't Hand-Roll | If the owner meant a delivered inbox email, the key-and-domain gate blocks it. Do not invent either. |
| A2 | The shared Resend onboarding sender cannot mail an arbitrary subscriber. | Pitfall 9 | Low risk if the plan never uses `emails.send`. |
| A3 | Optional `currency` / `onCurrency` props keep `/design` working without a call-site change. | Pattern 3 | `/design` currency would stay local, which is correct. It is not the public home. |

## Open Questions

1. **Newsletter cannot be proven until the existing key is in the dev server.**
   - What we know: `resend@6.29.0` is installed. `RESEND_API_KEY` is unset in the process and in every `.env*` file except the empty example. No Resend domain may be created.
   - What's unclear: Whether the owner already has a key outside this repo.
   - Recommendation: Build the route. Toast only on a Resend id. Do not fake success. Do not create a key, a domain, a segment, or a Worker. Screens do not wait on this key.

2. **`touchword` cannot be proven without a session.**
   - What we know: UI-SPEC shows it only for the owner email, untranslated, in the signed-in menu. Sign-in does not send. Supabase is not created.
   - What's unclear: Nothing. There is no session to check.
   - Recommendation: Leave the item out. Do not hardcode the owner email as a login bypass.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Next dev and tests | ✓ | v26.7.0 | — |
| npm | Already installed deps | ✓ | 11.19.0 | — |
| next | Screens | ✓ | 15.5.26 | Do not bump |
| Playwright | Screen tests | ✓ | 1.63.0 | Config port 3010 |
| FX feed | D-63 | ✓ | date 2026-09-26 | Last cache, else leave the written amount |
| Resend package | D-66 | ✓ | 6.29.0 | — |
| RESEND_API_KEY | D-66 proof | ✗ | — | No fake success. Do not create a key |
| Supabase project | Not this phase | ✗ | — | Do not create one |
| ctx7 | Doc lookup | ✗ | — | Official docs fetched directly |
| slopcheck | New packages | ✗ | — | No new packages |
| gsd-sdk on PATH | Init helper | ✗ | — | Phase dir read directly |
| Knowledge graph | Cross-doc links | ✗ | — | No `.planning/graphs/graph.json` |

**Missing dependencies with no fallback:**

- None for the screens. Newsletter proof waits on the existing key. That does not block drawing the form.

**Missing dependencies with fallback:**

- FX feed failure: retry once, then last cache, then leave the written price. No guest error.

Step 2.6 was not skipped. External dependencies were probed.

## Validation Architecture

`workflow.nyquist_validation` is true.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner, plus Playwright 1.63.0 |
| Config file | `playwright.config.ts` (port 3010). No jest, no vitest. |
| Quick run command | `node --test tests/phase-03-screens.test.mjs` |
| Full suite command | `npm test` |

`npm test` runs `tests/design-tokens.test.mjs` and then Playwright, which starts `next dev` on 127.0.0.1:3010. Do not point tests at port 3000.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-62 | Complete search opens `/booking/trip`. Missing fields do not. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ Wave 0 |
| D-63 | Currency rewrite uses fetched numbers. No guest error string. | unit | `node --test tests/phase-03-fx.test.mjs` | ❌ Wave 0 |
| D-64 | Arabic sets `dir=rtl`. URL unchanged. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ Wave 0 |
| D-65 | WhatsApp href is `https://wa.me/971563883302`. Absent on `/design`. | e2e | `npx playwright test tests/phase-03-screens.spec.ts` | ❌ Wave 0 |
| D-66 | Newsletter posts. Success only after a contact id. Honeypot rejected. | unit | `node --test tests/phase-03-newsletter.test.mjs` | ❌ Wave 0 |
| D-13 | Sidebar does not shrink the page under it. | e2e | `npx playwright test tests/phase-03-dashboard.spec.ts` | ❌ Wave 0 |
| D-52 | `/` response is still the Framer HTML handler. | unit | `node --test tests/phase-03-screens.test.mjs` | ❌ Wave 0 |
| STAY-03, STAY-04, STAY-05, STAY-06, STAY-07, JOUR-05, PAY-16, OPS-09, CMS-01, CMS-02, CMS-04, CMS-05, CMS-06 | Deferred by CONTEXT. Assert the absence of seed rows, rate math, and drawn bookings. | unit | `node --test tests/phase-03-screens.test.mjs` | ❌ Wave 0 |

Manual-only: visual match of the iframe to the Framer home, and the owner's UAT correction of Arabic and Spanish. Do not automate a pixel diff against Framer.

### Sampling Rate

- **Per task commit:** `node --test tests/phase-03-fx.test.mjs tests/phase-03-newsletter.test.mjs tests/phase-03-screens.test.mjs`
- **Per wave merge:** `npx playwright test tests/phase-03-screens.spec.ts tests/phase-03-dashboard.spec.ts`
- **Phase gate:** `npm test` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-03-fx.test.mjs` — parses `$` as USD, leaves written AED alone, does not throw a guest string
- [ ] `tests/phase-03-newsletter.test.mjs` — rejects the honeypot, does not toast without a contact id, does not read a key from the repo
- [ ] `tests/phase-03-screens.test.mjs` — no `app/page.tsx`, no seed rows, `/` still a route handler
- [ ] `tests/phase-03-screens.spec.ts` — Search, language `dir`, WhatsApp, no WhatsApp on `/design`
- [ ] `tests/phase-03-dashboard.spec.ts` — empty lists, one sidebar, production not covered here (dev server only)
- [ ] No framework install. Playwright and `node --test` are already present.

## Security Domain

`security_enforcement` is true. ASVS level is 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No, this phase | Sign-in is drawn and does not send. No password. No session. Do not implement auth. |
| V3 Session Management | No | Do not set an auth cookie. `almar-locale` and `almar-currency` are preferences, not sessions. |
| V4 Access Control | Yes | New screens and `/fx` and `/newsletter` 404 in production. No public link to `/dashboard`. The public page does not say dashboard. |
| V5 Input Validation | Yes | Server-side email check. Honeypot `title` rejected. Search values rendered as text, not HTML. FX JSON parsed to two numbers. Media fields accept https only and do not upload. |
| V6 Cryptography | No | Nothing to encrypt. Do not hand-roll a hash of the email. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| FX JSON interpolated into the iframe | Tampering | Parse two numbers. Write text nodes. Never `innerHTML` the body. |
| Newsletter recipient chosen by the client | Tampering | The server sends only the submitted address to `contacts.create`. No `to` override. No `from` override. |
| Open redirect on Search | Tampering | Navigate only to `/booking/trip` plus the known query keys. Destination must be one of the five names already in `HeroBooker`. |
| Fake auth cookie | Elevation | Do not set one. Sign-in does not send. |
| Dashboard indexed | Information disclosure | `notFound()` in production. No sitemap entry. Do not add a public link. |
| Honeypot bypass | Spoofing | Ignore a post whose `title` field is non-empty. Do not add a captcha. |
| Secret in the repo | Information disclosure | Do not commit `RESEND_API_KEY`. `.env.example` stays empty. |

## Sources

### Primary (HIGH confidence)

- Repo files read this session: `03-CONTEXT.md`, `03-UI-SPEC.md`, `03-DISCUSSION-LOG.md`, `package.json`, `app/framer/page.tsx`, `app/framer/framer-shell.tsx`, `app/framer/source/route.ts`, `app/framer/inject-hero-booker.ts`, `app/framer/hero-booker-style.ts`, `app/embed/hero-booker/route.ts`, `lib/framer-hero-booker-mount.tsx`, `components/specimens/hero-booker.tsx`, `components/ui/nav.tsx`, `components/ui/button.tsx`, `components/ui/dialog.tsx`, `components/ui/footer.tsx`, `lib/format.ts`, `lib/fonts.ts`, `playwright.config.ts`, `.planning/config.json`
- `https://latest.currency-api.pages.dev/v1/currencies/usd.json` fetched 2026-09-27. `date` 2026-09-26. `usd.aed` and `usd.eur` present.
- `https://nextjs.org/docs/app/getting-started/route-handlers` — page and route cannot share a segment. Updated 7 September 2026.
- `https://nextjs.org/docs/app/api-reference/functions/cookies` — `cookies()` is async in Next.js 15.
- `https://resend.com/docs/api-reference/contacts/create-contact` — create a contact with an email. No from address.
- `@internationalized/date` executed locally: Monday is 0 for `en-GB`; `today("Asia/Dubai")` works.

### Secondary (MEDIUM confidence)

- Phase 2 plan `02-10-PLAN.md` — FX URL, six prices, `$` is USD, no guest error, no npm FX package. The plan is not executed. `lib/fx` does not exist. This phase uses the URL and the six home prices only.
- Phase 2 plan `02-05-PLAN.md` — cookie names `almar-locale` and `almar-currency`. Files do not exist. Do not build that plan's live header.
- `03-DISCUSSION-LOG.md` — language option "page copy stays English" was rejected.

### Tertiary (LOW confidence)

- A2, the Resend onboarding sender limit. Not fetched this session. The plan avoids `emails.send`, so the claim is not load-bearing.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions read from `package.json`. Nothing new to install.
- Architecture: HIGH — the shell, the booker, and the missing routes were read in the tree.
- Pitfalls: HIGH for the preview search, the iframe boundary, and the footer form. MEDIUM for newsletter proof, because the key is absent.

**Research date:** 2026-09-27
**Valid until:** 2026-10-27 for the stack. Re-fetch the FX URL if a plan is executed after the cache window. The feed date moves daily.

## Must Not Be Built

- Schema, migrations, seed destinations, stay records, rates, occupancy, inclusions, overlap, holds, or a 30-minute timer.
- A Supabase project, a Stripe call, a Resend domain, a Cloudflare Worker, or a DNS change.
- A React rebuild of the Framer home. A restyle of `/` or `/design`. WhatsApp on `/design` or `/dashboard`.
- A second header, booker, newsletter, language control, or component library.
- `app/page.tsx`, `middleware.ts`, `app/ops`, locale URL prefixes, `next-intl`.
- Sample rows, sample numbers, a typed FX rate, a guest-facing rate failure, a chart series.
- A calendar day that already has a booking.
- Price math beyond converting the six written home amounts.
- Sign-in that sends. Account that saves. Settings that persist. Publish that publishes. Maintenance that turns the site off.
- A public link or public word for the dashboard.
- A commit, a push, or a deploy from this phase's research.

## RESEARCH COMPLETE
