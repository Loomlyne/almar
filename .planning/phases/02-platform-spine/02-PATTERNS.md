# Phase 2: Platform spine - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 22 new or modified
**Analogs found:** 18 / 22

Locked constraints the excerpts must not violate:

- No password field. No eye control. Do not copy `PasswordControl` or the `/design` password specimen.
- No public `/ops` path. Ops is `https://dashboard.almarprivatejourney.com`. DNS stays owner-gated.
- Public site and the logged-out ops page do not say dashboard. The public menu word is `touchword` (bar CSS uppercases it to TOUCHWORD). It is not translated.
- Square corners. `--radius-control` and `--radius-overlay` stay `0`.
- The live header is not the ivory `/design` header. Do not copy `.site-nav` background, type, or the 1088px cutoff onto the live bar.
- Magic link only. Supabase project does not exist. Do not invent a project ref, a custom link expiry, or a `COUNTDOWN = 60` product constant.
- Next.js 14.2.35 App Router. Existing marketing pages are `route.ts` handlers that return a Framer HTML string. New product UI is `page.tsx`, not a rewrite of those strings.
- Cloudflare host. `wrangler.toml` exists. Do not add the ops custom domain. Do not deploy to Vercel.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/login/page.tsx` | component | request-response | `app/design/page.tsx` | role-match |
| `app/login/login-form.tsx` | component | request-response | `components/specimens/account-frames.tsx` Sign-in frame | role-match |
| `app/account/page.tsx` | component | request-response | `app/not-found.tsx` | role-match |
| `app/auth/confirm/route.ts` | route | request-response | `app/design/map/route.ts` | role-match |
| `middleware.ts` | middleware | request-response | `app/design/page.tsx` production gate + `wrangler.toml` routes | partial |
| Ops host UI (not a public `/ops` URL) | component | request-response | `app/not-found.tsx` + `components/ui/nav.tsx` menu behavior | partial |
| `components/live-header.tsx` | component | event-driven | `components/ui/nav.tsx` `NavDrop` behavior; closed bar from `app/route.ts` line 15 | split |
| Framer `GET` wrappers (`app/**/route.ts`, 20 pages with the desktop nav) | route | transform | `app/route.ts` lines 17–25 | exact for the wrapper; do not edit the HTML string in place |
| `lib/supabase/server.ts` | service | request-response | `app/design/map/route.ts` secret read | partial |
| `lib/supabase/browser.ts` | service | request-response | none for cookies | no analog |
| `lib/i18n/strings.ts` | utility | transform | `app/design/design-kit.tsx` `setLocale` | partial |
| `lib/fx/convert.ts` | service | request-response | `app/design/map/route.ts` fetch + `lib/format.ts` | partial |
| `lib/email/magic-link.ts` | utility | transform | `lib/not-found-document.ts` | role-match |
| `components/settings-form.tsx` | component | CRUD | `components/ui/field.tsx` + `checkbox.tsx` + `select.tsx` + `button.tsx` | role-match |
| `wrangler.toml` | config | request-response | itself | exact |
| `package.json` | config | — | itself | exact |
| `tests/auth-magic-link.test.mjs` and the other Wave 0 files in RESEARCH.md | test | — | `tests/design-tokens.test.mjs` | role-match |
| `tests/auth-i18n.spec.ts` | test | — | `tests/not-found.spec.ts` | role-match |
| `app/layout.tsx` | provider | request-response | itself | exact |
| `app/globals.css` | config | — | itself | exact |
| `scripts/assemble-cloudflare.mjs` | utility | file-I/O | itself | exact |
| `next.config.js` / `next.config.mjs` | config | — | both exist; see Shared Patterns | partial |

## Pattern Assignments

### `app/login/page.tsx` (component, request-response)

**Analog:** `app/design/page.tsx`

This is the only `page.tsx` in the app. Copy the server-page shape. Do not copy the production `notFound()` gate. `/login` must exist in production. Do not implement this page as `app/login/route.ts` returning a Framer HTML string.

**Imports and page shape** (`app/design/page.tsx` lines 1–9):

```tsx
import { notFound } from "next/navigation";
import { DesignKit } from "./design-kit";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignKit hasMapbox={Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim())} />;
}
```

Copy the default-export server component and the relative import of a client child. Drop the `notFound()` branch. The client child is the form, same split as `app/design/design-kit.tsx` line 1 (`"use client"`) imported by a server `page.tsx`.

**Metadata analog** (`app/not-found.tsx` lines 1–7):

```tsx
import type { Metadata } from "next";
import { StatusFrame } from "../components/status-frame";
import { NOT_FOUND_TITLE } from "../lib/not-found-document";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
};
```

Logged-out title is `Sign in`. Do not put dashboard in that title.

**Layout the page inherits** (`app/layout.tsx` lines 1–19). Framer `route.ts` files do not use this layout. `page.tsx` does. Keep the skip link. Do not add a root layout around Framer HTML.

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

Arabic must set `lang="ar"` and `dir="rtl"` on `documentElement`, not a `/ar` URL. Copy the client setter, not the EN/AR/ES closed labels:

```tsx
function setLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}
```

Source: `app/design/design-kit.tsx` lines 254–261. Font variables come from `lib/fonts.ts` lines 34–45 (`notoNaskh`, `notoSans`). Layout currently loads only Questa and Lato. An Arabic page must also add the Noto variables the way `setLocale` does.

**Split image** is not a component. It is a string inside `app/route.ts` line 15: `poster="/assets/img/caedcb84dd0d35bb.webp"`. Use that file, `alt=""`, `object-fit: cover`. Same file on the logged-out ops host. No split-layout component exists. Do not invent one from `.site-nav`.

**Do not copy** the ivory header from `components/ui/nav.tsx` onto `/login`. Language and currency stay. SIGN IN is not shown on this page.

---

### `app/login/login-form.tsx` (component, request-response)

**Analog:** `components/specimens/account-frames.tsx` lines 20–33, plus `components/ui/field.tsx` email path.

**Imports** (`components/specimens/account-frames.tsx` lines 1–6):

```tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
```

**Core form to copy** (lines 23–27). Email only. Do not copy the Account frame's Save button (lines 50–56). Do not copy Reset password or Forgot password (lines 71–80).

```tsx
<Frame title="Sign-in">
  <Field id="sign-in-email" label="Email" name="sign-in-email" />
  <Button variant="primary" type="button">
    Sign in
  </Button>
