# v1 backend discuss log — Phase 3.2, Phase 4, minimal ops

One sitting, 2026-10-04 22:10–22:29 (+04), question form, job 12 session (`gsd/plan-v1-backend`). The controller
relayed the owner's word at 22:08 that the discuss starts the same evening. Human reference only; the decisions
agents read are in `03.2-CONTEXT.md`, `04-CONTEXT.md`, `05-CONTEXT.md`.

| # | Question (page) | Options offered (recommended first) | His answer |
|---|---|---|---|
| 1 | 3.2 Publish → when does the public site change | Next site update · Instantly on every visit · Automatic rebuild after Publish | **Automatic rebuild after Publish** |
| 2 | 3.2 AR/ES for new content | Three tabs, all needed · English enough · Auto-translate button now | **Auto-translate button now** |
| 3 | 3.2 Photos | Upload button · Pick existing or paste a link | **"we can pick from existing ones or upload if we have another"** → both |
| 4 | 3.2 Rates | Base rate + date ranges · 12-month grid · One flat rate | **Base rate + date ranges** |
| 5 | Rebuild source | Code live now (`live` branch) · Whatever is on main | **Code live now** |
| 6 | Translator | Claude API · DeepL · Cloudflare Workers AI | **Cloudflare Workers AI** |
| 7 | Home journeys in dashboard | Yes, text and price line · No, v1.1 | **Yes** |
| 8 | 4 Booking entry | Book on the stay page · Home Search to /booking/trip | **Book on the stay page** |
| 9 | 4 Charge currency | AED only · AED, USD or EUR | **AED, USD or EUR** (then clarified, #13–14) |
| 10 | 4 Damage hold | Out of v1 · Hold at checkout anyway | **Out of v1** |
| 11 | 4 Coupons | v1.1 · In v1 | **v1.1** |
| 12 | 4 Receipt | Branded email, PDF v1.1 · Email with PDF | **"branded email in v1"** |
| 13 | 4 Balance | Pay balance on booking page · Ops sends a link | **Pay balance on booking page** |
| 14 | 4 Stripe account | New ALMAR account · Existing UAE account | **"for now lets test with main and next we will change with hers"** → TEST on his existing account, ALMAR owner's account later |
| 15 | 4 VAT / deposit | Give by Oct 9 · Start 5 % / 30 % | **Start with 5 % VAT, 30 % deposit** |
| 16 | 4 FX rate for USD/EUR | Site feed, locked · Stripe converts | **Stripe converts for us** |
| 17 | Ops refunds | In Stripe's dashboard · Button in ops | **In Stripe's dashboard** |
| 18 | Ops New booking | v1.1 · In v1 | **In v1** |
| 19 | Minimal ops list | Sign as listed · Change it | **Sign as listed** |
| 20 | Clarify currency (16 vs 9) | AED charge, Stripe shows local · Charge in USD/EUR at Stripe's rate | **AED charge, Stripe shows local** |
| 21 | Hand-made unpaid booking blocks dates? | Until a date you set · Not until paid | **Until a date you set** |
| 22 | Record offline payment | Yes · No, card only | **"card, apple pay"** → no offline recording; card and Apple Pay only |
| 23 | Cloudflare paid plan | After measuring on preview · Upgrade now | **After measuring on preview** |

Interpretations recorded (his words in quotes above): #22 also sets the payment methods to card and Apple Pay
(Link off). #9 + #16 + #20: the charge is AED; local-currency display is Stripe's; no FX lock built.
