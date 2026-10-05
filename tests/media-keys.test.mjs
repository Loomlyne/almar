// Tests for `--keys` on media-fetch and media-upload, `--offline` copying local sources, and readKeyList
// (plan 03.3-16, task 1). Everything is offline and runs on scratch roots in os.tmpdir(): the network and wrangler
// are stubs that fail the test if they are called. No test reads the gitignored media-staging/ of the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALMAR_ACCOUNT_ID, ALMAR_CF_HOME, CACHE_CONTROL, md5, readKeyList, sha256 } from "../scripts/media-lib.mjs";
import { main as fetchMain } from "../scripts/media-fetch.mjs";
import { main as uploadMain } from "../scripts/media-upload.mjs";

const BASE = "https://media.example.test";
const GOOD_ENV = { HOME: ALMAR_CF_HOME, CLOUDFLARE_ACCOUNT_ID: ALMAR_ACCOUNT_ID, PATH: "/usr/bin" };
const webpish = (n) => Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"), Buffer.alloc(n, 7)]);

const FILES = [
  { key: "catalog/alpha.webp", body: webpish(11), source: "/assets/img/aaaaaaaaaaaaaaaa.webp", kind: "local" },
  { key: "catalog/beta.webp", body: webpish(22), source: "/assets/img/bbbbbbbbbbbbbbbb.webp", kind: "local" },
  { key: "catalog/gamma.webp", body: webpish(33), source: "/assets/img/cccccccccccccccc.webp", kind: "local" },
  { key: "stays/remote/hero.webp", body: webpish(44), source: "https://framerusercontent.com/images/abc.jpg", kind: "framer" },
];

/**
 * A scratch project: manifest of FILES (all measured), public/assets/img holding the local sources, and a cache that
 * holds the keys listed in `cached`. Returns { root, rows, keyFile(keys) }.
 */
