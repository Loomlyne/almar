// Tests for scripts/media-upload.mjs (plan 03.3-07, task 3). Everything is offline: wrangler and the network are
// stubs. No test starts a real process or sends a request.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALMAR_ACCOUNT_ID,
  ALMAR_CF_HOME,
  CACHE_CONTROL,
  REPO_ROOT,
  defaultPaths,
  md5,
  readManifest,
  sha256,
} from "../scripts/media-lib.mjs";
import { alwaysVerified, formatCommand, main, parseBase, pickSample, planUploads, verifyObjects, putArgv } from "../scripts/media-upload.mjs";

const manifest = readManifest();
const BASE = "https://media.example.test";
const GOOD_ENV = { HOME: ALMAR_CF_HOME, CLOUDFLARE_ACCOUNT_ID: ALMAR_ACCOUNT_ID, PATH: "/usr/bin" };

function harness({ env = GOOD_ENV, fetch, spawnResults = [] } = {}) {
  const logs = [];
  const spawns = [];
  const fetches = [];
  let n = 0;
  return {
    logs,
    spawns,
    fetches,
    deps: {
      env,
      log: (l) => logs.push(l),
      spawnSync: (bin, args, opts) => {
        spawns.push({ bin, args, opts });
        const r = spawnResults[n++];
        return r ?? { status: 0 };
      },
      fetch: async (url, init) => {
        fetches.push({ url, init });
        if (!fetch) throw new Error("no network in this test");
        return fetch(url, init);
      },
    },
  };
}

function res(status, headers = {}, body = Buffer.alloc(0)) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { status, headers: { get: (n) => h[n.toLowerCase()] ?? null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
}

const keyOf = (url) => new URL(url).pathname.slice(1);

/** A bucket stub: `have` maps key -> overrides of what a correct object would answer. */
function bucket(have = {}) {
  const byKey = new Map(manifest.map((e) => [e.key, e]));
  return (url) => {
    const key = keyOf(url);
    if (!(key in have)) return res(404);
    const e = byKey.get(key);
    return res(200, { etag: `"${md5Of(e)}"`, "content-length": String(e.bytes), "content-type": "image/webp", "cache-control": CACHE_CONTROL, ...have[key] });
  };
}
const md5Of = (e) => e.md5;
const everyKey = () => Object.fromEntries(manifest.map((e) => [e.key, {}]));

function lastLine(logs) {
  return logs.at(-1);
}

function scratchRoot(entries, { cache = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "almar-upload-"));
  fs.mkdirSync(path.join(root, "lib", "data"), { recursive: true });
  const rows = entries.map(({ key, body }) => ({
    key,
    source: "/assets/img/0000000000000000.webp",
    source_kind: "local",
    used_by: ["x"],
    image_ids: ["i"],
    content_type: "image/webp",
    bytes: body.length,
    sha256: sha256(body),
    md5: md5(body),
    width: 1,
    height: 1,
  }));
  fs.writeFileSync(path.join(root, "lib", "data", "media-manifest.json"), JSON.stringify(rows, null, 2) + "\n");
  if (cache) {
    for (const { key, body } of entries) {
      fs.mkdirSync(path.dirname(path.join(root, "media-staging", key)), { recursive: true });
      fs.writeFileSync(path.join(root, "media-staging", key), body);
    }
  }
  return { root, rows };
}

const webpish = (n) => Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"), Buffer.alloc(n, 7)]);

// 1. Dry run ------------------------------------------------------------------------------------------------------

