// The booking terms the guest accepts before paying (B-13, IDEN-01). The text is the owner's and does not exist yet:
// until he supplies it the page shows [Booking terms] and production requests stay closed (the request gate refuses
// a production booking while BOOKING_TERMS_IS_PLACEHOLDER is true). His text replaces [Booking terms]; both
// constants change in the same commit: the version names the text the guest agreed to and is stored on the booking.
// Plan 06-04: the owner now publishes the text in Content -> Legal, so the two constants stay as the closed fallback and
// bookingTermsGate asks booking_terms_current() (migration 20261025120000) on every hold, request and quote.

import type { BookingDb } from "./server";

export const BOOKING_TERMS_VERSION = "placeholder";
export const BOOKING_TERMS_IS_PLACEHOLDER = true;

const CMS_VERSION = /^cms-[0-9a-f]{16}$/;

/**
 * The terms as the database has them. Open only when booking_terms_current() says they are published in English, Arabic
 * and Spanish with a version of the published text; an rpc error, a thrown rpc, an unreadable answer or a bad version is
 * the closed fallback. Never throws: closed terms are a gate reason, not a 503.
 */
export async function bookingTermsGate(db: BookingDb): Promise<{ isPlaceholder: boolean; version: string }> {
  try {
    const { data, error } = await db.rpc("booking_terms_current");
    if (!error && typeof data === "object" && data !== null) {
      const { published, version } = data as { published?: unknown; version?: unknown };
      if (published === true && typeof version === "string" && CMS_VERSION.test(version)) return { isPlaceholder: false, version };
    }
  } catch {
    // Closed, below.
  }
  return { isPlaceholder: true, version: BOOKING_TERMS_VERSION };
}
