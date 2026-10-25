# Phase 6: Site and rest of CMS - Context

**Gathered:** 2026-10-21, job 24 (`gsd/phase-6-plan`), from ROADMAP Phase 6, REQUIREMENTS, the landed 3.2 dashboard
and kit, 3.3 public pages, Phase 4/5 plans and `decisions/2026-10-21-owner-answers-after-landing.md`.
**Status:** SIGNED discuss. The owner answered all twelve questions (P6-Q1…Q12) with option A, 2026-10-21: in the
controller chat ("All 12 recommended (A) for Phase 6.") and confirmed in job 24's own question form ("Yes, all 12 A").
Record: `decisions/2026-10-21-phase-6-discuss.md`. Each F-decision below names its question.

<domain>
## Phase Boundary

The rest of the public site and the CMS behind it, on the code that landed through Phase 3.3 / 3.2 / job 21:

- Owner edits **pages** (sections shown/hidden, texts, photos, hero media), **header and footer links**, **blog
  posts**, **legal pages** and **packages** in the dashboard (`dashboard.almarprivatejourney.com`, Worker `almar-ops`);
  Publish rebuilds the public site (03.2 C-01…C-05, unchanged).
- Guests get **legal pages**, a **cookie banner**, **Plan with us**, **List with us**, a **consultation booking** on
  Contact, **package pages with a request**, **share** and **saved stays**.
- Ops types English only; Save fills AR/ES (03.2 decision 2026-10-14); a hand-fixed AR/ES text **locks** (I18N-04).

Already done before this phase (no work here, cited as evidence in the verification):
SITE-08 newsletter → Resend (`app/newsletter/route.ts`), SITE-12 honeypots (`lib/contact-inquiry.ts`, newsletter),
CMS-08 Team CMS (`content/team`), floating WhatsApp in `components/site/public-frame.tsx` (SITE-03 part),
Contact inquiry form (SITE-03 part), PLAT-03 (no Framer `route.ts` page left: verified again in 06-02).

Not in this phase: anything Phase 5 owns (bookings, customers, settings money); card payments (backlog);
**OPS-12 promo codes → v1.1 with PAY-05** (F-11, owner P6-Q11 = A).
</domain>

<decisions>
## Implementation Decisions