</Frame>
```

Change the button children to `Access with magic link`. The tab label is `Sign in`, not `Login`. Create account is the other tab, not a second gold button on the Sign in tab. Unknown email stays in the field and switches the tab. Do not render `You don't have an account.`

**Field error pattern to copy** (`components/ui/field.tsx` lines 42–76). The line sits under the field. `aria-invalid` and `aria-describedby` are already wired.

```tsx
<div className="field">
  <label className="field-label" htmlFor={id}>
    {label}
    {required ? (
      <span className="text-[var(--color-fg)]" aria-hidden="true">
        {" "}
        *
      </span>
    ) : null}
    {optional ? (
      <span className="text-[var(--color-muted-fg)]"> optional</span>
    ) : null}
  </label>
  {/* Control */}
  {message ? (
    <p
      id={messageId}
      className={error ? "field-error text-[var(--color-danger)]" : "field-hint"}
    >
      {message}
    </p>
  ) : null}
</div>
```

**Email input path to copy** (`components/ui/field.tsx` lines 120–132). This is the path that does not render an eye.

```tsx
return (
  <div className={`field-control${search ? " is-search" : ""}`}>
    {search ? <SearchIcon /> : null}
    <input
      id={id}
      className="ui-input"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      required={required}
      {...inputProps}
    />
  </div>
);
```

Pass `type="email"` and `autoComplete="email"`. Add a separate hidden input `autoComplete="email-verification-token"`. Do not pass `type="password"`.

**Do not copy** (`components/ui/field.tsx` lines 115–118 and 135–168):

```tsx
if (inputProps.type === "password") {
  return <PasswordControl id={id} describedBy={describedBy} invalid={invalid} required={required} {...inputProps} />;
}
```

```tsx
<button
  type="button"
  className="eye inset-inline-end"
  aria-label={shown ? "Hide password" : "Show password"}
  onClick={() => setShown((value) => !value)}
>
  <EyeIcon masked={!shown} />
</button>
```

`tests/design-rtl.spec.ts` lines 8–12 assert that eye. Do not extend that assertion onto `/login`.

**Button API to copy, fill to correct** (`components/ui/button.tsx` lines 22–43):

```tsx
export function Button({
  variant = "primary",
  busy = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || busy);
  return (
    <button
      type={type}
      className={`ui-button ${VARIANT_CLASS[variant]} disabled:bg-[var(--color-bg)] disabled:text-[var(--color-muted-fg)] disabled:border-[var(--color-border)] disabled:cursor-default ${className}`}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
```

Copy `busy`, `aria-busy`, and the square `Spinner`. Do not copy `VARIANT_CLASS.primary` (lines 12–13) as the phase primary fill. That class is ivory background, gold border, and a hover that puts ivory text on teal. The phase primary fill is gold `#d4ba8a` with teal `#1f3b40` label. One gold fill per view.

**Check-your-email** replaces the form on the same `/login`. Tabs stay. Closest specimen is `components/specimens/account-frames.tsx` lines 82–86, but the button word is `Send again`, not `Resend`, and the page shows the address in `<bdi>`.

