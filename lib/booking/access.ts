// Who may see or change one booking (B-16, AUTH-01): the holder of the signed link, or a signed-in guest whose email
// is the booking's. The booking reference alone grants nothing. Takes its dependencies as arguments, so the Worker
// passes the database and the session and the tests pass fakes. 04-04 and 04-05 use it for pay, view and release.
import { normalizeEmail } from "../auth/rules";
import { isBookingRef } from "./ref";

export type BookingAccessDeps = {
  findByRef(ref: string): Promise<{ id: string; email: string; linkVersion: number } | null>;
  verify(bookingId: string, linkVersion: number, token: string): Promise<boolean>;
  readSession(): Promise<{ email: string } | null>;
};

export type BookingAccess = { ok: true; bookingId: string; via: "link" | "session" } | { ok: false };

const REFUSED: BookingAccess = { ok: false };

/**
 * With a token (anything but undefined or null): the token is the only door; a matching signed-in email does not help
 * and the session is not read. Without one: the session's email must equal the booking's. A malformed or unknown
 * reference, a wrong token and a missing session all give the same answer, `{ ok: false }`.
 */
export async function authorizeBookingAccess(
  input: { ref: unknown; t?: unknown },
  deps: BookingAccessDeps,
): Promise<BookingAccess> {
  if (!isBookingRef(input.ref)) return REFUSED;
  const booking = await deps.findByRef(input.ref);
  if (!booking) return REFUSED;

  if (input.t !== undefined && input.t !== null) {
    if (typeof input.t !== "string") return REFUSED;
    return (await deps.verify(booking.id, booking.linkVersion, input.t))
      ? { ok: true, bookingId: booking.id, via: "link" }
      : REFUSED;
  }

  const session = await deps.readSession();
  const sessionEmail = normalizeEmail(session?.email);
  const bookingEmail = normalizeEmail(booking.email);
  if (sessionEmail !== "" && sessionEmail === bookingEmail) return { ok: true, bookingId: booking.id, via: "session" };
  return REFUSED;
}
