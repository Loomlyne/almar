// Plan 03.2-10 Task 2: the Translate route's pure parts, with a fake `run` only. No test reaches Workers AI or any
// binding (lib/ops/translate-route.ts, the one file that touches the AI binding, is read as text here, never loaded).
// The button's behaviour against 200 / 502 / 429 fixtures is tests/ops-translate.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const t = await loadTs("lib/ops/translate.ts");
const prompt = await loadTs("lib/ops/translate-prompt.ts");
const { runOps } = await loadTs("lib/ops/route-core.ts");
const { OPS_TRANSLATE_COPY } = await loadTs("lib/copy/ops-translate.ts");

const SOURCE = { name: "Casa Ébano", summary: "A quiet house above Cartagena.", amenities: ["Pool", "Chef"] };
const AR = { name: "كاسا إيبانو", summary: "منزل هادئ فوق قرطاجنة.", amenities: ["مسبح", "طاهٍ"] };

/** What Gemma 4 returned in the Wave 0 check: the JSON object as a pretty-printed string in choices[0].message.content. */
function gemmaReply(content) {
  return { id: "chatcmpl-x", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { neurons: 7.3 } };
}

function fakeRun(reply) {
  const calls = [];
  const run = async (input) => {
    calls.push(input);
    if (reply instanceof Error) throw reply;
    return typeof reply === "function" ? reply(input) : reply;
  };
  return { run, calls };
}

// ---- checkSameShape ------------------------------------------------------------------------------------------------

test("checkSameShape is re-exported from translate-prompt (one function, not a copy)", () => {
  assert.equal(typeof t.checkSameShape, "function");
  assert.match(readFileSync("lib/ops/translate.ts", "utf8"), /export \{ checkSameShape \};/);
  assert.match(readFileSync("lib/ops/translate.ts", "utf8"), /import \{ checkSameShape,[^}]*\} from "\.\/translate-prompt";/);
});

test("checkSameShape: same keys and list lengths ok; each break gives its reason", () => {
  const src = { a: "x", b: ["1", "2"] };
  assert.deepEqual(t.checkSameShape(src, { a: "y", b: ["1", "2"] }), { ok: true, fields: { a: "y", b: ["1", "2"] } });
  const cases = [
    [{ b: ["1", "2"] }, /missing/i],
    [{ a: "y", b: ["1", "2"], c: "z" }, /extra|unexpected/i],
    [{ a: "y", b: ["1"] }, /length|items/i],
    [{ a: "", b: ["1", "2"] }, /empty/i],
    [{ a: "y", b: ["1", 2] }, /string|text/i],
  ];
  for (const [output, reason] of cases) {
    const r = t.checkSameShape(src, output);
    assert.equal(r.ok, false, JSON.stringify(output));
    assert.match(r.reason, reason, `${JSON.stringify(output)} -> ${r.reason}`);
  }
  assert.equal(t.checkSameShape(src, null).ok, false);
  assert.equal(t.checkSameShape(src, ["x"]).ok, false);
});

// ---- the request ---------------------------------------------------------------------------------------------------

test("the request: Gemma 4 26B, prompt and schema from translate-prompt, thinking off, size-bound output", () => {
  assert.equal(t.TRANSLATE_MODEL, "@cf/google/gemma-4-26b-a4b-it");
  const req = t.translateRequest(SOURCE, "es");
  assert.deepEqual(Object.keys(req).sort(), ["chat_template_kwargs", "max_completion_tokens", "messages", "response_format", "temperature"]);
  assert.deepEqual(req.messages, [
    { role: "system", content: prompt.systemPrompt("es") },
    { role: "user", content: prompt.userMessage(SOURCE) },
  ]);
  assert.equal(req.temperature, 0.2);
  assert.deepEqual(req.chat_template_kwargs, { enable_thinking: false });
  assert.deepEqual(req.response_format, { type: "json_schema", json_schema: { name: "translation", schema: prompt.schemaFor(SOURCE), strict: true } });
  assert.equal(req.max_completion_tokens, JSON.stringify(SOURCE).length + 512);
  const big = { a: "x".repeat(8000), b: "y".repeat(8000) };
  assert.equal(t.translateRequest(big, "ar").max_completion_tokens, 8192);
});

