# Handoff from "ALMAR controller (fork)", 2026-10-11

Owner's decision (2026-10-11): the Desktop session **"ALMAR controller (fork)"** (`local_25718b9f-7c27-406c-aec5-f4cd4283a16e`)
retires as ALMAR controller. A new controller opens in T3 Code and writes its own ID into `CLAUDE.local.md`. This session
stands down with this file: after this note it does not push, deploy or migrate. Planning note only: no code on `main`,
nothing deployed.

## Live

Read from Cloudflare with `wrangler deployments list` (ALMAR login prefix), 2026-10-11 19:58 (+04). Times below are +04.

| Worker | Live now | Rollback target, then earlier | Note |
|---|---|---|---|
| `almar` | **`4cf66ade`** (2026-10-05 21:35) | `4666edd0` (05 19:43), then `f36f9de4` (05 18:33) | Secrets: `NEXT_PUBLIC_SUPABASE_*` (2), `SUPABASE_SERVICE_ROLE_KEY`. No `RESEND_API_KEY` |
| `almar-preview` | **`407dae26`** (2026-10-05 21:34) | `4a185125` (05 19:43), then `69913cdd` (05 18:31) | No secrets, on purpose |
| `almar-ops` | **`1ef92954`** (2026-10-11 18:17, secret change) | `04413a68` (11 18:16, secret change), then **`08c248e9`** (05 21:33, last code deploy), then `d7fdccd4` | Secrets: `NEXT_PUBLIC_SUPABASE_*` (2), `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, set by the owner from his terminal 18:16–18:17 |

Read live by the owner's session at 18:17: `/sign-in` 200, `/api/ops/stays` 403 (signed out). Not re-read by this session.

## Git

- `main` = `origin/main` = **`7ebd9de`** (2026-10-11 19:50, "chore(gsd): adaptive model profile, drop resolve_model_ids
  omit", `.planning/config.json` only). Before it: `e07d95c` (2026-10-05 21:36). Neither was landed by this session.
- This note is the next commit on `main`.

### Branches on GitHub

| Branch | State |
|---|---|
| `main` | `7ebd9de` (then this note) |

That is the only branch. Archive tags on GitHub: `archive/phase-3.2-p01`, `-p03`, `-p04`, `-p11-ops-kit`.

**Deleted on GitHub today without an archive tag** (by Loomlyne, 18:14:57 and 18:15:04):

| Branch | Tip | State when deleted |
|---|---|---|
| `gsd/phase-3.2-p02` | `e9a96c9` | Fable said LAND. Clean-clone check **not finished**, `parity-build --live` not run, no Ship |
| `gsd/phase-3.2-p12` | `db1a2aa` | Built; pictures waiting for the owner's signature |

Both commits still exist: unreachable in the main repo's object store, and as `origin/*` refs in the clone
`.claude/worktrees/check-p02`. To keep them (nothing here was run by this session):

```bash
git push origin e9a96c9:refs/tags/archive/phase-3.2-p02
```

```bash
git push origin db1a2aa:refs/tags/archive/phase-3.2-p12
```

INBOX item 5 ("Land 03.2-02") needs `e9a96c9` back as a branch or tag first.

### Worktrees and folders under `.claude/worktrees/`

| Folder | State |
|---|---|
| `phase-04-book-and-pay` | **Registered and active.** Branch `phase-04-book-and-pay`, **local only** (not on GitHub), base `e07d95c`. Commits `4d123c0` (19:20, 04-03 trip screens and pictures for the owner's signature), `a672cea` (19:56, 04-04 Stripe packages and key helpers), `90b0904` (19:57, 04-04 failing tests for the webhook). Uncommitted at 19:58: `.planning/STATE.md`, `app/api/stripe/webhook/route.ts`, new `lib/stripe/fulfill.ts`, `lib/stripe/webhook.ts`. No `HANDOVER.md`. **This runs Phase 4 (04-03, now 04-04) against the owner's 2026-10-11 decision that 04-03 waits** (INBOX item 1) |
| `check-p02` | A clone made for the 03.2-02 clean-clone check: branch `cand` `388d568`, one untracked file `pw-dev-slow.config.ts`. Holds the only refs to `e9a96c9` and `db1a2aa` |
| `phase-3.2-p02`, `phase-3.2-p12` | Orphans: their `.git` file points into the deleted old checkout `/Users/koss/Developer/almarprod-Website-Code`, so git does not work in them. Their work is the two commits above |
| `phase-04-p03`, `phase-04-p04`, `phase-3.2-p09`, `phase-3.2-p10` | Orphans, same cause. No commits were made in them (this session's four executors were stopped before committing) |

Colima is not running; no local Supabase stack is up.

## Sessions and agents

Running at 19:58 in the ALMAR folder, all Claude processes under T3 Code (Nightly), all `bypassPermissions`:

| PID | Model | Started | Session | Doing |
|---|---|---|---|---|
| 58411 | Opus 5.5 | 19:54:09 | transcript `4006cc08-b773-4994-919a-88dd64ee054c` | **The new controller.** Its prompt: read this hand-off, write its own T3 thread ID into `CLAUDE.local.md`, `CONTROL-BOARD.md` and `prompts/00-common-rules.md`, then the INBOX order |
| 94722 | Sonnet 5.5 | 18:57:27 | transcript `f583456f-d6c2-4098-b0a3-4d5fbb5fa064` | `/gsd-execute-phase` in `phase-04-book-and-pay` (04-03, then 04-04 Stripe). Still committing at 19:57 |
| 49019 | Sonnet 5.5 | 19:51:13 | most likely transcript `9e976be5-8ee5-4f26-9675-d2701bcb71c7` (the owner's `/gsd-progress` thread that wrote the retirement prompt) | Not confirmed |

T3 thread names are not readable from here: the PIDs and transcript IDs identify them.

Desktop sessions in the ALMAR folder, not running:
- `local_836ffacc-ca03-41c4-b1ff-385b8aa9d357` "ALMAR controller": archived, **still pinned**, in group ALMAR.
- `local_27617658-df65-41bb-972a-d24e4ccaa654` "Fix the 4 Dependabot alerts on Loomlyne/almar" (landed `b3fc57f`).
- `local_7091467e-a1ff-41c3-a02b-94a998bb5b11` "ALMAR job 08: slice 3 design and plans".
- This session, `local_25718b9f-…`: renamed "ALMAR controller (retired)", unpinned and moved to "ALMAR · archived" after this note.

## Half-done or unsaved

1. `phase-04-book-and-pay`: three local commits and uncommitted Stripe files, not on GitHub, no hand-over. It conflicts with
   INBOX item 1. The new controller decides with the owner: stop it, or let it finish and park it.
2. `gsd/phase-3.2-p02` and `-p12` deleted without archive tags (see Git).
3. In the main checkout, uncommitted and **not in this note** (Jev wording only): `.claude/rules/connections.md`,
   `.planning/decisions/2026-10-04-slices-reconcile.md`.
4. `.planning/STATE.md`: the owner's 18:17 entry ends at "Not yet done:" with nothing after it. Committed as found.
5. The orphan folders and the `check-p02` clone. Delete only after the two archive tags exist.
6. `CONTROL-BOARD.md` gets a "Retired" line after this commit; it stays local and uncommitted (this session pushes nothing more).

## The order, from `.planning/INBOX.md` (owner, 2026-10-11)

1. Decision: finish everything before Phase 4. 04-03 waits until the list below has landed.
2. Housekeeping, no code: tick stale roadmap boxes; summaries for 02-02, 02-03, 02-04, 02-07, 02-08 and Phase 3; mark 02-09
   and 02-10 superseded.
3. 02-05: language and currency follow a signed-in account.
4. 02-06: settings save, contrast gate, maintenance page (after 02-05).
5. Land 03.2-02: clean-clone check, `parity-build --live`, his Ship.
6. Wave 3: 03.2-05; 03.2-09 and 03.2-10 pictures first.
7. 03.2-12 pictures: his signature, then merge on top of 03.2-05.
8. Wave 4 in parallel: 03.2-06, -07, -08, -13, -15 (one shared line in `lib/ops-routes.ts`).
9. 03.2-14 last; decide whether it is in v1.
10. Owner settings: max stay length, balance-due days, stay rates (typed by him, nothing invented).
11. Then 04-03: holds, `BOOKING_LINK_SECRET`, Cloudflare rate-limit rule on `/api/booking/*`.

## Open gates (the owner's)

1. Picture signatures: 03.2-09, 03.2-10, 03.2-12, and 04-03's trip screens.
2. Stay rates, maximum stay length, balance-due days: typed by him.
3. Rotate the Supabase CLI personal access token this controller used (revoke it in the Supabase dashboard, his terminal
   for the new one). No part of it is written here.
4. `RESEND_API_KEY` on `almar`, if `almar` must send mail.
5. Workers Free plan (10 ms CPU) versus Paid: his decision before booking traffic.
6. Stripe stays in TEST mode until he says live.
