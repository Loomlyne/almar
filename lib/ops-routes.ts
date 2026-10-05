// What may run on the server behind Worker `almar-ops` (plan 03.2-03; C-20: the dashboard at
// dashboard.almarprivatejourney.com is a second Worker). Like worker/almar.mjs on the public side, worker/almar-ops.mjs
// forwards a request to Next only when its exact pathname is in the list scripts/assemble-cloudflare.mjs builds here
// with opsPathsFrom() and writes to .open-next/almar-ops-routes.json; everything else is a static file of out-ops/
// (which holds no page) or the branded 404.
//
// How a later plan adds to the ops host:
// 1. A new screen is a page under app/dashboard/(ops)/<section>/ and appears here by itself (as /<section> and
//    /dashboard/<section>); static segments only. Its section goes in OPS_LIVE_SECTIONS in the commit that wires it.
// 2. A new owner endpoint is app/api/ops/<name>/route.ts with `export const dynamic = "force-dynamic"`; static path,
//    no [id] (ids go in the query or the body). It is served here and refused by the public Worker (lib/server-routes.ts).
// 3. Nothing else is served: a guest API (/api/booking/*, /api/stripe/webhook) or a marketing page is a 404 on this host.
//
// A leaf module (no imports): the assembler, the Worker, the middleware and the node tests load it directly.

/** Paths that are always served on the ops host: the owner's Home or the sign-in (`/`), the sign-in, the typed-URL redirect. */
export const OPS_FIXED_PATHS = ["/", "/sign-in", "/dashboard"] as const;

/**
 * The sign-in routes of the ops host. `/auth/handoff/start` is the marketing host's (job 02 finding 12) and is never
 * here. Each must exist as a route handler in the build, or the ops build stops.
 */
export const OPS_AUTH_PATHS = ["/auth/confirm", "/auth/handoff", "/auth/sign-out"] as const;

export const OPS_API_HEALTH = "/api/health";

/** Request header the middleware sets (ops host only) to the path the browser asked for; a client copy is always dropped. */
export const OPS_PATH_HEADER = "x-almar-ops-path";

/**
 * The ops sections whose page renders for the owner (03.2-API-CONTRACT §7). Empty until a screens plan wires one:
 * "every shown control works" (C-18), so an unwired screen stays on job 02's "Not ready." state. Each plan adds its
 * section, such as "/catalog/stays", in the commit that wires it; a section lists everything under it too. The owner's
 * Home is "/" in the browser and "/home" once rewritten: wiring it lists both.
 */
export const OPS_LIVE_SECTIONS: readonly string[] = [];

/**
 * True when `path` is, or sits under, a live section. The path is the browser's (`/catalog/stays`) or the rewrite
 * target (`/dashboard/catalog/stays`): both give the same answer. Exact segments only: `/catalog/stays-old` and
 * `/catalog` are not `/catalog/stays`.
 */
export function isLiveOpsPath(path: string, sections: readonly string[] = OPS_LIVE_SECTIONS): boolean {
  let bare = path;
  if (bare === "/dashboard") bare = "/";
  else if (bare.startsWith("/dashboard/")) bare = bare.slice("/dashboard".length);
  if (bare.length > 1 && bare.endsWith("/")) bare = bare.slice(0, -1);
  return sections.some((section) => bare === section || (section !== "/" && bare.startsWith(`${section}/`)));
}

// ---- what is served ---------------------------------------------------------------------------------------------

const PLAIN_GROUP = /^\([A-Za-z0-9_-]+\)$/;
/** First segments a dashboard section may never take: they would shadow a server prefix or a static folder. */
const RESERVED_SECTIONS = new Set(["api", "auth", "dashboard", "cdn-cgi"]);
/** Sections of the public and guest side that never exist on the ops host (a bare /<name> here would be one of them). */
const PUBLIC_ROOTS = new Set(["ar", "es", "booking", "embed", "fx", "newsletter", "login", "account"]);

