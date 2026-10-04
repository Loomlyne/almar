# Slice 2 — `/destinations` matched to Framer (owner, 2026-10-04 ~16:15)

The owner's answer ("Yes, except list pages", `decisions/2026-10-04-slices-reconcile.md` on `main`,
section "Framer match for slices 2–4"): `/destinations` matches the live Framer page in look and animations,
as job 11 does for home and the stay page. **`/experiences` keeps the React list layout** of the signed
design, like `/private-stays`, so its plans do not change.

Measured 2026-10-04 on `https://almarprivatejourney.com/destinations` (plain GET, Chromium, 1440 and 390,
after scrolling every element in): page 3,779 / 5,547 px.

- **Hero:** full-bleed photo slideshow, 1440×900 or 390×591, three photos.
- **Kicker and heading:** kicker "destinations" at 16 / 14 px; `<h1>` Questa 88 / 48 px, centred, ivory.
- **Intro sentence:** 16 / 14 px teal, centred, 400 px wide.
- **Cards:** 600×600 squares, two columns with a 40 px gap (phone: one column of 350×600, 20 px gap). The name
  sits on the photo, Questa 32 / 24 px, in capitals, with a pin and the region at 14 / 12 px over a bottom
  shade. Each card links to `/destinations/<slug>`, which answers 404.
- **Animations:** each card enters at opacity 0 and 40 px down; the sentence enters 10 px down. These match
  job 11's measured set (A1, A3, A5, A7) exactly.
- **Footer:** light.

Pictures: `destinations-1440.jpg`, `destinations-390.jpg` — Framer today (EN) beside ours (EN, AR), with
every difference in one line. Ours is a picture built from our tokens, fonts, photos and fixture words, not
code.

## What the pictures change in the signed slice 2 plans (applied after his signature)

| Plan | Change |
|---|---|
| 13 `/destinations` | Layout from board 5d (gold-rule title, 3/2/1 landscape cards with the caption below) becomes the Framer layout: the hero slideshow with kicker and `<h1>`, then two-column square cards with the name on the photo, one column on phone, and the fifth card centred on the last row at 1440. It uses **job 11's components and animation code** (hero slideshow with dots and pause, photo card with the name on the photo, section divider, enter animations), and builds none of its own. **It depends on job 11 having landed**; its first task stops if those components are missing. Cards stay non-links. |
| 10 data | Two more images: the hero photos `63ab3e6e8d9dec4a.webp` and `0ecaa27f3bc3940e.webp` (`4d62ca4792adaf59.webp` is already on R2). They get media keys `destinations/page/hero-2.webp` and `-3.webp`, read through the data layer, not a fixture import. The manifest goes from 155 to **157** entries and new images from 38 to **40**. |
| 16 media | 40 images in the upload step, not 38; guard counts follow. |
| 17 hand-over | The `/destinations` owner steps check the slideshow (dots, pause, reduced motion) and the card animations. |
| 11, 12, 14, 15 | No change. |

## Owner's answers, 2026-10-04 (question form, ~17:00–17:06 +04)

| # | Question | His answer | What it changes |
|---|---|---|---|
| 1 | The sentence under the hero ("Three exclusive packages … Eje Cafetero …") | **"Leave it out"** | Plan 13 renders no intro sentence. The page goes from the hero straight to the five cards. |
| 2 | Sign the `/destinations` pictures (`79b0dc8`) | **"i sign it but the footer i want similar to framer i wnat it to have social media icons and newsletter place as well and teh rest all good signed"** | **Signed**, except the footer. He wants the footer like Framer's, with social icons and the newsletter box. The footer is one shared frame on every page, so slice 2 builds none of it. Job 11 builds the light footer look. Slice 3's plan 27 (signed; part B, after job 10's server runtime) makes the newsletter box real on every React page; until then it is not shown, because it would send nothing. |
| 3 | Which social accounts exist | **"Instagram only for now"** | One social icon: Instagram, linking to `https://www.instagram.com/almarprivatejourney/` (the address already in `components/site/public-frame.tsx`). No icon links to a bare facebook.com, youtube.com or tiktok.com. Others appear when he gives their addresses. |

**For the controller and job 11 (for the owner to pass on):**
1. **Footer.** The owner wants the shared footer to look like Framer's, with social icons and the newsletter box.
   - Social icons: Instagram only for now (`instagram.com/almarprivatejourney`).
   - Newsletter box: slice 3 plan 27 makes it real after job 10.
2. **Slideshow.** `/destinations` needs job 11's slider to also work as a **full-width hero**.
   - The kicker and `<h1>` sit on top (A1/A3).
   - One dot per photo, and a pause control.
   - It stops on hover or focus and is still with reduced motion.
   - Every slide is a static `<img>` in the served HTML.

   Job 11's design today has one still hero photo; its only slider is the stay gallery (A11). If job 11 adds
   the hero mode, plan 13 uses it. If not, plan 13 adds that mode to job 11's slider, never a second slider
   (reconcile S2-17).

Recorded in slice 2 `job07-framer/S2-FRAMER.md`.

## Sizes (third plan check, 2026-10-04)

The 88 / 48 and 32 / 24 px above are Framer's measurements, not new sizes. The owner's answer 2 to job 11 ("keep
the signed scale 12·14·16·20·32·48·64, no new size token") is site-wide:
- the `<h1>` uses job 11's home heading size: 64 px from tablet up, 40 px on phone;
- card names use job 11's card: 32 px, and 24 px on phone (Framer's own 24);
- the region line is 14 px.

Gaps: Framer's 40 / 20 px become our nearest allowed spacing, 32 / 16 px. The layout stays the same: two
columns, square cards, Cocora Valley centred. Reconcile S2-20 and S2-23 (corrected after the fourth plan
check).

## Alt text for the three hero photos (plan check, 2026-10-04)

Framer's published `alt` text is wrong for two of the three photos.
- `4d62ca4792adaf59.webp` is a living room. Framer says "arched wooden door".
- `63ab3e6e8d9dec4a.webp` is a black marble bathroom with a freestanding tub and a sea view. Framer says
  "infinity pool".

What we use:
- **hero-1:** the alt the home gallery already publishes for the same file, "Minimalist living room inside a
  Mediterranean villa" (AR and ES as published there).
- **hero-2:** a plain description, "Black marble bathroom with a freestanding bathtub and a sea view". It is
  new wording, marked for his review in the slice 2 hand-over.
- **hero-3:** Framer's words, reordered: "Arched hallway inside a Mediterranean modern hotel".
