// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
// Copy for the /private-stays list page (phase 3.3 plan 05, controller reconcile R-9).
//
// EN is the published text of the live Framer list page where it has one (meta title and description, the
// h1) and the proposal text of design 1.2 for the filters, which the live page never had. The h1 in all three
// languages is board 5h's dictionary key k16, verbatim.
// AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American) are DRAFTS written from the EN
// strings, flagged for the owner's review, in the same practice as lib/copy/journey.ts.
// Numbers are Western numerals in all three languages (formatPlural does that).
// Imported directly by components/pages/private-stays-page.tsx; deliberately not registered in
// lib/copy/index.ts (reconcile R-9).

import type { PluralForms } from "../journey-format";

export type StaysListLocale = "en" | "ar" | "es";

export type StaysListCopy = {
  meta: { title: string; description: string };
  /** The page h1. */
  heading: string;
  /** Accessible name of the whole filter bar. */
  filtersLabel: string;
  search: { label: string };
  destination: { label: string; all: string };
  guests: { label: string; any: string; add: string; remove: string; atMax: string };
  bedrooms: { label: string; options: { any: string; "1-4": string; "5-8": string; "9+": string } };
  /** The live result line: "12 stays". `#` is the number. */
  count: PluralForms;
  empty: string;
  clear: string;
};

export const STAYS_LIST_COPY: Record<StaysListLocale, StaysListCopy> = {
  en: {
    meta: {
      title: "Private villas and houses in Colombia | ALMAR",
      description: "Private villas and houses in Cartagena, Medellín, and more. ALMAR checks every home before you book.",
    },
    heading: "Your Stay, Personally Selected",
    filtersLabel: "Filter stays",
    search: { label: "Search stays" },
    destination: { label: "Destination", all: "All" },
    guests: {
      label: "Guests",
      any: "Any",
      add: "Add a guest",
      remove: "Remove a guest",
      atMax: "No stay takes more guests.",
    },
    bedrooms: {
      label: "Bedrooms",
      options: { any: "Any", "1-4": "1–4", "5-8": "5–8", "9+": "9+" },
    },
    count: { one: "# stay", other: "# stays" },
    empty: "No stays match these filters.",
    clear: "Clear filters",
  },
  ar: {
    meta: {
      title: "فلل وبيوت خاصة في كولومبيا | ALMAR",
      description: "فلل وبيوت خاصة في كارتاخينا وميديلين وغيرها. تتحقق ALMAR من كل بيت قبل الحجز.",
    },
    heading: "إقامتك، مختارة بعناية شخصية",
    filtersLabel: "تصفية الإقامات",
    search: { label: "ابحث في الإقامات" },
    destination: { label: "الوجهة", all: "الكل" },
    guests: {
      label: "الضيوف",
      any: "أي عدد",
      add: "أضف ضيفًا",
      remove: "أزل ضيفًا",
      atMax: "لا توجد إقامة تستوعب مزيدًا من الضيوف.",
    },
    bedrooms: {
      label: "غرف النوم",
      options: { any: "أي عدد", "1-4": "1–4", "5-8": "5–8", "9+": "9+" },
    },
    count: {
      zero: "لا توجد إقامات",
      one: "إقامة واحدة",
      two: "إقامتان",
      few: "# إقامات",
      many: "# إقامة",
      other: "# إقامة",
    },
    empty: "لا توجد إقامات تطابق عوامل التصفية هذه.",
    clear: "مسح التصفية",
  },
  es: {
    meta: {
      title: "Villas y casas privadas en Colombia | ALMAR",
      description: "Villas y casas privadas en Cartagena, Medellín y más. ALMAR revisa cada casa antes de reservar.",
    },
    heading: "Tu estancia, elegida personalmente",
    filtersLabel: "Filtrar estancias",
    search: { label: "Buscar estancias" },
    destination: { label: "Destino", all: "Todos" },
    guests: {
      label: "Huéspedes",
      any: "Cualquiera",
      add: "Agregar un huésped",
      remove: "Quitar un huésped",
      atMax: "Ninguna estancia admite más huéspedes.",
    },
    bedrooms: {
      label: "Habitaciones",
      options: { any: "Cualquiera", "1-4": "1–4", "5-8": "5–8", "9+": "9+" },
    },
    count: { one: "# estancia", other: "# estancias" },
    empty: "Ninguna estancia coincide con estos filtros.",
    clear: "Borrar filtros",
  },
};
