# 06-07 summary: Share and saved stays

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-30, from `date`. Lead: Opus 5.5; built by a `worker-deep` (Opus) agent. Review: Sonnet. Fable: one pass on the whole Phase 6 PR, by the controller.

## Signature
`pictures/06-07/index.html`, signed 2026-10-30 (`decisions/2026-10-30-06-04-06-05-06-07-pictures-signed.md`): ivory Save and Share on the hero; the word Save beside the heart on the stay page, heart alone on cards; outline when not saved, filled when saved.

## What landed
| Commit | What |
|---|---|
| `87f97642` | copy, heart view, card action, hero actions, Share, Saved stays card, `lib/saved-stays/rules.ts` |
| `c3b90bfe` | `/api/saved-stays`, the login key `stay` |
| `5523b815` | hearts on cards and the stay page, Share on the stay page |
| `5c139d8a` | Account › Saved stays |
| latest `fix(06-07)` | Sonnet's three findings |

## Deviations
- Outside the plan's list: `components/ui/save-stay-card.tsx` (`SavedPortraitCard`), because `tests/stay-detail-source.test.mjs` refuses `action={<...>}` in the stay page. That test also refuses `<Button` in `stay-detail/*`, so Share is a plain `<button>` with `buttonClass`.
- Plan files left alone: `lib/preferences-route.ts` (the helpers are already in `lib/ops/route-core.ts`); `lib/supabase/clients.ts` (not granted; `createSupabaseAnon()` is in `lib/saved-stays/server.ts`).
- Signed page over plan: ivory Save, Share, WhatsApp and Copy link; square busy spinner; `success` tone on the saved notice; Saved stays first under Personal on Account; the gold title underline is hover only (owner, 2026-10-30: the at-rest underline first built here is removed).
- **Signed page not followed, real page kept (treated as schematic):** list card detail stays neighbourhood · guests · price; home and related grids stay as they are; hero frame unchanged; Account "Personal" heading stays, so the card title is `h3`; the post's featured stay has a heart (plan), not drawn.
- Words not on the signed page, reused, none new: toast close `SITE_FOOTER_COPY.newsletter.dismiss`; a failed Remove says `saveFailed`.
- Added: 405 for other methods; hearts reload on a back-button restore; a 401 clears the slugs.
- `aria-pressed` drawn on the signed page is dropped after review: the button's name already changes between Save and Remove.

## Checks
`npx tsc --noEmit` and `npm run tokens:check` pass. Node tests, build, Playwright: **not run (owner: no test)**. Nothing has been seen in a browser. No migration change.
