# Phase 2: Platform spine - Research

**Research date:** 2026-09-25
**Valid until:** 2026-10-25
**Mode:** mvp

> Written by the plan orchestrator after `gsd-phase-researcher` timed out with no file. Claims below were checked in this session. The failed child is not a source.

## User Constraints

Full verbatim decisions are in `.planning/phases/02-platform-spine/02-CONTEXT.md`. The planner must read that file. Superseded bullets in it must not be planned. This list is the in-force subset.

- Magic link only. No password fields. No eye control this phase. Confirm link activates the account and signs her in.
- Do not invent a magic-link lifetime. Use whatever Supabase allows. Do not set a custom expiry.
- Public sign-in is `/login`. Two tabs on top of the form: Sign in, then Create account. Clicking a tab changes the form.
- Unknown sign-in email stays in the field and transfers to Create account. Do not show "You don't have an account."
- Create account: name and last name required (letters, including Arabic and accents, plus spaces and hyphens). Phone optional, digits and a plus. Button says Create account.
- Check-your-email replaces the form on the same `/login`. Tabs stay. Send again too soon shows a countdown until she can. The page shows the address.
- Email button and the sign-in button say "Access with magic link."
- If the browser can prove the email, she gets access directly. The magic link is the fallback. Same rule on the ops host.
- After access she lands on the page she came from. Home if she opened `/login` directly.
- A dead or used link returns to the login page with "Your link expired. Try again."
- Ops is `https://dashboard.almarprivatejourney.com`. Not `/ops`. DNS is owner-gated. One numbered step, then wait.
- The public site must not say dashboard. Her signed-in menu item is the literal word touchword, rendered TOUCHWORD, not translated. Only her account sees it. It opens the ops host in a new tab.
- A guest email on the ops sign-in stays in the field. The line is "This email cannot be used here." A signed-in guest who opens that URL does not get in.
- Logged-out ops title stays Sign in. The page does not say dashboard until she is in. After she is in, the word sits in the browser title and the name next to the logo (DASHBOARD). Section names stay Home, Bookings, and the rest.
- Owner email `maria@almarprivatejourney.com` is seeded when Supabase is created. Email only. Name empty. She does not use Create account. She requests the first link on the ops host. Nothing is sent from chat.
- Create account rejects that email with "This email cannot be used here." Public Sign in with that email is the same check-your-email page as a guest.
- A magic link returns to the host she requested it on.
- Confirm email is Resend, from `inquiries@almarprivatejourney.com`, display name `ALMAR Private Journey`. Owner gates that domain when built. She does not edit templates this phase.
- Session is 30 days for guest and owner.
- Same URLs for English, Arabic, and Spanish. No `/en` prefixes. Default English. Arabic is RTL. Every component, line, text, section, page, and alt text. Images with text need three files. Other images keep one file and three alt texts.
- Language and currency follow her once signed in. This browser only when she is not. A settings save updates the other open tab immediately.
- Live header keeps DESTINATIONS, EXPERIENCES, SERVICES, ABOUT, CONTACT, SIGN IN. Add currency, then language, then SIGN IN. Do not restyle to the `/design` ivory header. Closed controls use light type. Open list is the `/design` dropdown. Closed language: English, العربية, Español. Closed currency: AED, USD, EUR.
- The public header becomes a menu at 1200px. Logo and the existing menu icon. Opened menu covers the page. A link closes it. A language pick leaves it open and updates the page in place.
- Signed-in desktop items sit in the row in place of SIGN IN: BOOKINGS, ACCOUNT, SIGN OUT, TOUCHWORD. Currency and language stay in front. Header Sign out does not confirm and leaves her on that page. It ends this site only.
- `$` prices are USD. AED prices stay AED. Convert now. If the rate cannot be fetched, fix conversion. Not a guest-facing fail state. A currency change updates prices in place. The URL stays the same.
- Settings this phase: brand (every brand color, each on its own; title face and body face from the design system; Arabic keeps its own face; no radius), VAT, deposit, live FX view-only, maintenance, logos, language, currency. Save button, enabled when something changed. Leaving with unsaved changes asks to confirm. Contrast failure blocks save. VAT and deposit are percents, empty or a number including 0, decimals to two places.
- A saved logo is used on the live header, the ops host, and the emails. Clear removes it and she must add another. Until she saves one, keep the current logo.
- Unbuilt ops pages show "Not ready." The full nav tree stays. She lands on Home.
- Maintenance starts off. When on, the public site including `/login` shows a branded page with the existing phone and email. The ops host still opens.
- Logout-all is on the ops nav, asks to confirm, ends both hosts, and lands on the ops sign-in page. Ops Sign out asks to confirm and ends that host only.
- Auth data is cloud Supabase. One project. No storage. One numbered owner step, then wait. Not local Docker.
- Do not deploy to Vercel. Do not create a Worker or DNS until he gates it.
- Corners stay square. No radio controls. No WhatsApp button on `/design`.
- Roadmap success criteria 1 and 2, and REQUIREMENTS.md AUTH-02 / AUTH-05 / OPS-01 sentences that still say password or `/ops`, are superseded by CONTEXT.md.

