# Phase 2: Platform spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 2-platform-spine
**Areas discussed:** Guest sign-up, ops host, language and currency, confirm email, /login, live header, dashboard

---

## Guest sign-up

| Option | Description | Selected |
|--------|-------------|----------|
| Magic link only | No password. Every sign-in is a magic link. | ✓ |
| Optional password | Skip-able set password after confirm. | |

**User's choice:** "Let's do this without a password. Every time anyone needs to sign in, he needs to access with a magic link"
**Notes:** Confirm link still activates the account and signs her in.

## Ops host

| Option | Description | Selected |
|--------|-------------|----------|
| dashboard.almarprivatejourney.com | Gated this phase so it can be opened. | ✓ |
| /ops on the marketing host | Logged-out ops sign-in on the public site. | |

**User's choice:** "we will do it now so we can open it we will get it gates and teh fashbaord will not be https://almarprivatejourney.com/ops it will be https://dashboard.almarprivatejourney.com"
**Notes:** Same owner email can sign in on the public site and open the ops host.

## Language

| Option | Description | Selected |
|--------|-------------|----------|
| Every component, line, text, section, page, and alt text | English, Arabic, and Spanish from the start. | ✓ |
| Header only | Body stays English until Phase 6. | |

**User's choice:** "From the start each image, each component, each and every thing needs to be configured in those three languages"
**Notes:** Do not re-ask. Arabic is RTL. Images that contain text need three versions.

## /login

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs on top of the form | Clicking a tab changes the form. | ✓ |
| A link under the form | Switch modes with text under the form. | |

**User's choice:** "its a tab on top of the form i click on sign in button and the firm chnages and create account the form chnages as well"
**Notes:** Unknown email stays in the field and transfers to Create account. Name and last name are required. Phone is optional, digits and a plus. Check-your-email replaces the form on the same /login. Send again too soon shows a countdown.

## Live header

| Option | Description | Selected |
|--------|-------------|----------|
| Add language, currency, and SIGN IN | Keep the current links and logo until a settings logo is saved. | ✓ |
| Replace the header with /design | Ivory header and a different link set. | |

**User's choice:** Keep the live bar. Menu at 1200px, not 1440px.
**Notes:** "keep teh header will become menu when it reached 1200px not 1440 thats better"

## Dashboard word

| Option | Description | Selected |
|--------|-------------|----------|
| Do not mention dashboard to anyone | The public menu word is touchword, only on her account. | ✓ |
| A public Dashboard link | Guests can see the word. | |

**User's choice:** "no dont mention the dashbaird to anyone anyone anyone no one has to know about anywhere"
**Notes:** After she is in on that host, the word can appear in the nav and the browser title. The URL stays.

## Claude's Discretion

- Uppercase bar labels, including TOUCHWORD.
- touchword is not translated.
- Logged-out browser title stays Sign in.
- Dashboard Sign out lands on that host's sign-in page.
- Missing name line sits under that field.
- Sign out and Logout-all sit in the dashboard nav on every page.
- Public header cutoff is 1200px. Dashboard nav cutoff stays 1440px.

## Deferred Ideas

- Email templates, reminders, and confirmation settings. A later phase.
- Guest profile edits, password, ops CMS, catalog, bookings, checkout.
- Owner name stays empty until a later phase.
