---
phase: 03-public-site-and-dashboard
plan: "07"
subsystem: newsletter
tags: [resend, newsletter, framer-form, toast, honeypot]

requires:
  - phase: 03-public-site-and-dashboard
    provides: FramerShell, /framer/source injection pipeline (03-06)
provides:
  - app/newsletter/route.ts POST handler calling resend.contacts.create only when a key is present
  - app/framer/source/route.ts retargeting the existing framer-8a2tsb form to /newsletter
  - app/framer/framer-shell.tsx toasting Subscribed. only on a Resend contact id
affects: [03-public-site-and-dashboard]

tech-stack:
  added: []
  patterns:
    - "Server route reads process.env.RESEND_API_KEY at request time only, mirroring app/design/map/route.ts's mapboxToken() gate; a missing key is a 503, never an invented success"
    - "Existing Framer HTML form is retargeted by string replace inside app/framer/source/route.ts, not by editing app/route.ts or adding a second form"
    - "Toast success is gated on a single postMessage path ({ newsletter: 'ok' }) verified by event.origin and event.source, matching the FX postMessage pattern already in FramerShell"

key-files:
  created:
    - app/newsletter/route.ts
    - tests/phase-03-newsletter.test.mjs
  modified:
    - app/framer/source/route.ts
    - app/framer/framer-shell.tsx

key-decisions:
  - "FramerShell was not previously wrapped in ToastProvider; added a thin FramerShellInner split so useToast() has a provider, without changing any other shell behavior"
  - "All three responsive copies of the framer-8a2tsb form (desktop/tablet/phone, verified as exactly 3 occurrences matching 3 'Join the List' strings) are retargeted by a global string replace in app/framer/source/route.ts, not just the first"
  - "The client script builds a hidden aria-live status paragraph per form for the 'Enter an email address.' line, per the plan's 'live region, no toast' requirement, instead of reusing a toast for that error"
  - "Honeypot rejection returns 400 before any email validation and before any RESEND_API_KEY read, so a filled honeypot never triggers a Resend call regardless of key state"

patterns-established:
  - "Pattern: a Resend-backed route reads its key at call time only, gated behind a NODE_ENV==='production' 404 and honeypot/validation checks that happen before the key read"

requirements-completed: []

duration: 35 min
completed: 2026-09-27
---

# Phase 3 Plan 07: Newsletter connected to Resend contacts Summary

**The existing `/framer` footer form (class `framer-8a2tsb`, three responsive copies) now posts to `POST /newsletter`, which calls `resend.contacts.create` only when `RESEND_API_KEY` is present in the server environment; the button reads "Subscribe" and the shell toasts "Subscribed." only after Resend returns a non-empty contact id.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 4 (1 created route, 1 created test, 2 modified)

## Accomplishments