### Discretion
See CONTEXT.md "Claude's Discretion". Do not reopen those.

### Deferred
Email template editing, reminders, confirmation settings, guest profile edits, password, catalog, bookings, checkout, ops CMS. Owner name stays empty.

## Project Constraints (from HERMES.md)

- Workspace is this repo only. Refuse other client sites.
- Never push `main`. Branch, PR, CI.
- No secrets in the repo or client files.
- Cloudflare Worker/Pages and DNS are owner-gated. One numbered step, then wait.
- `vercel.json` is leftover. Do not deploy to Vercel.
- Contact stays `inquiries@almarprivatejourney.com` and `+971 56 388 3302`.
- Display name in email is `ALMAR Private Journey`, not "Journeys".

## Summary

Phase 2 cannot ship on the current static Cloudflare asset worker. Auth, settings, host isolation, and branded email need a server. The marketing pages stay the Framer HTML. New behavior is a server plus a header island, not a restyle and not a password system.

## Standard Stack

| Need | Use | Do not use |
|------|-----|------------|
| Auth and data | `@supabase/supabase-js` and `@supabase/ssr` on one cloud project | Local Docker, a second project, Supabase Storage, password auth |
| Branded email | Resend, custom SMTP into Supabase, from `inquiries@almarprivatejourney.com` | Supabase's default mailer as the guest-facing sender |
| Browser proof | WICG Email Verification token when the browser adds one. Magic link when it does not | A typed OTP. A code field |
| Locale and currency | Cookie plus user metadata. Same URL | `next-intl` path prefixes, `/en` `/ar` `/es` |
| Host | Existing Worker `almar` for the marketing host. Ops host is a route on that account, added only when he gates DNS | `/ops` on the marketing host, `almar.pages.dev` |
| Prices | Server-fetched rate, cached, applied to the six literals in `app/route.ts` | A typed rate, a guest-facing "rate unavailable" state |

Package versions were not pinned in this session. The planner must pin from the registry and must not invent versions. `[CITED: supabase.com/docs]` `[CITED: resend.com/blog/email-verification-api]`

## Architecture Patterns

### System Architecture Diagram

```
Guest browser
  |  same URL, cookie lang/currency
  v
Marketing host (almarprivatejourney.com)
  |-- Framer HTML pages (existing)
  |-- header island: currency, language, SIGN IN / signed-in items
  |-- /login tabs --> browser token? --yes--> session
  |                         |
  |                         no
  |                         v
  |                    Resend magic link --> /auth/confirm on THIS host
  v
Ops host (dashboard.almarprivatejourney.com)   [DNS owner-gated]
  |-- logged out: split sign-in, title "Sign in", no public "dashboard" word
  |-- guest email rejected, field kept
  |-- owner session --> Home "Not ready." + full nav + Settings
  v
Supabase Auth + Postgres (one project, no storage)
```

### Recommended Project Structure

```
app/
  login/                 # public tabs; not the Framer string
  auth/confirm/          # PKCE token_hash exchange, host-scoped
  account/               # empty Bookings / Account lines
  ops/                   # served only on the dashboard host
lib/
  supabase/              # server and browser clients
  i18n/                  # EN/AR/ES strings, no URL prefix
  fx/                    # fetch, cache, convert
  email/                 # Resend send + template constants
```

Do not put ops routes on the marketing host under `/ops`.

### Pattern 1: Magic link, no auto-create on Sign in

**What:** `signInWithOtp` with `shouldCreateUser: false` on Sign in. Create account is a separate call that may create the user, after the owner-email reject.
**When to use:** Every sign-in, including the owner, on both hosts.
**Example:**

```typescript
// Source: https://supabase.com/docs/guides/auth/auth-email-passwordless
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: `${origin}/auth/confirm`,
  },
})
```

