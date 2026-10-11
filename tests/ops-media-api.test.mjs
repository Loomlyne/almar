// Plan 03.2-09 Task 2: the owner media API (03.2-API-CONTRACT.md §5.10). The upload core, the list page and the POST
// actions run here against fakes: a fake R2 bucket (head / put that checks the sha256 like R2 does), a fake length
// stream (FixedLengthStream's rule: exactly Content-Length bytes) and fake RPC callers. Never a real bucket, never a
// database. The route file is checked by source (the same guard style as tests/ops-route.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const up = await loadTs("lib/ops/media-upload.ts");
const vm = await loadTs("lib/ops/validate-media.ts");
const lib = await import("../scripts/media-lib.mjs");
const types = await loadTs("components/ops/media-types.ts");

const A = "11111111-1111-4111-8111-111111111111";
const MB = 1024 * 1024;

function invalid(fn, field, locale) {
  assert.throws(fn, (e) => {
    assert.equal(e.name, "OpsInvalid", String(e));
    assert.equal(e.field, field);
    if (locale !== undefined) assert.equal(e.locale, locale);
    return true;
  });
}

function sha(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function streamOf(bytes, chunk = 7) {
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(at, at + chunk));
      at += chunk;
    },
  });
}

/** FixedLengthStream's rule: exactly `length` bytes, else the stream errors. */
function fakeLengthStream(calls) {
  return (length) => {
    calls.push(length);
    let seen = 0;
    const stream = new TransformStream({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > length) throw new TypeError("too many bytes");
        controller.enqueue(chunk);
      },
      flush() {
        if (seen !== length) throw new TypeError("too few bytes");
      },
    });
    stream.fake = true;
    return stream;
  };
}

/** A fake R2 bucket: head(key) from `existing`; put reads the stream and checks sha256 like R2 (null on a mismatch). */
function fakeBucket({ existing = {}, putMode = "check" } = {}) {
  const calls = { head: [], put: [] };
  const objects = new Map(Object.entries(existing));
  return {
    calls,
    objects,
    async head(key) {
      calls.head.push(key);
      return objects.has(key) ? { key, size: objects.get(key).length } : null;
    },
    async put(key, value, options) {
      calls.put.push({ key, value, options });
      if (putMode === "throw") throw new Error("put failed");
      const chunks = [];
      const reader = value.getReader();
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (putMode === "null") return null;
      if (sha(bytes) !== options.sha256) throw new Error("integrity");
      objects.set(key, bytes);
      return { key, size: bytes.length };
    },
  };
}

function fakeSave(reply = { data: { id: A, created: true }, error: null }) {
  const calls = [];
  return {
    calls,
    fn: async (p) => {
      calls.push(p);
      return reply;
    },
  };
}

function headersFor(bytes, over = {}) {
  const h = {
    "content-type": "image/webp",
    "content-length": String(bytes.length),
    "x-almar-sha256": sha(bytes),
    "x-almar-width": "1600",
    "x-almar-height": "1067",
    "x-almar-alt-en": encodeURIComponent("Pool at dusk, Cartagena"),
    ...over,
  };
  for (const [k, v] of Object.entries(h)) if (v === undefined) delete h[k];
  return new Headers(h);
}

async function upload({ bytes = new Uint8Array(4096).map((_, i) => i % 251), headers, body, bucket, save, lengthCalls = [] } = {}) {
  const b = bucket ?? fakeBucket();
  const s = save ?? fakeSave();
  const result = await up.uploadCore({
    headers: headers ?? headersFor(bytes),
    body: body === undefined ? streamOf(bytes) : body,
    media: b,
    saveMedia: s.fn,
    makeLengthStream: fakeLengthStream(lengthCalls),
  });
  return { result, bucket: b, save: s, bytes, lengthCalls };
}

function refusal(result, status, code, field) {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, code);
  if (field !== undefined) assert.equal(result.body.error.field, field);
}

// ---- keyFor ------------------------------------------------------------------------------------------------------------