```tsx
<Frame title="Check your email">
  <p>Check your email.</p>
  <Button variant="secondary" type="button">
    Resend
  </Button>
</Frame>
```

Send again too soon: disable that button and show a countdown taken from the auth error. Do not hardcode 60.

**Confirm dialogs** for ops Sign out and Logout-all copy the lock from `components/ui/dialog.tsx` lines 23–35, not the button words on lines 46–49 (`Cancel` / `Continue`).

```tsx
const locked = dismiss === "confirm";
return (
  <Dialog.Root>
    <Dialog.Trigger className="ui-button ui-button-inline">{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="ui-scrim" />
      <Dialog.Content
        className={wide ? "ui-dialog ui-dialog-wide" : "ui-dialog"}
        aria-describedby={undefined}
        onEscapeKeyDown={locked ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={locked ? (event) => event.preventDefault() : undefined}
        onInteractOutside={locked ? (event) => event.preventDefault() : undefined}
      >
```

Public Sign out does not confirm. Ops confirm buttons are `Sign out everywhere` / `Stay signed in` and `Sign out of this site` / `Stay signed in`.

---

### `app/account/page.tsx` (component, request-response)

**Analog:** `app/not-found.tsx` lines 9–16 and `components/status-frame.tsx` lines 4–18.

```tsx
export default function NotFound() {
  return (
    <StatusFrame title="Page not found">
      <a className="ui-link" href="/">
        Return home
      </a>
    </StatusFrame>
  );
}
```

```tsx
export function StatusFrame({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}`;
  return (
    <main id="content" className="status-page">
      <img className="status-mark" src={src} alt="" width={128} height={70} />
      <h1>{title}</h1>
      {children}
    </main>
  );
}
```

Bookings is one line: a link home, label `Go to the home page`. Account is one line: `Account details are not here yet.` No Save. No password. No dashboard word. `id="content"` matches the skip link in `app/layout.tsx` line 13.

Ops unbuilt sections use the same one-line shape. The visible line is `Not ready.` No second sentence. No button.

---

### `app/auth/confirm/route.ts` (route, request-response)

**Analog:** `app/design/map/route.ts`. Not `app/route.ts`.

The Framer handler ignores the request and always returns the HTML string. Confirm must read the query and exchange `token_hash`. Copy the dynamic route shape and the fail-closed status returns. Do not copy the Mapbox URL or the production 404 that hides `/design`.

**Imports and runtime** (`app/design/map/route.ts` lines 1–8):

```ts
import https from "node:https";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-only. Set MAPBOX_ACCESS_TOKEN in the process environment.
// Do not hardcode a token, and do not use NEXT_PUBLIC_.
```

**Secret read** (lines 15–18):

```ts
function mapboxToken(): string | null {
  const value = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  return value ? value : null;
}
```

**Error statuses** (lines 57–70):

```ts
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const accessToken = mapboxToken();
  if (!accessToken) {
    return new NextResponse(null, { status: 404 });
  }

  const upstream = await loadMap(accessToken);
  if (!upstream || upstream.status !== 200 || !upstream.type.startsWith("image/")) {
    return new NextResponse(null, { status: 502 });
  }
```

Confirm is a real route, so it must not 404 in production. A dead or used link redirects to the login page on the host she requested, with the note `Your link expired. Try again.` Do not accept a user-supplied redirect. `emailRedirectTo` is the requesting origin plus `/auth/confirm`.

Do not copy the Framer `GET` (`app/route.ts` lines 17–25) for this file. That handler takes no `Request` and cannot set a session.

---

### `middleware.ts` (middleware, request-response)

**No middleware file exists.** Partial analogs only.

**Host list to extend, not to run** (`wrangler.toml` lines 1–16):

```toml
name = "almar"
compatibility_date = "2026-09-23"
workers_dev = true

[assets]
directory = "./out"
html_handling = "auto-trailing-slash"
not_found_handling = "404-page"

[[routes]]
pattern = "almarprivatejourney.com"
custom_domain = true

[[routes]]
pattern = "www.almarprivatejourney.com"
custom_domain = true
```

Do not add `dashboard.almarprivatejourney.com` here. DNS is one numbered owner step, then wait. Do not invent a project ref.

**Gate shape to copy** (`app/design/page.tsx` lines 4–7): a request that is not allowed returns not-found, it does not serve the marketing homepage.

```tsx
if (process.env.NODE_ENV === "production") {
  notFound();
}
```

Apply that idea to the host, not to production. On `dashboard.almarprivatejourney.com`, never return the Framer HTML from `app/route.ts`. A guest session from the marketing host does not authorize the ops host. A guest email stays in the field. The line is `This email cannot be used here.` Logged-out title stays `Sign in`.

If a folder named `app/ops/` is created because RESEARCH.md listed it, the marketing host must 404 `/ops`. The public URL is the ops host root, not `https://almarprivatejourney.com/ops`.

