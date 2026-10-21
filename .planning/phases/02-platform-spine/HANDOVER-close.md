# Hand-over: job 18, close Phase 2 (platform spine)

Work session job 18, 2026-10-21 (times from `date`, +0100). Branch `gsd/phase-02-close`, cut from `origin/main`
`dc7edae1`. Final commit: the one that adds this file (named in the controller message). Folder clean after it.

## What this job did
1. `02-09-SUMMARY.md` and `02-10-SUMMARY.md`: status superseded, by `4be0541f` (2026-10-11) and the owner's
   2026-10-02 I18N-01 rewrite and Phase 3.3 reshape; where I18N-01, I18N-02 and I18N-03 are met now. GSD now sees
   17/17 plans with a summary.
2. `02-VERIFICATION.md` (gsd-verifier, read-only on `dc7edae1`, plus plain GET probes of the three live hosts):
   **status gaps_found, 11/15 must-haves met.** SC3, SC4, AUTH-06, AUTH-07, I18N-01, I18N-02, I18N-03, OPS-01,
   PLAT-01, PLAT-02, PLAT-04 PASS. SC1/AUTH-02 and SC2/AUTH-05 GAP (below). PR #24 counted PENDING, not met.
3. Gap closed (code): the kit password field's show/hide eye now sits on the **physical right in Arabic too**
   (`components/ui/field.tsx`, `ltr:inset-e-1 rtl:inset-s-1`, `ltr:pe-12 rtl:ps-12`; the token rules forbid
   `right-*`/`pr-*`). LTR rendering is unchanged (same end side, same 3 rem padding). New `tests/password-eye.test.mjs`.
   Not a sign-in file; PR #24 does not touch it. The eye's labels stay English: its only user today is the dashboard
   stay Access card, and the dashboard is English only (owner, 2026-10-14).

## Checks on the final code (this worktree)
- `npx tsc --noEmit`: exit 0.
- `node --test tests/*.test.mjs`: 2,055 tests, 2,008 pass, **0 fail**, 47 skipped.
- `npm run tokens:check`: theme up to date.
- Bite: `tests/password-eye.test.mjs` against `origin/main`'s `field.tsx` (copied in, restored by copy, `cmp` equal):
  0 pass, 1 fail. On the fix: 1 pass.
- First attempt with `right-1`/`pr-12` failed `tests/design-tokens.test.mjs` (physical utilities); replaced, now green.
- `npm ci`: not re-run (worktree `node_modules` already present).
- **Not verified, needs the landing lane** (owner 2026-10-21: no test runs in work sessions): `npm run build`,
  Playwright (incl. `tests/ops-stay-tabs.spec.ts`), the dashboard snapshots, and the eye seen in a browser.
  Expected effect on snapshots: none (the dashboard is LTR; `ltr:pe-12` = `pe-12` there).
  `tests/ops-stay-tabs.spec.ts` uses `.is-password input` and the "Show password" name, both unchanged.
- Not seen in a browser. No migration. No new environment names.

## Gaps left (not closed here)
1. **LARGE, design: no Login link in the public header.** `components/site/public-frame.tsx:127` `login: false`;
   3.3 design §4.3 held control #3 says it "returns in Phase 2". A guest reaches `/login` only by typing it. Needs
   pictures (plain SIGN IN link vs session-aware menu) and the owner's pick, then an `almar` deploy.
2. **LARGE, money: 30-day session not set.** `supabase/config.toml:280-284` commented; cookie keeps 400 days
   (`lib/supabase/cookie-options.ts`). Deferred "until Supabase Pro" (STATE decision, 02-01). Owner decision: go Pro
   and set the time-box, or rewrite AUTH-05/D-02 to "until Pro".
