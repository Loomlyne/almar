// Translate, plan 03.2-10 (contract §5.11). Pure: no binding, no Next, no network. The route
// (app/api/ops/translate/route.ts) binds `run` to Workers AI through lib/ops/translate-route.ts; node tests pass a fake.
//
// POST { target: "ar"|"es", fields: { <name>: string | string[] } } -> { ok, target, fields } (same keys, same list
// lengths, nothing empty) | 429 translate_limit | 502 translate_failed. Nothing is saved and no field text is logged.
//
// Model: the owner's pick after the Wave 0 check (2026-10-11, 03.2-10-NOTES.md): Gemma 4 26B. What really came back in
// that check (.planning/phases/03.2-real-catalog-and-team-inserted/translate-check/*-gemma-4-26b-*.json, 6 of 6 HTTP
// 200): `choices[0].message.content` is a STRING holding the JSON object (pretty-printed, no fence, no prose),
// `finish_reason: "stop"`, `usage.neurons` 3.6 to 7.3 per call, no reasoning text with `enable_thinking: false`.
// Request shape: developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/ (sync-input.json).

import { errorBody, OpsInvalid, type OpsResult } from "./route-core";
import { checkSameShape, schemaFor, systemPrompt, userMessage, type TranslateFields, type TranslateTarget } from "./translate-prompt";

export { checkSameShape };
export type { TranslateFields, TranslateTarget };

export const TRANSLATE_MODEL = "@cf/google/gemma-4-26b-a4b-it";

/** Caps on one request (T-3.2-10-02), on top of the 64 KiB body limit of every POST. */
export const TRANSLATE_LIMITS = { fields: 40, chars: 8000, items: 60 } as const;

/** One call to the model: `input` is the request body below; it resolves to the model's raw reply. */
export type AiRun = (input: unknown) => Promise<unknown>;

export type TranslateBody = { target: TranslateTarget; fields: TranslateFields };
export type TranslateOutcome = { ok: true; fields: TranslateFields } | { ok: false; code: "translate_limit" | "translate_failed" };

const FIELD_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The POST body. Throws OpsInvalid (400 invalid) on the first bad part. */
export function parseTranslate(body: unknown): TranslateBody {
  if (!isRecord(body)) throw new OpsInvalid("body");
  const target = body.target;
  if (target !== "ar" && target !== "es") throw new OpsInvalid("target");
  if (!isRecord(body.fields)) throw new OpsInvalid("fields");
  const entries = Object.entries(body.fields);
  if (entries.length === 0 || entries.length > TRANSLATE_LIMITS.fields) throw new OpsInvalid("fields");
  const fields: TranslateFields = {};
  for (const [name, value] of entries) {
    if (!FIELD_NAME.test(name)) throw new OpsInvalid("fields");
    const field = `fields.${name}`;
    if (typeof value === "string") {
      if (value.length > TRANSLATE_LIMITS.chars) throw new OpsInvalid(field);
      fields[name] = value;
    } else if (Array.isArray(value)) {
      if (value.length > TRANSLATE_LIMITS.items) throw new OpsInvalid(field);
      for (const item of value) {
        if (typeof item !== "string" || item.length > TRANSLATE_LIMITS.chars) throw new OpsInvalid(field);
      }
      fields[name] = value as string[];
    } else {
      throw new OpsInvalid(field);
    }
  }
  return { target, fields };
}

/** Null and empty values are not sent (they come back absent; the screen leaves them empty). */
export function withoutEmpty(fields: Record<string, string | string[] | null>): TranslateFields {
  const out: TranslateFields = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim() !== "") out[name] = value;
    // A list is sent only whole (every item has text): its length is the contract the answer must keep.
    else if (Array.isArray(value) && value.length > 0 && value.every((item) => item.trim() !== "")) out[name] = value;
  }
  return out;
}