test("keyFor: uploads/<first 32 hex>.<ext> from the content type; another type is refused", () => {
  const hex = "ab".repeat(32);
  assert.equal(up.keyFor(hex, "image/webp"), `uploads/${hex.slice(0, 32)}.webp`);
  assert.equal(up.keyFor(hex, "image/jpeg"), `uploads/${hex.slice(0, 32)}.jpg`);
  assert.equal(up.keyFor(hex, "image/png"), `uploads/${hex.slice(0, 32)}.png`);
  invalid(() => up.keyFor(hex, "image/gif"), "content_type");
  invalid(() => up.keyFor(hex, "image/svg+xml"), "content_type");
  invalid(() => up.keyFor("XYZ", "image/webp"), "sha256");
  // The key passes the media.key check of the migration.
  const KEY = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$/;
  assert.match(up.keyFor(hex, "image/png"), KEY);
});

test("MAX_UPLOAD_BYTES is 15 MB and equals the screens' constant; the cache header is the media scripts' one", () => {
  assert.equal(up.MAX_UPLOAD_BYTES, 15 * MB);
  assert.equal(up.MAX_UPLOAD_BYTES, types.MAX_UPLOAD_BYTES);
  assert.equal(up.CACHE_CONTROL, lib.CACHE_CONTROL);
});

// ---- uploadCore refusals -------------------------------------------------------------------------------------------------

test("upload: a content type outside webp/jpeg/png is 415 wrong_type; nothing is stored", async () => {
  for (const type of ["image/gif", "image/heic", "application/octet-stream", "text/html", undefined]) {
    const r = await upload({ headers: headersFor(new Uint8Array(10), { "content-type": type }) });
    refusal(r.result, 415, "wrong_type");
    assert.equal(r.bucket.calls.head.length + r.bucket.calls.put.length, 0);
    assert.equal(r.save.calls.length, 0);
  }
  const ok = await upload({ headers: headersFor(new Uint8Array(4096).map((_, i) => i % 251), { "content-type": "Image/WebP; charset=binary" }) });
  assert.equal(ok.result.body.ok, true, "type compared case-insensitively, parameters ignored");
});

test("upload: Content-Length missing, not a number or over 15 MB is 413 too_large; nothing is read or stored", async () => {
  for (const len of [undefined, "abc", "-1", "1e6", String(15 * MB + 1), String(100 * MB)]) {
    let pulled = false;
    const body = new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 });
    const r = await upload({ headers: headersFor(new Uint8Array(10), { "content-length": len }), body });
    refusal(r.result, 413, "too_large");
    assert.equal(pulled, false, "the body is never read");
    assert.equal(r.bucket.calls.head.length + r.bucket.calls.put.length + r.save.calls.length, 0);
  }
  const zero = await upload({ headers: headersFor(new Uint8Array(10), { "content-length": "0" }) });
  refusal(zero.result, 400, "invalid", "content_length");
});

test("upload: exactly 15 MB passes the size check", async () => {
  const r = await upload({ headers: headersFor(new Uint8Array(10), { "content-length": String(15 * MB), "x-almar-sha256": "0".repeat(64) }), body: streamOf(new Uint8Array(0)) });
  // The body is short, so the put fails on length: the size rule itself let it through.
  refusal(r.result, 400, "invalid", "content_length");
  assert.deepEqual(r.lengthCalls, [15 * MB]);
});

