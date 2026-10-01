# Phase 3: Public site and dashboard - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 40 new or modified
**Analogs found:** 40 / 40 (two behaviors have no call site; their host files still have a route or shell analog)

Locked constraints the excerpts must not violate:

- Do not invent a component library. Reuse `components/ui` and `components/specimens`. New chrome is a sibling in `components/ui`, not shadcn, not a second icon set.
- `/` stays `app/route.ts`. Do not add `app/page.tsx`. Do not inject FX, language, WhatsApp, or the booker into that handler.
- `/design` stays the specimen kit. Do not restyle it. Do not float WhatsApp on it. Optional new props must default so existing `SiteNav` and `HeroBooker` call sites keep working.
- `/framer` is the chosen look. Extend `FramerShell` and `app/framer/source/route.ts`. Do not rebuild the home as JSX.
- Every new screen and `/fx` and `/newsletter` 404 in production, the same gate as `app/framer/page.tsx`. Phase 2 `02-PATTERNS.md` said `/login` must exist in production. That line is stale for this phase. Copy the `notFound()` branch.
- Nothing on the new screens saves, except the five connections: Search opens `/booking/trip`, currency uses the fetched FX numbers, language changes copy and `dir`, WhatsApp opens `https://wa.me/971563883302`, newsletter posts the existing footer form. No sample rows. No sample numbers. No guest-facing rate error.
- Square corners. `--radius-control` and `--radius-overlay` stay `0`. No radio. No password field. No eye control.
- `Button variant="primary"` is not the gold fill. The gold fill is `.hero-search-submit`.
- One sidebar, on top, end side. Do not copy the centered `.ui-dialog` layout. Do not give the sidebar a layout column.
- Contact stays `inquiries@almarprivatejourney.com` and `+971 56 388 3302`. Do not install a package. Do not add `middleware.ts`, `app/ops`, or a locale prefix.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/framer/framer-shell.tsx` | component | event-driven | itself | exact |
| `app/framer/source/route.ts` | route | transform | itself | exact |
| `components/ui/nav.tsx` | component | event-driven | itself (`locale` / `onLocale`) | exact |
| `components/specimens/hero-booker.tsx` | component | request-response | itself | exact |
| `lib/framer-hero-booker-mount.tsx` | component | request-response | itself | exact |
| `app/embed/hero-booker/route.ts` | route | transform | itself | exact |
| `components/icons/icons.tsx` | component | — | `ChevronIcon` | exact |
| `app/globals.css` | config | — | `.hero-search-submit`, `.ui-scrim`, `.ops-table` | exact |
| `app/login/page.tsx` | component | request-response | `app/framer/page.tsx` + `AccountFrames` Sign-in | role-match |
| `app/bookings/page.tsx` | component | request-response | `app/framer/page.tsx` + catalog empty line | role-match |
| `app/account/page.tsx` | component | request-response | `app/framer/page.tsx` + `AccountFrames` Account | role-match |
| `app/booking/trip/page.tsx` | component | request-response | `app/framer/page.tsx` + `CatalogFrames` empty rooms + `StayRow` | role-match |
| `app/dashboard/page.tsx` | component | request-response | `app/framer/page.tsx` + `app/not-found.tsx` metadata | role-match |
| `app/dashboard/layout.tsx` | provider | request-response | `app/layout.tsx` + `design-kit.tsx` side list | partial |
| `app/dashboard/home/page.tsx` | component | request-response | `app/framer/page.tsx` | role-match |
| `app/dashboard/bookings/page.tsx` | component | CRUD (empty) | `.ops-table` + empty line | role-match |
| `app/dashboard/customers/page.tsx` | component | CRUD (empty) | `.ops-table` + empty line | role-match |
| `app/dashboard/calendar/page.tsx` | component | request-response | `components/ui/calendar.tsx` month math | partial |
| `app/dashboard/catalog/destinations/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/catalog/stays/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/catalog/experiences/page.tsx` | component | CRUD (empty) | empty line + `OptionSelect` | role-match |
| `app/dashboard/catalog/packages/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/content/pages/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/content/blog/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/content/team/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/content/legal/page.tsx` | component | CRUD (empty) | empty line + `Field` | role-match |
| `app/dashboard/settings/page.tsx` | component | CRUD (empty) | `Field` + `Switch` | role-match |
| `app/dashboard/profile/page.tsx` | component | request-response | `Field` + `Button` danger + `KitDialog` confirm lock | role-match |
| `components/ui/sidebar.tsx` | component | event-driven | `components/ui/dialog.tsx` primitive, not its chrome | role-match |
| `components/ui/whatsapp.tsx` | component | request-response | `icon-button` hit target + `ChevronIcon` stroke | partial |
| `lib/fx/rates.ts` | service | transform | `lib/format.ts` | partial |
| `app/fx/route.ts` | route | request-response | `app/design/map/route.ts` | role-match |
| `app/newsletter/route.ts` | route | request-response | `app/framer/source/route.ts` production gate | partial |
| `lib/screen-copy.ts` | utility | transform | `lib/home-copy.ts` | role-match |
| `tests/phase-03-fx.test.mjs` | test | — | `tests/phase-02-gates.test.mjs` | role-match |
| `tests/phase-03-newsletter.test.mjs` | test | — | `tests/phase-02-gates.test.mjs` | role-match |
| `tests/phase-03-screens.test.mjs` | test | — | `tests/phase-02-gates.test.mjs` | role-match |
| `tests/phase-03-screens.spec.ts` | test | — | `tests/design-rtl.spec.ts` | role-match |
| `tests/phase-03-dashboard.spec.ts` | test | — | `tests/design-rtl.spec.ts` | role-match |

Child slugs under `app/dashboard/` are not an owner lock. D-55 locks the prefix `/dashboard`. Do not use `app/ops`. Do not put a sidebar on its own route.

## Pattern Assignments

### `app/framer/page.tsx` gate — copy onto every new `page.tsx` (component, request-response)

**Analog:** `app/framer/page.tsx`

The server page is only the production gate plus a client child. Do not put `"use client"` on `page.tsx`. That would drop the gate. Same split as `DesignPage` → `DesignKit` and `FramerPage` → `FramerShell`.

**Imports and page shape** (`app/framer/page.tsx` lines 1–10):

```tsx
import { notFound } from "next/navigation";
import { FramerShell } from "./framer-shell";