---

### Ops host UI (component, request-response)

**Analogs:** `app/not-found.tsx` for the one-line pages, `components/ui/nav.tsx` for menu open/close behavior only.

Do not copy `SiteNav` colors. `.site-nav` is ivory (`app/globals.css` lines 2322–2340):

```css
.site-nav {
  container: site-nav / inline-size;
  box-sizing: border-box;
  position: sticky;
  inset-block-start: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--spacing-md);
  inline-size: 100%;
  min-inline-size: 0;
  max-inline-size: 100%;
  min-block-size: 86px;
  padding-block: var(--spacing-sm);
  padding-inline: 12px;
  background: var(--color-bg);
  border-block-end: 1px solid var(--color-border);
  color: var(--color-heading);
}
```

`--color-bg` is ivory (`app/globals.css` lines 16–19). That is the `/design` header. The ops shell after she is in may use ivory page and a white side column. The public live header may not.

**Menu behavior to copy** (`components/ui/nav.tsx` lines 172–188 and 233–241): logo stays, icon toggles, Escape returns focus, body scroll locks. Change the cutoff. This file uses `NAV_ROW_MIN = 1088` (line 14). Ops nav becomes a menu below 1440px. The public header becomes a menu at 1200px. These are not the same bar.

```tsx
function closeMenu() {
  setOpen(false);
  menuRef.current?.focus();
}
```

```tsx
<button
  ref={menuRef}
  type="button"
  className="nav-menu"
  aria-expanded={open}
  aria-controls={menuId}
  onClick={() => setOpen(true)}
>
  Menu
</button>
```

The public menu mark is the existing Framer three-bar icon, not `CloseIcon`. `CloseIcon` is for confirm dialogs (`components/ui/dialog.tsx` lines 40–42). Ops phone menu covers the page. Logo stays. The same icon closes it.

After she is in, the name next to the logo may say Dashboard, uppercased with CSS. Section names stay Home, Bookings, Customers, Calendar, Catalog, Content, Settings, Profile. Unbuilt pages, including Home, show `Not ready.` Sign out and Logout-all sit in the nav on every page. Copy `Button` `variant="danger"` for the confirm action (`components/ui/button.tsx` lines 18–19): transparent fill, charcoal label, error outline. Not a red fill.

Logged-out ops sign-in copies the `/login` form and the split image. No Create account tab. The page does not say dashboard. The check-your-email state on that host does not say dashboard. The email may.

Maintenance on the public site, including `/login`, is a branded page. Copy the status-page shape. Phone and email stay `+971 56 388 3302` and `inquiries@almarprivatejourney.com` (present in `app/contact/route.ts` line 15). Do not link to the ops host from that page. The ops host still opens.

---

### `components/live-header.tsx` (component, event-driven)

**Split analog.** Closed bar comes from the Framer HTML. Open list comes from `NavDrop`. Do not restyle the live bar to `.site-nav`.

**Closed bar, inside `const HTML` on `app/route.ts` line 15.** Not a separate line. Visible labels in the desktop nav: `DESTINATIONS`, `EXPERIENCES`, `SERVICES`, `ABOUT`, `CONTACT`, `SIGN IN`. hrefs in that block: `./destinations`, `./experiences`, `./services`, `./about`, `./contact`.

Gradient on `data-framer-name="Desktop"`:

```text
background:linear-gradient(180deg, var(--token-82df8d19-f4be-4c35-965d-0e06fbac063b, rgba(0, 0, 0, 0.4)) 0%, var(--token-e862a2cb-149a-4696-8526-b3d0a054c223, rgba(0, 0, 0, 0.1)) 60%, var(--token-6bdbc377-e387-4479-b97b-a661c183d55a, rgba(0, 0, 0, 0)) 100%)
```

Wordmark in the same string: `src="/assets/img/a5af4328cc4224db.svg"`. Keep it until she saves a logo. SIGN IN text color in that string uses `rgba(249, 246, 243, 0.5)`. Keep the light type. Do not put the closed control in the ivory boxed trigger.

**Open list to copy** (`components/ui/nav.tsx` lines 37–49 and 114–156), and the selected-row CSS (`app/globals.css` lines 3206–3258).

```tsx
function NavDrop<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly NavOption<T>[];
  onChange: (next: T) => void;
  className: string;
}) {
```

```tsx
<button
  ref={triggerRef}
  type="button"
  className="nav-drop-trigger"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={listId}
  onClick={() => setOpen((next) => !next)}
  onKeyDown={onTriggerKeyDown}
>
```

