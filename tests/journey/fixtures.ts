// Shared fixtures for the harness and the canvas (plan 03.1-10, UI-SPEC "Harness").
// Brackets stand in for real data (D-52). No people, no invented amounts.
import { CalendarDate } from "@internationalized/date";
import type {
  AddOnItem,
  Destination,
  Inclusion,
  JourneyValue,
  TeamMember,
} from "../../components/journey/types";

export const PRICE = "AED [PRICE]";
export const AMOUNT = "AED [AMOUNT]";
export const VAT = "[RATE]%";
export const REF = "ALMAR-000000";

export const destinations: Destination[] = [
  { id: "cartagena", name: "Cartagena", shortLine: "[Short line]" },
  { id: "medellin", name: "Medellín", shortLine: "[Short line]" },
  { id: "bogota", name: "Bogotá", shortLine: "[Short line]" },
  { id: "san-andres", name: "San Andrés", shortLine: "[Short line]" },
  { id: "cocora-valley", name: "Cocora Valley", shortLine: "[Short line]" },
];

export const stay = {
  name: "Getsemaní Colonial House",
  image: { src: "/assets/img/59682878de873329.webp", alt: "Getsemaní Colonial House" },
};

const img = (file: string, alt: string) => ({ src: `/assets/img/${file}.webp`, alt });

// Units are assigned per test case; trip is the default. "Home pickup" starts added (HOME_PICKUP_ID).
export const HOME_PICKUP_ID = "home-pickup";

export const addOns: AddOnItem[] = [
  { id: "home-pickup", kind: "service", region: "uae", name: "Home pickup", image: img("d93681892835d48b", "Home pickup"), unit: "trip", price: PRICE },
  { id: "vip-airport-meet", kind: "service", region: "uae", name: "VIP Airport Meet & Greet", image: img("640c57b0d03641cc", "VIP Airport Meet & Greet"), unit: "trip", price: PRICE },
  { id: "private-concierge", kind: "service", name: "24/7 Private Concierge", image: img("fad99748eb29b7f8", "24/7 Private Concierge"), unit: "night", price: PRICE },
  { id: "walled-city-night", kind: "experience", name: "Cartagena Walled City Night", image: img("0787c0615a96af62", "Cartagena Walled City Night"), unit: "person", price: PRICE },
  { id: "heritage-tours", kind: "experience", name: "Cartagena Heritage Tours", image: img("2e8e18393ba7bc74", "Cartagena Heritage Tours"), unit: "person", price: PRICE },
  { id: "rosario-islands", kind: "experience", name: "Rosario Islands Escape", image: img("0dadd08a491bfc52", "Rosario Islands Escape"), unit: "person", price: PRICE },
  { id: "yacht-charters", kind: "experience", name: "Yacht & Island Charters", image: img("85bdc83c0860c091", "Yacht & Island Charters"), unit: "trip", price: PRICE },
  { id: "welcome-cocktail", kind: "experience", name: "Welcome Cocktail at Sunset", image: img("726c964e0318bf1b", "Welcome Cocktail at Sunset"), unit: "person", price: PRICE },
  { id: "gourmet-food-tours", kind: "experience", name: "Gourmet Food Tours", image: img("8d72e5577734778a", "Gourmet Food Tours"), unit: "person", price: PRICE },
  { id: "private-beach", kind: "experience", name: "Private Beach Experiences", image: img("54482d988b8f11b3", "Private Beach Experiences"), unit: "person", price: PRICE },
  { id: "cooking-classes", kind: "experience", name: "Traditional Cooking Classes", image: img("81840f01e4039621", "Traditional Cooking Classes"), unit: "person", price: PRICE },
];

export const inclusions: Inclusion[] = [
  { id: "airport-meet", label: "Airport meet" },
  { id: "transfer", label: "Transfer in Colombia" },
  { id: "stay", label: "Your stay" },
  { id: "guide", label: "Private guide" },
  { id: "security", label: "Security" },
  { id: "insurance", label: "Insurance" },
  { id: "return", label: "Return" },
];

export const dates = {
  start: new CalendarDate(2026, 10, 12),
  end: new CalendarDate(2026, 10, 17),
  nights: 5,
  startLabel: "12/10/2026",
  endLabel: "17/10/2026",
};

export const guestsTwoAdults = { adults: 2, children: 0, infants: 0 };
export const guestsFamily = { adults: 2, children: 1, infants: 1 };

export const emptyJourney: JourneyValue = {
  destinationId: null,
  start: null,
  end: null,
  adults: 2,
  children: 0,
  infants: 0,
};

export const filledJourney: JourneyValue = {
  destinationId: "cartagena",
  start: dates.start,
  end: dates.end,
  ...guestsTwoAdults,
};

// Zero members renders nothing; the placeholder is canvas-only and has no person photo.
export const teamNone: TeamMember[] = [];
export const teamOne: TeamMember[] = [{ id: "placeholder", name: "[Name]", role: "[Role]" }];
