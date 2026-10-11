# Inbox

Write plans, next steps and decisions here (in Obsidian or any editor). The controller reads this file at the start of every session, copies each item into `CONTROL-BOARD.md` or `STATE.md`, then clears it. Items here are notes, not commands: anything that lands, deploys or touches the live database still needs your Ship in the controller.

Do not edit the cards in `Board/`; they are regenerated every 60 seconds.

Format: one line per item, e.g. `- next: 04-03 holds and booking link`

## Items

- decision 2026-10-11 (owner): finish everything before Phase 4 starts. Phase 4 build (04-03) waits until the list below is landed.
- housekeeping (controller, no code): tick the stale roadmap boxes and write summaries for 02-02, 02-03, 02-04, 02-07, 02-08 (live since 2026-10-05) and Phase 3; mark 02-09 and 02-10 superseded (paused 2026-09-28, pages and prices moved to 3.3 / 3.2).
- 02-05: language and currency follow a signed-in account (work session, own worktree).
- 02-06: settings save, contrast gate, maintenance page (work session, own worktree; after 02-05).
- 3.2: land 03.2-02 (clean-clone check, `parity-build --live`, his Ship).
- 3.2 wave 3: 03.2-05 (first screens, edits ops-shell and dashboard copy), 03.2-09 and 03.2-10 (pictures first: his signature before code).
- 3.2: 03.2-12 pictures: his signature, then it merges on top of 03.2-05.
- 3.2 wave 4, in parallel, no shared files except one line in `lib/ops-routes.ts`: 03.2-06, 03.2-07, 03.2-08, 03.2-13, 03.2-15.
- 3.2: 03.2-14 (wave 99): last; decide at the end whether it is in v1.
- owner settings before Phase 4 can hold a stay: max stay length, balance-due days, stay rates (typed by him in the dashboard; nothing invented).
- then Phase 4: 04-03 (holds, `BOOKING_LINK_SECRET`, Cloudflare rate-limit rule on `/api/booking/*`).
