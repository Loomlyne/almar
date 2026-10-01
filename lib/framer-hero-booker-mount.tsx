import { createRoot, type Root } from "react-dom/client";
import { HeroBooker, type HeroBookQuery } from "../components/specimens/hero-booker";
import type { HomeLocale } from "./copy/home";

declare global {
  interface Window {
    AlmarMountHeroBooker?: (host: HTMLElement) => void;
  }
}

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"] as const;
const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"] as const;

const roots = new WeakMap<HTMLElement, Root>();
const locales = new WeakMap<HTMLElement, HomeLocale>();

function isLocale(value: unknown): value is HomeLocale {
  return value === "en" || value === "ar" || value === "es";
}

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
    locales.set(host, "en");
  }
  root.render(<HeroBooker locale={locales.get(host) ?? "en"} onBook={openTrip} />);
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== window.parent) return;
  const data = event.data;
  if (!data || typeof data !== "object" || !isLocale(data.locale)) return;
  document.querySelectorAll<HTMLElement>("#almar-hero-booker-root").forEach((host) => {
    const root = roots.get(host);
    if (!root) return;
    locales.set(host, data.locale);
    root.render(<HeroBooker locale={data.locale} onBook={openTrip} />);
  });
});

window.AlmarMountHeroBooker = mountHeroBooker;
