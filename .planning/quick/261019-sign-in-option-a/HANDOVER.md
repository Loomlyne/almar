# Hand-over: sign-in form, option A

Work session `local_0187ed55`, 2026-10-19 12:53 +0100. Branch `claude/sign-in-option-a`, cut from `origin/main` 40b5b65.

## Signed
On 2026-10-19 the owner picked option A of three pictures drawn in chat ("Go with option A for the sign-in redesign"). Option A has a kicker above the
heading, a 40px gold rule under it, the email field as wide as the button, and a link note under the button.
One wording change from the picture: the kicker says "Owner access", not "Owner dashboard", because
`tests/phase-03-guest.test.mjs` forbids the word "dashboard" in public sign-in sources.

## Changed
- `app/login/sign-in-screen.tsx`: the form only, on both hosts (the public /login and the dashboard /sign-in).
  - The kicker (`text-caption`, uppercase, muted) reads "Owner access" on the ops host and "Your account" on the public host.
  - The heading is unchanged.
  - A `w-10 border-t border-gold` rule sits under the heading. Gold is a line only.
  - The Field gets `max-w-none`, so the input is as wide as the button. It was 384px against 432px.
  - Under the button: "The link works once, for one hour."
- `lib/copy/guest.ts`: `kickerPublic`, `kickerOps` and `linkNote` in EN, AR and ES. The guest Spanish uses tú, as in the lines around it. The link note matches live Supabase `mailer_otp_exp` = 3600 s and the single-use link.
- `tests/phase-03-guest.test.mjs`: one new test.
- The "Check your email" state is unchanged.

## Checks on the commit
- `npm ci` exit 0
- `npx tsc --noEmit` exit 0
- `node --test tests/*.test.mjs`: 1,973 tests, 1,930 pass, 0 fail, 43 skipped
- `tokens:check`: up to date
- NOT run, because they need the controller's go: `npm run build` and Playwright. Snapshot specs of /login and /sign-in, if any, will need new baselines.
- Not seen in a browser, in any of EN, AR (RTL) or ES.
- No migration and no new environment names.

## Owner test steps (after deploy)
1. Open https://dashboard.almarprivatejourney.com/sign-in. Expect "OWNER ACCESS" above "Sign in", then a short gold line. The email box is exactly as wide as the button. Under the button: "The link works once, for one hour."
2. Switch to Arabic. Expect the same layout mirrored, the kicker not in capitals, and the gold line on the right.
3. Open https://almarprivatejourney.com/login. Expect "YOUR ACCOUNT" above "Sign in or create an account".
4. Submit an empty field. Expect the error under the full-width box.
