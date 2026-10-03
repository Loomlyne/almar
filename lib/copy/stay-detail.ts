// Strings of the private-stay detail page (phase 3.3 plan 06). Imported directly by
// components/pages/stay-detail-page.tsx; not registered in lib/copy/index.ts (reconcile R-9).
//
// EN is the published text, read from the 12 live stay pages on 2026-10-03, verbatim.
// AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American, formal plural) are DRAFTS written
// from the published English, flagged for the owner's review (the lib/copy/journey.ts convention).
// Names of properties and neighbourhoods keep their Spanish spelling and are not in this file: they come from
// lib/data.
//
// `{title}`, `{alt}`, `{n}` and `{total}` are slots. Numbers and dates are Western numerals in every language.

export type StayDetailLocale = "en" | "ar" | "es";

export type StayDetailCopy = {
  about: string;
  amenities: string;
  amenitiesIntro: string;
  policies: string;
  services: string;
  servicesIntro: string;
  experiences: string;
  experiencesIntro: string;
  related: string;
  facts: {
    guests: string;
    bathrooms: string;
    bedrooms: string;
    beds: string;
    neighborhood: string;
  };
  inclusionsLabel: string;
  requestInquiry: string;
  gallery: {
    /** A tile's accessible name; `{alt}` is the picture's description. */
    open: string;
    previous: string;
    next: string;
    close: string;
    /** `{n} of {total}` */
    count: string;
  };
  /** Board 5i's own footnote, shown while the blocked dates are examples (sample_fields). */
  sampleDatesNote: string;
  metaTitle: string;
  metaDescription: string;
  footer: {
    /** Screen-reader suffix for a link that opens in a new tab. */
    newTab: string;
    /** Accessible name of the footer's language row. */
    language: string;
    /** The footer's last line; the EN text is the live footer's. */
    copyright: string;
  };
};

export const STAY_DETAIL_COPY: Record<StayDetailLocale, StayDetailCopy> = {
  en: {
    about: "About",
    amenities: "Amenities",
    amenitiesIntro: "Selected amenities included with this private stay.",
    policies: "Policies to check",
    services: "Services",
    servicesIntro: "Arrangements available with this private stay.",
    experiences: "Experiences",
    experiencesIntro: "Experiences suited to this private stay and its setting.",
    related: "More Private Stays",
    facts: {
      guests: "Guests",
      bathrooms: "Bathrooms",
      bedrooms: "Bedrooms",
      beds: "Beds",
      neighborhood: "Neighborhood",
    },
    inclusionsLabel: "Included with the stay:",
    requestInquiry: "Request Inquiry",
    gallery: {
      open: "Open {alt}",
      previous: "Previous picture",
      next: "Next picture",
      close: "Close",
      count: "{n} of {total}",
    },
    sampleDatesNote: "Blocked dates here are examples.",
    metaTitle: "{title} — private stay in Colombia | ALMAR",
    metaDescription:
      "Book {title} as a private stay in Colombia. ALMAR checks the home, handles staff, and plans your trip.",
    footer: {
      newTab: "(opens in a new tab)",
      language: "Language",
      copyright: "© 2026 ALMAR Private Journeys. All rights reserved.",
    },
  },
  ar: {
    about: "نبذة",
    amenities: "المرافق",
    amenitiesIntro: "مرافق مختارة مشمولة في هذه الإقامة الخاصة.",
    policies: "سياسات يُرجى مراجعتها",
    services: "الخدمات",
    servicesIntro: "ترتيبات متاحة مع هذه الإقامة الخاصة.",
    experiences: "التجارب",
    experiencesIntro: "تجارب تناسب هذه الإقامة الخاصة ومحيطها.",
    related: "المزيد من الإقامات الخاصة",
    facts: {
      guests: "الضيوف",
      bathrooms: "الحمامات",
      bedrooms: "غرف النوم",
      beds: "الأسرّة",
      neighborhood: "الحي",
    },
    inclusionsLabel: "مشمول مع الإقامة:",
    requestInquiry: "اطلبوا استفساراً",
    gallery: {
      open: "افتح {alt}",
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      close: "إغلاق",
      count: "{n} من {total}",
    },
    sampleDatesNote: "التواريخ المحجوبة هنا أمثلة.",
    metaTitle: "{title} — إقامة خاصة في كولومبيا | ALMAR",
    metaDescription:
      "احجزوا {title} كإقامة خاصة في كولومبيا. تتحقق ALMAR من المنزل وتتولى شؤون الطاقم وتخطط لرحلتكم.",
    footer: {
      newTab: "(يفتح في نافذة جديدة)",
      language: "اللغة",
      copyright: "© 2026 ALMAR Private Journeys. جميع الحقوق محفوظة.",
    },
  },
  es: {
    about: "Acerca de",
    amenities: "Comodidades",
    amenitiesIntro: "Comodidades seleccionadas incluidas en esta estancia privada.",
    policies: "Políticas a revisar",
    services: "Servicios",
    servicesIntro: "Arreglos disponibles con esta estancia privada.",
    experiences: "Experiencias",
    experiencesIntro: "Experiencias pensadas para esta estancia privada y su entorno.",
    related: "Más estancias privadas",
    facts: {
      guests: "Huéspedes",
      bathrooms: "Baños",
      bedrooms: "Habitaciones",
      beds: "Camas",
      neighborhood: "Barrio",
    },
    inclusionsLabel: "Incluido en la estancia:",
    requestInquiry: "Solicitar información",
    gallery: {
      open: "Abrir {alt}",
      previous: "Imagen anterior",
      next: "Imagen siguiente",
      close: "Cerrar",
      count: "{n} de {total}",
    },
    sampleDatesNote: "Las fechas bloqueadas aquí son ejemplos.",
    metaTitle: "{title} — estancia privada en Colombia | ALMAR",
    metaDescription:
      "Reserven {title} como estancia privada en Colombia. ALMAR revisa la casa, se ocupa del personal y planifica su viaje.",
    footer: {
      newTab: "(se abre en una pestaña nueva)",
      language: "Idioma",
      copyright: "© 2026 ALMAR Private Journeys. Todos los derechos reservados.",
    },
  },
};
