// The booking reference ALMAR-XXXXXX (B-17, PAY-14): six letters of an unambiguous alphabet. The database makes them
// (new_booking_ref) and checks the same pattern; this file is for the Worker and the pages. Pure, no imports.

/** 31 characters: A-Z without I, L and O, and the digits 2-9 (no 0 and no 1). About 887 million references. */
export const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const REF_PATTERN = /^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** True for exactly "ALMAR-" and six characters of REF_ALPHABET, upper case, nothing before or after. */
export function isBookingRef(value: unknown): value is string {
  return typeof value === "string" && REF_PATTERN.test(value);
}
