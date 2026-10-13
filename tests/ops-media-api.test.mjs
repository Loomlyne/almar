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
const prep = await loadTs("components/ops/image-prep.ts");

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

const SIG = {
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

/** `bytes` with its first bytes set to the type's signature: the upload core checks them (job 03.2-09b). */
function signed(bytes, type = "image/webp") {
  bytes.set(SIG[type], 0);
  return bytes;
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
      // The message R2 gives for a digest mismatch.
      if (sha(bytes) !== options.sha256) throw new Error("put: The SHA-256 checksum you specified did not match what we received.");
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

async function upload({ bytes = signed(new Uint8Array(4096).map((_, i) => i % 251)), headers, body, bucket, save, lengthCalls = [] } = {}) {
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

test("MAX_UPLOAD_BYTES is 10 MB and equals the screens' and the re-encode's constants; the cache header is the media scripts' one", () => {
  assert.equal(up.MAX_UPLOAD_BYTES, 10 * MB);
  assert.equal(up.MAX_UPLOAD_BYTES, types.MAX_UPLOAD_BYTES);
  assert.equal(up.MAX_UPLOAD_BYTES, prep.MAX_BYTES);
  assert.equal(up.CACHE_CONTROL, lib.CACHE_CONTROL);
});

// Review finding 1 (job 03.2-09b): middleware.ts runs on /api/ops/media (requireOwner needs its shell header), and Next
// buffers a body for middleware up to DEFAULT_BODY_CLONE_SIZE_LIMIT unless experimental.middlewareClientMaxBodySize is
// set; past it the route gets a cut-off body. The upload limit must never be above what the middleware passes whole.
test("the upload limit is not above Next's middleware body buffer, which next.config.ts leaves at its default", () => {
  const source = readFileSync("node_modules/next/dist/server/body-streams.js", "utf8");
  const found = source.match(/const DEFAULT_BODY_CLONE_SIZE_LIMIT = (\d+) \* (\d+) \* (\d+)/);
  assert.ok(found, "Next's body clone limit is where this test reads it");
  const nextLimit = Number(found[1]) * Number(found[2]) * Number(found[3]);
  assert.equal(nextLimit, 10 * MB);
  assert.match(source, /if \(bytesRead > bodySizeLimit\)/, "a body of exactly the limit is passed whole");
  assert.ok(up.MAX_UPLOAD_BYTES <= nextLimit);
  assert.equal(/middlewareClientMaxBodySize/.test(readFileSync("next.config.ts", "utf8")), false);
  assert.match(readFileSync("middleware.ts", "utf8"), /matcher: \[/);
});

// ---- uploadCore refusals -------------------------------------------------------------------------------------------------

test("upload: a content type outside webp/jpeg/png is 415 wrong_type; nothing is stored", async () => {
  for (const type of ["image/gif", "image/heic", "application/octet-stream", "text/html", undefined]) {
    const r = await upload({ headers: headersFor(new Uint8Array(10), { "content-type": type }) });
    refusal(r.result, 415, "wrong_type");
    assert.equal(r.bucket.calls.head.length + r.bucket.calls.put.length, 0);
    assert.equal(r.save.calls.length, 0);
  }
  const ok = await upload({ headers: headersFor(signed(new Uint8Array(4096).map((_, i) => i % 251)), { "content-type": "Image/WebP; charset=binary" }) });
  assert.equal(ok.result.body.ok, true, "type compared case-insensitively, parameters ignored");
});

test("upload: Content-Length missing, not a number or over 10 MB is 413 too_large; nothing is read or stored", async () => {
  for (const len of [undefined, "abc", "-1", "1e6", String(10 * MB + 1), String(12 * MB), String(15 * MB), String(100 * MB)]) {
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

test("upload: exactly 10 MB passes the size check; 10 MB + 1 byte is 413 too_large, never a cut-off upload", async () => {
  const r = await upload({ headers: headersFor(new Uint8Array(10), { "content-length": String(10 * MB), "x-almar-sha256": "0".repeat(64) }), body: streamOf(signed(new Uint8Array(12))) });
  // The body is short, so the put fails on length: the size rule itself let it through.
  refusal(r.result, 400, "invalid", "content_length");
  assert.deepEqual(r.lengthCalls, [10 * MB]);
  // One byte over: refused on the header, before a byte is read, so Next's 10 MB middleware buffer never cuts it.
  let pulled = false;
  const body = new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 });
  const over = await upload({ headers: headersFor(new Uint8Array(10), { "content-length": String(10 * MB + 1) }), body });
  refusal(over.result, 413, "too_large");
  assert.equal(over.result.body.error.field, null);
  assert.equal(pulled, false);
  assert.deepEqual(over.lengthCalls, []);
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
  const bytes = signed(new Uint8Array(64).fill(3));
  const ok = await upload({ bytes, headers: headersFor(bytes, { "x-almar-alt-en": encodeURIComponent("ب".repeat(300)) }) });
  assert.equal(ok.result.body.ok, true);
});

// ---- uploadCore: store once --------------------------------------------------------------------------------------------

test("upload: a new file is put once under its key with the type, the cache header and the sha256, then saved", async () => {
  const bytes = signed(new Uint8Array(5000).map((_, i) => (i * 7) % 256));
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
  const bytes = signed(new Uint8Array(300).fill(9));
  const body = streamOf(bytes);
  const r = await upload({ bytes, body });
  const value = r.bucket.calls.put[0].value;
  assert.notEqual(value, body);
  assert.ok(value instanceof ReadableStream);
});

test("upload: jpeg and png get .jpg and .png keys and their own content type", async () => {
  for (const [type, ext] of [["image/jpeg", "jpg"], ["image/png", "png"]]) {
    const bytes = signed(new Uint8Array(200).fill(ext.length), type);
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
  const bytes = signed(new Uint8Array(1000).fill(1));
  for (const sent of [bytes.slice(0, 999), signed(new Uint8Array(1001).fill(1)), bytes.slice(0, 5), new Uint8Array(0)]) {
    const r = await upload({ bytes, body: streamOf(sent) });
    refusal(r.result, 400, "invalid", "content_length");
    assert.equal(r.save.calls.length, 0);
    assert.equal(r.bucket.objects.size, 0, "nothing stored");
  }
  const none = await upload({ bytes, body: null });
  refusal(none.result, 400, "invalid", "content_length");
  assert.equal(none.save.calls.length + none.bucket.calls.put.length, 0);
});

test("upload: a sha256 that does not match the bytes (R2 integrity) or a put that returns null is refused (sha256); R2 failing otherwise is 503", async () => {
  const bytes = signed(new Uint8Array(1000).fill(2));
  const wrong = await upload({ bytes, headers: headersFor(bytes, { "x-almar-sha256": sha(new Uint8Array(1000).fill(3)) }) });
  refusal(wrong.result, 400, "invalid", "sha256");
  assert.equal(wrong.save.calls.length, 0);
  assert.equal(wrong.bucket.objects.size, 0);
  const refused = await upload({ bytes, bucket: fakeBucket({ putMode: "null" }) });
  refusal(refused.result, 400, "invalid", "sha256");
  assert.equal(refused.save.calls.length, 0);
  // R2 not answering is not the owner's file: 503, nothing saved.
  const down = await upload({ bytes, bucket: fakeBucket({ putMode: "throw" }) });
  refusal(down.result, 503, "unavailable");
  assert.equal(down.save.calls.length, 0);
});

test("upload: a database error is handed to the wrapper; no bucket is 503 unavailable", async () => {
  const save = fakeSave({ data: null, error: { code: "P0001", message: "almar:invalid", details: '{"field":"alt_en"}' } });
  const r = await upload({ save });
  assert.deepEqual(r.result, { dbError: { code: "P0001", message: "almar:invalid", details: '{"field":"alt_en"}' } });
  const bytes = new Uint8Array(10);
  const noBucket = await up.uploadCore({ headers: headersFor(bytes), body: streamOf(bytes), media: null, saveMedia: fakeSave().fn, makeLengthStream: fakeLengthStream([]) });
  refusal(noBucket, 503, "unavailable");
});

// ---- uploadCore: first bytes and the unique-key race (job 03.2-09b) --------------------------------------------------

test("hasSignature: JPEG FF D8 FF, PNG's eight bytes, WebP RIFF....WEBP; anything else or too short is false", () => {
  for (const [type, sig] of Object.entries(SIG)) {
    assert.equal(vm.hasSignature(signed(new Uint8Array(20), type), type), true, type);
    assert.equal(vm.hasSignature(new Uint8Array(sig.length - 1).map((_, i) => sig[i]), type), false, `${type} cut short`);
  }
  assert.equal(vm.hasSignature(signed(new Uint8Array(20), "image/png"), "image/webp"), false);
  assert.equal(vm.hasSignature(signed(new Uint8Array(20), "image/webp"), "image/jpeg"), false);
  const riffWave = signed(new Uint8Array(20), "image/webp");
  riffWave.set([0x57, 0x41, 0x56, 0x45], 8); // RIFF....WAVE: audio, not WebP
  assert.equal(vm.hasSignature(riffWave, "image/webp"), false);
  assert.equal(vm.SNIFF_BYTES, 12);
});

test("upload: a body that is not the declared image type is 415 wrong_type; nothing is put or saved (review finding 4)", async () => {
  const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>".padEnd(400, " "));
  const cases = [
    [html, "image/png"],
    [html, "image/jpeg"],
    [html, "image/webp"],
    [signed(new Uint8Array(400).fill(1), "image/png"), "image/webp"],
    [signed(new Uint8Array(400).fill(1), "image/jpeg"), "image/png"],
  ];
  for (const [bytes, type] of cases) {
    let cancelled = false;
    const inner = streamOf(bytes);
    const reader = inner.getReader();
    const body = new ReadableStream({
      async pull(c) {
        const { done, value } = await reader.read();
        if (done) c.close();
        else c.enqueue(value);
      },
      cancel() {
        cancelled = true;
      },
    });
    const r = await upload({ bytes, body, headers: headersFor(bytes, { "content-type": type }) });
    refusal(r.result, 415, "wrong_type");
    assert.equal(r.bucket.calls.put.length + r.save.calls.length, 0, type);
    assert.deepEqual(r.lengthCalls, [], "no length stream is made");
    assert.equal(cancelled, true, "the rest of the body is not read");
  }
});

test("upload: a body that errors within its first bytes is 400 content_length, not 503; nothing is put or saved", async () => {
  const bytes = signed(new Uint8Array(400).fill(4));
  let sent = false;
  const body = new ReadableStream({
    pull(c) {
      if (!sent) {
        sent = true;
        c.enqueue(bytes.slice(0, 5));
      } else c.error(new TypeError("connection reset"));
    },
  });
  const r = await upload({ bytes, body });
  refusal(r.result, 400, "invalid", "content_length");
  assert.equal(r.bucket.calls.put.length + r.save.calls.length, 0);
});

test("upload: the type check reads ahead only the first chunks, not the whole body", async () => {
  const bytes = signed(new Uint8Array(512 * 1024).map((_, i) => i % 199));
  let pulls = 0;
  let pullsAtPut = null;
  const inner = streamOf(bytes, 4096);
  const reader = inner.getReader();
  const body = new ReadableStream(
    {
      async pull(c) {
        pulls += 1;
        const { done, value } = await reader.read();
        if (done) c.close();
        else c.enqueue(value);
      },
    },
    { highWaterMark: 0 },
  );
  const bucket = fakeBucket();
  const put = bucket.put.bind(bucket);
  bucket.put = async (key, value, options) => {
    pullsAtPut = pulls;
    return put(key, value, options);
  };
  const r = await upload({ bytes, body, bucket });
  assert.equal(r.result.body.ok, true, JSON.stringify(r.result));
  assert.ok(pullsAtPut !== null && pullsAtPut <= 2, `chunks read before the put started: ${pullsAtPut} of ${bytes.length / 4096}`);
});

test("upload: the signature is found across 1-byte chunks and every byte still reaches R2 in order", async () => {
  const bytes = signed(new Uint8Array(3000).map((_, i) => (i * 13) % 256), "image/png");
  const r = await upload({ bytes, body: streamOf(bytes, 1), headers: headersFor(bytes, { "content-type": "image/png" }) });
  assert.equal(r.result.body.ok, true, JSON.stringify(r.result));
  const key = `uploads/${sha(bytes).slice(0, 32)}.png`;
  assert.ok(Buffer.from(r.bucket.objects.get(key)).equals(Buffer.from(bytes)));
});

test("upload: two uploads of one file at once: the second save's 23505 asks once more and returns the stored row (review finding 5)", async () => {
  const B = "22222222-2222-4222-8222-222222222222";
  const replies = [
    { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "media_upload_key_uidx"' } },
    { data: { id: B, created: false }, error: null },
  ];
  const calls = [];
  const save = { calls, fn: async (p) => { calls.push(p); return replies[calls.length - 1]; } };
  const r = await upload({ save });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1], "the same row is asked for");
  assert.equal(r.result.status ?? 200, 200);
  assert.equal(r.result.body.ok, true);
  assert.equal(r.result.body.id, B);
  assert.equal(r.result.body.created, false);
  // Still 23505 the second time: the wrapper maps it as before; no third call.
  const twice = [];
  const stuck = { calls: twice, fn: async (p) => { twice.push(p); return replies[0]; } };
  const again = await upload({ save: stuck });
  assert.equal(twice.length, 2);
  assert.equal(again.result.dbError.code, "23505");
  // Any other database error is not retried.
  const other = [];
  await upload({ save: { calls: other, fn: async (p) => { other.push(p); return { data: null, error: { code: "P0001", message: "almar:invalid" } }; } } });
  assert.equal(other.length, 1);
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

function lister(page, error = null) {
  const calls = [];
  return { calls, fn: async (query) => { calls.push(query); return { data: error ? null : page, error }; } };
}

async function list(page, query = "") {
  const l = lister(page);
  const out = await up.listMedia({ listPage: l.fn, url: new URL(`https://dashboard.almarprivatejourney.com/api/ops/media${query}`) });
  return { out, calls: l.calls };
}

test("list: ops_list_media's items become the contract items with url and alt_en; unknown columns are dropped", async () => {
  const { out } = await list({
    items: [
      row("stays/b/hero.webp", { id: "22222222-2222-4222-8222-222222222222", alt: { en: "Hero", ar: "بطل", es: "Héroe" }, alt_status: { en: "published", ar: "draft", es: "published" }, used_by: 3, secret: "x" }),
      row("uploads/aa.webp", { source: "upload", width: null, height: null, used_by: 0, alt_status: { en: "published", ar: "weird" } }),
    ],
    next: "uploads/aa.webp",
  });
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
    next: "uploads/aa.webp",
  });
});

test("list: the database gets q, after and limit (default 60) and does the search and paging; the Worker filters nothing (review finding 3)", async () => {
  const page = { items: [row("a/1.webp"), row("z/9.webp")], next: null };
  const plain = await list(page);
  assert.deepEqual(plain.calls, [{ q: null, limit: 60, after: null }]);
  assert.deepEqual(plain.out.body.items.map((i) => i.key), ["a/1.webp", "z/9.webp"], "rows kept as the database ordered and chose them");
  const asked = await list(page, "?q=%20Bogot%C3%A1%20&limit=5&after=a%2F1.webp");
  assert.deepEqual(asked.calls, [{ q: "Bogotá", limit: 5, after: "a/1.webp" }]);
  assert.equal(asked.out.body.items.length, 2, "no filtering in the Worker: 'Bogotá' matches neither key, both rows are kept");
  const empty = await list(page, "?q=");
  assert.deepEqual(empty.calls, [{ q: null, limit: 60, after: null }]);
});

test("list: a reply that is not a page is an empty list; next is a string only when there are items", async () => {
  for (const data of [null, [], [row("a/1.webp")], { items: "x" }, { items: [], next: "a/1.webp" }]) {
    const { out } = await list(data);
    assert.deepEqual(out.body, { ok: true, items: [], next: null }, JSON.stringify(data));
  }
  const { out } = await list({ items: [row("a/1.webp")], next: 7 });
  assert.equal(out.body.next, null);
});

test("list: a bad q, limit or after is 400 before the database is asked; a database error goes to the wrapper", async () => {
  for (const [query, field] of [["?limit=0", "limit"], ["?limit=61", "limit"], ["?limit=x", "limit"], ["?after=..%2Fx", "after"], ["?after=https%3A%2F%2Fx", "after"], [`?q=${"x".repeat(101)}`, "q"]]) {
    const l = lister({ items: [], next: null });
    await assert.rejects(up.listMedia({ listPage: l.fn, url: new URL(`https://d.example/api/ops/media${query}`) }), (e) => e.name === "OpsInvalid" && e.field === field);
    assert.equal(l.calls.length, 0, query);
  }
  const err = { code: "57014", message: "timeout" };
  const out = await up.listMedia({ listPage: lister(null, err).fn, url: new URL("https://d.example/api/ops/media") });
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
  // One page from the database, never the whole library (review finding 3).
  assert.match(src, /rpc\("ops_list_media", \{ p_q: q, p_after: after, p_limit: limit \}\)/);
  assert.equal(/rpc\("ops_list"/.test(src), false);
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
