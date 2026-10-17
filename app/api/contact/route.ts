// POST /api/contact (phase 3.3 plan 26): the Contact page's inquiry becomes ONE plain-text email to ALMAR's inbox,
// with the visitor as reply-to, through Resend. Security-relevant; the rules live in lib/contact-inquiry.ts.
//
// Order: origin (403), content type (415), size (413), rate limit (429), honeypots (400), fields (400 with error
// codes), key (503), send (502 or 200). Every answer is JSON {"ok":...} with no-store; none repeats a submitted value
// and nothing submitted is logged. The key is read only from process.env.RESEND_API_KEY (a Worker secret); a missing
// key is a 503, never an invented success. No auto-reply, no second send, no contact list.
//
// The origin check stops a browser on another site from posting here (a cross-site form post is the threat). A client
// that is not a browser can forge Origin; the rate limit (lib/form-rate-limit.ts) and the honeypots are the layers for
// that, and the mail only ever reaches ALMAR's own inbox.

import { Resend } from "resend";
import { INQUIRY_FIELD, INQUIRY_LIMITS, composeInquiryEmail, honeypotTripped, validateInquiry } from "../../../lib/contact-inquiry";
import { allowFormPost } from "../../../lib/form-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const refused = (status: number) => reply({ ok: false }, status);

/** True when Origin is an http(s) URL whose host is this request's own host. A missing or "null" Origin is false. */
function sameOrigin(request: Request): boolean {
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

type Body = { ok: true; text: string } | { ok: false; status: 400 | 413 };

/** The body as UTF-8 text, refused above `max` bytes by its Content-Length and again by the bytes actually read. */
async function readBody(request: Request, max: number): Promise<Body> {
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

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return refused(403);

  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded\s*(;|$)/i.test(type)) return refused(415);

  const body = await readBody(request, INQUIRY_LIMITS.body);
  if (!body.ok) return refused(body.status);

  if (!(await allowFormPost(request, "contact"))) return refused(429);

  const params = new URLSearchParams(body.text);
  if (honeypotTripped((name) => params.get(name))) return refused(400);

  const result = validateInquiry({
    name: params.get(INQUIRY_FIELD.name),
    phone: params.get(INQUIRY_FIELD.phone),
    email: params.get(INQUIRY_FIELD.email),
    journeyType: params.get(INQUIRY_FIELD.journeyType),
    details: params.get(INQUIRY_FIELD.details),
    locale: params.get(INQUIRY_FIELD.locale),
  });
  if (!result.ok) return reply({ ok: false, errors: result.errors }, 400);

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return refused(503);

  try {
    const { data, error } = await new Resend(key).emails.send(composeInquiryEmail(result.inquiry));
    if (error || typeof data?.id !== "string" || !data.id) {
      // The error's name only (a fixed Resend code), never the payload, the error object or a field.
      console.error("contact: send failed", typeof error?.name === "string" ? error.name : "no id");
      return refused(502);
    }
  } catch {
    console.error("contact: send failed", "exception");
    return refused(502);
  }
  return reply({ ok: true }, 200);
}