function scratch({ cached = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "almar-keys-"));
  fs.mkdirSync(path.join(root, "lib", "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "assets", "img"), { recursive: true });
  const rows = FILES.map((f) => ({
    key: f.key,
    source: f.source,
    source_kind: f.kind === "local" ? "local" : "framer",
    used_by: ["x"],
    image_ids: ["i"],
    content_type: "image/webp",
    bytes: f.body.length,
    sha256: sha256(f.body),
    md5: md5(f.body),
    width: 1,
    height: 1,
  }));
  fs.writeFileSync(path.join(root, "lib", "data", "media-manifest.json"), JSON.stringify(rows, null, 2) + "\n");
  for (const f of FILES) {
    if (f.kind === "local") fs.writeFileSync(path.join(root, "public", f.source), f.body);
    if (cached.includes(f.key)) {
      fs.mkdirSync(path.dirname(path.join(root, "media-staging", f.key)), { recursive: true });
      fs.writeFileSync(path.join(root, "media-staging", f.key), f.body);
    }
  }
  const keyFile = (lines, name = "keys.txt") => {
    const file = path.join(root, name);
    fs.writeFileSync(file, Array.isArray(lines) ? lines.join("\n") + "\n" : lines);
    return file;
  };
  return { root, rows, keyFile };
}

const noNetwork = async (url) => {
  throw new Error(`the network must not be used in this test (${url})`);
};
const cached = (root, key) => fs.existsSync(path.join(root, "media-staging", key));

// readKeyList -----------------------------------------------------------------------------------------------------

test("readKeyList ignores blank and # lines, trims, and returns keys in manifest order whatever the file order", () => {
  const s = scratch();
  const file = s.keyFile(["# a comment", "", "  catalog/gamma.webp  ", "", "catalog/alpha.webp", "   # another"]);
  assert.deepEqual(readKeyList(file, s.rows), ["catalog/alpha.webp", "catalog/gamma.webp"]);
});

test("readKeyList throws with the line number for an unknown key, a duplicate, a bad key and an empty list", () => {
  const s = scratch();
  assert.throws(() => readKeyList(s.keyFile(["catalog/alpha.webp", "catalog/nope.webp"]), s.rows), /line 2: .*not in the manifest/);
  assert.throws(() => readKeyList(s.keyFile(["catalog/alpha.webp", "", "catalog/alpha.webp"]), s.rows), /line 3: .*duplicate/);
  assert.throws(() => readKeyList(s.keyFile(["catalog/../secret.webp"]), s.rows), /line 1: .*refused/);
  assert.throws(() => readKeyList(s.keyFile(["https://evil.test/x.webp"]), s.rows), /line 1: /);
  assert.throws(() => readKeyList(s.keyFile(["# only a comment", ""]), s.rows), /holds no key/);
  assert.throws(() => readKeyList(path.join(s.root, "absent.txt"), s.rows), /ENOENT|key list/);
});

// media-fetch --------------------------------------------------------------------------------------------------------

test("fetch --offline copies an uncached LOCAL entry (a copy is not a download) and fails a REMOTE one as MISSING", async () => {
  const s = scratch();
  const logs = [];
  const code = await fetchMain(["--offline", "--root", s.root], { log: (l) => logs.push(l), fetch: noNetwork });
  assert.equal(code, 1, logs.join("\n"));
  assert.ok(logs.includes("MISSING stays/remote/hero.webp is not cached and --offline forbids a download"), logs.join("\n"));
  assert.match(logs.at(-1), /^media-fetch: 4 entries, 0 cached, 0 downloaded, 3 copied, 1 failed, /);
  for (const k of ["catalog/alpha.webp", "catalog/beta.webp", "catalog/gamma.webp"]) assert.ok(cached(s.root, k), k);
  assert.equal(cached(s.root, "stays/remote/hero.webp"), false);
});

test("fetch --offline --keys <file> copies only the listed local key, prints the --keys line, and a second run reports it cached", async () => {
  const s = scratch();
  const file = s.keyFile(["catalog/beta.webp"]);
  const logs = [];
  const code = await fetchMain(["--offline", "--keys", file, "--root", s.root], { log: (l) => logs.push(l), fetch: noNetwork });
  assert.equal(code, 0, logs.join("\n"));
  assert.equal(logs.filter((l) => l.includes("--keys")).length, 1);
  assert.ok(logs.includes(`media-fetch: --keys ${file}: 1 of 4 manifest entries`), logs.join("\n"));
  assert.match(logs.at(-1), /^media-fetch: 1 entries, 0 cached, 0 downloaded, 1 copied, 0 failed, /);
  assert.ok(cached(s.root, "catalog/beta.webp"));
  assert.equal(cached(s.root, "catalog/alpha.webp"), false, "an unlisted key is never touched");
  const again = [];
  assert.equal(await fetchMain(["--offline", "--keys", file, "--root", s.root], { log: (l) => again.push(l), fetch: noNetwork }), 0);
  assert.match(again.at(-1), /^media-fetch: 1 entries, 1 cached, 0 downloaded, 0 copied, 0 failed, /);
});

test("fetch --keys naming an unknown key is exit 2 and copies nothing", async () => {
  const s = scratch();
  const logs = [];
  const code = await fetchMain(["--offline", "--keys", s.keyFile(["catalog/alpha.webp", "catalog/nope.webp"]), "--root", s.root], { log: (l) => logs.push(l), fetch: noNetwork });
  assert.equal(code, 2, logs.join("\n"));
  assert.match(logs.join("\n"), /line 2: .*not in the manifest/);
  assert.equal(fs.existsSync(path.join(s.root, "media-staging")), false);
});

test("fetch --keys without a value is exit 2", async () => {
  const s = scratch();
  const logs = [];
  assert.equal(await fetchMain(["--root", s.root, "--keys"], { log: (l) => logs.push(l), fetch: noNetwork }), 2);
});

// media-upload -------------------------------------------------------------------------------------------------------

function harness({ root, env = GOOD_ENV, fetch } = {}) {
  const logs = [];
  const spawns = [];
  const fetches = [];
  return {
    logs,
    spawns,
    fetches,
    deps: {
      env,
      root,
      log: (l) => logs.push(l),
      spawnSync: (bin, args, opts) => {
        spawns.push({ bin, args, opts });
        return { status: 0 };
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

const LISTED = ["catalog/alpha.webp", "catalog/gamma.webp"];

test("upload dry run with --keys prints exactly the listed PUT lines and commands, counts only them, starts nothing", async () => {
  const s = scratch({ cached: LISTED });
  const file = s.keyFile(LISTED);
  const h = harness({ root: s.root });
  const code = await uploadMain(["--keys", file], h.deps);
  assert.equal(code, 0, h.logs.join("\n"));
  assert.deepEqual(h.logs.filter((l) => l.startsWith("PUT ")), LISTED.map((k) => `PUT ${k}`));
  assert.equal(h.logs.filter((l) => l.startsWith("    HOME=")).length, 2);
  for (const k of LISTED) assert.ok(h.logs.some((l) => l.includes(`./node_modules/.bin/wrangler r2 object put almar-media/${k} `)), k);
  assert.ok(h.logs.includes(`media-upload: --keys ${file}: 2 of 4 manifest entries`), h.logs.join("\n"));
  assert.match(h.logs.at(-1), /^2 entries: 2 put, 0 skip, 0 fix, 0 refuse, 0\.0 MB to send$/);
  assert.equal(h.spawns.length, 0);
  assert.equal(h.fetches.length, 0);
});

test("the same cache without --keys exits 1 naming the uncached keys (existing behaviour kept)", async () => {
  const s = scratch({ cached: LISTED });
  const h = harness({ root: s.root });
  assert.equal(await uploadMain([], h.deps), 1);
  assert.match(h.logs.join("\n"), /catalog\/beta\.webp \(not cached\)/);
  assert.match(h.logs.join("\n"), /stays\/remote\/hero\.webp \(not cached\)/);
  assert.equal(h.spawns.length, 0);
});

test("upload --keys with an unknown key is exit 2: no spawn, no fetch", async () => {
  const s = scratch({ cached: LISTED });
  const h = harness({ root: s.root });
  const code = await uploadMain(["--keys", s.keyFile(["catalog/alpha.webp", "catalog/nope.webp"]), "--public-base", BASE], h.deps);
  assert.equal(code, 2, h.logs.join("\n"));
  assert.match(h.logs.join("\n"), /line 2: .*not in the manifest/);
  assert.equal(h.spawns.length, 0);
  assert.equal(h.fetches.length, 0);
});

test("upload --keys with a duplicate or a path-traversal key is exit 2 with the line named", async () => {
  const s = scratch({ cached: LISTED });
  for (const [lines, re] of [
    [["catalog/alpha.webp", "catalog/alpha.webp"], /line 2: .*duplicate/],
    [["../../etc/passwd.webp"], /line 1: /],
  ]) {
    const h = harness({ root: s.root });
    assert.equal(await uploadMain(["--keys", s.keyFile(lines), "--public-base", BASE], h.deps), 2);
    assert.match(h.logs.join("\n"), re);
    assert.equal(h.spawns.length + h.fetches.length, 0);
  }
});

test("upload --apply --keys with the default HOME or a wrong account id is exit 2 before anything runs (the gate still comes first)", async () => {
  const s = scratch({ cached: LISTED });
  const file = s.keyFile(LISTED);
  for (const env of [{ HOME: "/Users/koss", PATH: "/usr/bin" }, { ...GOOD_ENV, CLOUDFLARE_ACCOUNT_ID: "e64b47de0000000000000000000000aa" }, { ...GOOD_ENV, HOME: "/Users/koss" }]) {
    const h = harness({ root: s.root, env });
    const code = await uploadMain(["--apply", "--keys", file, "--public-base", BASE], h.deps);
    assert.equal(code, 2, h.logs.join("\n"));
    assert.match(h.logs.join("\n"), /refusing --apply/);
    assert.equal(h.spawns.length, 0);
    assert.equal(h.fetches.length, 0);
  }
  // the gate also beats a bad key list: nothing about the list is read before the account is right
  const h = harness({ root: s.root, env: { HOME: "/Users/koss", PATH: "/usr/bin" } });
  assert.equal(await uploadMain(["--apply", "--keys", s.keyFile(["catalog/nope.webp"], "bad.txt"), "--public-base", BASE], h.deps), 2);
  assert.match(h.logs.join("\n"), /refusing --apply/);
});

test("upload --apply --keys with ALMAR's env spawns once per listed key and never for an unlisted one", async () => {
  const s = scratch({ cached: LISTED });
  const h = harness({ root: s.root, fetch: () => res(404) });
  const code = await uploadMain(["--apply", "--keys", s.keyFile(LISTED), "--public-base", BASE], h.deps);
  assert.equal(code, 0, h.logs.join("\n"));
  assert.equal(h.spawns.length, 2);
  assert.deepEqual(h.spawns.map((x) => x.args[3]), LISTED.map((k) => `almar-media/${k}`));
  assert.ok(h.spawns.every((x) => x.bin === "./node_modules/.bin/wrangler" && Array.isArray(x.args) && x.args.includes("--remote")));
  assert.ok(!h.spawns.some((x) => x.args[3].includes("beta") || x.args[3].includes("remote")));
  assert.equal(h.fetches.length, 2, "only the listed keys are probed on the public base");
  assert.match(h.logs.at(-1), /^media-upload: applied 2 object\(s\)$/);
});

test("upload --verify --keys checks exactly the listed keys plus the negative probe", async () => {
  const s = scratch({ cached: LISTED });
  const byKey = new Map(s.rows.map((e) => [e.key, e]));
  const body = new Map(FILES.map((f) => [f.key, f.body]));
  const h = harness({
    root: s.root,
    fetch: (url) => {
      const key = new URL(url).pathname.slice(1);
      if (!byKey.has(key)) return res(404);
      return res(200, { "content-type": "image/webp", "cache-control": CACHE_CONTROL }, body.get(key));
    },
  });
  const file = s.keyFile(LISTED);
  const code = await uploadMain(["--verify", "--keys", file, "--public-base", BASE], h.deps);
  assert.equal(code, 0, h.logs.join("\n"));
  assert.ok(h.logs.includes(`media-upload: --keys ${file}: 2 of 4 manifest entries`));
  assert.deepEqual(h.logs.filter((l) => l.startsWith("OK   ")), [...LISTED.map((k) => `OK   ${k}`), "OK   __almar-missing-probe.webp answered 404"]);
  assert.equal(h.fetches.length, 3);
  assert.equal(h.logs.at(-1), "media-upload: verify 3 ok, 0 failed (2 objects and the negative probe)");
  assert.equal(h.spawns.length, 0);
});

test("no script uses a shell string for the child process", () => {
  for (const f of ["media-upload.mjs", "media-fetch.mjs"]) {
    const text = fs.readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");
    assert.ok(!/\bexec\(|execSync|shell:\s*true/.test(text), f);
  }
});
