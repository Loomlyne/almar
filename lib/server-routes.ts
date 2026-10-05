// What may run on the server behind Worker `almar` (job 10, plan 02-20). Everything else is a static file or the
// branded 404: Cloudflare runs the Worker only for the run_worker_first paths, and worker/almar.mjs forwards a
// request to Next only when its exact path is in the list scripts/assemble-cloudflare.mjs builds with
// serverPathsFrom().
//
// How a slice adds a server endpoint:
// 1. Add app/api/<name>/route.ts with `export const dynamic = "force-dynamic"` and no `runtime = "edge"`. It is
//    served from the next build; nothing else to edit.
// 2. A path outside /api also goes in SERVER_PATHS_OUTSIDE_API and in `run_worker_first` of wrangler.toml and
//    wrangler.preview.toml, and leaves HELD_PATHS, in the same commit (tests/server-runtime.test.mjs checks all three).
// 3. tests/build/server-runtime.spec.ts lists what must stay 404; flip its entry in the same commit.
// 4. /api/ops/* (the owner's dashboard endpoints) is never served here: it belongs to Worker almar-ops only
//    (lib/ops-routes.ts, plan 03.2-03). serverPathsFrom skips it and worker/almar.mjs refuses it at startup.
//
// A leaf module (no imports): the assembler, the node tests and the build spec load it directly.

/**
 * Sections that answer 404 on both hosts until their own phase ships, whatever app/ holds. Next compiles every
 * route in app/, so this list, not the absence of a file, is what keeps them closed. A locale prefix (/ar, /es)
 * does not change that. The last entry is the test harness page: a deny entry, not a link.
 */
export const HELD_PATHS = [
  "/dashboard",
  "/booking",
  "/fx",
  "/newsletter",
  "/embed",
  "/__harness",
] as const;

/** The owner's dashboard endpoints. Served by Worker almar-ops only (plan 03.2-03), never by `almar` or `almar-preview`. */
export const OPS_API_PREFIX = "/api/ops/";

/**
 * Exact server paths outside /api. Phase 2's sign-in (plan 02-23 task 3): the same six as JOB02_SERVER_PATHS in
 * lib/auth/server-paths.ts (tests/server-runtime.test.mjs asserts they are equal). Known future user: slice 3
 * plan 27 (`/newsletter`, moved out of HELD_PATHS in the same commit).
 */
export const SERVER_PATHS_OUTSIDE_API: readonly string[] = [
  "/login",
  "/auth/confirm",
  "/auth/sign-out",
  "/auth/handoff/start",
  "/account",
  "/bookings",
];

const LOCALE_PREFIXES = ["/ar", "/es"];

function withoutLocale(path: string): string {
  for (const prefix of LOCALE_PREFIXES) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

/** True when `path` is a held section or sits under one, with or without a locale prefix. */
export function isHeldPath(path: string): boolean {
  const bare = withoutLocale(path);
  return HELD_PATHS.some((entry) => bare === entry || bare.startsWith(`${entry}/`));
}

function assertWellFormed(path: string): void {
  const segments = path.split("/").slice(1);
  const ok =
    path.startsWith("/") &&
    path !== "/" &&
    !path.endsWith("/") &&
    !/[?#*\[\]%\\]/.test(path) &&
    segments.every((s) => s !== "" && s !== "." && s !== "..");
  if (!ok) throw new Error(`server path ${JSON.stringify(path)} is not a plain absolute path`);
}

/**
 * The exact server paths, sorted: every static app/api route (from the keys of Next's app-paths-manifest.json,
 * such as `/api/health/route`) plus `extra` (SERVER_PATHS_OUTSIDE_API by default).
 * Throws on a page under app/api, on a dynamic, catch-all, grouped or parallel segment under app/api, on a
 * malformed extra path, on an extra path under /api, and on any path that is held. A route under /api/ops is skipped
 * (it is served by almar-ops only), after the same shape checks.
 */
export function serverPathsFrom(manifestKeys: readonly string[], extra: readonly string[] = SERVER_PATHS_OUTSIDE_API): string[] {
  const found = new Set<string>();
  for (const key of manifestKeys) {
    if (!key.startsWith("/api/")) continue;
    if (!key.endsWith("/route")) {
      throw new Error(`${key}: only route handlers may live under app/api, never a page`);
    }
    const path = key.slice(0, -"/route".length) || "/";
    if (path === "/api") {
      throw new Error(`${key}: app/api/route.ts is not served (run_worker_first covers /api/*, not /api)`);
    }
    if (path.split("/").some((s) => /^[\[(@]/.test(s))) {
      throw new Error(`${key}: dynamic, catch-all, grouped and parallel segments under app/api are not served`);
    }
    assertWellFormed(path);
    // Served by almar-ops only (03.2-03): the public Worker never forwards it, so it is not on this list.
    if (path === "/api/ops" || path.startsWith(OPS_API_PREFIX)) continue;
    found.add(path);
  }
  for (const path of extra) {
    assertWellFormed(path);
    if (path === "/api" || path.startsWith("/api/")) {
      throw new Error(`server path ${path}: paths under /api come from app/api route files, not from this list`);
    }
    found.add(path);
  }
  for (const path of found) {
    if (isHeldPath(path)) throw new Error(`server path ${path} is held (lib/server-routes.ts HELD_PATHS)`);
  }
  return [...found].sort();
}
