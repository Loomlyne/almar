// Plan 03.2-05 (C-01..C-05, research §1.3): the Workers Builds build command of Worker `almar`.
//
//   node scripts/build-live.mjs
//
// 1. Branch guard (C-02): builds only from branch `live`, so a Publish click changes content, never code.
// 2. Settle (C-03): sleeps ALMAR_PUBLISH_SETTLE_SECONDS (default 120, 0..600). Clicks inside this window are in this build;
//    a click during the build queues one more build (Free plan: one build at a time), so a burst gives at most two.
// 3. Reads the publish sequence (api_site_version.requested_seq, anon key; 03.2-02b's readPublishSequence on the pinned
//    live host) BEFORE any content is read, so a click during the build is picked up by the next build and never lost.
// 4. node scripts/assemble-cloudflare.mjs --target=production (database only, refuses fixtures and empty data).
// 5. Writes out/site-version.json { seq, built_at, commit }: what the dashboard compares with the request (served no-store).
//
// Any failure prints one line naming the step (never a URL or a key) and exits 1 before the deploy command runs, so the
// live site stays as it was. It never runs wrangler: the deploy command in the Workers Builds settings does
// (`npx wrangler deploy --config wrangler.toml`).

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLiveSupabaseUrl, readPublishSequence } from "./assemble-cloudflare.mjs";

export const LIVE_BRANCH = "live";
export const DEFAULT_SETTLE_SECONDS = 120;
export const MAX_SETTLE_SECONDS = 600;
export const SITE_VERSION_FILE = path.join("out", "site-version.json");

/** "120" -> 120; unset or empty -> the default; anything that is not a whole number of seconds in 0..600 -> null. */
export function settleSeconds(value) {
  if (value === undefined || value === null || String(value).trim() === "") return DEFAULT_SETTLE_SECONDS;
  const text = String(value).trim();
  if (!/^\d{1,4}$/.test(text)) return null;
  const n = Number(text);
  return n <= MAX_SETTLE_SECONDS ? n : null;
}

/**
 * The pure core. Every effect is injected: `env`, `branch()`, `commit()`, `sleep(ms)`, `readSeq()`, `runAssemble()`
 * (exit status), `writeFile(path, text)`, `now()`, `log(line)`. Returns the exit code (0 or 1).
 */
export async function buildLive(deps) {
  const { env, log } = deps;
  const fail = (step) => {
    log(`build-live: ${step}`);
    return 1;
  };

  const branch = String(deps.branch() ?? "").trim();
  if (branch !== LIVE_BRANCH) {
    // WORKERS_CI_BRANCH is [ASSUMED] (research §1.1): if the image names it differently, the first build fails here and
    // this line shows which names it does set (names only, never values).
    const names = Object.keys(env).filter((name) => /^WORKERS_CI/.test(name)).sort();
    log(`build-live: WORKERS_CI* variables in this build: ${names.length > 0 ? names.join(", ") : "none"}`);
    return fail(`builds only from branch ${LIVE_BRANCH} (this build is on ${JSON.stringify(branch.slice(0, 60))})`);
  }

  const settle = settleSeconds(env.ALMAR_PUBLISH_SETTLE_SECONDS);
  if (settle === null) return fail(`ALMAR_PUBLISH_SETTLE_SECONDS must be a whole number of seconds from 0 to ${MAX_SETTLE_SECONDS}`);
  log(`build-live: branch ${LIVE_BRANCH}; settling ${settle} s so clicks close together share one build`);
  await deps.sleep(settle * 1000);

  let raw;
  try {
    raw = await deps.readSeq();
  } catch (error) {
    return fail(`the publish sequence could not be read (${error instanceof Error ? error.message : "unknown error"})`);
  }
  // 02b's reader returns the number as text; null, "" and anything else are refused, never read as 0.
  const seq = typeof raw === "number" || (typeof raw === "string" && /^\d{1,15}$/.test(raw)) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(seq) || seq < 0) return fail("the publish sequence is not a whole number");
  log(`build-live: building publish sequence ${seq}`);

  const status = await deps.runAssemble();
  if (status !== 0) return fail(`assemble --target=production failed (exit ${status}); nothing is deployed`);

  const rawCommit = String(deps.commit() ?? "").trim();
  const commit = /^[0-9a-f]{7,40}$/.test(rawCommit) ? rawCommit : null;
  const version = { seq, built_at: deps.now().toISOString(), commit };
  try {
    deps.writeFile(SITE_VERSION_FILE, `${JSON.stringify(version)}\n`);
  } catch {
    return fail(`${SITE_VERSION_FILE} could not be written; nothing is deployed`);
  }
  log(`build-live: wrote ${SITE_VERSION_FILE} (seq ${seq}, commit ${commit ?? "unknown"})`);
  return 0;
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const env = process.env;
  const code = await buildLive({
    env,
    branch: () => env.WORKERS_CI_BRANCH || git(["rev-parse", "--abbrev-ref", "HEAD"]),
    commit: () => env.WORKERS_CI_COMMIT_SHA || git(["rev-parse", "HEAD"]),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // 03.2-02b's reader (the PostgREST view, anon key, outside Next, no cache), on the pinned live host only. The
    // assembler reads it again before and after its build and fails if it moved.
    readSeq: async () => {
      assertLiveSupabaseUrl("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
      return readPublishSequence({ url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
    },
    runAssemble: () =>
      spawnSync(process.execPath, [path.join(root, "scripts", "assemble-cloudflare.mjs"), "--target=production"], {
        cwd: root,
        stdio: "inherit",
        env,
      }).status ?? 1,
    writeFile: (file, text) => fs.writeFileSync(path.join(root, file), text),
    now: () => new Date(),
    log: (line) => console.log(line),
  });
  process.exit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
