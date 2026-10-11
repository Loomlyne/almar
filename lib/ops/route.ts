// Plan 03.2-04 (contract §4): the only way an /api/ops/* handler is built. Server only (it reaches next/headers through
// requireOwner; the `server-only` package is not a dependency, so this is a comment). Every route file under app/api/ops
// is `export const dynamic = "force-dynamic";` plus `export const GET = opsGet(...)` / `POST = opsPost(parse, ...)` /
// `PUT = opsPut(...)`; tests/ops-route.test.mjs refuses any other shape.
//
// requireOwner() runs first, then the Origin check (POST, PUT), then the body's type and size (POST), then `parse`,
// then the handler (lib/ops/route-core.ts runOps). Phase 4 and the minimal-ops endpoints build theirs the same way.

import { requireOwner, type OwnerContext } from "../auth/require-owner";
import { runOps, type OpsOutcome } from "./route-core";

export { OpsInvalid, mapDbError } from "./route-core";
export type { DbError, OpsOutcome, OpsResult } from "./route-core";
export type { OwnerContext };

export type OpsGetHandler = (ctx: { owner: OwnerContext; url: URL }) => Promise<OpsOutcome>;
export type OpsPostHandler<B> = (ctx: { owner: OwnerContext; body: B; request: Request }) => Promise<OpsOutcome>;
export type OpsPutHandler = (ctx: { owner: OwnerContext; request: Request }) => Promise<OpsOutcome>;

export function opsGet(handler: OpsGetHandler): (request: Request) => Promise<Response> {
  return (request) =>
    runOps<OwnerContext>({
      method: "GET",
      request,
      decide: requireOwner,
      nodeEnv: process.env.NODE_ENV,
      handler: ({ owner }) => handler({ owner, url: new URL(request.url) }),
    });
}

export function opsPost<B>(parse: (body: unknown) => B, handler: OpsPostHandler<B>): (request: Request) => Promise<Response> {
  return (request) =>
    runOps<OwnerContext, B>({
      method: "POST",
      request,
      decide: requireOwner,
      nodeEnv: process.env.NODE_ENV,
      parse,
      handler: async (ctx) => {
        const outcome = await handler(ctx);
        // 03.2-05 (contract §4): when the reply body says affects_site: true, request the public site update here
        // (requestSiteUpdate(ctx.owner.admin)) and attach `site: SiteStatus` to the body.
        return outcome;
      },
    });
}

/** Raw body (03.2-09 upload): owner, then Origin; no JSON parse and no 64 KiB cap (the handler enforces its own limits). */
export function opsPut(handler: OpsPutHandler): (request: Request) => Promise<Response> {
  return (request) =>
    runOps<OwnerContext>({
      method: "PUT",
      request,
      decide: requireOwner,
      nodeEnv: process.env.NODE_ENV,
      handler: ({ owner }) => handler({ owner, request }),
    });
}