- `app/newsletter/route.ts`: dev-only (`NODE_ENV==='production'` → 404), `POST` only, reads `Email` from `FormData`. Any non-empty honeypot among `title, website, company, message, subject, description, feedback, notes, details, remarks, comments` → 400, no Resend call. Empty email or no `@` → 400. Missing/empty `RESEND_API_KEY` → 503 `{ok:false}`, no Resend call, no invented key. With a key present, calls `resend.contacts.create({ email, unsubscribed: false })` — never `emails.send`, never a `from` address, never a domain/segment/topic. Returns `200 {ok:true, id}` only when `data.id` is a non-empty string; otherwise `502`.
- `app/framer/source/route.ts`: the existing form open tag `<form class="framer-8a2tsb">` (all 3 responsive copies, verified against 3 occurrences of "Join the List" in the source HTML) is retargeted to `action="/newsletter" method="post"`, and the submit text is relabeled `Join the List` → `Subscribe` (no `hero-search-submit` class added — not gold). A new `newsletterScript()` is injected as a `<script>` tag alongside the existing price/locale scripts: it `preventDefault`s the submit, posts `FormData` to `/newsletter`, shows `Enter an email address.` in a per-form `role="status" aria-live="polite"` element (not a toast) when Email is empty, and `postMessage`s `{ newsletter: "ok" }` to `window.parent` only when the JSON response has a non-empty `id`. It never touches the response body with `innerHTML`.
- `app/framer/framer-shell.tsx`: wrapped in `ToastProvider` (it was not wrapped before — split into `FramerShell` (provider) and `FramerShellInner` (existing logic plus the new listener)). A `message` listener verifies `event.origin` and `event.source` (must be the `#content` iframe's `contentWindow`) before checking `data.newsletter === "ok"`, and only then calls `push("Subscribed.")`. That is the only call site of `push("Subscribed.")` in the file; the string `"Check your inbox."` does not appear.
- `tests/phase-03-newsletter.test.mjs` (15 tests, `node --test`): asserts `contacts.create` is present and `emails.send` is absent across all three touched files, no hardcoded `from:`, the honeypot rejection path and all 11 honeypot field names are present, the 503 path exists and contains no `push(`, no `re_...` key pattern, `.env.example`'s `RESEND_API_KEY=` line stays empty, the form retarget and `Subscribe` label are present in the source injection, no `innerHTML` assignment, and the shell's single `Subscribed.` push path.

## Task Commits

1. **Task 1 + Task 2 (combined): newsletter route, form retarget, toast wiring, and test** - `ecf4835` (feat)
2. **Docs: this summary** - see below

## Files Created/Modified

- `app/newsletter/route.ts` - new POST route, Resend contacts.create gate
- `app/framer/source/route.ts` - form retarget + newsletter injection script
- `app/framer/framer-shell.tsx` - ToastProvider wrap + postMessage listener
- `tests/phase-03-newsletter.test.mjs` - 15 assertions covering the threat model

## Decisions Made

See `key-decisions` above (ToastProvider split, all-3-forms retarget, live-region error line, honeypot-before-key ordering).

## Deviations from Plan

None - plan executed exactly as written. `app/route.ts` and `components/ui/footer.tsx` are untouched (`git status --porcelain` shows only the four files_modified paths).

## Authentication Gates

None during this plan. `RESEND_API_KEY` is an **owner-provided runtime environment variable** and is not present in this dev environment (`process.env.RESEND_API_KEY` is unset here, and `.env.example` keeps the line empty as before). This is expected per 03-RESEARCH.md Pitfall 9 / Open Question 1: the route and the form wiring are built and testable now; the live "Subscribed." toast path (a real Resend contact id round-trip) cannot be exercised end-to-end in this environment until the owner puts the existing key into the dev server process. Only the 503-without-key path and the honeypot-rejection path are verifiable here — that is this plan's locked, expected behavior, not a gap to close.

## Issues Encountered

None new. Pre-existing unrelated test failures noted in earlier summaries (e.g. `tests/phase-03-search.test.mjs`) were not touched or re-run by this plan.

## User Setup Required

- Put the existing `RESEND_API_KEY` value into the dev server process environment (owner-held secret, not created here) to exercise the 200 success path end-to-end. Do not commit it. No Resend domain, segment, topic, or API key is created by this plan.

## Known Stubs

None functionally — the route is fully wired to Resend's contacts API. The only thing blocking a live 200 response in this environment is the absent owner-provided key, which is expected and documented above, not a stub left in the code.

## Next Phase Readiness

- `node --test tests/phase-03-newsletter.test.mjs` — 15/15 passing.
- `npx tsc --noEmit -p tsconfig.json` — no errors.
- `grep -r "emails.send" app/` — no matches.
- `grep -r "re_[A-Za-z0-9]\{10,\}"` across touched files — no matches.
- `git status --porcelain` before commit — only `app/newsletter/route.ts` (new), `tests/phase-03-newsletter.test.mjs` (new), `app/framer/source/route.ts` (modified), `app/framer/framer-shell.tsx` (modified).
- `app/route.ts`, `components/ui/footer.tsx`, `package.json`, `.env.example` — byte-identical to HEAD before this plan (untouched).

## Self-Check: PASSED

- FOUND: app/newsletter/route.ts (contacts.create, no emails.send, no from, honeypot 400, 503 without key)
- FOUND: app/framer/source/route.ts (framer-8a2tsb → /newsletter, Subscribe label, newsletterScript injected)
- FOUND: app/framer/framer-shell.tsx (ToastProvider wrap, single Subscribed. push on postMessage path)
- FOUND: tests/phase-03-newsletter.test.mjs (15/15 passing)
- FOUND: ecf4835

---
*Phase: 03-public-site-and-dashboard*
*Completed: 2026-09-27*