test("upload: a bad sha256, width, height or alt text is 400 invalid with that field; nothing is stored", async () => {
  const b = new Uint8Array(10);
  const cases = [
    [{ "x-almar-sha256": undefined }, "sha256"],
    [{ "x-almar-sha256": "AB".repeat(32) }, "sha256"],
    [{ "x-almar-sha256": "ab".repeat(31) }, "sha256"],
    [{ "x-almar-sha256": "zz".repeat(32) }, "sha256"],
    [{ "x-almar-width": undefined }, "width"],
    [{ "x-almar-width": "0" }, "width"],
    [{ "x-almar-width": "10001" }, "width"],
    [{ "x-almar-width": "12.5" }, "width"],
    [{ "x-almar-height": "-3" }, "height"],
    [{ "x-almar-height": "abc" }, "height"],
    [{ "x-almar-alt-en": undefined }, "alt_en"],
    [{ "x-almar-alt-en": encodeURIComponent("   ") }, "alt_en"],
    [{ "x-almar-alt-en": "%E0%A4%A" }, "alt_en"],
    [{ "x-almar-alt-en": encodeURIComponent("x".repeat(301)) }, "alt_en"],
  ];
  for (const [over, field] of cases) {
    const r = await upload({ headers: headersFor(b, over) });
    refusal(r.result, 400, "invalid", field);
    assert.equal(r.bucket.calls.head.length + r.bucket.calls.put.length + r.save.calls.length, 0, field);
  }
  // 300 characters (Arabic, counted as characters) is accepted.
  const bytes = new Uint8Array(64).fill(3);
  const ok = await upload({ bytes, headers: headersFor(bytes, { "x-almar-alt-en": encodeURIComponent("ب".repeat(300)) }) });
  assert.equal(ok.result.body.ok, true);
});

// ---- uploadCore: store once --------------------------------------------------------------------------------------------

test("upload: a new file is put once under its key with the type, the cache header and the sha256, then saved", async () => {
  const bytes = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
  const hex = sha(bytes);
  const r = await upload({ bytes });
  const key = `uploads/${hex.slice(0, 32)}.webp`;
  assert.deepEqual(r.bucket.calls.head, [key]);
  assert.equal(r.bucket.calls.put.length, 1);
  const put = r.bucket.calls.put[0];
  assert.equal(put.key, key);
  assert.deepEqual(put.options, { httpMetadata: { contentType: "image/webp", cacheControl: lib.CACHE_CONTROL }, sha256: hex });
  assert.deepEqual(r.lengthCalls, [5000]);
  assert.ok(Buffer.from(r.bucket.objects.get(key)).equals(Buffer.from(bytes)), "stored bytes are the sent bytes");
  assert.deepEqual(r.save.calls, [{ key, width: 1600, height: 1067, bytes: 5000, content_type: "image/webp", sha256: hex, source: "upload", alt_en: "Pool at dusk, Cartagena" }]);
  assert.equal(r.result.status ?? 200, 200);
  assert.deepEqual(r.result.body, { ok: true, id: A, key, url: `https://media.almarprivatejourney.com/${key}`, created: true });
});

test("upload: the put gets the length stream's readable, never the raw request body", async () => {
  const bytes = new Uint8Array(300).fill(9);
  const body = streamOf(bytes);
  const r = await upload({ bytes, body });
  const value = r.bucket.calls.put[0].value;
  assert.notEqual(value, body);
  assert.ok(value instanceof ReadableStream);
});

test("upload: jpeg and png get .jpg and .png keys and their own content type", async () => {
  for (const [type, ext] of [["image/jpeg", "jpg"], ["image/png", "png"]]) {
    const bytes = new Uint8Array(200).fill(ext.length);
    const r = await upload({ bytes, headers: headersFor(bytes, { "content-type": type }) });
    assert.equal(r.bucket.calls.put[0].key, `uploads/${sha(bytes).slice(0, 32)}.${ext}`);
    assert.equal(r.bucket.calls.put[0].options.httpMetadata.contentType, type);
    assert.equal(r.save.calls[0].content_type, type);
  }
});

test("upload: the same file again never puts; the row is saved again and the existing id comes back (created false)", async () => {
  const bytes = new Uint8Array(800).fill(5);
  const key = `uploads/${sha(bytes).slice(0, 32)}.webp`;
  const bucket = fakeBucket({ existing: { [key]: Buffer.from(bytes) } });
  const save = fakeSave({ data: { id: A, created: false }, error: null });
  let pulled = false;
  const body = new ReadableStream({ pull(c) { pulled = true; c.close(); } }, { highWaterMark: 0 });
  const r = await upload({ bytes, bucket, save, body });
  assert.equal(bucket.calls.put.length, 0, "never overwrites");
  assert.equal(pulled, false, "the body is not read");
  assert.equal(save.calls.length, 1);
  assert.deepEqual(r.result.body, { ok: true, id: A, key, url: `https://media.almarprivatejourney.com/${key}`, created: false });
});

