// Plan 02-04 TOUCHWORD handoff: a one-time token that carries her owner session from the public
// host to the ops host. Only the SHA-256 of the token is stored. node: imports only (node tests).
import { createHash, randomBytes } from "node:crypto";

/** Five minutes for the handoff itself. The Supabase magic-link expiry is not changed. */
export const HANDOFF_SECONDS = 5 * 60;

export function newHandoffToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashHandoffToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function handoffExpiry(now: Date): string {
  return new Date(now.getTime() + HANDOFF_SECONDS * 1000).toISOString();
}

/** A token is 43 base64url characters; anything else is not looked up. */
export function isHandoffToken(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
