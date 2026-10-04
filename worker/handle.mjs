// The request router of Worker `almar` (job 10, plan 02-20). Cloudflare runs it first for the `run_worker_first`
// paths in wrangler.toml (["/api/*"] today). A request for a file in the assets folder never reaches it, and a miss
// reaches the static 404 without it only for browser navigations (Sec-Fetch-Mode: navigate); curl, fetch, bots and
// scanners that miss are handed to it, so it must answer them (below) and they count toward the Free plan's 100k
// Worker requests a day.
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

  // Next trusts these two headers (OpenNext copies x-forwarded-host into Host, and reads the client address from
  // x-forwarded-for), and a visitor can send either. Drop the host; take the address from Cloudflare only.
  const headers = new Headers(request.headers);
  headers.delete("x-forwarded-host");
  const address = request.headers.get("cf-connecting-ip");
  if (address) headers.set("x-forwarded-for", address);
  else headers.delete("x-forwarded-for");

  const response = await nextFetch(new Request(request, { headers }), env, ctx);
  if (response.status === 101 || response.webSocket) return response;
  // A server answer is never a page to index, on either host.
  const out = new Headers(response.headers);
  out.set("x-robots-tag", "noindex");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: out });
}
