# Job 10 deploy runbook: Worker `almar-preview`, then Worker `almar`

For the ALMAR controller only, on the owner's word, one word per Worker. Written by job 10 (plan 02-22), 2026-10-04.
Run every command from the main ALMAR folder on `main` after the job has landed, with `npm ci` done.

Every wrangler command below is written out in full with ALMAR's own login. Never a bare `wrangler` (it is the Vamos
login), never `opennextjs-cloudflare deploy`, never an `npm run` deploy (there is none any more).

## 0. Before anything

1. `git log -3` and `git log -1 origin/main`: say what moved since the check.
2. Read each Worker's live version; these are the rollback targets. Write them down.

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deployments list --config wrangler.toml
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deployments list --config wrangler.preview.toml
   ```

   Expected: the newest entry of each gives a version id. The job 10 prompt named production `f9ba2378`; never trust
   that line, read it here.
3. Worker `almar-preview` must already exist **and** `preview.almarprivatejourney.com` must already be attached to it as
   its custom domain (slice 1 plan 08's owner step). A deploy with `custom_domain = true` would otherwise create the
   DNS record. If the second command above fails, or the dashboard shows no custom domain on `almar-preview`, STOP:
   job 10 creates neither.

## 1. Preview, only on the owner's word for the preview deploy

1. `node scripts/assemble-cloudflare.mjs --target=preview`
   Expected last line: `assembled 57 html files into out-preview/ (target: preview) … server paths: /api/health`
   (the page count grows as slices land).
2. What will run (security review 2026-10-04): `git status --short` prints nothing, and
   `cat .open-next/almar-server-routes.json` prints exactly `["/api/health"]` (plus any path a later landed job added
   on purpose). Anything else: STOP and rebuild. (The Worker also refuses to start with a held path in that file.)
   Then the size check, no upload:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --dry-run --config wrangler.preview.toml --outdir /tmp/almar-dry-preview
   ```

   Expected: `Total Upload: … / gzip: N KiB` with N under 3,072 (Workers Free plan; job 10 measured 1,627).
   Bindings: `env.ASSETS` only.
3. Deploy:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --config wrangler.preview.toml
   ```

   Expected: `Uploaded almar-preview`, `Deployed almar-preview triggers`, `preview.almarprivatejourney.com (custom
   domain)`, and a new version id. Write it down.

## 2. Preview checks (GET only)

1. In a second terminal, before the first request, open the log (it shows a CPU-limit error a later call could hide):

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler tail --config wrangler.preview.toml --format pretty
   ```

2. Open https://preview.almarprivatejourney.com/api/health in a browser tab too: `{"ok":true}` (a browser navigation
   must reach the Worker; `run_worker_first` does that).
3. `/api/health` 20 times, the first right after the deploy:
   `for i in $(seq 1 20); do curl -s -w " %{http_code}\n" https://preview.almarprivatejourney.com/api/health; done`
   Expected: 20 lines `{"ok":true} 200`. **Stop rule (owner D-SR-02):** any other status, a `1102`, a `503`, or
   "Exceeded CPU" / "exceededCpu" in the tail: roll preview back (section 5) and put the upgrade question to the owner
   (Workers Paid). Production does not start.
4. Held sections answer 404 with the branded page:
   `for p in /dashboard /account /login /booking/trip /bookings /fx /newsletter /embed/hero-booker /__harness /ar/login; do curl -s -o /dev/null -w "$p %{http_code}\n" https://preview.almarprivatejourney.com$p; done`
   Expected: every line `404`.
5. Pages: `curl -sI https://preview.almarprivatejourney.com/ar/` (and `/`, `/es/`, `/about`, one stay page):
   `200` and `x-robots-tag: noindex, nofollow`.
6. `curl -s https://preview.almarprivatejourney.com/robots.txt`: `User-agent: *` / `Disallow: /`.

## 3. Production, only on the owner's separate word for production

1. `node scripts/assemble-cloudflare.mjs --target=production`
2. The same "what will run" check as 1.2 (`git status --short` empty; the routes file as expected), then the size
   check:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --dry-run --config wrangler.toml --outdir /tmp/almar-dry-production
   ```

   Expected: gzip under 3,072 KiB; `env.ASSETS` only.
3. Deploy:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --config wrangler.toml
   ```

   Expected: `Uploaded almar`, triggers `almarprivatejourney.com (custom domain)` and
   `www.almarprivatejourney.com (custom domain)`, a new version id. Write it down.

## 4. Live checks, with the tail open (`… wrangler tail --config wrangler.toml --format pretty`)

For `https://almarprivatejourney.com` and `https://www.almarprivatejourney.com`:

1. `/api/health` 20 times: 20 × `{"ok":true} 200`. Same stop rule as 2.3, rollback with section 5.
   Also open https://almarprivatejourney.com/api/health in a browser tab: `{"ok":true}`.
2. The held list of 2.4: every line `404`, the body the branded "Page not found".
3. Every public page `200` with **no** `x-robots-tag` header.
4. Same bytes: `curl -s https://almarprivatejourney.com/ | cmp - out/index.html`, and the same for `/ar/` against
   `out/ar/index.html`, `/es/` against `out/es/index.html`, `/about` against `out/about.html`. Expected: no output.
5. `/robots.txt` allows and names the sitemap; `/sitemap.xml` is `200`.

## 5. Rollback (one command per Worker)

```
HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler rollback <production version id from 0.2> --message "job 10 rollback" --config wrangler.toml
HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler rollback <preview version id from 0.2> --message "job 10 rollback" --config wrangler.preview.toml
```

Then repeat section 4's page checks (items 2 to 5). A rollback returns the static-only Worker; nothing else needs
undoing: no route, DNS record, binding or secret was created by this job.

## 6. After a good deploy

- The owner's secret steps (in `HANDOVER-job-10.md`) may run. Each secret he sets makes a new version of the
  code already live, so the next job reads its rollback target again.
- The board records both new version ids and the time.