### Standing (carried, not re-asked)
- **F-00a:** Every public URL is `/<locale>/…` with `locale ∈ en, ar, es` (owner #13, job 21). New pages follow job
  21's helpers (`lib/locale-path.ts` and whatever job 21 adds); unprefixed URLs 301 to `/en/…`.
- **F-00b:** Writes go through owner-only `/api/ops/*` on `almar-ops` with `requireOwner()` (03.2 C-19). Public forms
  post to `/api/*` on `almar` (in `run_worker_first`), with the honeypot (SITE-12) and `lib/form-rate-limit.ts`.
- **F-00c:** Content tables keep one row per language beside a base row (03.2 C-09), `status` draft/published, read
  at build through published views with the anon key only (C-04). Editors use the kit full-page editor (`EditPage`,
  panel B), Save fills AR/ES, Publish rebuilds (C-01, C-03 status line).
- **F-00d:** Design before code: every plan starts with pictures (real tokens, 390/834/1440, EN/AR/ES, harness
  scenes) signed by the owner through the controller. Square corners, gold lines only, teal primary buttons, no
  radio controls, dashboard Spanish usted.
- **F-00e:** Never invent prices, legal text, people. Contact stays `inquiries@almarprivatejourney.com` /
  `+971 56 388 3302` (SITE-13), not editable.
- **F-00f (owner, 2026-10-21):** No test runs by work sessions. Plans still write their test files; the controller
  decides when they run. `tsc` and `tokens:check` allowed.

### Packages (CMS-03, BOOK-05, ADDN-03)
- **F-01 (owner, P6-Q1 = A):** A package is **requested, then priced by the owner**. Package page → "Request this
  journey" (dates, guests, cities, notes, name/email/phone) → saved as a Request (F-10) and emailed to inquiries@. The
  owner answers by email/WhatsApp; turning a request into a booking is the Phase 5 hand-made booking. No money on the
  package page; the card shows the owner's own price line (never computed, 03.2 C-15).
- **F-02 (owner, P6-Q2 = A):** Package fields: name, price line, tagline, description, photo, **legs** (destination,
  suggested stay optional, nights label), **included add-ons** (from the catalog, shown as included, cannot be
  removed: ADDN-03), show/hide, order; **the owner can add new packages** (slug locks once published, like stays).
  Multi-city only via packages (CMS-03). "Something else? Ask on WhatsApp" link on the package page (ADDN-03).
- **F-03:** Public: package cards stay in "Choose Your Journey" on home (SITE-02 order unchanged) and each card opens
  `/<locale>/journeys/<slug>`. Exact URL word confirmed on pictures.

### Consultation (SITE-06)
- **F-04 (owner, P6-Q3 = A):** Owner sets **weekly hours in Asia/Dubai** and **days off** (Dashboard → Content →
  Consultation, or Settings — planner picks, pictures decide). Slots are 30 minutes, shown in the guest's own time
  zone with "Dubai time" beside it; a booked slot is taken atomically (unique slot start, no overlap); minimum notice
  and booking horizon are settings with empty defaults the owner fills (no invented number: until filled, a 24 h
  notice and 30-day horizon are shown as **[bracketed]** placeholders in the plan and confirmed at signature).
  Guest and inquiries@ get an email with an `.ics`; the call is on WhatsApp. Guest cancel: by replying to the email
  (no self-service in v1).

### Cookies and analytics (SITE-07, SITE-11)
- **F-05 (owner, P6-Q4 = A):** Banner with **Necessary** (always on) and **Analytics** (off until accepted). Analytics =
  Cloudflare Web Analytics beacon, injected only after consent; choice stored in a first-party cookie, changeable from
  a footer "Cookie settings" link. Banner copy is CMS (Legal editor). No Marketing switch until a marketing tool exists.
  Enabling Web Analytics on the zone is an owner gate (one numbered step).
- **F-06:** `robots.txt` allows public paths and disallows the dashboard host, `/api/`, `/account`, `/bookings`;
  `sitemap.xml` lists every published public URL in all three locales with hreflang (job 21 may already ship part;
  06-04 completes and owns it). `_headers` gets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and
  `Permissions-Policy` (board item, Phase 6), keeping the Referrer rule job 02 learnt (no `no-referrer` on pages
  with server actions).

### Legal (SITE-09)
- **F-07 (owner, P6-Q5 = A):** Legal editor for **privacy, terms, booking terms, waiver, disclaimer** (rich blocks as in
  F-08). A page with no published text has **no route and no footer link**. Booking terms published flips Phase 4's
  `BOOKING_TERMS_IS_PLACEHOLDER` gate (`lib/booking/terms.ts`) to read the CMS text. Nothing drafted by us.

### Blog (SITE-10)
- **F-08 (owner, P6-Q6 = A):** Posts: title, slug (locks when published), cover photo, date, excerpt, **body blocks**
  (heading, paragraph, photo with alt, quote), show/hide, order by date. `/blog` gets a search box (client-side,
  current locale, title + text). No comments. Hide-all hides the home Stories section (already true in code). The
  three fixture posts are imported as they are (same text, same AR/ES).

### Pages (CMS-07, SITE-02)
- **F-09 (owner, P6-Q7 = A):** Home, About, Destinations, Experiences, Contact: each section has show/hide and its texts
  and photos editable; hero photo or video URL per page (https only, CMS-06). Section order fixed in code. The
  fixture blocks (03.2 C-21) move to tables; the public output is byte-for-byte the same right after import.

### Requests (SITE-04, SITE-05, F-01, F-04)
- **F-10 (owner, P6-Q10 = A):** **Plan with us** (destination, dates, guests, notes, budget, UAE airport; no pay) and
  **List with us** (name, email, phone, property type, city, message; footer link only, no partner login) are saved
  and emailed to inquiries@. Dashboard gets one **Requests** list (Plan, List, Package, Consultation) with filters and
  Handled / Not handled. Where Plan with us lives on the public site is decided on pictures (rec: its own page linked
  from the hero/home "Plan with us" and the Contact page).

### Navigation (CMS-09, SITE-01)
- **F-15 (owner, P6-Q8 = A):** Header and footer links editable: label (EN, AR/ES auto), link (internal page picker or
  https URL), show/hide, move up/down. **Login is always last and cannot be hidden**; currency and language stay.
  Header order default = job 21's (Destinations, Experiences, About, Contact, …, Login).

### Saved stays and share (BOOK-06, BOOK-07)
- **F-12 (owner, P6-Q9 = A):** Heart on stay cards and the stay page; signed out it opens sign-in and saves after return;
  Account gets "Saved stays". Table keyed by user id with RLS (own rows only).
- **F-13:** Share on the stay page: native share sheet where `navigator.share` exists, else Copy link + WhatsApp.
  Reuse `components/ui/copy-link.tsx`.

### Promo codes
- **F-11 (owner, P6-Q11 = A):** OPS-12 moves to v1.1 with PAY-05. No code box anywhere in v1.

### Translations (I18N-04)
- **F-14 (owner, P6-Q12 = A):** A text the owner edits by hand in AR or ES under "Edit translations" is stored as
  **locked** (per field, per language); Save skips locked fields when English changes; "Translate again" beside a
  locked field unlocks and re-fills it. Applies to every editor (catalog, team, packages, pages, blog, legal, nav).

### Claude's Discretion
- Table/column names, migration split, the Requests email template look (pictures still signed).
- Whether consultation hours sit under Content or Settings (Phase 5 owns Settings files: avoid them if possible).
</decisions>

<canonical_refs>
## Canonical References
- `.planning/ROADMAP.md` Phase 6; `.planning/REQUIREMENTS.md` (IDs above)
- `.planning/decisions/2026-10-21-owner-answers-after-landing.md`, `2026-10-14-auto-translate-and-panel-redesign.md`,
  `2026-10-17-team-packages-signature.md`, `2026-10-19-request-to-book-bank-transfer.md`
- `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-CONTEXT.md` C-01…C-23
- `.planning/phases/04-book-and-pay/04-CONTEXT.md` B-13 (booking terms), B-23…B-35
- `.planning/phases/05-ops-os/05-CONTEXT.md` (what Phase 5 owns)
- `.planning/prompts/21-*.md` (locale prefixes, cookie, Login link)
- Canvas boards: `DashContent`, `DashPosts`, `DashPackages`, `DashTeamLegal`, `PublicContact`, `PublicBlog`,
  `PublicBlogPost`, `PublicHome` (Packages, Blog and Pages boards are "Coming soon": new pictures needed)
- Code: `components/ops/*` (kit), `app/dashboard/(ops)/ops-shell.tsx` (nav), `content/*/page.tsx` (coming soon),
  `catalog/packages/*`, `supabase/migrations/20261005100000_catalog_and_team.sql` (`journey_tiers`), `lib/data/source.ts`
  (`BLOCK_FIXTURES`), `components/site/public-frame.tsx`, `components/pages/contact/inquiry-form.tsx`,
  `lib/contact-inquiry.ts`, `lib/form-rate-limit.ts`, `lib/booking/terms.ts`, `scripts/crawl-files.mjs`,
  `scripts/assemble-cloudflare.mjs`
</canonical_refs>

<deferred>
## Deferred
- OPS-12 promo codes with PAY-05 (v1.1) (owner, P6-Q11 = A).
- Guest self-service consultation cancel; Marketing cookies; package online payment (cards backlog).
</deferred>
