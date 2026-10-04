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
