// Shared prop contracts for every journey component (plan 03.1-10, D-33). Types only.
import type { CalendarDate } from "@internationalized/date";
import type { JourneyCopy } from "../../lib/copy/journey";

export type Locale = "en" | "ar" | "es";

export type { JourneyCopy };

export type ImageRef = { src: string; alt: string };

export type Destination = {
  id: string;
  name: string;
  shortLine: string;
};

export type JourneyValue = {
  destinationId: string | null;
  start: CalendarDate | null;
  end: CalendarDate | null;
  adults: number;
  children: number;
  infants: number;
};

export type AddOnUnit = "person" | "night" | "trip";

export type AddOnItem = {
  id: string;
  kind: "experience" | "service";
  region?: "uae";
  name: string;
  image: ImageRef;
  unit: AddOnUnit;
  /** Bracket placeholder until real rates exist, for example "AED [PRICE]". */
  price: string;
};

export type Inclusion = { id: string; label: string };

export type CartLine = {
  id: string;
  name: string;
  quantity: number;
  /** For example "AED [AMOUNT]". */
  amount: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  photo?: ImageRef;
  email?: string;
};

/** One guest line on the Travellers step. `age` is text while the guest types; only children and infants have one. */
export type TravellerLine = { name: string; age: string };

/** Everything the guest types on the Travellers step (IDEN-01, IDEN-02, JOUR-02). All text, nothing parsed here. */
export type TravellersValue = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  specialRequests: string;
  emergencyName: string;
  emergencyPhone: string;
  /** "I am not staying": line 1 is then someone else, named by the booker. */
  notStaying: boolean;
  /** One line per guest: adults, then children, then infants. */
  lines: TravellerLine[];
  pickupAddress: string;
};

/** A field the step can flag. Keys: contact.name, contact.email, contact.phone, contact.emergencyPhone, travellers.<i>.fullName, travellers.<i>.age, pickupAddress. */
export type TravellerErrors = Record<string, "required" | "email" | "phone" | "age">;
