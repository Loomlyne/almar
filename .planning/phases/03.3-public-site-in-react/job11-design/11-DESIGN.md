# Job 11 design: home and stay page matched to Framer, Search and Request on WhatsApp

Branch `gsd/phase-3.3-s1-framer-match`, cut from `origin/gsd/phase-3.3-slice-1` (`6264c59`). Written 2026-10-04.
Measured on the live Framer pages (`https://almarprivatejourney.com/` and `/private-stays/casa-jardin-san-diego`) at
1440 and 390 with plain GET requests: layer tree, every text style, every image box, every animation frame by frame.

Pictures (`pictures/`):
1. `1-home-1440.jpg`, 2. `2-home-390.jpg`, 3. `3-stay-1440.jpg`, 4. `4-stay-390.jpg`: each section as Framer shows it
   today (English) beside ours in Arabic (right to left, our Arabic text), with each difference in one line.
5. `5-new-and-different.jpg`: the two buttons and their states, where Search lands, the light footer, EN and AR.

`/private-stays` is not matched to Framer (owner, 2026-10-04): it keeps its layout and gains only the dates filter for the
arrival from Search.

## 1. What differs from Framer, and why

| Where | Framer | Ours | Why |
|---|---|---|---|
| Nav, all pages | Destinations, Experiences, Services, logo in the middle, About, Contact, Sign in | Wordmark left, Destinations, Experiences, About, Contact, currency (home), language | Signed nav rule |
| Home hero | "Design your journey" button | Journey bar Where · When · Who · **Search** (phone: one tap, 3-step sheet ending in Search) | Owner answer 1 |
| Home and Begin backgrounds | Videos on catbox.moe and pexels.com | Still photo until question 3 is answered | Files are not ours (design 7.6) |
| Home Private Stays | 3 fixed cards | 3 fixed cards; the live count and filter under the bar are removed | Search now does that job |
| Home Moments | Two small inset photos | Same photos, added to our media host at ship (2 files, one numbered step for you) | Not in R2 yet |
| Home Journeys | Playfair and Bricolage faces, "Discover the Journey" link | Questa and Lato; the link is not shown | Tokens only; the link leads nowhere on Framer |
| Gold text (Founder & Director, nights, durations) | Gold or gold-brown text | Grey (`muted`) | Gold is a line only |
| Small kickers ("Private Stays", "Curated Experiences"...) | `#0f677d`, not one of our colours | Brand teal `#1f3b40` | No new colour without your word |
| Stay hero | No bar | Locked bar (Destination, Stay) + Dates + Guests + **Request on WhatsApp**; the pinned dock carries the same button; the green float hides on this page so there is one WhatsApp button | Owner answer 2 |
| Stay About facts | Inter | Lato | Tokens only |
| Stay gallery | Moves every 2 s | Moves every 2 s; stops on hover, focus or swipe; pause button; still with reduced motion | Accessibility (auto-moving content needs a pause) |
| Stay Policies | Accordion | Same; each row opens the text published on the live page (AR, ES as drafts) | Our data had the headings only |
| Stay More Private Stays | Cards open `/experiences/<stay>` (broken) | Cards open the stay page | No dead links |
| Footer, all three pages | Light; Legal links, Facebook, YouTube, TikTok, newsletter | Light look (question 1); our signed content: pages, email, phone, Instagram, languages, ©, "Made by Koussay" | Those controls do not work today |
| Footer, Arabic | — | The phone number reads left to right (today's slice-1 footer shows it backwards) | Bug fix |

## 2. The two buttons

**Home Search.** Needs a destination and both dates (the bar's existing error states: red line under the missing segment and the
one-line alert). Guests default to the bar's value. Goes to `/private-stays?destination=<slug>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>&guests=<n>`
(`/ar/…`, `/es/…`). The list shows only stays in that destination, free on every night from arrival to the night before departure
(the stay's blocked dates in the data layer), sleeping at least that many guests. Destination chip and guests stepper show the
values; a new **Dates** filter shows the range with a clear button and the existing note "Blocked dates here are examples."
Clear filters resets all four. No JavaScript: the bar is a plain form that submits the same query string.

**Stay Request on WhatsApp.** Never blocked: it opens `https://wa.me/971563883302?text=<message>` in a new tab, in the page's
language. Dates not chosen: the line says so. Guests always have a value (the bar's default is 1 adult).

| | Message |
|---|---|
| EN | Hello ALMAR, I would like to request Casa Jardín San Diego (Cartagena).<br>Dates: 12/10/2026 to 15/10/2026 (3 nights) · or: Dates: not chosen yet<br>Guests: 2 adults, 1 child<br>https://almarprivatejourney.com/private-stays/casa-jardin-san-diego |
| AR | مرحباً المار، أودّ طلب كاسا خاردين سان دييغو (كارتاخينا).<br>التواريخ: من 12/10/2026 إلى 15/10/2026 (3 ليالٍ) · أو: التواريخ: لم تُحدَّد بعد<br>الضيوف: بالغان، طفل واحد<br>الرابط |
| ES | Hola ALMAR, me gustaría solicitar Casa Jardín San Diego (Cartagena).<br>Fechas: del 12/10/2026 al 15/10/2026 (3 noches) · o: Fechas: aún sin elegir<br>Huéspedes: 2 adultos, 1 niño<br>enlace |

The AR and ES wording is mine, for your review. The page link is the page's own language address.

## 3. Animations (measured on the live page at 1440; the same at 390)

Easing everywhere: Framer's spring, measured 36 % / 77 % / 96 % done at 10 / 25 / 50 % of the time, which is
`cubic-bezier(0.22, 1, 0.36, 1)`. Each plays once, when the element enters the screen.

| # | What | From | Duration | Delay |
|---|---|---|---|---|
| A1 | Hero photo (home, stay) on load | opacity 0, scale 1.02 | 1.6 s | 0.2 s |
| A2 | Nav on load | opacity 0, 10 px up | 1.0 s | 0.5 s |
| A3 | Hero headline on load | opacity 0, 20 px down | 0.9 s | 0.6 s |
| A4 | Hero bar (home), title block (stay) on load | opacity 0, 20 px down | 0.9 s | 1.0 s |
| A5 | Every section kicker and heading block | opacity 0, 10 px down | 1.07 s | 0 |
| A6 | Every "View All", "Request…", "Read All" button | opacity 0, 20 px down | 0.88 s | 0 |
| A7 | Photo rows and card rows (gallery strip, stories, Journeys cards, stay About, Amenities, each policy row) | opacity 0, 40 px down (policy rows 20 px) | 1.18 s | 0 |
| A8 | Welcome letter | opacity 0, 20 px down | 1.0 s | 0 |
| A9 | Welcome photos (desktop) | tied to scroll: each slides down 360 px into place as it rises past the letter | follows the scroll | — |
| A10 | Hero photo while scrolling away | fades with the scroll | follows the scroll | — |
| A11 | Stay gallery | slides one photo every 2 s, 1.4 s slide | — | — |
| A12 | Hover: stay cards' photo 1.05×, story cards' photo 1.02× | — | 0.4 s | — |

Framer fades Choose Your Journey out again when it leaves the screen; ours plays once. No package: CSS transitions,
the browser's IntersectionObserver and one scroll listener. With JavaScript off everything is visible (the hidden start
state is only set by the script); with reduced motion nothing moves.

## 4. Sizes (Framer values; question 2)

| Use | 1440 | 390 | Token today |
|---|---|---|---|
| Hero and Begin headline | 88 | 48 | none at 88 (`hero` is 64) |
| Section heading | 56 | 32 | none at 56 (`display` 48) |
| Card title | 32 | 24 | `heading` 32; none at 24 |
| Small title (story, signer, neighbourhood) | 22 | 18 | none |
| Lead text, buttons | 18 | 14 | none at 18 |
| Body, kicker | 16 | 14 | `body`, `label` |

Layout: content 1240 px wide (`column`), sections 120 px top and bottom and 100 px sides at 1440, 64 / 40 px top and 20 px
sides at 390; thin lines in `teal-tint`; the section divider is a line with a small gold diamond outline (a line, not a fill).

## 5. Data-layer changes (no component reads a fixture)

- `home.welcome.images`: the five Welcome photos (today gallery 01–05); `home.gallery.images` keeps 06–13; 14 and 15
  (two 40 px arrow icons) leave the data.
- Two destination inset photos, `policy` bodies for the 12 stays (from the live page), EN/AR/ES.
- Stay availability filter `free from…to` in `lib/data/stay-filter.ts`, used by the list.

## 6. Shared files this needs (the controller grants them)

`tokens.json` and `app/globals.css` (the new sizes, motion tokens), `lib/copy/*.ts` (button labels, WhatsApp text, Dates
filter). No `package.json` change.

## 7. Owner's answers, 2026-10-04 (question form, this chat)

1. Footer: **one light footer** on all three pages (home, stay page, `/private-stays`).
2. Sizes: **keep the signed scale** 12·14·16·20·32·48·64. Framer's 88 / 56 headings become `hero` 64 / `display` 48 at
   1440; at 390 Framer's 48 / 32 are `display` / `heading` already; card titles 32 → `heading`, 24 → `title`; 22 → `title`;
   18 → `body`. No new size token.
3. Videos: **copy both videos to our media host** at ship (one numbered step for him). The data carries `video_url`
   (null until then); the page plays it when present, poster first, still with reduced motion.
4. Design: **signed, build it**. Owner, same chat: "When I sign them, write the plans and build straight away, no
   separate plan signature." Plans 03.3-40 onwards are written, checked by an Opus plan checker, and executed without a
   plan stop.