export default function FramerPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FramerShell />;
}
```

`app/design/page.tsx` lines 1–9 are the same gate. Copy it. Do not drop it for `/login`, `/bookings`, `/account`, `/booking/trip`, or `/dashboard`.

**Metadata** (`app/not-found.tsx` lines 1–7). Logged-out dashboard title is `Sign in`. Do not put dashboard in that title. Guest and trip titles use the screen name (`Bookings`, `Account`, `Sign in`).

```tsx
import type { Metadata } from "next";
import { StatusFrame } from "../components/status-frame";
import { NOT_FOUND_TITLE } from "../lib/not-found-document";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
};
```

**Layout these pages inherit** (`app/layout.tsx` lines 1–19). Keep the skip link. Do not add a second root layout. Arabic `dir` is set on `documentElement` by the client setter below, not by a `/ar` route.

```tsx
import type { ReactNode } from "react";
import "./globals.css";
import { lato, questa } from "../lib/fonts";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${questa.variable} ${lato.variable} antialiased`}
    >
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
```

Logged-out dashboard body can use `StatusFrame` (`components/status-frame.tsx` lines 4–18) for the sign-in title only. Do not copy its "Return home" link onto dashboard screens. Do not use `StatusFrame` as the ops interior.

---

### `app/framer/framer-shell.tsx` (component, event-driven)

**Analog:** itself

Keep the overlay shell. Add WhatsApp here, not in the iframe and not on `/design`. Lift currency the way locale is already lifted. Pass translated `labels` into `SiteNav`. Copy `setLocale` onto this document and onto the iframe document.

**Client shell** (`app/framer/framer-shell.tsx` lines 1–13 and 75–82):

```tsx
"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "../../components/ui/nav";
import styles from "./framer-shell.module.css";

type Locale = "en" | "ar" | "es";

export function FramerShell() {
  const [locale, setLocale] = useState<Locale>("en");
  // ...
  return (
    <div className={shellClass}>
      <SiteNav locale={locale} onLocale={setLocale} />
      <iframe id="content" className={styles.frame} title="ALMAR" src="/framer/source" />
    </div>
  );
}
```

Today `setLocale` only updates React state. It does not set `dir`. Copy the setter from `app/design/design-kit.tsx` lines 256–266 and 289–292, then apply the same `lang` / `dir` on `frame.contentDocument.documentElement`:

```tsx
const NOTO_CLASSES = `${notoNaskh.variable} ${notoSans.variable}`.split(" ");

function setLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}

function chooseLocale(next: Locale) {
  setLocaleState(next);
  setLocale(next);
}
```

The iframe does not inherit those classes. `app/embed/font/[file]/route.ts` only serves Lato (`ALLOWED` is `Lato-Regular.ttf`, `Lato-Bold.ttf`, `Lato-Italic.ttf`). Do not add a new face. Reuse `notoNaskh` and `notoSans` from `lib/fonts.ts` lines 34–46 on the shell document. For the iframe document, inject the stylesheet URL Next already emitted for those variables. Do not add a second Google font import.

**Overlay position to copy for WhatsApp** (`app/framer/framer-shell.module.css` lines 48–56). WhatsApp is fixed, not absolute inside the scrolling iframe. `inset-inline-end` and `inset-block-end`. Square. At least 44px. Not on `/design`.

```css
.frame {
  position: absolute;
  inset: 0;
  z-index: 0;
  inline-size: 100%;
  block-size: 100%;
  border: 0;
  background: #fffaf0;
}
```

There is no `postMessage` in the repo. The shell already holds `frame.contentWindow` in the scroll effect (lines 33–36). Use that window to post `{ locale, currency }`. The iframe script must replace text nodes. Do not set `innerHTML` from a query param. Do not edit `app/route.ts`.

Header labels already exist. Pass them the way `KitHome` does (`components/home/kit-home.tsx` lines 113–127). Do not build a second header.

