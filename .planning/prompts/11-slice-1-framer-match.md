# Job 11 — slice 1 after UAT: Framer match on home and the stay page, and the two booking buttons

Read `00-common-rules.md` first, then `06-public-site-slice-1.md`, then
`decisions/2026-10-04-slices-reconcile.md` section "Slice 1 UAT". You are a work session, not the controller.

**Branch:** `gsd/phase-3.3-s1-framer-match`, cut from `origin/gsd/phase-3.3-slice-1` (`6264c59`: slice 1 with
plan 08, clean-clone checked at `693c21a`, plus the UAT pictures). Your first command, inside the worktree the app made for this session:
`git fetch origin && git switch -c gsd/phase-3.3-s1-framer-match origin/gsd/phase-3.3-slice-1`
**Model:** Opus 5.5, effort High, lead; Sonnet 5.5 High executors.
**Slice 1's Ship waits for this job.** The controller merges your hand-over into `gsd/phase-3.3-slice-1`, checks
it in a clean clone and asks him for UAT again.

## The owner's answers (2026-10-04, UAT of the local preview)

1. **Home Search.** The home booking bar gets its Search button. It takes the guest to `/private-stays`
   (`/ar/private-stays`, `/es/private-stays`) showing only stays in the chosen destination, free on every
   chosen night (the stay's blocked dates in the data layer), that sleep the chosen guests. The list page
   shows those filters as set and the guest can change or clear them. On the phone the three-step sheet ends
   on the same Search. Use the bar's existing error states when a step is missing. The blocked dates are
   still examples: keep the existing "examples" note wherever availability is used.
2. **Stay page button.** The stay page's booking bar (destination and stay locked) gets a "Request on
   WhatsApp" button: it opens `https://wa.me/971563883302` with the stay, the dates and the guests already
   written, in the page's language. Decide and state what it writes when dates or guests are not chosen yet.
3. **Framer match: home and the stay page only.** Rebuild both, section by section, to the live Framer pages
   (`https://almarprivatejourney.com/` and any `/private-stays/<slug>`, still Framer in production): layout and
   widths, centred large headings, type sizes, spacing, portrait cards with the name on the photo, the sliding
   galleries (arrows, dots, swipe), the thin divider lines, the two-column About with the facts on the stay
   page, and the scroll animations (measure them on the live page: which elements, opacity and movement,
   duration, delay, easing, trigger). EN/AR/ES at 390, 834 and 1440; Arabic mirrors.
   **`/private-stays` is NOT matched to Framer** (his words: "this one dont match it keep it as you did it"):
   it keeps the React layout as built and only gains the filtered arrival from answer 1.

What the controller measured, for your start (pictures on the slice branch,
`.planning/phases/03.3-public-site-in-react/uat-2026-10-04/compare-*.png`): the React home is 7,587 px tall
against Framer's 12,066 px with the same 11 sections in the same order; React has 0 animated elements, Framer
35; the React footer is dark, Framer's is light.

## Rules that still win over Framer

Nav order and wordmark (`CLAUDE.local.md` "Public nav"), square corners, gold as a line only (never a fill,
text or icon), no radio controls, no fake controls (the cart, Login, newsletter form, "List with us", stay
`Add`, "See Packages" stay held until each is real), no invented text, price or person, `tokens.json` values
only (a Framer value with no token: propose the token, do not hard-code it), components from `components/ui`
(a missing primitive goes there, never a page one-off), content visible with JavaScript off (an animation
never hides content that has not run), and `prefers-reduced-motion` turns the movement off.

**Ask him (one question each, recommended first) before you design them:** the footer and the header are one
shared frame on all three pages; matching Framer's light footer on home and the stay page changes it on
`/private-stays` too, unless he wants two footers. Also any package you would add for the animations
(`package.json` is a shared file: the controller grants it once he agrees).

## Your stops

1. **Design signature.** Pictures: each section of home and the stay page as Framer shows it today, beside
   what you will build where it must differ (a signed rule, a held control, the two new buttons and their
   states), at 390 and 1440 in EN and AR, plus the animation list. Commit, push your branch, ask him in this
   chat through the question form. Stop until he signs.
2. **Plan signature.** GSD plans in the phase folder numbered `03.3-40` to `03.3-49`, checked by an Opus plan
   checker; push, ask him to sign, stop.
3. **Build** after he says go: Sonnet executors, every changed test made to assert the new behaviour (the
   held-control and "no submit button" checks from plans 04, 06 and 08 change for these two buttons only),
   the full check set from `00-common-rules.md` once on the final commit, `HANDOVER.md` with his numbered test
   steps. Push your branch, tell the owner in one line, stop.

Ports 3081–3089. You do not send messages to the controller (they are held for his approval and have expired
before). Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `decisions/` or `prompts/`.