test("the Spanish register is the owner's: Latin American, Colombian, formal usted; the assumption note is gone", () => {
  const src = readFileSync("lib/ops/translate-prompt.ts", "utf8");
  assert.match(prompt.systemPrompt("es"), /Latin American Spanish, Colombian usage, formal usted/);
  assert.equal(src.includes("[ASSUMED A10]"), false);
  assert.match(prompt.systemPrompt("ar"), /Modern Standard Arabic/);
});

// ---- translateFields with a fake run --------------------------------------------------------------------------------

test("valid JSON text (the shape the check returned) gives the fields; one run call per target", async () => {
  const { run, calls } = fakeRun(gemmaReply(JSON.stringify(AR, null, 2)));
  assert.deepEqual(await t.translateFields(run, SOURCE, "ar"), { ok: true, fields: AR });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], t.translateRequest(SOURCE, "ar"));
});

test("null and empty values are not sent and come back absent; nothing to send means no call", async () => {
  const { run, calls } = fakeRun(gemmaReply(JSON.stringify({ name: AR.name })));
  const r = await t.translateFields(run, { name: SOURCE.name, summary: "", note: null, blank: "   ", tags: [], gaps: ["a", " "] }, "ar");
  assert.deepEqual(r, { ok: true, fields: { name: AR.name } });
  assert.deepEqual(JSON.parse(calls[0].messages[1].content), { name: SOURCE.name });
  const none = fakeRun(gemmaReply("{}"));
  assert.deepEqual(await t.translateFields(none.run, { a: "", b: null }, "es"), { ok: true, fields: {} });
  assert.equal(none.calls.length, 0);
});

test("a code fence or prose around exactly one JSON object is read", async () => {
  const fenced = "```json\n" + JSON.stringify(AR) + "\n```";
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(fenced)).run, SOURCE, "ar"), { ok: true, fields: AR });
  const prose = `Here is the translation:\n${JSON.stringify(AR)}\nI kept the names.`;
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(prose)).run, SOURCE, "ar"), { ok: true, fields: AR });
  // Braces inside a value do not count as a second object.
  const braces = { ...AR, summary: "منزل {هادئ}" };
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(`Result: ${JSON.stringify(braces)}`)).run, SOURCE, "ar"), { ok: true, fields: braces });
  // The binding may hand back the object itself.
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(AR)).run, SOURCE, "ar"), { ok: true, fields: AR });
});

test("two JSON objects, no JSON, or visible thinking text -> translate_failed", async () => {
  const failed = { ok: false, code: "translate_failed" };
  const two = `${JSON.stringify(AR)}\n${JSON.stringify(AR)}`;
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(two)).run, SOURCE, "ar"), failed);
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply("I cannot translate this.")).run, SOURCE, "ar"), failed);
  for (const thinking of [`<think>The user wants Arabic.</think>\n${JSON.stringify(AR)}`, `Thinking: first the name.\n${JSON.stringify(AR)}`, `<|channel|>analysis ${JSON.stringify(AR)}`]) {
    assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(thinking)).run, SOURCE, "ar"), failed, thinking.slice(0, 20));
  }
  assert.deepEqual(await t.translateFields(fakeRun(gemmaReply("")).run, SOURCE, "ar"), failed);
  assert.deepEqual(await t.translateFields(fakeRun({ unexpected: true }).run, SOURCE, "ar"), failed);
  assert.deepEqual(await t.translateFields(fakeRun(null).run, SOURCE, "ar"), failed);
});

test("a well-formed answer of the wrong shape -> translate_failed", async () => {
  const failed = { ok: false, code: "translate_failed" };
  for (const bad of [{ name: AR.name, summary: AR.summary }, { ...AR, amenities: ["مسبح"] }, { ...AR, name: "" }, { ...AR, extra: "x" }]) {
    assert.deepEqual(await t.translateFields(fakeRun(gemmaReply(JSON.stringify(bad))).run, SOURCE, "ar"), failed);
  }
});

// ---- classifyAiError -----------------------------------------------------------------------------------------------

test("classifyAiError: status 429 or a neuron/daily/limit message -> limit; everything else -> failed", () => {
  const status = Object.assign(new Error("Too Many Requests"), { status: 429 });
  assert.equal(t.classifyAiError(status), "limit");
  assert.equal(t.classifyAiError({ status: 429 }), "limit");
  assert.equal(t.classifyAiError(new Error("AiError: you have used up your daily free allocation of 10,000 neurons")), "limit");
  assert.equal(t.classifyAiError(new Error("Rate LIMIT exceeded")), "limit");
  assert.equal(t.classifyAiError("daily cap"), "limit");
  for (const other of [new Error("InferenceUpstreamError: 500"), Object.assign(new Error("bad"), { status: 500 }), new Error("binding missing"), null, undefined, 42]) {
    assert.equal(t.classifyAiError(other), "failed", String(other));
  }
});

