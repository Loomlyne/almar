// One local Supabase stack per worktree (plan 03.2-01). Importable by tests and a CLI:
//
//   node tests/helpers/local-supabase.mjs start|reset|test|status|stop|types
//
// WHY: this Mac runs several sessions and products at once. Each worktree gets its own Docker project (project_id
// "almar-<id>") and its own block of ports, both derived from the worktree path, so a reset in one worktree never
// touches the database of another and nobody calls the supabase CLI at the default 543xx ports.
//
//   id    = first 8 hex of sha256(git rev-parse --show-toplevel)
//   ports = 54400 + 10 * (parseInt(id.slice(0, 4), 16) % 40), then +0 shadow, +1 api, +2 db, +3 studio, +4 inbucket,
//           +7 analytics, +9 pooler (range 54400-54799). `start` checks every port with lsof first and exits 1 naming
//           a busy one; it never stops anything it did not start.
//   work  = supabase/.temp/stack/ (ignored by supabase/.gitignore): supabase/config.toml is the repo's template with
//           that project_id and those ports; migrations/ and tests/ are copied fresh from the repo's supabase/ on every
//           start / reset / test, so a new migration file is picked up.
//
// This is the ONLY place the supabase CLI is called. Every call is --local and against this worktree's stack: it can
// never reach a hosted project (no --linked, no --project-ref, no access token is read).
//
// DOCKER_HOST: this Mac has no Docker Desktop; the controller installed colima. When DOCKER_HOST is unset and
// ~/.colima/default/docker.sock exists, this file sets DOCKER_HOST to that socket for every child process.
//
// HOW LATER PLANS USE IT (Phase 4's 04-02 and any other plan): never call the supabase CLI directly.
//   node tests/helpers/local-supabase.mjs start      (first run pulls the Docker images: 2-3 GB)
//   node tests/helpers/local-supabase.mjs reset      (applies job 02's, 3.2's and your own migration files, in order)
//   node tests/helpers/local-supabase.mjs test       (every supabase/tests/*.test.sql) or runPgTap(["supabase/tests/<your file>.test.sql"])
//   ALMAR_REQUIRE_STACK=1 node --test <your tests>   (a missing stack FAILS instead of skipping)
//   node tests/helpers/local-supabase.mjs stop       (or stopLocal(); do it when your session idles)
// In a test: `const stack = requireStack(t); if (!stack) return;` then use stack.url, stack.serviceKey, stack.dbUrl.
//
// Exports: stackId, stackPorts, localStack, requireStack, acquireStackLock, startLocal, resetLocal, runPgTap, runSql, stopLocal,
// genTypes (and workdir, buildStackConfig for the helper's own test).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FALLBACK_ROOT = resolve(HERE, "..", "..");

/** The worktree root: git's own answer, so a worktree and the main checkout never share an id. */
export function repoRoot() {
  const out = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: FALLBACK_ROOT, encoding: "utf8" });
  const top = out.status === 0 ? out.stdout.trim() : "";
  return top || FALLBACK_ROOT;
}

/** First 8 hex of sha256 of the worktree path. */
export function stackId(root = repoRoot()) {
  return createHash("sha256").update(root).digest("hex").slice(0, 8);
}

/** The port block for one id (pure). */
export function stackPorts(id = stackId()) {
  const base = 54400 + 10 * (parseInt(id.slice(0, 4), 16) % 40);
  return {
    shadow: base,
    api: base + 1,
    db: base + 2,
    studio: base + 3,
    inbucket: base + 4,
    analytics: base + 7,
    pooler: base + 9,
  };
}

export function projectId(id = stackId()) {
  return `almar-${id}`;
}

/** supabase/.temp/stack under the worktree: the directory that holds this stack's own supabase/ folder. */
export function workdir(root = repoRoot()) {
  return join(root, "supabase", ".temp", "stack");
}

/** Environment for every child process: DOCKER_HOST points at colima when nothing else is set. */
function childEnv() {
  const env = { ...process.env };
  if (!env.DOCKER_HOST) {
    const sock = join(homedir(), ".colima", "default", "docker.sock");
    if (existsSync(sock)) env.DOCKER_HOST = `unix://${sock}`;
  }
  return env;
}

/**
 * The template config with this stack's project_id and ports (pure). Only `port` / `shadow_port` lines inside the
 * sections the CLI reads are touched.
 */
