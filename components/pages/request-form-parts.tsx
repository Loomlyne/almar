"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { HONEYPOT_FIELDS } from "../../lib/contact-inquiry";
import type { RequestErrorCode, RequestErrors } from "../../lib/site-requests/validate";
import { Link } from "../ui/link";

// What the three forms of plan 06-05 share (components/pages/plan-with-us/plan-form.tsx, list-with-us/list-form.tsx,
// contact/consultation-booking.tsx), the rules of components/pages/contact/inquiry-form.tsx: a mounted flag, so the served HTML
// holds no form; the 11 spam traps; one failed line; one urlencoded POST with a 20 s timeout that never rejects.

const TIMEOUT_MS = 20_000;
const CODES: readonly RequestErrorCode[] = ["required", "invalid", "tooLong"];

export const MESSAGE = "m-0 border border-line border-s-3 border-s-teal bg-surface px-4 py-3 text-body text-ink";
export const MESSAGE_BAD = "m-0 border border-line border-s-3 border-s-error bg-surface px-4 py-3 text-body text-ink";
export const FORM_BOX = "flex w-full max-w-calendar flex-col gap-4 border border-line bg-surface p-4 md:p-8";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** The live form's 11 spam traps: out of sight, out of the tab order and the accessibility tree. */
export function RequestHoneypots() {
  return (
    <div aria-hidden="true" className="sr-only">
      {HONEYPOT_FIELDS.map((trap) => (
        <input
          key={trap}
          type="text"
          name={trap}
          tabIndex={-1}
          autoComplete="one-time-code"
          defaultValue=""
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
        />
      ))}
    </div>
  );
}

/** Copies whatever a bot left in the traps into the post, so the server refuses it. */
export function addHoneypots(body: URLSearchParams, form: RefObject<HTMLFormElement | null>): void {
  for (const trap of HONEYPOT_FIELDS) {
    const input = form.current?.elements.namedItem(trap);
    body.set(trap, input instanceof HTMLInputElement ? input.value : "");
  }
}

export type RequestReply = { status: number; body: Record<string, unknown> | null };

/** One urlencoded POST. Null when no answer came (offline, the timeout). */
export async function postRequest(path: string, body: URLSearchParams): Promise<RequestReply | null> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, { method: "POST", headers: { Accept: "application/json" }, body, signal: abort.signal });
    const json: unknown = await res.json().catch(() => null);
    return { status: res.status, body: json && typeof json === "object" ? (json as Record<string, unknown>) : null };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** The server's `errors` map, keeping only known codes. Null when it holds none. */
export function serverErrors(body: Record<string, unknown> | null): RequestErrors | null {
  const raw = body?.errors;
  if (!raw || typeof raw !== "object") return null;
  const out: RequestErrors = {};
  for (const [key, code] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof code === "string" && (CODES as readonly string[]).includes(code)) out[key] = code as RequestErrorCode;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type FailedLineProps = {
  /** `{email}` and `{whatsapp}` become links. */
  template: string;
  /** The `{whatsapp}` link's text. */
  whatsappWord: string;
  email: string;
  mailto: string;
  whatsappHref: string;
  /** The screen-reader suffix of a link that opens a new tab. */
  newTabLabel: string;
};

/** The failed line, naming the inbox and WhatsApp (the signed `failed`); the guest's words stay in the form. */
export function FailedLine({ template, whatsappWord, email, mailto, whatsappHref, newTabLabel }: FailedLineProps) {
  const slots: Record<"email" | "whatsapp", ReactNode> = {
    email: (
      <Link inline href={mailto}>
        <bdi>{email}</bdi>
      </Link>
    ),
    whatsapp: (
      <Link inline href={whatsappHref} target="_blank" rel="noopener noreferrer">
        {whatsappWord}
        <span className="sr-only"> {newTabLabel}</span>
      </Link>
    ),
  };
  return (
    <p role="alert" className={MESSAGE_BAD}>
      {template.split(/\{(email|whatsapp)\}/).map((part, i) => (i % 2 === 1 ? <span key={i}>{slots[part as "email" | "whatsapp"]}</span> : part))}
    </p>
  );
}
