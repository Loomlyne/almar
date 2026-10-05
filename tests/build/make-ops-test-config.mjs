// Plan 03.2-03: writes .tmp/wrangler.ops.test.toml, the copy of wrangler.ops.toml that the built-Worker spec
// (tests/build/ops-runtime.spec.ts) serves through local `wrangler dev`. Run it before Playwright, because Playwright
// starts the web server before any test hook runs:
//
//   node scripts/assemble-cloudflare.mjs --target=ops
//   node tests/build/make-ops-test-config.mjs
//   PW_READY_PATH=/api/health PW_WRANGLER_CONFIG=.tmp/wrangler.ops.test.toml PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/ops-runtime.spec.ts --workers=1
//
// What differs from wrangler.ops.toml, and why:
//  - the [ai] block is removed: Workers AI is always remote, so a local run would bill the ALMAR account (or, with the
//    default login, call the Vamos account: research Pitfall 12). Translate is not part of this plan's proofs.
//  - the [[routes]] block is removed (local only): wrangler dev would otherwise rewrite the request host to the zone.
//  - `main` and `directory` are made relative to .tmp/, because wrangler resolves paths from the config file's folder.
// R2 (MEDIA) stays and runs simulated inside `wrangler dev`; nothing here touches Cloudflare.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const DROPPED_BLOCKS = new Set(["[ai]", "[[routes]]"]);

/** wrangler.ops.toml text -> the local test copy's text. Pure; throws when the file is not shaped as expected. */
export function opsTestConfig(text) {
  const out = [];
  let dropping = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) dropping = DROPPED_BLOCKS.has(line.trim());
    if (!dropping) out.push(line);
  }
  const result = out
    .join("\n")
    .replace(/^main = "worker\/almar-ops\.mjs"$/m, 'main = "../worker/almar-ops.mjs"')
    .replace(/^directory = "\.\/out-ops"$/m, 'directory = "../out-ops"')
    .replace(/\n{3,}/g, "\n\n");
  if (/^\[ai\]|^\[\[routes\]\]|custom_domain/m.test(result)) throw new Error("the test copy still holds a dropped block");
  if (!/^main = "\.\.\/worker\/almar-ops\.mjs"$/m.test(result) || !/^directory = "\.\.\/out-ops"$/m.test(result)) {
    throw new Error("wrangler.ops.toml no longer has the main and assets lines this script rewrites");
  }
  if (!/^binding = "MEDIA"$/m.test(result)) throw new Error("the test copy lost the MEDIA binding");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.join(root, ".tmp", "wrangler.ops.test.toml");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, opsTestConfig(fs.readFileSync(path.join(root, "wrangler.ops.toml"), "utf8")));
  console.log(`wrote ${path.relative(root, target)}`);
}
