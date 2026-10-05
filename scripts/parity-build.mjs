// Byte parity of the built public site between fixture mode and database mode (plan 03.2-02, ROADMAP SC5, T-3.2-12).
//
//   node scripts/parity-build.mjs [--against-today] [--live] [--strict] [--keep]
//
// Local only: it builds (node scripts/assemble-cloudflare.mjs --target=local) and compares folders. It never deploys,
// never writes the repo's fixtures (everything it writes is under one temporary folder) and never prints a key.
//
//   default    needs this worktree's running stack (node tests/helpers/local-supabase.mjs start).
//                build A: ALMAR_DATA_SOURCE=fixtures from a live-shaped copy of the fixtures (C-16: sample blocked dates
//                         dropped, min_nights 1), a scratch folder named by ALMAR_FIXTURE_DIR
//                reset + import: the stack is rebuilt from the migrations and filled by scripts/import-catalog.mjs
//                build B: ALMAR_DATA_SOURCE=supabase against the local stack
//                Both builds run in the same shell settings (NEXT_PUBLIC_SUPABASE_* = the local stack's). The assembler keeps
//                those two names away from Next (nextBuildEnv), so nothing is inlined; the run fails if the anon key shows up
//                in any file Next or OpenNext wrote.
//                Every file of A's out/ and B's out/ is compared byte for byte once each build id is replaced by BUILD_ID.
//                Exit 0 only when no file differs, except for one known kind of noise: React streams the rows of a page's
//                inline Flight payload (`self.__next_f.push`) in an order that varies from build to build, even for two
//                builds of the same input, on the home pages. A file that differs ONLY in that order (the same rows, sorted,
//                are equal) is listed as ORDER ONLY, counted, and does not fail the run; `--strict` makes it fail.
//                At the end the stack is reset to empty (the pgTAP files expect it) and out/ holds build B.
//   --against-today
//                also build C from today's real fixtures (sample blocked dates included) and print, for the owner, every
//                file that differs from A. Expected (measured 2026-10-05, 39 files = /private-stays and the 12 stay pages x
//                en/ar/es): the sample-dates note ("Blocked dates here are examples.") is gone, and the stays' sample blocked
//                days (six per stay) are gone from the booking bar's props (C-16). Nothing else differs: `min_nights` is 1
//                in A and null in today's fixtures, but no built file serialises it.
//   --live     read-only, for the controller after the import. No stack, no reset, no import. Build B reads the LIVE
//                project through the public views with the anon key from the shell (NEXT_PUBLIC_SUPABASE_URL and
//                NEXT_PUBLIC_SUPABASE_ANON_KEY); only GET requests of that read reach it. Build A gets the same values
//                but reads fixtures, so it makes no request at all. Compared as above; out/ holds build B afterwards.
//   --strict   fail on ORDER ONLY files too (byte-identical or nothing).
//   --keep     keep the temporary folder (the copies of out/ and the build logs) instead of removing it.
//
// A build that fails prints the tail of its log; the log stays in the temporary folder, whose path is printed (common
// rules: capture the stack of a `next build` crash before rerunning).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importIntoLocal, resetAndWait, underStackLock } from "../tests/helpers/import-local.mjs";
import { writeLiveShapedFixtures } from "../tests/helpers/live-shaped-fixtures.mjs";
import { localStack } from "../tests/helpers/local-supabase.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const BUILD_ID_PLACEHOLDER = "BUILD_ID";
// describeDifference shows a text difference with context for these types and only the sizes for every other type.
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".txt", ".xml", ".webmanifest", ".map", ".svg", ".mjs", ".body"]);
// findValues reads every file except these binary types. Not an allow-list of text extensions: Next's fetch cache entries
// (.next/cache/fetch-cache/<hash>, .open-next/cache/__fetch/<hash>) have no extension and hold the project URL and the view
// responses, so an allow-list would never look inside them.
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".wasm",
  ".mp4", ".webm", ".mov", ".pdf", ".zip", ".gz", ".br",
]);