function assertWellFormed(path: string): boolean {
  const segments = path.split("/").slice(1);
  return (
    path.startsWith("/") &&
    path !== "/" &&
    !path.endsWith("/") &&
    !/[?#*\[\]%\\]/.test(path) &&
    segments.every((s) => s !== "" && s !== "." && s !== "..")
  );
}

/**
 * Throws unless `path` has a shape opsPathsFrom can produce: a fixed ops path, one of OPS_AUTH_PATHS, /api/health,
 * /api/ops/<x>, /dashboard/<section> or /<section>. Never a static-layer prefix (/_next, /cdn-cgi), a locale root,
 * a held or guest section, the marketing host's handoff start, or an /api path of the public Worker.
 * With `all` (the whole list) a bare `/<section>` must also have its `/dashboard/<section>` twin in the list, which
 * is what separates a dashboard section from a marketing page of the same shape (`/about` has no twin).
 */
export function assertOpsPath(path: string, all?: readonly string[]): void {
  const fail = (why: string): never => {
    throw new Error(`ops path ${JSON.stringify(path)} ${why} (lib/ops-routes.ts)`);
  };
  if ((OPS_FIXED_PATHS as readonly string[]).includes(path)) return;
  if ((OPS_AUTH_PATHS as readonly string[]).includes(path) || path === OPS_API_HEALTH) return;
  if (typeof path !== "string" || !assertWellFormed(path)) return fail("is not a plain absolute path");
  const [first, ...rest] = path.split("/").slice(1);
  if (first.startsWith("_") || first === "cdn-cgi") return fail("is a static-layer or private prefix");
  if (PUBLIC_ROOTS.has(first)) return fail("is a public or guest path, which the ops host never serves");
  if (first === "auth") return fail("is not one of the ops sign-in routes");
  if (first === "api") {
    if (!path.startsWith("/api/ops/")) return fail("is an /api path that only the public Worker serves");
    return;
  }
  if (first === "dashboard") {
    if (RESERVED_SECTIONS.has(rest[0]) || rest[0].startsWith("_")) return fail("names a reserved section");
    return;
  }
  if (all && !all.includes(`/dashboard${path}`)) return fail(`has no /dashboard${path} twin: it is not a dashboard section`);
}

function assertNoSpecialSegments(key: string, segments: string[], scope: string): void {
  for (const segment of segments) {
    // Plain (group) segments of app/dashboard were removed by the caller; under app/api/ops a group is refused too.
    if (/^[\[@(]/.test(segment)) {
      throw new Error(`${key}: dynamic, catch-all, parallel, intercepting and grouped segments under ${scope} are not served`);
    }
  }
}

/**
 * The exact ops paths, sorted, from the keys of Next's app-paths-manifest.json (such as
 * `/dashboard/(ops)/catalog/stays/page`, `/auth/confirm/route`, `/api/ops/stays/route`):
 *  - OPS_FIXED_PATHS, OPS_AUTH_PATHS and /api/health (each auth route and the health route must be in the manifest);
 *  - every page under /dashboard, with `(group)` segments removed, as `/dashboard/<section>` (job 02 redirects it to
 *    the clean path) and `/<section>`;
 *  - every route handler under /api/ops as `/api/ops/<name>`.
 * Throws on a dynamic, catch-all, parallel or intercepting segment under /dashboard or /api/ops, on a page under
 * /api/ops (and on app/api/ops/route.ts itself), on a section that would shadow a server prefix, and on a missing
 * sign-in or health route. Anything else in the manifest (marketing pages, guest APIs, the harness) is not served.
 */
export function opsPathsFrom(manifestKeys: readonly string[]): string[] {
  const keys = new Set(manifestKeys);
  const found = new Set<string>([...OPS_FIXED_PATHS, ...OPS_AUTH_PATHS, OPS_API_HEALTH]);
  for (const path of [...OPS_AUTH_PATHS, OPS_API_HEALTH]) {
    if (!keys.has(`${path}/route`)) throw new Error(`${path}/route is missing from the build: the ops host needs it`);
  }

  for (const key of keys) {
    if (key.startsWith("/api/ops/")) {
      if (!key.endsWith("/route")) throw new Error(`${key}: only route handlers may live under app/api/ops, never a page`);
      const path = key.slice(0, -"/route".length);
      if (path === "/api/ops") throw new Error(`${key}: app/api/ops/route.ts is not served; use /api/ops/<name>`);
      assertNoSpecialSegments(key, path.split("/").slice(1), "app/api/ops");
      found.add(path);
      continue;
    }
    if (!key.startsWith("/dashboard/") || !key.endsWith("/page")) continue;
    const segments = key.slice("/dashboard/".length, -"/page".length).split("/").filter((s) => s !== "");
    const kept = segments.filter((s) => !PLAIN_GROUP.test(s));
    assertNoSpecialSegments(key, kept, "app/dashboard");
    if (kept.length === 0) continue; // /dashboard itself is fixed
    if (RESERVED_SECTIONS.has(kept[0]) || kept[0].startsWith("_")) {
      throw new Error(`${key}: a dashboard section may not be named "${kept[0]}" (it would shadow a server prefix)`);
    }
    const section = `/${kept.join("/")}`;
    found.add(section);
    found.add(`/dashboard${section}`);
  }

  const list = [...found].sort();
  for (const path of list) assertOpsPath(path, list);
  return list;
}
