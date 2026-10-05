// scripts/media-upload.mjs
//
// The controller's R2 upload for the slice-1 images (plan 03.3-07). Executors run only the dry form:
//
//   node scripts/media-upload.mjs                                 dry run: prints the plan, spawns nothing
//   node scripts/media-upload.mjs --bucket almar-media --public-base https://<host>
//                                                                 dry run that also reads what is already in the bucket
//   HOME=... CLOUDFLARE_ACCOUNT_ID=... node scripts/media-upload.mjs --public-base https://<host> --apply
//   node scripts/media-upload.mjs --verify --public-base https://<host> [--sample N | --all]
//   --keys <file>                                                 limit any of the above to the keys listed in <file>
//                                                                 (one per line, # comments); with --verify every listed
//                                                                 key is checked, plus the negative probe
//
// Safety, all enforced here and covered by tests/media-upload.test.mjs:
//   - dry run by default; nothing is started unless --apply;
//   - --apply exits 2 before anything runs unless HOME and CLOUDFLARE_ACCOUNT_ID are ALMAR's exactly (this is what
//     keeps an upload off the Vamos account, whose login is the default one on this Mac);
//   - a key that already holds other bytes is a REFUSE, never an overwrite (one-year immutable cache);
//   - the child process is started with an argv array, never a shell string.

import { spawnSync as realSpawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ALMAR_ACCOUNT_ID,
  ALMAR_CF_HOME,
  BUCKET_DEFAULT,
  CACHE_CONTROL,
  CONTENT_TYPE,
  assertKey,
  cachePath,
  defaultPaths,
  formatMB,
  isMain,
  readKeyList,
  readManifest,
  sha256,
} from "./media-lib.mjs";

const WRANGLER = "./node_modules/.bin/wrangler";
const NEGATIVE_PROBE = "__almar-missing-probe.webp";
const BUCKET_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** The argv wrangler gets (after the binary), shared by the printed line and the real call. */
export function putArgv(entry, bucket = BUCKET_DEFAULT) {
  assertKey(entry.key);
  return [
    "r2",
    "object",
    "put",
    `${bucket}/${entry.key}`,
    "--file",
    `media-staging/${entry.key}`,
    "--content-type",
    CONTENT_TYPE,
    "--cache-control",
    CACHE_CONTROL,
    "--remote",
  ];
}

/** The exact printable line: the env prefix, the local binary, the argv with the cache-control quoted. */
export function formatCommand(entry, bucket = BUCKET_DEFAULT) {
  const argv = putArgv(entry, bucket).map((a) => (/[\s,]/.test(a) ? `"${a}"` : a));
  return `HOME=${ALMAR_CF_HOME} CLOUDFLARE_ACCOUNT_ID=${ALMAR_ACCOUNT_ID} ${WRANGLER} ${argv.join(" ")}`;
}

/** An https origin with no path, query or fragment, not under the reserved .invalid TLD. Returns the origin. */
export function parseBase(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`--public-base ${JSON.stringify(value)} is not a URL`);
  }
  if (u.protocol !== "https:" || u.origin !== value || u.hostname.endsWith(".invalid") || u.username || u.password) {
    throw new Error(`--public-base must be an https origin with no path and not .invalid (got ${JSON.stringify(value)})`);
  }
  return u.origin;
}

