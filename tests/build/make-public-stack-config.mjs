// Plan 02-06: writes .tmp/public-stack/, a copy of wrangler.toml whose Worker talks to THIS worktree's local Supabase
// stack, so tests/build/maintenance-runtime.spec.ts can save maintenance on in the database and prove that the public
// Worker's own pages (/login, /account, /bookings) answer with the closed page.
//
//   node tests/helpers/local-supabase.mjs start && node tests/helpers/local-supabase.mjs reset
//   node scripts/assemble-cloudflare.mjs --target=local
//   node tests/build/make-public-stack-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/public-stack/wrangler.test.toml PW_PORT=<free> \
//     npx playwright test -c playwright.build.config.ts tests/build/maintenance-runtime.spec.ts --workers=1
//
// Both files are git-ignored under .tmp/. .dev.vars holds the Supabase CLI's local development keys for a database on
// this Mac (stackDevVars refuses a non-loopback URL), never the live project's. Never touches Cloudflare.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localStack } from "../helpers/local-supabase.mjs";
import { stackDevVars } from "./make-ops-stack-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** wrangler.toml text -> the stack copy: paths two folders deeper, the custom-domain routes dropped. */
export function publicStackConfig(text) {
  const out = [];
  let dropping = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) dropping = line.trim() === "[[routes]]";
    if (!dropping) out.push(line);
  }
  const result = out
    .join("\n")
    .replace(/^main = "worker\/almar\.mjs"$/m, 'main = "../../worker/almar.mjs"')
    .replace(/^directory = "\.\/out"$/m, 'directory = "../../out"')
    .replace(/\n{3,}/g, "\n\n");
  if (!/^main = "\.\.\/\.\.\/worker\/almar\.mjs"$/m.test(result) || !/^directory = "\.\.\/\.\.\/out"$/m.test(result)) {
    throw new Error("wrangler.toml no longer has the main and assets lines this script rewrites");
  }
  if (/custom_domain/.test(result)) throw new Error("the stack copy still holds a route");
  if (!/^run_worker_first = /m.test(result)) throw new Error("the stack copy lost run_worker_first");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stack = localStack();
  if (!stack) {
    console.error("no local Supabase stack runs for this worktree (node tests/helpers/local-supabase.mjs start)");
    process.exit(1);
  }
  const dir = path.join(root, ".tmp", "public-stack");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "wrangler.test.toml"), publicStackConfig(fs.readFileSync(path.join(root, "wrangler.toml"), "utf8")));
  fs.writeFileSync(path.join(dir, ".dev.vars"), stackDevVars(stack), { mode: 0o600 });
  console.log(`wrote ${path.relative(root, dir)}/wrangler.test.toml and .dev.vars (local stack ${stack.url})`);
}