`emailRedirectTo` must be on the Supabase redirect allow-list, and must be the host she asked on. `[CITED: supabase.com/docs/guides/auth/auth-email-passwordless]`

PKCE confirm:

```typescript
// Source: same page, PKCE section
await supabase.auth.verifyOtp({ token_hash, type: "email" })
```

### Pattern 2: Browser proof is progressive

**What:** Email input `type="email"` `autocomplete="email"`, plus a hidden input `autocomplete="email-verification-token"` with a session-bound nonce. If the browser fills the token, verify it and create the session. If not, send the magic link.
**When to use:** Sign in and Create account, both hosts.
**Why not the only path:** As of 25 August 2026 the API is a proposal. Chrome origin trial. Gmail only. `[CITED: https://resend.com/blog/email-verification-api]`

Verify with `verifyEmailToken({ email, token, audience, nonce })` from `email-verification-api` only after a legitimacy check. Do not hand-roll the signature check. If the package fails that check, the magic-link fallback still ships, and browser proof waits. `[CITED: https://resend.com/blog/email-verification-api]`

### Pattern 3: Host isolation

**What:** The ops UI is selected by the `Host` header, not by a public path. Marketing HTML is never the response on the ops host. A guest session on the marketing host does not authorize the ops host.
**When to use:** Every request to `dashboard.almarprivatejourney.com`.

### Anti-Patterns to Avoid

- **Password or `/ops`:** Superseded. Do not implement REQUIREMENTS.md sentences that still say them.
- **Auto-create on Sign in:** `shouldCreateUser` defaults to true. An unknown email would become an account and skip the Create account transfer. Set it false on Sign in.
- **One magic link for both hosts:** The link must return to the host she requested.
- **Saying dashboard on the public site, in public email, or on the logged-out ops page.**
- **Restyling the live header to `/design`.**
- **Inventing a 15-minute or 24-hour link TTL.**
- **Serving auth from the static `./out` asset worker alone.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic link | Custom token table | Supabase `signInWithOtp` + `verifyOtp` | One-time links, redirect allow-list, rate limit |
| Email verification crypto | Custom JWT parser | `email-verification-api` after legitimacy check, else the link | DNS and signature checks |
| Session cookies | `localStorage` access token | `@supabase/ssr` cookie helpers | XSS and host scoping |
| Password hashing | Anything | Nothing this phase | Locked out |
| FX math | A rate she types | A fetched rate, cached | She can see it and cannot type it |
| Translations | A URL prefix library | A string map on the same URL | Locked: no `/en` |

**Key insight:** The risky work is host isolation and not auto-creating users, not the mailer.

## Common Pitfalls

### Pitfall 1: Static asset worker cannot set an auth session
**What goes wrong:** `/login` is another HTML file in `out/`. The magic link cannot create a server session.
**Why it happens:** `wrangler.toml` serves `./out`. `package.json` `host:cloudflare` runs `scripts/assemble-cloudflare.mjs && wrangler deploy`. No `@opennextjs/cloudflare`. `[VERIFIED: wrangler.toml, package.json]`
**How to avoid:** Plan a server runtime for auth and settings. Do not create the Worker or the ops DNS. Leave that as one numbered owner step.
**Warning signs:** A plan whose only deploy path is `host:cloudflare` as it exists today.

### Pitfall 2: Sign in creates the user
**What goes wrong:** Unknown email gets an account. The transfer to Create account never happens. A guest email might exist on the ops host.
**Why it happens:** `shouldCreateUser` defaults to true. `[CITED: supabase.com/docs/guides/auth/auth-email-passwordless]`
**How to avoid:** `false` on both Sign in forms. Create account is the only create path, and it rejects the owner email first.
**Warning signs:** A successful `signInWithOtp` for an address that is not in `auth.users`.

### Pitfall 3: Default session is not 30 days
**What goes wrong:** She stays signed in until she signs out, or she is signed out at the JWT hour.
**Why it happens:** Sessions last until sign-out unless a time-box or inactivity timeout is set. Access tokens are short-lived and refresh. `[CITED: https://supabase.com/docs/guides/auth/sessions]`
**How to avoid:** Set a 30-day time-box in Auth settings when the project is created. Do not invent a custom refresh cookie.
**Warning signs:** No time-box in the owner setup step.