```tsx
const copy = HOME_COPY[locale];
// ...
<SiteNav
  locale={locale}
  onLocale={setLocale}
  labels={copy.nav}
  loginHref="#sign-in"
  markCurrent={false}
/>
```

On `/framer`, `loginHref` is `/login`, not `#sign-in`. `markCurrent` stays false. Services is not a nav item. `HOME_COPY.nav` already matches `NavLabels`.

---

### `app/framer/source/route.ts` (route, transform)

**Analog:** itself

Home-only copy and price rewrite go here. Never in `app/route.ts`.

**Injection** (`app/framer/source/route.ts` lines 1–32):

```ts
import { GET as homeGet } from "../../route";
import { injectHeroBooker } from "../inject-hero-booker";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const response = homeGet();
  const html = await response.text();
  const withNavHidden = html.includes("</head>")
    ? html.replace("</head>", `${HIDE_FRAMER_NAV}</head>`)
    : HIDE_FRAMER_NAV + html;
  const withBooker = injectHeroBooker(withNavHidden);

  return new Response(withBooker, {
    status: response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
```

`app/route.ts` lines 17–24 are the document this handler reads. Do not change that `GET`. It is `/`.

**String injection shape** (`app/framer/inject-hero-booker.ts` lines 54–63). A price or copy script, if added, follows this replace-`</head>` / replace-`</body>` shape. Do not fork a second booker.

```ts
export function injectHeroBooker(html: string) {
  if (html.includes('id="almar-hero-booker-style"')) return html;

  const style = `<style id="almar-hero-booker-style">${heroBookerStyle()}</style>`;
  const boot = `<script src="/embed/hero-booker" defer></script><script id="almar-hero-booker-boot">${SCRIPT}</script>`;
  let next = html.replace("</head>", `${style}</head>`);
  if (!next.includes('id="almar-hero-booker-style"')) next = `${style}${next}`;
  if (next.includes("</body>")) next = next.replace("</body>", `${boot}</body>`);
  else next = `${next}${boot}`;
  return next;
}
```

**Existing newsletter form** is inside the HTML string at `app/route.ts` line 15, form class `framer-8a2tsb`. Extracted field names, not a new form:

- Email input: `type="email"` `name="Email"` placeholder `Your email address`
- Submit text today: `Join the List`. Relabel that text node to `Subscribe`. Do not make it gold.
- Hidden honeypots on that form include `website`, `company`, `message`, `subject`, `title`, `description`, `feedback`, `notes`, `details`, `remarks`, `comments`.

Research said the honeypot is `name="title"`. That field is present. It is not the only hidden field. Reject the post when `title` is non-empty, as locked. Do not add a second newsletter. Do not wire `SiteFooter`.

---

### `components/ui/nav.tsx` (component, event-driven)

**Analog:** itself

Lift `currency` the way `locale` is already required. New props must be optional so `/design` and `KitHome` do not break.

**Labels and currency state** (`components/ui/nav.tsx` lines 6–36 and 166–187):

```tsx
const DEFAULT_LABELS = {
  destinations: "Destinations",
  experiences: "Experiences",
  about: "About",
  contact: "Contact",
  currency: "Currency",
  language: "Language",
  login: "Login",
  menu: "Menu",
  close: "Close menu",
} as const;

type Currency = "AED" | "USD" | "EUR";

const CURRENCIES = [
  { value: "AED", label: "AED" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
] as const;

export function SiteNav({
  locale,
  onLocale,
  labels,
  loginHref = "#log-in",
  markCurrent = true,
}: {
  locale: Locale;
  onLocale: (next: Locale) => void;
  labels?: Partial<NavLabels>;
  loginHref?: string;
  markCurrent?: boolean;
}) {
  const [currency, setCurrency] = useState<Currency>("AED");
```

**Dropdown wiring** (lines 288–311). `onChange={setCurrency}` is the line to replace with an optional callback, falling back to `setCurrency`.

```tsx
<NavDrop
  label={text.currency}
  value={currency}
  options={CURRENCIES}
  onChange={setCurrency}
  className="nav-drop is-currency"
/>
<NavDrop
  label={text.language}
  value={locale}
  options={LOCALES}
  onChange={onLocale}
  className="nav-drop locale-switch"
/>
<a className="nav-login" href={loginHref}>
  {text.login}
</a>
```

Closed language labels stay `EN` / `AR` / `ES` (lines 32–36). Do not add a second language control. Do not change `NAV_ROW_MIN` (1088). Dashboard uses 1440, in dashboard CSS, not here.

Wordmark sources to reuse on the dashboard header (lines 41–42): `WORDMARK_SRC` and `MONOGRAM_SRC`. Full logo `alt="ALMAR"`. Monogram `alt=""`. Do not put Sign out in this header.

Signed-in menu (Bookings, Account, Sign out) replaces the Login anchor only. There is no session this phase, so do not render `touchword` and do not hardcode the owner email.

---

### `components/specimens/hero-booker.tsx` (component, request-response)

**Analog:** itself

Do not build a second bar. Do not change `/design` behavior by default.

**Destinations already locked for search** (lines 104–110). A complete search may only navigate with one of these five names. That list is not a catalogue.

