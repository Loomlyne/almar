# Jobs: 3.2 wave 4 on the kit editor (03.2-06, -07, -13, -15), controller brief 2026-10-15

You are an ALMAR work session (not the controller). One job each, named in the line that started you. The controller is
the local Claude Code session `local_2a268540-fee7-461a-a9c2-49fa6015a12f`; message it with `SendMessage` (start, picture
set ready, blocked, hand-over). The owner talks to the controller, not to you.

## Your branch and folder
- You run in an app-made worktree under `.claude/worktrees/`, cut from your job branch at its GitHub tip. Your job branch
  on GitHub is the one in the table below; push your work with `git push origin HEAD:<job branch>` (never `main`).
- The old T3 worktree of your job (`~/.t3/worktrees/Almar Private Journey/<branch>`) is retired: do not edit it.
- Run `npm ci` first.

| Job | Job branch (tip on 2026-10-15) | Where it stands |
|---|---|---|
| 03.2-06 catalog: destinations, experiences, services | `gsd/phase-3.2-p06-catalog` (`ca93e52`) | List screens, filters, reorder and delete-blocked flow signed. Panel options drawn; the owner picked B, which is now the kit editor on `main`. |
| 03.2-07 stays | `gsd/phase-3.2-p07-stays` (`30bf193`) | List pictures drawn (list, empty, no match), not yet signed. Panel pictures held for the chosen panel. |
| 03.2-13 calendar block dates | `gsd/phase-3.2-p13-calendar` (`3ff71e6`) | Grid signed; wired to `/api/ops/blocks`; the form fields are panel-free in `block-form-fields.tsx`. |
| 03.2-15 stay rates, availability, access | `gsd/phase-3.2-p15-stay-tabs` (`0cbd198`) | Rate-rules module and tests; tab pictures drawn without the panel frame. The owner types every rate. |

## Read first
1. `/Users/koss/Developer/Almar Private Journey/CLAUDE.local.md` (gitignored: use the absolute path), sections "Product"
   and "One job, one branch, one ship".
2. `.planning/prompts/00-common-rules.md` (after your merge of `origin/main`; until then read it from the main folder by
   absolute path).
3. `.planning/decisions/2026-10-14-auto-translate-and-panel-redesign.md` (all six points).
4. Your plan: `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-<NN>-PLAN.md`, and your branch's own commits
   (`git log origin/main..HEAD`).
5. The kit editor on `main`: `components/ops/edit-page.tsx` (props `liveTranslations` and `holdOnFailure`),
   `components/ops/auto-translate.ts`, `publish-bar.tsx`, `lib/copy/ops-kit.ts`, and its live user, the media library
   (`app/dashboard/(ops)/content/media/`). Memory files `auto-translate-panel.md`, `editor-page-test-traps.md`,
   `picture-mock-text-gate.md` in `~/.claude/projects/-Users-koss-Developer-Almar-Private-Journey/memory/`.

## Steps
1. **Merge `origin/main`** into your branch (the base wins a conflict unless the owner says otherwise). 03.2-13 has two
   known conflicts, `lib/ops-routes.ts` and `tests/ops-media.test.mjs`: keep every line `main` has and add only your own.
   Push. Message the controller one line: merged, tip.
2. **Mount your forms on the kit `EditPage`** (option B: the full page replaces the list, back link, Save outlined and
   Publish teal fill with white text in the top bar, sections as cards in two columns at desktop width and one on a
   phone). English fields only; the kit fills Arabic and Spanish on Save. Pass `liveTranslations` for items that already
   have published Arabic or Spanish, and `holdOnFailure` for items in use. No `LocaleTabs`, no Translate button, no
   Draft badges. Do not change the kit itself; if it lacks something, stop and message the controller.
3. **Pictures before code where a screen changes.** Draw from the real components on your merged branch through the dev
   harness (never a hand-written CSS mock), EN, AR and ES at 390, 834 and 1440, every state that changes. Run the
   label-string check (every label is a string; assert the visible properties in the DOM). Do not open PNGs. Commit them,
   push, and message the controller with the folder and one line per state. **Stop until the controller relays the
   owner's signature.** Copy you add is a draft: EN/AR/ES, dashboard Spanish in usted, no legal wording, no prices, no
   invented people.
4. **After the signature:** wire, test, and hand over: merge `origin/main` again, re-run `npx tsc --noEmit`,
   `npm run tokens:check` and the full node suite (`node --test tests/*.test.mjs`), build once, run the Playwright specs
   you touched with `--workers=2`, write `.planning/phases/03.2-real-catalog-and-team-inserted/03.2-<NN>-HANDOVER.md`
   (final commit, every check with its result, what was NOT verified, owner UAT as numbered type/click with the expected
   result), push, message the controller with the tip. Stop.

## Job notes
- **03.2-06:** the item editor mounts the signed option-B sections (Text, Photo, Connections left; Price, Settings
  right). Pickup line: "Home pickup · pre-selected at checkout" (owner wording). Reuse the drafts in your `panel` copy
  group rather than inventing new ones. Price fields hold what the owner types; never a default amount.
- **03.2-07:** the list pictures still need the owner's signature: send them with your editor pictures as one set.
  No gold side bar on selected stay cards (owner rule).
- **03.2-13:** re-draw the three form pictures inside `EditPage`; the grid is signed and stays as it is.
- **03.2-15:** the Rates, Availability and Access tabs become sections or cards of the stay editor (agree the shape with
  03.2-07's stay editor through the controller; 03.2-07 lands first). The owner types every rate: no seeded, sample or
  default rate value anywhere, including fixtures shown in pictures (use an empty state or clearly fake test values the
  owner has seen). Money logic goes through the existing money engine; no new arithmetic.
- Shared files: the four jobs share only one line each in `lib/ops-routes.ts`. If you need any other shared file, ask
  the controller first.

## Machine rules (binding)
- The controller's landing lane is running (one local Supabase stack, builds, Playwright `--workers=2`). Until the
  controller messages "lane free": **no local Supabase stack, no build, no Playwright beyond your picture shoot**.
- **Picture shoots and dev servers take a slot:** message the controller "slot?" before starting one and wait for "go";
  one session holds it at a time; stop your dev server and send "slot free" when done.
- Long runs detached with `nohup` and an `exit=` line, logs outside `/tmp`. Read files in chunks of 300 lines or fewer.
  Never write a secret. No push to `main`, no PR, no deploy, nothing against the live Supabase project.