/** The Gemma request: same prompt and schema as the Wave 0 check (scripts/translate-check/worker.ts). */
export function translateRequest(fields: TranslateFields, target: TranslateTarget) {
  return {
    messages: [
      { role: "system", content: systemPrompt(target) },
      { role: "user", content: userMessage(fields) },
    ],
    // About one token per English character plus slack (the check: 883 allowed, 164 used for the longest text).
    max_completion_tokens: Math.min(8192, JSON.stringify(fields).length + 512),
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: { name: "translation", schema: schemaFor(fields), strict: true } },
    // On by default for Gemma 4; off, so no reasoning text is produced (the check saw none with this setting).
    chat_template_kwargs: { enable_thinking: false },
  };
}

/** Reasoning or channel markers some models print before the answer. Seeing one means the reply is not clean. */
const THINKING = /<\/?think|<\|[^|>]*\|>|^\s*(?:thinking|thought|reasoning)\b/im;

/** Each top-level {...} in `text`, braces inside JSON strings ignored. */
function topLevelObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"' && depth > 0) inString = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) found.push(text.slice(start, i + 1));
    }
  }
  return found;
}

/**
 * The JSON object of a reply, or null. Clean JSON (what the check returned) is read as is. A reply wrapped in a code
 * fence or in prose is read only when it holds exactly one JSON object and no reasoning text.
 */
export function parseAnswer(raw: unknown): unknown {
  const reply = raw as { choices?: { message?: { content?: unknown } }[]; response?: unknown } | null;
  const content = reply?.choices?.[0]?.message?.content ?? reply?.response ?? null;
  if (isRecord(content)) return content;
  if (typeof content !== "string") return null;
  const text = content.trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall through: not bare JSON
  }
  if (THINKING.test(text)) return null;
  const objects = topLevelObjects(text);
  if (objects.length !== 1) return null;
  try {
    return JSON.parse(objects[0]);
  } catch {
    return null;
  }
}

/**
 * What the Workers AI binding threw: the daily limit or anything else. The Wave 0 check made 18 calls and none
 * failed, so the real limit error shape was NOT seen [unverified]: the match is on status or code 429, or a message
 * about the daily allocation (daily / neuron, neurons). Cloudflare's pricing page: on Free, past 10,000 neurons a day
 * the allocation stops until 00:00 UTC. A bare "limit" (a per-minute rate limit, a context or token limit) is not the
 * daily limit: it is "failed", so the owner is told to try again, not to wait until tomorrow.
 */
export function classifyAiError(error: unknown): "limit" | "failed" {
  const e = (isRecord(error) || error instanceof Error ? error : {}) as { status?: unknown; code?: unknown; message?: unknown };
  if (e.status === 429 || e.code === 429) return "limit";
  const message = typeof e.message === "string" ? e.message : typeof error === "string" ? error : "";
  return /daily|neurons?/i.test(message) ? "limit" : "failed";
}

/** One target: skip empties, one model call, parse, same-shape check. Never throws. */
export async function translateFields(run: AiRun, fields: Record<string, string | string[] | null>, target: TranslateTarget): Promise<TranslateOutcome> {
  const sent = withoutEmpty(fields);
  if (Object.keys(sent).length === 0) return { ok: true, fields: {} };
  let raw: unknown;
  try {
    raw = await run(translateRequest(sent, target));
  } catch (error) {
    return { ok: false, code: classifyAiError(error) === "limit" ? "translate_limit" : "translate_failed" };
  }
  const shape = checkSameShape(sent, parseAnswer(raw));
  return shape.ok ? { ok: true, fields: shape.fields } : { ok: false, code: "translate_failed" };
}

/** The route handler over a `run`: 200 with the drafts, 429 translate_limit, 502 translate_failed. Logs nothing. */
export function translateHandler(getRun: () => AiRun) {
  return async ({ body }: { body: TranslateBody }): Promise<OpsResult> => {
    const outcome = await translateFields(getRun(), body.fields, body.target);
    if (outcome.ok) return { body: { ok: true, target: body.target, fields: outcome.fields } };
    return { status: outcome.code === "translate_limit" ? 429 : 502, body: errorBody(outcome.code) };
  };
}
