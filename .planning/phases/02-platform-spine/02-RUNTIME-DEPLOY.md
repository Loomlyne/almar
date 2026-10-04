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
   Expected last line: `assembled 57 html files into out-preview/ (target: preview) … server paths: /api/health;
   Worker N KiB gzip` (the page count grows as slices land). The assembler has already bundled the Worker with a
   dry run and refused to finish above 2,560 KiB gzipped (`scripts/worker-size.mjs`); N was 1,651 on 2026-10-05.
2. What will run (security review 2026-10-04): `git status --short` prints nothing, and
   `cat .open-next/almar-server-routes.json` prints exactly `["/api/health"]` (plus any path a later landed job added
   on purpose). Anything else: STOP and rebuild. (The Worker also refuses to start with a held path in that file.)
   Then the size check, no upload:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --dry-run --config wrangler.preview.toml --outdir /tmp/almar-dry-preview
   ```

   Expected: `Total Upload: … / gzip: N KiB` with N under 3,072 (Workers Free plan; job 10 measured 1,627, and
   1,651 on 2026-10-05; the same N the assembler printed). Bindings: `env.ASSETS` only.
3. Deploy:

   ```
   HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler deploy --config wrangler.preview.toml
   ```

   Expected: `Uploaded almar-preview`, `Deployed almar-preview triggers`, `preview.almarprivatejourney.com (custom
   domain)`, and a new version id. Write it down.

   An upload refused with error 10021 means the startup guard in `worker/almar.mjs` fired (the generated route list
   holds a path the Worker may not run): rebuild with `node scripts/assemble-cloudflare.mjs`, never force the upload.

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
   These 20 calls prove one warm isolate on one network, nothing more. So also run the same loop from a second
   network (the phone on mobile data, not the Wi-Fi), repeat the whole check after every `wrangler secret put` (each
   one makes a new version, which starts cold), and keep `wrangler tail` open for the first day, watching for
   `exceededCpu`.
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
   `www.almarprivatejourney.com (custom domain)`, a new version id. Write it down. Error 10021: see 1.3, rebuild,
   never force.

## 4. Live checks, with the tail open (`… wrangler tail --config wrangler.toml --format pretty`)

For `https://almarprivatejourney.com` and `https://www.almarprivatejourney.com`:

1. `/api/health` 20 times: 20 × `{"ok":true} 200`. Same stop rule as 2.3, rollback with section 5. The same caveat
   holds: also run the loop from a second network, repeat it after every `wrangler secret put`, and keep the tail
   open for `exceededCpu` the whole first day.
   Also open https://almarprivatejourney.com/api/health in a browser tab: `{"ok":true}`.
2. The held list of 2.4: every line `404`, the body the branded "Page not found".
3. Every public page `200` with **no** `x-robots-tag` header.
4. Same bytes: `curl -s https://almarprivatejourney.com/ | cmp - out/index.html`, and the same for `/ar/` against
   `out/ar/index.html`, `/es/` against `out/es/index.html`, `/about` against `out/about.html`. Expected: no output.
5. `/robots.txt` allows and names the sitemap; `/sitemap.xml` is `200`.
6. Watch the daily Worker request count (dashboard, Workers & Pages, `almar`, Metrics, Requests), at the end of day one
   and again after a week. Bots and scanners that miss a file invoke the Worker (only browser navigations get the
   404 page without it), and the Free plan allows 100,000 Worker requests a day. If the count nears that, put the
   Workers Paid question to the owner; do not wait for the limit to answer errors.

## 5. Rollback (one command per Worker)

```
HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler rollback <production version id from 0.2> --message "job 10 rollback" --config wrangler.toml
HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler rollback <preview version id from 0.2> --message "job 10 rollback" --config wrangler.preview.toml
```

Then repeat section 4's page checks (items 2 to 5). A rollback returns the static-only Worker; nothing else needs
undoing: no route, DNS record, binding or secret was created by this job.

## 6. Precondition for slice 3 plan 26 (`/api/contact`)

Not part of this deploy. Before `/api/contact` (or any route that reads a POST body) is switched on, prove on the
built Worker, locally with `wrangler dev` and then on `almar-preview`, that two POSTs in a row keep their bodies.
Why it is open: `worker/handle.mjs` forwards `new Request(request, { headers })`. OpenNext's `init.js` replaces
`globalThis.Request` with its own subclass on the first request it serves; from the second request on, that
expression builds the subclass, whose constructor redefines `body` on the init object it is given (it is `{ headers }`
here, so `body` becomes an own `undefined`, not the original body). Job 10 sends only GETs
(`/api/health` reads no body), so nothing has shown yet that the second POST still carries its body. The test is two
POSTs with different bodies, in one session, and the route echoing a length or hash of what it read; if the second
one arrives empty, change `handle.mjs` to pass the body explicitly before the route ships.

## 7. After a good deploy

- The owner's secret steps (in `HANDOVER-job-10.md`) may run. Each secret he sets makes a new version of the
  code already live, so the next job reads its rollback target again.
- The board records both new version ids and the time.
