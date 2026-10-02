# Job 05 — delete another property's name from the 12 live stay pages

Read `00-common-rules.md` first. You are a work session, not the controller.

**Branch:** `fix/mariven-text` · **Worktree:** `.claude/worktrees/mariven-text`, cut from `origin/main`
**Model:** Sonnet 5.5 (mechanical deletion, no money, no auth, no database)
**Owner's decision:** `decisions/2026-10-02-cleanup.md`, 13:35 — fix now, **deletion only, no new copy**

## The defect

All 12 `/private-stays/*` pages carry this sentence, live today:

> From cozy beachfront rooms to luxurious oceanfront suites, each space at Mariven  is thoughtfully
> designed for comfort and style.

"Mariven" is a different property. It is leftover template text from the Framer export, one occurrence
per file, in these 12 files:

`app/private-stays/{baru-island-private-villa,bocagrande-beach-house,cartagena-historic-center-house,casa-jardin-san-diego,casa-juliana-historic-center,casa-mariana-historic-center,getsemani-colonial-house,getsemani-courtyard-residence,private-island-cartagena,private-island-estate-cartagena,santa-fe-farm-antioquia,sopetran-country-estate}/route.ts`

Note `casa-mariana-historic-center` is a real ALMAR stay — do not confuse "Casa Mariana" with "Mariven".

## Scope

Delete the whole sentence and the element that holds it. Do not write replacement copy, do not rename the
property, do not touch any other text on those pages. Nothing else in this job.

## The trap that broke the last Framer fix

Job 04's footer fix passed its node tests and was still a fake control: the text was right in the file and
Framer's own client router ignored it in the browser. The lesson is on the control board and in the repo
memory. So:

1. ~~Remove it from the server HTML and grep for zero hits per file.~~ **CORRECTED 2026-10-02 by the
   controller: this acceptance criterion was wrong and cannot be met on a Framer page. Do not judge this
   branch against it.** Two sessions measured the same result independently: Framer's CDN code owns this
   sentence as a component default, so deleting it from the HTML string leaves the *built file* clean (0 hits
   in `out/…/baru-island-private-villa.html`) while the *rendered page still shows "Mariven"* after
   hydration, with a flood of "Caught a recoverable error" in the console. Deletion is not risky here, it is
   **ineffective**. Removing the wrapper instead makes React rebuild the whole page client-side — the
   94 → 62 mobile Performance regression warned about at the top of all 12 files.
   **The correct criterion for a Framer page is behavioural, not textual:** the sentence is neither visible
   nor announced in a real browser after hydration, and hydration still reuses the server `h1`, `nav` and
   `footer` nodes. Expect the words to remain in the page source until Phase 3.3 replaces the page in React.
   Keep this paragraph for the next Framer edit.
2. The guard is a **browser** assertion, not a file-text assertion. Add to `tests/` a Playwright check that
   loads a real build of all 12 pages and asserts the rendered DOM contains no "Mariven" after hydration
   settles. A node test that only reads the file is not enough and was exactly how the last fix slipped through.
3. Check the three languages: if the sentence has AR or ES copies anywhere, they go too.

## Hand-over

Full check set from `00-common-rules.md` on the final commit, then `HANDOVER.md` in
`.planning/quick/<id>-mariven-text/`. Include the owner's numbered test steps: the page, the click, and
the expected result, for at least 2 of the 12 pages at 390 and 1440.

Then push your branch, message the controller, tell the owner in one line, and stop. You do not deploy.
