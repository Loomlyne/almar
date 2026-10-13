// Wave 0 model check Worker, plan 03.2-10. Run ONLY by the ALMAR controller, with the ALMAR login, through
// `HOME=/Users/koss/.almar-cloudflare npx wrangler dev --config scripts/translate-check/wrangler.toml --port <n>`;
// never deployed (workers_dev = false, no routes). Every call bills the ALMAR account, even in local dev.
// Work sessions and tests never run this file.
//
// POST /run { model, target, fields } -> { model, target, request, raw, parsed, extra_text, shape, usage, ms }
// It uses the same prompt, schema and shape check as the production route (lib/ops/translate-prompt.ts).
//
// Request shapes, read from Cloudflare's docs on 2026-10-11 (not guessed):
// - Gemma 4 26B: https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/ and its raw schemas
//   .../gemma-4-26b-a4b-it/sync-input.json, sync-output.json. OpenAI-style input: `messages`, `max_completion_tokens`,
//   `temperature`, `response_format: { type: "json_schema", json_schema: { name, schema, strict } }`,
//   `chat_template_kwargs: { enable_thinking }` (defaults to true: turned off here so no reasoning text is produced).
//   Output: `choices[0].message.content` (string or null) and `usage { prompt_tokens, completion_tokens }`.
// - Llama 3.3 70B fp8-fast: https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
//   (sync-input.json, sync-output.json) and JSON Mode https://developers.cloudflare.com/workers-ai/features/json-mode/.
//   Input: `messages`, `max_tokens` (default 256, so it is set), `temperature`,
//   `response_format: { type: "json_schema", json_schema: <the JSON schema itself> }`.
//   Output: `response` (the JSON-mode example shows an object; a string is also handled) and `usage`.
// - m2m100 1.2B: https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/ (sync-input.json). Input: `text`
//   (one string), `source_lang`, `target_lang`. The parameter text says language codes ("en", "es") while the page's
//   example uses names ("english", "french"); names are used here as the plan says [unverified which one the model
//   prefers: the check output shows it]. Output `translated_text` (from the `cloudflare` npm SDK types,
//   node_modules/cloudflare/resources/ai/ai.d.ts; the page's raw sync-output.json only shows the async shape).

import { checkSameShape, schemaFor, systemPrompt, userMessage, type TranslateFields, type TranslateTarget } from "../../lib/ops/translate-prompt";

interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
}

export const MODELS = {
  gemma: "@cf/google/gemma-4-26b-a4b-it",
  llama: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  m2m100: "@cf/meta/m2m100-1.2b",
} as const;
const KNOWN = new Set<string>(Object.values(MODELS));

const M2M_LANG: Record<TranslateTarget, string> = { ar: "arabic", es: "spanish" };

/** Room for the answer: Arabic takes more tokens than English, so about one token per English character, plus slack. */
function outputBudget(fields: TranslateFields): number {
  const chars = JSON.stringify(fields).length;
  return Math.min(8192, chars + 512);
}

function chatRequest(model: string, target: TranslateTarget, fields: TranslateFields) {
  const messages = [
    { role: "system", content: systemPrompt(target) },
    { role: "user", content: userMessage(fields) },
  ];
  const schema = schemaFor(fields);
  if (model === MODELS.gemma) {
    return {
      messages,
      max_completion_tokens: outputBudget(fields),
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "translation", schema, strict: true } },
      chat_template_kwargs: { enable_thinking: false },
    };
  }
  return {
    messages,
    max_tokens: outputBudget(fields),
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: schema },
  };
}

type Parsed = { value: unknown; extraText: boolean };

/** The JSON object in a chat answer: the object itself, or a string holding exactly one JSON object. */
function parseAnswer(content: unknown): Parsed {
  if (content !== null && typeof content === "object") return { value: content, extraText: false };
  if (typeof content !== "string") return { value: null, extraText: false };
  const text = content.trim();
  try {
    return { value: JSON.parse(text), extraText: false };
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return { value: null, extraText: true };
    try {
      return { value: JSON.parse(text.slice(start, end + 1)), extraText: true };
    } catch {
      return { value: null, extraText: true };
    }
  }
}

function chatContent(model: string, raw: unknown): unknown {
  const answer = raw as { choices?: { message?: { content?: unknown } }[]; response?: unknown } | null;
  if (model === MODELS.gemma) return answer?.choices?.[0]?.message?.content ?? null;
  return answer?.response ?? null;
}

async function runChat(env: Env, model: string, target: TranslateTarget, fields: TranslateFields) {
  const request = chatRequest(model, target, fields);
  const raw = await env.AI.run(model, request);
  const parsed = parseAnswer(chatContent(model, raw));
  const usage = (raw as { usage?: unknown } | null)?.usage ?? null;
  return { request, raw, parsed: parsed.value, extra_text: parsed.extraText, usage };
}

/** m2m100 takes one string per call: lists go item by item. */
async function runM2m(env: Env, target: TranslateTarget, fields: TranslateFields) {
  const raws: unknown[] = [];
  const one = async (text: string) => {
    const raw = await env.AI.run(MODELS.m2m100, { text, source_lang: "english", target_lang: M2M_LANG[target] });
    raws.push(raw);
    return (raw as { translated_text?: unknown } | null)?.translated_text ?? null;
  };
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    parsed[key] = Array.isArray(value) ? await Promise.all(value.map(one)) : await one(value);
  }
  const request = { per_string: { source_lang: "english", target_lang: M2M_LANG[target] } };
  return { request, raw: raws, parsed, extra_text: false, usage: null };
}

function isFields(value: unknown): value is TranslateFields {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string" || (Array.isArray(v) && v.every((i) => typeof i === "string")));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/run") return Response.json({ error: "POST /run only" }, { status: 404 });
    const body = (await request.json().catch(() => null)) as { model?: unknown; target?: unknown; fields?: unknown } | null;
    const model = typeof body?.model === "string" ? body.model : "";
    const target = body?.target;
    if (!KNOWN.has(model) || (target !== "ar" && target !== "es") || !isFields(body?.fields)) {
      return Response.json({ error: "body must be { model: one of the 3 check models, target: ar|es, fields }" }, { status: 400 });
    }
    const fields = body.fields;
    const started = Date.now();
    try {
      const out = model === MODELS.m2m100 ? await runM2m(env, target, fields) : await runChat(env, model, target, fields);
      const shape = checkSameShape(fields, out.parsed, target);
      return Response.json({ model, target, ...out, shape, ms: Date.now() - started });
    } catch (error) {
      // The error as the binding throws it: the check records its shape for classifyAiError (Task 2).
      const e = error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown };
      return Response.json(
        { model, target, error: { name: String(e?.name ?? ""), message: String(e?.message ?? error), status: e?.status ?? null, code: e?.code ?? null }, ms: Date.now() - started },
        { status: 502 },
      );
    }
  },
};