test("a run that throws: the limit -> translate_limit, anything else -> translate_failed", async () => {
  const limit = await t.translateFields(fakeRun(new Error("4006: you have used up your daily free allocation of 10,000 neurons")).run, SOURCE, "es");
  assert.deepEqual(limit, { ok: false, code: "translate_limit" });
  const other = await t.translateFields(fakeRun(new Error("network connection lost")).run, SOURCE, "es");
  assert.deepEqual(other, { ok: false, code: "translate_failed" });
});

// ---- parse ---------------------------------------------------------------------------------------------------------

function rejects(body, field) {
  assert.throws(
    () => t.parseTranslate(body),
    (error) => error.name === "OpsInvalid" && error.field === field,
    JSON.stringify(body).slice(0, 80),
  );
}

test("parse accepts ar and es with strings and lists", () => {
  assert.deepEqual(t.parseTranslate({ target: "ar", fields: SOURCE }), { target: "ar", fields: SOURCE });
  assert.deepEqual(t.parseTranslate({ target: "es", fields: { a: "" } }), { target: "es", fields: { a: "" } });
});

test("parse rejects: target other than ar/es, empty fields, more than 40 fields, over 8,000 chars, over 60 items", () => {
  for (const target of ["en", "fr", "", null, undefined, 1]) rejects({ target, fields: SOURCE }, "target");
  rejects(null, "body");
  rejects([], "body");
  rejects({ target: "ar" }, "fields");
  rejects({ target: "ar", fields: [] }, "fields");
  rejects({ target: "ar", fields: {} }, "fields");
  const many = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`f${i}`, "x"]));
  rejects({ target: "ar", fields: many }, "fields");
  const forty = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}`, "x"]));
  assert.equal(Object.keys(t.parseTranslate({ target: "ar", fields: forty }).fields).length, 40);
  rejects({ target: "ar", fields: { summary: "x".repeat(8001) } }, "fields.summary");
  assert.equal(t.parseTranslate({ target: "ar", fields: { summary: "x".repeat(8000) } }).fields.summary.length, 8000);
  rejects({ target: "ar", fields: { tags: Array.from({ length: 61 }, () => "x") } }, "fields.tags");
  rejects({ target: "ar", fields: { tags: ["x".repeat(8001)] } }, "fields.tags");
  rejects({ target: "ar", fields: { tags: ["x", 2] } }, "fields.tags");
  rejects({ target: "ar", fields: { n: 1 } }, "fields.n");
  rejects({ target: "ar", fields: { n: { x: "y" } } }, "fields.n");
  rejects({ target: "ar", fields: JSON.parse('{"__proto__": "x"}') }, "fields");
  rejects({ target: "ar", fields: { "Bad Name": "x" } }, "fields");
});

// ---- the route, end to end with a fake run --------------------------------------------------------------------------

const OPS = "https://dashboard.almarprivatejourney.com";
const OWNER = { ok: true, owner: { profile: { id: "00000000-0000-4000-8000-000000000001" }, admin: {} } };

function post(body) {
  return new Request(`${OPS}/api/ops/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: OPS, host: "dashboard.almarprivatejourney.com" },
    body: JSON.stringify(body),
  });
}

async function call(body, run, decide = async () => OWNER) {
  const res = await runOps({ method: "POST", request: post(body), decide, parse: t.parseTranslate, handler: t.translateHandler(() => run), nodeEnv: "production" });
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

test("route: 200 with the drafts, 429 translate_limit, 502 translate_failed, 400 invalid, all no-store", async () => {
  const ok = await call({ target: "ar", fields: SOURCE }, fakeRun(gemmaReply(JSON.stringify(AR))).run);
  assert.deepEqual(ok, { status: 200, body: { ok: true, target: "ar", fields: AR }, cache: "no-store" });

  const limit = await call({ target: "es", fields: SOURCE }, fakeRun(Object.assign(new Error("x"), { status: 429 })).run);
  assert.deepEqual(limit, { status: 429, body: { ok: false, error: { code: "translate_limit", field: null, locale: null, detail: null } }, cache: "no-store" });

  const failed = await call({ target: "es", fields: SOURCE }, fakeRun(gemmaReply("not json")).run);
  assert.deepEqual(failed, { status: 502, body: { ok: false, error: { code: "translate_failed", field: null, locale: null, detail: null } }, cache: "no-store" });

  const { run, calls } = fakeRun(gemmaReply("{}"));
  const invalid = await call({ target: "fr", fields: SOURCE }, run);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "invalid");
  assert.equal(invalid.body.error.field, "target");
  assert.equal(calls.length, 0, "an invalid body never reaches the model");
});

