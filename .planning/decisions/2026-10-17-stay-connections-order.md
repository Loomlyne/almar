# 2026-10-17: stay connections get Move up / Move down; 03.2-07 pictures signed

Owner, question form in the controller session, answered between 15:01 and 15:07 CET.

1. **03.2-07 Stays pictures: signed.** The set is the 72 pictures at `8191760` on `gsd/phase-3.2-p07-stays` (list,
   list-empty, list-no-match, editor-new, editor-draft, editor-pets-fee, editor-translations, editor-published at 390, 834
   and 1440 in EN, AR and ES).
2. **Connected experiences and services on a stay get Move up / Move down** ("Add Move up / Move down", chosen over
   "Keep as is"). Before this, they kept the order they were connected in.

How it is built (controller):
- The kit `ConnectPicker` (`components/ops/connect-picker.tsx`) gets ordering as an opt-in. Only the stay editor turns it
  on now; the destination and catalog-item screens from 03.2-06 do not change.
- The pattern is the gallery's: Move up / Move down on each connected row, off at the ends, focus follows the moved row.
- No migration: the stay save already stores connections at positions 0, 1, 2, ... in the order sent
  (`supabase/migrations/20261005100000_catalog_and_team.sql`, the stay save function). 07 checks that every reader (public stay page, booking add-ons) sorts by that position.
- The states that draw the connected list are shot again, and the owner signs that change on its own.
