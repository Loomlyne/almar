// Server side of the signed booking link: reads BOOKING_LINK_SECRET, the one value shared by Worker `almar` and
// `almar-ops` (the owner sets it from his terminal; never in a file). The only file in lib/booking that reads the
// environment for a secret. The pure part, with the secret as an argument, is link-token.ts.
import { checkBookingLink, hmacBookingLink } from "./link-token";

function secret(): string | null {
  const value = process.env.BOOKING_LINK_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

/** True when the secret is set and long enough to sign with. The hold route answers 503 without it. */
export function bookingLinkConfigured(): boolean {
  return secret() !== null;
}

/** The token for a booking's links. Throws "booking link secret missing" when the secret is not set. */
export async function signBookingLink(bookingId: string, linkVersion: number): Promise<string> {
  const key = secret();
  if (!key) throw new Error("booking link secret missing");
  return hmacBookingLink(key, bookingId, linkVersion);
}

/** False when the secret is not set: a link is never accepted without a way to check it. */
export async function verifyBookingLink(bookingId: string, linkVersion: number, token: unknown): Promise<boolean> {
  const key = secret();
  if (!key) return false;
  return checkBookingLink(key, bookingId, linkVersion, token);
}
