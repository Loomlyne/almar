# Job 04 hand-over: repo tidy plus three live-page fixes

Work session, 2026-10-02 02:55–03:44 +04 (Opus 5.5 session; the prompt named a Sonnet lead, the items were run inline without sub-agent executors). Prompt: `.planning/prompts/04-repo-tidy.md`. GSD quick
`261002-42w` (`261002-42w-PLAN.md`, `261002-42w-SUMMARY.md` in this folder).

## Branch

- Branch `fix/repo-tidy`, cut from `origin/main` `7c5774f`; `origin/main` had not moved at hand-over, so no merge.
- Final code commit: `2e4fe87` (items 1–12, one commit each). After it, two planning-only commits: the
  screenshots, then these notes. The screenshots commit (`screens/`, 7.1 MB) can be left out of the squash.
- Folder `.claude/worktrees/repo-tidy` clean after the last commit (`git status` empty; build output `.next/`,
  `out/` and `test-results/` are ignored and left for the controller's clean-up).

## Checks on `2e4fe87`

| Check | Result |
|---|---|
| `npm ci` | pass (456 packages) |
| `npx tsc --noEmit` | pass |
| `node --test tests/*.test.mjs` | pass, 193/193 (160 before + 27 JSON-LD + 4 dead links + 2 host config) |
| `npm run tokens:check` | pass, theme up to date |
| `npm run build` (run inside `node scripts/assemble-cloudflare.mjs`) | pass; 48 static pages; `out/` has 27 HTML files |
| `out/` scan | none of the 27 HTML files carries the three names, `almarprod.framer.website`, or a link to the 8 hidden paths; the three portraits are not in `out/assets/img/` |
| `wrangler deploy --dry-run` (no credentials, nothing sent) | reads the new `wrangler.toml`, 365 asset files, exits |
| `npx playwright test --workers=1` | pass: 1,113 passed, 28 skipped, 0 failed, 11.7 min, no reruns. The run rewrote `tests/screens/after/` and `git status` stayed clean (item 7) |
| `npm audit` | before 5 (high: `postcss` in `next`, `undici` in `wrangler`; moderate: `next`, `miniflare`, `wrangler`); after 2 (high `postcss`, moderate `next`; fix is Next 16, a major: reported only) |

Each new test was also run against the old file and fails there: JSON-LD (old About), names (old Contact, and
`í` / `&iacute;` / `&#237;` spellings), dead links (old About, old /private-stays).

## What changed, item by item

1. Deleted `PLAN_FIX_ALL.md`, `_README.txt`, `vercel.json`, `Dockerfile`, `.dockerignore`. No code or test
   referenced them. Docs that still describe them (stale after landing): `HERMES.md:37-38,82,322`,
   `.planning/codebase/{STACK,STRUCTURE,CONCERNS,INTEGRATIONS,ARCHITECTURE}.md`. `vercel.json` was the only
   place with `X-Content-Type-Options: nosniff`; security headers stay Phase 6.
2. `"engines": { "node": ">=22.18" }` in `package.json` and the lockfile root.
3. `wrangler.toml`: `account_id = "f1d9a1fa3abdda98c15161b00b40385c"`, `workers_dev = false` (the
   `almar.almar-private-journey.workers.dev` address goes away at the next deploy). `tests/host-config.test.mjs`
   asserts both.
4. `wrangler` 4.146.0 exact. Lockfile moves only `wrangler`, `miniflare`, `undici` 7.29.0→7.29.1, `workerd` and its
   five platform packages.
5. `@radix-ui/react-focus-scope` 1.1.16 (dependency), `esbuild` 0.25.4 (devDependency; the copy at
   `node_modules/esbuild` that `/embed/hero-booker` runs). Only the lockfile root changed. Note: any
   `npm install` on npm 11 also adds six bundled `@tailwindcss/oxide-wasm32-wasi/node_modules/*` entries to the
   lockfile; that drift predates this job and is left out on purpose.
6. `.gitignore`: `.DS_Store`, `.claude/worktrees/`, `.env`, `.env.*`, `!.env.example`, `.dev.vars`. No tracked file
   is newly ignored; `.env.example` stays tracked.
7. `tests/screens/after/`: no test reads it. `tests/screens-before-after.spec.ts` writes the 24 PNGs on every
   run and compares with `tests/screens/before/`; only the manual `scripts/screens-diff.mjs` reads them. So the
   folder is untracked (files stay on disk) and the ignore line stays. `tests/screens/INDEX.md` still names
   those paths; they are produced locally by the command it quotes.
8. `.claude/rules/connections.md`: "One Supabase project exists since plan 02-01 (Storage off); the app is not
   wired to it yet. Never create another."
9. `README.md` rewritten (static `out/` on Worker `almar`, pinned account, controller-only deploy, no Vercel,
   Netlify or Docker). The dead pointer to `routeHandler()` in `lib/nextjs-export.ts` was in all 20 Framer
   route headers, not only `app/route.ts`; the sentence is removed from all 20.
10. **Team members.** The Framer pages carry English only (no Arabic or Spanish version exists in them).
    Framer's runtime re-creates any markup it owns from its own code, so deleting HTML alone brings the people
    back (tested). Done instead, on Home, About and Contact:
    - Framer's hydration data: the team CMS query result is emptied and the 60–65 entries only it used are
      nulled (indices kept). Framer renders no people and fetches nothing.
    - Server HTML: the three cards leave the list's boundary empty, so hydration matches: no new console error,
      no client re-render (checked at 390, 834, 1440 and after a breakpoint switch).
    - Page-map comment: the three `h3` names removed.
    - Each block is left with a heading and no people (Contact also keeps one line, "A dedicated local team will
      listen first…"), and Framer's code still draws that heading, so the whole block is hidden with one CSS rule
      per page: `Meet the Team` (Home), `Our Team` (About), `Who You’ll Speak With` (Contact). This is the only
      addition; it adds no text.
    - The three portraits (`public/assets/img/b9d52c65cad144dd.webp`, `e52175dd9670c9d5.webp`,
      `b69b236fc3988de3.webp`) were unreferenced after the change and are deleted (outside the named files).
    - `tests/no-team-names.test.mjs` no longer skips `route.ts` and decodes escaped spellings.
    - Still contain the names, outside the test's scope: `framer-export/canvas-components.json` and the two
      `Evidence.dc.html` design-board copies under `.planning/design/`.
11. **Dead links.**
    - Footer, 20 pages: every link to `legal/privacy-policy`, `booking-terms`, `disclaimer`, `liability-waiver`,
      `terms-of-service`. The `href` is dropped from the server HTML (React does not patch attributes at
      hydration: no error, no re-render) and the link containers are hidden by one CSS rule, which also covers
      the links Framer re-mounts on a breakpoint change.
    - **Found while doing it:** the footer link labelled **"Contact"** under Connect opens
      `./legal/privacy-policy` (404 live), not `/contact`. It is one of these links, so it is hidden too. Result:
      the "Legal" heading (kept, owner's answer) **and the "Connect" heading** stand with no links under them.
      The top-nav CONTACT (→ `/contact`) is untouched.
    - /private-stays: Baru House, Corona Island, Yury House Cartagena were name-only placeholder cards (no
      photo). They are removed from the CMS result in the hydration data and from the server HTML (owner's
      answer: hide the 3 cards). The page's Search re-queries Framer's CDN and brings them back (tested), so a
      CSS rule hides any card linking to those three paths.
    - `tests/no-dead-links.test.mjs` resolves every `<a href>` on the 26 Framer pages: it fails on the 8 hidden
      paths, on any new link without a route, and on a known entry that gets fixed (so the list is kept honest).
      The 52 known dead card links (7 destinations, 38 experiences, 7 services) are listed in it.
12. JSON-LD `@id` and `url` moved from `https://almarprod.framer.website/` to `https://almarprivatejourney.com/`
    on all 26 Framer pages; nothing else in those files changed (proved by reverse substitution).
    `tests/json-ld-domain.test.mjs` checks every JSON-LD URL (except the schema.org `@context`).

## Owner decisions in this job (for `.planning/decisions/2026-10-02-cleanup.md`)

Question form, 2026-10-02 ~03:14 +04:

| Question | Answer |
|---|---|
| ~52 other card links answer 404 (experiences, destinations, 7 services, stay pages) | List them, fix later: job 04 hides only the 8; the test fails on those and on any new dead link |
| All 5 links under "Legal" are dead; keep the heading? | Keep the "Legal" heading |
| /private-stays cards Baru House, Corona Island, Yury House Cartagena have no page | Hide the 3 cards |

## Not verified

- Nothing is deployed. The live site still shows the people, the dead links and the Framer JSON-LD until the
  controller deploys. `workers_dev = false` and the pinned `account_id` take effect only at that deploy.
- Arabic screenshots: taken with the `almar-locale=ar` cookie at all widths; they are the same English page
  (`lang="en"`, `dir="ltr"`, row-for-row identical to EN except Framer's moving carousels), because the Framer
  pages have no Arabic. Only EN pairs are kept.
- Browsers other than Chromium. The CSS uses only attribute and class selectors with `display:none`.
- The Framer runtime code on Framer's CDN is outside this repo; if Framer changed the published modules, the
  hiding classes could stop matching. The node tests guard the HTML, not the CDN.
- The 52 known dead card links and the generic footer social links (`facebook.com`, `instagram.com`,
  `youtube.com`, `tiktok.com`, not ALMAR accounts) are unchanged.
- Pre-existing on every Framer page and unchanged: React error #405 in the console; on stay pages, a 404 for
  `framer.com/m/phosphor-icons/undefined.js@0.0.57`.

## Migrations and environment

None. No environment names added. No secret read or written.

## Proposed changes for the controller

- **Board:** job 04 → handed over (`fix/repo-tidy` at the commit named in the last line). Package alerts → 2
  (postcss high, next moderate). Known, not fixed: the 52 dead card links (Phases 3.3 and 6, listed in
  `tests/no-dead-links.test.mjs`); footer "Legal" and "Connect" headings with no links until Phase 6's legal
  pages; footer social links point to generic sites; the three names still in `framer-export/canvas-components.json`.
- **State:** quick task row `261002-42w | job 04 repo tidy | 2026-10-02 | <final commit> | ./quick/261002-42w-repo-tidy/`.
- **Decisions:** the three answers above.
- **Codebase map / `HERMES.md`:** refresh after landing (deleted files, `engines`, `account_id`, `workers_dev`,
  `tests/screens/after/` untracked, `no-team-names` now covers `route.ts`, two new tests).
- **D-56** in `03.1-CONTEXT.md` ("route.ts pages keep them until 3.3 and 6") is superseded by this job.

## Owner's test steps

1. Open the 12 images in `.planning/quick/261002-42w-repo-tidy/screens/` (each is one page at one width; left
   before, right after): `home`, `about`, `contact`, `private-stays` at `390`, `834`, `1440`.
   Expected: Ana Velásquez, Mateo Ríos and Sofía Marín and their whole block are gone from Home, About and
   Contact; the footer shows "Legal" and "Connect" with no links under them; /private-stays ends with Santa Fe
   Farm and Sopetrán (the three name-only cards are gone); nothing else on the pages moved.
2. On GitHub open branch `fix/repo-tidy`, Files changed against `main`.
   Expected: only the files of items 1–12 (the 26 Framer pages for items 9–12), the lockfile, the three deleted
   portraits, the tests `host-config`, `no-team-names`, `json-ld-domain`, `no-dead-links`, and this folder.
3. After the controller's deploy (your word), open https://almarprivatejourney.com/about and
   https://almarprivatejourney.com/nothing-here.
   Expected: About without the three names and with the footer as in step 1; the branded 404.

## Lessons

- Framer pages: edit the hydration data and the server HTML together; markup removed from HTML alone comes back
  from Framer's own code.
- A footer label can lie: check each link's real target before describing what stays (the "Contact" link went
  to the privacy policy).

Hand-over written 2026-10-02 03:44 +04. The final commit is the one that adds this file; its hash is in the message to the controller.

## Follow-up 2026-10-02: the footer Contact link

Owner decision (2026-10-02, question form): the footer link labelled "Contact" (container `framer-1pmr5p9-container`,
the only link under "Connect") points at `/contact` and is no longer hidden. The other seven stay hidden.

- **Changed:** on the 20 Framer pages that carry the footer, `href="/contact"` was added to the three breakpoint
  copies of that anchor (60 anchors) and `.framer-1pmr5p9-container` was dropped from the one job-04
  `{display:none!important}` rule (Framer's own `flex:none` rule with the same class is untouched). Markup only, no script.
  Every file had exactly 3 anchors and 1 rule before the edit; the edit script aborts otherwise.
- **Guard:** three tests added to `tests/no-dead-links.test.mjs` (20 pages x 3 anchors = 60 with `href="/contact"`;
  the hide rule lists exactly the other seven classes; `/contact` has a route). Run against a `git archive 6bc38f2`
  copy in /tmp, the first two fail and the route test passes; on this branch all pass.
- **Checks:** `tsc --noEmit` clean; `node --test tests/*.test.mjs` 196 pass, 0 fail; `tokens:check` up to date;
  `assemble-cloudflare` 27 html files; Playwright (`PW_PORT=3021`, 1 worker) 1113 passed, 28 skipped, 0 failed;
  `git status --short` empty after the run. Built `out/`: 60 footer Contact anchors with `href="/contact"` in 20
  files; no team names; no hidden-path hrefs.
- **Not verified:** the link rendering visible in a browser on the final build (the controller probed it on a throwaway
  build; the committed screens in `screens/` were not regenerated, so step 1 of the owner's test steps still says
  "Connect with no links": it now shows one link, Contact). Six Framer pages (3 blog posts, 3 services) have no
  footer container of this class and are unchanged.
