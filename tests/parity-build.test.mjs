// scripts/parity-build.mjs, the parts that need no build and no database (plan 03.2-02, Task 3): arguments, the --live
// refusals, the build environment, build-id normalisation and the byte comparison of two output folders. The builds
// themselves are run by hand (the summary holds their output).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  BUILD_ID_PLACEHOLDER,
  buildEnv,
  compareDigests,
  describeDifference,
  digestTree,
  diffContext,
  findValues,
  isBuildCache,
  livePublicEnv,
  parseArgs,
  buildIdForms,
  canonicalFlight,
  differsInFlightOrderOnly,
  replaceBuildId,
  replaceBuildIdInPath,
} from "../scripts/parity-build.mjs";

const PUBLIC = { NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test" };

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "almar-parity-test-"));
  made.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

test("parseArgs: the four flags, anything else is reported", () => {
  assert.deepEqual(parseArgs([]), { againstToday: false, live: false, strict: false, keep: false, unknown: [] });
  assert.deepEqual(parseArgs(["--against-today", "--live", "--strict", "--keep"]), { againstToday: true, live: true, strict: true, keep: true, unknown: [] });
  assert.deepEqual(parseArgs(["--lives", "x"]).unknown, ["--lives", "x"]);
});

test("--live: needs both public settings, an https *.supabase.co URL, and no service-role variable; names only", () => {
  assert.deepEqual(livePublicEnv({ ...PUBLIC }), PUBLIC);
  assert.deepEqual(livePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: " https://abcdefgh.supabase.co ", NEXT_PUBLIC_SUPABASE_ANON_KEY: " k " }), {
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
  });
  assert.throws(() => livePublicEnv({}), /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.throws(() => livePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: PUBLIC.NEXT_PUBLIC_SUPABASE_URL }), /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  for (const url of ["http://127.0.0.1:54321", "http://abcdefgh.supabase.co", "https://example.com", "https://user:pw@abcdefgh.supabase.co", "not a url"]) {
    assert.throws(() => livePublicEnv({ ...PUBLIC, NEXT_PUBLIC_SUPABASE_URL: url }), (error) => !error.message.includes("pw@") && !error.message.includes(url), url);
  }
  assert.throws(
    () => livePublicEnv({ ...PUBLIC, SUPABASE_SERVICE_ROLE_KEY: "value-must-not-appear" }),
    (error) => /SUPABASE_SERVICE_ROLE_KEY/.test(error.message) && !error.message.includes("value-must-not-appear"),
  );
  livePublicEnv({ ...PUBLIC, SUPABASE_SERVICE_ROLE_KEY: "" });
});

test("buildEnv: nothing ALMAR_*, NEXT_PUBLIC_* or service-role is inherited, then exactly the extras", () => {
  const env = buildEnv(
    { PATH: "/usr/bin", HOME: "/h", ALMAR_DATA_SOURCE: "x", ALMAR_FIXTURE_DIR: "/y", NEXT_PUBLIC_A: "1", SUPABASE_SERVICE_ROLE_KEY: "k", my_service_role: "k" },
    { ALMAR_DATA_SOURCE: "fixtures", ...PUBLIC },
  );
  assert.deepEqual(env, { PATH: "/usr/bin", HOME: "/h", ALMAR_DATA_SOURCE: "fixtures", ...PUBLIC });
});

test("replaceBuildId: every occurrence in file content and in paths, byte-exact, binary safe", () => {
  assert.equal(replaceBuildId(Buffer.from('{"b":"abc123","p":"/_next/static/abc123/x.js"}'), "abc123").toString(), `{"b":"${BUILD_ID_PLACEHOLDER}","p":"/_next/static/${BUILD_ID_PLACEHOLDER}/x.js"}`);
  const binary = Buffer.from([0, 255, 128, 0x61, 0x62, 0x63, 200, 7]);
  assert.deepEqual(replaceBuildId(binary, "zzz"), binary);
  const withId = Buffer.concat([Buffer.from([255, 254]), Buffer.from("abc123"), Buffer.from([0, 1])]);
  assert.deepEqual(replaceBuildId(withId, "abc123"), Buffer.concat([Buffer.from([255, 254]), Buffer.from(BUILD_ID_PLACEHOLDER), Buffer.from([0, 1])]));
  assert.equal(replaceBuildId(Buffer.from("x"), "").toString(), "x");
});

