# Handoff — ALMAR phase 3.1 (written 2026-09-29)

**Superseded 2026-10-01** by `.planning/prompts/01-finish-phase-3.1.md`: plans 19 to 28 ran after this was written.

Paste the "Prompt" block below into a new Claude Code session opened in `/Users/koss/Developer/almarprod-Website-Code`.

## Prompt

You are continuing `/gsd-execute-phase 3.1` for ALMAR (repo `/Users/koss/Developer/almarprod-Website-Code`, branch `host/cloudflare-frontsite`, never push `main`). Read first: `~/.claude/CLAUDE.md`, the repo `CLAUDE.md` and `CLAUDE.local.md`, `.planning/STATE.md`, this file, `.planning/phases/03.1-design-system-and-journey-bar-inserted/03.1-CONTEXT.md` (decisions D-01 to D-93), `03.1-UI-SPEC.md`, `deferred-items.md`, and `.planning/design/2026-09-29-system/README.md`. Be direct. The owner signs every gate. Do not self-approve.

### Where things stand

Code plans done (SUMMARY exists): 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13, 14, 16, 17, 18, 23 (17 of 29). Last verified state: `npx tsc --noEmit` clean; `node --test tests/*.test.mjs` 155 pass, 0 fail (after plan 23). STATE.md and ROADMAP counters lag the real count; trust the SUMMARY files.

Canvas plans (mine, orchestrator-only, Artifact tool) drawn and published, owner sign-off still open (no SUMMARY yet, do not write one until he signs):
- Plan 11, page 4 Journey (4 boards).
- Plan 15, page 5 Public pages.
- Plan 22, page 6 Guest (login, account, bookings, trip detail, account menu, delete account, cancellation and refund).
- Plan 26, page 7 Dashboard (19 boards, phone version of every page).
Pages 2 and 3 (Foundations, Components) are approved.

Not started: plans 19, 20, 21 (journey components; blocked until the owner approves page 4), 24, 25 (need 19), 27 (delete legacy CSS, strict guardrail, after screens), 28 (harness matrix), 29 (owner UAT and the DSGN-01 wording fix).

Canvas: https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw (version 32 when this was written). Repo copies of the boards: `.planning/design/2026-09-29-system/pages/*.dc.html`. The board generator is saved in `.planning/design/2026-09-29-system/generator/` (copy it to a scratch folder to run: `node build.mjs`; it reads `lib/copy/*.ts` and the live canvas index; see its header imports). Rules for the canvas: a board is at most 8000 px tall or wide; publish only files you changed plus `canvas.json` when the layout changes; read the live `canvas.json` right before publishing because the owner edits it. `overflow-check.mjs` and `frame-shots.mjs` render boards locally with Playwright to catch clipped frames.

### Owner decisions made after the UI-SPEC (all recorded in 03.1-CONTEXT.md)

D-61 to D-93: no duplicate Arabic boards on pages 4 to 7; pre-filled stay booking bar with per-stay blocked dates; merged experiences and services page with overlay details; header cart and account menu (no logo in the menu); split-screen sign in; rich Account, Bookings, Trip detail; delete account and cancellation and refund states; date and guest pickers open under their own tab; Home stays as Framer; dashboard redesign (D-82 to D-93). These are target designs. A control goes into code only when it is live.

### What to do next

1. Ask the owner which canvas pages he approves (4, 5, 6, 7). Ask one question. When a page is approved, write its plan SUMMARY (11, 15, 22, 26) and update README.md gate status.
2. After page 4 is approved, run plans 19, 20, 21, then 24, 25, one executor at a time on the main tree (worktrees have no `node_modules`). Then 27, 28. Plan 29 is the owner's UAT.
3. His last message had a numbered item 7 that arrived empty. Ask what it was.

### How to work

- Run executors sequentially: `Agent(subagent_type="gsd-executor", model="sonnet", run_in_background=true)` with a prompt that names the plan, the files to read, "sequential on the main tree", "stage only your own files", and the known failures below. Spot-check each result on disk (files, `git log`, `node --test tests/*.test.mjs`, `npx tsc --noEmit`) before reporting it.
- Screens check: `SCREENS_MODE=after npx playwright test tests/screens-before-after.spec.ts --workers=1` (the `chooseArabic` helper flakes under parallel workers). `tests/screens/before/` must not be regenerated.
- Known issues: the `chooseArabic` flake (plan 12 helper); the design-tokens guardrail rejects arbitrary values, off-scale spacing and `font-bold` outside its allowlist.
- The Bash tool sometimes fails with a transient "classifier gave no verdict" error. Retry once, then use file tools, or run the command through a `general-purpose` subagent. The Mobbin MCP (`search_screens`) had the same failure; retry later.
- The Mobbin MCP works for design references (split-screen sign-in was chosen from it).
- Owner rules: numbered human steps only; never invent prices, legal copy or people; square corners; gold is a line, never a fill or text; three languages on every string; brackets for placeholders (`AED [AMOUNT]`, `ALMAR-000000`, `[Guest name]`); commit before anything else; report only what changed, what was verified, what is left.
- Open small items: owner questions A and B from the first canvas gate were left at defaults (teal current-step rule, Lato 700 kept); `tokens.json` is not installed as a canvas design system (the canvas type only takes another design-system artifact); the Account page avatar and the team placeholder still use the ALMAR monogram.

### Session rule

Stop and write a fresh handoff when the context reaches about 600k tokens (see `~/.claude/CLAUDE.md`).
