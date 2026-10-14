// POST /newsletter: the footer's "Join the List" (phase 3.3 plan 27) adds ONE address to ALMAR's Resend contacts
// (`contacts.create`). No email is sent, no audience is named, nothing else is stored.
//
// Order (hardened by plan 27, the same shape as app/api/contact/route.ts): origin (403), content type (415, the
// footer posts multipart FormData only), size (413), rate limit (429, lib/form-rate-limit.ts scope "newsletter"),
// honeypots (400), address (400), key (503), Resend (502 or 200). Every answer is JSON {"ok":...} with no-store; the
// 200 is exactly {"ok":true} (the Resend contact id never leaves the server); no answer repeats a submitted value and
// nothing submitted is logged.
//
// Server-only. Read the existing RESEND_API_KEY from the process environment.
// Do not hardcode a key, do not write one into the repo, .env.example, or the
// JSON response. Missing/empty key is a 503, not an invented success.

import { Resend } from "resend";
import { isInquiryEmail } from "../../lib/contact-inquiry";
import { allowFormPost } from "../../lib/form-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HONEYPOT_FIELDS = [
  "title",
  "website",
  "company",
  "message",
  "subject",
  "description",
  "feedback",
  "notes",
  "details",
  "remarks",
  "comments",
] as const;

/** The footer's body is one address and 11 empty traps (well under 2 KiB); anything above this is refused. */
const MAX_BODY_BYTES = 8192;

const reply = (body: { ok: boolean }, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const refused = (status: number) => reply({ ok: false }, status);

function resendApiKey(): string | null {
  const value = process.env.RESEND_API_KEY?.trim();
  return value ? value : null;
}

function isFilled(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

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

type Body = { ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; status: 400 | 413 };

/** The raw body, refused above `max` bytes by its Content-Length and again by the bytes actually read. */
async function readBody(request: Request, max: number): Promise<Body> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^[0-9]{1,12}$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > max) return { ok: false, status: 413 };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, bytes: new Uint8Array(0) };
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
  return { ok: true, bytes };
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return refused(403);

  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type)) return refused(415);

  const body = await readBody(request, MAX_BODY_BYTES);
  if (!body.ok) return refused(body.status);

  if (!(await allowFormPost(request, "newsletter"))) return refused(429);

  let formData: FormData;
  try {
    formData = await new Response(body.bytes, { headers: { "content-type": type } }).formData();
  } catch {
    return refused(400);
  }

  for (const field of HONEYPOT_FIELDS) {
    if (isFilled(formData.get(field))) {
      return refused(400);
    }
  }

  const email = formData.get("Email");
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  if (!trimmedEmail || !isInquiryEmail(trimmedEmail)) {
    return refused(400);
  }

  const apiKey = resendApiKey();
  if (!apiKey) {
    return refused(503);
  }

  try {
    const { data, error } = await new Resend(apiKey).contacts.create({
      email: trimmedEmail,
      unsubscribed: false,
    });
    if (error || typeof data?.id !== "string" || data.id.length === 0) {
      // The error's name only (a fixed Resend code), never the payload, the error object or the address.
      console.error("newsletter: add failed", typeof error?.name === "string" ? error.name : "no id");
      return refused(502);
    }
  } catch {
    console.error("newsletter: add failed", "exception");
    return refused(502);
  }

  return reply({ ok: true }, 200);
}
