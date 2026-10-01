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
