You run job 04 for ALMAR: a repo tidy plus three small live-page fixes, before any feature job. The owner
approved every item below on 2026-10-02 (`.planning/decisions/2026-10-02-cleanup.md`).

Read `.planning/prompts/00-common-rules.md` first and follow it.

RUNS FIRST, before job 02. Folder `.claude/worktrees/repo-tidy`, branch `fix/repo-tidy`, cut from
`origin/main`. Lead: Sonnet 5.5. Drive it with `/gsd-quick`; one commit per item. The controller approved
touching these shared files for this job only: `package.json`, `package-lock.json`, `wrangler.toml`,
`.gitignore`.

REPO ITEMS
1. Delete leftovers: `PLAN_FIX_ALL.md` (old Framer/Vercel plan), `_README.txt` (Framer exporter note),
   `vercel.json`, `Dockerfile` and `.dockerignore` (node:20, never the deploy path). First grep code,
   tests and docs for references; fix or report each one.
2. `package.json`: add `"engines": { "node": ">=22.18" }` (the assemble script and node tests import `.ts`).
3. `wrangler.toml`: add `account_id = "f1d9a1fa3abdda98c15161b00b40385c"` so no deploy can reach the Vamos
   account, and set `workers_dev = false` (the duplicate address `almar.almar-private-journey.workers.dev`
   goes away at the next deploy). Extend `tests/host-config.test.mjs` to assert both.
4. `wrangler` devDependency 4.141.0 to exactly 4.146.0 (`npm install -D -E wrangler@4.146.0`); this fixes
   the high `undici` alert. Run `npm audit` before and after and report both.
5. Declare the two packages the code uses without listing them, at the versions already in the lockfile,
   exact: `@radix-ui/react-focus-scope` (imported by `components/ui/dialog.tsx` and
   `components/ui/confirm-dialog.tsx`) and `esbuild` as a devDependency (the dev-only
   `/embed/hero-booker` route). Change nothing else in the lockfile on purpose.
6. `.gitignore`: add `.DS_Store`, `.claude/worktrees/`, `.env`, `.env.*` (keep `!.env.example` tracked)
   and `.dev.vars`.
7. `tests/screens/after/`: its 24 files are tracked but the folder is listed in `.gitignore`. Find which
   tests read it. If a test does, remove the ignore line; if none does, untrack the folder. Report which.
8. `.claude/rules/connections.md`: replace "Supabase has no project yet — do not create one unless he
   says." with: one Supabase project exists since plan 02-01 (Storage off); the app is not wired yet;
   never create another.
9. `README.md`: replace the Vercel text with how this repo really builds and deploys (static `out/` on
   Worker `almar`, deploy by the controller only). Remove the dead comment in `app/route.ts` that points
   at `lib/nextjs-export.ts` (that file does not exist).

LIVE-PAGE ITEMS (Framer HTML in `app/**/route.ts`; the owner allowed these edits only)
10. Remove the three invented team members (Ana Velásquez, Mateo Ríos, Sofía Marín) from `app/route.ts`,
    `app/about/route.ts` and `app/contact/route.ts`, in every language the page carries. Delete only; add
    nothing. If a team block would be left with a heading and no people, remove the whole block. Add a
    node test that fails if any of the three names appears anywhere under `app/`, `components/` or `lib/`.
11. Hide the 8 footer links that answer 404 (5 `./legal/*` links, and the stays `yury-house-cartagena`,
    `corona-island`, `baru-house`) on every page that carries them. No new pages, no new text. Add a node
    test that fails if a page links to a path that has no route.
12. Point the JSON-LD at `https://almarprivatejourney.com` instead of `almarprod.framer.website` on every
    page. Add a node test for it.

NOT IN THIS JOB
- No other refactor, no dependency other than items 4 and 5, no change to tokens or React copy, no deploy.
- The `postcss` alert inside `next` needs Next 16 (a major): report it, do not fix it.
- Legal pages, robots, sitemap and security headers are Phase 6.

HAND-OVER
Full check set (common rules) on the final commit, plus screenshots of Home, About and Contact at 390, 834
and 1440 in EN and AR, before and after, for items 10 and 11. Hand-over in
`.planning/quick/<id>-repo-tidy/HANDOVER.md`. The owner's test steps:
1. Open the before and after screenshots in the hand-over. Expected: the three people and the dead links
   are gone; nothing else on the pages moved.
2. On GitHub, open branch `fix/repo-tidy`, Files changed against `main`. Expected: only the files named in
   items 1 to 12, the lockfile and the new tests.
3. After the controller's deploy (your word), open https://almarprivatejourney.com/about and
   https://almarprivatejourney.com/nothing-here. Expected: About without the three names; the branded 404.
