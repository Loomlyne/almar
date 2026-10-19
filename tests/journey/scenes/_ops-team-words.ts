// Bracket words for the Team and Packages scenes (ops-team.tsx, ops-journeys.tsx), plan 03.2-08: placeholders in each
// language, never a real person, never a price and never a photo of a person. Test-only. The leading underscore keeps
// it out of the scene matrix.
import type { Locale3, MediaRef } from "../../../components/ops/api-types";
import { mediaUrl } from "../../../lib/data/media";

type Words = {
  name: string;
  role: string;
  bio: string;
  member: string;
  journey: string;
  tagline: string;
  duration: string;
  idealForLabel: string;
  idealFor: string;
  description: string;
  priceLine: string;
};

const WORDS: Record<Locale3, Words> = {
  en: {
    name: "[Name]",
    role: "[Role]",
    bio: "[Bio]",
    member: "Member",
    journey: "Journey",
    tagline: "[Tagline]",
    duration: "[Duration line]",
    idealForLabel: "[Ideal-for label]",
    idealFor: "[Ideal for]",
    description: "[Description]",
    priceLine: "[Price line]",
  },
  ar: {
    name: "[الاسم]",
    role: "[المنصب]",
    bio: "[نبذة]",
    member: "العضو",
    journey: "الرحلة",
    tagline: "[الشعار]",
    duration: "[سطر المدة]",
    idealForLabel: "[تسمية «مثالي لـ»]",
    idealFor: "[مثالي لـ]",
    description: "[الوصف]",
    priceLine: "[سطر السعر]",
  },
  es: {
    name: "[Nombre]",
    role: "[Cargo]",
    bio: "[Biografía]",
    member: "Miembro",
    journey: "Viaje",
    tagline: "[Lema]",
    duration: "[Línea de duración]",
    idealForLabel: "[Etiqueta «Ideal para»]",
    idealFor: "[Ideal para]",
    description: "[Descripción]",
    priceLine: "[Línea de precio]",
  },
};

export const teamWords = (locale: Locale3): Words => WORDS[locale];
export const numberedTeam = (locale: Locale3, key: "member" | "journey", n: number): string => `[${WORDS[locale][key]} ${n}]`;

/** The amount placeholder of a price reading: brackets, never a number the owner has not written. */
export const AMOUNT_PLACEHOLDER = "[AMOUNT]";

/** A landscape from the repo's own media (no person in it), for the journey photo. */
export const JOURNEY_PHOTO: MediaRef = {
  id: "m1",
  key: "destinations/cocora-valley/hero.webp",
  url: mediaUrl("destinations/cocora-valley/hero.webp"),
  width: 1600,
  height: 1067,
  alt_en: "[Photo description]",
};
