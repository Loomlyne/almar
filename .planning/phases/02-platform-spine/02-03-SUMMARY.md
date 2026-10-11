---
phase: 02-platform-spine
plan: "03"
status: complete
completed: 2026-10-01
---

# 02-03 Summary: three languages on login, account, bookings and the 404

Commit `5b6739d`.

- `lib/request-locale.ts`: one allowlist (en, ar, es) for the `almar-locale` cookie; anything else
  is English. Account and bookings fall back to her saved profile language.
- The server-runtime 404 shows its heading and link in EN, AR, ES and sets `lang`/`dir` on `<html>`.
  The static-host 404 (`lib/not-found-document.ts`) stays English; its browser title stays English.
- Field errors (names, phone, email) come from `lib/copy/guest.ts` in the active language, under the
  field, with `aria-invalid` and `aria-describedby`.
- Tests: `format` (DD/MM/YYYY, Monday first, Western digits), `locale`, `auth-i18n.spec.ts`.

Deviation: TOUCHWORD is a literal in `components/ui/account-menu.tsx`, not a copy key (it is never
translated); `tests/locale.test.mjs` guards that.

## Landing on main (added 2026-10-11)

- The commit named above sits on the cloud branch `claude/project-thread-8h6bed` and is not on `main`. The work was rebuilt and landed as one squash in job 02: `01d9304` (2026-10-05 14:40 +04), covering plans 02-02, 02-03, 02-04, 02-23 to 02-26.
- Live: Worker `almar` `82569c44` (rollback `e1d0add8`), 2026-10-05 14:50 +04 per STATE. Six server paths open (/login, /auth/confirm, /auth/sign-out, /auth/handoff/start, /account, /bookings).
- Landed with 02-02 and 02-04; language cookie behaviour is part of the live Worker `almar` version below. No separate live check of AR/ES on these pages is recorded.
