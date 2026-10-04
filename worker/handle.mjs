// The request router of Worker `almar` (job 10, plan 02-20). It runs only when no static file matched the request
// (wrangler.toml sets no run_worker_first), so every public page is served before this code is reached.
//
// Deny by default: a request goes to Next only when its exact, raw pathname (never decoded, query ignored) is a
// server path; anything else goes back to the static assets, which answer today's branded 404 (or 405 for a
// method other than GET or HEAD), headers and all. Pure and import-free, so tests/server-runtime.test.mjs runs it
// with a fake env.

/**
 * @param {Request} request
 * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
 * @param {unknown} ctx
 * @param {{ serverPaths: Set<string>, nextFetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }} options
 * @returns {Promise<Response>}
 */
export async function handle(request, env, ctx, { serverPaths, nextFetch }) {
  const { pathname } = new URL(request.url);
  if (!serverPaths.has(pathname)) return env.ASSETS.fetch(request);

  const response = await nextFetch(request, env, ctx);
  if (response.status === 101 || response.webSocket) return response;
  // A server answer is never a page to index, on either host.
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
