// The sign-in link's Continue page proof (plan 02-24). Pure apart from node:crypto, so node tests
// import it. The masked email in the link is shown only when its HMAC verifies: a forged `m` shows no email.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

// Plan 02-26 task 2: the forwarded-link check. `b` ties the link to the browser that asked for it (a cookie nonce);
// `e` lets the server compare a typed email with the link's email without the link carrying it.

/** The cookie that holds the browser nonce: httpOnly, one hour, set when a link is requested. */
export const LINK_NONCE_COOKIE = "almar-link-nonce";
export const LINK_NONCE_MAX_AGE = 60 * 60;

/** 32 random bytes, base64url (43 characters). */
export function newLinkNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function isLinkNonce(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function normaliseContinueEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tag(key: string | Buffer, label: string, subject: string, tokenHash: string): Buffer {
  return createHmac("sha256", key).update(`${label}\n${subject}\n${tokenHash}`).digest();
}

function same(expected: Buffer, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** `b`: HMAC(key, "almar-browser-v1\n" + nonce + "\n" + token_hash). */
export function signBrowser(key: string | Buffer | null | undefined, nonce: string, tokenHash: string): string | undefined {
  if (!key || !isLinkNonce(nonce)) return undefined;
  return tag(key, "almar-browser-v1", nonce, tokenHash).toString("base64url");
}

export function verifyBrowser(
  key: string | Buffer | null | undefined,
  nonce: string | null | undefined,
  tokenHash: string,
  b: string | null | undefined,
): boolean {
  if (!key || !isLinkNonce(nonce)) return false;
  return same(tag(key, "almar-browser-v1", nonce, tokenHash), b);
}

/** `e`: HMAC(key, "almar-email-v1\n" + normalised email + "\n" + token_hash). */
export function signEmail(key: string | Buffer | null | undefined, email: string, tokenHash: string): string | undefined {
  const value = normaliseContinueEmail(email);
  if (!key || !value) return undefined;
  return tag(key, "almar-email-v1", value, tokenHash).toString("base64url");
}

export function verifyEmail(
  key: string | Buffer | null | undefined,
  email: unknown,
  tokenHash: string,
  e: string | null | undefined,
): boolean {
  const value = normaliseContinueEmail(email);
  if (!key || !value) return false;
  return same(tag(key, "almar-email-v1", value, tokenHash), e);
}

/**
 * What the Continue page and button do with a link:
 * "browser" = this browser asked for it; "email" = ask for the email; "closed" = no key, nothing can be proven.
 */
export function continueMode(
  key: string | Buffer | null | undefined,
  nonce: string | null | undefined,
  tokenHash: string,
  b: string | null | undefined,
): "browser" | "email" | "closed" {
  if (!key) return "closed";
  return verifyBrowser(key, nonce, tokenHash, b) ? "browser" : "email";
}

/** The button's decision. "wrong-email": refused, the token is not spent. */
export function checkContinue(input: {
  key: string | Buffer | null | undefined;
  nonce: string | null | undefined;
  tokenHash: string;
  b: string | null | undefined;
  e: string | null | undefined;
  email: unknown;
}): "ok" | "wrong-email" | "closed" {
  const mode = continueMode(input.key, input.nonce, input.tokenHash, input.b);
  if (mode === "closed") return "closed";
  if (mode === "browser") return "ok";
  return verifyEmail(input.key, input.email, input.tokenHash, input.e) ? "ok" : "wrong-email";
}
