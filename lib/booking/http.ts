// The one JSON body reader of the booking endpoints (plan 04-02): standard Request only, no Next, no environment. A body
// over the limit is refused by its Content-Length header and again by the bytes actually read; one that is not JSON, not
// UTF-8 or not sent as application/json is refused. The reason text names nothing the guest sent.

export type JsonBody = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(type)) return { ok: false, status: 400 };

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^[0-9]{1,12}$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > maxBytes) return { ok: false, status: 413 };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
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
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
