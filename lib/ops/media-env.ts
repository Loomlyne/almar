// Plan 03.2-09 Task 2: the one place the owner API reaches the ops Worker's R2 binding (wrangler.ops.toml
// [[r2_buckets]] binding = "MEDIA", bucket almar-media). Route files may import only lib/ops (tests/ops-route.test.mjs),
// so the Cloudflare context is read here. The repo has no @cloudflare/workers-types: the two Workers names this route
// uses are declared with the structural types the media core needs.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { LengthStream, MediaBucket } from "./media-upload";

declare global {
  interface CloudflareEnv {
    MEDIA?: MediaBucket;
  }
  /** Workers global: a pass-through stream of exactly `length` bytes (R2 needs a known length for a stream). */
  // eslint-disable-next-line no-var
  var FixedLengthStream: { new (length: number | bigint): LengthStream };
}

/** The R2 bucket bound to the ops Worker, or null when the binding is missing (the core answers 503). */
export function mediaBucket(): MediaBucket | null {
  return getCloudflareContext().env.MEDIA ?? null;
}