```tsx
const DESTINATIONS = [
  { name: "Cartagena", region: "Caribbean coast" },
  { name: "Medellín", region: "Andes" },
  { name: "Bogotá", region: "Capital" },
  { name: "San Andrés", region: "Island" },
  { name: "Cocora Valley", region: "Coffee region" },
] as const;
```

**Notice that must stop being the success path** (lines 231–241):

```tsx
const missingWhere = tried && !where;
const missingWhen = tried && (!start || !end);
const notice = !tried
  ? ""
  : missingWhere && missingWhen
    ? t.needBoth
    : missingWhere
      ? t.needWhere
      : missingWhen
        ? t.needWhen
        : t.preview;
```

`t.preview` is `"Search is a preview on this page."` (line 92). Keep the three error lines. Replace only the complete branch.

**Submit** (lines 324–328) and **hidden fields** (lines 545–562):

```tsx
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setTried(true);
  setOpen(null);
}

<button type="submit" className="hero-search-submit">
  {t.search}
</button>
<input type="hidden" name="where" value={where ?? ""} />
<input type="hidden" name="check-in" value={start ? formatDate(start) : ""} />
<input type="hidden" name="check-out" value={end ? formatDate(end) : ""} />
<input type="hidden" name="adults" value={guests.adult} />
<input type="hidden" name="children" value={guests.child} />
<input type="hidden" name="infants" value={guests.infant} />
```

`KitHome` renders `<HeroBooker labels={booker} />` with no navigate callback (`components/home/kit-home.tsx` line 133). Add an optional callback. Default stays the preview notice so `/design` does not start booking. `lib/framer-hero-booker-mount.tsx` lines 12–18 is the `/framer` call site. Pass the callback there:

```tsx
function mountHeroBooker(host: HTMLElement) {
  let root = roots.get(host);
  if (!root) {
    root = createRoot(host);
    roots.set(host, root);
  }
  root.render(<HeroBooker />);
}
```

The booker runs inside the iframe. Navigate `window.top` to `/booking/trip` plus the known keys only (`where`, `check-in`, `check-out`, `adults`, `children`, `infants`). Do not navigate the iframe's own location. Query values are text, not HTML.

If the booker imports a new module, add that path to `SOURCES` in `app/embed/hero-booker/route.ts` lines 11–17 or the cache stamp will serve a stale bundle. The production 404 on that route (lines 48–51) stays.

---

### `components/ui/sidebar.tsx` (component, event-driven)

**Analog:** `components/ui/dialog.tsx`

Reuse Radix `Dialog`. Do not use `KitDialog` as the sidebar. Its close control is an icon, and its actions are Cancel / Continue.

**Primitive to copy** (`components/ui/dialog.tsx` lines 1–35):

```tsx
"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { CloseIcon } from "../icons/icons";

export function KitDialog({ dismiss = "picker" }: { dismiss?: "picker" | "confirm" }) {
  const locked = dismiss === "confirm";
  return (
    <Dialog.Root>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-scrim" />
        <Dialog.Content
          className="ui-dialog"
          aria-describedby={undefined}
          onEscapeKeyDown={locked ? (event) => event.preventDefault() : undefined}
          onPointerDownOutside={locked ? (event) => event.preventDefault() : undefined}
          onInteractOutside={locked ? (event) => event.preventDefault() : undefined}
        >
```

Sidebar: controlled `Dialog.Root`, one instance on the list page. Opening another day or editor replaces `open` state. It does not stack. Close control is the text `Close`, not `CloseIcon`. Scrim click closes. Confirm dialogs (Sign out, Logout-all) copy the three `preventDefault` handlers and do not close on scrim click.

**Do not copy the centered layout.** Mobile `.ui-dialog` is already end-docked. From `48rem` it centers (`app/globals.css` lines 1116–1147):

```css
.ui-scrim {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: color-mix(in srgb, var(--color-charcoal) 40%, transparent);
}

.ui-dialog {
  position: fixed;
  z-index: 70;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  inset-inline-end: 0;
  inset-block: 0;
  inline-size: 100%;
}

@media (min-width: 48rem) {
  .ui-dialog {
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inset-inline-end: auto;
    transform: translate(-50%, -50%);
    inline-size: min(480px, calc(100% - 2rem));
  }
}
```

Add a new class in `app/globals.css`. Copy the scrim and the pre-media `.ui-dialog` dock (`inset-inline-end: 0`). Do not hard-code `right`. Width `min(32rem, 100%)`. Full width below `48rem`. The rail does not shrink. Do not animate layout on the page under the sidebar.

---

### `components/icons/icons.tsx` and `components/ui/whatsapp.tsx`

**Analog:** `ChevronIcon` (`components/icons/icons.tsx` lines 8–26 and 159–164)

No WhatsApp glyph exists. Add one function in this file. `currentColor`, `strokeWidth={1.5}`, `viewBox="0 0 24 24"`. Do not add an icon font.

```tsx
function Icon({ size = 24, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M9 6.5 14.5 12 9 17.5" />
    </Icon>
  );
}
```

