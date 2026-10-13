// Translate, plan 03.2-10 (contract §5.11). Pure: no binding, no Next, no network. The route
// (app/api/ops/translate/route.ts) binds `run` to Workers AI through lib/ops/translate-route.ts; node tests pass a fake.
//
// POST { target: "ar"|"es", fields: { <name>: string | string[] } } -> { ok, target, fields } (same keys, same list
// lengths, nothing empty) | 429 translate_limit (daily) | 503 translate_busy (rate or capacity) | 502 translate_failed | 502 translate_too_long (cut off at the token budget). Nothing is saved and no field text is logged.
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

/** The model's output budget in tokens: Gemma's `max_completion_tokens` for one call. */
const OUTPUT_TOKENS = 8192;
/** Slack added to the English length when sizing the output (the JSON wrapper, keys, quotes). */
const OUTPUT_SLACK = 512;

/**
 * Caps on one request (T-3.2-10-02), on top of the 64 KiB body limit of every POST. `json` is the longest JSON the model
 * is sent: at about one output token per English character (the Wave 0 check used a fifth of that) the answer then always
 * fits in OUTPUT_TOKENS, so a long request is refused (400 invalid) instead of being cut off mid-JSON after the neurons
 * are spent (03.2-10b). A longer text is translated field by field in separate requests.
 */
export const TRANSLATE_LIMITS = { fields: 40, chars: 8000, items: 60, json: OUTPUT_TOKENS - OUTPUT_SLACK } as const;

/** One call to the model: `input` is the request body below; it resolves to the model's raw reply. */
export type AiRun = (input: unknown) => Promise<unknown>;

/**
 * The POST body. Field names are lowercase snake_case (`/^[a-z][a-z0-9_]{0,63}$/`, e.g. `short_line`): the 06/07/08
 * screens send their column names as they are; anything else is 400 invalid. A value is a string, a list of strings,
 * or null (null and empty values are skipped and come back absent).
 */
export type TranslateBody = { target: TranslateTarget; fields: Record<string, string | string[] | null> };
export type TranslateOutcome =
  | { ok: true; fields: TranslateFields }
  | { ok: false; code: "translate_limit" | "translate_busy" | "translate_failed" | "translate_too_long" };

const FIELD_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The POST body. Throws OpsInvalid (400 invalid) on the first bad part, and when no field has text. */
export function parseTranslate(body: unknown): TranslateBody {
  if (!isRecord(body)) throw new OpsInvalid("body");
  const target = body.target;
  if (target !== "ar" && target !== "es") throw new OpsInvalid("target");
  if (!isRecord(body.fields)) throw new OpsInvalid("fields");
  const entries = Object.entries(body.fields);
  if (entries.length === 0 || entries.length > TRANSLATE_LIMITS.fields) throw new OpsInvalid("fields");
  const fields: TranslateBody["fields"] = {};
  for (const [name, value] of entries) {
    if (!FIELD_NAME.test(name)) throw new OpsInvalid("fields");
    const field = `fields.${name}`;
    if (value === null) {
      fields[name] = null;
    } else if (typeof value === "string") {
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
  // Every value null or empty: nothing to translate, the same answer as an empty fields object.
  const sent = withoutEmpty(fields);
  if (Object.keys(sent).length === 0) throw new OpsInvalid("fields");
  // What is sent must leave room for the answer (TRANSLATE_LIMITS.json).
  if (JSON.stringify(sent).length > TRANSLATE_LIMITS.json) throw new OpsInvalid("fields");
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
    // About one token per English character plus slack (the check: 883 allowed, 164 used for the longest text). parseTranslate
    // keeps the JSON under TRANSLATE_LIMITS.json, so the minimum never cuts the answer short.
    max_completion_tokens: Math.min(OUTPUT_TOKENS, JSON.stringify(fields).length + OUTPUT_SLACK),
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
 * What the Workers AI binding threw: the daily limit, a busy answer, or anything else. Cloudflare's error table
 * (developers.cloudflare.com/workers-ai/platform/errors/, read 2026-10-13): "Account limited", code 3036, HTTP 429, "You
 * have used up your daily free allocation of 10,000 neurons" (the allocation stops until 00:00 UTC); and "Out of
 * capacity", code 3040, ALSO HTTP 429, "try again". Only the first is the daily limit. The review of 03.2-10 named 4006,
 * which the current table does not list; it is matched too, in case a binding still reports it.
 *  - "limit": code 3036 or 4006 (as `code`, `status`, or a four-digit number in the message), or a message about the daily
 *    allocation (daily / neuron, neurons). Nothing else: the owner is told to stop until tomorrow.
 *  - "busy": any other 429 (a per-minute rate limit), code 3040, or a message about capacity, rate limit or too many
 *    requests: the owner is told to try again in a minute.
 *  - "failed": everything else, including a bare context or token "limit".
 * [unverified against a live limit or rate response: nothing here may spend the live allocation to force one.]
 */
export function classifyAiError(error: unknown): "limit" | "busy" | "failed" {
  const e = (isRecord(error) || error instanceof Error ? error : {}) as { status?: unknown; code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : typeof error === "string" ? error : "";
  const codes = [e.code, e.status, ...(message.match(/\b\d{4}\b/g) ?? [])].map((c) => String(c));
  if (codes.includes("3036") || codes.includes("4006") || /daily|neurons?/i.test(message)) return "limit";
  if (e.status === 429 || e.code === 429 || codes.includes("3040") || /capacity|rate[\s-]?limit|too many requests/i.test(message)) return "busy";
  return "failed";
}

/** Why the model stopped, when the reply says: "length" means the answer was cut off at the token budget. */
function finishReason(raw: unknown): unknown {
  return (raw as { choices?: { finish_reason?: unknown }[] } | null)?.choices?.[0]?.finish_reason;
}

/**
 * The longest the server waits for one model call. The browser gives up at 45 s (TRANSLATE_TIMEOUT_MS in the button); the
 * server stops waiting a little sooner, so its answer is a clean 502 and not a reply nobody reads.
 */
export const TRANSLATE_DEADLINE_MS = 40_000;

/**
 * `work`, or a rejection when `ms` pass or `signal` aborts first. The Workers AI binding takes no abort signal (its
 * documented options are gateway, rejectIfBusy and the like), so this only stops WAITING: the model call itself keeps
 * running and its neurons are still spent. The timer and the listener are always cleared.
 */
export function raceDeadline<T>(work: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => done(() => reject(new Error("aborted")));
    const done = (settle: () => void) => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      settle();
    };
    if (signal?.aborted) return reject(new Error("aborted"));
    timer = setTimeout(() => done(() => reject(new Error("deadline"))), ms);
    signal?.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => done(() => resolve(value)),
      (error) => done(() => reject(error)),
    );
  });
}

