// Worker entry for `almar` and `almar-preview` (job 10, plan 02-20; `main` in wrangler.toml and
// wrangler.preview.toml). It runs only on an asset miss: no run_worker_first is set, so a request that matches a
// file in the assets folder never reaches this code. Both files it imports are written by
// `node scripts/assemble-cloudflare.mjs`. No Durable Object, queue or cache class is exported: none is bound.
import openNext from "../.open-next/worker.js";
import serverPaths from "../.open-next/almar-server-routes.json";
import { handle } from "./handle.mjs";

const SERVER_PATHS = new Set(serverPaths);

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx, { serverPaths: SERVER_PATHS, nextFetch: openNext.fetch.bind(openNext) }),
};