```css
.nav-tools .nav-drop-panel {
  position: absolute;
  z-index: 5;
  inset-inline-start: 0;
  inset-block-start: calc(100% + 4px);
  inline-size: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-surface);
}

.nav-tools .nav-drop-option {
  display: flex;
  align-items: center;
  inline-size: 100%;
  min-block-size: 44px;
  padding-inline: var(--spacing-md);
  border: 0;
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-fg);
}

.nav-tools .nav-drop-option[aria-selected="true"] {
  background: var(--color-ivory);
  color: var(--color-teal);
  box-shadow: inset 3px 0 0 var(--color-gold);
}
```

Copy the listbox roles, 44px options, white panel, ivory selected row, gold inset. On the live bar the closed trigger stays light type, not `.nav-drop-trigger` boxed styles (`app/globals.css` lines 3196–3203).

**Do not copy the option labels** (`components/ui/nav.tsx` lines 19–29):

```tsx
const CURRENCIES = [
  { value: "AED", label: "AED" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
] as const;

const LOCALES = [
  { value: "en", label: "EN" },
  { value: "ar", label: "AR" },
  { value: "es", label: "ES" },
] as const;
```

Closed language labels are `English`, `العربية`, `Español`. Closed currency labels `AED`, `USD`, `EUR` can stay. The `/design` nav also says `Login` (line 290). The live control is `Sign in`, rendered uppercase by CSS, not a second Login, not a gold button.

```tsx
<a className="nav-login" href="#log-in">
  Login
</a>
```

Replace that href with `/login` on the live bar only. Signed-in row replaces only that control: Bookings, Account, Sign out, touchword. Currency and language stay in front. touchword is an `<a target="_blank" rel="noopener noreferrer">`. Accessible name is touchword. Do not add dashboard to that name. Only her account sees it.

A language pick updates the page in place. The URL does not change. In the opened phone menu, a link closes the menu. A language pick leaves it open. Public header menu cutoff is 1200px, not 1088 and not 1440.

Order after the current links: currency, then language, then Sign in. One row. They do not wrap under the logo.

---

### Framer `GET` wrappers (route, transform)

**Analog:** `app/route.ts` lines 1–6 and 17–25. Same wrapper in `app/contact/route.ts` lines 17–25 and the other marketing `route.ts` files.

```ts
// Auto-generated from the original Framer page. Served verbatim — including
// the HTML comment nodes, which are Framer's React hydration (Suspense
// boundary) markers: rendering this through JSX instead was tried and
// reverted because React cannot emit comment nodes
```

```ts
export function GET() {
  return new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
    },
  });
}
```

Twenty `route.ts` files contain `data-framer-name="Desktop"`. The six price tokens are only in `app/route.ts` line 15, each stored more than once (visible HTML and the Framer JSON):

- `From USD $3,000/person · Est. AED 80,000–90,000`
- `From USD $3,500/person · Est. AED 120,000–150,000`
- `From USD $20,000/person · Est. AED 200,000–250,000+`

`$` amounts are USD. `AED` amounts stay AED. Convert each from what is written. A currency change updates those prices in place. The URL stays the same. No guest-facing rate-unavailable string.

Do not rewrite these files as JSX. Do not stuff `/login`, settings, or the ops shell into the `HTML` constant. Leave `const HTML` as the Framer document. If the header island or price swap has to touch the response, transform a copy inside `GET` and return that. `export function GET()` currently takes no argument. A serve-time patch may add `request: Request` only on the handlers that read the cookie. Do not add `POST` to these files.

There is no `patchHTML` helper in the tree. `HERMES.md` says not to invent `app/lib/html-patch.ts` until it exists, and also says not to mutate twenty HTML strings by hand. This phase needs the island on every Framer page (D-55). Add one helper and call it from each `GET`. Do not paste the island into twenty `HTML` constants.

`export const dynamic = "force-static"` (`app/route.ts` line 13) cannot set an auth cookie. Auth and settings are not this handler.

---

### `lib/supabase/server.ts` (service, request-response)

**No Supabase client exists.** `package.json` dependencies are Next, React, Radix, Tailwind, and `@internationalized/date`. Do not invent a project ref. Do not add the URL to the client bundle.

**Module shape** (`lib/format.ts` lines 1–13): a small typed module, no classes, double quotes, no path alias.

```ts
const LATN = "ar-AE-u-nu-latn";

export function formatAmount(currency: string, amount: number): string {
  return `${currency} ${grouped(amount)}`;
}
```

**Secret rule to copy** (`app/design/map/route.ts` lines 7–8 and 15–18): server env, `.trim()`, null when missing, never `NEXT_PUBLIC_` for the service role. The browser client may use the publishable key only. The service role stays in the server module.

