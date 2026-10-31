// Phase 5 plan 05-01: the contract of the owner's New booking routes (OPS-06, P5-02, P5-04). Types only: `import type`
// only and no runtime export, so nothing here enters a bundle. 05-02 builds the routes and the screen from these names.
// Bodies are snake_case; the engine's snapshot stays camelCase, as today.
import type { Airport, AddOnOffering, BookingLocale, BookingReason, PublicPriceSnapshot, StayCard } from "../booking/types";
import type { MailResult } from "./bookings-api";

/** POST /api/ops/booking/availability */
export type NewBookingAvailabilityBody = { stay: string; from: string; to: string };
export type NewBookingAvailabilityAnswer = { ok: true; stay: StayCard | null; blocked: string[]; taken: string[]; has_rate: boolean };

/** The owner's view of a price: the guest's snapshot, with nights that may be agreed. */
export type OwnerBreakdown = Omit<PublicPriceSnapshot, "nights"> & {
  nights: { night: string; rateFils: number; source: "range" | "base" | "agreed" }[];
};

/** POST /api/ops/booking/quote. agreed_amount: AED text the owner typed, read by parseAedAmount; null uses the stay's rates. */
export type NewBookingQuoteBody = {
  stay: string;
  from: string;
  to: string;
  adults: number;
  children: number;
  infants: number;
  addons: { id: string; qty: number }[];
  plan: "deposit" | "full";
  locale: BookingLocale;
  agreed_amount: string | null;
};
export type NewBookingQuoteAnswer = {
  ok: true;
  reasons: BookingReason[];
  stay: StayCard | null;
  offers: AddOnOffering[];
  breakdown: OwnerBreakdown | null;
  /** True when the stay has no rate for these nights and no agreed_amount was sent. */
  needs_agreed: boolean;
  /** B-13: a real booking passes the request gate; a TEST one needs complete bank details only. */
  real_open: boolean;
  test_open: boolean;
};

/**
 * POST /api/ops/booking/create. agreed_reason 3..300 exactly when agreed_amount is set. hold_until: ISO with offset, from a
 * UAE-time picker (O-03). P5-04: is_test from the Review tick.
 */
export type NewBookingCreateBody = NewBookingQuoteBody & {
  request_id: string;
  guest: { name: string; email: string; phone: string };
  airport: Airport | null;
  pickup_address: string | null;
  hold_until: string;
  is_test: boolean;
  agreed_reason: string | null;
};
export type NewBookingCreateAnswer = { ok: true; booking_id: string; ref: string; hold_expires_at: string; link_version: number; mail: MailResult };
export type NewBookingRefusal =
  | "invalid"
  | "not_owner"
  | "requests_closed"
  | "hold_too_soon"
  | "settings_missing"
  | "settings_changed"
  | "stay_unavailable"
  | "below_minimum_charge"
  | "blocked"
  | "sold_out"
  | "below_min_nights"
  | "over_max_guests"
  | "deposit_unavailable"
  | "no_rate"
  | "addon_unavailable"
  | "addon_quantity"
  | "dates_invalid"
  | "unavailable";
