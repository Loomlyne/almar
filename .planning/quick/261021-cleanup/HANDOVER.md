# Job 23 hand-over: cleanup (drift wording, preview rate-limit namespace, HERMES.md)

Branch `fix/cleanup-2026-10-21`, cut from `origin/main` `39546d56`. No push to `main`, no deploy, no hosted-database or Cloudflare change.

## What changed
1. **Planning wording** (`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`; no phase status touched):
   - Phase 2 goal, SC1, SC2, SC4, Plans line: magic link only (D-07, D-33), both owner emails (PR #20), 30-day session later (owner 2026-10-21 item 12), EN root + `/ar/` `/es/`, 10/10 plans, verified 2026-10-21, no UAT.
   - REQUIREMENTS AUTH-02, AUTH-05 reworded the same way.
   - Phase 3.3 SC1: 22 pages (66 documents), `/services` + 3 detail URLs 301 to `/experiences` (D-64, D-67) (G1). SC4b: 22 to 66 documents, and the cookie text now records the owner's 2026-10-21 item 7 (chosen language, `/` redirects a returning visitor; supersedes design §5.3; built by job 21) instead of the verifier's "no redirect" option (G2).
   - G5: SITE-11, SITE-12, SITE-13 mapped to Phase 3.3 (met in code per `03.3-VERIFICATION.md`); statuses left Pending. SITE-01..10 and I18N-04 stay Phase 6. Phase 3.3 Requirements line says so. Say if you want those three marked Complete.
2. **Preview rate limit**: `wrangler.preview.toml` `FORM_LIMITER` `namespace_id` `"1001"` -> `"1002"` (production keeps `"1001"`). Cloudflare docs: the id is any positive integer string we choose, unique per account; Workers using the same id share counters per location; no creation step. Tests that pinned "1001" for both files updated (`tests/contact-route.test.mjs`, `tests/server-runtime.test.mjs`), unrun.
   **Controller at the next preview deploy:** nothing to create; `node scripts/assemble-cloudflare.mjs --target=preview`, then deploy `almar-preview` as usual. The new id takes effect with that deploy; production is unaffected and needs no redeploy for this.
3. **HERMES.md**: removed or rewrote lines still describing the Framer bridge (26 `route.ts` pages, `const HTML`, `force-static` handlers), `/fx`, the hero-booker embed, "no server runtime", the missing `vercel.json`/`Dockerfile`, and the Next 15 dev-server note. It is still a GSD-generated dump with other dated detail; a `/gsd-map-codebase` refresh would regenerate it fully.

## Checks
- `node --check` on the two edited test files: ok. 
- `npm run tokens:check`: exit 0. `npx tsc --noEmit`: not run (no node_modules in this worktree; no .ts file changed).
- Node tests, Playwright, build, pgTAP: not run (owner: no test).