// ---------------------------------------------------------------------------------------------------------------
// Arguments and settings (pure)
// ---------------------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { againstToday: false, live: false, strict: false, keep: false, unknown: [] };
  for (const arg of argv) {
    if (arg === "--against-today") out.againstToday = true;
    else if (arg === "--live") out.live = true;
    else if (arg === "--strict") out.strict = true;
    else if (arg === "--keep") out.keep = true;
    else out.unknown.push(arg);
  }
  return out;
}

/**
 * The public settings of a --live run, from the shell. Names only in every message. Refuses what is not a hosted
 * Supabase project over https (a local stack is the default mode), and any service-role variable in the shell.
 */
export function livePublicEnv(env) {
  const serviceNames = Object.keys(env).filter((name) => /SERVICE_ROLE/i.test(name) && String(env[name] ?? "").trim() !== "");
  if (serviceNames.length > 0) throw new Error(`--live reads with the anon key only: unset ${serviceNames.join(", ")}`);
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((name) => !String(env[name] ?? "").trim());
  if (missing.length > 0) throw new Error(`--live needs ${missing.join(" and ")} in the shell (public values, typed or exported by the controller)`);
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL.trim());
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a URL");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password) {
    throw new Error("--live needs NEXT_PUBLIC_SUPABASE_URL to be https://<project>.supabase.co (the local stack is the default mode)");
  }
  return { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL.trim(), NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() };
}

/** The environment of a build: nothing ALMAR_*, NEXT_PUBLIC_* or service-role inherited, then exactly `extra`. */
export function buildEnv(base, extra) {
  const env = {};
  for (const [name, value] of Object.entries(base)) {
    if (name.startsWith("ALMAR_") || name.startsWith("NEXT_PUBLIC_") || /SERVICE_ROLE/i.test(name)) continue;
    env[name] = value;
  }
  return { ...env, ...extra };
}

// ---------------------------------------------------------------------------------------------------------------
// Folders: normalise the build id, compare byte for byte (pure on the file system)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The spellings of a build id inside the output: the id itself (`"b":"…"` in the RSC payload) and the id with every `-`
 * written as `_` (the HTML comment after the doctype, which may not hold `--`).
 */
export function buildIdForms(id) {
  return id ? [...new Set([id, id.replaceAll("-", "_")])] : [];
}

/** `buffer` with every spelling of the build id `id` replaced by BUILD_ID (byte-exact: latin1 round-trips every byte). */
export function replaceBuildId(buffer, id) {
  let text = null;
  for (const form of buildIdForms(id)) {
    if (buffer.indexOf(Buffer.from(form, "latin1")) === -1) continue;
    text = (text ?? buffer.toString("latin1")).split(form).join(BUILD_ID_PLACEHOLDER);
  }
  return text === null ? buffer : Buffer.from(text, "latin1");
}

/** A path with every spelling of the build id replaced by BUILD_ID. */
export function replaceBuildIdInPath(rel, id) {
  return buildIdForms(id).reduce((acc, form) => acc.split(form).join(BUILD_ID_PLACEHOLDER), rel);
}

function walk(dir, base = dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, found);
    else found.push({ full, rel: path.relative(base, full).split(path.sep).join("/") });
  }
  return found;
}

/** Every file of `dir`: normalised path -> { full, hash, size } (the hash is of the normalised bytes). */
export function digestTree(dir, buildId) {
  const out = new Map();
  for (const { full, rel } of walk(dir)) {
    const bytes = replaceBuildId(fs.readFileSync(full), buildId);
    const key = replaceBuildIdInPath(rel, buildId);
    if (out.has(key)) throw new Error(`two files normalise to ${key}`);
    out.set(key, { full, hash: createHash("sha256").update(bytes).digest("hex"), size: bytes.length });
  }
  return out;
}

const show = (text) => JSON.stringify(text.length > 220 ? `${text.slice(0, 220)}…` : text);

/** Where two texts first differ, with context from both sides. */
export function diffContext(a, b) {
  let i = 0;
  const max = Math.min(a.length, b.length);
  while (i < max && a[i] === b[i]) i++;
  const from = Math.max(0, i - 70);
  return `at character ${i}: ${show(a.slice(from, i + 90))} vs ${show(b.slice(from, i + 90))}`;
}

