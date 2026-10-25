# Phase 6 plans: hand-over (job 24)

**Branch:** `gsd/phase-6-plan`. Plans commit `c39f4cef`, merged with `origin/main` `0f8f6091` (job 21 landed) as `f66f8268`.
The hand-over commit follows. Written 2026-10-25 22:30 CET. Planning files only: no code, no migration file, no tests.

## What is here
- `06-CONTEXT.md`: discuss is **signed**. The owner chose A on all 12 questions, in the controller chat ("All 12
  recommended (A) for Phase 6.") and again in job 24's question form. The decisions are F-00a…F-15.
- `decisions/2026-10-21-phase-6-discuss.md`: the answer record. This job wrote it at the controller's request.
- Seven plans:

| Plan | Wave | Depends on | Covers |
|---|---|---|---|
| 06-01 Schema, data contracts, translation lock | 1 | none | I18N-04; every Phase 6 table, view and function in **one** migration; fixture import |
| 06-02 Pages + header/footer links | 2 | 06-01 | CMS-07, CMS-09, SITE-01, SITE-02, SITE-13, PLAT-03 |
| 06-03 Blog | 2 | 06-01 | SITE-10 |
| 06-04 Legal, cookie banner, analytics, robots/sitemap/headers | 3 | 06-01, 06-02 | SITE-07, SITE-09, SITE-11 |
| 06-05 Plan with us, List with us, consultation, dashboard Requests | 3 | 06-01, 06-02 | SITE-03, SITE-04, SITE-05, SITE-06, SITE-12 |
| 06-06 Packages v1, package page, request | 4 | 06-01, 06-02, 06-05 | CMS-03, BOOK-05, ADDN-03 |
| 06-07 Share, saved stays | 3 | 06-01, 06-02 | BOOK-06, BOOK-07 |

Already done before this phase (cited as evidence, not rebuilt): SITE-08 newsletter, SITE-12 on the existing forms,
CMS-08 Team, floating WhatsApp. OPS-12 promo codes move to v1.1 with PAY-05 (F-11).

Each plan opens with pictures (real tokens, 390/834/1440, EN/AR/ES), then the owner's signature, then code.

## Checks
- Plan check (gsd-plan-checker, Opus): first run **FAIL**, 3 blockers and 12 warnings. All 3 blockers and warnings
  4–10, 13 and 14 are fixed in `c39f4cef`. I checked the blocker fixes by grep. I did not run the checker again.
- `tsc`, `tokens:check`, node, build, Playwright: not run (owner: no test; and no code changed).

## The controller needs to do
1. **Migration number** for 06-01's single migration `<NUMBER>_site_cms.sql`. It now also carries
   `stay_is_published` and `booking_terms_current`, plus the slot names for the Experiences and Contact heroes.
2. **Shared-file slots**, listed per plan in each `files_modified`. The main collisions are `public-frame.tsx`,
   `footer.tsx`, the public page components and `ops-shell.tsx`. Waves 2, 3 and 4 order them.
3. **Owner gates**, one numbered step each, inside the plans:
   - 06-04: turn on Cloudflare Web Analytics and get the beacon token. The token is not secret and lives in
     `lib/analytics-config.ts`.
   - 06-05 and 06-06: `SUPABASE_SERVICE_ROLE_KEY` on Worker `almar`, only if it is missing. Pipe it, never print it,
     and have a different model check the step first.
   - Live migration apply.

## Proposed planning changes (controller applies)
- **ROADMAP Phase 6:**
  - Replace "Plans: TBD" with the seven plans above.
  - Criterion 4 drops "promo codes CMS works": OPS-12 → v1.1.
  - Criterion 1 says the page replacement is done (3.3).
- **REQUIREMENTS:**
  - OPS-12 → v1.1 (with PAY-05).
  - SITE-07 → "necessary + analytics; marketing when a tool exists" (F-05).
  - BOOK-05 → "package page → request, owner prices it" (F-01, replaces the `/booking/trip` wording).
  - SITE-08 also covers the List with us footer link (06-05).
- **Phase 4 (job 25 or a board item)** (checker W11): published booking terms only open the Phase 4 request
  checkbox if Phase 4 reads 06-04's `bookingTermsGate`. 06-04 names the two call sites. Without that edit,
  `BOOKING_TERMS_IS_PLACEHOLDER` stays the gate and fails closed.
- **06-02 picture signature** (checker W12): it asks whether page heroes are always shown (recommended, keeps the
  booking bar) or hideable. Record the answer as an F-09 amendment in `decisions/`.

## Not done / open
- Checker W15 (plan size, not changed): 06-01 has ~40 files and 06-04 ~55. The checker suggested splitting 06-04
  (legal + cookies / crawl + headers + booking terms) and moving 06-01's kit wiring into its own plan. Split at
  execute time if an executor stalls.
- `[bracketed]` numbers wait for the owner's signature: consultation notice [24 h], horizon [30 days] and consent
  cookie lifetime [180 days]. Until they are filled, the consultation calendar stays closed.
- The plans name job 21's paths from its branch. Job 21 is now on `main` (`0f8f6091`), and each plan's Task 1 base
  check re-reads them.

## Lessons
- The auto-mode classifier blocked recording a relayed owner answer as "signed". Confirming it in this session's own
  question form fixed it. A peer relay alone is not owner input.
- The first plan check caught a real RLS failure (`authenticated` has no select on `stays`) that unrun pgTAP would
  have let reach live. A plan check matters more when tests do not run.

GSD: `/gsd-execute-phase 6` fits next, wave by wave (wave 1 = 06-01 alone).
Jev: 06-05 Requests triage, scoring an incoming request's kind and urgency (advisory, logged), fits on the owner's
word. Automation: a daily unattended digest of unhandled Requests to inquiries@ (proposal only).