The control is a native `<a>`, accessible name `WhatsApp`, `href="https://wa.me/971563883302"`. Fill `#25D366` is the channel exception. Glyph charcoal, not white. Radius 0. Hit target is the existing `.icon-button` 44px (`app/globals.css` lines 1171–1176). No prefilled booking reference. Mount it from `FramerShell` only.

---

### Guest screens

**Sign in** (`app/login/page.tsx`). Copy the page gate. Copy the field, not the specimen button label.

`components/specimens/account-frames.tsx` lines 23–27 is the field analog. The button there says `Sign in`. The locked label is `Access with magic link`. It does not send. No password. No Create account form.

```tsx
<Field id="sign-in-email" label="Email" name="sign-in-email" />
<Button variant="primary" type="button">
  Sign in
</Button>
```

Do not use `variant="primary"` for the gold fill. Copy `.hero-search-submit` (see Shared Patterns). Empty email uses `Field` `error` so `aria-invalid` is set (`components/ui/field.tsx` lines 42–50 and 120–128). The line is `Enter an email address.`

**Account** (`app/account/page.tsx`). Copy fields from `account-frames.tsx` lines 50–53. Do not copy the Save button on lines 54–56. Add Language with the same three-way control as the header (`NavDrop` / `LOCALES`), not a second system. No password. No delete.

```tsx
<Field id="account-name" label="Name" name="account-name" />
<Field id="account-email" label="Email" name="account-email" />
<Field id="account-phone" label="Phone" name="account-phone" />
```

**Guest bookings** (`app/bookings/page.tsx`). Do not copy `account-frames.tsx` lines 200–205. That frame has a sample row (`Cartagena`, `ALMAR-104283`). Empty line is the catalog sentence shape (`catalog-frames.tsx` lines 649–650) with locked copy `No bookings yet` and action `Start a trip`. That action goes to `/framer` (the booking bar). One gold fill.

```tsx
<Frame title="Empty rooms">
  <p>No stays for these dates</p>
</Frame>
```

---

### `app/booking/trip/page.tsx` (component, request-response)

**Analog:** `app/framer/page.tsx` plus `CatalogFrames` empty line and `StayRow` structure

Read `where`, `check-in`, `check-out`, `adults`, `children`, `infants` from the query as text. Do not render them as HTML. Empty stay list copy is already in the specimen: `No stays for these dates`. Action: `Change dates`. No sample stays. No charge.

Do not copy prices or sample names from `components/specimens/stay-row.tsx` lines 20–31 (`Casa San Diego`, `AED 1,050`). If a stay row is drawn later, reuse the `.stay-row` element and drop `is-selected` gold treatment. Selected stay cards have no gold side bar and no gold border.

`Button variant="primary"` on that specimen is the wrong fill. The step's one gold action uses the accent fill class.

---

### Dashboard rooms

All of these use the page gate above. Client child holds the screen. One `sidebar` state on the list page. The rail is a sibling, not a column that shrinks when the sidebar opens.

**Rail analog** is partial: `design-kit.tsx` lines 311–318 is an always-open side list of links. Copy the always-open children behavior for Catalog and Content. Do not copy `.kit-side` visuals. Phone and tablet menu behavior copies `SiteNav` (`aria-expanded`, Escape, focus return) but the breakpoint is 1440px, not `NAV_ROW_MIN`.

