---
phase: 02-platform-spine
verified: 2026-10-21
status: gaps_found
score: 11/15 must-haves verified (4 roadmap success criteria + 11 requirement IDs)
code_base: origin/main dc7edae1; PR #24 items re-checked on 3d6caf5a (2026-10-21)
overrides_applied: 0
gaps:
  - truth: "SC1 / AUTH-02: guest can reach sign-in from the public site"
    status: failed
    reason: "Public header renders no Login control. 03.3 held control #3 'Nav Login' says it returns in Phase 2; PublicFrame hard-codes login:false. Live home has 0 links to /login."
    artifacts:
      - path: "components/site/public-frame.tsx"
        issue: "line 127 `login: false` on every public page"
      - path: ".planning/phases/03.3-public-site-in-react/03.3-01-DESIGN.md"
        issue: "4.3 row 3: Nav Login 'Returns in Phase 2'"
    missing:
      - "Owner pick (picture first): static SIGN IN link on prerendered pages vs session-aware menu; then wire SiteNav login + deploy almar"
    size: LARGE
  - truth: "SC2 / AUTH-05: 30-day owner (and guest, D-02) session"
    status: failed
    reason: "No time-box anywhere: supabase/config.toml:280-284 [auth.sessions] commented out; cookie maxAge is the library default 400 days (lib/supabase/cookie-options.ts:8). 02-01-SUMMARY:90 owner deferred it until Supabase Pro; no later phase in ROADMAP carries it."
    artifacts:
      - path: "supabase/config.toml"
        issue: "timebox unset"
    missing:
      - "Owner decision: Supabase Pro + Auth > Sessions time-box 30 days (live change, money), or rewrite AUTH-05/D-02"
    size: LARGE
  - truth: "SC1/SC2 + AUTH-02/AUTH-05 wording: optional guest password with eye; owner email+password; owner = maria only"
    status: failed
    reason: "Code follows owner decisions D-07 (no guest password), D-33 (owner magic link only) and PR #20 77f8d516 (second owner koussayzayeni@gmail.com, lib/auth/rules.ts:10). ROADMAP.md:72-73 and REQUIREMENTS.md:90,93 still say password/eye, email+password, maria only."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "lines 72-73 (SC1, SC2), line 75 (SC4 'Same URLs')"
      - path: ".planning/REQUIREMENTS.md"
        issue: "lines 90 (AUTH-02), 93 (AUTH-05)"
    missing:
      - "Rewrite the lines to the decided behaviour, or add overrides (template below)"
    size: SMALL
  - truth: "Standing rule: password eye on the physical right, also in Arabic/RTL"
    status: closed_by_job_18
    closed: "Position fixed in job 18 (gsd/phase-02-close): ltr:inset-e-1 rtl:inset-s-1 and ltr:pe-12 rtl:ps-12 (token rules forbid right-*/pr-*); pinned by tests/password-eye.test.mjs (bites against main's field.tsx). Labels stay English: the only user is the dashboard, which is English only (owner 2026-10-14); a guest password field gets AR/ES labels when one is designed."
    reason: "Kit PasswordControl puts the eye at the logical end (left in RTL) and its labels are English only. Not a Phase 2 screen (Phase 2 has no password field, D-07/D-24), but it is the component any later password field uses; today used by the dashboard stay Access card."
    artifacts:
      - path: "components/ui/field.tsx"
        issue: "line 163 `pe-12`, line 172 `inset-e-1`, line 174 English aria-label"
    missing:
      - "Physical right (`right-1`, `pr-12`) and EN/AR/ES labels"
    size: SMALL
deferred: []
---

# Phase 2: Platform spine — Verification Report

**Phase goal:** Guest and owner can authenticate; public and ops are isolated; language and currency persist on the same URLs.
**Verified:** 2026-10-21, against `origin/main` `dc7edae1` (worktree `inspiring-merkle-42b23d`). Live probes = last deploy, which may be older than `main`.
**Status:** gaps_found
**Re-verification:** No, initial.