3. **SMALL, planning text (controller's files, not mine to edit):** ROADMAP Phase 2 goal + SC1/SC2/SC4 and
   REQUIREMENTS AUTH-02/AUTH-05 still say guest password with eye, owner email+password, maria only, "same URLs".
   The code follows D-07 (no guest password), D-33 (owner magic link), PR #20 (second owner
   `koussayzayeni@gmail.com`, `lib/auth/rules.ts:10`, no decision file) and I18N-01 (per-locale URLs). Proposed
   text below.
4. **MEDIUM, sign-in pages: Arabic `/login`, `/account`, `/bookings` are served `<html lang="en" dir="ltr">` until
   the page script runs** (`components/site/locale-document.tsx` reads only the route segment; the cookie locale is
   applied client-side). Inner content is RTL on first paint. A fix touches the pre-paint boot script on every page
   and needs a browser run, so it is not a small gap; suggested as its own quick job.
5. **PENDING on PR #24:** `tests/build/ops-runtime.spec.ts:69` stale `/login` miss (the 2 known failures on main);
   GET/HEAD-only `/login` 308; sign-in form option A.
6. Low, known since 02-05: Sign out everywhere on the dashboard clears the `almar-signed-in` hint on the dashboard
   host only. It grants nothing (the server checks the session); the public host's hint just causes one 401
   preferences call.

