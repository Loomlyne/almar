# Phase 2: User Setup Required

**Generated:** 2026-09-26
**Phase:** 02-platform-spine
**Status:** Incomplete

The cloud project exists. These items are still human-only. Do not paste a URL, ref, or key into chat or the repo.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → Data API. Base URL only. No `/rest/v1/` suffix. | Owner environment, not the repo |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard publishable or anon key. This name only. Do not add a second public key name. | Owner environment, not the repo |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | Dashboard secret or service-role key. Server only. Never `NEXT_PUBLIC_`. | Owner environment, not the repo |

## Dashboard Configuration

- [x] **One cloud project**
  - Location: Supabase Dashboard
  - Set to: one project, Storage off, no second project, no local Docker
- [x] **Owner user**
  - Location: Authentication → Users
  - Set to: `maria@almarprivatejourney.com`, email confirmed, name empty, no password. No link sent.
- [x] **Redirect allow-list**
  - Location: Authentication → URL Configuration
  - Set to: `http://127.0.0.1:3010/auth/confirm`, `https://almarprivatejourney.com/auth/confirm`, `https://www.almarprivatejourney.com/auth/confirm`, `https://dashboard.almarprivatejourney.com/auth/confirm`
  - Notes: no `/ops` path
- [ ] **Session time-box**
  - Location: Authentication → Sessions, or Policies on a Pro plan
  - Set to: 30 days, after the project is Pro
  - Notes: free plan rejects this setting. Magic-link expiry stays at the Supabase default. Do not type a 15-minute or 24-hour product TTL.

## Verification

After the three names are set in the owner environment, confirm they are present without printing the values.

Expected results:

- Each of the three names is set
- No value is written into the repo or chat
- Session time-box is still unset until Pro

---

**Once all items complete:** Mark status as "Complete" at top of file.