test("dry run with no --public-base prints one PUT line and one command per entry and spawns nothing", async () => {
  const h = harness();
  const code = await main([], h.deps);
  assert.equal(code, 0, h.logs.join("\n"));
  const puts = h.logs.filter((l) => l.startsWith("PUT "));
  assert.equal(puts.length, manifest.length);
  assert.ok(manifest.length >= 100);
  for (const e of manifest) {
    assert.ok(h.logs.includes(`    ${formatCommand(e, "almar-media")}`), `command line for ${e.key}`);
    assert.ok(h.logs.includes(`PUT ${e.key}`));
  }
  assert.equal(h.spawns.length, 0, "dry run must not spawn");
  assert.equal(h.fetches.length, 0, "no --public-base means no request");
  assert.match(lastLine(h.logs), new RegExp(`^${manifest.length} entries: ${manifest.length} put, 0 skip, 0 fix, 0 refuse, \\d+\\.\\d MB to send$`));
  assert.ok(h.logs.some((l) => l === "media-upload: bucket almar-media"));
  assert.ok(h.logs.some((l) => l.includes("remote state not checked")));
});

test("formatCommand is the exact env-prefixed line and the argv carries --remote and the immutable cache-control", () => {
  const e = manifest[0];
  assert.equal(
    formatCommand(e, "almar-media"),
    `HOME=/Users/koss/.almar-cloudflare CLOUDFLARE_ACCOUNT_ID=f1d9a1fa3abdda98c15161b00b40385c ./node_modules/.bin/wrangler r2 object put almar-media/${e.key} --file media-staging/${e.key} --content-type image/webp --cache-control "public, max-age=31536000, immutable" --remote`,
  );
  const argv = putArgv(e, "almar-media");
  assert.deepEqual(argv.slice(0, 4), ["r2", "object", "put", `almar-media/${e.key}`]);
  assert.ok(argv.includes("--remote"));
  assert.equal(argv[argv.indexOf("--cache-control") + 1], CACHE_CONTROL);
  assert.throws(() => formatCommand({ key: "a/../b.webp" }));
});

test("a non-default bucket is printed in the header", async () => {
  const h = harness();
  assert.equal(await main(["--bucket", "other-bucket"], h.deps), 0);
  assert.ok(h.logs.some((l) => l === "media-upload: bucket other-bucket (NOT the default almar-media)"));
  assert.ok(h.logs.some((l) => l.includes(" other-bucket/")));
  const bad = harness();
  assert.equal(await main(["--bucket", "Bad Bucket!"], bad.deps), 2);
});

// 2-4. Planning against what the bucket holds ---------------------------------------------------------------------

test("with matching ETag, length and headers every entry is SKIP and nothing is sent", async () => {
  const h = harness({ fetch: bucket(everyKey()) });
  const code = await main(["--public-base", BASE], h.deps);
  assert.equal(code, 0, h.logs.join("\n"));
  assert.equal(h.logs.filter((l) => l.startsWith("SKIP ")).length, manifest.length);
  assert.equal(h.logs.filter((l) => l.startsWith("PUT ")).length, 0);
  assert.match(lastLine(h.logs), new RegExp(`^${manifest.length} entries: 0 put, ${manifest.length} skip, 0 fix, 0 refuse, 0\\.0 MB to send$`));
  assert.equal(h.spawns.length, 0);
  assert.ok(h.fetches.every((f) => f.init.method === "HEAD"));
  assert.ok(h.fetches.every((f) => new URL(f.url).origin === BASE && /^\?probe=/.test(new URL(f.url).search)), "cache-busting probe query by default");
});

test("--no-cache-bust asks for the bare key URL", async () => {
  const h = harness({ fetch: bucket(everyKey()) });
  assert.equal(await main(["--public-base", BASE, "--no-cache-bust"], h.deps), 0);
  assert.ok(h.fetches.every((f) => new URL(f.url).search === ""));
});

