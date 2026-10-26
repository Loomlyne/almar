// Plan 04-05 Task 4: the one Resend sender of the booking mails (lib/email/booking-notifier.ts calls it).
//
// The API key is read by name from the Worker's environment (RESEND_API_KEY) in resendApiKey() and nowhere else under
// lib/email. It is handed to the Resend client and never written into an answer, an error name, an event or a log:
// this file has no console call, and an error answer is a short name of [a-z0-9_] (mailErrorName), never a message.
//
// The package is imported lazily inside sendWithResend (E-17): tests/helpers/load-ts.mjs bundles a module with its
// packages external into the OS temp folder, so a top-level import of the package anywhere under lib/booking/notify.ts
// would break 04-08's node tests; it also keeps the request route's cold path light on the Free plan. The client sends
// one HTTP POST to the Resend emails API with the idempotency key as its `Idempotency-Key` header (Resend keeps a key
// 24 hours, so a retried request, record or lapse sends the mail once).

import type { MailOutcome } from "../booking/notify";

/** The sender of every booking mail: the same text as the sign-in email's FROM (lib/auth/magic-link-server.ts). */
export const BOOKING_FROM = "ALMAR Private Journey <inquiries@almarprivatejourney.com>";

/**
 * The error of a send that outran SEND_TIMEOUT_MS. The Resend SDK takes no AbortSignal (its send options are only
 * query, headers and idempotencyKey), so the POST may still deliver after the race: deliverMail writes `email_unknown`,
 * never `email_failed`, and the idempotency key keeps a later resend of the same mail from arriving twice.
 */
export const DELIVERY_UNKNOWN = "delivery_unknown";

/** How long one send may take before it answers DELIVERY_UNKNOWN (a request, a record or a lapse never waits longer). */
export const SEND_TIMEOUT_MS = 8_000;

/** One rendered mail to one address. `replyTo` is left out of the payload when undefined. */
export type OutgoingMail = { to: string; replyTo?: string; subject: string; html: string; text: string };

/** The slice of the package this file uses (a fake in the node tests). */
type ResendClient = {
  emails: {
    send(
      payload: { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string },
      options: { idempotencyKey: string },
    ): Promise<{ data: { id?: unknown } | null; error: unknown }>;
  };
};
export type ResendModule = { Resend: new (key: string) => ResendClient };

/** The Resend key of this Worker, trimmed, or null when it is missing or blank. The only environment read in lib/email. */
export function resendApiKey(): string | null {
  const value = process.env.RESEND_API_KEY;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const ERROR_NAME = /^[a-z0-9_]{1,60}$/;

/**
 * A Resend error as a short name: its `name` lower-cased when that is 1-60 characters of [a-z0-9_]
 * (`rate_limit_exceeded`, `validation_error`); else `http_<status>` when a 3-digit status is present; else
 * `send_error`. Never the message, the payload or an address.
 */
export function mailErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const { name, statusCode } = error as { name?: unknown; statusCode?: unknown };
    if (typeof name === "string") {
      const lower = name.toLowerCase();
      if (ERROR_NAME.test(lower)) return lower;
    }
    const status = typeof statusCode === "number" ? String(statusCode) : statusCode;
    if (typeof status === "string" && /^[1-9][0-9]{2}$/.test(status)) return `http_${status}`;
  }
  return "send_error";
}

/**
 * Sends one mail through Resend: one `emails.send` with `{ from: BOOKING_FROM, to: [mail.to], subject, html, text,
 * replyTo }` (replyTo only when set) and `{ idempotencyKey }`. Answers `{ ok: true }` on an id; `{ ok: false, error }`
 * with mailErrorName on a Resend error, `no_id` without an id, `threw` on a throw or a failed package load,
 * DELIVERY_UNKNOWN after `timeoutMs`. Never throws, never logs.
 */
export async function sendWithResend(
  apiKey: string,
  mail: OutgoingMail,
  idempotencyKey: string,
  load: () => Promise<ResendModule> = () => import("resend") as unknown as Promise<ResendModule>,
  timeoutMs: number = SEND_TIMEOUT_MS,
): Promise<MailOutcome> {
  const attempt = async (): Promise<MailOutcome> => {
    try {
      const { Resend } = await load();
      const payload = {
        from: BOOKING_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo === undefined ? {} : { replyTo: mail.replyTo }),
      };
      const { data, error } = await new Resend(apiKey).emails.send(payload, { idempotencyKey });
      if (error) {
        const name = mailErrorName(error);
        // A name is a fixed Resend code; this guard keeps even a strange one from ever carrying the key.
        return { ok: false, error: name.includes(apiKey.toLowerCase()) ? "send_error" : name };
      }
      if (!data || typeof data.id !== "string" || data.id === "") return { ok: false, error: "no_id" };
      return { ok: true };
    } catch {
      return { ok: false, error: "threw" };
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<MailOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: DELIVERY_UNKNOWN }), timeoutMs);
  });
  try {
    return await Promise.race([attempt(), late]);
  } finally {
    clearTimeout(timer);
  }
}
