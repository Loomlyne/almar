// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
// Copy for the /experiences page (phase 3.3 plan 14, controller reconcile R-9).
//
// EN is the published text of the live Framer page where it has one (the meta title and description) and the signed
// design's text (S2-DESIGN 1.2, 1.3, 4.1) for everything the live page never had. Every string that has a key on board 5e
// (PublicExperiences.dc.html) or board 5f (PublicOverlay.dc.html) is that board's dictionary value in all three languages,
// verbatim: tests/experiences-page-copy.test.mjs reads the boards and pins each one. Every other AR (Gulf-friendly Modern
// Standard Arabic) and ES (neutral Latin American) string is a DRAFT written from the EN text, for the owner's review:
//   the three plural families count / showResults / badge, removeFilter, empty, the filter-rail label, the overlay's
//   Service / Private stays / Close words, and the AR and ES meta strings.
// Numbers are Western numerals in all three languages (formatPlural does that).
// The footer is shared and lives in lib/copy/site-footer.ts; "Request Inquiry" is the stay pages' own label, pinned equal to
// STAY_DETAIL_COPY by the copy test. Imported directly by components/pages/experiences-page.tsx; deliberately not registered
// in lib/copy/index.ts (reconcile R-9).

import type { PluralForms } from "../journey-format";

export type ExperiencesPageLocale = "en" | "ar" | "es";

export type ExperiencesPageCopy = {
  meta: { title: string; description: string };
  /** The page h1 (board 5e k15). */
  heading: string;
  filters: {
    /** Accessible name of the desktop filter rail. */
    label: string;
    /** The Filters button below 1024px (board 5e k74). */
    button: string;
    /** The Filters sheet's title (board 5e k74). */
    title: string;
  };
  search: { label: string };
  type: { label: string; all: string; experiences: string; services: string };
  destination: { label: string };
  stay: { label: string };
  clear: string;
  /** Group heads: the same words as type.experiences and type.services (board 5e k64, k65). */
  groups: { experiences: string; services: string };
  /** "45 options". `#` is the number. */
  count: PluralForms;
  /** The Filters sheet's primary button: "Show 14 options". */
  showResults: PluralForms;
  /** The Filters button's badge, read by assistive technology: "2 active filters". */
  badge: PluralForms;
  /** "Remove filter: {name}". */
  removeFilter: string;
  empty: string;
  overlay: {
    experience: string;
    service: string;
    duration: string;
    stays: string;
    requestInquiry: string;
    close: string;
  };
};

export const EXPERIENCES_PAGE_COPY: Record<ExperiencesPageLocale, ExperiencesPageCopy> = {
  en: {
    meta: {
      title: "Private tours and experiences in Colombia | ALMAR",
      description: "Private boat trips, city tours, food walks, and more. Every experience is just for you and your group.",
    },
    heading: "Experiences and services",
    filters: { label: "Filter experiences and services", button: "Filters", title: "Filters" },
    search: { label: "Search experiences and services" },
    type: { label: "Type", all: "All", experiences: "Experiences", services: "Services" },
    destination: { label: "Destination" },
    stay: { label: "Private stay" },
    clear: "Clear filters",
    groups: { experiences: "Experiences", services: "Services" },
    count: { one: "# option", other: "# options" },
    showResults: { one: "Show # option", other: "Show # options" },
    badge: { one: "# active filter", other: "# active filters" },
    removeFilter: "Remove filter: {name}",
    empty: "No experiences or services match these filters.",
    overlay: {
      experience: "Experience",
      service: "Service",
      duration: "Duration",
      stays: "Private stays",
      requestInquiry: "Request Inquiry",
      close: "Close",
    },
  },
  ar: {
    meta: {
      title: "جولات وتجارب خاصة في كولومبيا | ALMAR",
      description: "رحلات بحرية خاصة وجولات في المدن وجولات طعام وغيرها. كل تجربة مخصصة لكم ولمجموعتكم فقط.",
    },
    heading: "التجارب والخدمات",
    filters: { label: "تصفية التجارب والخدمات", button: "التصفية", title: "التصفية" },
    search: { label: "ابحث في التجارب والخدمات" },
    type: { label: "النوع", all: "الكل", experiences: "التجارب", services: "الخدمات" },
    destination: { label: "الوجهة" },
    stay: { label: "إقامة خاصة" },
    clear: "مسح التصفية",
    groups: { experiences: "التجارب", services: "الخدمات" },
    count: {
      zero: "لا خيارات",
      one: "خيار واحد",
      two: "خياران",
      few: "# خيارات",
      many: "# خيارًا",
      other: "# خيار",
    },
    showResults: {
      zero: "لا خيارات للعرض",
      one: "اعرض خيارًا واحدًا",
      two: "اعرض خيارين",
      few: "اعرض # خيارات",
      many: "اعرض # خيارًا",
      other: "اعرض # خيار",
    },
    badge: {
      zero: "لا عوامل تصفية مفعّلة",
      one: "عامل تصفية مفعّل واحد",
      two: "عاملا تصفية مفعّلان",
      few: "# عوامل تصفية مفعّلة",
      many: "# عامل تصفية مفعّل",
      other: "# عامل تصفية مفعّل",
    },
    removeFilter: "إزالة عامل التصفية: {name}",
    empty: "لا توجد تجارب أو خدمات تطابق عوامل التصفية هذه.",
    overlay: {
      experience: "تجربة",
      service: "خدمة",
      duration: "المدة",
      stays: "الإقامات الخاصة",
      requestInquiry: "أرسلوا استفساراً",
      close: "إغلاق",
    },
  },
  es: {
    meta: {
      title: "Tours y experiencias privadas en Colombia | ALMAR",
      description: "Paseos privados en barco, recorridos por la ciudad, rutas gastronómicas y más. Cada experiencia es solo para ti y tu grupo.",
    },
    heading: "Experiencias y servicios",
    filters: { label: "Filtrar experiencias y servicios", button: "Filtros", title: "Filtros" },
    search: { label: "Buscar experiencias y servicios" },
    type: { label: "Tipo", all: "Todo", experiences: "Experiencias", services: "Servicios" },
    destination: { label: "Destino" },
    stay: { label: "Estancia privada" },
    clear: "Borrar filtros",
    groups: { experiences: "Experiencias", services: "Servicios" },
    count: { one: "# opción", other: "# opciones" },
    showResults: { one: "Mostrar # opción", other: "Mostrar # opciones" },
    badge: { one: "# filtro activo", other: "# filtros activos" },
    removeFilter: "Quitar filtro: {name}",
    empty: "Ninguna experiencia o servicio coincide con estos filtros.",
    overlay: {
      experience: "Experiencia",
      service: "Servicio",
      duration: "Duración",
      stays: "Estancias privadas",
      requestInquiry: "Solicitar información",
      close: "Cerrar",
    },
  },
};
