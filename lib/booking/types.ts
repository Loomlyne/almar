// The request and response contracts of the booking endpoints (plan 04-02). Types only: no Next, no Supabase, no
// environment. Every later plan (04-03 pages, 04-04 Stripe, 04-05 emails, 05-01 and 05-02 ops) imports from here.
import type { AddOnUnit, DepositBlock, PriceSnapshot } from "../money/booking-price";

export type BookingStatus =
  | "held"
  | "awaiting_payment"
  | "deposit_paid"
  | "paid_in_full"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired";

export type Airport = "DXB" | "AUH" | "SHJ";

/**
 * Every reason a quote, a hold or a payment can be refused with (B-02: shown, never silently hidden).
 * The money engine's too_large (a guest total or an amount past the exact-arithmetic bounds) is reported as
 * "invalid" with the same field ("guests" or "amount") and max, so this list stays the signed one.
 */
export type ReasonCode =
  | "stay_unavailable"
  | "dates_invalid"
  | "below_min_nights"
  | "over_max_guests"
  | "blocked"
  | "sold_out"
  | "no_rate"
  | "addon_unavailable"
  | "addon_quantity"
  | "settings_missing"
  | "settings_changed"
  | "deposit_unavailable"
  | "below_minimum_charge"
  | "hold_limit"
  | "hold_ending"
  | "hold_ended"
  | "not_payable"
  | "nothing_due"
  | "terms_required"
  | "unavailable"
  | "invalid";

export type BookingReason = {
  code: ReasonCode;
  min?: number;
  max?: number;
  nights?: string[];
  id?: string;
  cause?: DepositBlock;
  field?: string;
};

/**
 * `hold` is sent only while the trip page holds one: the server checks the token and then leaves that hold's own
 * nights out of "taken", so a guest's own hold never counts against their own quote.
 */
export type QuoteRequest = {
  stay: string;
  from: string;
  to: string;
  adults: number;
  children: number;
  infants: number;
  addons: { id: string; qty: number }[];
  plan: "deposit" | "full";
  locale: "en" | "ar" | "es";
  hold?: { ref: string; t: string };
};

export type StayCard = {
  slug: string;
  title: string;
  destinationName: string;
  image: { src: string; alt: string } | null;
  maxGuests: number | null;
  minNights: number;
  infantsCount: boolean;
};

export type AddOnOffering = {
  id: string;
  slug: string;
  kind: "experience" | "service";
  unit: AddOnUnit;
  isUae: boolean;
  isHomePickup: boolean;
  name: string;
  image: { src: string; alt: string } | null;
  priceFils: number;
};

export type QuoteResponse = {
  ok: boolean;
  reasons: BookingReason[];
  stay: StayCard | null;
  offers: AddOnOffering[];
  inclusions: { id: string; label: string }[];
  breakdown: PriceSnapshot | null;
};

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  nationality?: string;
  specialRequests?: string;
  emergencyName?: string;
  emergencyPhone?: string;
};

export type TravellerInput = {
  kind: "adult" | "child" | "infant";
  fullName: string;
  age?: number;
  isBooker: boolean;
  notStaying: boolean;
};

export type HoldRequest = QuoteRequest & {
  contact: ContactInput;
  travellers: TravellerInput[];
  airport: Airport;
  pickupAddress?: string;
  termsAccepted: true;
};

/** 04-04 adds `checkout` to a successful hold. */
export type HoldResponse =
  | {
      ok: true;
      ref: string;
      holdExpiresAt: string;
      linkToken: string;
      breakdown: PriceSnapshot;
      checkout?: { clientSecret: string; publishableKey: string; sessionId: string };
    }
  | { ok: false; reasons: BookingReason[] };