export function buildStackConfig(template, id = stackId()) {
  const ports = stackPorts(id);
  const bySection = {
    api: { port: ports.api },
    db: { port: ports.db, shadow_port: ports.shadow },
    "db.pooler": { port: ports.pooler },
    studio: { port: ports.studio },
    local_smtp: { port: ports.inbucket },
    analytics: { port: ports.analytics },
  };
  let section = "";
  const lines = template.split("\n").map((line) => {
    const header = line.match(/^\[([^\]]+)\]\s*$/);
    if (header) {
      section = header[1];
      return line;
    }
    if (!section && /^project_id\s*=/.test(line)) return `project_id = "${projectId(id)}"`;
    const wanted = bySection[section];
    const key = line.match(/^(\w+)\s*=\s*\d+\s*$/);
    if (wanted && key && key[1] in wanted) return `${key[1]} = ${wanted[key[1]]}`;
    return line;
  });
  return lines.join("\n");
}

/** Writes this stack's config and copies migrations/ and tests/ fresh. Returns the workdir. */
function prepareWorkdir() {
  const root = repoRoot();
  const wd = workdir(root);
  const sb = join(wd, "supabase");
  mkdirSync(sb, { recursive: true });
  writeFileSync(join(sb, "config.toml"), buildStackConfig(readFileSync(join(root, "supabase", "config.toml"), "utf8")));
  for (const dir of ["migrations", "tests"]) {
    rmSync(join(sb, dir), { recursive: true, force: true });
    if (existsSync(join(root, "supabase", dir))) cpSync(join(root, "supabase", dir), join(sb, dir), { recursive: true });
    else mkdirSync(join(sb, dir), { recursive: true });
  }
  return wd;
}

