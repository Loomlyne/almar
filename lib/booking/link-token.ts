// The signed booking link (B-16, research Q7): an HMAC-SHA256 over the booking id and its link version, so a booking
// reference alone grants nothing. WebCrypto only (native on Workers and in Node), no environment: the secret is passed
// in (lib/booking/link.ts reads BOOKING_LINK_SECRET). Bumping a booking's link_version revokes every older link.

const encoder = new TextEncoder();

/** A secret under 32 characters is a mistake, not a weak key: signing refuses it. */
const MIN_SECRET_LENGTH = 32;

/** Base64url with no padding, the shape of a SHA-256 HMAC: 43 characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function message(bookingId: string, linkVersion: number): Uint8Array<ArrayBuffer> {
  const bytes = encoder.encode(`booking-link:v1:${bookingId}:${linkVersion}`);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** The token for one booking at one link version. Throws when the secret is under 32 characters. */
export async function hmacBookingLink(secret: string, bookingId: string, linkVersion: number): Promise<string> {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("booking link secret must be at least 32 characters");
  }
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), message(bookingId, linkVersion));
  return toBase64Url(signature);
}

/**
 * True only for the token that hmacBookingLink gives for exactly this secret, id and version. The comparison is the
 * platform's own HMAC verify (constant time), never a string comparison. A wrong id, version, secret, a truncated,
 * extended or malformed token, or a secret under 32 characters is false, never a throw.
 */
export async function checkBookingLink(secret: string, bookingId: string, linkVersion: number, token: unknown): Promise<boolean> {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) return false;
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), fromBase64Url(token), message(bookingId, linkVersion));
  } catch {
    return false;
  }
}