Do not call Supabase Storage. Do not set a custom magic-link expiry. Session time-box of 30 days is an Auth setting when the project is created, not a cookie the code invents. Owner seed email is `maria@almarprivatejourney.com`, email only, name empty. She does not use Create account. Nothing is sent from chat.

Sign in uses `shouldCreateUser: false`. Create account is the only create path, and it rejects the owner email first with `This email cannot be used here.`

---

### `lib/supabase/browser.ts` (service, request-response)

**No cookie helper exists.** Do not use `localStorage` for the access token. `@supabase/ssr` is the package RESEARCH.md names. Pin the version from the registry. Do not invent it.

Relative imports only. `tsconfig.json` has no `paths` and no `baseUrl`.

---

### `lib/i18n/strings.ts` (utility, transform)

**Analog:** `app/design/design-kit.tsx` lines 254–261 for `lang` / `dir`. String map is not in code. Source strings are natural case. The live bar uppercases with CSS. Do not store `SIGN IN` or `TOUCHWORD` as the source. `touchword` is the same in English, Arabic, and Spanish.

Do not add `/en`, `/ar`, or `/es`. Default is English. Language follows her once she is signed in. This browser only when she is not. Same for currency. A settings save updates the other open tab immediately. No BroadcastChannel analog exists. Do not use the toast as the only record of that save (`components/ui/toast.tsx` dismisses on a timer, lines 59–66). Settings success is a line that stays: `Settings saved.`

Dates: copy `lib/format.ts` lines 19–22. Do not switch to `Intl` date styles that drop `DD/MM/YYYY`.

```ts
export function formatDate(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}/${mm}/${year}`;
}
```

---

### `lib/fx/convert.ts` (service, request-response)

**Fetch analog:** `app/design/map/route.ts` lines 31–54. Server fetch, no token in the client, error does not become a guest message.

```ts
function loadMap(accessToken: string): Promise<{ status: number; type: string; body: Buffer } | null> {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: MAP_HOST,
        path: mapPath(accessToken),
        headers: { Accept: "image/png,image/jpeg,image/webp" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", () => resolve(null));
  });
}
```

Copy the server fetch and the `req.on("error")` path. Do not copy the 502 response (lines 68–70) onto the public page. If the rate cannot be fetched, retry and make conversion work. She can see the live rate in Settings and cannot type one. Do not add a guest-facing failure. Do not add a retry button that looks like a second primary.

**Display analog:** `lib/format.ts` lines 11–13 and `components/specimens/price.tsx` lines 26–29. Amounts use `formatAmount`. Prices, VAT, deposit, countdown, and the FX figure use `font-variant-numeric: tabular-nums` (already on `.nav-drop-option`, `app/globals.css` line 3248).

Name the FX feed in the plan after a docs check. Do not invent a feed URL here.

---

### `lib/email/magic-link.ts` (utility, transform)

**Analog:** `lib/not-found-document.ts` lines 4–20. Constants plus a function that returns an HTML string. No secrets in the string.

```ts
export const NOT_FOUND_TITLE = "Page not found | ALMAR";
export const NOT_FOUND_HEADING = "Page not found";
export const NOT_FOUND_LINK_LABEL = "Return home";
export const NOT_FOUND_HREF = "/";
export const MONOGRAM_FILE = "brand/Logo Monogram/Curves_black.svg";