### Pitfall 4: The word dashboard leaks
**What goes wrong:** A nav label, title, confirm email, or error string names the ops host.
**Why it happens:** REQUIREMENTS.md and the old roadmap still say dashboard and `/ops`.
**How to avoid:** Public copy uses touchword / TOUCHWORD. Logged-out ops title is Sign in. Public email does not say dashboard. Ops sign-in email may.
**Warning signs:** A translation of touchword. A public link labeled Dashboard.

### Pitfall 5: Resend countdown invented
**What goes wrong:** A hardcoded 60-second timer that does not match the error Supabase returns.
**Why it happens:** The docs default is one request every 60 seconds. That default can change. `[CITED: supabase.com/docs/guides/auth/auth-email-passwordless]`
**How to avoid:** Drive the countdown from the error's wait, and treat 60 seconds as the documented default, not a product constant she can edit.
**Warning signs:** A constant `COUNTDOWN = 60` with no read of the auth error.

## Code Examples

### Send again too soon

Do not invent the wait. If Supabase returns a rate-limit error, show a countdown until the next request is allowed. The documented default interval is 60 seconds. `[CITED: supabase.com/docs/guides/auth/auth-email-passwordless]`

### Browser token field

```html
<!-- Source: https://resend.com/blog/email-verification-api -->
<input id="email" name="email" type="email" autocomplete="email">
<input type="hidden" name="token" nonce="{session nonce}" autocomplete="email-verification-token">
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Password + eye, `/ops` | Magic link, ops host | This discussion, 2026-09-25 | Do not implement the roadmap sentences |
| Implicit magic link | PKCE `token_hash` confirm route | Current Supabase docs | Confirm route exchanges the hash |
| Inbox-only verify | Browser token when present, link otherwise | Resend post, 25 August 2026 | Progressive only |

**Deprecated/outdated:**
- Optional password in AUTH-02 and email+password in AUTH-05. Replaced by CONTEXT.md.
- Logged-out `/ops` in OPS-01. Replaced by the dashboard host, still owner-gated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@supabase/ssr` is the right cookie helper for Next.js 14.2.35 | Standard Stack | Planner pins the wrong helper and sessions do not stick |
| A2 | A server runtime can be added beside the static asset worker without a new project name | Architecture | Owner gate is a new Worker, not a route on `almar` |
| A3 | `email-verification-api` is the package to verify the browser token | Pattern 2 | Package is unofficial; legitimacy check may reject it |
| A4 | FX source can be chosen at plan time | Standard Stack | A dead feed violates "make it convert" |

**Not assumed:** Magic-link default expiry is 1 hour and the default resend gap is 60 seconds. Those are cited defaults. Do not encode them as product settings. Do not set a custom expiry.

## Open Questions (RESOLVED)

1. **Which server runtime on the existing Worker** — RESOLVED. Plan 02-08 specifies `@opennextjs/cloudflare` on Worker `almar` only after the Plan 02-01 human gate. Plan 02-07 applies it. No second Worker. No deploy from the agent.
2. **FX feed** — RESOLVED. Plan 02-10 fetches `https://latest.currency-api.pages.dev/v1/currencies/usd.json`. `$` is USD. Written AED stays AED. No guest-facing error.
3. **Translating the Framer HTML string** — RESOLVED. Plan 02-09 applies a same-URL string map, including alt text, on every Framer GET.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node test + Playwright | Phase tests | ✓ | Playwright 1.63.0 | — |
| `@supabase/supabase-js` | Auth | ✗ | not installed | Owner creates the project |
| Resend | Branded mail | ✗ | not installed | Magic link cannot be branded until the domain is gated |
| Ops DNS | Open the host | ✗ | not in `wrangler.toml` | Code can be built; do not invent the live host |
| `ctx7` | Doc lookup | ✗ | not on PATH | Official URLs used instead |
| Knowledge graph | Research | ✗ | no `.planning/graphs/graph.json` | Repo reads |

**Missing dependencies with no fallback:**
- Cloud Supabase project. Owner step. Do not create it in planning.
- Resend domain for `inquiries@almarprivatejourney.com`. Owner step when email is built.

