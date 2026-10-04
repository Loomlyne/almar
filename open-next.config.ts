import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Server runtime for Workers `almar` and `almar-preview` (job 10, plan 02-20). No incremental cache: every public
// page is a static file in out/, so Next caches nothing, and an R2 cache bucket would be an owner gate.
// Never turn Next into a static export: the server bundle needs the standalone build OpenNext runs.
export default defineCloudflareConfig({});