```tsx
<nav className="kit-side" aria-label="On this page">
  {CHAPTERS.map((chapter) => (
    <div className="kit-side-group" key={chapter.id}>
      <a className="kit-side-label" href={`#${chapter.id}`}>{chapter.title}</a>
      {chapter.items.map(([name, id]) => (
        <a key={id} href={`#${id}`}>
```

Nav order: Home, Bookings, Customers, Calendar, Catalog (Destinations, Stays, Experiences & Services, Packages), Content (Pages, Blog, Team, Legal), Settings, Profile. Wordmark is the public pair from `nav.tsx`. Text beside it may say `DASHBOARD` only on the interior. Header on small screens is wordmark plus menu. Sign out is not in the header or the rail.

**Empty list + table.** Copy `.ops-table` (`app/globals.css` lines 3761–3780). Header row only. No `<tr>` body rows. Empty line plus one gold `New [thing]`.

```css
.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-body);
}
.ops-table th,
.ops-table td {
  border-block-end: 1px solid var(--color-border);
  text-align: start;
  padding: var(--spacing-sm);
}
.ops-table th {
  font-weight: 400;
}
```

| Page | Columns | Empty line | Action | Sidebar heading |
|------|---------|------------|--------|-----------------|
| `app/dashboard/bookings/page.tsx` | guest, destination, dates, status | No bookings yet | New booking | New booking |
| `app/dashboard/customers/page.tsx` | name, email, phone, bookings count | No customers yet | New customer | New customer |
| `app/dashboard/catalog/destinations/page.tsx` | name, status | No destinations yet | New destination | New destination |
| `app/dashboard/catalog/stays/page.tsx` | name, status | No stays yet | New stay | New stay |
| `app/dashboard/catalog/experiences/page.tsx` | name, status | No experiences yet | New experience | New experience |
| `app/dashboard/catalog/packages/page.tsx` | name, status | No packages yet | New package | New package |
| `app/dashboard/content/pages/page.tsx` | name, status | No pages yet | New page | New page |
| `app/dashboard/content/blog/page.tsx` | name, status | No posts yet | New post | New post |
| `app/dashboard/content/team/page.tsx` | name, status | No team members yet | New member | New member |
| `app/dashboard/content/legal/page.tsx` | name, status | No legal pages yet | New legal page | New legal page |

Experiences also draws type, price sort, and destination. They are named and do not filter. Destination options copy `DestinationSelect`'s five names (`components/ui/select.tsx` lines 7 and 27–59) or `OptionSelect` (lines 62–73). Do not filter the empty list.

**Editor fields.** `Field` with `label` above. Empty. Media fields are URL inputs, not uploads. Reject a non-https value in the field. Do not store it. `Publish` is the one gold fill. It does not publish.

| Editor | Fields |
|--------|--------|
| Destination | Name, Status |
| Stay | Name, Status, Pets, Min nights, Infants count, Media URL. Optional empty `Rates` label. No max nights. No inclusion toggles. |
| Experience | Name, Status, Type, Price, Destination |
| Package | Name, Status |
| Page | Name, Status |
| Blog | Name, Status |
| Team | Name, Status, Photo |
| Legal | Name, Status |
| Booking | Guest, Destination, Dates, Status |
| Customer | Name, Email, Phone |

Status column chrome, if a chip is drawn with no row behind it, uses `.status-chip` (`app/globals.css` line 2985). Do not invent statuses. Do not seed rows.

**Home** (`app/dashboard/home/page.tsx`). Named empty slots, in order: bookings, revenue, cost, outstanding, occupancy, reminders, charts. No numbers. No chart series. Reminders line: `No reminders yet`. No gold fill. Date control labels: `This month`, `Last 30`, `Custom`. They do not filter. Draw them as buttons, not radios.

**Calendar** (`app/dashboard/calendar/page.tsx`). Copy month math from `components/ui/calendar.tsx` lines 16–18 and 73–89. Do not mount `CalendarPanel`. That panel is the booker's range picker (`today(getLocalTimeZone())`). The ops grid uses `today("Asia/Dubai")`. Week starts Monday because `getDayOfWeek(first, "en-GB")` is 0 on Monday. Lead cells are `null` and stay empty. Days outside the month are not drawn. Each in-month day is a `<button>` whose accessible name is that date (`formatDate`, `DD/MM/YYYY`). Today is a charcoal dot, not a fill. No bookings are drawn.

```tsx
export function formatDate(date: CalendarDate) {
  return `${pad(date.day)}/${pad(date.month)}/${date.year}`;
}

const now = today(getLocalTimeZone());
const first = new CalendarDate(cursor.year, cursor.month, 1);
const lead = getDayOfWeek(first, "en-GB");
const cells: Array<CalendarDate | null> = Array.from({ length: lead }, () => null);
for (let day = 1; day <= count; day += 1) {
  cells.push(new CalendarDate(cursor.year, cursor.month, day));
}
```

Replace `getLocalTimeZone()` with `"Asia/Dubai"` on this screen only. Do not change `CalendarPanel`.

Empty day sidebar: heading is the date, line `No bookings yet`, gold `New booking`, secondary `Block`. `Block` does not save. Opening another day replaces the sidebar.

**Settings** (`app/dashboard/settings/page.tsx`). One page. Groups in order: Brand, Money, Email, Maintenance. Gap inside a group is `--spacing-sm` (8px). Gap between groups is `--spacing-md` (16px).

- Brand: existing tokens, logos, favicon. Faces already in `lib/fonts.ts`. No radius control.
- Money: VAT percent, deposit percent, FX rate as text. She cannot type the rate. No sample rate. If the fetch has not returned, show nothing she can edit.
- Email: templates, reminders, confirmation. Named. Not sent.
- Maintenance: `Switch` (`components/ui/switch.tsx` lines 10–40), `defaultChecked={false}`. Label beside it. It does not turn the site off.

```tsx
export function Switch({ label, checked, defaultChecked = false, onCheckedChange }: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;
  return (
    <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => {
      const next = !on;
      if (checked === undefined) setInternal(next);
      onCheckedChange?.(next);
    }}>
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
      <span>{label}</span>
    </button>
  );
}
```

`Save` is the one gold fill. It does not persist. Do not toast that it saved.

Ops density copies `html[data-density="compact"]` (`app/globals.css` lines 68–71). Type stays on the four sizes. Hit target stays 44px.

**Profile** (`app/dashboard/profile/page.tsx`). Fields: name, email, photo. Missing photo copies the monogram treatment in `components/specimens/stay-row.tsx` lines 10–17 (square ivory, `alt=""`). Do not crop a circle. `Sign out` and `Logout-all` sit next to each other. Both are `Button variant="danger"` (charcoal label, danger outline, transparent fill — `components/ui/button.tsx` lines 18–19). Both confirm. Confirm buttons are `Sign out of this site` / `Stay signed in` and `Sign out everywhere` / `Stay signed in`. Copy the confirm dismiss lock from `KitDialog`, not the Cancel / Continue labels.

---

### `lib/fx/rates.ts` and `app/fx/route.ts` (service + route, request-response)

**Analog:** `lib/format.ts` for output. `app/design/map/route.ts` for a server fetch that 404s in production and reads a secret-or-upstream only on the server.

No FX module exists. Do not hardcode `3.6725`. Do not install an FX package.

**Amount shape to return through** (`lib/format.ts` lines 11–17):

```ts
export function formatAmount(currency: string, amount: number): string {
  return `${currency} ${grouped(amount)}`;
}

