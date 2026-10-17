// The footer newsletter's one submit function (phase 3.3 plan 27). It posts the address and the 11 honeypots to the
// same-origin handler app/newsletter/route.ts and resolves ONLY when that handler answers 200 with JSON ok === true;
// every other answer (a refusal, a static 404 page, a 200 without ok, a network failure) rejects, so the footer never
// shows a success that did not happen. The rejection carries the status only, never the response body.
//
// No imports and no browser global read at import: node --test loads this file directly. The honeypot names are copied from
// the route (a Next route file may export only route fields); tests/newsletter-client.test.mjs pins the two lists equal.

export const NEWSLETTER_ENDPOINT = "/newsletter";

/** A post that has not answered (headers and body) within this many milliseconds is aborted and counts as failed. */
export const NEWSLETTER_TIMEOUT_MS = 20_000;

/** The route's HONEYPOT_FIELDS, same names, same order (the live Framer form's 11 invisible spam traps, SITE-12). */
export const NEWSLETTER_HONEYPOT_FIELDS = [
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

export type NewsletterHoneypotField = (typeof NEWSLETTER_HONEYPOT_FIELDS)[number];

/**
 * POST `Email` (trimmed) and every honeypot (empty unless a bot filled it) as multipart FormData to /newsletter.
 * Resolves on 200 + JSON ok === true; throws `Error("newsletter <status>")` otherwise, and `Error("newsletter
 * network")` when the request fails or does not finish within `timeoutMs` (review fix: a stalled post must end in
 * the failed line and release the button, as the contact form's does).
 */
export async function subscribeToNewsletter(
  email: string,
  honeypots: Partial<Record<string, string>> = {},
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = NEWSLETTER_TIMEOUT_MS,
): Promise<void> {
  const body = new FormData();
  body.append("Email", email.trim());
  for (const field of NEWSLETTER_HONEYPOT_FIELDS) body.append(field, honeypots[field] ?? "");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(NEWSLETTER_ENDPOINT, { method: "POST", body, credentials: "same-origin", signal: abort.signal });
    } catch {
      throw new Error("newsletter network");
    }
    let ok = false;
    if (response.status === 200) {
      try {
        const data: unknown = await response.json();
        ok = typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === true;
      } catch {
        ok = false;
      }
    }
    if (!ok) throw new Error(`newsletter ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}
