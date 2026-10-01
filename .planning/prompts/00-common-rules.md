# Rules every ALMAR work session follows

You are a work session on the owner's Mac. You are not the controller. Only the "ALMAR controller"
(`local_836ffacc-ca03-41c4-b1ff-385b8aa9d357`, pinned, sidebar group ALMAR; owner's choice 2026-10-02,
replacing `local_90a0e6e2-…`) lands work on GitHub `main`, applies migrations to the live Supabase
project and deploys Worker `almar`. The claude.ai cloud project ended 2026-10-01. Message the
controller with SendMessage. Decisions behind this: `.planning/decisions/2026-10-01-control-session.md`
and `2026-10-01-cloud-project.md` (the cloud part is ended).

## Base branch
- Phase 3.1 landed on `main` on 2026-10-02 (`9fd6786`). Cut every branch from `origin/main` and merge
  `origin/main` before the hand-over. `host/cloudflare-frontsite` is deleted.
- Only the controller moves `main`.
- Cloudflare: ALMAR is on account "Almar Private Journey" `f1d9a1fa…` since 2026-10-02. A work session
  never deploys; a push to any branch builds a Pages preview at `*.almar-khb.pages.dev`.

## Read first, in this order
1. Cloud: the project instructions. Mac: `/Users/koss/Developer/almarprod-Website-Code/CLAUDE.local.md`
   by that absolute path (it is gitignored), section "One job, one branch, one ship", then the auto
   memory index `~/.claude/projects/-Users-koss-Developer-almarprod-Website-Code/memory/MEMORY.md`.
2. `.claude/rules/connections.md` and `.hermes.md`. `HERMES.md` is a stale snapshot that GSD loads:
   where it disagrees with the code or these files, it loses.
3. `.planning/GOAL.md`, then `.planning/CONTROL-BOARD.md`.
4. `.planning/decisions/`: every file. Owner-approved texts are used verbatim.
5. Your job's prompt file in `.planning/prompts/`, then the phase files it names.

## Facts on 2026-10-01, verify each
- Live: https://almarprivatejourney.com and www on Worker `almar`, serving the static Framer export
  (`npm run build`, then `scripts/assemble-cloudflare.mjs` builds `out/`). `/booking/trip`,
  `/account`, `/login`, `/dashboard`, `/fx`, `/newsletter` and `/__harness` answer 404 on live.
- GitHub `Loomlyne/almar` (private). There is no GitHub Actions workflow: the control check in a clean
  clone is the CI.
- Next.js 15.5.26, React 18.3, `@opennextjs/cloudflare` 1.20.6 installed (server runtime not
  configured: plan 02-08 Task 2), wrangler 4.141, Tailwind v4 (4.3.3) generated from `tokens.json`
  (`npm run tokens`). The design system is the claude.ai canvas
  https://claude.ai/artifact/6MqV4cd2KzXLsVputN2ctw; a copy of its 63 boards (2026-10-01) is in
  `.planning/design/2026-10-01-canvas/`. `/design` and `/framer` are deleted.
- Supabase: one project (plan 02-01); the app is not wired; no `.env.local`; its three names are
  secrets on Worker `almar`. Stripe and Resend: nothing live. Never read, print or write a secret value.
- Dev server: `npm run dev -- -H 127.0.0.1 -p 3010` (on the Mac, port 3000 is another product).
  `npm run build` kills a running dev server; restart it after. Harness pages need `ALMAR_HARNESS=1`.

## Your branch and files
- One job, one branch (`gsd/phase-<n>-<slug>` or `fix/<slug>`), cut from the base, pushed to GitHub.
  Cloud: your thread's checkout. Mac: your own worktree `/Users/koss/Developer/almar-wt/<job>`; run
  `npm ci` there first.
- Never push `main` or `host/cloudflare-frontsite`. No PR unless the owner asks. No deploy, no hosted
  SQL, no change to Cloudflare, DNS, R2, Supabase settings, Stripe or Resend. Live probes are plain GET
  requests unless the owner says yes. `git stash` is forbidden except its `list` and `show` forms.
- Add files to git by name. Never add a whole folder.
- Do not edit `.planning/STATE.md`, `ROADMAP.md`, `CONTROL-BOARD.md`, `GOAL.md` or `decisions/`. Put
  the proposed change in your hand-over; the control session applies it at ship.
- Ask the coordinator (on the Mac: the control session) for a migration number before you write a
  migration, and before you touch a shared file: `lib/copy/*.ts`, `tokens.json`, `app/globals.css`,
  `next.config.ts`, `package.json`, `package-lock.json`, `tests/design-tokens.test.mjs`. Two jobs never
  edit the same file at once.
- Merge the base into your branch before every hand-over. The base wins a conflict unless the owner
  says otherwise.
- `tests/screens/before/` is never regenerated.

## The owner
- He wants speed. One decision per question, through the question form, plain words, the page or
  canvas board named, one example, the recommended option first. Never re-ask what a decisions file
  or a hand-over already answers. His "done", "correct" or "working" is a pass.
- He signs discuss, design, plan, test and every ship. A design (canvas board, or screenshots at
  390, 834 and 1440 in EN and AR) is signed before code.
- Never invent a price, a rate, a person or legal text. Placeholders stay in brackets.
- EN, AR and ES in the same pass; AR is RTL. Square corners. Gold is a line only. No radio controls.
  Checked at 390, 834 and 1440.
- A control that is shown works end to end, or it is not shown.
- His gates, one numbered step each, then wait: Cloudflare Worker or Pages, DNS, R2, Supabase
  settings, Stripe live, Resend domain, any secret or password.

## Models
- Opus 5.5 for planning, reviews and anything touching money, sign-in, the database or security.
  Sonnet 5.5 for routine building and plan executors.
- After every change to money, sign-in or the database, a fresh reviewer thread reads the diff before
  the hand-over.
- GSD `model_profile` stays `balanced`. The strongest model for sub-agents only with the owner's OK.

## Hand-over
1. Run the full check set on the final commit:
   `npm ci`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run tokens:check`,
   `npm run build`, then `npx playwright install chromium` once and `npx playwright test --workers=1`
   (set `PW_PORT` if port 3010 is taken). Not `npm test`: it runs Playwright with parallel workers.
   Agents run only the tests they touched; the lead runs the full set once.
2. Write `HANDOVER.md` in your phase or quick folder: branch and final commit; folder clean; every
   check with its result on that commit; what was NOT verified, in plain words; each migration and
   whether it is safe on live data; environment names added (never values); proposed changes to
   state, roadmap, board or decisions; the owner's numbered test steps, each with the page and the
   expected result (a TEST payment first when checkout is touched); lessons from his corrections.
3. Push your branch, report the commit and the file path to the coordinator (on the Mac: the control
   session), tell the owner in one line, and stop.

## Mac only: disk
- One local database stack per session, if any (ALMAR has none today). Stop it when the session is
  idle.
- When your job has landed, the control session removes your folder, its stack and its build output
  the same day, after checking that the branch tip is on GitHub. You never remove a folder, a branch
  or a stash yourself.
