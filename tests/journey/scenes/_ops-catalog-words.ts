// Bracket words for the Catalog scenes (ops-destinations.tsx, ops-catalog-items.tsx): names and values are placeholders in
// each language, never real data and never a price. Test-only. The leading underscore keeps it out of the scene matrix.
import type { Locale3, MediaRef } from "../../../components/ops/api-types";

type Words = {
  name: string;
  shortLine: string;
  region: string;
  description: string;
  nightsLine: string;
  duration: string;
  webAddress: string;
  destination: string;
  stay: string;
  item: string;
  price: string;
};

const WORDS: Record<Locale3, Words> = {
  en: {
    name: "[Name]",
    shortLine: "[Short line]",
    region: "[Region]",
    description: "[Description]",
    nightsLine: "[Nights line]",
    duration: "[Duration line]",
    webAddress: "[web-address]",
    destination: "Destination",
    stay: "Stay",
    item: "Item",
    price: "[PRICE]",
  },
  ar: {
    name: "[الاسم]",
    shortLine: "[سطر قصير]",
    region: "[المنطقة]",
    description: "[الوصف]",
    nightsLine: "[سطر الليالي]",
    duration: "[سطر المدة]",
    webAddress: "[web-address]",
    destination: "الوجهة",
    stay: "الإقامة",
    item: "البند",
    price: "[PRICE]",
  },
  es: {
    name: "[Nombre]",
    shortLine: "[Línea breve]",
    region: "[Región]",
    description: "[Descripción]",
    nightsLine: "[Línea de noches]",
    duration: "[Línea de duración]",
    webAddress: "[web-address]",
    destination: "Destino",
    stay: "Estancia",
    item: "Elemento",
    price: "[PRICE]",
  },
};

export const words = (locale: Locale3): Words => WORDS[locale];
export const numbered = (locale: Locale3, key: "destination" | "stay" | "item", n: number): string => `[${WORDS[locale][key]} ${n}]`;

/** One local picture for the photo fields: no media routing in the harness. */
export const SCENE_PHOTO: MediaRef = {
  id: "m1",
  key: "scene/[file-name].webp",
  url: "/assets/img/01b7e3d407f3fb73.webp",
  width: 1600,
  height: 1084,
  alt_en: "[Photo description]",
};
