import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Server runtime for Worker `almar` (plan 02-08). No incremental-cache override: the R2 cache
// needs a bucket, and R2 is an owner gate. The worker name lives in wrangler.server.jsonc.
export default defineCloudflareConfig({});