test("upload: an object under the key with another size is refused (sha256), nothing saved", async () => {
  const bytes = new Uint8Array(800).fill(5);
  const key = `uploads/${sha(bytes).slice(0, 32)}.webp`;
  const bucket = fakeBucket({ existing: { [key]: Buffer.alloc(10) } });
  const r = await upload({ bytes, bucket });
  refusal(r.result, 400, "invalid", "sha256");
  assert.equal(bucket.calls.put.length + r.save.calls.length, 0);
});

test("upload: a body shorter or longer than Content-Length fails the put (content_length); saveMedia never runs", async () => {
  const bytes = new Uint8Array(1000).fill(1);
  for (const sent of [bytes.slice(0, 999), new Uint8Array(1001).fill(1), new Uint8Array(0)]) {
    const r = await upload({ bytes, body: streamOf(sent) });
    refusal(r.result, 400, "invalid", "content_length");
    assert.equal(r.save.calls.length, 0);
    assert.equal(r.bucket.objects.size, 0, "nothing stored");
  }
  const none = await upload({ bytes, body: null });
  refusal(none.result, 400, "invalid", "content_length");
  assert.equal(none.save.calls.length + none.bucket.calls.put.length, 0);
});

test("upload: a sha256 that does not match the bytes (R2 integrity) or a put that returns null is refused (sha256)", async () => {
  const bytes = new Uint8Array(1000).fill(2);
  const wrong = await upload({ bytes, headers: headersFor(bytes, { "x-almar-sha256": sha(new Uint8Array(1000).fill(3)) }) });
  refusal(wrong.result, 400, "invalid", "sha256");
  assert.equal(wrong.save.calls.length, 0);
  assert.equal(wrong.bucket.objects.size, 0);
  for (const putMode of ["null", "throw"]) {
    const r = await upload({ bytes, bucket: fakeBucket({ putMode }) });
    refusal(r.result, 400, "invalid", "sha256");
    assert.equal(r.save.calls.length, 0, putMode);
  }
});

test("upload: a database error is handed to the wrapper; no bucket is 503 unavailable", async () => {
  const save = fakeSave({ data: null, error: { code: "P0001", message: "almar:invalid", details: '{"field":"alt_en"}' } });
  const r = await upload({ save });
  assert.deepEqual(r.result, { dbError: { code: "P0001", message: "almar:invalid", details: '{"field":"alt_en"}' } });
  const bytes = new Uint8Array(10);
  const noBucket = await up.uploadCore({ headers: headersFor(bytes), body: streamOf(bytes), media: null, saveMedia: fakeSave().fn, makeLengthStream: fakeLengthStream([]) });
  refusal(noBucket, 503, "unavailable");
});

// ---- GET list ----------------------------------------------------------------------------------------------------------

function row(key, over = {}) {
  return {
    id: over.id ?? A,
    key,
    width: 1600,
    height: 1000,
    content_type: "image/webp",
    source: "import",
    alt: { en: `Alt ${key}`, ar: null, es: null },
    alt_status: { en: "published", ar: "missing", es: "missing" },
    used_by: 2,
    ...over,
  };
}

function lister(rows, error = null) {
  const calls = [];
  return { calls, fn: async () => { calls.push(1); return { data: error ? null : rows, error }; } };
}

async function list(rows, query = "") {
  const l = lister(rows);
  const out = await up.listMedia({ listRows: l.fn, url: new URL(`https://dashboard.almarprivatejourney.com/api/ops/media${query}`) });
  return out;
}