function normEtag(value) {
  return String(value ?? "").replace(/^W\//, "").replace(/"/g, "").toLowerCase();
}

function stateFromHeaders(res) {
  const get = (n) => res.headers.get(n);
  const length = get("content-length");
  return {
    status: res.status,
    etag: normEtag(get("etag")),
    length: length === null || length === undefined ? null : Number.parseInt(length, 10),
    contentType: String(get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
    cacheControl: String(get("cache-control") ?? "").trim(),
  };
}

/**
 * One action per entry. `remote` is a Map (or plain object) from key to what the bucket answered: undefined or a
 * 404 state = nothing there; a 200 state = `{ status, etag, length, contentType, cacheControl }`.
 *   put           nothing there (or the remote state was not checked)
 *   skip          same bytes (ETag = md5, length = bytes) with the right Content-Type and Cache-Control
 *   fix-metadata  same bytes, wrong Content-Type or Cache-Control: a re-put of the same bytes is allowed
 *   refuse        the key holds other bytes; keys are immutable, so this is never an overwrite
 * `replaceKeys` turns a refuse on exactly those keys into a put, for a replacement the owner asked for.
 */
export function planUploads(manifest, { remote, replaceKeys = [] } = {}) {
  const replace = new Set(replaceKeys);
  const lookup = (key) => (remote instanceof Map ? remote.get(key) : remote ? remote[key] : undefined);
  return manifest.map((entry) => {
    assertKey(entry.key);
    const state = lookup(entry.key);
    if (!state || state.status === 404) return { key: entry.key, entry, action: "put", reason: remote ? "not in the bucket" : "remote state not checked" };
    if (state.status !== 200) throw new Error(`${entry.key}: the bucket answered HTTP ${state.status}, cannot plan`);
    const sameBytes = state.etag === String(entry.md5).toLowerCase() && state.length === entry.bytes;
    if (!sameBytes) {
      if (replace.has(entry.key)) return { key: entry.key, entry, action: "put", reason: "replacing different bytes (--replace-key)" };
      return {
        key: entry.key,
        entry,
        action: "refuse",
        reason: `the key already holds other bytes (remote etag ${state.etag || "none"}, length ${state.length}; manifest md5 ${entry.md5}, bytes ${entry.bytes})`,
      };
    }
    if (state.contentType === CONTENT_TYPE && state.cacheControl === CACHE_CONTROL) return { key: entry.key, entry, action: "skip", reason: "already uploaded" };
    return {
      key: entry.key,
      entry,
      action: "fix-metadata",
      reason: `same bytes, content-type ${JSON.stringify(state.contentType)} / cache-control ${JSON.stringify(state.cacheControl)} differ`,
    };
  });
}

let nonceCounter = 0;
function probeUrl(base, key, bust) {
  return `${base}/${key}${bust ? `?probe=${Date.now().toString(36)}${(nonceCounter++).toString(36)}` : ""}`;
}

/**
 * HEAD every entry on the public base. A query string is added on purpose: Cloudflare keeps a 404 at the edge for a
 * few minutes, and a probe that hit that copy would plan a second put after a successful one. `bust: false` drops it.
 */
export async function probeRemote(manifest, base, { fetch, bust = true, concurrency = 6, timeoutMs = 30_000 }) {
  const out = new Map();
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= manifest.length) return;
      const key = manifest[i].key;
      let res;
      try {
        res = await fetch(probeUrl(base, key, bust), { method: "HEAD", signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        throw new Error(`${key}: could not reach ${base} (${err && err.message ? err.message : err})`);
      }
      out.set(key, stateFromHeaders(res));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, manifest.length || 1) }, worker));
  return out;
}

/** The keys --verify always checks: the home hero poster and each stay's hero image. */
export function alwaysVerified(manifest) {
  return manifest.map((e) => e.key).filter((k) => k === "home/hero/poster.webp" || /^stays\/[^/]+\/hero\.webp$/.test(k));
}

/**
 * The sample for --verify: always the home hero poster and every stay's hero key, then a seeded pick from the rest
 * up to N objects in all (the always-checked set is never cut, so the count can exceed N). The seed is the sha256 of
 * the manifest's sha256 list, so the same manifest always gives the same sample.
 */
export function pickSample(manifest, n = 12) {
  const always = alwaysVerified(manifest);
  const seed = sha256(Buffer.from(manifest.map((e) => e.sha256).join("\n")));
  const rest = manifest
    .map((e) => e.key)
    .filter((k) => !always.includes(k))
    .map((k) => ({ k, h: sha256(Buffer.from(`${seed}:${k}`)) }))
    .sort((a, b) => (a.h < b.h ? -1 : 1))
    .map((x) => x.k);
  const take = Math.max(0, n - always.length);
  return [...always, ...rest.slice(0, take)];
}

