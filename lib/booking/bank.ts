// The owner's bank details, checked the way the SQL checks them (plan 04-08; 20261019160000 booking_bank_details,
// booking_iban_ok, booking_bic_ok). 04-09's money Settings parser and 04-05's booking page use it; the database checks
// the same rules again on save. A leaf module: no imports, no environment. No per-country IBAN length table: the
// owner's bank country is not known, so any IBAN of 15 to 34 characters with a valid check is accepted.

/** The text limits of the bank fields, as the SQL checks them (characters). */
export const BANK_TEXT_LIMITS = Object.freeze({ accountName: 120, bankName: 120, bankAddress: 300, note: 300 } as const);

const IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const BIC_SHAPE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** The stored form of an IBAN: no white space, upper case. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * True for a well-formed IBAN: two letters, two check digits, 11 to 30 letters or digits (15 to 34 in all), and the
 * ISO 13616 check (the first four characters moved to the end, letters as 10..35, the number mod 97 is 1). The
 * remainder is kept as it goes, one digit at a time, so no big integer is needed. Spaces and lower case are allowed.
 * Never throws: anything that is not a string is false.
 */
export function isValidIban(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const iban = normalizeIban(value);
  if (!IBAN_SHAPE.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of moved) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/** An IBAN for display, in groups of four (`GB82 WEST 1234 5698 7654 32`). Display only: the stored value has no spaces. */
export function formatIban(value: string): string {
  const iban = normalizeIban(value);
  return (iban.match(/.{1,4}/g) ?? []).join(" ");
}

/** The stored form of a SWIFT / BIC code: no white space, upper case. */
export function normalizeBic(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * True for a SWIFT / BIC code of 8 or 11 characters: bank (4 letters), country (2 letters), location (2 letters or
 * digits), and an optional branch (3 letters or digits). Spaces and lower case are allowed. Never throws.
 */
export function isValidBic(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return BIC_SHAPE.test(normalizeBic(value));
}
