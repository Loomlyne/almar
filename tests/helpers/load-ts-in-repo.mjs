// Like load-ts.mjs, but the bundle is written under node_modules/.cache/almar-tests/ inside the repo, so a bare
// package import the module keeps external (resend, @opennextjs/cloudflare) resolves from the repo's node_modules.
// Plan 03.3-26: the contact route and lib/form-rate-limit.ts import packages; load-ts.mjs's temp folder cannot.
//
// `fakeCloudflare: true` swaps @opennextjs/cloudflare for a stand-in whose getCloudflareContext() returns
// { env: globalThis.__almarTestCloudflareEnv } and throws while that is unset (as the real one throws outside a
// Worker), so a test can bind a fake FORM_LIMITER.
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = resolve(process.cwd(), "node_modules/.cache/almar-tests");
let counter = 0;

const FAKE_CLOUDFLARE = {
  name: "fake-opennext-cloudflare",
  setup(b) {
    b.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: "fake", namespace: "fake-cloudflare" }));
    b.onLoad({ filter: /.*/, namespace: "fake-cloudflare" }, () => ({
      contents:
        "export function getCloudflareContext() { const env = globalThis.__almarTestCloudflareEnv; if (!env) throw new Error('no Cloudflare context'); return { env }; }",
      loader: "js",
    }));
  },
};

export async function loadTsInRepo(path, { fakeCloudflare = false } = {}) {
  const out = await build({
    entryPoints: [resolve(process.cwd(), path)],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
    plugins: fakeCloudflare ? [FAKE_CLOUDFLARE] : [],
  });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `module-${process.pid}-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