test("list: ops_list('media') rows become the contract items with url and alt_en; unknown columns are dropped", async () => {
  const out = await list([
    row("stays/b/hero.webp", { id: "22222222-2222-4222-8222-222222222222", alt: { en: "Hero", ar: "بطل", es: "Héroe" }, alt_status: { en: "published", ar: "draft", es: "published" }, used_by: 3, secret: "x" }),
    row("uploads/aa.webp", { source: "upload", width: null, height: null, used_by: 0, alt_status: { en: "published", ar: "weird" } }),
  ]);
  assert.deepEqual(out.body, {
    ok: true,
    items: [
      {
        id: "22222222-2222-4222-8222-222222222222", key: "stays/b/hero.webp", url: "https://media.almarprivatejourney.com/stays/b/hero.webp",
        width: 1600, height: 1000, alt_en: "Hero", content_type: "image/webp", source: "import",
        alt: { en: "Hero", ar: "بطل", es: "Héroe" }, alt_status: { en: "published", ar: "draft", es: "published" }, used_by: 3,
      },
      {
        id: A, key: "uploads/aa.webp", url: "https://media.almarprivatejourney.com/uploads/aa.webp",
        width: null, height: null, alt_en: "Alt uploads/aa.webp", content_type: "image/webp", source: "upload",
        alt: { en: "Alt uploads/aa.webp", ar: null, es: null }, alt_status: { en: "published", ar: "missing", es: "missing" }, used_by: 0,
      },
    ],
    next: null,
  });
});

test("list: q folds case and accents over the key and the English alt text", async () => {
  const rows = [
    row("destinations/bogota/hero.webp", { alt: { en: "Plaza in Bogotá", ar: null, es: null } }),
    row("stays/x/pool.webp", { alt: { en: "Pool at dusk", ar: "مسبح", es: "Piscina" } }),
  ];
  assert.deepEqual((await list(rows, "?q=BOGOTA")).body.items.map((i) => i.key), ["destinations/bogota/hero.webp"]);
  assert.deepEqual((await list(rows, "?q=bogotá")).body.items.map((i) => i.key), ["destinations/bogota/hero.webp"]);
  assert.deepEqual((await list(rows, "?q=dusk")).body.items.map((i) => i.key), ["stays/x/pool.webp"]);
  assert.deepEqual((await list(rows, "?q=piscina")).body.items, [], "only the English alt is searched");
  assert.equal((await list(rows, "?q=")).body.items.length, 2);
});

test("list: limit (default 60, 1..60) and after=<key> page through in key order; next is the last key or null", async () => {
  const rows = Array.from({ length: 130 }, (_, i) => row(`stays/s/${String(i).padStart(3, "0")}.webp`)).reverse();
  const first = await list(rows);
  assert.equal(first.body.items.length, 60);
  assert.equal(first.body.items[0].key, "stays/s/000.webp");
  assert.equal(first.body.next, "stays/s/059.webp");
  const second = await list(rows, `?after=${encodeURIComponent(first.body.next)}`);
  assert.equal(second.body.items[0].key, "stays/s/060.webp");
  const third = await list(rows, `?after=${encodeURIComponent(second.body.next)}`);
  assert.equal(third.body.items.length, 10);
  assert.equal(third.body.next, null);
  const small = await list(rows, "?limit=5");
  assert.equal(small.body.items.length, 5);
  assert.equal(small.body.next, "stays/s/004.webp");
});

test("list: an imported key shared by two image ids never splits across pages", async () => {
  const B = "22222222-2222-4222-8222-222222222222";
  const rows = [row("a/1.webp"), row("a/2.webp", { id: A }), row("a/2.webp", { id: B }), row("a/3.webp")];
  const first = await list(rows, "?limit=2");
  assert.deepEqual(first.body.items.map((i) => [i.key, i.id]), [["a/1.webp", A], ["a/2.webp", A], ["a/2.webp", B]]);
  assert.equal(first.body.next, "a/2.webp");
  const second = await list(rows, "?limit=2&after=a%2F2.webp");
  assert.deepEqual(second.body.items.map((i) => i.key), ["a/3.webp"]);
  assert.equal(second.body.next, null);
});