export function renderStaticNotFound() {
  const svg = readFileSync(join(process.cwd(), MONOGRAM_FILE), "utf8")
    .replace(/<\?xml[\s\S]*?\?>/, "")
    .replace(/<!DOCTYPE[\s\S]*?>/, "");

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
```

Sender name is `ALMAR Private Journey`. From `inquiries@almarprivatejourney.com`. Button label `Access with magic link`. Square corners. No password. No code to type. Public email does not say dashboard. The ops sign-in email subject is `Sign in`. Its body may say dashboard. Language is the language selected on the page when she asked.

She does not edit templates this phase. Do not build a template editor.

Resend is not installed. Domain for that from-address is owner-gated when email is built. Do not invent a Resend API key in the repo.

---

### `components/settings-form.tsx` (component, CRUD)

**Analogs:** field, checkbox, select, button. Not the switch.

**Maintenance control to copy** (`components/ui/checkbox.tsx` lines 7–14). UI-SPEC says a checkbox, not a pill. Do not copy `components/ui/switch.tsx` lines 22–28 (`role="switch"`).

```tsx
export function Checkbox({ label, className = "", ...rest }: ChoiceProps) {
  return (
    <label className={`choice ${className}`}>
      <input type="checkbox" className="choice-input" {...rest} />
      <span className="choice-mark" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
```

Label: `Maintenance is on`. Starts off. Applies only after Save.

**Face pickers:** `components/ui/select.tsx` lines 62–89 (`OptionSelect`). Title lists Questa only. Body lists Lato only. Not radios. Arabic faces stay Noto Naskh Arabic and Noto Sans Arabic (`lib/fonts.ts` lines 34–45) even when the Latin faces change.

**Save:** `Button` with children `Save`. Enabled only when something changed. Contrast failure blocks save. The line under that color is `The contrast is too low.` VAT and deposit are percents, empty or a number including 0, two decimal places. Copy `Field` error placement. Do not add a radius control. `--radius-control: 0` (`app/globals.css` line 42).

**Logo file:** until she saves one, the live header keeps `/assets/img/a5af4328cc4224db.svg`. After a saved logo, clear removes it and she must add another before Save enables. SVG source imports use `svg.d.ts` and the webpack rule in `next.config.mjs` lines 3–8. Do not assume `next.config.js` has that rule.

Leaving with unsaved changes uses the locked dialog pattern. Buttons: `Leave settings` and `Stay on settings`. Scrim click does not discard.

---

### `package.json` (config)

**Analog:** itself, lines 5–20.

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "host:cloudflare": "node scripts/assemble-cloudflare.mjs && wrangler deploy",
  "test": "node --test tests/design-tokens.test.mjs && playwright test"
},
"dependencies": {
  "@internationalized/date": "3.12.4",
  "@tailwindcss/postcss": "4.3.3",
  "next": "14.2.35",
  "postcss": "8.5.28",
  "radix-ui": "1.6.7",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "tailwindcss": "4.3.3"
}
```

Pin new packages from the registry. Do not invent versions. Do not add a `vercel` script. `host:cloudflare` deploys the static `./out` worker. Auth cannot ship on that path alone. Do not run deploy.

---

### Tests

**Unit analog:** `tests/design-tokens.test.mjs` lines 1–5 and 47–52, and `tests/assemble-404.test.mjs` lines 1–18.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
```

```js
test("design tokens are declared without banned strings", () => {
  assert.equal(
    existsSync("app/globals.css"),
    true,
    "app/globals.css does not exist",
  );
```

Wave 0 files named in RESEARCH.md do not exist yet: `tests/auth-magic-link.test.mjs`, `tests/auth-owner.test.mjs`, `tests/host-gate.test.mjs`, `tests/locale.test.mjs`, `tests/fx.test.mjs`, `tests/format.test.mjs`, `tests/supabase-client.test.mjs`, `tests/secrets.test.mjs`, `tests/host-config.test.mjs`. Copy this import style. Assert the public render does not contain `dashboard`, `type="password"`, or `/ops`. Assert the service-role key is not in a client file. Do not assert an eye on `/login`.

**E2E analog:** `tests/not-found.spec.ts` lines 1–19 and `playwright.config.ts` lines 1–21. Port 3010. `tests/auth-i18n.spec.ts` does not exist yet.

```ts
import { expect, test } from "@playwright/test";

test("unknown path is the branded 404 and contact stays Framer", async ({ page }) => {
  const missing = await page.goto("/this-route-does-not-exist");
  expect(missing?.status()).toBe(404);
```

`/design` Arabic dir test is `tests/design-rtl.spec.ts` lines 22–24: click a locale control, then `toHaveAttribute("dir", "rtl")` and `lang` `ar`. Copy that assertion. Do not copy the eye bounding-box checks (lines 9–12). Closed language controls on the live bar are not named `AR`.

---

## Shared Patterns

### Authentication

**Source:** none in the repo. Do not invent a password form from `components/ui/field.tsx` lines 135–168.

**Apply to:** `/login`, ops sign-in, confirm route, both clients.

Magic link only. `shouldCreateUser: false` on Sign in. Create account is a separate call and rejects `maria@almarprivatejourney.com`. Confirm link activates the account and signs her in. Link returns to the host she requested. Browser proof is a hidden `email-verification-token` input. If the browser does not fill it, the magic link is the fallback. No typed code.

### Do not say dashboard

**Apply to:** public header, public email, logged-out ops page, logged-out ops title, check-your-email on the ops host, field errors.

Public menu item is the literal word touchword. Only her signed-in account sees it. After she is in, Dashboard may appear in the browser title and the name next to the logo. Section names stay Home, Bookings, and the rest.

### Error handling

**Source:** `components/ui/field.tsx` lines 69–75 and `app/error.tsx` lines 12–17.

**Apply to:** login, create account, settings.

```tsx
<p
  id={messageId}
  className={error ? "field-error text-[var(--color-danger)]" : "field-hint"}
>
  {message}
</p>
```

Locked lines, not paraphrases: `Add your name.` `Add your last name.` `Use letters, spaces, or hyphens.` `Enter an email address.` `Use digits and a plus only.` `This email cannot be used here.` `The contrast is too low.` `Your link expired. Try again.` `You already have an account.`

`app/error.tsx` is the React error boundary, not the Framer 404. Framer unknown paths still hit the catch-all behavior the 404 test checks. Do not return JSON from HTML routes.

### Validation

**Source:** `app/design/design-kit.tsx` lines 264 and 297–299 for the date pattern style. Field errors use the `error` prop, not a toast.

```ts
const DATE_PATTERN = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
```

Name and last name: letters, Arabic letters, accents, spaces, hyphens. Phone: digits and a plus, optional. VAT and deposit: empty, or a number including 0, two decimal places.

### Square corners

**Source:** `app/globals.css` lines 41–42.

```css
--radius-control: 0;
--radius-overlay: 0;
```

Do not add a radius control to settings. Do not copy a pill switch for maintenance.

### Host and deploy

**Source:** `wrangler.toml` lines 5–16 and `scripts/assemble-cloudflare.mjs` lines 11–15 and 35–45.

```js
execSync("npm run build", { cwd: root, stdio: "inherit" });
```

```js
for (const body of bodies) {
  const rel = path.relative(appDir, body).replace(/\.body$/, "");
  const dest =
    rel === "index"
      ? path.join(outDir, "index.html")
      : path.join(outDir, `${rel}.html`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(body, dest);
}
```

That script copies static bodies into `out/` and `wrangler.toml` serves `./out`. A magic link cannot create a session on that path. Plan the server code. Do not create the Worker or the ops DNS. Do not treat `host:cloudflare` as the phase deploy.

Two Next configs exist. `next.config.js` lines 1–3 are `reactStrictMode` only. `next.config.mjs` lines 3–8 add the SVG `asset/source` rule. Do not add a third config. Do not drop the SVG rule. Do not add `output: "export"` in a way that deletes the dynamic confirm route.

### Imports

No path aliases. From `app/login/page.tsx`, components are `../../components/...`. From `app/design/design-kit.tsx` line 5, the same relative style. Double quotes. Semicolons. Two-space indent. `strict: true`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/supabase/browser.ts` | service | request-response | No cookie session helper. No `@supabase/ssr`. Do not use `localStorage`. |
| `middleware.ts` | middleware | request-response | No middleware file. Host gate has to be new. Do not expose `/ops`. |
| Ops host DNS route | config | request-response | `wrangler.toml` has only the marketing hosts. Do not add the ops domain in this plan's commands. |
| FX feed client | service | request-response | No rate fetch. Mapbox fetch is the server-fetch shape only. Name the feed after a docs check. |
| Cross-tab settings sync | event-driven | pub-sub | No BroadcastChannel or storage listener. Toast is the wrong record. |
| Browser email-verification package | service | request-response | Not installed. Magic link is the locked fallback if the package fails a legitimacy check. |

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `tests/`, `scripts/`, `wrangler.toml`, `package.json`, `next.config.js`, `next.config.mjs`, `playwright.config.ts`
**Files scanned:** 27 `route.ts` handlers, 1 `page.tsx`, 3 `lib/` modules, 7 tests, nav/field/button/dialog/checkbox/switch/select/status-frame/account-frames
**Pattern extraction date:** 2026-09-25

## PATTERN MAPPING COMPLETE

**Phase:** 2 - platform-spine
**Files classified:** 22
**Analogs found:** 18 / 22

### Coverage

- Files with exact analog: 4 (`app/route.ts` GET wrapper, `wrangler.toml`, `package.json`, `app/layout.tsx`)
- Files with role-match analog: 14
- Files with no analog: 4 (browser Supabase cookies, middleware, ops DNS route, FX feed)

### Key Patterns Identified

- New product UI copies `app/design/page.tsx` (server `page.tsx` plus a `"use client"` child), not `export function GET()` plus a Framer `HTML` string.
- Confirm and any server fetch copy `app/design/map/route.ts`: `force-dynamic`, server env, no `NEXT_PUBLIC_` secret, `NextResponse` statuses. They do not copy the production 404 that hides `/design`.
- Login fields copy `Field` email path and the Sign-in specimen. They do not copy `PasswordControl`, the eye, or Reset password.
- The live header closed bar copies the Framer desktop gradient and light type inside `app/route.ts` line 15. The open list copies `NavDrop` and `.nav-drop-option[aria-selected="true"]`. It does not copy `.site-nav` ivory or the 1088px cutoff.
- Public copy uses touchword. Logged-out ops title is Sign in. No `/ops` path. No invented Supabase project ref.

### File Created

`.planning/phases/02-platform-spine/02-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
