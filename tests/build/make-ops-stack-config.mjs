// Plan 03.2-04: writes .tmp/ops-stack/, the copy of the built-Worker test config that talks to THIS worktree's local
// Supabase stack, so tests/build/ops-api.spec.ts can sign the owner in and prove the owner API end to end on the built
// ops Worker (job 10's open item: two POSTs with different bodies in one workerd session reach the right parser).
//
//   node tests/helpers/local-supabase.mjs start      (and `reset`: migrations applied)
//   node scripts/assemble-cloudflare.mjs --target=ops
//   node tests/build/make-ops-test-config.mjs        (the plain copy: the 15 ops-runtime tests and the no-session API tests)
//   node tests/build/make-ops-stack-config.mjs       (this file)
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/ops-stack/wrangler.ops.test.toml PW_PORT=<free> \
//     npx playwright test -c playwright.build.config.ts tests/build/ops-api.spec.ts tests/build/ops-runtime.spec.ts --workers=1
//
// What it writes, both git-ignored under .tmp/:
//  - wrangler.ops.test.toml: make-ops-test-config.mjs's copy (no [ai], no route), with paths one folder deeper;
//  - .dev.vars (wrangler dev reads it from the config's folder): the three Supabase names the Worker reads at request time,
//    pointing at the local stack (http://127.0.0.1:<port>). These are the Supabase CLI's local development keys for a
//    database on this Mac, never the live project's; the live keys are Worker secrets set by the controller only.
// Exits 1 when no local stack runs for this worktree. Never touches Cloudflare or the live project.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localStack } from "../helpers/local-supabase.mjs";
import { opsTestConfig } from "./make-ops-test-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The plain test copy -> the stack copy: paths are relative to .tmp/ops-stack/, one folder deeper, plus
 * `[dev] upstream_protocol = "https"`. Why: wrangler dev's ProxyWorker rewrites every request header that names the
 * request's host to the URL the Worker sees (rewriteUrlRelatedHeaders, wrangler-dist/ProxyWorker.js); with the default
 * http, the browser's `Origin: https://dashboard.almarprivatejourney.com` reached Next as `http://...` and every owner POST
 * was refused as wrong_origin (measured 2026-10-05). With https the Worker sees request.url and Origin exactly as on the
 * edge (https, the ops host), so the Origin rule is tested as it runs live. Local only: the deployed Worker has no [dev].
 */
export function opsStackConfig(text) {
  const out = opsTestConfig(text)
    .replace(/^main = "\.\.\/worker\/almar-ops\.mjs"$/m, 'main = "../../worker/almar-ops.mjs"')
    .replace(/^directory = "\.\.\/out-ops"$/m, 'directory = "../../out-ops"');
  if (!/^main = "\.\.\/\.\.\/worker\/almar-ops\.mjs"$/m.test(out) || !/^directory = "\.\.\/\.\.\/out-ops"$/m.test(out)) {
    throw new Error("the plain test copy no longer has the main and assets lines this script rewrites");
  }
  if (/^\[dev\]/m.test(out)) throw new Error("wrangler.ops.toml has a [dev] block now: merge upstream_protocol into it by hand");
  return `${out.replace(/\n*$/, "\n")}\n[dev]\nupstream_protocol = "https"\n`;
}

/** The .dev.vars text for a local stack; refuses anything but a loopback http URL. */
export function stackDevVars(stack) {
  const url = new URL(stack.url);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("the stack URL is not a local one: refusing to write it");
  }
  return [
    `NEXT_PUBLIC_SUPABASE_URL=${stack.url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${stack.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${stack.serviceKey}`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stack = localStack();
  if (!stack) {
    console.error("no local Supabase stack runs for this worktree (node tests/helpers/local-supabase.mjs start)");
    process.exit(1);
  }
  const dir = path.join(root, ".tmp", "ops-stack");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "wrangler.ops.test.toml"), opsStackConfig(fs.readFileSync(path.join(root, "wrangler.ops.toml"), "utf8")));
  fs.writeFileSync(path.join(dir, ".dev.vars"), stackDevVars(stack), { mode: 0o600 });
  console.log(`wrote ${path.relative(root, dir)}/wrangler.ops.test.toml and .dev.vars (local stack ${stack.url})`);
}