/** The first difference between two files (normalised), as one line. */
export function describeDifference(fileA, fileB, rel, idA, idB) {
  const a = replaceBuildId(fs.readFileSync(fileA), idA);
  const b = replaceBuildId(fs.readFileSync(fileB), idB);
  if (!TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase())) return `binary file: ${a.length} bytes vs ${b.length} bytes`;
  return diffContext(a.toString("utf8"), b.toString("utf8"));
}

const FLIGHT_PUSH = /<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;

/**
 * An HTML document with the rows of its inline React Flight payload in a fixed order. The payload is a series of
 * `<script>self.__next_f.push([1,"…"])</script>` chunks that the browser joins into one stream of newline-separated
 * rows; the order in which React emits the rows varies between builds (also between two builds of the same input), so
 * the chunks are joined, the rows sorted and written back as one chunk at the first chunk's place. Two documents whose
 * canonical forms are equal carry the same rows and differ in order only. Anything else in the document is untouched.
 */
export function canonicalFlight(html) {
  const chunks = [...html.matchAll(FLIGHT_PUSH)];
  if (chunks.length === 0) return html;
  const stream = chunks.map((m) => JSON.parse(m[1])).join("");
  const rows = stream.split("\n").filter((row) => row !== "").sort();
  const canonical = `<script>self.__next_f.push([1,${JSON.stringify(`${rows.join("\n")}\n`)}])</script>`;
  let first = true;
  return html.replace(FLIGHT_PUSH, () => {
    if (!first) return "";
    first = false;
    return canonical;
  });
}

/** True when two differing files are equal once the Flight rows of each are put in order (html files only). */
export function differsInFlightOrderOnly(fileA, fileB, rel, idA, idB) {
  if (path.extname(rel).toLowerCase() !== ".html") return false;
  const a = replaceBuildId(fs.readFileSync(fileA), idA).toString("utf8");
  const b = replaceBuildId(fs.readFileSync(fileB), idB).toString("utf8");
  return canonicalFlight(a) === canonicalFlight(b);
}

/**
 * Compares two digests. Returns { compared, differing: [{ path, kind: "content" | "only-in-left" | "only-in-right" }] }.
 */
export function compareDigests(left, right) {
  const differing = [];
  const names = [...new Set([...left.keys(), ...right.keys()])].sort();
  for (const name of names) {
    const l = left.get(name);
    const r = right.get(name);
    if (!l) differing.push({ path: name, kind: "only-in-right" });
    else if (!r) differing.push({ path: name, kind: "only-in-left" });
    else if (l.hash !== r.hash) differing.push({ path: name, kind: "content" });
  }
  return { compared: names.length, differing };
}

