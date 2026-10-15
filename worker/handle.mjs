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
 * Review fix (PR #16 round 1): the byte caps of the two public form handlers, the same numbers as
 * INQUIRY_LIMITS.body (lib/contact-inquiry.ts) and MAX_BODY_BYTES (app/newsletter/route.ts); tests/server-runtime.test.mjs
 * pins them. OpenNext reads a POST body whole before the route runs, so a POST whose Content-Length is above its
 * route's cap is answered 413 here, before Next, with the route's own 413 (JSON {"ok":false}, no-store, noindex). A
 * missing or non-numeric Content-Length (a chunked upload) goes on to the route, whose own cap still applies while it
 * reads (and a non-numeric length is its 400).
 */
export const FORM_BODY_CAPS = new Map([
  ["/api/contact", 16384],
  ["/newsletter", 8192],
]);

/** The declared length of a form POST is above its route's cap. */
function declaredTooLarge(request, pathname) {
  const cap = request.method === "POST" ? FORM_BODY_CAPS.get(pathname) : undefined;
  if (cap === undefined) return false;
  const declared = request.headers.get("content-length");
  return declared !== null && /^[0-9]{1,12}$/.test(declared) && Number(declared) > cap;
}

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
  if (declaredTooLarge(request, pathname)) {
    return Response.json({ ok: false }, { status: 413, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }

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