test("a different ETag is REFUSE and exit 1; --replace-key on exactly that key turns it into PUT", async () => {
  const k = manifest[3].key;
  const have = everyKey();
  have[k] = { etag: '"00000000000000000000000000000000"' };
  let h = harness({ fetch: bucket(have) });
  assert.equal(await main(["--public-base", BASE], h.deps), 1);
  assert.ok(h.logs.some((l) => l.startsWith(`REFUSE ${k}`)));
  assert.match(lastLine(h.logs) === undefined ? "" : h.logs.join("\n"), /refusing: a key already holds other bytes/);
  assert.equal(h.spawns.length, 0);
  h = harness({ fetch: bucket(have) });
  assert.equal(await main(["--public-base", BASE, "--replace-key", k], h.deps), 0, h.logs.join("\n"));
  assert.ok(h.logs.includes(`PUT ${k}`) || h.logs.some((l) => l.startsWith(`PUT ${k}`)));
  assert.equal(h.logs.filter((l) => l.startsWith("REFUSE")).length, 0);
  assert.match(lastLine(h.logs), /: 1 put, 116 skip, 0 fix, 0 refuse,/);
  // a different length with the right ETag is also a refusal
  have[k] = { "content-length": String(manifest[3].bytes + 1) };
  h = harness({ fetch: bucket(have) });
  assert.equal(await main(["--public-base", BASE], h.deps), 1);
  // --replace-key must name a manifest key
  h = harness({ fetch: bucket(everyKey()) });
  assert.equal(await main(["--public-base", BASE, "--replace-key", "nope/x.webp"], h.deps), 2);
});

test("the right ETag with the wrong Cache-Control or Content-Type is FIX, not REFUSE", async () => {
  const have = everyKey();
  have[manifest[0].key] = { "cache-control": "public, max-age=60" };
  have[manifest[1].key] = { "content-type": "application/octet-stream" };
  const h = harness({ fetch: bucket(have) });
  assert.equal(await main(["--public-base", BASE], h.deps), 0, h.logs.join("\n"));
  assert.ok(h.logs.some((l) => l.startsWith(`FIX ${manifest[0].key}`)));
  assert.ok(h.logs.some((l) => l.startsWith(`FIX ${manifest[1].key}`)));
  assert.match(lastLine(h.logs), /: 0 put, 115 skip, 2 fix, 0 refuse,/);
  assert.ok(h.logs.includes(`    ${formatCommand(manifest[0], "almar-media")}`));
});

test("planUploads: weak ETags and quotes are normalised, an unexpected status is an error", () => {
  const e = manifest[0];
  const ok = { status: 200, etag: e.md5, length: e.bytes, contentType: "image/webp", cacheControl: CACHE_CONTROL };
  assert.equal(planUploads([e], { remote: new Map([[e.key, ok]]) })[0].action, "skip");
  assert.equal(planUploads([e], { remote: { [e.key]: { status: 404 } } })[0].action, "put");
  assert.equal(planUploads([e])[0].action, "put");
  assert.throws(() => planUploads([e], { remote: new Map([[e.key, { status: 403 }]]) }), /HTTP 403/);
});

// 5-6. --apply -----------------------------------------------------------------------------------------------------

test("--apply exits 2 before anything runs unless HOME and CLOUDFLARE_ACCOUNT_ID are ALMAR's exactly", async () => {
  const cases = [
    { PATH: "/usr/bin" },
    { HOME: "/Users/koss", CLOUDFLARE_ACCOUNT_ID: ALMAR_ACCOUNT_ID },
    { HOME: ALMAR_CF_HOME },
    { HOME: ALMAR_CF_HOME, CLOUDFLARE_ACCOUNT_ID: "e64b47de0000000000000000000000000" },
    { HOME: ALMAR_CF_HOME + "/", CLOUDFLARE_ACCOUNT_ID: ALMAR_ACCOUNT_ID },
    { HOME: "/Users/koss", CLOUDFLARE_ACCOUNT_ID: "e64b47de" },
  ];
  for (const env of cases) {
    const h = harness({ env, fetch: bucket({}) });
    assert.equal(await main(["--public-base", BASE, "--apply"], h.deps), 2, JSON.stringify(env));
    assert.equal(h.spawns.length, 0);
    assert.equal(h.fetches.length, 0, "the gate comes before the first request");
  }
});

