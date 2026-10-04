# Job 02 — owner answers on the Mac

Proposed for `.planning/decisions/` at ship (work sessions do not write there).

## 2026-10-04 ~22:25 (+04), question form, job 02 work session

| Question | His answer |
|---|---|
| Sign-in link: one click signs in (scanners burn links; login CSRF). Fix? | **Continue page**: the link opens a small ALMAR page in the sign-in card style with one line and one button; the click finishes sign-in. EN/AR/ES. Screenshots at 390/834/1440 signed before code (plan 02-24) |
| Limit on sign-in emails | **Per email and per IP**: 1 link per email per 60 s, at most 5 per email per hour, at most 20 per visitor IP per hour. Over the limit the page still says "Check your email" and nothing is sent. The account exists only after the link is clicked (plan 02-23) |
| Where his local Supabase and Resend keys live for the Mac test | **A file outside the repo**, `~/.almar/dev.env`, loaded only by the test dev server; never `.env.local` (job 10's assembler refuses any bundled `.env` value) |

## Facts checked for these answers

- Supabase Auth admin `generateLink({ type: "magiclink" })` for an unknown email turns into a signup with a random
  64-character password and does not consult "Allow new users to sign up" (`supabase/auth`
  `internal/api/mail.go` `adminGenerateLink` → `validateSignupParams`, read 2026-10-04). So gate "sign-ups off,
  password provider off" does not stop guest accounts made by the link, and the random password is unusable.

## 2026-10-05 (+04), question form, job 02 work session

| Question | His answer |
|---|---|
| Continue page design (drafts EN/AR/ES at 390/834/1440: split layout as /login, "One more step", "Continue to sign in to ALMAR as l•••@gmail.com", Continue, "Not you? Use a different email") | **Signed**: build as drawn; the shown email is the real one, masked, proven by the server so a forged link cannot fake it (plan 02-24) |
| Plan 02-25 (W6 Profile sign-out wired, W7 real nav links on /account and /bookings, W8 currency hidden on /bookings, kept on /account) | **Signed** |
| Second review finding 5: a forwarded link signs a guest into a stranger's account | **Ask for the email**: when the link is opened in a different browser from the one that asked for it, the Continue page also asks for the full email (wrong email refused); same browser unchanged. The extra state is drawn and signed before code (plan 02-26 Task 2) |
| Email-check state of the Continue page (drafts EN/AR/ES at 390/834/1440, states "ask" and "wrong"; draft scene `tests/journey/scenes/auth-continue-email-draft.tsx`) | **Signed**: build as drawn; same browser as the request keeps the earlier signed page with no field |