test("a build id with a dash is replaced in both spellings: as it is, and with _ in the HTML comment", () => {
  assert.deepEqual(buildIdForms("ab-cd_e-f"), ["ab-cd_e-f", "ab_cd_e_f"]);
  assert.deepEqual(buildIdForms("abc"), ["abc"]);
  assert.deepEqual(buildIdForms(""), []);
  const html = Buffer.from('<!DOCTYPE html><!--ab_cd_e_f--><html>"b":"ab-cd_e-f"</html>');
  assert.equal(replaceBuildId(html, "ab-cd_e-f").toString(), `<!DOCTYPE html><!--${BUILD_ID_PLACEHOLDER}--><html>"b":"${BUILD_ID_PLACEHOLDER}"</html>`);
  assert.equal(replaceBuildIdInPath("_next/static/ab-cd_e-f/x.js", "ab-cd_e-f"), `_next/static/${BUILD_ID_PLACEHOLDER}/x.js`);
  const a = tree({ "p.html": '<!--ab_cd--><p>"b":"ab-cd"</p>' });
  const b = tree({ "p.html": '<!--zz_yy--><p>"b":"zz-yy"</p>' });
  assert.deepEqual(compareDigests(digestTree(a, "ab-cd"), digestTree(b, "zz-yy")), { compared: 1, differing: [] });
});

test("two folders that differ only by their build id are identical, paths included", () => {
  const a = tree({ "index.html": 'page b="IDAAAA"', "_next/static/IDAAAA/_buildManifest.js": "m IDAAAA", "keep.txt": "same" });
  const b = tree({ "index.html": 'page b="IDBBBB"', "_next/static/IDBBBB/_buildManifest.js": "m IDBBBB", "keep.txt": "same" });
  const left = digestTree(a, "IDAAAA");
  const right = digestTree(b, "IDBBBB");
  assert.deepEqual([...left.keys()].sort(), ["_next/static/BUILD_ID/_buildManifest.js", "index.html", "keep.txt"]);
  assert.deepEqual(compareDigests(left, right), { compared: 3, differing: [] });
});

test("compareDigests bites: one byte, a missing file, an extra file", () => {
  const a = tree({ "a.html": "<p>one</p>", "gone.html": "x", "same.txt": "s" });
  const b = tree({ "a.html": "<p>onf</p>", "extra.html": "y", "same.txt": "s" });
  const result = compareDigests(digestTree(a, "ID"), digestTree(b, "ID"));
  assert.equal(result.compared, 4);
  assert.deepEqual(
    result.differing,
    [
      { path: "a.html", kind: "content" },
      { path: "extra.html", kind: "only-in-right" },
      { path: "gone.html", kind: "only-in-left" },
    ],
  );
});

test("a difference is reported with its position and context; binaries by size", () => {
  assert.match(diffContext("<p>hello world</p>", "<p>hello wxrld</p>"), /^at character 10: .*hello world.* vs .*hello wxrld/);
  const a = tree({ "p.html": "<main>min_nights\":null</main>", "i.png": "\u0000\u0001ab" });
  const b = tree({ "p.html": "<main>min_nights\":1</main>", "i.png": "\u0000\u0001abc" });
  const line = describeDifference(join(a, "p.html"), join(b, "p.html"), "p.html", "ID", "ID");
  assert.match(line, /null.* vs .*min_nights/s);
  assert.match(describeDifference(join(a, "i.png"), join(b, "i.png"), "i.png", "ID", "ID"), /binary file: 4 bytes vs 5 bytes/);
});

