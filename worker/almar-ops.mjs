// Worker entry for `almar-ops` (plan 03.2-03; `main` in wrangler.ops.toml), the dashboard at
// dashboard.almarprivatejourney.com. run_worker_first is true there, so every request reaches this script, including
// the browser navigations the public Worker leaves to the asset layer. handle() sends an exact ops path (the list
// lib/ops-routes.ts builds into .open-next/almar-ops-routes.json) to Next and everything else to the ops asset
// folder, out-ops/, which holds no page: a static file (public/ and _next/static) or the branded 404. The two
// .open-next files it imports are written by `node scripts/assemble-cloudflare.mjs --target=ops`.
// There is no host check here: only the custom domain routes to this Worker (workers_dev and preview_urls are off),
// and the middleware treats any other host as the marketing host (lib/host.ts).
import openNext from "../.open-next/worker.js";
import opsRoutes from "../.open-next/almar-ops-routes.json";
import { assertOpsPath } from "../lib/ops-routes.ts";
import { handle } from "./handle.mjs";

// Checked again here, at startup, because wrangler bundles whatever list is on disk: a hand-edited or stale list
// makes the Worker fail to start (the upload is refused) instead of serving a marketing page or a guest API.
for (const path of opsRoutes) assertOpsPath(path, opsRoutes);

const OPS_PATHS = new Set(opsRoutes);

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx, { serverPaths: OPS_PATHS, nextFetch: openNext.fetch.bind(openNext) }),
};