## Owner question: "New here?" while sign-ups are disabled
Facts: the line (`lib/copy/guest.ts:102`, AR `:176`, ES `:250`) shows on public `/login` only. "Sign-ups disabled"
is only the Supabase setting (`enable_signup = false`). The server sends links with admin `generateLink`
(`lib/auth/magic-link-server.ts:101`), which **creates the account for a new email and ignores that setting**
(`02-JOB02-DECISIONS.md:15-18`). So today the line is true: a new guest does get an account from the link.
Pictures (real tokens from `tokens.json`, PR #24's option A form, EN/AR/ES each; draft text outlined dashed):
`.planning/phases/02-platform-spine/pictures/new-here/new-here-options.html` (one static page, no server; opened once
in the browser pane to check it renders). Questa is drawn with Georgia (licensed face not on the page).
Options for the picture question (one decision):
- **A (recommended): keep the line, keep the setting.** Guest sign-up through our own link is AUTH-02 / D-01; the
  setting only blocks direct API sign-ups that skip our limits and branded email. No code change.
- B: no public sign-ups. Remove the line and the "or create an account" heading; refuse unknown emails on `/login`
  (send-link would check `accountExists` first). Reverses AUTH-02 and D-01; guests then get an account only from a
  booking (AUTH-01, Phase 4). Needs pictures in EN/AR/ES and his signature.
  Draft refusal: EN "We could not find an account for this email. Your account is made when you book." AR
  "لا نجد حسابًا بهذا البريد. يُنشأ حسابك عند الحجز." ES "No encontramos una cuenta con este correo. Tu cuenta se crea al reservar."
- C: keep sign-up but reword to say it plainly. Draft: EN "No account yet? The link creates one." AR "ليس لديك حساب
  بعد؟ الرابط ينشئه لك." ES "¿Aún no tienes cuenta? El enlace la crea." Copy change only (`lib/copy/guest.ts`, which
  PR #24 also edits: do it after #24 lands).

## Owner UAT (after the controller deploys `almar` and `almar-ops` with PR #24 and this branch)
Guest sign-in
1. Open https://almarprivatejourney.com/login, type a new email you own, press Send. Expect "Check your email" with
   your address.
2. Open the email. Expect sender "ALMAR Private Journey", the ALMAR brand, the text in the page's language.
3. Click the link. Expect the Continue page, then your account page signed in.
4. On the account page open the menu and Sign out. Expect the home page, signed out.
5. Repeat 1-3 with the same email. Expect a sign-in link this time (no "new account" wording in the email).
Owner sign-in
6. Open https://dashboard.almarprivatejourney.com/ signed out. Expect the sign-in page ("OWNER ACCESS" after
   PR #24), not the marketing site.
7. Sign in with maria@almarprivatejourney.com and the emailed link. Expect the dashboard home.
8. Open https://dashboard.almarprivatejourney.com/login. Expect it to land on /sign-in (or the dashboard if signed in).
9. In the dashboard choose Sign out everywhere and confirm. Expect the sign-in page; reload the public account page
   in another tab: expect signed out there too.
Public/ops wall
10. Signed in as a guest (step 3), open https://dashboard.almarprivatejourney.com/. Expect the sign-in page, never
    dashboard data.
11. Open https://almarprivatejourney.com/ops and https://almarprivatejourney.com/dashboard. Expect the ALMAR 404 page.
12. Open https://dashboard.almarprivatejourney.com/about. Expect 404, not the About page.
Language and currency
13. On https://almarprivatejourney.com/ pick EUR, then العربية in the header. Expect the address /ar/, the page
    right-to-left, prices still in EUR, numbers in Western digits.
14. Pick Español. Expect /es/ and EUR kept.
15. On a page with a date (a stay's calendar), expect DD/MM/YYYY and weeks starting Monday, in all three languages.
16. Signed in as a guest (step 3), pick Español and USD, sign out, sign in again on another browser. Expect Spanish
    and USD to follow the account (02-05).
Password eye (dashboard)
17. In the dashboard open a stay, Access section, Wi-Fi password. Expect the eye on the right; click it: the text
    shows; click again: hidden.

## Proposed planning lines (controller applies once PR #24 and this job have landed)
ROADMAP.md, Phase list:
`- [x] **Phase 2: Platform spine** - Supabase auth, host gate, locale/currency, no ops leak (10/10 plans: 8 landed, 02-09 and 02-10 superseded; verified 2026-10-21 in 02-VERIFICATION.md; owner UAT <date>)`
ROADMAP.md, Phase 2 details, replace the goal and SC lines with the decided behaviour:
- Goal: `Guest and owner can authenticate; public and ops are isolated; language and currency persist (EN at the root, /ar/ and /es/ per I18N-01).`
- SC1: `Guest account stays inactive until the branded confirm email; every sign-in is a magic link (D-07: no guest password)`
- SC2: `Owners (maria@almarprivatejourney.com and koussayzayeni@gmail.com, PR #20) sign in with a magic link (D-33); logout-all; logged-out dashboard host is the ops sign-in; 30-day session when Supabase is Pro (deferred, 02-01)`
- SC4: `EN at the root and /ar/, /es/ (I18N-01); header language + currency; AR is dir=rtl; dates DD/MM/YYYY, week Monday, Western numerals`
- Plans line: `**Plans:** 10/10 (8 landed, 02-09/02-10 superseded); verified 2026-10-21; PR #24 landed <sha>; owner UAT <date>`
REQUIREMENTS.md: AUTH-02 drop "+ optional password (right-side eye)" (D-07); AUTH-05 "magic link only (D-33); owners maria@ and koussayzayeni@ (PR #20); 30-day session after Pro". Mark AUTH-02, AUTH-05, AUTH-06, AUTH-07, I18N-02, I18N-03, OPS-01, PLAT-01, PLAT-02, PLAT-04 Complete after UAT; I18N-01 is mapped to Phase 3.3.
decisions/: one file for the second owner email (PR #20), owner-dated.
STATE.md: `<time> Phase 2 closed: job 18 (gsd/phase-02-close <sha>) landed; PR #24 landed; deployed almar <ver>, almar-ops <ver>; owner UAT 1-17 <result>. Open: public Login link (pictures), 30-day session (Pro), Arabic auth-page first paint.`

## GSD, Jev, automation
- GSD: `/gsd-verify-work 2` is the fit for the owner UAT above (conversational UAT that records each step).
- Jev: none used. A fit: triage of verifier gaps into SMALL/LARGE/owner (advisory only).
- Automation: a nightly read-only probe of the public/ops wall (UAT 10-12 as GETs) that reports a change.