export function formatAmountLatn(currency: string, amount: number): string {
  return `${currency} ${grouped(amount, LATN)}`;
}
```

Code before number. Comma thousands. Two decimals only when not whole. Arabic prices use `formatAmountLatn`. `$` in the home HTML means USD. A written `AED` amount stays AED when the selected currency is AED.

**Server fetch shape** (`app/design/map/route.ts` lines 15–18 and 57–70). Copy the production 404, the server-only read, and the failure path. Do not copy the Mapbox host, the image body, or the 502 page. FX failure is not a guest error.

```ts
function mapboxToken(): string | null {
  const value = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  return value ? value : null;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  const accessToken = mapboxToken();
  if (!accessToken) {
    return new NextResponse(null, { status: 404 });
  }
  const upstream = await loadMap(accessToken);
  if (!upstream || upstream.status !== 200) {
    return new NextResponse(null, { status: 502 });
  }
}
```

`/fx` returns `{ aed, eur, date }` numbers only, after parsing `usd.aed` and `usd.eur` from `https://latest.currency-api.pages.dev/v1/currencies/usd.json`. Cache in memory 12 hours. Retry the same URL once. Then last cache. If there is no cache, leave the written amount. Do not interpolate the raw JSON into HTML. The six home amounts are rewritten only inside `/framer/source`, not on `/`.

`SiteNav` posts the selected currency into the iframe. The iframe rewrites text nodes with `formatAmount`.

---

### `app/newsletter/route.ts` (route, request-response)

**Analog:** production gate in `app/framer/source/route.ts` lines 11–16. Form is the existing `framer-8a2tsb` form, not `SiteFooter`.

`components/ui/footer.tsx` lines 13–23 is the anti-pattern. It toasts success without a send. Do not wire it. Do not mount it under the iframe.

```tsx
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  // ...
  push("Subscribed. Check your inbox.");
}
```

There is no `resend` import in the repo. `package.json` already has `resend@6.29.0`. Do not install. Read `process.env.RESEND_API_KEY` the way `mapboxToken()` reads its env var. If the key is absent, do not toast success and do not invent a key. Toast only when `contacts.create` returns an id. Use `useToast().push` (`components/ui/toast.tsx` lines 31–37) for that one line. Stack cap is already 3. Pause is already 4 seconds (lines 58–71).

Empty email stays the client line `Enter an email address.` Validate again on the server. Ignore a post whose honeypot `title` is non-empty. The email field name on the live form is `Email`, not `email`.

Point the existing form at `POST /newsletter` from the `/framer/source` injection only. Do not change `app/route.ts`.

---

### `lib/screen-copy.ts` (utility, transform)

**Analog:** `lib/home-copy.ts` lines 1–15 and 76–89

```ts
export type HomeLocale = "en" | "ar" | "es";

export type HomeCopy = {
  skip: string;
  nav: {
    destinations: string;
    experiences: string;
    about: string;
    contact: string;
    currency: string;
    language: string;
    login: string;
    menu: string;
    close: string;
  };
  // ...
};

export const HOME_COPY: Record<HomeLocale, HomeCopy> = {
  en: {
    skip: "Skip to content",
    nav: {
      destinations: "Destinations",
      experiences: "Experiences",
      about: "About",
      contact: "Contact",
      currency: "Currency",
      language: "Language",
      login: "Login",
      menu: "Menu",
      close: "Close menu",
    },
```

New guest, dashboard, and alt strings follow that `Record<HomeLocale, ...>` shape. Do not install `next-intl`. Do not add `/ar`. Header labels already live in `HOME_COPY.nav`. Booker labels already live in `BOOKER_COPY` (line 421). Do not fork them. `touchword` is not in the table.

`BOOKER_COPY` still has `preview` (line 459). The iframe success path must not use it. `/design` may keep it via the default callback.

---

### Tests

**Unit analog:** `tests/phase-02-gates.test.mjs` lines 1–4 and 22–31. `node:test` and `node:assert/strict`. No jest. No vitest.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

test("package.json has no vercel script", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = pkg.scripts ?? {};
  for (const [name, command] of Object.entries(scripts)) {
    assert.equal(name.includes("vercel") || String(command).includes("vercel"), false);
  }
});
```

`tests/phase-03-screens.test.mjs` asserts no `app/page.tsx`, `/` is still a route handler, and no seed rows. `tests/phase-03-fx.test.mjs` asserts `$` is USD, written AED stays AED, and no guest error string. `tests/phase-03-newsletter.test.mjs` asserts a non-empty `title` is rejected and success is not claimed without a contact id.

**Playwright analog:** `tests/design-rtl.spec.ts` lines 1–2 and 22–24. Port stays 3010 (`playwright.config.ts` lines 3–5). Do not point tests at port 3000.

```ts
import { expect, test } from "@playwright/test";