test("route: a non-owner gets 403 and the model is never called", async () => {
  const { run, calls } = fakeRun(gemmaReply(JSON.stringify(AR)));
  const res = await call({ target: "ar", fields: SOURCE }, run, async () => ({ ok: false, status: 403, code: "not_owner" }));
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test("the error body never echoes field text or the model's reply", async () => {
  const secret = "PRIVATE-OWNER-TEXT";
  const res = await call({ target: "ar", fields: { name: secret } }, fakeRun(gemmaReply(`${secret} ${secret}`)).run);
  assert.equal(res.status, 502);
  assert.equal(JSON.stringify(res.body).includes(secret), false);
});

// ---- source guards -------------------------------------------------------------------------------------------------

test("route source: POST built with opsPost, dynamic force-dynamic, no logging", () => {
  const route = readFileSync("app/api/ops/translate/route.ts", "utf8");
  assert.match(route, /^export const dynamic = "force-dynamic";$/m);
  assert.match(route, /^export const POST = opsPost\(parseTranslate, postTranslate\);$/m);
  for (const file of ["app/api/ops/translate/route.ts", "lib/ops/translate.ts", "lib/ops/translate-route.ts", "lib/ops/translate-prompt.ts"]) {
    assert.equal(/console\./.test(readFileSync(file, "utf8")), false, `${file}: never logs (field text stays out of logs)`);
  }
});

test("the binding is reached in one file only, with the owner's model", () => {
  const bound = readFileSync("lib/ops/translate-route.ts", "utf8");
  assert.match(bound, /import \{ getCloudflareContext \} from "@opennextjs\/cloudflare";/);
  assert.match(bound, /ai\.run\(TRANSLATE_MODEL, input\)/);
  assert.equal(/getCloudflareContext|\.AI\b/.test(readFileSync("lib/ops/translate.ts", "utf8").replace(/^\/\/.*$/gm, "")), false, "translate.ts stays pure");
});

test("translate-button.tsx: no fetch(, imports opsSend from ./ops-client, Promise.allSettled, a polite status line", () => {
  const src = readFileSync("components/ops/translate-button.tsx", "utf8");
  assert.equal(src.includes("fetch("), false);
  assert.match(src, /import \{ opsSend[^}]*\} from "\.\/ops-client";/);
  assert.match(src, /Promise\.allSettled\(/);
  assert.match(src, /opsSend<[^>]+>\("\/api\/ops\/translate", \{ target, fields \}\)/);
  assert.match(src, /role="status" aria-live="polite"/);
});

// ---- copy ----------------------------------------------------------------------------------------------------------

test("OPS_TRANSLATE_COPY: the same keys in en, ar, es; none empty", () => {
  const keys = Object.keys(OPS_TRANSLATE_COPY.en).sort();
  assert.ok(keys.length >= 11);
  for (const locale of ["en", "ar", "es"]) {
    assert.deepEqual(Object.keys(OPS_TRANSLATE_COPY[locale]).sort(), keys, locale);
    for (const key of keys) assert.ok(OPS_TRANSLATE_COPY[locale][key].trim().length > 0, `${locale}.${key}`);
  }
});

test("ES copy speaks usted (owner, 2026-10-11), never tú", () => {
  const es = Object.values(OPS_TRANSLATE_COPY.es).join(" ");
  for (const tu of [/\bRevísalos\b/, /\bescríbelo\b/i, /\bescríbela\b/i, /\binténtalo\b/i, /\bEscribe\b/]) assert.equal(tu.test(es), false, String(tu));
  for (const usted of [/Revíselos/, /escríbalo/, /escríbala/i, /inténtelo/, /Escriba primero/]) assert.match(es, usted);
});