test("--apply needs an https --public-base and refuses --root and --verify", async () => {
  for (const argv of [["--apply"], ["--apply", "--public-base", "http://media.example.test"], ["--apply", "--public-base", "https://media-pending.invalid"], ["--apply", "--public-base", `${BASE}/path`], ["--apply", "--public-base", BASE, "--root", REPO_ROOT], ["--apply", "--verify", "--public-base", BASE]]) {
    const h = harness({ fetch: bucket({}) });
    assert.equal(await main(argv, h.deps), 2, argv.join(" "));
    assert.equal(h.spawns.length, 0);
  }
  assert.equal(parseBase(BASE), BASE);
  for (const bad of ["http://x.test", "https://x.test/", "https://x.test/a", "https://x.invalid", "x.test", "https://u:p@x.test"]) assert.throws(() => parseBase(bad), undefined, bad);
});

test("--apply with the right env runs one wrangler call per PUT, as an argv array, never a shell", async () => {
  const h = harness({ fetch: bucket({}) });
  assert.equal(await main(["--public-base", BASE, "--apply"], h.deps), 0, h.logs.join("\n"));
  assert.equal(h.spawns.length, manifest.length);
  h.spawns.forEach((s, i) => {
    const e = manifest[i];
    assert.equal(s.bin, "./node_modules/.bin/wrangler");
    assert.ok(Array.isArray(s.args));
    assert.deepEqual(s.args.slice(0, 4), ["r2", "object", "put", `almar-media/${e.key}`]);
    assert.ok(s.args.includes("--remote"));
    assert.equal(s.args[s.args.indexOf("--file") + 1], `media-staging/${e.key}`);
    assert.equal(s.args[s.args.indexOf("--content-type") + 1], "image/webp");
    assert.equal(s.args[s.args.indexOf("--cache-control") + 1], CACHE_CONTROL);
    assert.equal(s.opts.stdio, "inherit");
    assert.equal(s.opts.shell, undefined);
    assert.equal(s.opts.env, GOOD_ENV);
    assert.equal(s.opts.cwd, defaultPaths().root);
  });
  assert.match(lastLine(h.logs), /^media-upload: applied 117 object\(s\)$/);
});

test("--apply stops at the first failing call, names the key, and a re-run skips what landed", async () => {
  const landed = {};
  const failing = harness({ fetch: (url) => bucket(landed)(url), spawnResults: [{ status: 0 }, { status: 0 }, { status: 1 }] });
  const origSpawn = failing.deps.spawnSync;
  failing.deps.spawnSync = (bin, args, opts) => {
    const r = origSpawn(bin, args, opts);
    if (r.status === 0) landed[args[3].replace("almar-media/", "")] = {};
    return r;
  };
  assert.equal(await main(["--public-base", BASE, "--apply"], failing.deps), 1);
  assert.equal(failing.spawns.length, 3, "stops at the third call");
  assert.ok(failing.logs.some((l) => l.includes(`stopped at ${manifest[2].key}`) && l.includes("2 object(s) landed")));
  assert.deepEqual(Object.keys(landed), [manifest[0].key, manifest[1].key]);
  // Re-run: the two that landed are skipped, the rest are put.
  const again = harness({ fetch: (url) => bucket(landed)(url) });
  assert.equal(await main(["--public-base", BASE, "--apply"], again.deps), 0);
  assert.equal(again.spawns.length, manifest.length - 2);
  assert.ok(again.logs.some((l) => l.startsWith(`SKIP ${manifest[0].key}`)));
  assert.match(lastLine(again.logs.slice(0, -1)), /: 115 put, 2 skip, 0 fix, 0 refuse,/);
});

test("--apply does nothing when any key would be refused", async () => {
  const have = everyKey();
  have[manifest[5].key] = { etag: '"ffffffffffffffffffffffffffffffff"' };
  const h = harness({ fetch: bucket(have) });
  assert.equal(await main(["--public-base", BASE, "--apply"], h.deps), 1);
  assert.equal(h.spawns.length, 0);
});

