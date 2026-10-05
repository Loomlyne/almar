// Bundles one app/api route handler for a node test. `next/headers` (request-scoped cookies, unusable outside a Next
// request) is replaced by an empty cookie jar; every other package stays external. Routes under app/api/booking never
// read cookies, so the stub is never called there. Tests run from the repo root, as loadTs does.
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let counter = 0;

const stubNextHeaders = {
  name: "stub-next-headers",
  setup(b) {
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "next-headers", namespace: "stub-next" }));
    b.onLoad({ filter: /.*/, namespace: "stub-next" }, () => ({
      contents: "export const cookies = async () => ({ getAll: () => [], set() {} }); export const headers = async () => new Headers();",
      loader: "js",
    }));
  },
};

export async function loadRoute(path) {
  const out = await build({
    entryPoints: [resolve(process.cwd(), path)],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
    plugins: [stubNextHeaders],
  });
  // Inside node_modules/.cache, so the external packages (@supabase/*) resolve from the repo's node_modules.
  const cache = join(process.cwd(), "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, "almar-load-route-"));
  const file = join(dir, `route-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
