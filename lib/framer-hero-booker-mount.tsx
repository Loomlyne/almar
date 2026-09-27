import { createRoot, type Root } from "react-dom/client";
import { HeroBooker, type HeroBookQuery } from "../components/specimens/hero-booker";

declare global {
  interface Window {
    AlmarMountHeroBooker?: (host: HTMLElement) => void;
  }
}

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"] as const;
const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"] as const;

const roots = new WeakMap<HTMLElement, Root>();

function allowedWhere(value: string): value is (typeof DESTINATIONS)[number] {
  return (DESTINATIONS as readonly string[]).includes(value);
}

function openTrip(query: HeroBookQuery) {
  if (!allowedWhere(query.where) || !window.top) return;
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) params.set(key, query[key]);
  window.top.location.assign(`/booking/trip?${params.toString()}`);
}

function mountHeroBooker(host: HTMLElement) {
  let root = roots.get(host);
  if (!root) {
    root = createRoot(host);
    roots.set(host, root);
  }
  root.render(<HeroBooker onBook={openTrip} />);
}

window.AlmarMountHeroBooker = mountHeroBooker;
