# 2026-10-17: 03.2-08 Team and Packages pictures signed; price line and team web address

Owner, question form in the controller session, answered between 15:08 and 15:10 CET.

1. **03.2-08 pictures: signed.** The set is the 81 pictures at `891101d` on `gsd/phase-3.2-p08-team-journeys` (team-list,
   team-list-empty, team-editor-new, team-editor-links-error, team-editor-published, journey-list, journey-editor,
   journey-editor-price-unreadable, journey-editor-hidden at 390, 834 and 1440 in EN, AR and ES).
2. **Journey price line in Arabic and Spanish: the AI fills both on Save** ("AI fills both", the recommended option).
   It is the same as every other text: he writes the English line, and Save fills Arabic and Spanish. He can fix a word
   under Edit translations. The amount stays as written, and nothing is computed.
3. **Team member web address: show the field** ("Show the field", chosen over the recommended "Keep it hidden"). The
   member editor gets a Web address field, that works the same as on stays and destinations: same field, same pattern rule and
   help line, and it locks once the member is published. The team editor states that change are shot
   again, and the owner signs that change on its own.

**Signed, 15:31–15:37 CET** (question form, "Signed"): the change as built and shot at `e0a87fa` (27 team-editor
pictures). It covers the member Web address field (it locks once published), "Link address" / "Dirección del enlace" on
social-media rows (Arabic was already "عنوان الرابط"), and a kit fix on every editor: Publish is off whenever Save is
blocked (`components/ops/publish-bar.tsx`, `edit-page.tsx`, commit `c4155f9`). Before the fix, the site refused the
publish, but the button looked usable.
