# Controller hand-off, 2026-10-15 01:35 (+04)

From: the T3 Code thread "ALMAR controller" (`8f8a7977-34a1-4959-819e-3a011d5e7e6f`), now **retired**.
To: a new local Claude Code session in `/Users/koss/Developer/Almar Private Journey` on `main`, which becomes the
ALMAR controller. The owner's /goal stays: finish what is left of phases 1–3, land, verify and clean up every
branch, worktree and PR, then start phase 4 clean.

## State of main
- `origin/main` = `33ab78b` (kit panel B). Nothing below is deployed. The live Workers are still the versions in
  `wrangler deployments list`.
- Landed 2026-10-14, each with the owner's Ship, a Grok 4.7 "ship", a clean-clone check, and the landed tree equal
  to the checked tree:
  - 03.2-10b `e463405`
  - 03.2-09b `026e4c0`, with its live migration
  - 03.2-05 `3a7eb04`
  - 02-06 `e7c65cf`, with live migration `20261013120000_site_settings_brand`, applied and read back
  - 03.2-12 `f789937`
  - kit panel B `33ab78b`
- Every landed branch has an `archive/*` tag and a `backup/main-pre-*` tag on GitHub. No PRs are open.

## Open jobs (branches on GitHub, worktrees under `~/.t3/worktrees/Almar Private Journey/`)
| Job | Branch, tip | Where it stands | Next |
|---|---|---|---|
| 3.3 part B (plans 26, 27, 29: contact form, newsletter, hardening) | `gsd/phase-3.3-s3-part-b` `a62f700` | Built. Hand-over in `.planning/phases/03.3-public-site-in-react/03.3-S3-HANDOVER-B.md`. States and copy signed by the owner; no privacy line until Phase 6; sent state as drawn. 3 commits behind main. | Open a PR, review it (see Reviewer), run the full clean check, land on the owner's Ship (not given yet). |
| 03.2-06 catalog destinations/services | `gsd/phase-3.2-p06-catalog` `ca93e52` | List screens signed; panel options drawn (owner picked B). | Merge main, mount its forms on the kit `EditPage` (pass `liveTranslations` / `holdOnFailure` for mixed-status or in-use items), wire, test, hand over. |
| 03.2-07 stays | `gsd/phase-3.2-p07-stays` `30bf193` | List pictures drawn, holding its panel pictures. | Same as 06: merge main, editor on the kit, pictures, then the owner's signature, wire. |
| 03.2-13 calendar block dates | `gsd/phase-3.2-p13-calendar` `3ff71e6` | Grid signed; wired to `/api/ops/blocks`; the form fields are panel-free in `block-form-fields.tsx`. | Merge main, mount the form in `EditPage`, re-draw the 3 form pictures, hand over. |
| 03.2-15 stay rates, availability, access | `gsd/phase-3.2-p15-stay-tabs` `0cbd198` | Rate-rules module and tests; tab pictures without the panel frame. The owner types every rate. | Merge main, put the tabs in the kit editor, pictures, then the owner's signature. |
| 03.2-08 | not started | Starts after 03.2-12, which has now landed. | Start from its plan. |

The T3 work threads for these jobs cannot be messaged from Claude Code. Continue each job in a new work session or
worktree from its branch: the owner's rule is one branch per job, the base wins merges, and the session hands over
by commit plus HANDOVER. The T3 worktrees can be removed once each job is pushed and continued elsewhere; all are
clean and pushed as of this hand-off.

## Reviewer
In T3 the verifier was Grok 4.7 via `delegate_task`, which does not exist in Claude Code. The fallback is the
`reviewer` agent on the PR diff (Sonnet; Opus when Sonnet wrote it). Post the verdict with `gh pr comment` and say
on the PR that Grok was unavailable.

## Check lane: `~/.almar-q/`
- `check.sh <tag> <branch> <port>` makes a clean clone from the local checkout, points it at GitHub, fetches with
  retries, then runs the gates (`gates.sh`), pw-dev, and three build shards. Failed browser tests are re-run alone.
  It writes `logs/<tag>-check.done`.
- **Read the gates file (`MERGE=0 tip= main=`) and every `pw-*.log`, never just `check.done`.** On 10-14 a failed
  clone once wrote a false pass; that is fixed now (exit 8).
- `queue.sh` runs the lines of `queue.txt`, or of `QF=<file>`, one at a time. `fast.sh` re-gates on a newer main.
- Only one lane on the Mac. Playwright runs with `--workers=2`, there is one local stack, and only one build at a
  time. A work thread's own detached Playwright run counts as a second lane: on 10-14 one pushed load to 36 and made
  the controller's run crawl. Threads run broad browser suites only when the controller says the lane is free.
- Before queueing, test merges in landing order: each branch against main **plus every branch landing before it**.

## Follow-ups (not blocking)
- Kit B: the history-trap flag on `history.state` (Grok round 3 minors: Forward after a reload; browser history cap).
- `lib/settings/site-rebuild.ts` (02-06 seam) is dead code now that 03.2-05 is on main; remove it in a small fix.
- `database.types.ts` refresh. `requireStack` before lock race in the test helper. 03.2-10 signal pass-through and
  `someLeft`. 02-05 hint cookie.
- At the almar-ops deploy: a nosniff response header on media.almarprivatejourney.com, and `wrangler tail`
  cpuTime on a 9–10 MB upload.
- Deploys waiting for the owner's word: the 03.2-05 live publish path (Workers Builds connect, deploy hook secret,
  almar-ops deploy, first push of `live`), plus everything landed since the last deploy. Before deploying `almar`,
  follow `CLAUDE.local.md` "Before deploying almar" (parity-build `PARITY OK`, media-upload dry run `0 put`).

## Owner decisions on record (2026-10-14)
- `decisions/2026-10-14-auto-translate-and-panel-redesign.md`: English only in the dashboard; AI fills Arabic and
  Spanish on Save; edit panel option B (full page); dashboard Spanish in usted; pickup line "Home pickup ·
  pre-selected at checkout".
- 3.3 part B: states signed, no privacy line until Phase 6, sent state as drawn. Public Spanish stays tú.
