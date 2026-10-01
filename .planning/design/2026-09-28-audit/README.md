# ALMAR design audit and journey bar — 28/09/2026

**Superseded 2026-10-01** by `../2026-10-01-canvas/`, a copy of all 63 current boards. This folder is kept as history.

Source canvas (owner can open it): https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw
These `.dc.html` files are the same boards as that canvas, copied here so Claude Code can read them.
They are design references, not app code. Do not import them into the app.

## Boards

| File | What it is |
|---|---|
| boards/Main.dc.html | 1 · Verdict: keep brand and Framer look, rewrite public page code, consolidate the design system, restyle the dashboard |
| boards/Evidence.dc.html | 2 · Screenshots and repo numbers |
| boards/Drift.dc.html | 3 · Colour and type drift, contrast checks, plumbing issues |
| boards/Plan.dc.html | 4 · The decided order (matches ROADMAP 3.1 → 3.2 → 3.3 → 4 → 5 → 6) |
| boards/Hero.dc.html | 5 · Desktop hero with the 72px journey bar (Destination · Dates · Guests · Search), dropdown panels |
| boards/HeroPhone.dc.html | 6 · Phone: one tap target "Plan your journey", then 3 steps Where → When → Who |
| boards/PhoneWhere/When/Who.dc.html | 6a–c · The three phone steps (import HeroPhone with a start step) |
| boards/BookerKit.dc.html | 7 · Design-system spec: tokens, states, Arabic RTL bar, components to build, rules |
| boards/Flow.dc.html | 8 · /booking/trip add-ons step: scrollable list with image rows, multi-select, filters, cart rail |
| boards/FlowPhone.dc.html | 8a · Same step on phone |

## Behaviour approved by the owner

- Phone booking entry is one tap target in the hero, then one question per screen: Where → When → Who, with Back, Close and a progress bar. Tapping a destination moves on by itself. The bottom bar shows the summary and one button. Search/Next validate; they are never disabled.
- Desktop bar is 72px, labels in normal case, values in Lato 16. Gold is only the 2px top rule.
- Experiences and services always show an image. The list scrolls. The guest can add as many as they want. The cart lists every add-on with a remove control.
- Prices are `AED [PRICE]` until real rates exist in the catalog. Never invent amounts.

## Tokens used in the boards

ivory #fffaf0 (bg) · white #ffffff (surface) · teal #1f3b40 (primary) · teal tint #d1dfe0 (primary-soft, backgrounds only) · gold #d4ba8a (2px rule only) · charcoal #262626 (ink) · muted #63615f (ink-3) · line rgba(38,38,38,.16) · error #8f2d2d. Radius 0. Questa display, Lato body, Noto Naskh / Noto Sans Arabic. Controls 44px.

## Images in the boards → files in this repo

The boards load images from the canvas (`/_blob/...`). The same pictures are in the repo:

| Board image | Repo file |
|---|---|
| Hero courtyard | public/assets/img/caedcb84dd0d35bb.webp |
| Getsemaní Colonial House | public/assets/img/59682878de873329.webp |
| Home pickup (car) | public/assets/img/d93681892835d48b.webp |
| VIP Airport Meet & Greet | public/assets/img/640c57b0d03641cc.webp |
| 24/7 Private Concierge | public/assets/img/fad99748eb29b7f8.webp |
| Cartagena Walled City Night | public/assets/img/0787c0615a96af62.webp |
| Cartagena Heritage Tours | public/assets/img/2e8e18393ba7bc74.webp |
| Rosario Islands Escape | public/assets/img/0dadd08a491bfc52.webp |
| Yacht & Island Charters | public/assets/img/85bdc83c0860c091.webp |
| Welcome Cocktail at Sunset | public/assets/img/726c964e0318bf1b.webp |
| Gourmet Food Tours | public/assets/img/8d72e5577734778a.webp |
| Private Beach Experiences | public/assets/img/54482d988b8f11b3.webp |
| Traditional Cooking Classes | public/assets/img/81840f01e4039621.webp |
| Wordmark white / black | brand/Logo Typography/Poly_White.svg, Poly_Black.svg |
| Monogram | brand/Logo Monogram/Curves_White.svg, Curves_black.svg |
| Fonts | brand/Font/questa-webfont, brand/Font/lato |

In the real app, catalog images come from the dashboard (Cloudflare URLs), not from these files.
