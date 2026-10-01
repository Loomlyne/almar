# ALMAR — the goal

Written 2026-10-01 by the control session from everything decided so far: `PROJECT.md`, `ROADMAP.md`,
`REQUIREMENTS.md`, the phase CONTEXT files, `CLAUDE.local.md` and `.planning/decisions/`.
If this page and a newer owner decision disagree, the decision wins and this page is corrected.

## The goal

A guest from the UAE or the Gulf books and pays a private Colombia journey on
almarprivatejourney.com, in English, Arabic or Spanish: one destination, a stay, add-ons,
airport meet and return, deposit or full payment. ALMAR's owner runs every booking, the
catalogue, the team and the public site from one branded dashboard. Every control that is shown
works through the screen, the server, the database, the dashboard and the public site. Nothing is
fake.

## Done means (milestone v1.0)

1. **One design system.** One `tokens.json`, Tailwind v4 only, the claude.ai canvas signed page by
   page, journey bar and booking components coded and matching it in EN, AR (RTL) and ES. (3.1)
2. **Sign-in and separation.** Guests confirm by a branded email, then magic link or password with
   the eye. The owner signs in to ops; guests never see ops. Same URLs in all three languages;
   language and currency in the header. (2)
3. **Real catalogue.** Ops publishes destinations, stays with nightly AED rates, experiences and
   services with images, the inclusions kit and the team. Data in Supabase, files on Cloudflare. (3.2)
4. **Booking path in React.** Home, private stays, stay detail, destinations, experiences and
   services on the same URLs, reading the catalogue. (3.3)
5. **Book and pay.** Hero, then `/booking/trip`: stay, add-ons, travellers, then a deposit or full
   payment in the branded Stripe Payment Element (TEST until a go-live plan). The guest gets
   `ALMAR-XXXXXX`, an email with a PDF, and a booking page. (4)
6. **Ops OS.** The owner runs bookings, customers, calendar, money, content and settings from
   `/ops`, later on `dashboard.almarprivatejourney.com`. (5)
7. **Framer gone.** The remaining pages are React, the Framer bridge is removed, the remaining CMS is
   live. (6)
8. **Live.** Each cut-over reaches almarprivatejourney.com on Worker `almar` only after the
   owner's go. Stripe takes real money only after a separate go-live plan he signs.

## Order (owner, 2026-09-28)

3.1 design system → Phase 2 plans 02-08, 02-02, 02-03, 02-04 (what 3.2 needs) → 3.2 catalogue and
team → 3.3 booking-path pages → 4 book and pay → 5 ops OS → 6 remaining pages, Framer removed.
Plans 02-09 and 02-10 stay paused: no more patching of Framer HTML.

## Where it stands, 2026-10-01 14:00 (+04)

- Phase 1 done. Phase 3: 13 of 13 plans have a summary (screens drawn, nothing connected).
- Phase 3.1: 28 of 29 plans done. Plan 29 is the owner's UAT (18 steps), then landing.
- Phase 2: 1 of 10 (02-01, the Supabase project). The app is not wired to it yet.
- Live today: the static Framer export. `/booking/trip`, `/account` and `/dashboard` are not live.
- The live state, the jobs in work and what waits for the owner: `.planning/CONTROL-BOARD.md`.

## Rules that do not bend

- Three languages on every string, alt text and page; Arabic is real RTL.
- Square corners. Gold is a line, never a fill, text or icon. No radio controls. Teal primary.
- Never invent a price, a rate, a person or legal text. Placeholders stay in brackets
  (`AED [AMOUNT]`, `ALMAR-000000`, `[Guest name]`) until the owner gives the real value.
- Contact stays `inquiries@almarprivatejourney.com` / `+971 56 388 3302`.
- Cloudflare hosts. Supabase holds data and auth, never files. Stripe TEST until go-live. Resend
  sends. No Vercel, no Figma.
- Secrets live in the owner's terminal only. Cloudflare, DNS, R2, Supabase settings, Stripe live and
  the Resend domain are his gates: one numbered step, then wait.
- The owner signs discuss, design, plan, UAT and every ship.

## Not in v1

Multi-city in the hero (packages and WhatsApp only), partner logins, gift cards, BNPL, split pay,
saved cards, Careem or Uber APIs, dark mode, `/en` `/ar` `/es` URL prefixes, fake reviews or team
members, comments on stories, Stripe live charges before the go-live plan, Vercel.

## How the work runs

One control session lands work and deploys. Work sessions build one job each, in their own
folder and branch, from a prompt file in `.planning/prompts/`. Skill `control-session`;
ALMAR's rules: `CLAUDE.local.md`, section "One job, one branch, one ship".
