// The request gate's runtime inputs (plan 04-08), put together in this one place: TEST from the Host header (never from
// a body), the terms constant, the link secret (lib/booking/link.ts reads it), the email sender's readiness (the
// notifier decides it) and the gate's database half (`booking_gate()`). The hold, request and quote routes call
// currentRequestGate; lib/booking/server.ts keeps the pure rule. No environment is read here.
import { isTestHost } from "./origin";
import { bookingLinkConfigured } from "./link";
import { getNotifier } from "./notify";
import { readBookingGate, requestGate, type BookingDb, type RequestGate } from "./server";
import { BOOKING_TERMS_IS_PLACEHOLDER } from "./terms";

/** The gate for a request arriving on `host`. A database failure is thrown (the route answers 503). */
export async function currentRequestGate(db: BookingDb, host: string | null | undefined): Promise<RequestGate> {
  return requestGate({
    isTest: isTestHost(host),
    termsArePlaceholder: BOOKING_TERMS_IS_PLACEHOLDER,
    linkConfigured: bookingLinkConfigured(),
    mailReady: getNotifier().ready,
    ...(await readBookingGate(db)),
  });
}
