// The rate limit of the public forms (plan 26: POST /api/contact, scope "contact"; plan 27 reuses it for /newsletter,
// scope "newsletter"; plan 06-05: /api/requests, scope "request", and /api/consult/book, scope "consult"). Server only. It reads the Cloudflare Workers Rate Limiting binding FORM_LIMITER
// (`[[ratelimits]]` in wrangler.toml and wrangler.preview.toml: 5 posts a minute per scope and visitor address) through
// getCloudflareContext(), the way lib/ops/media-env.ts reads its R2 binding.
//
// The visitor address is the CF-Connecting-IP header, which Cloudflare's edge sets on every request (a visitor cannot
// choose it there); without it (local next dev, node tests) every request shares the key "<scope>:unknown".
//
// Where no binding exists (next dev, node tests, a Worker deployed without the block) the post is allowed: the limiter
// is one layer on top of the origin check, the size caps and the honeypots, and a missing binding must not turn every
// inquiry away. A limiter call that throws is treated the same way, for the same reason. The third parameter of
// allowFormPost is the seam the node tests use to pass a fake limiter.
//
// Review fix (3.3 part B): failing open must not be silent on a Worker. When a Cloudflare context exists but has no
// FORM_LIMITER, or when limit() throws, allowFormPost logs ONE line per request, `console.error("form-limiter:
// unavailable")`, with no address, key or error text. With no Cloudflare context at all (next dev, node) it logs nothing.
// Review fix (PR #16 round 1): getCloudflareContext() throwing while the code runs on a Worker (workerd reports
// navigator.userAgent "Cloudflare-Workers") is the same unavailable limiter and logs the same line; a throw anywhere
// else is still "no context" and silent.

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The Workers Rate Limiting binding, structurally (the repo has no @cloudflare/workers-types). */
export type FormLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

export type FormScope = "contact" | "newsletter" | "request" | "consult";

declare global {
  interface CloudflareEnv {
    FORM_LIMITER?: FormLimiter;
  }
}

type Lookup = { kind: "no-context" } | { kind: "unavailable" } | { kind: "bound"; limiter: FormLimiter };

/** True inside workerd, which reports this user agent; false under next dev and node. */
function onWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

/**
 * What the Worker holds: no Cloudflare context (next dev, node), an unavailable limiter (a context without the
 * binding, or a Worker whose context lookup threw), or the binding.
 */
function lookupLimiter(): Lookup {
  let limiter: FormLimiter | undefined;
  try {
    limiter = getCloudflareContext().env.FORM_LIMITER;
  } catch {
    return onWorker() ? { kind: "unavailable" } : { kind: "no-context" };
  }
  return limiter ? { kind: "bound", limiter } : { kind: "unavailable" };
}

const UNAVAILABLE = "form-limiter: unavailable";

/** The bound limiter, or null outside a Worker that binds it. getCloudflareContext() throws outside a Worker request. */
export function formLimiter(): FormLimiter | null {
  const found = lookupLimiter();
  return found.kind === "bound" ? found.limiter : null;
}

/** `<scope>:<CF-Connecting-IP>`, or `<scope>:unknown` without the header. */
export function formRateKey(request: Request, scope: FormScope): string {
  const address = request.headers.get("cf-connecting-ip")?.trim();
  return `${scope}:${address || "unknown"}`;
}

/**
 * True when this post may go on: no limiter, a limiter that says yes, or a limiter that failed (logged once, see the
 * header). `limiter` is the test seam: when given (a fake, or null for "none") the Worker is not asked.
 */
export async function allowFormPost(request: Request, scope: FormScope, limiter?: FormLimiter | null): Promise<boolean> {
  let bound = limiter;
  if (bound === undefined) {
    const found = lookupLimiter();
    if (found.kind === "no-context") return true;
    if (found.kind === "unavailable") {
      console.error(UNAVAILABLE);
      return true;
    }
    bound = found.limiter;
  }
  if (!bound) return true;
  try {
    const { success } = await bound.limit({ key: formRateKey(request, scope) });
    return success !== false;
  } catch {
    console.error(UNAVAILABLE);
    return true;
  }
}
