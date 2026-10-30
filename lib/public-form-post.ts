// The rules of a public form POST (plan 06-05), copied from app/api/contact/route.ts, which is not edited: the same origin
// check, the same body read and the same JSON reply. The origin check stops a browser on another site; a client that is not a
// browser can forge Origin, so the rate limit (lib/form-rate-limit.ts) and the honeypots are the layers for that.

/** JSON with no-store. No reply repeats a submitted value. */
export function formReply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** True when Origin is an http(s) URL whose host is this request's own host. A missing or "null" Origin is false. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    host = url.host;
  } catch {
    return false;
  }
  return host === new URL(request.url).host || host === request.headers.get("host");
}

export type FormBody = { ok: true; text: string } | { ok: false; status: 400 | 413 };

/** The body as UTF-8 text, refused above `max` bytes by its Content-Length and again by the bytes actually read. */
export async function readFormBody(request: Request, max: number): Promise<FormBody> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^[0-9]{1,12}$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > max) return { ok: false, status: 413 };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, status: 400 };
  }
}
