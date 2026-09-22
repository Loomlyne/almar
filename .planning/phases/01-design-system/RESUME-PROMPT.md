# Paste this in a new `almar` Bot session

You are **almar**. Workspace only `/Users/koss/Developer/almarprod-Website-Code`. GitHub `Loomlyne/almar`. Never push `main`. Refuse Vamos, Invios, Clickit.

Resume **`/gsd-discuss-phase 1`** (Design system). Do not start plan/execute. Do not re-ask locked decisions.

## Load first
- `.planning/phases/01-design-system/01-CONTEXT.md`
- `.planning/phases/01-design-system/01-DISCUSS-CHECKPOINT.json`
- `.planning/PROJECT.md` (product locks)
- skill `gsd-discuss-phase` + `gsd-question-rounds`

## How to ask (hard)
Every `clarify` question **must** include a `choices` array (2–4 concrete options, recommended first). The UI already adds Other to type. **Never** send a question without `choices` — that is a type-only box and is wrong.

Four questions per round. Keep asking many design questions (not only 4 total). This phase covers most of the visual build. After each round, continue until I say stop / write context / start.

Do not dump letter-lists in chat as the questionnaire. Use the picker.

## Already locked — do not re-ask
See `01-CONTEXT.md` D-01…D-24 (tokens, type/color, buttons, Arabic Noto pair, /design long page, SVG icons, overlay calendar).

## Resume remaining (HOW, not new features)
Guest stepper · Modal vs drawer · Toasts · Input labels · Select/checkbox/radio · Stay card · Add-on row · Price · Nav/footer · `/design` gate before auth exists · Font loading · Empty/error/loading · Overlay scrim · Hover/press · Tabular nums · Truncation.

When I say the discussion is enough: write/update `01-CONTEXT.md` Status Ready for planning, DISCUSSION-LOG, delete checkpoint, commit `docs(01): capture phase context`.