Wording drift: ROADMAP SC4 (ROADMAP.md:75) and the goal line still say "same URLs"; I18N-01 (REQUIREMENTS.md:99) was rewritten 2026-10-02 to per-locale URLs. Judged against I18N-01.

## Verdict table

| # | Must-have | Evidence | Verdict |
|---|---|---|---|
| SC1 | Guest inactive until branded confirm email, then magic link + optional password (eye) | Profile row only when `email_confirmed_at` is set: `supabase/migrations/20260925120000_platform_spine.sql:62-93` (insert + confirm triggers). Link flow `lib/auth/send-link.ts:39-92` (confirm vs sign-in kind, limits, ops refuses non-owner). Branded email `lib/email/magic-link.ts:80-98`, sender `lib/auth/magic-link-server.ts:24` ("ALMAR Private Journey <inquiries@…>"). `node --test tests/auth-magic-link.test.mjs` 17/17 pass. Landed `01d9304f`. Password + eye not built (D-07, D-24). No Login in public header (gap 1). | GAP (password text SMALL; nav Login LARGE) |
| SC2 | Owner signs in; 30-day session; logout-all; logged-out ops = sign-in | Owner sign-in is magic link only (D-33). Logout-all: `app/dashboard/actions.ts:35-38` `signOut({ scope: "global" })`. Logged-out: `app/dashboard/(ops)/layout.tsx:46` redirect `/sign-in`; live `https://dashboard.almarprivatejourney.com/` 200, `<title>Sign in</title>`. 30-day time-box absent (gap 2). | GAP (30-day LARGE; email+password text SMALL) |
| SC3 | Guest on ops / ops APIs denied; dashboard host serves no marketing | Every `app/api/ops/*/route.ts` (14) built through `lib/ops/route.ts` → `requireOwner` (`lib/auth/require-owner.ts:21-33`, ops shell + owner role + owner email). Ops Worker wall `worker/almar-ops.mjs:47-51`. Marketing host 404s `/dashboard`, `/ops` (`app/dashboard/page.tsx:21`, middleware). Tests: `require-owner.test.mjs` 10/10, `host-gate.test.mjs` 20/20. Live: dashboard `/api/ops/settings` 403, `/api/ops/stays` 403, `/about` 404, `/destinations` 404; public `/api/ops/settings` 404, `/ops` 404, `/dashboard` 404; dashboard `/login` 308 → `/sign-in`. Re-checked on `main` `3d6caf5a` (PR #24 landed, 2026-10-21): `/login` is out of the spec's MISSES (`tests/build/ops-runtime.spec.ts:69`), tests 4b (GET/HEAD 308 to `/sign-in`, query kept) and 5b (POST/PUT a miss) added; `worker/almar-ops.mjs:51-53` redirects GET and HEAD only, relative Location, no-store. `node --test tests/ops-runtime.test.mjs tests/phase-03-guest.test.mjs` pass (with password-eye: 57/0). Landing lane check-p24 ran the ops Worker specs (Part A 23/0, Part B 10/0). Live `almar-ops` still the pre-#24 build until the next deploy (every method 308). | PASS |
| SC4 | EN/AR/ES; header language + currency; AR rtl; DD/MM/YYYY, Monday, Western numerals | Per-locale trees `app/ar/*`, `app/es/*`; `components/site/locale-document.tsx:27-33` sets lang/dir from the route segment. Live `/ar/` → `<html lang="ar" dir="rtl">`, `/es/` → `lang="es" dir="ltr"`, no Arabic-Indic digits on `/ar/`. Dates `lib/format.ts:21-25`; Monday `components/journey/date-range-panel.tsx:26-27,120-122`; `nu-latn` in `lib/format.ts:1`, `lib/journey-format.ts:25`, `lib/fx/rates.ts:1`. `format.test.mjs` 4/4. Wording "same URLs" is stale (SMALL doc). | PASS (vs I18N-01) |
| AUTH-02 | Guest inactive until branded confirm; magic link + optional password (eye) | As SC1. | GAP |
| AUTH-05 | Owner maria, email + password, 30-day, logout-all | Logout-all PASS (above). Owner list now `["maria@…", "koussayzayeni@gmail.com"]` `lib/auth/rules.ts:10` and migration `20261019120000_owner_emails.sql:18` (PR #20, `77f8d516`); no decision file in `.planning/decisions/`. Password not used (D-33). 30-day missing. | GAP |
| AUTH-06 | Guests zero dashboard access; logged-out dashboard is ops sign-in | Ops sign-in refuses non-owner before any call (`lib/auth/send-link.ts:54`, "This email cannot be used here." `lib/copy/guest.ts`); signed-in guest redirected `app/dashboard/(ops)/layout.tsx:46`; APIs 403. Live sign-in page on dashboard root. | PASS |
| AUTH-07 | Auth pages branded, EN/AR/ES, RTL | Copy in three languages `lib/copy/guest.ts` (en ~l.95, ar ~l.170, es ~l.245). Live `/login` with `almar-locale=ar` cookie renders Arabic and inner `dir="rtl"`; `tests/auth-i18n.spec.ts` exists. Warning: served `<html>` stays `lang="en" dir="ltr"` until `setDocumentLocale` runs after hydration (`app/login/sign-in-screen.tsx:38`). | PASS (warning) |
| I18N-01 | EN root, AR/ES at `/ar/…`, `/es/…`, lang/dir in served HTML, preference remembered | Live probes above; switcher sets `almar-locale` cookie 1 year and navigates (`components/ui/locale-select.tsx:82,88`). Auth/account pages are cookie-locale, not `/ar/` URLs (`/ar/login` 404 live). | PASS (warning on auth pages) |
| I18N-02 | Language + currency in header; language switch keeps currency | Currency one localStorage key `almar-currency` (`lib/currency-choice.ts:12`), survives the language navigation; `home-choice.test.mjs` 7/7. Currency select rendered only on pages with an amount (home, account) — owner-signed 03.3 option A (`03.3-01-DESIGN.md:1020,1482`), superseding D-55. Live home has the currency select, `العربية`/`Español` links. 02-09/02-10 superseded (`4be0541f`). | PASS |
| I18N-03 | DD/MM/YYYY, Monday, Western numerals in AR | As SC4. | PASS |
| OPS-01 | Ops on `dashboard.almarprivatejourney.com`, no public link | DNS live (probes above); live public home has no `dashboard.` or `/ops` link. `wrangler.ops.toml`, `worker/almar-ops.mjs`. | PASS |
| PLAT-01 | One Supabase project, data + auth, no storage | No Supabase storage call in `app lib components worker scripts`; `supabase/config.toml:121-122` storage disabled locally; migration header "No storage schema, no bucket". Media on R2. Live bucket list not read (human). | PASS |
| PLAT-02 | Cloudflare hosts; no Vercel | `wrangler.toml:2,10-11` account `f1d9a1fa…`, `main = worker/almar.mjs`, `workers_dev = false`; no `vercel.json`, no `vercel` in `package.json`; live `server: cloudflare`. | PASS |
| PLAT-04 | Owner auto-confirm; guest confirm required | Owner made in the Supabase dashboard (02-01, D-41), never by a link: `lib/auth/send-link.ts:65-67`. Guest profile only after the link click (trigger above). | PASS |

Score: 11/15.

## Owner question: sign-ups disabled vs "New here?"

- Text: `lib/copy/guest.ts:110` (EN "New here? Your account is created the first time you use the link."), `:187` (AR), `:264` (ES) on `main` `3d6caf5a`; rendered at `app/login/sign-in-screen.tsx:142` (public `/login` only; ops variant omits it, l.14). Live on `https://almarprivatejourney.com/login`.
- "Sign-ups disabled" is the Supabase setting (`supabase/config.toml:183,229` `enable_signup = false`). Accounts are still made: admin `generateLink({type:"magiclink"})` creates the user for an unknown email and ignores that setting (`02-JOB02-DECISIONS.md:15-18`, `lib/auth/magic-link-server.ts:101`). So the line is true to what the code does.
- Conflict: AUTH-02 / PLAT-04 / D-01 / D-142 require public guest sign-up. If the owner wants no public sign-ups, that reverses AUTH-02 and D-01 (owner decision, LARGE); if he keeps sign-up, the line stays and the "sign-ups off" setting is only a guard against direct API sign-ups. Either way, his pick.

## Gaps

1. **LARGE — no Login in the public header.** `components/site/public-frame.tsx:127` (`login: false`); held control #3 in `.planning/phases/03.3-public-site-in-react/03.3-01-DESIGN.md` §4.3 returns "in Phase 2". Needs a picture and his pick (static SIGN IN vs session-aware), then an `almar` deploy.
2. **LARGE — 30-day session not set.** `supabase/config.toml:280-284`; deferred "until Pro" in `02-01-SUMMARY.md:90,110`; no later phase carries it. Needs his money decision (Supabase Pro) or a rewritten AUTH-05/D-02.
3. **SMALL — requirement and roadmap text drift.** `.planning/ROADMAP.md:72` (SC1 password + eye), `:73` (SC2 email+password, maria only, "`/ops`"), `:75` and goal line (SC4 "same URLs"); `.planning/REQUIREMENTS.md:90` (AUTH-02), `:93` (AUTH-05). Rewrite to D-07, D-33, D-04, PR #20 and I18N-01, or add overrides. Also record the second owner email as a decision in `.planning/decisions/`.
4. **SMALL — password eye not physical right in RTL, labels English only.** `components/ui/field.tsx:163,172,174`. Not a Phase 2 screen; standing rule (Clickit 2026-10-21) applies to every product. **CLOSED in job 18** (position; see frontmatter). Labels left English: dashboard-only component today.
5. **SMALL (warning) — auth pages' served `<html>` is `lang="en" dir="ltr"` for AR until hydration.** `components/site/locale-document.tsx:27-33` reads only the route segment; `/login`, `/account`, `/bookings` set it client-side (`app/login/sign-in-screen.tsx:38`). Inner container is `dir="rtl"` on first paint.
6. **Resolved by PR #24, landed `3d6caf5a` (2026-10-21), re-checked in code:** the stale `/login` miss is gone from `tests/build/ops-runtime.spec.ts` (4b/5b added); GET/HEAD-only `/login` 308 at `worker/almar-ops.mjs:51-53`; sign-in form option A in `app/login/sign-in-screen.tsx:104-135` (kicker, gold rule, link note). Not deployed yet: live `almar` and `almar-ops` show it only after the controller's deploy (UAT 6, 8). Score unchanged (SC3 was already PASS; nothing PR #24 carries was counted as met).

Suggested override form for gap 3 (only on his word):

```yaml
overrides:
  - must_have: "Guest account ... then magic link + optional password (eye)"
    reason: "D-07: no guest password; every sign-in is a magic link"
    accepted_by: "Koss"
    accepted_at: "<ISO time>"
```

## Human verification needed

1. Live guest sign-up: on `https://almarprivatejourney.com/login` enter a new address → branded email from "ALMAR Private Journey" in the page language → Continue page → signed in; account row appears only after the click. (Needs `RESEND_API_KEY` on Worker `almar`; STATE.md:80 said it was waiting.)
2. Owner sign-in on `https://dashboard.almarprivatejourney.com/sign-in` with maria@ → dashboard; Logout-all confirm → both hosts signed out.
3. Signed-in guest opens `https://dashboard.almarprivatejourney.com/` → sign-in page, not the dashboard.
4. `/login` in Arabic at 390 px: whole page right-to-left on first paint (no flash of LTR).
5. Home: pick EUR, switch to العربية → `/ar/` still shows EUR prices.
6. Supabase project `jkdkaldgeiowkhlfmsft`: Storage has 0 buckets (read-only check).
7. Phase 2 owner UAT is still open (ROADMAP.md:77).

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier), read-only; live GET probes only_
