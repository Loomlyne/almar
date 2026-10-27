// Plan 06-03: a long blog post has more text than one /api/ops/translate call takes (TRANSLATE_LIMITS: 40 fields, the
// JSON the model is sent). chunkedSend wraps the editor's `send` so the kit's one call per language becomes several calls
// in order, each within the limits, and their answers are merged into one reply the kit already understands.
// A body that fits is sent exactly once, as before.

import type { Send, TranslateReply } from "../../components/ops/auto-translate";
import type { OpsResponse } from "../../components/ops/ops-client";
import { TRANSLATE_LIMITS } from "./translate";

type Fields = Record<string, string | string[] | null>;
type Body = { target: TranslateReply["target"]; fields: Fields };

function isBody(value: unknown): value is Body {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (body.target === "ar" || body.target === "es") && typeof body.fields === "object" && body.fields !== null && !Array.isArray(body.fields);
}

const empty = (value: string | string[] | null): boolean =>
  value === null || (typeof value === "string" ? value.trim() === "" : value.every((item) => item.trim() === ""));

/** The fields cut into chunks, in order, each within the field count and the JSON size. A field too long alone is its own chunk. */
export function chunkFields(fields: Fields): Fields[] {
  const chunks: Fields[] = [];
  let current: Fields = {};
  for (const [name, value] of Object.entries(fields)) {
    if (empty(value)) continue;
    const next = { ...current, [name]: value };
    const fits = Object.keys(next).length <= TRANSLATE_LIMITS.fields && JSON.stringify(next).length <= TRANSLATE_LIMITS.json;
    if (fits || Object.keys(current).length === 0) {
      current = next;
    } else {
      chunks.push(current);
      current = { [name]: value };
    }
  }
  if (Object.keys(current).length > 0) chunks.push(current);
  return chunks;
}

/**
 * `send`, split: each chunk is one call, in order. The reply merges every chunk's `fields` and `left`; a chunk that failed
 * adds its field names to `left` (the kit leaves those empty and says so). When every chunk failed, the first failure is
 * the reply, so the kit shows the real reason (the daily limit, busy).
 */
export function chunkedSend(send: Send): Send {
  return async (path, body, options) => {
    if (path !== "/api/ops/translate" || !isBody(body)) return send(path, body, options);
    const chunks = chunkFields(body.fields);
    if (chunks.length <= 1) return send(path, body, options);
    const fields: TranslateReply["fields"] = {};
    const left: string[] = [];
    let firstFailure: OpsResponse<TranslateReply> | null = null;
    let anyOk = false;
    for (const chunk of chunks) {
      const reply = await send(path, { target: body.target, fields: chunk }, options);
      if (reply.ok) {
        anyOk = true;
        Object.assign(fields, reply.fields);
        left.push(...(reply.left ?? []));
      } else {
        firstFailure ??= reply;
        left.push(...Object.keys(chunk));
      }
    }
    if (!anyOk && firstFailure) return firstFailure;
    return { ok: true, target: body.target, fields, ...(left.length > 0 ? { left } : {}) };
  };
}