/**
 * GETs objects over HTTPS and checks status 200, Content-Type, Cache-Control and the sha256 of the body against the
 * manifest, plus one negative probe that must answer 404. Returns `{ ok, failed, lines }`.
 */
export async function verifyObjects(manifest, base, { fetch, sample = 12, all = false, bust = true, timeoutMs = 60_000 }) {
  const byKey = new Map(manifest.map((e) => [e.key, e]));
  const keys = all ? manifest.map((e) => e.key) : pickSample(manifest, sample);
  const lines = [];
  let ok = 0;
  let failed = 0;
  for (const key of keys) {
    const entry = byKey.get(key);
    const problems = [];
    try {
      const res = await fetch(probeUrl(base, key, bust), { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
      if (res.status !== 200) problems.push(`status ${res.status}`);
      else {
        const type = String(res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (type !== CONTENT_TYPE) problems.push(`content-type ${JSON.stringify(type)}`);
        const cc = String(res.headers.get("cache-control") ?? "").trim();
        if (cc !== CACHE_CONTROL) problems.push(`cache-control ${JSON.stringify(cc)}`);
        const body = Buffer.from(await res.arrayBuffer());
        const got = sha256(body);
        if (got !== entry.sha256) problems.push(`sha256 ${got} is not the manifest's ${entry.sha256}`);
      }
    } catch (err) {
      problems.push(`request failed: ${err && err.message ? err.message : err}`);
    }
    if (problems.length) {
      failed++;
      lines.push(`FAIL ${key}: ${problems.join("; ")}`);
    } else {
      ok++;
      lines.push(`OK   ${key}`);
    }
  }
  try {
    const res = await fetch(`${base}/${NEGATIVE_PROBE}`, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) {
      ok++;
      lines.push(`OK   ${NEGATIVE_PROBE} answered 404`);
    } else {
      failed++;
      lines.push(`FAIL ${NEGATIVE_PROBE}: expected 404, got ${res.status}`);
    }
  } catch (err) {
    failed++;
    lines.push(`FAIL ${NEGATIVE_PROBE}: request failed: ${err && err.message ? err.message : err}`);
  }
  return { ok, failed, lines, objects: keys.length };
}

function parseArgs(argv) {
  const o = { apply: false, verify: false, publicBase: undefined, bucket: BUCKET_DEFAULT, sample: 12, all: false, replaceKeys: [], root: undefined, bust: true, keys: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--apply") o.apply = true;
    else if (a === "--verify") o.verify = true;
    else if (a === "--all") o.all = true;
    else if (a === "--no-cache-bust") o.bust = false;
    else if (a === "--public-base") o.publicBase = val();
    else if (a === "--bucket") o.bucket = val();
    else if (a === "--sample") {
      const n = Number(val());
      if (!Number.isInteger(n) || n < 1) throw new Error("--sample needs a whole number of 1 or more");
      o.sample = n;
    } else if (a === "--replace-key") o.replaceKeys.push(val());
    else if (a === "--root") o.root = path.resolve(val());
    else if (a === "--keys") o.keys = val();
    else throw new Error(`unknown argument ${JSON.stringify(a)}`);
  }
  return o;
}

const USAGE =
  "usage: node scripts/media-upload.mjs [--bucket <name>] [--public-base https://<host>] [--apply] [--replace-key <key>]... [--keys <file>]\n" +
  "       node scripts/media-upload.mjs --verify --public-base https://<host> [--sample N | --all] [--keys <file>]";

/**
 * Returns the exit code: 0 done, 1 a refusal, a failed check or a failed put, 2 a usage or gate error.
 * deps = { spawnSync, fetch, env, log, root }: the real ones by default, stubs in tests. `root` (tests only) points the
 * manifest, the cache and the child process's working folder at a scratch tree, like --root but allowed with --apply.
 */
export async function main(argv = [], deps = {}) {
  const spawnSync = deps.spawnSync ?? realSpawnSync;
  const fetch = deps.fetch ?? globalThis.fetch;
  const env = deps.env ?? process.env;
  const log = deps.log ?? console.log;

  let o;
  let base;
  try {
    o = parseArgs(argv);
    if (!BUCKET_RE.test(o.bucket)) throw new Error(`--bucket ${JSON.stringify(o.bucket)} is not a valid bucket name`);
    if (o.publicBase !== undefined) base = parseBase(o.publicBase);
    if (o.apply && o.verify) throw new Error("--apply and --verify are separate runs");
    if (o.apply && !base) throw new Error("--apply needs --public-base https://<host> (it reads the bucket first, so it can skip what is there)");
    if (o.verify && !base) throw new Error("--verify needs --public-base https://<host>");
    if (o.apply && o.root) throw new Error("--root is for tests and cannot be combined with --apply");
    if (o.all && !o.verify) throw new Error("--all belongs to --verify");
  } catch (err) {
    log(`media-upload: ${err.message}`);
    log(USAGE);
    return 2;
  }

  // The account gate comes before anything is read or started.
  if (o.apply) {
    if (env.HOME !== ALMAR_CF_HOME || env.CLOUDFLARE_ACCOUNT_ID !== ALMAR_ACCOUNT_ID) {
      log("media-upload: refusing --apply. It must run with ALMAR's own Cloudflare login, exactly:");
      log(`  HOME=${ALMAR_CF_HOME} CLOUDFLARE_ACCOUNT_ID=${ALMAR_ACCOUNT_ID} node scripts/media-upload.mjs ... --apply`);
      log("media-upload: the default login on this Mac is the Vamos account; nothing was started.");
      return 2;
    }
  }

  const paths = defaultPaths(o.root ?? deps.root);
  let manifest;
  try {
    manifest = readManifest(paths.manifestPath);
    for (const e of manifest) assertKey(e.key);
  } catch (err) {
    log(`media-upload: ${err.message}`);
    return 1;
  }

  // --keys narrows the manifest here, after the account gate and before the cache check, the remote probe, the plan,
  // --apply and --verify, so none of them can see (or start a process for) an unlisted key.
  let keysLine;
  if (o.keys !== undefined) {
    try {
      const keys = new Set(readKeyList(o.keys, manifest));
      keysLine = `media-upload: --keys ${o.keys}: ${keys.size} of ${manifest.length} manifest entries`;
      manifest = manifest.filter((e) => keys.has(e.key));
    } catch (err) {
      log(`media-upload: ${err.message}`);
      return 2;
    }
  }

  if (o.verify) {
    const unmeasured = manifest.filter((e) => !/^[0-9a-f]{64}$/.test(e.sha256 ?? ""));
    if (unmeasured.length) {
      log(`media-upload: ${unmeasured.length} manifest entries have no sha256 (run media-fetch and media-manifest --write): ${unmeasured[0].key} ...`);
      return 1;
    }
    if (keysLine) log(keysLine);
    log(`media-upload: verify ${o.all || keysLine ? "all" : `sample of at least ${o.sample}`} on ${base}`);
    const r = await verifyObjects(manifest, base, { fetch, sample: o.sample, all: o.all || keysLine !== undefined, bust: o.bust });
    for (const l of r.lines) log(l);
    log(`media-upload: verify ${r.ok} ok, ${r.failed} failed (${r.objects} objects and the negative probe)`);
    return r.failed ? 1 : 0;
  }

  // The cache must hold every file, with the manifest's hash, before anything is planned.
  const missing = [];
  for (const e of manifest) {
    const file = cachePath(e.key, paths.cacheDir);
    if (!/^[0-9a-f]{64}$/.test(e.sha256 ?? "") || !/^[0-9a-f]{32}$/.test(e.md5 ?? "") || !Number.isInteger(e.bytes)) {
      missing.push(`${e.key} (manifest has no measured fields)`);
    } else if (!fs.existsSync(file)) {
      missing.push(`${e.key} (not cached)`);
    } else if (sha256(fs.readFileSync(file)) !== e.sha256) {
      missing.push(`${e.key} (cached file differs from the manifest sha256)`);
    }
  }
  if (missing.length) {
    log(`media-upload: ${missing.length} entries are not ready:`);
    for (const m of missing.slice(0, 20)) log(`  ${m}`);
    if (missing.length > 20) log(`  ... and ${missing.length - 20} more`);
    log("media-upload: run `node scripts/media-fetch.mjs` first, then `node scripts/media-manifest.mjs --check`.");
    return 1;
  }

  for (const k of o.replaceKeys) {
    if (!manifest.some((e) => e.key === k)) {
      log(`media-upload: --replace-key ${JSON.stringify(k)} is not in the manifest`);
      return 2;
    }
  }

  log(o.bucket === BUCKET_DEFAULT ? `media-upload: bucket ${o.bucket}` : `media-upload: bucket ${o.bucket} (NOT the default ${BUCKET_DEFAULT})`);
  if (keysLine) log(keysLine);
  log(o.apply ? "media-upload: APPLY, each PUT and FIX line below is run in order" : "media-upload: dry run, nothing is sent and no process is started");
  let remote;
  if (base) {
    log(`media-upload: remote state read from ${base}`);
    try {
      remote = await probeRemote(manifest, base, { fetch, bust: o.bust });
    } catch (err) {
      log(`media-upload: ${err.message}`);
      return 1;
    }
  } else {
    log("media-upload: remote state not checked (no --public-base), every entry is planned as PUT");
  }
  for (const k of o.replaceKeys) log(`media-upload: --replace-key ${k}`);

  let plan;
  try {
    plan = planUploads(manifest, { remote, replaceKeys: o.replaceKeys });
  } catch (err) {
    log(`media-upload: ${err.message}`);
    return 1;
  }

  const labelShort = { put: "PUT", skip: "SKIP", "fix-metadata": "FIX", refuse: "REFUSE" };
  for (const p of plan) {
    log(`${labelShort[p.action]} ${p.key}${p.action === "put" ? "" : `  (${p.reason})`}`);
    if (p.action === "put" || p.action === "fix-metadata") log(`    ${formatCommand(p.entry, o.bucket)}`);
  }

  const count = (a) => plan.filter((p) => p.action === a).length;
  const send = plan.filter((p) => p.action === "put" || p.action === "fix-metadata").reduce((s, p) => s + p.entry.bytes, 0);
  const summary = `${plan.length} entries: ${count("put")} put, ${count("skip")} skip, ${count("fix-metadata")} fix, ${count("refuse")} refuse, ${formatMB(send)} MB to send`;

  if (count("refuse") > 0) {
    log(summary);
    log("media-upload: refusing: a key already holds other bytes. Keys are immutable; a changed image gets a new key, or pass --replace-key <key> for a replacement the owner asked for.");
    return 1;
  }
  if (!o.apply) {
    log(summary);
    return 0;
  }

  let done = 0;
  for (const p of plan) {
    if (p.action !== "put" && p.action !== "fix-metadata") continue;
    const r = spawnSync(WRANGLER, putArgv(p.entry, o.bucket), { stdio: "inherit", env, cwd: paths.root });
    if (r.error || r.status !== 0) {
      log(`media-upload: stopped at ${p.key}: ${r.error ? r.error.message : `the upload command exited ${r.status}`}. ${done} object(s) landed before it; run the same command again to continue.`);
      return 1;
    }
    done++;
  }
  log(summary);
  log(`media-upload: applied ${done} object(s)`);
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