**Missing dependencies with fallback:**
- Browser email verification. Magic link is the locked fallback.
- Ops DNS. Build the host gate. Do not attach DNS.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node --test` plus Playwright 1.63.0 |
| Config file | `playwright.config.ts` (port 3010) |
| Quick run command | `node --test tests/design-tokens.test.mjs` |
| Full suite command | `npm run test` |

`[VERIFIED: package.json, playwright.config.ts]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | Inactive until confirm; magic link; no password field | unit + e2e | `node --test tests/auth-magic-link.test.mjs` | ❌ Wave 0 |
| AUTH-05 | Owner seed email; 30-day time-box noted; logout-all | unit | `node --test tests/auth-owner.test.mjs` | ❌ Wave 0 |
| AUTH-06 | Guest email rejected; marketing HTML not served on ops host | unit | `node --test tests/host-gate.test.mjs` | ❌ Wave 0 |
| AUTH-07 | Auth pages EN/AR/ES; Arabic `dir=rtl` | e2e | `npx playwright test tests/auth-i18n.spec.ts` | ❌ Wave 0 |
| I18N-01 | Same URL; cookie; default EN | unit | `node --test tests/locale.test.mjs` | ❌ Wave 0 |
| I18N-02 | Currency convert; URL unchanged | unit | `node --test tests/fx.test.mjs` | ❌ Wave 0 |
| I18N-03 | Dates DD/MM/YYYY, Monday, Western numerals | unit | `node --test tests/format.test.mjs` | ❌ Wave 0 |
| OPS-01 | Ops host gate; no public dashboard word | unit | `node --test tests/host-gate.test.mjs` | ❌ Wave 0 |
| PLAT-01 | One client; no storage API used | unit | `node --test tests/supabase-client.test.mjs` | ❌ Wave 0 |
| PLAT-02 | Secrets not in client bundle | unit | `node --test tests/secrets.test.mjs` | ❌ Wave 0 |
| PLAT-04 | No Vercel deploy path in the phase scripts | unit | `node --test tests/host-config.test.mjs` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/design-tokens.test.mjs`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run test` green before verify-work

### Wave 0 Gaps

- [ ] `tests/auth-magic-link.test.mjs` — AUTH-02
- [ ] `tests/auth-owner.test.mjs` — AUTH-05
- [ ] `tests/host-gate.test.mjs` — AUTH-06, OPS-01
- [ ] `tests/auth-i18n.spec.ts` — AUTH-07
- [ ] `tests/locale.test.mjs` — I18N-01
- [ ] `tests/fx.test.mjs` — I18N-02
- [ ] `tests/format.test.mjs` — I18N-03
- [ ] `tests/supabase-client.test.mjs` — PLAT-01
- [ ] `tests/secrets.test.mjs` — PLAT-02
- [ ] `tests/host-config.test.mjs` — PLAT-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase magic link. No password |
| V3 Session Management | yes | `@supabase/ssr` cookies. 30-day time-box in Auth settings |
| V4 Access Control | yes | Host check. Guest email cannot open the ops host. RLS |
| V5 Input Validation | yes | Email, name letters, phone digits-plus, VAT two decimals |
| V6 Cryptography | yes | Supabase and `email-verification-api`. Do not hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auto-create on unknown email | Elevation | `shouldCreateUser: false` on Sign in |
| Magic link used on the wrong host | Spoofing | `emailRedirectTo` is the requesting origin, allow-listed |
| Open redirect on confirm | Spoofing | Allow-list only. No user-supplied redirect |
| Guest session reused on ops host | Elevation | Host gate. Reject guest email |
| Service role key in the client | Information disclosure | Server only. Test that the bundle does not contain it |
| Dashboard word in public HTML | Information disclosure | Copy rule. Test the public render |
| XSS via Framer HTML plus new island | Tampering | No `dangerouslySetInnerHTML` for user input. Settings text is escaped |

## Sources

### Primary (HIGH confidence)

- https://supabase.com/docs/guides/auth/auth-email-passwordless — magic link, `shouldCreateUser`, PKCE `verifyOtp`, default 60-second gap, default 1-hour expiry
- https://supabase.com/docs/guides/auth/sessions — session lasts until sign-out unless time-box is set
- https://resend.com/blog/email-verification-api — browser token, proposal stage, 25 August 2026, Chrome origin trial, Gmail only
- `wrangler.toml`, `package.json`, `playwright.config.ts` — current host and tests

### Secondary (MEDIUM confidence)

- CONTEXT.md locked decisions — product rules, not library facts

### Tertiary (LOW confidence)

- None used as a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for Supabase magic link and the static-host constraint. MEDIUM for the SSR package name.
- Architecture: HIGH that a static `./out` worker cannot own the session. MEDIUM on which Worker change the owner gate is.
- Pitfalls: HIGH for auto-create, session default, and the dashboard-word leak.

**Research date:** 2026-09-25
**Valid until:** 2026-10-25

## RESEARCH COMPLETE