test("list: a bad q, limit or after is 400 before the database is asked; a database error goes to the wrapper", async () => {
  for (const [query, field] of [["?limit=0", "limit"], ["?limit=61", "limit"], ["?limit=x", "limit"], ["?after=..%2Fx", "after"], ["?after=https%3A%2F%2Fx", "after"], [`?q=${"x".repeat(101)}`, "q"]]) {
    const l = lister([]);
    await assert.rejects(up.listMedia({ listRows: l.fn, url: new URL(`https://d.example/api/ops/media${query}`) }), (e) => e.name === "OpsInvalid" && e.field === field);
    assert.equal(l.calls.length, 0, query);
  }
  const err = { code: "57014", message: "timeout" };
  const out = await up.listMedia({ listRows: lister([], err).fn, url: new URL("https://d.example/api/ops/media") });
  assert.deepEqual(out, { dbError: err });
});

// ---- POST --------------------------------------------------------------------------------------------------------------

test("parseMediaPost: save_alt and delete are accepted; alt is trimmed; an empty AR/ES is null (that record deleted)", () => {
  assert.deepEqual(vm.parseMediaPost({ action: "save_alt", id: A.toUpperCase(), alt: { en: "  Pool  " } }), { action: "save_alt", id: A, alt: { en: "Pool" } });
  assert.deepEqual(
    vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "Pool", ar: "مسبح", es: "" }, status: { ar: "published", es: "draft" } }),
    { action: "save_alt", id: A, alt: { en: "Pool", ar: "مسبح", es: null }, status: { ar: "published", es: "draft" } },
  );
  assert.deepEqual(vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "Pool", ar: null } }), { action: "save_alt", id: A, alt: { en: "Pool", ar: null } });
  assert.deepEqual(vm.parseMediaPost({ action: "delete", id: A }), { action: "delete", id: A });
});

test("parseMediaPost: other actions, bad ids, empty or long alt text, bad status and unknown keys are refused", () => {
  invalid(() => vm.parseMediaPost(null), "body");
  invalid(() => vm.parseMediaPost({ action: "upload", id: A }), "action");
  invalid(() => vm.parseMediaPost({ action: "save", id: A }), "action");
  invalid(() => vm.parseMediaPost({ action: "delete", id: "not-a-uuid" }), "id");
  invalid(() => vm.parseMediaPost({ action: "delete", id: A, force: true }), "force");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: "x", alt: { en: "a" } }), "id");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A }), "alt");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { ar: "x" } }), "alt.en", "en");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "   " } }), "alt.en", "en");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "x".repeat(301) } }), "alt.en", "en");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok", ar: "x".repeat(301) } }), "alt.ar", "ar");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok", es: 5 } }), "alt.es", "es");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok", fr: "x" } }), "alt.fr");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok" }, status: { ar: "live" } }), "status.ar", "ar");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok" }, status: { en: "draft" } }), "status.en");
  invalid(() => vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "ok" }, extra: 1 }), "extra");
  assert.equal(vm.parseMediaPost({ action: "save_alt", id: A, alt: { en: "x".repeat(300) } }).alt.en.length, 300);
});

function rpcs({ save = { data: { id: A, affects_site: true }, error: null }, del = { data: { id: A }, error: null } } = {}) {
  const calls = { save: [], del: [] };
  return {
    calls,
    saveAlts: async (p) => { calls.save.push(p); return save; },
    deleteMedia: async (id) => { calls.del.push(id); return del; },
  };
}

test("postMedia: save_alt calls ops_save_image_alts with {id, alt, status}; delete calls ops_delete_media", async () => {
  const r = rpcs();
  const saved = await up.postMedia({ body: { action: "save_alt", id: A, alt: { en: "Pool", ar: "مسبح" }, status: { ar: "draft" } }, saveAlts: r.saveAlts, deleteMedia: r.deleteMedia });
  assert.deepEqual(r.calls.save, [{ id: A, alt: { en: "Pool", ar: "مسبح" }, status: { ar: "draft" } }]);
  assert.deepEqual(saved.body, { ok: true, id: A, affects_site: true });
  const deleted = await up.postMedia({ body: { action: "delete", id: A }, saveAlts: r.saveAlts, deleteMedia: r.deleteMedia });
  assert.deepEqual(r.calls.del, [A]);
  assert.deepEqual(deleted.body, { ok: true, id: A, affects_site: false });
});

