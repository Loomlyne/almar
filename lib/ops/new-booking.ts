// Phase 5 plan 05-02: the bindings the three New booking route files import (route files import lib/ops only). The handlers are
// in lib/ops/new-booking-api.ts with their dependencies injected; here they get the real ones, the same as lib/ops/bookings.ts
// gives the other booking routes (04-08's notifier seam, the guest's view, the signed booking link), plus both request gates.
import type { OwnerContext } from "../auth/require-owner";
import { bookingLinkConfigured, signBookingLink } from "../booking/link";
import { ownerRequestGates } from "../booking/gate-server";
import { getNotifier } from "../booking/notify";
import { bookingPagePath, originForBooking } from "../booking/origin";
import { bookingViewById } from "../booking/server";
import { postAvailability, postCreate, postQuote, type NewBookingDeps } from "./new-booking-api";
import type { NewBookingAvailabilityBody, NewBookingCreateBody, NewBookingQuoteBody } from "./new-booking-contract";

export { parseAvailability, parseCreate, parseQuote } from "./new-booking-api";

const deps: NewBookingDeps = {
  notifier: getNotifier,
  view: (db, bookingId, opts) => bookingViewById(db, bookingId, opts),
  linkReady: bookingLinkConfigured,
  bookingUrl: async ({ id, ref, locale, isTest, linkVersion }) => {
    if (!bookingLinkConfigured()) return null;
    try {
      const token = await signBookingLink(id, linkVersion);
      return originForBooking(isTest) + bookingPagePath(locale, ref, token);
    } catch {
      return null;
    }
  },
  gates: (db) => ownerRequestGates(db),
};

type Post<B> = { owner: OwnerContext; body: B };

export const postAvailabilityRoute = ({ owner, body }: Post<NewBookingAvailabilityBody>) => postAvailability({ owner, body });
export const postQuoteRoute = ({ owner, body }: Post<NewBookingQuoteBody>) => postQuote({ owner, body }, deps);
export const postCreateRoute = ({ owner, body }: Post<NewBookingCreateBody>) => postCreate({ owner, body }, deps);
