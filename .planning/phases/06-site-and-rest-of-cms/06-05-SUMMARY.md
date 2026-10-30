# 06-05 summary: Plan with us, List with us, the consultation, Requests

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-30, from `date`. Lead: Opus 5.5; Tasks 3-5 by a `worker-deep` (Opus) agent. Review: Sonnet. Fable: one pass on the whole Phase 6 PR, by the controller.

## Signature
`pictures/06-05/index.html`, signed 2026-10-30 (`decisions/2026-10-30-06-04-06-05-06-07-pictures-signed.md`). 24 hours notice and 30 days ahead are the owner's to type in the dashboard, not code defaults.

## What landed
| Commit | What |
|---|---|
| `3960cf4b` | `consult_slots` as one set query (cost fix) |
| `e2ea6780` | signed copy: Plan with us, List with us, consultation, guest email, Requests, Consultation editor |
| `55c72542` | one validator, slots, `.ics`, three emails, save-then-email, public endpoints |
| `81d9ae07` | the pages, the consultation on Contact, the links |
| `55a15df2` | no "No free times" while the next month is being read |
| `9ff087e3` | dashboard Requests and Content › Consultation, owner-only endpoints, rail entries |
| `5c7e4e3f` | Sonnet's eight findings (see HANDOVER) |

## Deviations
- Outside the plan's list: `lib/site-requests/real-deps.ts`, `components/pages/request-form-parts.tsx`; `lib/copy/site-footer.ts` gains `listWithUs` (`tests/public-frame.test.mjs` forbids the frame importing copy); pins in server-runtime test and build spec, locale-path, public-frame, site-footer-copy, site-nav, phase-03-dashboard-shell, ops-route. Visual baselines will shift: footer link, Begin button, Contact section.
- Words not on the signed page, reused, none new: cancelled call `OPS_BOOKINGS_COPY.statuses.cancelled`; too long: Contact's `tooLong`; consultation field errors `plan.err`; booking failed `failed`; `.ics` `subject`, `wa`, `cancel`; package and cities labels `kinds.package`, `d.city`. `--:--` is a blank time placeholder. The guest-language row is left out.
- Signed picture over plan: From/To native date fields, airport as Select, kind filter as toggles, email subjects and bodies as drawn.
- `site-cms-api.ts` over plan: `{id, handled}`, `{action:"cancel", booking_id}`, `handled=yes|no|all`. The slots reply also carries `time_zone`.
- `public/_redirects` and `LEGACY_SECTIONS` untouched (not granted; these pages never had unprefixed URLs): a bare `/plan-with-us` is a 404.
- Added after review, not in the plan: `consult_is_open()`, and a retry of the same email and start returns its booking. No limit on calls per email (owner, 2026-10-30).

## Checks
`npx tsc --noEmit` and `npm run tokens:check` pass. Node tests, pgTAP, build, Playwright: **not run (owner: no test)**. Slot booking and the back guard have never run in a browser.
