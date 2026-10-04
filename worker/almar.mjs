// Worker entry for `almar` and `almar-preview` (job 10, plan 02-20; `main` in wrangler.toml and
// wrangler.preview.toml). Cloudflare runs it only for paths in `run_worker_first` (["/api/*"] plus any path outside
// /api that lib/server-routes.ts serves); every other request is a static file or the static 404 with no Worker
// call. Both .open-next files it imports are written by `node scripts/assemble-cloudflare.mjs`. No Durable Object,
// queue or cache class is exported: none is bound.
import openNext from "../.open-next/worker.js";
import serverPaths from "../.open-next/almar-server-routes.json";
import { SERVER_PATHS_OUTSIDE_API, isHeldPath } from "../lib/server-routes.ts";
import { handle } from "./handle.mjs";

// Checked again here, at startup, because wrangler bundles whatever list is on disk: a hand-edited or stale list
// makes the Worker fail to start (the upload is refused) instead of opening a held page.
for (const path of serverPaths) {
  const allowed = path.startsWith("/api/") || SERVER_PATHS_OUTSIDE_API.includes(path);
  if (!allowed || isHeldPath(path) || path.startsWith("/_next") || path.startsWith("/cdn-cgi")) {
    throw new Error(`server path ${path} may not run on this Worker (lib/server-routes.ts)`);
  }
}

const SERVER_PATHS = new Set(serverPaths);

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx, { serverPaths: SERVER_PATHS, nextFetch: openNext.fetch.bind(openNext) }),
};
