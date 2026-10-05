// Worker entry for `almar-ops` (plan 03.2-03; `main` in wrangler.ops.toml), the dashboard at
// dashboard.almarprivatejourney.com. run_worker_first is true there, so every request reaches this script, including
// the browser navigations the public Worker leaves to the asset layer. handle() sends an exact ops path (the list
// lib/ops-routes.ts builds into .open-next/almar-ops-routes.json) to Next and everything else to the ops asset
// folder, out-ops/, which holds no page: a static file (public/ and _next/static) or the branded 404. The two
// .open-next files it imports are written by `node scripts/assemble-cloudflare.mjs --target=ops`.
// Only the custom domain routes to this Worker (workers_dev and preview_urls are off), and the middleware treats any
// other host as the marketing host (lib/host.ts). A second wall here (Fable review of 7527f88): a request whose host is
// not the ops host is answered by the static assets and never handed to Next, so this Worker can never render a
// marketing page. The one exception is /api/health, which holds nothing, so a readiness poll without the ops host works.
import openNext from "../.open-next/worker.js";
import opsRoutes from "../.open-next/almar-ops-routes.json";
import { OPS_API_HEALTH, OPS_PATH_HEADER, assertOpsPath } from "../lib/ops-routes.ts";
import { isOpsHost } from "../lib/host.ts";
import { handle } from "./handle.mjs";

// Checked again here, at startup, because wrangler bundles whatever list is on disk: a hand-edited or stale list
// makes the Worker fail to start (the upload is refused) instead of serving a marketing page or a guest API.
for (const path of opsRoutes) assertOpsPath(path, opsRoutes);

const OPS_PATHS = new Set(opsRoutes);

/**
 * True only for the ops host, by the URL's host and by the Host header (both, so a mismatch fails closed). "production"
 * is passed on purpose: process.env.NODE_ENV is not set in this script, and dashboard.localhost must not count here.
 */
function onOpsHost(request) {
  const header = request.headers.get("host");
  return isOpsHost(new URL(request.url).hostname, "production") && (header === null || isOpsHost(header, "production"));
}

// x-almar-ops-path is set by the middleware only (it drops a client copy too); the Worker drops it as well, so a
// client-sent one never reaches Next whatever the middleware does. handle() has just built this Request, so its headers
// are the Worker's own. x-almar-shell is left alone: it is the middleware's.
function nextFetch(request, env, ctx) {
  request.headers.delete(OPS_PATH_HEADER);
  return openNext.fetch(request, env, ctx);
}

export default {
  fetch: (request, env, ctx) => {
    if (!onOpsHost(request) && new URL(request.url).pathname !== OPS_API_HEALTH) return env.ASSETS.fetch(request);
    return handle(request, env, ctx, { serverPaths: OPS_PATHS, nextFetch });
  },
};