function supabase(args, { inherit = false, cwd } = {}) {
  const wd = workdir();
  const out = spawnSync("supabase", ["--workdir", wd, ...args], {
    cwd: cwd ?? wd,
    env: childEnv(),
    encoding: "utf8",
    stdio: inherit ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: out.status ?? 1, stdout: out.stdout ?? "", stderr: out.stderr ?? "" };
}

let cached;

function parseEnvLines(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** { url, anonKey, serviceKey, dbUrl } of this worktree's running stack, or null. */
export function localStack({ fresh = false } = {}) {
  if (cached !== undefined && !fresh) return cached;
  cached = null;
  if (!existsSync(join(workdir(), "supabase", "config.toml"))) return cached;
  const res = supabase(["status", "-o", "env"]);
  if (res.code !== 0) return cached;
  const env = parseEnvLines(res.stdout);
  const url = env.API_URL;
  const anonKey = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
  const serviceKey = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
  const dbUrl = env.DB_URL;
  if (url && anonKey && serviceKey && dbUrl) cached = { url, anonKey, serviceKey, dbUrl };
  return cached;
}

/**
 * In a node test: `const stack = requireStack(t); if (!stack) return;`. With ALMAR_REQUIRE_STACK=1 a missing stack
 * fails the test; otherwise the test is skipped.
 */
export function requireStack(t) {
  const stack = localStack();
  if (stack) return stack;
  if (process.env.ALMAR_REQUIRE_STACK === "1") {
    throw new Error("ALMAR_REQUIRE_STACK=1 but no local Supabase stack runs for this worktree (node tests/helpers/local-supabase.mjs start)");
  }
  t.skip("no local Supabase stack for this worktree");
  return null;
}

/** Ports of this stack that something is listening on: [{ name, port }]. */
export function busyPorts(id = stackId()) {
  const busy = [];
  for (const [name, port] of Object.entries(stackPorts(id))) {
    const res = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim()) busy.push({ name, port });
  }
  return busy;
}

/** Starts this worktree's stack. Returns { code, output }; code 0 also when it already runs. */
export function startLocal({ inherit = false } = {}) {
  cached = undefined;
  if (localStack({ fresh: true })) return { code: 0, output: "already running" };
  const busy = busyPorts();
  if (busy.length) {
    const named = busy.map((b) => `${b.name} ${b.port}`).join(", ");
    return { code: 1, output: `port busy: ${named}. Another stack or program holds it; this helper never stops what it did not start.` };
  }
  prepareWorkdir();
  const res = supabase(["start"], { inherit });
  cached = undefined;
  return { code: res.code, output: res.stdout + res.stderr };
}

/** Rebuilds the database from the repo's migrations (job 02's, 3.2's, later ones), in order. */
export function resetLocal({ inherit = false } = {}) {
  cached = undefined;
  prepareWorkdir();
  const res = supabase(["db", "reset", "--local", "--no-seed"], { inherit });
  cached = undefined;
  return { code: res.code, output: res.stdout + res.stderr };
}

/**
 * pgTAP through `supabase test db --local`. `files` are repo-relative (supabase/tests/x.test.sql); all of
 * supabase/tests when omitted. Returns { code, output }.
 */
export function runPgTap(files, { inherit = false } = {}) {
  const wd = prepareWorkdir();
  const targets = (files && files.length ? files : ["supabase/tests"]).map((f) => {
    const rel = isAbsolute(f) ? f.slice(repoRoot().length + 1) : f;
    return join(wd, rel.startsWith("supabase/") ? rel : join("supabase", rel));
  });
  const res = supabase(["test", "db", "--local", ...targets], { inherit });
  return { code: res.code, output: res.stdout + res.stderr };
}

/**
 * One SQL statement (or file with `{ file }`) against this stack's database. Returns { code, output, rows }: `rows`
 * is the result set of the statement (the CLI wraps it in a JSON envelope with an untrusted-data warning), else [].
 */
export function runSql(sql, { file } = {}) {
  const res = file ? supabase(["db", "query", "--local", "-f", file]) : supabase(["db", "query", "--local", sql]);
  let rows = [];
  const start = res.stdout.indexOf("{");
  if (start >= 0) {
    try {
      const parsed = JSON.parse(res.stdout.slice(start, res.stdout.lastIndexOf("}") + 1));
      if (Array.isArray(parsed.rows)) rows = parsed.rows;
    } catch {
      // not JSON: the caller reads output
    }
  }
  return { code: res.code, output: res.stdout + res.stderr, rows };
}

/** Stops this worktree's stack only (its own project) and removes its volumes. */
export function stopLocal({ inherit = false } = {}) {
  cached = undefined;
  if (!existsSync(join(workdir(), "supabase", "config.toml"))) return { code: 0, output: "never started" };
  const res = supabase(["stop", "--no-backup"], { inherit });
  cached = undefined;
  return { code: res.code, output: res.stdout + res.stderr };
}

/**
 * A cross-process lock for node tests that write to this worktree's one stack. `node --test tests/*.test.mjs` runs the
 * files in parallel; a test that resets the database (tests/import-catalog.test.mjs) or counts the catalogue rows would
 * otherwise meet another file's rows or lose them mid-run. A file that writes to the stack awaits this before it seeds and
 * calls the returned release() after its own cleanup (an `after` hook). The lock is a directory with its owner's pid; one
 * whose owner is gone (or that never got a pid, ten seconds old) is stale and taken over.
 */
export async function acquireStackLock({ timeoutMs = 900_000 } = {}) {
  const dir = join(repoRoot(), "supabase", ".temp", "stack-test.lock");
  mkdirSync(dirname(dir), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, "pid"), String(process.pid));
      return () => rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    let stale = false;
    try {
      const owner = Number(readFileSync(join(dir, "pid"), "utf8"));
      if (Number.isInteger(owner) && owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (error) {
          stale = error.code === "ESRCH";
        }
      }
    } catch {
      try {
        stale = Date.now() - statSync(dir).mtimeMs > 10_000;
      } catch {
        stale = true;
      }
    }
    if (stale) {
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > deadline) throw new Error("timed out waiting for the local stack test lock");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** TypeScript types of the public schema, as text. */
export function genTypes() {
  const res = supabase(["gen", "types", "typescript", "--local", "--schema", "public"]);
  return { code: res.code, output: res.stdout, error: res.stderr };
}

function main(argv) {
  const [cmd] = argv;
  const id = stackId();
  if (cmd === "start") {
    const res = startLocal({ inherit: true });
    if (res.code !== 0 && res.output) console.error(res.output);
    else if (res.output === "already running") console.log(`stack ${projectId(id)} already running`);
    process.exit(res.code);
  } else if (cmd === "reset") {
    process.exit(resetLocal({ inherit: true }).code);
  } else if (cmd === "test") {
    const files = argv.slice(1);
    process.exit(runPgTap(files, { inherit: true }).code);
  } else if (cmd === "stop") {
    process.exit(stopLocal({ inherit: true }).code);
  } else if (cmd === "types") {
    const res = genTypes();
    if (res.code !== 0) {
      console.error(res.error);
      process.exit(res.code);
    }
    process.stdout.write(res.output);
  } else if (cmd === "status") {
    const stack = localStack({ fresh: true });
    const ports = stackPorts(id);
    console.log(JSON.stringify({ project_id: projectId(id), running: Boolean(stack), api: stack?.url ?? null, db: stack?.dbUrl ?? null, ports }, null, 2));
  } else {
    console.error("usage: node tests/helpers/local-supabase.mjs start|reset|test [files]|status|stop|types");
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
