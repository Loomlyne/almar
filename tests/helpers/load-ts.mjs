// Bundles a lib/ TypeScript module with the installed esbuild and imports the result, so node tests can
// load modules whose relative imports have no file extension (node --test cannot resolve those itself).
// Fixture reads inside lib/data use process.cwd(), so tests run from the repo root, as they already do.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let counter = 0;

export async function loadTs(path) {
  const abs = resolve(process.cwd(), path);
  const out = await build({
    entryPoints: [abs],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-load-ts-"));
  const file = join(dir, `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