/** One target: skip empties, one model call, parse, same-shape check. Never throws. */
export async function translateFields(
  run: AiRun,
  fields: Record<string, string | string[] | null>,
  target: TranslateTarget,
  options: { signal?: AbortSignal; deadlineMs?: number } = {},
): Promise<TranslateOutcome> {
  const sent = withoutEmpty(fields);
  if (Object.keys(sent).length === 0) return { ok: true, fields: {} };
  // The browser already gave up: nothing to wait for, and no neurons to spend.
  if (options.signal?.aborted) return { ok: false, code: "translate_failed" };
  let raw: unknown;
  try {
    raw = await raceDeadline(Promise.resolve().then(() => run(translateRequest(sent, target))), options.deadlineMs ?? TRANSLATE_DEADLINE_MS, options.signal);
  } catch (error) {
    const kind = classifyAiError(error);
    return { ok: false, code: kind === "limit" ? "translate_limit" : kind === "busy" ? "translate_busy" : "translate_failed" };
  }
  // A reply cut off at the token budget is its own failure, never read as a (possibly shortened) answer.
  if (finishReason(raw) === "length") return { ok: false, code: "translate_too_long" };
  const shape = checkSameShape(sent, parseAnswer(raw), target);
  return shape.ok ? { ok: true, fields: shape.fields } : { ok: false, code: "translate_failed" };
}

/**
 * The route handler over a `run`: 200 with the drafts, 429 translate_limit (the daily allocation), 503 translate_busy (a
 * rate or capacity answer: try again in a minute), 502 translate_failed or translate_too_long. Logs nothing. The request's
 * own signal (the browser gave up) and TRANSLATE_DEADLINE_MS end the wait for the model.
 */
export function translateHandler(getRun: () => AiRun) {
  return async ({ body, request }: { body: TranslateBody; request?: Request }): Promise<OpsResult> => {
    const outcome = await translateFields(getRun(), body.fields, body.target, { signal: request?.signal });
    if (outcome.ok) return { body: { ok: true, target: body.target, fields: outcome.fields } };
    const status = outcome.code === "translate_limit" ? 429 : outcome.code === "translate_busy" ? 503 : 502;
    return { status, body: errorBody(outcome.code) };
  };
}
