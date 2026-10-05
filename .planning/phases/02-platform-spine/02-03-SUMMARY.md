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
