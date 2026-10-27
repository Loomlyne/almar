# 06-03 summary: Blog

**Job 26, branch `phase-06-site-and-rest-of-cms`.** Written 2026-10-28, from `date`. Lead: Opus 5.5. Review: Sonnet,
picked by `jev-review`.

## Signature
Pictures: `pictures/06-03/index.html` at `65f2500d` (11 states × EN/AR/ES × 390/834/1440). Signed by the owner
2026-10-27 in the controller's question form: "Approve all (Recommended)" for the 11 states, the dashboard drafts and
the four public search lines. Record: `decisions/2026-10-27-06-02-06-03-pictures-signed.md` on main.

## What landed on the branch
| Commit | Task |
|---|---|
| `65f2500d` | 1: pictures |
| `a1261025` | 3: owner API `/api/ops/posts` (`posts-handlers.ts`, `validate-posts.ts`); chunked translate (`translate-chunks.ts`) |
| `a1bb228f`, `dd156103` | dashboard Blog copy; public `list.search*` lines (slot) |
| `8f1503d4` | review answer: a `translate_limit` reply stops the chunk loop |
| `1250db22` | public blog: photo blocks in `post-body.ts` and `rich-text.tsx`; an AR/ES record with a bad body or a different block count falls back to English (warned); search island `blog-search.tsx` |
| `57f99c2d` | Content › Blog (`post-forms.ts`, `post-blocks-field.tsx`, `blog-screen.tsx`): list with search, editor with body blocks, Publish / Unpublish, Delete |
| `74b9afd0` | tests (written, not run) |
| `99ccec0e` | shared-file slots (below) |
| `7f69ba3f` | review answers (below) |

## How it works
- **Body blocks.** Each block's field name is its key (`block_<k>`), kept across the read-back, so an AR/ES lock
  follows the block when it moves. Save posts the flat body; Publish then calls `/api/ops/publish` with
  `entity: "post"`. Publish waits while a required AR/ES block text is missing and names it ("Spanish text of block 2").
- **Address.** Locked once the post is published (signed line).
- **Translate.** `chunkedSend` splits by `CHUNK_LIMITS` (pinned to `TRANSLATE_LIMITS` by a test), so the browser
  never imports `translate.ts`.
- **Public search.** No box before the page is interactive (same HTML as before); a query matches title, excerpt and
  body text, case and accents ignored; a count line, a no-match line with Clear, Escape clears.

## Deviations from the plan
- The delete confirm shows the post title with no description: no signed line exists for one.
- No harness scenes or picture specs (pictures were HTML).

## Shared files (controller slots, 2026-10-28) in `99ccec0e`
- **Coming soon choice:** `"blog"` left `ComingSoonKind` with its three `comingSoon.blog` blocks in the same commit that
  wires the rail entry (controller: the whole phase lands as one PR, so 06-02's "until the last lands" does not apply to
  blog). Pages and Navigation keep their copy blocks until their plan's turn; Legal stays Coming soon until 06-04.
- `lib/ops/route.ts` / `route-core.ts`: `opsPost(parse, handler, { bodyLimit })`, read after `requireOwner` and the
  Origin check. Only `/api/ops/posts` passes one (`POSTS_BODY_LIMIT` = 256 KiB in `validate-posts.ts`); every other route
  keeps 64 KiB, and a guard test fails if another route passes one. Note: OpenNext reads every non-GET body whole on
  Workers whatever the cap (Free plan, 10 ms CPU), so the larger cap costs CPU on that one route only.
- `lib/data/types.ts`: `Post.body: PostBodyBlock[]`; `post-page.tsx` drops its cast.
- `tests/ops-route.test.mjs`: posts in EXPECTED_ROUTES; a bodyLimit case.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass on `34e829d1` (after merging `origin/main` at `6558cb6f`) |
| `npm run tokens:check` | pass ("theme up to date") |
| node tests, build, Playwright | **not run (owner: no test)** |

Written and not run: `tests/ops-posts-api.test.mjs`, `tests/post-forms.test.mjs`, `tests/ops-blog.spec.ts`,
`tests/blog-search.spec.ts`; updated `tests/post-body.test.mjs`, `tests/types/post-block-compat.ts` (type-checked).

## Review (Sonnet, standard tier per `jev-review`), 06-03 part; answered in `7f69ba3f`
4. Unpublish read the post back with the form's block keys (unsaved rows shift them): it uses the saved blocks' keys
   now. The kit already asks before Unpublish drops unsaved typing.
5. An AR/ES body was checked by block count only: it must match English in kind and order now (no unit test added).
8. Claimed `blog.ts` reflow: not so; the net diff from the base is the four `list.search*` keys only. The
   `translate-chunks.ts` comment now names `TRANSLATE_LIMITS`.
9. Perf note, not changed: the search island carries every post's body text; shorten it if the blog grows large.
Not re-reviewed after the fixes.
