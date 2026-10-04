import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/**
 * Job 10 review: the size of the uploaded Worker, checked before anyone deploys.
 *
 * The Workers Free plan refuses a script over 3 MiB gzipped (3,072 KiB). The limit here is 2,560 KiB, so a build that
 * is growing toward the refusal fails on the build machine, not at the upload. Job 10 measured 1,627 KiB.
 *
 * Pure on purpose: it takes a path and a number, so tests/worker-size.test.mjs runs it on a fake file. The measure
 * is the one `wrangler deploy --dry-run` prints as "gzip": every module of the bundle (.js, .mjs, .cjs, .wasm),
 * concatenated in name order, gzipped once.
 */
export const WORKER_GZIP_LIMIT_KIB = 2560;

const MODULE_FILE = /\.(?:m?js|cjs|wasm)$/;

function moduleFiles(target) {
  if (fs.statSync(target).isFile()) return [target];
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (MODULE_FILE.test(entry.name)) found.push(full);
    }
  };
  walk(target);
  return found.sort();
}

/** Gzip size in KiB of a bundle file, or of every module file under a bundle folder; null when it does not exist. */
export function gzipSizeKiB(target) {
  if (!fs.existsSync(target)) return null;
  const files = moduleFiles(target);
  if (files.length === 0) return null;
  const gzipped = zlib.gzipSync(Buffer.concat(files.map((file) => fs.readFileSync(file))));
  return gzipped.length / 1024;
}

/**
 * Returns the measured KiB, or null when there is no bundle to measure (nothing is built yet: not a failure here;
 * the runbook's `wrangler deploy --dry-run` step is the check on the real upload). Throws above the limit.
 */
export function assertWorkerSize(target, limitKiB = WORKER_GZIP_LIMIT_KIB) {
  const kib = gzipSizeKiB(target);
  if (kib === null) return null;
  if (kib > limitKiB) {
    throw new Error(`the built Worker is ${Math.ceil(kib)} KiB gzipped, over the ${limitKiB} KiB limit (${target}): the Workers Free plan refuses an upload over 3,072 KiB`);
  }
  return kib;
}

/**
 * node scripts/worker-size.mjs <bundle file or folder>
 * Use it on the folder `wrangler deploy --dry-run --outdir <folder>` wrote (runbook 02-RUNTIME-DEPLOY.md, 1.2).
 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/worker-size.mjs <bundle file or folder>");
    process.exit(2);
  }
  try {
    const kib = assertWorkerSize(target);
    console.log(kib === null ? `no Worker bundle at ${target}` : `Worker bundle ${Math.round(kib)} KiB gzipped (limit ${WORKER_GZIP_LIMIT_KIB})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
