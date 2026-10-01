# Rules every ALMAR work session follows

You are a work session, not the control session. The control session is the only one that lands
work on GitHub, applies migrations to the live Supabase project and deploys Worker `almar`. It is
the session "ALMAR control session", id `local_90a0e6e2-4bce-4142-b7d6-2fd05b2a84e1`; message it
with SendMessage. Method: skill `control-session`.

## Read first, in this order
1. `/Users/koss/Developer/almarprod-Website-Code/CLAUDE.local.md` by that absolute path (it is
   gitignored, so your worktree does not have it), section "One job, one branch, one ship". Binding.
2. `~/.claude/CLAUDE.md`, `.claude/rules/connections.md`, `.hermes.md`.
3. The auto memory index
   `~/.claude/projects/-Users-koss-Developer-almarprod-Website-Code/memory/MEMORY.md` and every
   note it lists.
4. `.planning/GOAL.md`, then `.planning/CONTROL-BOARD.md`: what is live, what is in work, the
   order, the base for new branches, reserved numbers.
5. `.planning/decisions/`: every file. Owner-approved texts are used verbatim.
6. Your job's prompt file in `.planning/prompts/`, then the phase files it names.

## Facts on 2026-10-01, verify each
- Live: https://almarprivatejourney.com and www on Worker `almar`, serving the static Framer
  export (`scripts/assemble-cloudflare.mjs` builds `out/`). `/booking/trip`, `/account`,
  `/login` and `/dashboard` are not live.
- GitHub `Loomlyne/almar` (private). The control board names the base for new branches.
- Next.js 15.5.26 (bumped in 02-08 on 2026-09-26; `PROJECT.md` still says 14.2.35), React 18.3,
  `@opennextjs/cloudflare` 1.20.6 installed, wrangler 4.141, Tailwind v4 (4.3.3) generated from
  `tokens.json` (`npm run tokens`). The design
  system is the claude.ai canvas https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw. `/design` and
  `/framer` are deleted.
- Supabase: one project (plan 02-01), the app is not wired, no `.env.local`. Stripe and Resend:
  connected, nothing live. Never read, print or write a secret value.
- Dev server: `npm run dev -- -H 127.0.0.1 -p 3010` (port 3000 belongs to another product).
  `npm run build` kills a running dev server; restart it after. Harness pages need `ALMAR_HARNESS=1`.
- There is no GitHub Actions workflow. The control check in a clean clone is the CI.

## Your folder
- Work only in your own folder `/Users/koss/Developer/almar-wt/<job>` (a git worktree) on your own
  branch. Run `npm ci` there first: a new worktree has no `node_modules`.
- No push to main, no PR, no deploy, no hosted SQL. You may push your own branch.
  `git stash` is forbidden except its `list` and `show` forms.
- Add files to git by name. Never add a whole folder.
- Do not edit `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/CONTROL-BOARD.md`,
  `.planning/GOAL.md` or `.planning/decisions/`. Send the change to the control session.
- Ask the control session for a migration number before you write a migration.
- Shared files: `lib/copy/*.ts`, `tokens.json` and the generated theme, `app/globals.css`,
  `next.config.ts`, `package.json`, `package-lock.json`. Append, do not reorder, and name every
  change to them in the hand-over.
- Merge the base into your branch before every hand-over. The base wins a conflict unless the owner
  says otherwise.
- `tests/screens/before/` is never regenerated.

## The owner
- He wants speed. One decision per question, through the question form, plain words, the page or
  canvas board named, one example, the recommended option first. Never re-ask what a decisions file
  or a handoff already answers.
- He signs discuss, design, plan, UAT and every ship. A design (canvas board, or screenshots at
  390, 834 and 1440 in EN and AR) is signed before code.
- Never invent a price, a rate, a person or legal text. Placeholders stay in brackets.
- EN, AR and ES in the same pass; AR is RTL. Square corners. Gold is a line only. No radio
  controls. Checked at 390, 834 and 1440.
- A control that is shown works end to end, or it is not shown.
- His gates, one numbered step each, then wait: Cloudflare Worker or Pages, DNS, R2, Supabase
  settings, Stripe live, Resend domain, any secret or password.

## Models
- Lead of a job that touches money, the database, auth or security: Opus 5.5.
- Lead of a mechanical job (tests, clean-up, copy moves): Sonnet 5.5.
- Sub-agents: Sonnet executes a signed plan; Opus plans or checks a plan. GSD `model_profile`
  stays `balanced`. The strongest model for sub-agents only with the owner's OK.

## Hand-over
One file, `HANDOVER.md`, in your phase or quick folder: final commit; folder clean; every check
with its result on that commit (`npx tsc --noEmit`, `node --test tests/*.test.mjs`,
`npm run tokens:check`, `npm run build`, and the Playwright specs you touched with
`--workers=1`, or the full set with its count); what was NOT verified, in plain words; new
migrations and whether each is safe on real rows; new settings or environment names (names only,
never values); numbered owner UAT with the expected result of each step (a TEST payment first when
checkout is touched). Then stop, message the control session with the commit and the file path,
and tell the owner in one line.

## Disk
- One local database stack per session, if any. Stop it when the session is idle.
- When your job has landed, the control session removes your folder, its stack and its build
  output the same day, after checking that the branch tip is on GitHub. You never remove a
  folder, a branch or a stash yourself.
- Agents run the tests they touched; the lead runs the full set once. Playwright runs with
  `--workers=1` (the `chooseArabic` helper flakes in parallel).
