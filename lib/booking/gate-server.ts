// The request gate's runtime inputs (plan 04-08), put together in this one place: TEST from the Host header (never from
// a body), the terms (plan 06-04: bookingTermsGate, the owner's published text), the link secret (lib/booking/link.ts reads
// it), the email sender's readiness (the notifier decides it) and the gate's database half (`booking_gate()`). The hold,
// request and quote routes call in here; lib/booking/server.ts keeps the pure rule. No environment is read here.
import { isTestHost } from "./origin";
import { bookingLinkConfigured } from "./link";
import { getNotifier } from "./notify";
import { readBookingGate, requestGate, type BookingDb, type RequestGate } from "./server";
import { BAKED_TERMS_VERSION, bookingTermsGate } from "./terms";

/**
 * The gate and the terms version from one read of the terms: the hold route stores this version on the booking, so what
 * opened the gate is what the booking names. A database failure of booking_gate() is thrown (the route answers 503); a
 * failure of the terms read is closed terms.
 */
export async function requestGateAndTerms(db: BookingDb, host: string | null | undefined, baked = BAKED_TERMS_VERSION): Promise<{ gate: RequestGate; termsVersion: string }> {
  const [terms, state] = await Promise.all([bookingTermsGate(db, baked), readBookingGate(db)]);
  const gate = requestGate({
    isTest: isTestHost(host),
    termsArePlaceholder: terms.isPlaceholder,
    linkConfigured: bookingLinkConfigured(),
    mailReady: getNotifier().ready,
    ...state,
  });
  return { gate, termsVersion: terms.version };
}

/** The gate for a request arriving on `host`. A database failure is thrown (the route answers 503). */
export async function currentRequestGate(db: BookingDb, host: string | null | undefined): Promise<RequestGate> {
  return (await requestGateAndTerms(db, host)).gate;
}