await page.getByRole("button", { name: "AR", exact: true }).first().click();
await expect(html).toHaveAttribute("dir", "rtl");
await expect(html).toHaveAttribute("lang", "ar");
```

`tests/phase-03-screens.spec.ts` covers Search, `dir`, and WhatsApp absent on `/design`. `tests/phase-03-dashboard.spec.ts` covers the empty line and one sidebar that does not change the page width under it.

## Shared Patterns

### Production 404

**Source:** `app/framer/page.tsx` lines 4–7 and `app/framer/source/route.ts` lines 11–16
**Apply to:** every new `page.tsx`, `app/fx/route.ts`, `app/newsletter/route.ts`

```tsx
if (process.env.NODE_ENV === "production") {
  notFound();
}
```

Route handlers return `new Response("Not found", { status: 404 })` or `new NextResponse(null, { status: 404 })`. Do not ship these screens.

### Gold fill

**Source:** `app/globals.css` lines 4285–4300
**Apply to:** Search (already this class), `New [thing]`, `Start a trip`, `Publish`, Settings `Save`, `Access with magic link`, the current `/booking/trip` step action
**Do not apply to:** Subscribe, Login, Close, Block, Sign out, Logout-all, the dashboard date control

```css
.hero-search-submit {
  min-block-size: 48px;
  padding-block: 12px;
  padding-inline: 24px;
  border: 0;
  background: var(--color-accent);
  color: var(--color-heading);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}
```

`Button variant="primary"` is ivory with a gold border (`components/ui/button.tsx` lines 11–14). Do not use it as the filled primary. One gold fill per view. Danger stays `variant="danger"` (lines 18–19): transparent fill, charcoal label, danger outline.

### Field error

**Source:** `components/ui/field.tsx` lines 42–50 and 120–128
**Apply to:** sign-in email, newsletter email, media URL, any named empty field that shows an error

```tsx
<label className="field-label" htmlFor={id}>
  {label}
  {required ? (
    <span className="text-[var(--color-fg)]" aria-hidden="true"> *</span>
  ) : null}
</label>
<input
  id={id}
  className="ui-input"
  aria-invalid={invalid || undefined}
  aria-describedby={describedBy}
  required={required}
/>
```

Placeholder is an example, not the label. Search errors also use the existing `role="status"` notice in `hero-booker.tsx` lines 557–562.

### Language and direction

**Source:** `app/design/design-kit.tsx` lines 260–266
**Apply to:** `/framer` shell, iframe document, guest screens, dashboard screens

```tsx
function setLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}
```

Same URL. No `next-intl`. Layout uses logical properties already (`inset-inline-end`, `text-align: start`). Do not add physical `left` or `right`.

### Toast

**Source:** `components/ui/toast.tsx` lines 31–37
**Apply to:** newsletter success only, and only after a Resend id

```tsx
function push(text: string, tone: Tone = "status") {
  const id = nextId.current;
  nextId.current += 1;
  setItems((current) => [...current, { id, tone, text }].slice(-3));
  setLive("");
  window.setTimeout(() => setLive(text), 0);
}
```

Wrap the `/framer` shell in `ToastProvider` if the toast is raised there. The iframe form cannot call `useToast` directly. The parent handles the response. Do not toast from `SiteFooter`.

### Do not copy

- `app/route.ts` HTML string. Read it. Do not patch it.
- `SiteFooter` success toast.
- `KitDialog` icon Close, Cancel, and Continue.
- `Button variant="primary"` as gold fill.
- `AccountFrames` password, Save, Pay, and sample booking row.
- `StayRow` sample name and `AED 1,050`.
- `CalendarPanel` as the ops month grid.
- `.ui-dialog` centering media query as the sidebar.
- Phase 2 instruction to drop `notFound()` on `/login`.

## No Analog Found

| File or behavior | Role | Data Flow | Reason |
|------------------|------|-----------|--------|
| `resend.contacts.create` inside `app/newsletter/route.ts` | service | request-response | `resend` is in `package.json` and is not imported anywhere. Copy the route gate from `app/framer/source/route.ts`. The create call is in RESEARCH.md, not in the tree. |
| `postMessage` of locale and currency into the iframe | component | event-driven | No `postMessage` in the repo. `FramerShell` already has `frame.contentWindow` for scroll. Use that window. Do not invent a second channel. |

## Metadata

**Analog search scope:** `app/framer`, `app/design`, `app/embed`, `app/layout.tsx`, `app/route.ts` (handler and the home form string only), `components/ui`, `components/specimens`, `components/icons`, `components/home/kit-home.tsx`, `lib`, `tests`, `playwright.config.ts`, `app/globals.css` (targeted selectors)
**Files scanned:** 28 analogs read, plus selector searches in `app/globals.css` and the home HTML string
**Pattern extraction date:** 2026-09-27

## PATTERN MAPPING COMPLETE
