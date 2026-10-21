# Owner answers after the 2026-10-21 landings (controller chat, 2026-10-21)

The owner's words, then what they mean for the work. Numbers follow the controller's "what's left" list.

| # | Item | Owner's words | Decision |
|---|---|---|---|
| 4 | "New here?" on the sign-in screen vs sign-ups off | "you decide or show me" | Controller decides: **option A, keep** the line as it is. It is true today: the sign-in link creates the account (`generateLink`), so a first-time guest can sign in. No code change. Pictures: `.planning/phases/02-platform-spine/pictures/new-here/`. |
| 5 | Login link in the public header | "built it" (build it) | Build it: header order per `CLAUDE.local.md` (wordmark, Destinations, Experiences, About, Contact, cart later, currency, language, **Login**), EN/AR/ES, kit components only. |
| 6a | 04-09 Q-18: resend the bank-details email on a part-paid request past its deadline | "yes" | **Yes:** "Resend request email" stays available on a part-paid request after its deadline. |
| 6b | 04-05 E-31: a later part-payment's receipt | "yes each payment get its own receipt" | **Yes:** every recorded payment sends its own receipt; a payment after the deadline does not repeat the past "Pay by" sentence. |
| 7 | Language cookie | "language cookie based on the language itself the user chooses" | The language the visitor **chooses** (the language select) is stored in a cookie, and `/` sends a returning visitor to that language. No browser-language guessing. Supersedes design §5.3's no-redirect choice. |
| 8 | Owner UAT of phases 2, 3.2, 3.3 | "no uat" | No UAT. Phases 2, 3.2 and 3.3 are marked complete on their landed and deployed code. |
| 9 | Item 7 migration `20261019130000` (24/45 published items without a destination) | "okay go ahead" | Apply it live now, before every item has a destination. Effect: a Save on one of those 24 published items must add a destination (or the item is unpublished first). `decisions/2026-10-19-item7-destinations-first.md` is superseded on its timing. |
| 10 | CMS-02 price sort | "do it" | Build it. |
| 11 | STAY-05 pets rule shown to guests | "do it" | Build it. |
| 12 | 30-day session (Supabase Pro) | "later" | Later. |
| 13 | Arabic `/login`, `/account`, `/bookings` served as English until hydration | "no add /ar, /en, /es" | Every page gets a language prefix: **`/en/…`, `/ar/…`, `/es/…`**, the sign-in, account and bookings pages included. Old unprefixed URLs redirect (301) to `/en/…`. |
| 14 | Phases 5 and 6 | "yes" | Go: Phase 6 planning now; Phase 5 executes after Phase 4. |
| 15 | Small cleanup (ROADMAP/REQUIREMENTS drift, preview rate-limit namespace, Mac IPv4 route) | "go ahead" | Do it. The Mac's IPv4 route is local networking, not the repo: noted only. |

Also standing (owner, 2026-10-21): **no test runs** ("I told you, no test. Direct, no test."). A type-check (`tsc`) is allowed.
