// Plan 02-04: which shell a request gets. Pure, no imports, so node tests load it directly.

export const OPS_HOSTNAME = "dashboard.almarprivatejourney.com";
/** Request header the middleware sets after it has decided the request is for the ops host. */
export const SHELL_HEADER = "x-almar-shell";
/** Dev and test only: lets a request on 127.0.0.1 act as the ops host. Ignored in production. */
export const HOST_OVERRIDE_HEADER = "x-almar-host";

function hostname(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

/** True only for the ops host, plus dashboard.localhost outside production (local tests). */
export function isOpsHost(host: string | null | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  const name = hostname(host);
  return name === OPS_HOSTNAME || (nodeEnv !== "production" && name === "dashboard.localhost");
}

/** The x-almar-host override is read only outside production. */
export function allowHostOverride(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}

export type HostRoute =
  | { kind: "next" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; path: string }
  | { kind: "not-found" };

/**
 * Ops host: the browser never sees /dashboard. `/` is Home for the owner and the ops sign-in for
 * anyone else; `/sign-in` is always the ops sign-in; `/<section>` serves `/dashboard/<section>`; a typed `/dashboard/...` goes to the clean
 * path. `/auth/*` stays as is (confirm, handoff, sign-out).
 * Marketing host: `/dashboard` and `/ops` are 404 in production. The dev server keeps `/dashboard`
 * for reviewing the drawn screens (3.1 D-55).
 */
export function routeFor({
  host,
  path,
  isOwner,
  production,
  rewritten = false,
}: {
  host: string | null | undefined;
  path: string;
  isOwner: boolean;
  production: boolean;
  /** The request already carries the shell header: Next runs middleware again on a rewrite target. */
  rewritten?: boolean;
}): HostRoute {
  if (isOpsHost(host)) {
    if (path === "/dashboard" || path.startsWith("/dashboard/")) {
      if (rewritten) return { kind: "next" };
      return { kind: "redirect", path: path.slice("/dashboard".length) || "/" };
    }
    if (path === "/auth" || path.startsWith("/auth/")) return { kind: "next" };
    if (path === "/") return { kind: "rewrite", path: isOwner ? "/dashboard/home" : "/dashboard" };
    if (path === "/sign-in") return { kind: "rewrite", path: "/dashboard" };
    return { kind: "rewrite", path: `/dashboard${path}` };
  }
  const opsPath = /^\/(dashboard|ops)(\/|$)/i.test(path);
  if (opsPath && production) return { kind: "not-found" };
  return { kind: "next" };
}

/** The ops-host origin a handoff sends her to, from the public host she is on. */
export function opsOrigin(publicHost: string | null | undefined, nodeEnv: string | undefined): string {
  const name = (publicHost ?? "").trim().toLowerCase();
  if (nodeEnv !== "production") {
    const local = name.match(/^(?:127\.0\.0\.1|localhost)(:\d{2,5})?$/);
    if (local) return `http://dashboard.localhost${local[1] ?? ""}`;
  }
  return `https://${OPS_HOSTNAME}`;
}