// 7. --verify ------------------------------------------------------------------------------------------------------

function verifyFixture() {
  const entries = [
    { key: "home/hero/poster.webp", body: webpish(10) },
    { key: "stays/a-house/hero.webp", body: webpish(20) },
    { key: "stays/a-house/gallery-1.webp", body: webpish(30) },
    { key: "stays/b-house/hero.webp", body: webpish(40) },
  ];
  const { rows } = scratchRoot(entries);
  const bodies = new Map(entries.map((e) => [e.key, e.body]));
  return { rows, bodies };
}

const served = (bodies, over = {}) => (url) => {
  const key = keyOf(url);
  if (key === "__almar-missing-probe.webp") return res(over.probeStatus ?? 404);
  return res(200, { "content-type": "image/webp", "cache-control": CACHE_CONTROL, ...(over.headers ?? {}) }, over.body ?? bodies.get(key));
};

test("verifyObjects: a correct bucket passes, including the negative probe", async () => {
  const { rows, bodies } = verifyFixture();
  const r = await verifyObjects(rows, BASE, { fetch: async (u) => served(bodies)(u), sample: 12 });
  assert.equal(r.failed, 0, r.lines.join("\n"));
  assert.equal(r.ok, 4 + 1);
  assert.ok(r.lines.at(-1).includes("__almar-missing-probe.webp answered 404"));
});

test("verifyObjects: a body whose sha256 differs fails", async () => {
  const { rows, bodies } = verifyFixture();
  const r = await verifyObjects(rows, BASE, { fetch: async (u) => served(bodies, { body: Buffer.from("something else") })(u), sample: 12 });
  assert.ok(r.failed >= 4);
  assert.ok(r.lines.some((l) => l.startsWith("FAIL home/hero/poster.webp") && l.includes("sha256")));
});

test("verifyObjects: a negative probe that answers 200 fails; wrong headers fail", async () => {
  const { rows, bodies } = verifyFixture();
  let r = await verifyObjects(rows, BASE, { fetch: async (u) => served(bodies, { probeStatus: 200 })(u), sample: 12 });
  assert.equal(r.failed, 1);
  assert.ok(r.lines.at(-1).startsWith("FAIL __almar-missing-probe.webp: expected 404, got 200"));
  r = await verifyObjects(rows, BASE, { fetch: async (u) => served(bodies, { headers: { "cache-control": "no-store" } })(u), sample: 12 });
  assert.ok(r.lines.some((l) => l.includes("cache-control")));
  r = await verifyObjects(rows, BASE, { fetch: async (u) => served(bodies, { headers: { "content-type": "image/jpeg" } })(u), sample: 12 });
  assert.ok(r.lines.some((l) => l.includes("content-type")));
  r = await verifyObjects(rows, BASE, { fetch: async () => res(503), sample: 12 });
  assert.ok(r.lines.some((l) => l.includes("status 503")));
});

test("main --verify exits 1 on any failure and 0 on none; it needs --public-base", async () => {
  const { rows, bodies } = verifyFixture();
  const { root } = scratchRoot(rows.map((r) => ({ key: r.key, body: bodies.get(r.key) })));
  let h = harness({ fetch: served(bodies) });
  assert.equal(await main(["--verify", "--public-base", BASE, "--root", root], h.deps), 0, h.logs.join("\n"));
  assert.match(lastLine(h.logs), /^media-upload: verify 5 ok, 0 failed/);
  h = harness({ fetch: served(bodies, { body: Buffer.from("x") }) });
  assert.equal(await main(["--verify", "--public-base", BASE, "--root", root, "--all"], h.deps), 1);
  h = harness({ fetch: served(bodies) });
  assert.equal(await main(["--verify", "--root", root], h.deps), 2);
});