test("findValues reports where a public value appears in any file but a binary, extension-less files included", () => {
  const dir = tree({
    "a.html": "x https://abcdefgh.supabase.co y",
    "_next/static/c.js": "k=anon-key-for-a-test",
    "cache/__fetch/6fe3a1": '{"url":"https://abcdefgh.supabase.co/rest/v1/api_stays"}', // Next's fetch cache: no extension
    "i.png": "https://abcdefgh.supabase.co",
    "f.woff2": "anon-key-for-a-test",
    "b.html": "nothing",
  });
  const hits = findValues(dir, { "the public URL": PUBLIC.NEXT_PUBLIC_SUPABASE_URL, "the public anon key": PUBLIC.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  assert.deepEqual(hits.map((h) => `${h.label}@${h.file}`).sort(), ["the public URL@a.html", "the public URL@cache/__fetch/6fe3a1", "the public anon key@_next/static/c.js"]);
  assert.deepEqual(findValues(dir, { "empty value": "" }), []);
});

test("isBuildCache names the fetch cache and its OpenNext copy, and nothing deployable", () => {
  assert.equal(isBuildCache(".next/cache/fetch-cache/", "6fe3a1"), true);
  assert.equal(isBuildCache(".open-next/", "cache/__fetch/6fe3a1"), true);
  assert.equal(isBuildCache(".open-next/", "cloudflare/next-env.mjs"), false);
  assert.equal(isBuildCache("out/", "cache/x.html"), false);
  assert.equal(isBuildCache(".next/server/", "app/page.js"), false);
});

test("every build of the script goes through the assembler, which clears Next's fetch cache before it builds", () => {
  const src = readFileSync("scripts/parity-build.mjs", "utf8");
  assert.match(src, /spawnSync\(process\.execPath, \["scripts\/assemble-cloudflare\.mjs", "--target=local"\]/);
  const assembler = readFileSync("scripts/assemble-cloudflare.mjs", "utf8");
  assert.ok(assembler.indexOf("clearFetchCache(root);") > 0 && assembler.indexOf("clearFetchCache(root);") < assembler.indexOf('"./node_modules/.bin/opennextjs-cloudflare"'));
});

test("the script never names a service-role key, never prints one, and only reads GET paths of the live project", () => {
  // Code only: the header comment describes the import it asks the local helper for.
  const src = readFileSync("scripts/parity-build.mjs", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");
  assert.equal(src.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.doesNotMatch(src, /\bfetch\(|\.rpc\(|\.insert\(|\.upsert\(|\.delete\(|--apply|import-catalog/, "no request, no write, no import path other than through the local helper");
  assert.match(src, /livePublicEnv\(process\.env\)/);
});

const push = (text) => `<script>self.__next_f.push([1,${JSON.stringify(text)}])</script>`;

test("canonicalFlight: the same rows in another order (also split at other places) give one canonical document", () => {
  const rowA = '4:["$","h1",null,{"children":"Page not found"}]\n';
  const rowB = '16:I[1757,["5889","static/chunks/x.js"],"PublicFrame"]\n';
  const rowC = 'b:{"metadata":[["$","title","0",{"children":"A <b> title"}]]}\n';
  const head = '<!DOCTYPE html><html><body><p>x</p><script>self.__next_f.push([0])</script>';
  const tailHtml = "</body></html>";
  const one = head + push(rowA) + push(rowB + rowC) + tailHtml;
  const other = head + push(rowC.slice(0, 9)) + push(rowC.slice(9) + rowB) + push(rowA) + tailHtml; // other order, other chunk edges
  assert.notEqual(one, other);
  assert.equal(canonicalFlight(one), canonicalFlight(other));
  assert.match(canonicalFlight(one), /<script>self\.__next_f\.push\(\[0\]\)<\/script>/, "the bootstrap chunk is kept");
  assert.equal((canonicalFlight(one).match(/__next_f\.push\(\[1,/g) ?? []).length, 1, "one canonical chunk");
});

test("canonicalFlight bites: a changed row, a missing row and a changed byte outside the payload are still differences", () => {
  const rows = (text) => `<p>x</p>${push(text)}<footer>f</footer>`;
  const base = rows('4:"a"\n5:"b"\n');
  assert.notEqual(canonicalFlight(base), canonicalFlight(rows('4:"a"\n5:"c"\n')));
  assert.notEqual(canonicalFlight(base), canonicalFlight(rows('4:"a"\n')));
  assert.notEqual(canonicalFlight(base), canonicalFlight(base.replace("<footer>f", "<footer>g")));
  assert.equal(canonicalFlight("<p>no flight here</p>"), "<p>no flight here</p>");
});

test("differsInFlightOrderOnly: html only, after the build id is replaced", () => {
  const a = tree({ "i.html": `<!--aa_bb-->${push('1:"x"\n2:"y"\n')}`, "i.js": '1:"x"\n2:"y"\n' });
  const b = tree({ "i.html": `<!--cc_dd-->${push('2:"y"\n1:"x"\n')}`, "i.js": '2:"y"\n1:"x"\n' });
  assert.equal(differsInFlightOrderOnly(join(a, "i.html"), join(b, "i.html"), "i.html", "aa-bb", "cc-dd"), true);
  assert.equal(differsInFlightOrderOnly(join(a, "i.js"), join(b, "i.js"), "i.js", "aa-bb", "cc-dd"), false);
  const c = tree({ "i.html": `<!--cc_dd-->${push('2:"y"\n1:"z"\n')}` });
  assert.equal(differsInFlightOrderOnly(join(a, "i.html"), join(c, "i.html"), "i.html", "aa-bb", "cc-dd"), false);
});