test("postMedia: a used or imported photo comes back as the database error, which maps to 409 in_use", async () => {
  const core = await loadTs("lib/ops/route-core.ts");
  const used = { code: "23503", message: 'update or delete on table "media" violates foreign key constraint', details: null };
  const r = rpcs({ del: { data: null, error: used } });
  const out = await up.postMedia({ body: { action: "delete", id: A }, saveAlts: r.saveAlts, deleteMedia: r.deleteMedia });
  assert.deepEqual(out, { dbError: used });
  assert.equal(core.mapDbError(out.dbError).status, 409);
  assert.equal(core.mapDbError(out.dbError).code, "in_use");
  const imported = { code: "23503", message: "almar:in_use", details: '{"reason": "imported"}' };
  assert.deepEqual(core.mapDbError(imported).detail, { reason: "imported" });
});

// ---- source guards -----------------------------------------------------------------------------------------------------

test("source guard: the media route builds GET, PUT and POST with the wrappers and runs nothing before them", () => {
  const src = readFileSync("app/api/ops/media/route.ts", "utf8");
  assert.match(src, /^export const dynamic = "force-dynamic";$/m);
  assert.match(src, /^export const GET = opsGet\(/m);
  assert.match(src, /^export const PUT = opsPut\(/m);
  assert.match(src, /^export const POST = opsPost\(parseMediaPost, /m);
  const exported = [...src.matchAll(/^export\s+(?:const|function|async function|let|var|class)\s+(\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(exported, ["GET", "POST", "PUT", "dynamic"]);
  // Nothing at module level but imports, the dynamic flag and the three wrapped methods.
  const top = src.split("\n").filter((l) => l.length > 0 && !/^\s/.test(l) && !l.startsWith("//") && !l.startsWith("}") && !l.startsWith(")"));
  for (const line of top) assert.match(line, /^(import |export const (dynamic|GET|PUT|POST) = )/, line);
  for (const m of src.matchAll(/from "([^"]+)"/g)) assert.match(m[1], /^(\.\.\/)+lib\/ops\/[a-z-]+$/, m[1]);
  // The upload streams: the length stream feeds R2; the body is never read whole.
  assert.match(src, /new FixedLengthStream\(/);
  assert.match(src, /rpc\("ops_save_media"/);
  assert.match(src, /rpc\("ops_save_image_alts"/);
  assert.match(src, /rpc\("ops_delete_media"/);
  assert.match(src, /rpc\("ops_list", \{ p_entity: "media" \}\)/);
  assert.equal(/\.(arrayBuffer|blob|text|json|formData)\(/.test(src), false, "never reads the whole body");
  assert.equal(/console\.|storage/.test(src), false, "no logging, never Supabase Storage");
});

test("source guard: the media modules never log, never touch Supabase Storage, never read a whole body, import no Next", () => {
  for (const file of ["lib/ops/media-upload.ts", "lib/ops/validate-media.ts", "lib/ops/media-env.ts", "app/api/ops/media/route.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.equal(/console\./.test(src), false, `${file}: no logging`);
    assert.equal(/storage\.from|\.storage\b/.test(src), false, `${file}: never Supabase Storage`);
    assert.equal(/\.(arrayBuffer|blob|formData)\(/.test(src), false, `${file}: no whole-body read`);
    assert.equal(/process\.env|SUPABASE_/.test(src), false, `${file}: no env, no key`);
  }
  for (const file of ["lib/ops/media-upload.ts", "lib/ops/validate-media.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.equal(/from "next|from "react|from "@opennextjs/.test(src), false, `${file}: pure (node-tested)`);
  }
  const env = readFileSync("lib/ops/media-env.ts", "utf8");
  assert.match(env, /getCloudflareContext\(\)\.env\.MEDIA/);
});
