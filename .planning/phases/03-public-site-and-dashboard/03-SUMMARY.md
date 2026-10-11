---
phase: 03-public-site-and-dashboard
status: complete
completed: 2026-09-27
landed: 2026-10-02
commits: [9fd6786]
---

# Phase 3 Summary: public site and dashboard screens

All 13 plans were built on 2026-09-27 on the cloud/3.1 branch; each has its own `03-NN-SUMMARY.md` (self-check passed, 03-13 has no self-check line). They reached `main` inside the Phase 3.1 squash `9fd6786` (2026-10-02 01:42 +04): the `feat(03-NN)` commits are ancestors of tag `archive/ship-3.1` (`7e72c20`), not of `main`. Deployed 2026-10-02 02:25 as Worker `almar` `49112d4b` (CONTROL-BOARD job 01). No `03-VERIFICATION.md` exists.

| Plan | What | Fate |
|---|---|---|
| 03-01 | FX on `/framer` for six written amounts | Built; `/framer` removed in 3.1 (`9fd6786`), prices now from the data layer in 3.3 |
| 03-02 | `/dashboard` shell, rail, overlay sidebar | Built, kept; wired to Supabase in 3.2 |
| 03-03 | Language on `/framer` | Built; `/framer` removed; React pages carry EN/AR/ES (3.3) |
| 03-04 | Hero Search opens empty `/booking/trip` | Built; trip flow continues in Phase 4 |
| 03-05 | Sign in, Bookings, Account screens | Built; made real by Phase 2 job 02 (`01d9304`) |
| 03-06 | WhatsApp control | Built; public pages rebuilt in 3.3 |
| 03-07 | Footer newsletter form to Resend | Built; React `/newsletter` is 3.3 slice 3 part B (not recorded as landed) |
| 03-08 to 03-13 | Dashboard Home, Bookings/Customers, Calendar, Catalog, Content, Settings/Profile (empty or non-saving) | Built, kept as screens; saving and data are 3.2 (catalog, team) and Phase 5 |

Deviations: requirements PAY-16, OPS-09, STAY-04, STAY-07 are listed in summaries as drawn, not working. The phase's success criteria (destinations CRUD, rates, hard blocks, catalog on/off) are not met by Phase 3 itself; they are carried by 3.2 (catalogue migration `bbc35b7`, owner API `ce411d9`) and Phases 4 and 5.
Open: none in Phase 3; the carried criteria live in later phases.
