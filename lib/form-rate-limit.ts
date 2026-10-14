// The rate limit of the public forms (plan 26: POST /api/contact, scope "contact"; plan 27 reuses it for /newsletter,
// scope "newsletter"). Server only. It reads the Cloudflare Workers Rate Limiting binding FORM_LIMITER
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

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The Workers Rate Limiting binding, structurally (the repo has no @cloudflare/workers-types). */
export type FormLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

export type FormScope = "contact" | "newsletter";

declare global {
  interface CloudflareEnv {
    FORM_LIMITER?: FormLimiter;
  }
}

/** The bound limiter, or null outside a Worker that binds it. getCloudflareContext() throws outside a Worker request. */
export function formLimiter(): FormLimiter | null {
  try {
    return getCloudflareContext().env.FORM_LIMITER ?? null;
  } catch {
    return null;
  }
}

/** `<scope>:<CF-Connecting-IP>`, or `<scope>:unknown` without the header. */
export function formRateKey(request: Request, scope: FormScope): string {
  const address = request.headers.get("cf-connecting-ip")?.trim();
  return `${scope}:${address || "unknown"}`;
}

/** True when this post may go on: no limiter, a limiter that says yes, or a limiter that failed. */
export async function allowFormPost(
  request: Request,
  scope: FormScope,
  limiter: FormLimiter | null = formLimiter(),
): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key: formRateKey(request, scope) });
    return success !== false;
  } catch {
    return true;
  }
}
