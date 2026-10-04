// The sign-in link's Continue page proof (plan 02-24). Pure apart from node:crypto, so node tests
// import it. The masked email in the link is shown only when its HMAC verifies: a forged `m` shows no email.
import { createHmac, timingSafeEqual } from "node:crypto";

/** The three types generateLink({ type: "magiclink" }) can hand back. */
export const CONFIRM_TYPES = ["magiclink", "signup", "email"] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export function isConfirmType(value: unknown): value is ConfirmType {
  return typeof value === "string" && (CONFIRM_TYPES as readonly string[]).includes(value);
}

/** First character of the local part, three bullets, then the domain. Lowercased. */
export function maskEmail(email: string): string {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return "";
  const first = Array.from(value.slice(0, at))[0];
  return `${first}•••@${value.slice(at + 1)}`;
}

function mac(key: string | Buffer, tokenHash: string, masked: string): Buffer {
  return createHmac("sha256", key).update(`almar-continue-v1\n${tokenHash}\n${masked}`).digest();
}

/** base64url HMAC-SHA256, or undefined when there is no key (the page then shows the no-email line). */
export function signContinue(key: string | Buffer | null | undefined, tokenHash: string, masked: string): string | undefined {
  if (!key) return undefined;
  return mac(key, tokenHash, masked).toString("base64url");
}

export function verifyContinue(
  key: string | Buffer | null | undefined,
  tokenHash: string,
  masked: string,
  signature: string | null | undefined,
): boolean {
  if (!key || !signature || !masked) return false;
  const expected = mac(key, tokenHash, masked);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