/** The values from `needles` that appear in a file of `dir` that is not a known binary type (extension-less files included): [{ file, label }]. */
export function findValues(dir, needles) {
  const hits = [];
  for (const { full, rel } of walk(dir)) {
    if (BINARY_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
    const text = fs.readFileSync(full, "latin1");
    for (const [label, value] of Object.entries(needles)) {
      if (value && text.includes(value)) hits.push({ file: rel, label });
    }
  }
  return hits;
}

/** True for the files of the build's fetch cache: .next/cache/fetch-cache/* and .open-next/cache/** (its copy, __fetch). */
export function isBuildCache(place, file) {
  return place === ".next/cache/fetch-cache/" || (place === ".open-next/" && file.startsWith("cache/"));
}

// ---------------------------------------------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------------------------------------------

function tail(file, lines = 60) {
  const text = fs.readFileSync(file, "utf8").split("\n");
  return text.slice(-lines).join("\n");
}

/**
 * One build of the public site (--target=local) with exactly these ALMAR_* / public settings. Saves out/ and the build
 * id under `<tmp>/<label>`. Returns { out, buildId }.
 */
function runBuild({ label, tmp, env }) {
  const log = path.join(tmp, `build-${label}.log`);
  console.log(`\n== build ${label}: ALMAR_DATA_SOURCE=${env.ALMAR_DATA_SOURCE}${env.ALMAR_FIXTURE_DIR ? " (scratch fixture folder)" : ""}`);
  const started = Date.now();
  const fd = fs.openSync(log, "w");
  const res = spawnSync(process.execPath, ["scripts/assemble-cloudflare.mjs", "--target=local"], {
    cwd: root,
    env,
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  if (res.status !== 0) {
    console.error(`build ${label} failed (exit ${res.status}, signal ${res.signal ?? "none"}). Log: ${log}\n--- last lines ---\n${tail(log)}`);
    throw new Error(`build ${label} failed; the full log is ${log}`);
  }
  const lastLine = tail(log, 2).trim().split("\n").pop();
  console.log(`   ${Math.round((Date.now() - started) / 1000)} s: ${lastLine.slice(0, 200)}`);
  const buildId = fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim();
  const out = path.join(tmp, label, "out");
  fs.rmSync(path.join(tmp, label), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.cpSync(path.join(root, "out"), out, { recursive: true });
  return { out, buildId };
}

/**
 * Prints and returns the comparison of two builds: { compared, differing (real), orderOnly }. `orderOnly` are files that
 * differ byte for byte but carry the same Flight rows (see canonicalFlight).
 */
function report(title, left, right) {
  const digestLeft = digestTree(left.out, left.buildId);
  const digestRight = digestTree(right.out, right.buildId);
  const { compared, differing: all } = compareDigests(digestLeft, digestRight);
  const differing = [];
  const orderOnly = [];
  for (const d of all) {
    if (d.kind === "content" && differsInFlightOrderOnly(digestLeft.get(d.path).full, digestRight.get(d.path).full, d.path, left.buildId, right.buildId)) {
      orderOnly.push(d);
    } else {
      differing.push(d);
    }
  }
  console.log(`\n${title}: ${compared} files compared, ${differing.length} differing, ${orderOnly.length} differing in Flight row order only`);
  for (const d of orderOnly) console.log(`  ORDER ONLY  ${d.path}  (the same Flight rows, streamed in another order)`);
  for (const d of differing) {
    if (d.kind === "content") {
      console.log(`  DIFFERS  ${d.path}\n           ${describeDifference(digestLeft.get(d.path).full, digestRight.get(d.path).full, d.path, left.buildId, right.buildId)}`);
    } else {
      console.log(`  ${d.kind === "only-in-left" ? "ONLY LEFT " : "ONLY RIGHT"} ${d.path}`);
    }
  }
  return { compared, differing, orderOnly };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.unknown.length > 0) {
    console.error(`unknown argument ${args.unknown.join(", ")}\nusage: node scripts/parity-build.mjs [--against-today] [--live] [--strict] [--keep]`);
    process.exit(2);
  }
  process.chdir(root);

  let publicEnv;
  let stack = null;
  if (args.live) {
    publicEnv = livePublicEnv(process.env);
  } else {
    stack = localStack({ fresh: true });
    if (!stack) {
      console.error("no local Supabase stack for this worktree: run `node tests/helpers/local-supabase.mjs start` first (this script never builds against anything but this worktree's own stack, or --live)");
      process.exit(2);
    }
    publicEnv = { NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "almar-parity-"));
  const fixturesDir = path.join(tmp, "fixtures");
  let ok = false;
  let failed = null;
  let inlinedKey = false;
  let resetFailed = false;
  try {
    writeLiveShapedFixtures(fixturesDir);
    const envFor = (extra) => buildEnv(process.env, { ...publicEnv, ...extra });

    const a = runBuild({ label: "A", tmp, env: envFor({ ALMAR_DATA_SOURCE: "fixtures", ALMAR_FIXTURE_DIR: fixturesDir }) });

    let b;
    if (args.live) {
      b = runBuild({ label: "B", tmp, env: envFor({ ALMAR_DATA_SOURCE: "supabase" }) });
    } else {
      b = await underStackLock(async () => {
        console.log("\n== reset the local stack from the migrations, then import the fixtures");
        const reset = await resetAndWait();
        if (reset.code !== 0) throw new Error(`local reset failed:\n${reset.output.slice(-2000)}`);
        const imported = importIntoLocal(stack);
        console.log(`   ${imported.trim().split("\n").pop()}`);
        try {
          return runBuild({ label: "B", tmp, env: envFor({ ALMAR_DATA_SOURCE: "supabase" }) });
        } finally {
          const final = await resetAndWait(); // the pgTAP files expect an empty catalogue: leave the database as the migrations make it
          if (final.code !== 0) {
            console.error(`\nthe final local reset failed (the pgTAP files expect an empty catalogue):\n${final.output.slice(-1000)}`);
            resetFailed = true;
          }
        }
      });
    }

    const leftTitle = `A (live-shaped fixtures) vs B (${args.live ? "the live database" : "the local database"})`;
    const parity = report(leftTitle, a, b);

    // Build B's own output is still on disk here (build C, if asked for, overwrites .next/ and .open-next/). The assembler
    // hands the public settings to the data layer under names Next does not inline (nextBuildEnv), so neither value may
    // appear in any file Next or OpenNext wrote: not in the browser files, not in the server bundles, not in the Worker
    // bundles. Finding the anon key means NEXT_PUBLIC_* reached Next again: the run fails (the URL alone is reported only).
    // Scanned: every file of these folders except images, fonts, video and wasm, extension-less files included (Next's own
    // fetch cache entries have no extension). The fetch cache (.next/cache/fetch-cache, copied to .open-next/cache/__fetch)
    // holds the project URL and the view responses by design: it is a build cache that is never deployed, so a URL there is
    // reported separately and does not count against the build.
    const places = [
      ["out/", b.out, false],
      [".next/static/", path.join(root, ".next", "static"), false],
      [".next/server/", path.join(root, ".next", "server"), false],
      [".next/cache/fetch-cache/", path.join(root, ".next", "cache", "fetch-cache"), true],
      [".open-next/", path.join(root, ".open-next"), false],
    ];
    const scan = (needles) =>
      places.flatMap(([name, dir]) => (fs.existsSync(dir) ? findValues(dir, needles).map((h) => ({ text: `${h.label} in ${name}${h.file}`, cache: isBuildCache(name, h.file) })) : []));
    const keyHits = scan({ "the public anon key": publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY });
    const urlHits = scan({ "the public URL": publicEnv.NEXT_PUBLIC_SUPABASE_URL });
    const urlDeployable = urlHits.filter((h) => !h.cache);
    const urlInCache = urlHits.filter((h) => h.cache);
    console.log(
      `\nscanned for the public anon key and URL: out/, .next/static, .next/server, .next/cache/fetch-cache, .open-next (every file except images, fonts, video and wasm; extension-less files included)`,
    );
    console.log(
      keyHits.length === 0 && urlDeployable.length === 0
        ? "public anon key: none. public project URL: none outside the build's fetch cache (Next was not given the settings, so nothing is inlined into any Worker or browser file)"
        : `public Supabase settings found in the build output: ${[...keyHits, ...urlDeployable].map((h) => h.text).slice(0, 12).join("; ")}`,
    );
    if (urlInCache.length > 0) {
      console.log(`   the project URL also sits in the build's fetch cache (${urlInCache.length} files, e.g. ${urlInCache[0].text}): a build cache that is never deployed`);
    }
    inlinedKey = keyHits.length > 0;

    if (args.againstToday) {
      const c = runBuild({ label: "C", tmp, env: envFor({ ALMAR_DATA_SOURCE: "fixtures" }) });
      console.log("\n== against today's fixtures (sample blocked dates included), for the owner: files that differ from A");
      report("A (live-shaped fixtures) vs C (today's fixtures)", a, c);
    }

    // out/ holds build B (the build that read the database) when the script ends.
    fs.rmSync(path.join(root, "out"), { recursive: true, force: true });
    fs.cpSync(b.out, path.join(root, "out"), { recursive: true });

    const strictFailures = args.strict ? parity.orderOnly.length : 0;
    ok = parity.differing.length === 0 && strictFailures === 0 && !inlinedKey && !resetFailed;
    const noise = parity.orderOnly.length > 0 ? ` (${parity.orderOnly.length} of them differ in Flight row order only)` : "";
    console.log(
      ok
        ? `\nPARITY OK: ${parity.compared} files, 0 differing${noise}`
        : `\nPARITY FAILED: ${parity.differing.length + strictFailures} of ${parity.compared} files differ${noise}${inlinedKey ? "; the public anon key was found in the build output" : ""}${resetFailed ? "; the final local reset failed" : ""}`,
    );
  } catch (error) {
    failed = error;
  } finally {
    if (args.keep || failed) console.log(`\ntemporary folder kept: ${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) {
    console.error(failed.message);
    process.exit(1);
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