test("pickSample always has the home hero poster and every stay hero, then a reproducible seeded rest", () => {
  const always = alwaysVerified(manifest);
  assert.ok(always.includes("home/hero/poster.webp"));
  assert.equal(always.filter((k) => /^stays\//.test(k)).length, 12);
  const a = pickSample(manifest, 20);
  assert.deepEqual(a, pickSample(manifest, 20));
  assert.equal(a.length, 20);
  assert.deepEqual(a.slice(0, always.length), always);
  assert.equal(new Set(a).size, a.length);
  assert.equal(pickSample(manifest, 12).length, always.length, "the always-checked set is never cut");
  const changed = manifest.map((e, i) => (i === 0 ? { ...e, sha256: "0".repeat(64) } : e));
  assert.notDeepEqual(pickSample(changed, 20).slice(always.length), a.slice(always.length), "the seed is the manifest's hashes");
});

// 8-9. Refusals before any action ---------------------------------------------------------------------------------

test("a key with .. in a scratch manifest is rejected before any action", async () => {
  const { root } = scratchRoot([{ key: "stays/ok/hero.webp", body: webpish(5) }]);
  const mpath = path.join(root, "lib", "data", "media-manifest.json");
  const rows = JSON.parse(fs.readFileSync(mpath, "utf8"));
  rows.push({ ...rows[0], key: "stays/../etc/passwd.webp" });
  fs.writeFileSync(mpath, JSON.stringify(rows, null, 2) + "\n");
  const h = harness({ fetch: bucket({}) });
  assert.equal(await main(["--root", root], h.deps), 1);
  assert.ok(h.logs.some((l) => l.includes("media key refused")));
  assert.equal(h.spawns.length, 0);
  assert.equal(h.fetches.length, 0);
  assert.equal(h.logs.filter((l) => l.startsWith("PUT ")).length, 0);
});

test("a missing cache file exits 1 naming the key and the command that fixes it", async () => {
  const { root } = scratchRoot([{ key: "stays/ok/hero.webp", body: webpish(5) }, { key: "stays/ok/gallery-1.webp", body: webpish(6) }], { cache: false });
  fs.mkdirSync(path.join(root, "media-staging", "stays", "ok"), { recursive: true });
  fs.writeFileSync(path.join(root, "media-staging", "stays", "ok", "hero.webp"), webpish(5));
  const h = harness({ fetch: bucket({}) });
  assert.equal(await main(["--root", root], h.deps), 1);
  const text = h.logs.join("\n");
  assert.match(text, /stays\/ok\/gallery-1\.webp \(not cached\)/);
  assert.match(text, /node scripts\/media-fetch\.mjs/);
  assert.equal(h.logs.filter((l) => l.startsWith("PUT ")).length, 0);
  // a cached file that differs from the manifest hash is named too
  fs.writeFileSync(path.join(root, "media-staging", "stays", "ok", "hero.webp"), webpish(9));
  const again = harness();
  assert.equal(await main(["--root", root], again.deps), 1);
  assert.match(again.logs.join("\n"), /stays\/ok\/hero\.webp \(cached file differs from the manifest sha256\)/);
});

// Static guards on the script itself -------------------------------------------------------------------------------

test("the script never builds a shell string and every wrangler mention outside a comment is the local binary", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "scripts", "media-upload.mjs"), "utf8");
  assert.doesNotMatch(src, /exec\(|execSync|shell: *true/);
  for (const file of fs.readdirSync(path.join(REPO_ROOT, "scripts")).filter((n) => /^media-.*\.mjs$/.test(n))) {
    const text = fs.readFileSync(path.join(REPO_ROOT, "scripts", file), "utf8");
    text.split("\n").forEach((line, i) => {
      if (/wrangler/.test(line) && !/node_modules\/\.bin\/wrangler/.test(line)) {
        assert.match(line.trim(), /^(\/\/|\/\*|\*)/, `${file}:${i + 1} mentions wrangler outside a comment`);
      }
    });
    assert.doesNotMatch(text, /media\.almarprivatejourney\.com/, `${file}: the gated hostname is never a constant`);
  }
});
